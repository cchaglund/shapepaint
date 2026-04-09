# Critique: Notifications Plan & PRD

From a senior dev who's seen this movie before and hated the ending.

---

## The Big Problems

### 1. The toast timer is broken by design

The `ToastItem` `useEffect` re-runs every time `paused` toggles. When you unpause, it starts a **fresh 5-second timer** instead of resuming from where it left off. So if I hover at 4.9 seconds, then unhover, I get a brand new 5 seconds. The progress bar CSS animation, meanwhile, is using `animationPlayState: 'paused'/'running'` which DOES resume from the correct position. So the visual bar and the actual dismiss timer are now out of sync. The bar will reach zero and nothing will happen, or the toast will vanish with the bar still half-full. Pick one source of truth for timing — don't split it across JS `setTimeout` and CSS `@keyframes`.

### 2. SECURITY DEFINER triggers with no search_path

Every single trigger function is `SECURITY DEFINER` but none of them set `search_path`. This is a known Postgres security footgun — a malicious user who can create objects in a schema that appears earlier in `search_path` can hijack the function's elevated privileges. Every `SECURITY DEFINER` function should have `SET search_path = public, pg_temp` (or better, `SET search_path = ''` with fully-qualified table names). The Supabase docs literally warn about this.

### 3. The "pagination" isn't pagination

`fetchNotificationPage(userId, limit)` doesn't paginate — it fetches the first N rows every time. Calling `loadMore` goes from fetching 10 to fetching 20 to fetching 30… each time re-fetching every row from the beginning. With 50 notifications, the fifth "load more" click re-transfers all 50 rows when you only need the last 10. This is cursor-based pagination's entire reason for existing. Use `created_at` as a cursor — pass the timestamp of the last loaded notification and fetch the next page after it. The current approach wastes bandwidth and gets worse as the user loads more.

### 4. Realtime subscription leaks actor data past RLS

The Realtime hook casts `payload.new as Notification` and reads `data.actor_nickname` directly. Supabase Realtime broadcasts the **full row** to subscribers matching the filter. RLS controls who receives events, but the row content is unfiltered. This means every notification row — including the full `data` JSONB with actor details — is sent over the wire. That's fine for now, but the plan doesn't mention configuring Realtime to only broadcast specific columns. If you ever add sensitive fields to `data`, they'll leak to the client by default.

### 5. No `fetchNotificationPage` import in the hook

`useNotifications.ts` calls `fetchNotificationPage` but the imports only show `fetchNotifications` and `markNotificationRead` and `markAllNotificationsRead`. The function isn't imported. This will fail at compile time.

---

## Race Conditions & Edge Cases

### 6. Hover-to-read fires during scroll

On mobile (yes I know it says "desktop only" but someone WILL open this on a tablet), touch-and-drag scrolling through the notification list will fire `onMouseEnter` / `onFocus` events on items as you scroll past them. On desktop, fast scrolling with a trackpad can trigger hover events on items you're flying past. You'll silently mark notifications as read that the user never actually looked at. At minimum, add a check that the pointer is actually stationary before starting the 700ms timer (use `pointermove` to detect motion and reset).

### 7. `prependNotification` creates duplicates

