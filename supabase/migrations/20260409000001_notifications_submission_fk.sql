-- =============================================================================
-- Add submission_id FK column to notifications + bake challenge colors into JSONB
--
-- Why: eliminates 2 extra API calls from the frontend when rendering thumbnails.
-- fetchNotifications can now JOIN on submissions in a single query, and colors
-- are available directly in the notification data (no challenge lookup needed).
-- =============================================================================

-- 1. Add submission_id column with FK
ALTER TABLE notifications
  ADD COLUMN submission_id UUID REFERENCES submissions(id);

CREATE INDEX idx_notifications_submission
  ON notifications (submission_id)
  WHERE submission_id IS NOT NULL;

-- 2. Backfill submission_id from existing JSONB data
UPDATE notifications
SET submission_id = (data->>'submission_id')::UUID
WHERE data->>'submission_id' IS NOT NULL;

-- 3. Backfill colors into JSONB data for existing notifications
UPDATE notifications n
SET data = n.data || jsonb_build_object('colors',
  CASE
    WHEN c.color_3 IS NOT NULL THEN jsonb_build_array(c.color_1, c.color_2, c.color_3)
    ELSE jsonb_build_array(c.color_1, c.color_2)
  END
)
FROM submissions s
JOIN challenges c ON c.challenge_date = s.challenge_date
WHERE n.data->>'submission_id' IS NOT NULL
  AND s.id = (n.data->>'submission_id')::UUID
  AND n.data->'colors' IS NULL;

-- 4. Update notify_on_like: populate submission_id column + bake colors
CREATE OR REPLACE FUNCTION notify_on_like()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id UUID;
  v_actor_nickname TEXT;
  v_actor_avatar TEXT;
  v_challenge_date TEXT;
  v_colors JSONB;
BEGIN
  SELECT user_id, challenge_date INTO v_owner_id, v_challenge_date
  FROM submissions WHERE id = NEW.submission_id;

  IF v_owner_id IS NULL OR v_owner_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  SELECT nickname, avatar_url INTO v_actor_nickname, v_actor_avatar
  FROM profiles WHERE id = NEW.user_id;

  SELECT CASE
    WHEN color_3 IS NOT NULL THEN jsonb_build_array(color_1, color_2, color_3)
    ELSE jsonb_build_array(color_1, color_2)
  END INTO v_colors
  FROM challenges WHERE challenge_date = v_challenge_date;

  INSERT INTO notifications (user_id, type, submission_id, data)
  VALUES (
    v_owner_id,
    'like',
    NEW.submission_id,
    jsonb_build_object(
      'actor_id', NEW.user_id,
      'actor_nickname', v_actor_nickname,
      'actor_avatar', v_actor_avatar,
      'submission_id', NEW.submission_id,
      'colors', COALESCE(v_colors, '[]'::jsonb)
    )
  );

  RETURN NEW;
END;
$$;

-- 5. Update notify_on_submission: populate submission_id column + bake colors
CREATE OR REPLACE FUNCTION notify_on_submission()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_nickname TEXT;
  v_actor_avatar TEXT;
  v_colors JSONB;
  v_follower RECORD;
BEGIN
  SELECT nickname, avatar_url INTO v_actor_nickname, v_actor_avatar
  FROM profiles WHERE id = NEW.user_id;

  SELECT CASE
    WHEN color_3 IS NOT NULL THEN jsonb_build_array(color_1, color_2, color_3)
    ELSE jsonb_build_array(color_1, color_2)
  END INTO v_colors
  FROM challenges WHERE challenge_date = NEW.challenge_date;

  FOR v_follower IN
    SELECT follower_id FROM follows WHERE following_id = NEW.user_id
  LOOP
    BEGIN
      INSERT INTO notifications (user_id, type, submission_id, data)
      SELECT
        v_follower.follower_id,
        'friend_submitted',
        NEW.id,
        jsonb_build_object(
          'actor_id', NEW.user_id,
          'actor_nickname', v_actor_nickname,
          'actor_avatar', v_actor_avatar,
          'submission_id', NEW.id,
          'colors', COALESCE(v_colors, '[]'::jsonb)
        )
      WHERE NOT EXISTS (
        SELECT 1 FROM notifications
        WHERE user_id = v_follower.follower_id
          AND type = 'friend_submitted'
          AND data->>'submission_id' = NEW.id::text
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'notification insert failed for follower %: %', v_follower.follower_id, SQLERRM;
    END;
  END LOOP;

  RETURN NEW;
END;
$$;
