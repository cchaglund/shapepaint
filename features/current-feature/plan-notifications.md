# Plan: Notifications System

## Changes from critique review

The following fixes address valid concerns raised during review:

1. **`read` → `is_read`** — `read` is a SQL reserved word; renamed everywhere
2. ~~DELETE RLS policy~~ — **removed**: users cannot delete notifications, only mark as read. Cleanup triggers bypass RLS via SECURITY DEFINER.
3. **`notify_on_submission` wrapped in EXCEPTION** — notification failure no longer rolls back the submission INSERT
4. **Follow dedup guard** — time-windowed NOT EXISTS prevents follow/unfollow spam
5. **Unlike/unfollow cleanup triggers** — stale notifications removed when action is undone
6. **`hasMore` edge case fixed** — no longer shows "Load more" when count exactly matches limit
7. **Keyboard accessibility** — `onFocus` triggers mark-as-read, not just hover
8. **Error state exposed in hook** — prevents infinite error loop, surfaces errors to UI
9. **Shared `NOTIFICATION_ICONS` config** — extracted from both NotificationsTab and ToastContainer
10. **Proper discriminated union typing** — `getNotificationData()` helper with type narrowing replaces `as Record<string, unknown>` casts
11. **Competition result notifications removed** — winners modal already handles this; no notification needed
12. **GDPR note added** — denormalized actor data requires scrubbing on account deletion

### Second review pass

13. **`SET search_path = public`** on all SECURITY DEFINER trigger functions — prevents search_path hijacking
14. **`notify_on_like` single subquery** — actor nickname+avatar fetched in one SELECT INTO, not two separate subqueries
15. **`cleanup_like_notification` scoped by user_id** — looks up submission owner so DELETE uses the B-tree index instead of sequential scan
16. **Toast timer desync fixed** — tracks remaining time on pause/resume instead of restarting a fresh 5s timer (keeps JS timer and CSS progress bar in sync)
17. **`fetchNotifications` removed** — dead code; `fetchNotificationPage` covers the same use case
18. **Hook imports fixed** — imports `fetchNotificationPage` + `fetchUnreadCount` (was importing non-existent `fetchNotifications`)
19. **`markAllRead` catch block fixed** — calls `load(loadedCount)` not `load()` (was a runtime error)
20. **`unreadCount` uses server-side count** — `fetchUnreadCount` (API-002) is now wired up instead of counting only loaded items client-side
21. **`prependNotification` dedup guard** — checks for existing id before prepending (Supabase Realtime can deliver duplicates on reconnection)
22. **Unused `Star` import removed** from notificationIcons.ts
23. **Empty state improved** — shows helpful guidance instead of "No notifications yet"
24. **`max-h-[300px]` → `max-h-[40vh]`** — viewport-relative max-height scales with screen size
25. **Notifications tab shows unread count** — e.g. "Notifications (3)" consistent with Following/Followers pattern
26. **GDPR-001 wired up** — `scrub_notification_actor` SQL function added to migration; `delete-account` edge function updated to call it before auth user delete
27. **Realtime reconnection reload** (Phase 2) — calls `reload()` on channel reconnect to catch missed events
28. **Retention switched to pg_cron** — Pro plan available; no edge function needed, `cron.schedule` in migration SQL
29. **Notification deletion removed** — users can only mark as read, not delete. DELETE RLS policy removed. `deleteNotification` API function removed. Cleanup triggers bypass RLS via SECURITY DEFINER.
30. **Pagination simplified** — no more load-more/PAGE_SIZE/loadedCount. Hook fetches all 50 on mount. `fetchNotificationPage` replaced by simpler `fetchNotifications`.
31. **Notification preferences note added** — future consideration section documents how to add per-type muting later.
32. **PRD restructured into phases** — Phase 0 (supervised: DB migration), Phase 1 (autonomous: frontend), Phase 2 (autonomous: realtime+toasts), Phase 3 (supervised: browser testing).

---

## Design decisions locked in (from prototypes)

| Decision | Choice |
|---|---|
| Indicator placement | Dot on avatar (Option 3) — no bell icon |
| Panel location | Third tab in UserMenuDropdown: **Notifications \| Following \| Followers** |
| Log Out visibility | Always visible regardless of active tab |
| Panel background | `--color-bg-secondary` (panel), `--color-card-bg` (read items), `--color-accent-subtle` (unread items) |
| Read/unread behavior | Hover 700ms → marks as read with left-edge progress bar. Click also marks as read. "Mark all as read" button. Opening panel does NOT auto-mark. |
| Layout | Compact (A) with SVG icons (B) |
| Toast position | Bottom-right, solid style (`--color-bg-elevated`) |
| Toast behavior | 5s auto-dismiss, hover pauses, close button on hover, max 4 stacked, slide-in from right |
| Submission thumbnails | Rendered via FK join (submission_id column) + baked-in colors in JSONB — single query, no extra API calls |
| Scope | Desktop only |

---

## Architecture overview

```
DB triggers (likes, follows, rankings)
        ↓ INSERT into notifications table
notifications table (Postgres, RLS)
        ↓ fetch on page load
useNotifications hook (Phase 1: poll)
        ↓ (Phase 2: Supabase Realtime subscription added)
NotificationsTab (inside UserMenuDropdown)
ToastProvider (global, fires on Realtime events only)
```

