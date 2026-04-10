-- Remove colors from notification triggers.
-- Colors are now baked into each shape in the submissions table,
-- so notification triggers no longer need to look up challenge colors.

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
  SELECT user_id INTO v_owner_id
  FROM submissions WHERE id = NEW.submission_id;

  IF v_owner_id IS NULL OR v_owner_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  SELECT nickname, avatar_url INTO v_actor_nickname, v_actor_avatar
  FROM profiles WHERE id = NEW.user_id;

  INSERT INTO notifications (user_id, type, submission_id, data)
  VALUES (
    v_owner_id,
    'like',
    NEW.submission_id,
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
  SELECT nickname, avatar_url INTO v_actor_nickname, v_actor_avatar
  FROM profiles WHERE id = NEW.user_id;

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
          'submission_id', NEW.id
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
