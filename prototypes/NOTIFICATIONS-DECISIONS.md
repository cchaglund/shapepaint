# Notifications Feature — Design Decisions

This document captures UX/UI decisions for the notifications system. Pass to developers for implementation reference.

## Platform scope

Desktop only. Mobile is out of scope for this iteration.

---

## 1. Notification Panel — Read/Unread Behavior

**Selected: Hover-to-mark-read**
(Prototype: `notifications-panel-options.html`)

### How it works
- Hovering over an unread notification for ~700ms marks it as read.
- A progress bar fills vertically (left edge, top to bottom) while hovering, giving visual feedback.
- If the user moves the mouse away before 700ms, the timer resets — nothing is marked.
- Clicking an item navigates to the target (and marks read).
- "Mark all as read" button is available at the top of the panel.
- Opening the panel does NOT auto-mark anything. The badge stays until the user interacts.

### Why this approach
- Natural desktop interaction — scanning at your own pace doesn't accidentally mark things as read.
- No extra clicks required just to clear unread state.
- The progress bar makes timing visible and predictable (not arbitrary).
- Users can still "Mark all as read" for bulk clearing.

### Unread indicator style
- **No red dot** on individual notifications. Unread state is communicated via:
  - Subtle tinted background (`rgba(255, 51, 102, 0.06)`) on the entire item row.
  - The hover-bar progress indicator (accent color, left edge) when hovering.
- Read items have a neutral/transparent background.

### Panel background
**Selected: Variant 2 — Tinted items** (the one with the accent-colored notification rows).
Panel bg stays `--color-bg-secondary`. Individual notification items use `--color-selected` as their background (the same tint used behind Gallery/Wall/Friends tabs). Unread items use `--color-selected-hover` for a slightly stronger tint.
(Prototype: `notifications-panel-options.html`, right column)

---

## 2. Notification Icon Placement

**Selected: Option 3 — Dot on avatar (no bell icon)**
(Prototype: `notifications-icon-placement.html`, option 3)

A small accent-colored dot on the avatar signals unread notifications. No bell icon, no extra button in the header. Ultra-minimal.

### Architectural implications
Since the notification indicator is integrated into the user button, the **user dropdown must be extended with a "Notifications" tab**:
- Add a third tab: **Notifications | Following | Followers**
- The **"Log Out" button must remain visible and accessible in ALL tabs** — not hidden behind a specific tab. It currently sits below the Following/Followers content; it must stay visible regardless of which tab is active.
- The notification dot appears on the avatar in the user button.
- Clicking the user button opens the dropdown; default tab could be Notifications if there are unread items, otherwise the current default.

---

## 3. Toast System

**Selected: Bottom-right, solid style**
(Prototype: `notifications-toast-system.html`)

### Position
Bottom-right. Overlaps zoom controls on the z-axis (toasts have higher z-index). This is acceptable because:
- Toasts auto-dismiss after 5 seconds.
- Zoom controls are rarely interacted with during active creation.
- Zoom controls are the most "moveable" UI element if overlap becomes an issue.

### Style
Three styles are prototyped:
- **Solid** (recommended) — uses `--color-bg-elevated` background, solid and readable.
- **Frosted** — backdrop-blur, translucent. Looks nice but can have performance cost.
- **Tinted** — per-event-type gradient tint. More visual variety but potentially distracting.

### Behavior
- Auto-dismiss after 5 seconds with a visible progress bar that shrinks left-to-right.
- Hovering a toast **pauses** the auto-dismiss timer (progress bar pauses).
- Clicking a toast navigates to the relevant target (submission, profile, rankings).
- Close button (x) appears on hover for manual dismiss.
- Max 4 stacked toasts. Oldest evicted when a 5th arrives.
- Slide-in animation from the right (300ms ease-out).
- Toasts only fire for **realtime** events (not retroactive/batch notifications like missed competition wins).

### Click actions per event type
| Event | Click navigates to |
|---|---|
| Like | The liked submission |
| New follower | Their profile |
| Friend submitted | Their submission |
| Competition win | That day's rankings |
| Milestone | The submission that hit the milestone |