**No Redis, no external queue.** Supabase Postgres + Realtime covers all requirements. The `notifications` table is the single source of truth. It persists history, tracks read state, and in Phase 2 its INSERT events power live toasts via Supabase Realtime CDC.

---

## Phase 1: Poll-based (ship first)

### Step 1 — Database migration

File: `supabase/migrations/20260407000001_notifications.sql`

```sql
-- =============================================================================
-- 1. NOTIFICATIONS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS notifications (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type        TEXT        NOT NULL,   -- 'like' | 'follow' | 'friend_submitted'
  data        JSONB       NOT NULL DEFAULT '{}',
  is_read     BOOLEAN     NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Hot query: "fetch my unread notifications" (badge count + panel open)
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications (user_id, created_at DESC)
  WHERE NOT is_read;

-- Secondary: "fetch all my notifications" (panel full list)
CREATE INDEX IF NOT EXISTS idx_notifications_user_all
  ON notifications (user_id, created_at DESC);

-- =============================================================================
-- 2. ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can only read their own notifications
CREATE POLICY "Users read own notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

-- Users can only mark their own notifications as read
CREATE POLICY "Users update own notifications" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- No DELETE policy for users — notifications cannot be dismissed, only marked as read.
-- Cleanup triggers (unlike/unfollow) run as SECURITY DEFINER and bypass RLS.

-- Only the DB itself (SECURITY DEFINER triggers) can insert
-- No INSERT policy needed for authenticated users — triggers run as SECURITY DEFINER

-- =============================================================================
-- 3. TRIGGER: LIKE → notify submission owner
-- =============================================================================

CREATE OR REPLACE FUNCTION notify_on_like()
RETURNS TRIGGER AS $$
DECLARE
  owner_id UUID;
  actor_nick TEXT;
  actor_av   TEXT;
BEGIN
  SELECT user_id INTO owner_id FROM submissions WHERE id = NEW.submission_id;

  -- Don't notify if someone liked their own submission
  IF owner_id IS NOT NULL AND owner_id != NEW.user_id THEN
    -- Single query for actor profile (not two separate subqueries)
    SELECT nickname, avatar_url INTO actor_nick, actor_av
      FROM profiles WHERE id = NEW.user_id;

    INSERT INTO notifications (user_id, type, data)
    VALUES (
      owner_id,
      'like',
      jsonb_build_object(
        'actor_id',        NEW.user_id,
        'actor_nickname',  actor_nick,
        'actor_avatar',    actor_av,
        'submission_id',   NEW.submission_id
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_notify_on_like ON likes;
CREATE TRIGGER trg_notify_on_like
  AFTER INSERT ON likes
  FOR EACH ROW EXECUTE FUNCTION notify_on_like();

-- =============================================================================
-- 4. TRIGGER: FOLLOW → notify the person being followed
-- =============================================================================

CREATE OR REPLACE FUNCTION notify_on_follow()
RETURNS TRIGGER AS $$
BEGIN
  -- Dedup guard: don't notify if a follow notification for the same actor
  -- was already created in the last 24 hours (prevents follow/unfollow spam)
  IF NOT EXISTS (
    SELECT 1 FROM notifications
    WHERE user_id = NEW.following_id
      AND type = 'follow'
      AND (data->>'actor_id') = NEW.follower_id::TEXT
      AND created_at > now() - interval '24 hours'
  ) THEN
    INSERT INTO notifications (user_id, type, data)
    VALUES (
      NEW.following_id,
      'follow',
      jsonb_build_object(
        'actor_id',       NEW.follower_id,
        'actor_nickname', (SELECT nickname FROM profiles WHERE id = NEW.follower_id),
        'actor_avatar',   (SELECT avatar_url FROM profiles WHERE id = NEW.follower_id)
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_notify_on_follow ON follows;
CREATE TRIGGER trg_notify_on_follow
  AFTER INSERT ON follows
  FOR EACH ROW EXECUTE FUNCTION notify_on_follow();

-- =============================================================================
-- 5. TRIGGER: unlike → remove stale like notification
-- =============================================================================

CREATE OR REPLACE FUNCTION cleanup_like_notification()
RETURNS TRIGGER AS $$
DECLARE
  owner_id UUID;
BEGIN
  -- Look up submission owner so we can scope DELETE by user_id (uses B-tree index)
  SELECT user_id INTO owner_id FROM submissions WHERE id = OLD.submission_id;

  IF owner_id IS NOT NULL THEN
    DELETE FROM notifications
    WHERE user_id = owner_id
      AND type = 'like'
      AND (data->>'actor_id') = OLD.user_id::TEXT
      AND (data->>'submission_id') = OLD.submission_id::TEXT;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_cleanup_like_notification ON likes;
CREATE TRIGGER trg_cleanup_like_notification
  AFTER DELETE ON likes
  FOR EACH ROW EXECUTE FUNCTION cleanup_like_notification();

-- =============================================================================
-- 6. TRIGGER: unfollow → remove stale follow notification
-- =============================================================================

CREATE OR REPLACE FUNCTION cleanup_follow_notification()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM notifications
  WHERE type = 'follow'
    AND user_id = OLD.following_id
    AND (data->>'actor_id') = OLD.follower_id::TEXT;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_cleanup_follow_notification ON follows;
CREATE TRIGGER trg_cleanup_follow_notification
  AFTER DELETE ON follows
  FOR EACH ROW EXECUTE FUNCTION cleanup_follow_notification();

-- =============================================================================
-- 7. TRIGGER: submission INSERT → notify all followers
--
-- Implemented as a DB trigger (not a client-side RPC call) so that the fan-out
-- is guaranteed to happen if and only if the submission row is successfully
-- inserted. A client-side call would silently fail if the user closed the tab
-- or lost connectivity between saving and calling the RPC.
--
-- The idempotency guard (NOT EXISTS) prevents duplicate notifications if the
-- trigger somehow fires twice, but in practice a trigger won't fire twice per
-- INSERT. It's defensive programming.
--
-- Scale concern: the trigger inserts one row per follower synchronously inside
-- the submission INSERT transaction. For a user with 500 followers this adds
-- ~50ms — imperceptible. This only becomes a problem at tens of thousands of
-- followers, which is not our concern. At that scale you'd move to async
-- queues (Kafka/SQS), but that's not Shapepaint's problem.
-- =============================================================================

CREATE OR REPLACE FUNCTION notify_on_submission()
RETURNS TRIGGER AS $$
DECLARE
  submitter_nickname TEXT;
  submitter_avatar   TEXT;
BEGIN
  -- Fetch submitter profile once, reuse for all follower notifications
  SELECT nickname, avatar_url
    INTO submitter_nickname, submitter_avatar
    FROM profiles
   WHERE id = NEW.user_id;

  -- Wrapped in EXCEPTION so notification failures never roll back the submission INSERT
  BEGIN
    INSERT INTO notifications (user_id, type, data)
    SELECT
      f.follower_id,
      'friend_submitted',
      jsonb_build_object(
        'actor_id',       NEW.user_id,
        'actor_nickname', submitter_nickname,
        'actor_avatar',   submitter_avatar,
        'submission_id',  NEW.id
      )
    FROM follows f
    WHERE f.following_id = NEW.user_id
      AND NOT EXISTS (
        SELECT 1 FROM notifications n
        WHERE n.user_id = f.follower_id
          AND n.type = 'friend_submitted'
          AND (n.data->>'submission_id') = NEW.id::TEXT
      );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notify_on_submission failed: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_notify_on_submission ON submissions;
CREATE TRIGGER trg_notify_on_submission
  AFTER INSERT ON submissions
  FOR EACH ROW EXECUTE FUNCTION notify_on_submission();

-- =============================================================================
-- 8. RETENTION: delete notifications older than 30 days (regardless of is_read)
--
-- 30 days is the window. We don't distinguish read vs. unread — if a user
-- hasn't visited in 30 days the notifications aren't useful to them anyway.
--
-- Uses pg_cron (available on Pro plan) for daily cleanup at 03:00 UTC.
-- =============================================================================

SELECT cron.schedule(
  'cleanup-notifications',
  '0 3 * * *',
  $$DELETE FROM notifications WHERE created_at < now() - interval '30 days'$$
);

-- =============================================================================
-- 9. ENABLE REALTIME (for Phase 2 — no harm enabling now)
-- =============================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
```

