# Draft Slots

Save multiple draft versions of your artwork before submitting, so you can explore creative ideas without destroying previous work.

## Problem

When creating art for the daily challenge, users often feel resistance to experimenting because resetting the canvas means losing what they've already made. This "killing your darlings" anxiety limits creative exploration — even when you sense you have a better idea in you, the risk of losing a decent piece holds you back.

## Solution

Up to 3 draft slots stored in localStorage. Users can fork their work at any point, switch freely between drafts, and submit whichever they like best.

## UX Design

### Placement & Visual Style

The draft pills float at the top-center of the canvas in a **frosted glass container** — a subtle backdrop-blur trough with 1px border. This was chosen over:

- **A sub-bar below the top bar**: Too structural, adds permanent height. The drafts are a lightweight creative tool, not a navigation element.
- **Loose floating pills without a container**: Tested this — felt too scattered. The container groups them as a cohesive control.
- **Numbered circles**: Too minimal and cryptic. The "Draft 1" label is important for clarity.

The frosted container uses `backdrop-filter: blur(12px)` with a translucent white background, so it sits naturally over the canvas pattern without feeling heavy.

### Pill States

- **Inactive**: Compact, transparent, tertiary text color. No X button. Tighter padding.
- **Active**: Card-bg background, primary border, button shadow. The X icon animates in (scale + opacity with ease-out-back overshoot). Slightly wider padding to accommodate the X.
- **Sole (only 1 draft)**: Active styling but no X — you can't delete your only draft.
- **Confirming**: Danger-colored border and shadow. Label morphs to "DELETE? undo" inline.

All state transitions use CSS transitions on the actual DOM elements (not rebuilds), so the browser interpolates smoothly between states.

### Key Interactions

**Adding a draft (+ button)**:
- Duplicates the current canvas into a new slot, switches to it.
- New pill slides in from zero width/opacity with `scale(0.8)` transition.
- Previous active pill smoothly shrinks (X fades out, padding tightens).
- Max 3 drafts — the + button collapses smoothly when limit is reached.

**Switching drafts**:
- Click any pill. Auto-saves current slot, loads the clicked one.
- Active state transitions smoothly — the old pill deactivates (loses border/shadow/X), the new pill activates (gains them). All via CSS transitions since pills stay in DOM.

**Deleting a draft (X on active pill)**:
- Click X → pill morphs to inline "DELETE? undo" confirmation (not a modal/popover). The pill border turns danger-colored.
- Click "DELETE?" to confirm, "undo" or click outside to cancel.
- On delete: two-phase exit animation — (1) pill fades to ghost state, (2) collapses width to zero. Adjacent draft becomes active.

**Why inline confirmation instead of a modal/popover**: We considered three approaches:
1. **Inline text swap** (chosen): Zero extra UI layers. The pill itself becomes the confirmation. Feels lightweight for a small action.
2. **Mini popover**: Familiar but adds a dropdown overlapping the canvas. Heavier than needed.
3. **Two-click (X turns red)**: Lightest possible, but too subtle — users might not understand the red X means "click again."

**Reset behavior**: Clears the active draft's canvas. The slot remains (it just becomes blank). This is distinct from deleting, which removes the slot entirely.

**Submit**: Submits whatever is currently on the canvas. No extra confirmation about which draft — you can see what you're submitting.

**Day rollover**: All draft slots clear when the challenge date changes, matching existing localStorage cleanup behavior.

### Animation Details

- Easing: `cubic-bezier(0.22, 1, 0.36, 1)` (ease-out-smooth) for most transitions, `cubic-bezier(0.34, 1.56, 0.64, 1)` (ease-out-back) for the X icon pop-in.
- Duration: 0.28s for most transitions, 0.18s for hover/color changes.
- The + button rotates 90 degrees on hover.
- Pill enter/exit animations use `max-width` + `opacity` + `transform: scale()` for smooth sizing.

## Data Model

No database changes. All draft state lives in localStorage.

### Storage Format

Extends the existing `2colors2shapes_canvas` localStorage key to hold multiple slots:

```typescript
interface DraftSlot {
  id: number;
  name: string;
  canvas: CanvasState; // shapes, groups, backgroundColorIndex, selectedShapeIds
}

interface StoredDraftData {
  date: string;        // YYYY-MM-DD
  userId?: string;
  activeDraftId: number;
  drafts: DraftSlot[];
}
```

### Migration

On load, if localStorage contains the old single-canvas format, migrate it into a single-slot draft array seamlessly.

## Implementation Notes

- Use Motion's `AnimatePresence` + `layout` for the React implementation — the HTML prototype approximates this with CSS transitions + two-phase exit, but Motion handles exit animations natively.
- The draft container component should be independent of the canvas editor — it just manages which `CanvasState` is active and passes it down.
- Undo/redo history is per-draft — switching drafts swaps the entire history stack.

## Prototypes

- [drafts-prototype.html](drafts-prototype.html) — **Latest**: fully interactive prototype with add/delete/switch, inline delete confirmation, two-phase exit animation, frosted container.
- [drafts-prototype-b.html](drafts-prototype-b.html) — Earlier static mockup showing 3 initial design directions (Segmented Control, Floating Pills, Numbered Circles). Useful for understanding the design exploration.
