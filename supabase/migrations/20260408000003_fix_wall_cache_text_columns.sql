-- Fix: challenge_date is TEXT in all tables, not DATE. Use text throughout.
DROP FUNCTION IF EXISTS get_wall_cached(date, text, int);
DROP FUNCTION IF EXISTS get_wall_cached(text, text, int);

-- Recreate wall_cache with text column to match submissions/daily_rankings schema
DROP TABLE IF EXISTS wall_cache;
CREATE TABLE wall_cache (
  challenge_date text NOT NULL,
  sort_mode text NOT NULL,
  data jsonb NOT NULL,
  cached_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (challenge_date, sort_mode)
);
ALTER TABLE wall_cache ENABLE ROW LEVEL SECURITY;

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

  -- Check cache
  SELECT data, cached_at INTO cached_row
  FROM wall_cache
  WHERE challenge_date = p_date AND sort_mode = p_sort_mode;

  -- Cache hit: return if fresh (past dates = always, today = 30s TTL)
  IF cached_row IS NOT NULL AND (
    NOT is_today
    OR cached_row.cached_at > now() - interval '30 seconds'
  ) THEN
    RETURN cached_row.data;
  END IF;

  -- Cache miss: run the full query
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

  ELSE -- 'newest' (default)
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

  -- Write to cache
  INSERT INTO wall_cache (challenge_date, sort_mode, data, cached_at)
  VALUES (p_date, p_sort_mode, result, now())
  ON CONFLICT (challenge_date, sort_mode)
  DO UPDATE SET data = EXCLUDED.data, cached_at = now();

  RETURN result;
END;
$$;