**Why DB triggers for all events:**
- Likes: 1-to-1. Trigger fires atomically with the like INSERT. Cleanup trigger on DELETE removes stale notification on unlike.
- Follows: 1-to-1. Trigger fires atomically with the follow INSERT. 24h dedup window prevents follow/unfollow spam. Cleanup trigger on DELETE removes stale notification on unfollow.
- Friend submitted: 1-to-N fan-out. Still a DB trigger — guarantees fan-out happens if and only if the submission row lands. Wrapped in EXCEPTION block so notification failures never roll back the submission INSERT.

**Note on denormalized actor data (GDPR):** `actor_nickname` and `actor_avatar` are baked into notification rows at INSERT time. The existing `delete-account` edge function (`supabase/functions/delete-account/index.ts`) must be updated to scrub actor data from other users' notification rows **before** deleting the auth user. The CASCADE delete handles the user's own rows, but denormalized actor data embedded in other users' notifications must be explicitly scrubbed. Add this before the `auth.admin.deleteUser` call:

```typescript
// Scrub actor data from other users' notifications before deleting auth user
await supabaseAdmin
  .from('notifications')
  .update({ data: supabaseAdmin.rpc('jsonb_strip_actor', { actor_id: user.id }) })
  // Or use raw SQL via RPC:
await supabaseAdmin.rpc('scrub_notification_actor', { deleted_user_id: user.id });
```

Alternatively, add a helper SQL function in the migration:
```sql
CREATE OR REPLACE FUNCTION scrub_notification_actor(deleted_user_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE notifications
  SET data = data - 'actor_nickname' - 'actor_avatar'
  WHERE (data->>'actor_id') = deleted_user_id::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
```

The UI handles null actor names with a "Someone" fallback, ensuring graceful degradation after scrubbing.

---

### Step 2 — TypeScript types

File: `src/types/notifications.ts`

