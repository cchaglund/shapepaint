-- Second-round backfill: catch any submissions saved by stale frontends
-- that didn't have the new save-path code (missing shape.color / background_color).
-- Safe to run multiple times — only touches rows where background_color IS NULL.

UPDATE submissions s
SET shapes = (
  SELECT COALESCE(jsonb_agg(
    elem || jsonb_build_object(
      'color',
      CASE (elem->>'colorIndex')::int
        WHEN 0 THEN c.color_1
        WHEN 1 THEN c.color_2
        WHEN 2 THEN c.color_3
      END
    )
    ORDER BY ord
  ), '[]'::jsonb)
  FROM jsonb_array_elements(s.shapes) WITH ORDINALITY AS t(elem, ord)
  JOIN challenges c ON c.challenge_date = s.challenge_date
),
background_color = (
  SELECT CASE s.background_color_index
    WHEN 0 THEN c.color_1
    WHEN 1 THEN c.color_2
    WHEN 2 THEN c.color_3
  END
  FROM challenges c
  WHERE c.challenge_date = s.challenge_date
)
WHERE s.background_color IS NULL
  AND jsonb_array_length(s.shapes) > 0;

-- Invalidate wall cache so fresh payloads include baked colors
TRUNCATE wall_cache;