When a Realtime INSERT event fires, `prependNotification` blindly prepends to the array. But what if the user just triggered the action themselves (e.g., they're User A and User B liked their submission while they had the panel open AND the initial fetch was still in flight)? Or what if Realtime delivers the same event twice (which Supabase documents as possible during reconnection)? No dedup check. The list will show duplicate notifications. Add an `id` check before prepending.

### 8. `markRead` optimistic rollback doesn't work with discriminated unions

The rollback in `markRead` does `{ ...n, is_read: false }`. With the discriminated union type `Notification`, the spread operator loses type narrowing — TypeScript will infer `{ id: string; user_id: string; type: string; data: ...; is_read: boolean; created_at: string }` and the result won't satisfy the `Notification` type. You'll get a type error on `setNotifications` because the mapped array element doesn't match the union. You need to preserve the type discriminant explicitly or use a type assertion (ironically, given how much the PRD brags about avoiding casts).

### 9. `unreadCount` is computed client-side from loaded notifications

The hook calculates `unreadCount` as `notifications.filter(n => !n.is_read).length`. But you only load up to 50 notifications. If a user has 80 unread notifications, the badge will show 50. You have `fetchUnreadCount` (API-002) that does a proper server-side count, but **the hook never calls it**. The function exists in the PRD and plan but is never wired up. The dot indicator will undercount.

### 10. Default tab logic runs once

`useState<'notifications' | 'following' | 'followers'>(() => unreadCount > 0 ? 'notifications' : 'following')` — this initializer runs once when `UserMenuContent` mounts. If the dropdown is always mounted (just hidden), the default tab is set on first render and never updates. Close dropdown, receive 5 notifications, reopen dropdown — you're still on the "following" tab because `useState` initializers don't re-run.

### 11. `load()` called with no arguments in `markAllRead` catch block

The catch block calls `load()` with no arguments, but `load` expects a `count: number` parameter. This is a runtime error waiting to happen. Should be `load(loadedCount)`.

---

## Database Concerns

### 12. `notify_on_like` does two subqueries when one would do

```sql
'actor_nickname', (SELECT nickname FROM profiles WHERE id = NEW.user_id),
'actor_avatar',   (SELECT avatar_url FROM profiles WHERE id = NEW.user_id),
```

Two separate subqueries to the same table for the same row. Use a single CTE or at least `SELECT INTO` like `notify_on_submission` does. This is a minor efficiency issue but it's the kind of thing that makes me question whether anyone actually read the SQL before approving it.

### 13. `cleanup_like_notification` deletes without scoping to `user_id`

The unlike cleanup trigger deletes based on `actor_id` + `submission_id` in the JSONB data but doesn't scope to the notification's `user_id` (the submission owner). This works *in practice* because the combination is unique, but it's doing an unscoped scan of the `notifications` table — no index covers `(data->>'actor_id', data->>'submission_id')`. On a large table, this DELETE will sequential scan. Add `user_id` to the WHERE clause so the existing index gets used.

### 14. JSONB queries without GIN indexes

The follow dedup guard, unlike cleanup, and unfollow cleanup all query `data->>'actor_id'` and `data->>'submission_id'`. None of these have indexes. The existing indexes are on `(user_id, created_at)`. For the cleanup triggers especially, you're doing `WHERE type = 'like' AND (data->>'actor_id') = X AND (data->>'submission_id') = Y` — this is a sequential scan on the entire notifications table. Either add a GIN index on `data` or at minimum add `user_id` to these WHERE clauses so the existing B-tree index is used.

### 15. GDPR scrubbing is a handwave

"Add to the existing account deletion flow" — there IS no account deletion flow. The codebase has no `deleteAccount`, no `deleteUser`, nothing. This isn't a modification to an existing flow; it's an entirely new feature that's being filed under "note" instead of being scoped as actual work. If a user asks to delete their account today, you can't comply. The GDPR item (GDPR-001) pretends this is a small patch when it's actually a significant feature that needs its own plan.

### 16. No index on `type` column

The `type` column has no index, but it's used in every cleanup trigger's WHERE clause and the dedup guard. Combined with the JSONB field queries (point 14), the cleanup triggers are essentially doing full table scans filtered by type.

### 17. Submission trigger fan-out has no upper bound

The plan acknowledges "500 followers = ~50ms" but doesn't set any limit. What happens when someone with 2,000 followers submits? The trigger inserts 2,000 rows inside the submission's transaction. The EXCEPTION block catches failures, but the EXCEPTION block wraps the entire INSERT...SELECT — if row 1,999 fails, all 1,999 notification inserts are rolled back (EXCEPTION catches the whole block, not individual rows). So you get zero notifications instead of 1,998. Consider batching or using `INSERT...ON CONFLICT DO NOTHING` instead of `NOT EXISTS`.

---

## UX Issues

### 18. 700ms hover-to-read is unchallengeable

There's no way for a user to say "I want to keep this as unread." Once you hover for 700ms, it's marked read, period. No undo, no "mark as unread" action. Email clients learned this lesson decades ago. If you're going to auto-mark on hover, you need a "mark as unread" option per notification.

### 19. No notification count in the tab label

The Notifications tab just says "Notifications" while Following/Followers show counts: `Following (12)`, `Followers (45)`. An unread count in the tab label — `Notifications (3)` — would be consistent with the established pattern AND useful.

### 20. Empty state is lazy

"No notifications yet" — no explanation, no guidance. This is the first thing every new user sees. At minimum: "When someone likes your art or follows you, you'll see it here." Tell them what to expect.

### 21. 300px max-height is arbitrary and probably wrong

`max-h-[300px]` for the notification list. On a 1080p monitor this is fine. On a 4K display it's comically small. On a laptop with a 768px viewport it might overflow the dropdown itself. This should be relative to viewport height (`max-h-[40vh]` or similar), or at minimum coordinated with the dropdown's own max-height.

### 22. No loading skeleton

Loading state is just "Loading..." text. The following/followers tabs probably show a proper skeleton or spinner. This will look inconsistent. Match the loading pattern used elsewhere in the dropdown.

---

## Architectural Smell

### 23. `fetchNotifications` AND `fetchNotificationPage` both exist

`fetchNotifications` fetches all (limit 50). `fetchNotificationPage` also fetches all from the top (limit N). They do the same thing with different signatures. The hook only uses `fetchNotificationPage`. `fetchNotifications` is dead code from the start. Why is it in the PRD (API-001)?

### 24. Toast context stores entire `Notification` objects

`Toast.notification` holds the full `Notification` object. This means ToastContext is now coupled to the Notification type. If you ever want toasts for non-notification purposes (success messages, errors, etc.), you'll need to refactor. The toast system should be generic; notification-specific formatting belongs in the caller.

### 25. `navigate` import path assumed but not verified

Both `NotificationsTab` and `ToastContainer` import `navigate` from `../../lib/router`. The actual router file exports `navigate` — this checks out. But `getClickTarget` returns a closure that calls `navigate` directly. If routing ever moves to React Router or similar, every notification component needs updating. Consider dispatching a navigation event or using whatever abstraction the rest of the app uses.

### 26. `Star` imported but unused in notificationIcons.ts

```typescript
import { Heart, UserPlus, Store, Star } from 'lucide-react';
```

`Star` is imported but never used. Competition result notifications were explicitly removed. This is the kind of leftover that suggests the plan was edited without a final review pass.

---

## What's Actually Missing From the PRD

### 27. No test plan whatsoever

Zero tests. No unit tests for the hook. No integration tests for the triggers. No E2E test automation. The "E2E" items in the PRD are manual verification checklists, not automated tests. For a feature that touches 5 database triggers, 6 API functions, 2 contexts, and 2 complex UI components — you're going to ship this with zero automated regression coverage?

### 28. No rate limiting on notification creation

What happens when a bot or malicious script rapidly likes/unlikes/re-likes a submission? The like cleanup trigger deletes the notification on unlike, and a new one is created on re-like. There's no rate limiting at the trigger level. The follow dedup has a 24h window, but likes have no equivalent protection. A script could spam someone's notification panel.

### 29. No consideration of the `FollowsContext` integration

`UserMenuDropdown` already uses `FollowsProvider` to wrap content. Now you're adding `NotificationsProvider` at a higher level. These two providers need to coexist, and the plan doesn't discuss whether `FollowsProvider` stays where it is or gets hoisted. If `NotificationsProvider` wraps everything and `FollowsProvider` wraps just the dropdown content, the follow/unfollow actions in `FollowsContext` won't trigger notification updates in `NotificationsContext` without a manual refresh.

### 30. No offline/error resilience for Realtime

What happens when the Realtime WebSocket disconnects? Supabase Realtime has reconnection logic, but during the gap, notifications are missed. When the connection re-establishes, those missed notifications never arrive — Realtime doesn't replay history. The plan should call `reload()` on reconnection to catch up. Without this, Phase 2 users will have gaps in their notification history during network interruptions.

### 31. Accessibility: screen reader experience is incomplete

The dot has `aria-label` with unread count — good. But notification items themselves have no `role`, no `aria-label` describing the notification, no `aria-live` region for new notifications. The "Mark all as read" button has no `aria-description`. The progress bar animation has no `prefers-reduced-motion` consideration. The toast container has no `role="alert"` or `aria-live="polite"`. This will be a rough experience for screen reader users.

---

## Summary

The plan is thorough on the happy path and sloppy on everything else. The database triggers are SECURITY DEFINER without search_path, the "pagination" re-fetches everything, the toast timer is fundamentally broken, and there's zero automated test coverage for a feature with 5 triggers and complex state management. The GDPR compliance is waved away as "add to existing flow" when no such flow exists. The hover-to-read UX has no escape hatch. Several functions are imported wrong or never imported at all.

It reads like someone designed the feature in Figma, wrote the plan in one pass, and never actually traced through the code paths with a debugger mindset.