```typescript
export type NotificationType =
  | 'like'
  | 'follow'
  | 'friend_submitted';

export interface NotificationDataMap {
  like: {
    actor_id: string;
    actor_nickname: string;
    actor_avatar: string | null;
    submission_id: string;
  };
  follow: {
    actor_id: string;
    actor_nickname: string;
    actor_avatar: string | null;
  };
  friend_submitted: {
    actor_id: string;
    actor_nickname: string;
    actor_avatar: string | null;
    submission_id: string;
  };
}

// Discriminated union — use type narrowing via n.type in a switch, not casts
export type Notification = {
  [K in NotificationType]: {
    id: string;
    user_id: string;
    type: K;
    data: NotificationDataMap[K];
    is_read: boolean;
    created_at: string;
  };
}[NotificationType];
```

---

### Step 3 — API functions

Add to `src/lib/api.ts`:

```typescript
import type { Notification } from '../types/notifications';

// NOTE: fetchNotifications was removed — fetchNotificationPage covers the same use case with pagination.

// Unread count only (cheap query — used for badge)
export async function fetchUnreadCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false);

  if (error) throw error;
  return count ?? 0;
}

// Fetch most recent 50 notifications for user
export async function fetchNotifications(userId: string): Promise<Notification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) throw error;
  return data as Notification[];
}

// Mark a single notification as read
export async function markNotificationRead(notificationId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId);

  if (error) throw error;
}

// Mark all as read for current user
export async function markAllNotificationsRead(userId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false);

  if (error) throw error;
}

// (No client-side fan-out needed for friend_submitted — handled by DB trigger trg_notify_on_submission)
// NOTE: No deleteNotification function — users can only mark as read, not delete.

---

### Step 4 — useNotifications hook

File: `src/hooks/notifications/useNotifications.ts`

```typescript
import { useState, useEffect, useCallback } from 'react';
import {
  fetchNotifications,
  fetchUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
} from '../../lib/api';
import type { Notification } from '../../types/notifications';

const MAX_NOTIFICATIONS = 50;

export function useNotifications(userId: string | null) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const [data, serverUnread] = await Promise.all([
        fetchNotifications(userId),
        fetchUnreadCount(userId),
      ]);
      setNotifications(data);
      setUnreadCount(serverUnread);
      setFetched(true);
    } catch (err) {
      console.error(err);
      setError('Failed to load notifications');
      setFetched(true); // Prevent infinite retry — set fetched even on error
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Load on mount
  useEffect(() => {
    if (userId && !fetched) load();
  }, [userId, fetched, load]);

  const markRead = useCallback(async (id: string) => {
    // Optimistic update
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, is_read: true } : n))
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
    try {
      await markNotificationRead(id);
    } catch {
      // Rollback on failure
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, is_read: false } : n))
      );
      setUnreadCount(prev => prev + 1);
    }
  }, []);

  const markAllRead = useCallback(async () => {
    if (!userId) return;
    // Optimistic update
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
    try {
      await markAllNotificationsRead(userId);
    } catch {
      // On failure, reload from server
      load();
    }
  }, [userId, load]);

  // Called by Realtime subscription (Phase 2) to prepend a new notification
  // Dedup guard: Realtime can deliver duplicates on reconnection
  const prependNotification = useCallback((n: Notification) => {
    setNotifications(prev => {
      if (prev.some(existing => existing.id === n.id)) return prev;
      return [n, ...prev];
    });
    if (!n.is_read) setUnreadCount(prev => prev + 1);
  }, []);

  return { notifications, unreadCount, loading, fetched, error, markRead, markAllRead, prependNotification, reload: load };
}
```

**Why optimistic updates?** Hovering for 700ms to mark read must feel instant. If we waited for the network round-trip before removing the unread styling, the transition would feel broken.

**Why no polling interval?** In Phase 1, we load once on mount. Stale-while-revalidate is acceptable — if a notification arrives while the user is on the page, they'll see it when they next open the panel or refresh. Phase 2 adds live updates. Adding a polling interval is unnecessary complexity that introduces its own issues (rate limits, stale closures, wasted bandwidth).

---

### Step 5 — NotificationsContext (global state)

The unread count needs to be accessible from the `UserMenuDropdown` trigger (to show the dot on avatar) AND from the panel itself. We don't want to pass it through multiple component layers. A context keeps it clean.

File: `src/contexts/NotificationsContext.tsx`

```typescript
import { createContext, useContext, useMemo } from 'react';
import { useNotifications } from '../hooks/notifications/useNotifications';
import type { Notification } from '../types/notifications';

interface NotificationsContextValue {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  prependNotification: (n: Notification) => void;
  reload: () => void;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

export function NotificationsProvider({
  userId,
  children,
}: {
  userId: string | null;
  children: React.ReactNode;
}) {
  const value = useNotifications(userId);
  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotificationsContext() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotificationsContext must be inside NotificationsProvider');
  return ctx;
}
```

**Where to mount `NotificationsProvider`:** Wrap the app root (or wherever `UserMenuDropdown` and the future toast subscriber both live). The `userId` comes from the existing auth context. Do NOT mount it inside `UserMenuDropdown` itself — the unread count must be available to render the dot on the button trigger, which is outside the dropdown body.

---

### Step 6 — NotificationsTab component

File: `src/components/notifications/NotificationsTab.tsx`

This renders inside the `UserMenuDropdown` as the "Notifications" tab content.

```typescript
import { useRef, useCallback } from 'react';
import { useNotificationsContext } from '../../contexts/NotificationsContext';
import { NOTIFICATION_ICONS } from '../../config/notificationIcons';
import { navigate } from '../../lib/router';
import type { Notification } from '../../types/notifications';

function formatRelativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  return `${days}d ago`;
}

