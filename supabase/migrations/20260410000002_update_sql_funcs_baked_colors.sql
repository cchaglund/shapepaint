-- Update process_vote_v2 and get_wall_cached to include background_color in JSONB payloads.
-- Shapes already carry "color" in the JSONB from the backfill migration.

-- ============================================================================
-- process_vote_v2: add background_color to next-pair submission objects
-- ============================================================================
CREATE OR REPLACE FUNCTION process_vote_v2(
  p_submission_a_id UUID,
  p_submission_b_id UUID,
  p_winner_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_voter_id UUID;
  v_normalized_a UUID;
  v_normalized_b UUID;
  v_challenge_date TEXT;
  v_today_date TEXT;
  v_other_count INTEGER;
  v_required_votes INTEGER;
  v_total_pairs INTEGER;
  v_is_actual_vote BOOLEAN;
  v_rating_a FLOAT;
  v_rating_b FLOAT;
  v_votes_a INTEGER;
  v_votes_b INTEGER;
  v_expected_a FLOAT;
  v_score_a FLOAT;
  v_new_rating_a INTEGER;
  v_new_rating_b INTEGER;
  v_winner CHAR(1);
  v_old_vote_count INTEGER;
  v_new_vote_count INTEGER;
  v_entered_ranking BOOLEAN;
  v_was_entered BOOLEAN;
  v_next_a_id UUID;
  v_next_b_id UUID;
  v_next_a_user_id UUID;
  v_next_b_user_id UUID;
  v_next_pair JSONB;
  v_user_submission_id UUID;
BEGIN
  v_voter_id := auth.uid();
  IF v_voter_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Unauthorized', 'status', 401);
  END IF;

  IF p_submission_a_id < p_submission_b_id THEN
    v_normalized_a := p_submission_a_id;
    v_normalized_b := p_submission_b_id;
  ELSE
    v_normalized_a := p_submission_b_id;
    v_normalized_b := p_submission_a_id;
  END IF;

  v_challenge_date := to_char((now() AT TIME ZONE 'UTC') - interval '1 day', 'YYYY-MM-DD');
  v_today_date := to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD');

  SELECT count(*) INTO v_other_count
  FROM submissions
  WHERE challenge_date = v_challenge_date
    AND user_id != v_voter_id;

  IF v_other_count = 0 THEN
    v_required_votes := 0;
  ELSE
    v_total_pairs := (v_other_count * (v_other_count - 1)) / 2;
    v_required_votes := LEAST(5, v_total_pairs);
  END IF;

  BEGIN
    INSERT INTO comparisons (voter_id, challenge_date, submission_a_id, submission_b_id, winner_id)
    VALUES (v_voter_id, v_challenge_date, v_normalized_a, v_normalized_b, p_winner_id);
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('error', 'Already voted on this pair', 'status', 409);
  END;

  v_is_actual_vote := (p_winner_id IS NOT NULL);

  IF v_is_actual_vote THEN
    SELECT elo_score, vote_count INTO v_rating_a, v_votes_a
    FROM daily_rankings
    WHERE submission_id = v_normalized_a AND challenge_date = v_challenge_date
    FOR UPDATE;

    SELECT elo_score, vote_count INTO v_rating_b, v_votes_b
    FROM daily_rankings
    WHERE submission_id = v_normalized_b AND challenge_date = v_challenge_date
    FOR UPDATE;

    IF v_rating_a IS NOT NULL AND v_rating_b IS NOT NULL THEN
      v_expected_a := 1.0 / (1.0 + power(10.0, (v_rating_b - v_rating_a) / 400.0));

      IF p_winner_id = v_normalized_a THEN
        v_score_a := 1.0;
      ELSE
        v_score_a := 0.0;
      END IF;

      v_new_rating_a := round(v_rating_a + 32.0 * (v_score_a - v_expected_a));
      v_new_rating_b := round(v_rating_b + 32.0 * ((1.0 - v_score_a) - (1.0 - v_expected_a)));

      UPDATE daily_rankings
      SET elo_score = v_new_rating_a, vote_count = v_votes_a + 1
      WHERE submission_id = v_normalized_a AND challenge_date = v_challenge_date;

      UPDATE daily_rankings
      SET elo_score = v_new_rating_b, vote_count = v_votes_b + 1
      WHERE submission_id = v_normalized_b AND challenge_date = v_challenge_date;
    END IF;
  END IF;

  SELECT vote_count, entered_ranking
  INTO v_old_vote_count, v_was_entered
  FROM user_voting_status
  WHERE user_id = v_voter_id AND challenge_date = v_challenge_date;

  IF v_old_vote_count IS NOT NULL THEN
    v_new_vote_count := CASE WHEN v_is_actual_vote THEN v_old_vote_count + 1 ELSE v_old_vote_count END;
    v_entered_ranking := (v_new_vote_count >= v_required_votes);

    UPDATE user_voting_status
    SET vote_count = v_new_vote_count,
        entered_ranking = v_entered_ranking
    WHERE user_id = v_voter_id AND challenge_date = v_challenge_date;
  ELSE
    v_new_vote_count := CASE WHEN v_is_actual_vote THEN 1 ELSE 0 END;
    v_entered_ranking := (v_new_vote_count >= v_required_votes);
    v_was_entered := false;

    INSERT INTO user_voting_status (user_id, challenge_date, vote_count, entered_ranking)
    VALUES (v_voter_id, v_challenge_date, v_new_vote_count, v_entered_ranking);
  END IF;

  IF v_entered_ranking AND NOT v_was_entered THEN
    UPDATE submissions
    SET included_in_ranking = true
    WHERE user_id = v_voter_id AND challenge_date = v_today_date;
  END IF;

  SELECT s.id INTO v_user_submission_id
  FROM submissions s
  WHERE s.user_id = v_voter_id AND s.challenge_date = v_challenge_date;

  SELECT cp.sub_a, cp.sub_b, cp.user_a, cp.user_b
  INTO v_next_a_id, v_next_b_id, v_next_a_user_id, v_next_b_user_id
  FROM (
    WITH sampled AS (
      SELECT dr.submission_id, dr.user_id, dr.elo_score, dr.vote_count
      FROM daily_rankings dr
      WHERE dr.challenge_date = v_challenge_date
        AND dr.submission_id != COALESCE(v_user_submission_id, '00000000-0000-0000-0000-000000000000'::UUID)
      ORDER BY dr.vote_count ASC, RANDOM()
      LIMIT 20
    ),
    candidate_pairs AS (
      SELECT
        a.submission_id AS sub_a,
        b.submission_id AS sub_b,
        a.user_id AS user_a,
        b.user_id AS user_b,
        (a.vote_count + b.vote_count) AS total_votes,
        ABS(a.elo_score - b.elo_score) AS elo_diff
      FROM sampled a
      CROSS JOIN sampled b
      WHERE a.submission_id < b.submission_id
        AND NOT EXISTS (
          SELECT 1 FROM comparisons c
          WHERE c.voter_id = v_voter_id
            AND c.challenge_date = v_challenge_date
            AND c.submission_a_id = a.submission_id
            AND c.submission_b_id = b.submission_id
        )
    )
    SELECT sub_a, sub_b, user_a, user_b
    FROM candidate_pairs
    ORDER BY total_votes ASC, elo_diff ASC
    LIMIT 1
  ) cp;

  IF v_next_a_id IS NOT NULL THEN
    SELECT jsonb_build_object(
      'submissionA', jsonb_build_object(
        'id', sa.id,
        'user_id', sa.user_id,
        'shapes', sa.shapes,
        'groups', sa.groups,
        'background_color_index', sa.background_color_index,
        'background_color', sa.background_color
      ),
      'submissionB', jsonb_build_object(
        'id', sb.id,
        'user_id', sb.user_id,
        'shapes', sb.shapes,
        'groups', sb.groups,
        'background_color_index', sb.background_color_index,
        'background_color', sb.background_color
      )
    ) INTO v_next_pair
    FROM submissions sa, submissions sb
    WHERE sa.id = v_next_a_id AND sb.id = v_next_b_id;
  ELSE
    v_next_pair := NULL;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'voteCount', v_new_vote_count,
    'requiredVotes', v_required_votes,
    'enteredRanking', v_entered_ranking,
    'nextPair', v_next_pair
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================================
-- get_wall_cached: add background_color to all 4 sort-mode branches
-- ============================================================================
DROP FUNCTION IF EXISTS get_wall_cached(text, text, int);

CREATE OR REPLACE FUNCTION get_wall_cached(
  p_date text,
  p_sort_mode text DEFAULT 'newest',
  p_limit int DEFAULT 101
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cached_row record;
  is_today boolean;
  result jsonb;
BEGIN
  is_today := (p_date = CURRENT_DATE::text);

  SELECT data, cached_at INTO cached_row
  FROM wall_cache
  WHERE challenge_date = p_date AND sort_mode = p_sort_mode;

  IF cached_row IS NOT NULL AND (
    NOT is_today
    OR cached_row.cached_at > now() - interval '30 seconds'
  ) THEN
    RETURN cached_row.data;
  END IF;

  IF p_sort_mode = 'ranked' THEN
    SELECT COALESCE(jsonb_agg(row_data), '[]'::jsonb)
    INTO result
    FROM (
      SELECT jsonb_build_object(
        'id', s.id,
        'user_id', s.user_id,
        'nickname', COALESCE(p.nickname, 'Anonymous'),
        'avatar_url', p.avatar_url,
        'shapes', s.shapes,
        'groups', COALESCE(s.groups, '[]'::jsonb),
        'background_color_index', s.background_color_index,
        'background_color', s.background_color,
        'created_at', s.created_at,
        'final_rank', dr.final_rank,
        'like_count', COALESCE(s.like_count, 0)
      ) AS row_data
      FROM daily_rankings dr
      INNER JOIN submissions s ON s.id = dr.submission_id
      LEFT JOIN profiles p ON p.id = s.user_id
      WHERE dr.challenge_date = p_date
        AND dr.final_rank IS NOT NULL
      ORDER BY dr.final_rank ASC
      LIMIT p_limit
    ) sub;

  ELSIF p_sort_mode = 'likes' THEN
    SELECT COALESCE(jsonb_agg(row_data), '[]'::jsonb)
    INTO result
    FROM (
      SELECT jsonb_build_object(
        'id', s.id,
        'user_id', s.user_id,
        'nickname', COALESCE(p.nickname, 'Anonymous'),
        'avatar_url', p.avatar_url,
        'shapes', s.shapes,
        'groups', COALESCE(s.groups, '[]'::jsonb),
        'background_color_index', s.background_color_index,
        'background_color', s.background_color,
        'created_at', s.created_at,
        'final_rank', dr.final_rank,
        'like_count', COALESCE(s.like_count, 0)
      ) AS row_data
      FROM submissions s
      LEFT JOIN profiles p ON p.id = s.user_id
      LEFT JOIN daily_rankings dr ON dr.submission_id = s.id
      WHERE s.challenge_date = p_date
      ORDER BY COALESCE(s.like_count, 0) DESC, s.created_at ASC
      LIMIT p_limit
    ) sub;

  ELSIF p_sort_mode = 'oldest' THEN
    SELECT COALESCE(jsonb_agg(row_data), '[]'::jsonb)
    INTO result
    FROM (
      SELECT jsonb_build_object(
        'id', s.id,
        'user_id', s.user_id,
        'nickname', COALESCE(p.nickname, 'Anonymous'),
        'avatar_url', p.avatar_url,
        'shapes', s.shapes,
        'groups', COALESCE(s.groups, '[]'::jsonb),
        'background_color_index', s.background_color_index,
        'background_color', s.background_color,
        'created_at', s.created_at,
        'final_rank', dr.final_rank,
        'like_count', COALESCE(s.like_count, 0)
      ) AS row_data
      FROM submissions s
      LEFT JOIN profiles p ON p.id = s.user_id
      LEFT JOIN daily_rankings dr ON dr.submission_id = s.id
      WHERE s.challenge_date = p_date
      ORDER BY s.created_at ASC
      LIMIT p_limit
    ) sub;

  ELSE
    SELECT COALESCE(jsonb_agg(row_data), '[]'::jsonb)
    INTO result
    FROM (
      SELECT jsonb_build_object(
        'id', s.id,
        'user_id', s.user_id,
        'nickname', COALESCE(p.nickname, 'Anonymous'),
        'avatar_url', p.avatar_url,
        'shapes', s.shapes,
        'groups', COALESCE(s.groups, '[]'::jsonb),
        'background_color_index', s.background_color_index,
        'background_color', s.background_color,
        'created_at', s.created_at,
        'final_rank', dr.final_rank,
        'like_count', COALESCE(s.like_count, 0)
      ) AS row_data
      FROM submissions s
      LEFT JOIN profiles p ON p.id = s.user_id
      LEFT JOIN daily_rankings dr ON dr.submission_id = s.id
      WHERE s.challenge_date = p_date
      ORDER BY s.created_at DESC
      LIMIT p_limit
    ) sub;
  END IF;

  INSERT INTO wall_cache (challenge_date, sort_mode, data, cached_at)
  VALUES (p_date, p_sort_mode, result, now())
  ON CONFLICT (challenge_date, sort_mode)
  DO UPDATE SET data = EXCLUDED.data, cached_at = now();

  RETURN result;
END;
$$;