---

## 4. Notification Types

(Prototype: `notifications-types-catalog.html`)

### Event types and delivery method

| Event | Toast (realtime) | Panel (batch) | Click target |
|---|---|---|---|
| Like | Yes (first only) | Yes (grouped if 3+) | Submission |
| New follower | Yes | Yes (grouped if 2+) | Profile |
| Competition win (missed) | No | Yes | Rankings |
| Friend submitted | Yes | Yes (individual) | Submission |
| Milestone (likes/followers) | Yes | Yes | Submission / profile |
| Ranking update | No | Yes (optional) | Rankings |
| Friend won | No | Yes (optional) | Their submission |
| Comments (future) | Yes | Yes (grouped per submission) | Submission + comments |
| System announcement | No | Yes | Varies |
| Submission reminder | No | Yes (opt-in) | Canvas |

### Grouping rules
- **Likes**: 3+ likes on the same submission collapse into one grouped notification. Shows up to 3 most recent avatar thumbnails. Toast fires only for the first like; subsequent likes update the panel silently.
- **Followers**: 2+ new followers collapse. Shows avatar stack.
- **Comments**: Multiple comments on the same submission collapse. Shows preview of most recent comment.
- **Friend submitted**: No grouping — each submission is its own notification.

### Layout variant
**Selected: A — Compact** (icon + text + optional thumbnail/avatar)
(Prototype: `notifications-types-catalog.html`, "Design Variants" section)

### Icon style
**Selected: B — SVG icons**
(Prototype: `notifications-icon-styles.html`, option B)

Clean line icons with color-coded backgrounds. Each event type has a distinct SVG icon rendered in the event's accent color on a semi-transparent tinted background:
- **Like**: filled heart, pink/accent bg
- **Follow**: person-plus, purple bg
- **Win/Trophy**: trophy, gold bg
- **Submit**: gallery/storefront, green bg
- **Milestone**: star, blue bg
- **Comment**: message bubble, cyan bg
- **System**: megaphone, neutral bg

### Visual elements clarification
- **Submission thumbnail** (the small square on the right of like/submit notifications): Shows a miniature preview of the artwork submission being referenced. Uses the actual submission's colors/shapes.
- **User avatar** (the circle on follower notifications): Shows the profile picture / avatar of the user who followed you. Displays their initial letter as fallback if no avatar image exists.

### Other layout variants rejected
- **B — Social / avatar-forward**: Large avatar with icon badge overlay. Prioritizes people over events — less suitable for a notification panel.
- **C — Card style**: Each notification in a distinct card with explicit CTA. Too heavy for a dropdown panel.
- **D — Minimal / text-forward**: Colored dot + text only. Too minimal — hard to scan quickly.

---

## 5. Theme Compatibility

All prototypes use CSS custom properties and have been tested in both light and dark Pop Art themes. The implementation must:

- Use only `var(--color-*)` tokens for all colors — never hardcode hex values.
- Test across all 8 theme-mode combinations (4 themes x 2 modes).
- The notification panel background, unread tint, hover states, borders, and shadows all derive from existing theme tokens.
- Event-type icon backgrounds use semi-transparent accent colors that adapt naturally to any theme.

---

## Prototype Files Reference

| File | What it shows |
|---|---|
| File | What it shows | Decision |
|---|---|---|
| `notifications-panel-options.html` | Hover-to-read panel, two bg variants | **Winner: Variant 2** (tinted rows) |
| `notifications-icon-placement.html` | 4 icon placement options | **Winner: Option 3** (dot on avatar) |
| `notifications-toast-system.html` | Interactive toast playground | **Winner: Bottom-right, solid** |
| `notifications-types-catalog.html` | 4 layout variants + full event type catalog | **Winner: A — Compact with SVG icons** |
| `notifications-icon-styles.html` | 4 icon style variants | **Winner: B — SVG icons** |

All prototypes have a light/dark mode toggle button.