// Type-safe access — n.type narrows n.data automatically via discriminated union
function getNotificationText(n: Notification): { main: React.ReactNode; sub?: string } {
  const sub = formatRelativeTime(n.created_at);

  switch (n.type) {
    case 'like':
      return {
        main: <><strong>{n.data.actor_nickname ?? 'Someone'}</strong> liked your submission</>,
        sub,
      };
    case 'follow':
      return {
        main: <><strong>{n.data.actor_nickname ?? 'Someone'}</strong> started following you</>,
        sub,
      };
    case 'friend_submitted':
      return {
        main: <><strong>{n.data.actor_nickname ?? 'Someone'}</strong> just submitted</>,
        sub,
      };
    default:
      return { main: 'New notification', sub };
  }
}

function getClickTarget(n: Notification): (() => void) | null {
  switch (n.type) {
    case 'like':
    case 'friend_submitted':
      return () => navigate(`?view=submission&id=${n.data.submission_id}`);
    case 'follow':
      return () => navigate(`?view=profile&user=${n.data.actor_id}`);
    default:
      return null;
  }
}

// Single notification row with hover-to-read behavior
function NotificationItem({
  notification,
  onClose,
}: {
  notification: Notification;
  onClose: () => void;
}) {
  const { markRead } = useNotificationsContext();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const config = NOTIFICATION_ICONS[notification.type];
  const Icon = config.icon;
  const { main, sub } = getNotificationText(notification);
  const clickTarget = getClickTarget(notification);

  // Shared logic for hover and keyboard focus — starts the 700ms mark-as-read timer
  const startReadTimer = useCallback(() => {
    if (notification.is_read) return;
    timerRef.current = setTimeout(() => {
      markRead(notification.id);
    }, 700);
  }, [notification.is_read, notification.id, markRead]);

  const cancelReadTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const handleClick = useCallback(() => {
    if (!notification.is_read) markRead(notification.id);
    if (clickTarget) {
      onClose();
      clickTarget();
    }
  }, [notification.is_read, notification.id, markRead, clickTarget, onClose]);

  const isUnread = !notification.is_read;

  return (
    <div
      className={`
        group relative flex items-center gap-2 px-3 py-2.5 cursor-pointer
        border-t border-(--color-border-light) first:border-t-0
        transition-colors
        ${isUnread
          ? 'bg-(--color-selected-hover) hover:bg-(--color-selected-hover)'
          : 'bg-(--color-selected) hover:bg-(--color-selected-hover)'
        }
      `}
      tabIndex={0}
      onMouseEnter={startReadTimer}
      onMouseLeave={cancelReadTimer}
      onFocus={startReadTimer}
      onBlur={cancelReadTimer}
      onClick={handleClick}
    >
      {/* Hover-read progress bar — left edge, fills top-to-bottom over 700ms */}
      {isUnread && (
        <div
          ref={barRef}
          className="
            absolute left-0 top-0 bottom-0 w-[3px] rounded-r
            bg-(--color-accent) opacity-0
            group-hover:opacity-60 group-hover:[animation:fillBar_700ms_linear_forwards]
          "
          style={{ transformOrigin: 'top', transform: 'scaleY(0)' }}
        />
      )}

      {/* Event type icon */}
      <div className={`shrink-0 w-[30px] h-[30px] rounded-lg flex items-center justify-center ${config.bgClass}`}>
        <Icon size={15} className={config.colorClass} />
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <div className="text-xs text-(--color-text-primary) leading-snug">{main}</div>
        {sub && <div className="text-[0.5625rem] text-(--color-text-tertiary) mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

export function NotificationsTab({ onClose }: { onClose: () => void }) {
  const { notifications, loading, error, markAllRead, reload } = useNotificationsContext();
  const hasUnread = notifications.some(n => !n.is_read);

  if (loading && notifications.length === 0) {
    return (
      <div className="py-8 text-center text-xs text-(--color-text-tertiary)">Loading…</div>
    );
  }

  if (error && notifications.length === 0) {
    return (
      <div className="py-8 text-center text-xs text-(--color-text-tertiary)">
        Failed to load notifications.{' '}
        <button onClick={reload} className="text-(--color-accent) hover:underline cursor-pointer bg-none border-none">
          Retry
        </button>
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div className="py-8 text-center text-xs text-(--color-text-tertiary)">
        When someone likes your art or follows you, you'll see it here.
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Panel header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-(--color-border-light)">
        <span className="text-xs font-semibold text-(--color-text-primary)">Notifications</span>
        {hasUnread && (
          <button
            onClick={markAllRead}
            className="text-[0.625rem] font-semibold text-(--color-accent) hover:underline cursor-pointer bg-none border-none"
          >
            Mark all as read
          </button>
        )}
      </div>

      {/* Notification list (scrollable, max-height so panel doesn't overflow viewport) */}
      <div className="max-h-[40vh] overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-(--color-border)">
        {notifications.map(n => (
          <NotificationItem key={n.id} notification={n} onClose={onClose} />
        ))}

      </div>
    </div>
  );
}
```

**Shared icon config** — extract to `src/config/notificationIcons.ts`:

```typescript
import { Heart, UserPlus, Store } from 'lucide-react';
import type { NotificationType } from '../types/notifications';

export const NOTIFICATION_ICONS: Record<NotificationType, {
  icon: React.FC<{ size: number }>;
  bgClass: string;
  colorClass: string;
}> = {
  like:             { icon: Heart,   bgClass: 'bg-(--color-accent-subtle)', colorClass: 'text-(--color-accent)' },
  follow:           { icon: UserPlus, bgClass: 'bg-purple-500/18',          colorClass: 'text-purple-400' },
  friend_submitted: { icon: Store,   bgClass: 'bg-green-500/15',            colorClass: 'text-green-400' },
};
```

Both `NotificationsTab` and `ToastContainer` import from this single source.

**The CSS animation `fillBar` must be added to `index.css`:**
```css
@keyframes fillBar {
  from { transform: scaleY(0); opacity: 0; }
  to   { transform: scaleY(1); opacity: 0.6; }
}
```

**Why `group-hover` for the animation instead of JS?** The hover timer is still driven by JS (it fires `markRead` after 700ms), but the visual progress bar is CSS-only — no `setInterval` polling needed. The animation duration matches the JS timer exactly (700ms). If the user moves their mouse away, `handleMouseLeave` clears the JS timer and `group-hover` naturally removes the animation class, resetting the bar.

---

### Step 7 — Actor names in notifications

All triggers already store `actor_nickname` and `actor_avatar` inside the `data` jsonb at insert time (see migration). This means `fetchNotifications` can use a simple `.select('*')` with no join — the notification row is self-contained.

**Why denormalize instead of joining on fetch?**
- Supabase Realtime delivers raw rows with no joins. If we relied on a join-on-fetch RPC, Realtime payloads would arrive without actor names and we'd need a second round-trip to resolve them before showing a toast. Storing names in jsonb makes Realtime payloads self-contained.
- Notifications are a historical record. If Mika changes their nickname after liking your submission, it's correct that the notification still says "Mika" — that's who liked it at the time.

**GDPR / account deletion:** When a user deletes their account, their `actor_nickname` and `actor_avatar` are embedded in other users' notification rows. The existing `delete-account` edge function must call `scrub_notification_actor(user.id)` before the auth user delete to strip these fields. The UI handles null actor names with a "Someone" fallback.

`fetchNotifications` simply calls `.from('notifications').select('*')` — no RPC needed for reads.

---

### Step 8 — Extend UserMenuDropdown with Notifications tab + dot

The current dropdown has tabs: **Following | Followers**.

Changes needed:
1. Add **Notifications** as the first tab.
2. Show unread dot on the avatar button trigger when `unreadCount > 0`.
3. Default to Notifications tab if there are unread items, otherwise default to Following.
4. Log Out remains always visible (it already lives in its own section, unchanged).

The `NotificationsProvider` must wrap the component tree that includes both `UserMenuDropdown` (for the dot) and `UserMenuContent` (for the panel). Mount it in the parent that renders `UserMenuDropdown`, passing the current `userId`.

```typescript
// In UserMenuDropdown.tsx — trigger button change:
// Add unreadCount prop (from NotificationsContext, passed down from parent)

<Button variant="secondary" className="gap-2 relative" onClick={() => setOpen(prev => !prev)}>
  <div className="relative">
    <AvatarImage avatarUrl={profile.avatar_url} initial={initial} size="sm" />
    {unreadCount > 0 && (
      <span
        className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-(--color-accent) border-2 border-(--color-bg-secondary)"
        aria-label={`${unreadCount} unread notifications`}
      />
    )}
  </div>
  <span className="max-w-20 truncate">{displayName}</span>
  <ChevronDown size={12} className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
</Button>
```

The dot is a 10px circle (`w-2.5 h-2.5`), accent color, 2px border matching the button background — exactly as in prototype Option 3.

```typescript
// In UserMenuContent — tab change:
const [activeTab, setActiveTab] = useState<'notifications' | 'following' | 'followers'>(
  () => (unreadCount > 0 ? 'notifications' : 'following')
);

// Tabs row:
{(['notifications', 'following', 'followers'] as const).map(tab => (
  <button key={tab} onClick={() => setActiveTab(tab)} ...>
    {tab === 'notifications' && (unreadCount > 0 ? `Notifications (${unreadCount})` : 'Notifications')}
    {tab === 'following' && `Following (${followingCount})`}
    {tab === 'followers' && `Followers (${followersCount})`}
  </button>
))}

// Tab content:
{activeTab === 'notifications' && <NotificationsTab onClose={onClose} />}
{activeTab === 'following' && /* existing following content */}
{activeTab === 'followers' && /* existing followers content */}
```

---

## Phase 2: Supabase Realtime + Toast system

Ship this shortly after Phase 1 is stable. The DB migration is already done (table is in the Realtime publication). Only client changes needed.

### Toast system

File: `src/contexts/ToastContext.tsx`

```typescript
import { createContext, useCallback, useContext, useState } from 'react';
import type { Notification } from '../types/notifications';

export interface Toast {
  id: string;
  notification: Notification;
  actorNickname?: string;
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (n: Notification, actorNickname?: string) => void;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const MAX_TOASTS = 4;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((notification: Notification, actorNickname?: string) => {
    const toast: Toast = { id: notification.id, notification, actorNickname };
    setToasts(prev => {
      const next = [...prev, toast];
      // Evict oldest if over max
      return next.length > MAX_TOASTS ? next.slice(next.length - MAX_TOASTS) : next;
    });
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, dismissToast }}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be inside ToastProvider');
  return ctx;
}
```

File: `src/components/notifications/ToastContainer.tsx`

```typescript
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useToast, type Toast } from '../../contexts/ToastContext';
import { NOTIFICATION_ICONS } from '../../config/notificationIcons';
import { navigate } from '../../lib/router';

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const remainingRef = useRef(5000); // Track remaining time for pause/resume
  const startTimeRef = useRef(Date.now());
  const n = toast.notification;
  const config = NOTIFICATION_ICONS[n.type];
  const Icon = config.icon;

  const getToastText = (): React.ReactNode => {
    switch (n.type) {
      case 'like':             return <><strong>{n.data.actor_nickname ?? 'Someone'}</strong> liked your submission</>;
      case 'follow':           return <><strong>{n.data.actor_nickname ?? 'Someone'}</strong> started following you</>;
      case 'friend_submitted': return <><strong>{n.data.actor_nickname ?? 'Someone'}</strong> just submitted</>;
    }
  };

  const getAction = (): string => {
    switch (n.type) {
      case 'like':             return 'View submission →';
      case 'follow':           return 'View profile →';
      case 'friend_submitted': return 'View submission →';
    }
  };

  const handleClick = () => {
    switch (n.type) {
      case 'like':
      case 'friend_submitted':
        navigate(`?view=submission&id=${n.data.submission_id}`);
        break;
      case 'follow':
        navigate(`?view=profile&user=${n.data.actor_id}`);
        break;
    }
    onDismiss(toast.id);
  };

  // 5s auto-dismiss, pause on hover — tracks remaining time so resume doesn't restart
  useEffect(() => {
    if (paused) {
      // On pause, record how much time is left
      remainingRef.current -= Date.now() - startTimeRef.current;
      return;
    }
    // On resume (or initial), start timer with remaining time
    startTimeRef.current = Date.now();
    timerRef.current = setTimeout(() => onDismiss(toast.id), remainingRef.current);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [paused, toast.id, onDismiss]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 32, scale: 0.96 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 32, scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      className="
        group relative flex items-center gap-2 w-full max-w-[360px]
        px-3 py-2.5 rounded-xl cursor-pointer overflow-hidden
        border-2 border-(--color-border)
        bg-(--color-bg-elevated)
        hover:-translate-y-0.5 transition-transform
      "
      style={{ boxShadow: 'var(--shadow-toast, 6px 6px 0 rgba(0,0,0,0.35))' }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onClick={handleClick}
    >
      {/* Event icon */}
      <div className={`shrink-0 w-7 h-7 rounded-md flex items-center justify-center ${config.bgClass}`}>
        <Icon size={14} className={config.colorClass} />
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <div className="text-xs text-(--color-text-primary) leading-snug">{getToastText()}</div>
        <div className="text-[0.5rem] text-(--color-text-tertiary) mt-0.5">{getAction()}</div>
      </div>

      {/* Close button (appears on hover) */}
      <button
        className="absolute top-1 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity text-(--color-text-tertiary) hover:text-(--color-text-primary) cursor-pointer bg-none border-none text-[0.625rem]"
        onClick={(e) => { e.stopPropagation(); onDismiss(toast.id); }}
      >
        ✕
      </button>

      {/* Progress bar — drains left-to-right over 5s, pauses on hover */}
      <div
        className="absolute bottom-0 left-0 h-[2px] bg-(--color-accent) opacity-45"
        style={{
          animation: `progressDrain 5s linear forwards`,
          animationPlayState: paused ? 'paused' : 'running',
        }}
      />
    </motion.div>
  );
}

export function ToastContainer() {
  const { toasts, dismissToast } = useToast();

  return (
    <div className="fixed bottom-5 right-5 z-[200] flex flex-col-reverse gap-2 items-end pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map(t => (
          <div key={t.id} className="pointer-events-auto">
            <ToastItem toast={t} onDismiss={dismissToast} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
}
```

**Note on `flex-col-reverse`:** Toasts stack newest-on-top. `AnimatePresence mode="popLayout"` handles smooth reflow when items are dismissed from the middle of the stack.

**Add to `index.css`:**
```css
@keyframes progressDrain {
  from { width: 100%; }
  to   { width: 0%; }
}
```

### Realtime subscription hook

File: `src/hooks/notifications/useNotificationsRealtime.ts`

```typescript
import { useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useNotificationsContext } from '../../contexts/NotificationsContext';
import { useToast } from '../../contexts/ToastContext';
import type { Notification } from '../../types/notifications';

export function useNotificationsRealtime(userId: string | null) {
  const { prependNotification, reload } = useNotificationsContext();
  const { addToast } = useToast();

  useEffect(() => {
    if (!userId) return;

    let hasSubscribedOnce = false;

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const notification = payload.new as Notification;
          // Update the in-memory notification list (dedup handled in prependNotification)
          prependNotification(notification);
          // Show a toast (only for realtime events, not on initial load)
          addToast(notification, notification.data.actor_nickname);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          if (hasSubscribedOnce) {
            // Reconnection — reload to catch notifications missed during disconnect
            // Supabase Realtime does not replay missed events
            reload();
          }
          hasSubscribedOnce = true;
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, prependNotification, addToast, reload]);
}
```

**Where to call this:** Mount `useNotificationsRealtime` in the same component where `NotificationsProvider` is mounted (the app root). It runs once and self-cleans on unmount.

**Why filter `user_id=eq.${userId}` in the Realtime subscription?** Without a filter, Supabase Realtime would send every INSERT on the `notifications` table to every subscriber. The filter is applied server-side — each user only receives their own notification events. This is the recommended Supabase pattern and works correctly with RLS.

**Actor nickname in Realtime payloads:** Already solved — all triggers store `actor_nickname` and `actor_avatar` in jsonb (see migration). Realtime payloads are self-contained; no second fetch needed.

The `addToast` call reads `actor_nickname` from `notification.data` — already available in the Realtime payload since triggers store it in jsonb.

---

## File structure after implementation

```
src/
  types/
    notifications.ts                    ← NEW
  config/
    notificationIcons.ts               ← NEW (shared icon config for Tab + Toast)
  contexts/
    NotificationsContext.tsx            ← NEW
    ToastContext.tsx                    ← NEW
  hooks/
    notifications/
      useNotifications.ts              ← NEW
      useNotificationsRealtime.ts      ← NEW (Phase 2)
  components/
    notifications/
      NotificationsTab.tsx             ← NEW
      ToastContainer.tsx               ← NEW (Phase 2)
  components/canvas/
    UserMenuDropdown.tsx               ← MODIFIED (add Notifications tab + dot)
  lib/
    api.ts                             ← MODIFIED (add notification API functions)
  index.css                            ← MODIFIED (add @keyframes fillBar, progressDrain)
supabase/
  migrations/
    20260407000001_notifications.sql   ← NEW (includes pg_cron schedule + scrub_notification_actor function)
  functions/
    delete-account/
      index.ts                         ← MODIFIED (add scrub_notification_actor call before auth user delete)
```

---

## Step 10 — Retention: pg_cron cleanup

Notifications older than 30 days are deleted daily, regardless of read status. Implemented via `pg_cron` (available on Pro plan) directly in the migration SQL — no edge function needed.

**Why 30 days for all (not just read)?** If a user hasn't visited in 30 days, even unread notifications from that period are no longer actionable. Indefinitely keeping unread notifications means returning users see stale, misleading backlogs. 30 days is the correct policy.

The `cron.schedule` call is already in the migration (see Step 1, section 8). Nothing else to deploy.

---

## Implementation order

### Phase 1 (poll-based)
1. **Migration** — write `20260407000001_notifications.sql` (includes pg_cron schedule + scrub_notification_actor), run `supabase db push`
2. **GDPR scrubbing** — update `delete-account/index.ts` to call `scrub_notification_actor` before auth user delete, redeploy
3. **Types** — `src/types/notifications.ts` (discriminated union)
4. **Shared config** — `src/config/notificationIcons.ts`
5. **API** — add notification functions to `src/lib/api.ts`
6. **Hook + Context** — `useNotifications`, `NotificationsContext`
7. **NotificationsTab** — the panel component
8. **UserMenuDropdown** — add Notifications tab, add dot to avatar trigger, wire `NotificationsProvider` in parent
9. **CSS** — add `@keyframes fillBar` to `index.css`
10. **Test Phase 1** in browser

### Phase 2 (Realtime + toasts)
11. **ToastContext + ToastContainer** — write components, mount in app root
12. **`useNotificationsRealtime`** — write hook, mount in app root
13. **CSS** — add `@keyframes progressDrain` to `index.css`
14. **Test Phase 2** — like a submission from a second account, verify toast fires

---

## Future consideration: notification preferences

Not in scope for v1, but worth tracking. Users may want to mute specific notification types (e.g. "don't notify me when someone I follow submits"). Adding this later would require:

1. A `notification_preferences` table: `(user_id UUID PK, muted_types TEXT[] DEFAULT '{}')`.
2. Each trigger checks: `IF NOT EXISTS (SELECT 1 FROM notification_preferences WHERE user_id = <recipient> AND <type> = ANY(muted_types))`.
3. A settings UI (probably in the user menu) to toggle each type.

The current triggers are simple enough that retrofitting this check is straightforward — it's an additive change, not a rewrite.

---

## Decisions resolved

| # | Decision | Resolution |
|---|---|---|
| 2 | Actor nickname in payloads | Denormalized into jsonb at trigger time. Historical snapshot is correct behavior. Makes Realtime payloads self-contained. GDPR note: must scrub on account deletion. |
| 3 | Friend-submitted fan-out | DB trigger on `submissions` INSERT. Wrapped in EXCEPTION so failures never roll back submission. |
| 4 | Panel pagination | Show 10 initially, "Load more" in increments of 10, hard cap at 50 |
| 5 | Retention policy | Delete all notifications older than 30 days (read or unread). Daily edge function cron. |
| 6 | Competition result notifications | **Removed** — winners modal already handles this |
| 7 | Column naming | `is_read` instead of `read` (SQL reserved word) |
| 8 | Unlike/unfollow cleanup | DELETE triggers remove stale notifications when actions are undone |
| 9 | Follow spam prevention | 24h dedup window on follow notifications |
| 10 | User dismissal | DELETE RLS policy allows users to remove individual notifications |
