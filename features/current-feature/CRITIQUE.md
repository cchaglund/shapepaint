# Critique: Notifications System Plan

Senior dev review. I don't like this plan. Here's why.

---

## 1. Denormalized actor data is a ticking time bomb

You're baking `actor_nickname` and `actor_avatar` into every notification row at INSERT time. The plan handwaves this as "historical snapshot is correct behavior." No it isn't — not universally.

- **User deletes their account:** You now have notification rows with a nickname and avatar URL pointing to a deleted user. The avatar URL 404s. The nickname is orphaned. What does the UI show? A broken image and a ghost name? You have no fallback.
- **User changes avatar:** The old avatar URL may be garbage-collected from storage. Now every historical notification referencing that user shows a broken image.
- **GDPR/right to erasure:** If a user requests data deletion, their name and avatar are embedded in potentially thousands of other users' notification rows. You'd need to scan every notification's jsonb to scrub them. Have fun with that.

The plan says "the performance argument is moot either way at this scale" — then why optimize for it? A simple join at read time is trivially fast for 50 rows and avoids all of the above.

---

## 2. The `friend_submitted` trigger is a latent performance cliff

The plan acknowledges this will be a problem at scale and then says "not Shapepaint's problem." Famous last words.

The trigger runs **synchronously inside the submission INSERT transaction.** If a user with 200 followers submits, you're doing 200 inserts inside that transaction. The user's submission save latency now scales linearly with their follower count. The plan estimates "~50ms for 500 followers" — where does this number come from? That's a guess, not a benchmark.

Worse: if _any_ of those notification inserts fail (constraint violation, disk full, whatever), **the entire submission INSERT rolls back.** The user loses their artwork because the notification system blew up. That's an unacceptable coupling. The submission should never fail because notifications failed.

At minimum this should be a deferred trigger or, better, an async job. "We'll fix it later" is not architecture.

---

## 3. No DELETE policy on RLS — users can't delete their own notifications

You have SELECT and UPDATE policies. No DELETE. So users can never dismiss/remove a notification — they can only mark it as read. Is that intentional? If so, it's not stated. If not, it's a bug.

The cleanup edge function uses the service role key to bypass RLS for the 30-day purge. But what about a user who wants to clear their notification history? They can't. Ever. For 30 days they're stuck with every notification they've ever received.

---

## 4. The hover-to-mark-read UX is inaccessible

The 700ms hover timer is mouse-only. How does a keyboard user mark a notification as read? How does a screen reader user? The plan says "Desktop only" for scope, but desktop users use keyboards too. Tab-focusing a notification should also trigger the read behavior — or at minimum, there should be an explicit "mark as read" action per item.

Also: the 700ms CSS animation and the 700ms JS timer are independently timed. CSS animations and `setTimeout` don't use the same clock. On a slow machine or under heavy load, these will drift apart. The bar will complete but the notification won't be marked read, or vice versa. Use the animation's `onAnimationEnd` event instead of a parallel timer.

---

## 5. Toast auto-dismiss timer restarts on every render

```typescript
useEffect(() => {
    if (paused) return;
    timerRef.current = setTimeout(() => onDismiss(toast.id), 5000);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
}, [paused, toast.id, onDismiss]);
```

