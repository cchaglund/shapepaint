-- ============================================================
-- Notifications system: table, indexes, RLS, triggers, realtime, cleanup
-- ============================================================

-- DB-001: notifications table
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- DB-002: indexes
CREATE INDEX idx_notifications_user_unread
  ON notifications (user_id, created_at DESC)
  WHERE NOT is_read;

CREATE INDEX idx_notifications_user_all
  ON notifications (user_id, created_at DESC);

-- DB-003: RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- No INSERT or DELETE policies — triggers use SECURITY DEFINER,
-- cleanup triggers bypass RLS via SECURITY DEFINER.

-- ============================================================
-- DB-004: like notification trigger
-- ============================================================
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
BEGIN
  -- Get submission owner
  SELECT user_id INTO v_owner_id
  FROM submissions
  WHERE id = NEW.submission_id;

  -- Don't notify if user liked their own submission
  IF v_owner_id IS NULL OR v_owner_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  -- Fetch actor nickname and avatar in a single query
  SELECT nickname, avatar_url
  INTO v_actor_nickname, v_actor_avatar
  FROM profiles
  WHERE id = NEW.user_id;

  INSERT INTO notifications (user_id, type, data)
  VALUES (
    v_owner_id,
    'like',
    jsonb_build_object(
      'actor_id', NEW.user_id,
      'actor_nickname', v_actor_nickname,
      'actor_avatar', v_actor_avatar,
      'submission_id', NEW.submission_id
    )
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_on_like
  AFTER INSERT ON likes
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_like();

-- ============================================================
-- DB-005: follow notification trigger (with 24h dedup)
-- ============================================================
CREATE OR REPLACE FUNCTION notify_on_follow()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_nickname TEXT;
  v_actor_avatar TEXT;
BEGIN
  -- 24h dedup: skip if a follow notification from same actor exists within 24h
  IF EXISTS (
    SELECT 1 FROM notifications
    WHERE user_id = NEW.following_id
      AND type = 'follow'
      AND data->>'actor_id' = NEW.follower_id::text
      AND created_at > now() - interval '24 hours'
  ) THEN
    RETURN NEW;
  END IF;

  -- Fetch actor nickname and avatar in a single query
  SELECT nickname, avatar_url
  INTO v_actor_nickname, v_actor_avatar
  FROM profiles
  WHERE id = NEW.follower_id;

  INSERT INTO notifications (user_id, type, data)
  VALUES (
    NEW.following_id,
    'follow',
    jsonb_build_object(
      'actor_id', NEW.follower_id,
      'actor_nickname', v_actor_nickname,
      'actor_avatar', v_actor_avatar
    )
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_on_follow
  AFTER INSERT ON follows
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_follow();

-- ============================================================
-- DB-006: cleanup like notification on unlike
-- ============================================================
CREATE OR REPLACE FUNCTION cleanup_like_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id UUID;
BEGIN
  -- Look up the submission owner so DELETE uses the user_id index
  SELECT user_id INTO v_owner_id
  FROM submissions
  WHERE id = OLD.submission_id;

  IF v_owner_id IS NOT NULL THEN
    DELETE FROM notifications
    WHERE user_id = v_owner_id
      AND type = 'like'
      AND data->>'actor_id' = OLD.user_id::text
      AND data->>'submission_id' = OLD.submission_id::text;
  END IF;

  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_cleanup_like_notification
  AFTER DELETE ON likes
  FOR EACH ROW
  EXECUTE FUNCTION cleanup_like_notification();

-- ============================================================
-- DB-007: cleanup follow notification on unfollow
-- ============================================================
CREATE OR REPLACE FUNCTION cleanup_follow_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM notifications
  WHERE user_id = OLD.following_id
    AND type = 'follow'
    AND data->>'actor_id' = OLD.follower_id::text;

  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_cleanup_follow_notification
  AFTER DELETE ON follows
  FOR EACH ROW
  EXECUTE FUNCTION cleanup_follow_notification();

-- ============================================================
-- DB-008: friend_submitted notification trigger
-- ============================================================
CREATE OR REPLACE FUNCTION notify_on_submission()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_nickname TEXT;
  v_actor_avatar TEXT;
  v_follower RECORD;
BEGIN
  -- Fetch actor nickname and avatar in a single query
  SELECT nickname, avatar_url
  INTO v_actor_nickname, v_actor_avatar
  FROM profiles
  WHERE id = NEW.user_id;

  FOR v_follower IN
    SELECT follower_id FROM follows WHERE following_id = NEW.user_id
  LOOP
    BEGIN
      INSERT INTO notifications (user_id, type, data)
      SELECT
        v_follower.follower_id,
        'friend_submitted',
        jsonb_build_object(
          'actor_id', NEW.user_id,
          'actor_nickname', v_actor_nickname,
          'actor_avatar', v_actor_avatar,
          'submission_id', NEW.id
        )
      WHERE NOT EXISTS (
        SELECT 1 FROM notifications
        WHERE user_id = v_follower.follower_id
          AND type = 'friend_submitted'
          AND data->>'submission_id' = NEW.id::text
      );
    EXCEPTION WHEN OTHERS THEN
      -- Never roll back the submission INSERT due to notification failure
      RAISE WARNING 'notification insert failed for follower %: %', v_follower.follower_id, SQLERRM;
    END;
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_on_submission
  AFTER INSERT ON submissions
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_submission();

-- ============================================================
-- DB-009: Realtime publication
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- ============================================================
-- INFRA-001: pg_cron cleanup job (30-day TTL, daily at 03:00 UTC)
-- Requires pg_cron enabled via Supabase dashboard (pg_catalog schema)
-- ============================================================
SELECT cron.schedule(
  'cleanup-notifications',
  '0 3 * * *',
  $$DELETE FROM public.notifications WHERE created_at < now() - interval '30 days'$$
);

-- ============================================================
-- GDPR-001: scrub_notification_actor function
-- Called by delete-account edge function before auth user deletion
-- ============================================================
CREATE OR REPLACE FUNCTION scrub_notification_actor(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE notifications
  SET data = data - 'actor_nickname' - 'actor_avatar'
  WHERE data->>'actor_id' = p_user_id::text;
END;
$$;
