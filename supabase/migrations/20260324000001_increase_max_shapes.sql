-- Increase max shapes from 200 to 1000.
-- Users with complex artworks were hitting the limit silently.

ALTER TABLE submissions
  DROP CONSTRAINT max_shapes,
  ADD CONSTRAINT max_shapes CHECK (jsonb_array_length(shapes) <= 1000);