Every time `onDismiss` changes identity (which it will if `dismissToast` isn't stable — and `useCallback` with `[]` deps means it IS stable, but `ToastItem` receives it as a prop from a `.map()` closure), this effect re-runs and resets the 5s timer. The user hovers to pause, moves away, and gets a fresh 5 seconds instead of resuming from where they left off. That's a bug. You need to track elapsed time and resume with the remainder.

---

## 6. `fetchNotificationPage` "pagination" is not pagination

```typescript
export async function fetchNotificationPage(
  userId: string,
  limit: number,   // pass 10 initially, then 20, 30… up to 50
)
```

This re-fetches the entire result set each time, just with a higher limit. That's not pagination — it's "fetch more." If notifications are arriving while the user is reading, the window shifts and they'll see duplicates or miss items. Real cursor-based pagination (keyed on `created_at` + `id`) would be correct.

Also: the `hasMore` check is `notifications.length === loadedCount` — if you have exactly 10 notifications total, this incorrectly shows "Load more." You fetch 10, get 10, assume there are more, fetch 20, get 10 again. Wasted request.

---

## 7. No rate limiting or spam protection on notification creation

What happens when someone:
- Rapidly follows/unfollows the same user 50 times? 50 follow notifications.
- Rapidly likes/unlikes a submission? Each like INSERT creates a notification. Each unlike (DELETE) doesn't remove it. The user sees 50 "X liked your submission" notifications for the same person.
- A bot hammers the like button?

There's no deduplication window, no rate limit, no "collapse similar notifications" logic. The `NOT EXISTS` guard on `friend_submitted` only prevents exact submission-level dupes, not repeated actor actions.

---

## 8. The `read` column name is a SQL reserved word

`read` is a reserved keyword in many SQL contexts. You're going to hit quoting issues somewhere — maybe not in Supabase's query builder (which auto-quotes), but definitely if anyone writes raw SQL against this table. Use `is_read` or `read_at` (timestamp, which also gives you when it was read — strictly more useful).

---

## 9. No error boundary around the notifications system

If `fetchNotifications` throws, the hook catches it with `console.error` and... does nothing. The `loading` state gets set to false, `fetched` stays false, and the effect runs again on next render → infinite error loop. There's no retry-with-backoff, no error state exposed to the UI, no way for the user to know something went wrong.

If the Realtime subscription drops (network blip), there's no reconnection logic. Supabase has built-in reconnect, but there's no handling of the "channel errored" state. The user silently stops getting live notifications with no indication.

---

## 10. Competition notifications assume top-3 only

`create_competition_notifications` only notifies `final_rank <= 3`. What about the other 97% of participants? They submitted artwork, waited for results, and get... nothing. No "you placed 15th" or "here are today's results." The notification system actively makes non-winners feel ignored.

At minimum, everyone who submitted should get a "results are in — see how you did" notification. The plan doesn't even mention this as a future consideration.

---

## 11. Missing: unlike/unfollow cleanup

When someone unlikes a submission, the like notification persists forever (well, 30 days). "Alice liked your submission" shows up, Alice unlikes it 2 seconds later, and the recipient has a stale notification that, when clicked, shows a submission without Alice's like. Same for unfollows. Either add DELETE triggers for unlikes/unfollows to remove the notification, or accept that notifications can be lies.

---

## 12. The `Notification` type is loosely typed in practice

The `NotificationData` interface defines per-type shapes, and `Notification.data` is typed as `NotificationData[NotificationType]` (a union). But every consumer immediately casts to `Record<string, unknown>`:

```typescript
const d = n.data as Record<string, unknown>;
```

So the type system is doing nothing. You get zero type safety on the data field. Either use a discriminated union properly (with type narrowing in a switch) or don't bother with the `NotificationData` interface — it's decoration.

---

## 13. `ICON_CONFIG` and `ICON_MAP` are duplicated

`NotificationsTab.tsx` has `ICON_CONFIG`. `ToastContainer.tsx` has `ICON_MAP`. They're the same thing with different names. The plan that says "write DRY code" ships two copies of the same icon mapping. Extract it.

---

## 14. No consideration for notification preferences

Users can't opt out of any notification type. Some users won't want to be notified every time someone they follow submits. Some won't care about likes. There's no preferences table, no UI for it, and no mention of it as a future consideration. You're building a notification system that users can't control. That's how you get users disabling notifications entirely (or leaving).

---

## Summary

The plan is well-structured and clearly written. It's also prematurely detailed for something that hasn't been stress-tested against real edge cases. The core issues are:

1. **Denormalized data creates maintenance and compliance problems** (fix: join at read time, or add cleanup triggers)
2. **Synchronous fan-out in a submission transaction is dangerous coupling** (fix: async or deferred trigger)
3. **No spam/rate protection** (fix: dedup window or notification collapsing)
4. **Accessibility gaps in hover-to-read** (fix: keyboard support)
5. **"Pagination" that isn't** (fix: cursor-based)

The Phase 1/Phase 2 split is sensible. The implementation order is reasonable. But the plan is so focused on the happy path that it hasn't considered what happens when things go wrong or when users behave unexpectedly.
