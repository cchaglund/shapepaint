-- Replaces the process-vote edge function with a single PL/pgSQL function.
-- All vote processing + next-pair selection happens in one DB transaction,
-- eliminating 10+ sequential network round-trips per vote.

CREATE OR REPLACE FUNCTION process_vote_v2(
  p_submission_a_id UUID,
  p_submission_b_id UUID,
  p_winner_id UUID DEFAULT NULL  -- NULL = skip
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
  -- Elo variables
  v_rating_a FLOAT;
  v_rating_b FLOAT;
  v_votes_a INTEGER;
  v_votes_b INTEGER;
  v_expected_a FLOAT;
  v_score_a FLOAT;
  v_new_rating_a INTEGER;
  v_new_rating_b INTEGER;
  v_winner CHAR(1);
  -- Voting status
  v_old_vote_count INTEGER;
  v_new_vote_count INTEGER;
  v_entered_ranking BOOLEAN;
  v_was_entered BOOLEAN;
  -- Next pair
  v_next_a_id UUID;
  v_next_b_id UUID;
  v_next_a_user_id UUID;
  v_next_b_user_id UUID;
  v_next_pair JSONB;
  v_user_submission_id UUID;
BEGIN
  -- 1. Get voter from auth context
  v_voter_id := auth.uid();
  IF v_voter_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Unauthorized', 'status', 401);
  END IF;

  -- 2. Normalize pair order (A < B)
  IF p_submission_a_id < p_submission_b_id THEN
    v_normalized_a := p_submission_a_id;
    v_normalized_b := p_submission_b_id;
  ELSE
    v_normalized_a := p_submission_b_id;
    v_normalized_b := p_submission_a_id;
  END IF;

  -- 3. Calculate dates (voting is always for yesterday's submissions)
  v_challenge_date := to_char((now() AT TIME ZONE 'UTC') - interval '1 day', 'YYYY-MM-DD');
  v_today_date := to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD');

  -- 4. Count other submissions -> requiredVotes
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

  -- 5. Insert comparison (duplicate = unique violation)
  BEGIN
    INSERT INTO comparisons (voter_id, challenge_date, submission_a_id, submission_b_id, winner_id)
    VALUES (v_voter_id, v_challenge_date, v_normalized_a, v_normalized_b, p_winner_id);
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('error', 'Already voted on this pair', 'status', 409);
  END;

  v_is_actual_vote := (p_winner_id IS NOT NULL);

  -- 6. If not skip, update Elo scores with row locking
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
      -- Elo calculation (K=32)
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

  -- 7. Upsert user_voting_status (single statement replaces SELECT+INSERT/UPDATE)
  SELECT vote_count, entered_ranking
  INTO v_old_vote_count, v_was_entered
  FROM user_voting_status
  WHERE user_id = v_voter_id AND challenge_date = v_challenge_date;

  IF v_old_vote_count IS NOT NULL THEN
    -- Existing row
    v_new_vote_count := CASE WHEN v_is_actual_vote THEN v_old_vote_count + 1 ELSE v_old_vote_count END;
    v_entered_ranking := (v_new_vote_count >= v_required_votes);

    UPDATE user_voting_status
    SET vote_count = v_new_vote_count,
        entered_ranking = v_entered_ranking
    WHERE user_id = v_voter_id AND challenge_date = v_challenge_date;
  ELSE
    -- New row
    v_new_vote_count := CASE WHEN v_is_actual_vote THEN 1 ELSE 0 END;
    v_entered_ranking := (v_new_vote_count >= v_required_votes);
    v_was_entered := false;

    INSERT INTO user_voting_status (user_id, challenge_date, vote_count, entered_ranking)
    VALUES (v_voter_id, v_challenge_date, v_new_vote_count, v_entered_ranking);
  END IF;

  -- 8. If just entered ranking, mark today's submission as included
  IF v_entered_ranking AND NOT v_was_entered THEN
    UPDATE submissions
    SET included_in_ranking = true
    WHERE user_id = v_voter_id AND challenge_date = v_today_date;
  END IF;

  -- 9. Get next pair (inline get_next_pair logic — same transaction sees new comparison)
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

  -- 10. Build next pair with full submission data
  IF v_next_a_id IS NOT NULL THEN
    SELECT jsonb_build_object(
      'submissionA', jsonb_build_object(
        'id', sa.id,
        'user_id', sa.user_id,
        'shapes', sa.shapes,
        'groups', sa.groups,
        'background_color_index', sa.background_color_index
      ),
      'submissionB', jsonb_build_object(
        'id', sb.id,
        'user_id', sb.user_id,
        'shapes', sb.shapes,
        'groups', sb.groups,
        'background_color_index', sb.background_color_index
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
