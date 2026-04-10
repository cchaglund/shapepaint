-- Phase 0: Back up submissions table before making changes
CREATE TABLE submissions_backup AS SELECT * FROM submissions;

-- Phase 1: Add background_color column (nullable initially)
ALTER TABLE submissions ADD COLUMN background_color TEXT;

-- Phase 2: Backfill existing submissions
-- Step 1: Backfill background_color from challenge colors
UPDATE submissions s
SET background_color = (
  SELECT CASE s.background_color_index
    WHEN 0 THEN c.color_1
    WHEN 1 THEN c.color_2
    WHEN 2 THEN c.color_3
    ELSE NULL
  END
  FROM challenges c
  WHERE c.challenge_date = s.challenge_date
)
WHERE s.background_color_index IS NOT NULL;

-- Step 2: Inject "color" hex string into each shape in the shapes JSONB array
-- Skip submissions with empty shapes arrays (jsonb_agg on zero rows returns NULL)
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
)
WHERE jsonb_array_length(s.shapes) > 0;

-- Step 3: Invalidate wall cache (stale payloads without new fields)
TRUNCATE wall_cache;
