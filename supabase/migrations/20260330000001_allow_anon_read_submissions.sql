-- Allow anonymous (non-logged-in) users to read submissions.
-- Previously only authenticated users could SELECT, which meant
-- the wall and winners pages showed nothing for visitors.

CREATE POLICY "Anyone can read submissions"
  ON submissions FOR SELECT
  TO anon
  USING (true);
