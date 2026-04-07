# Canvas Interaction Model

This document describes how users interact with shapes and groups on the canvas. It captures the mental model, interaction rules, and edge case decisions so that future changes preserve the intended behavior.

## Mental model

A **group** behaves as a single entity. Clicking a grouped shape selects the entire group, dragging moves the entire group, and marquee-selecting any part of a group selects the entire group.

To manipulate an individual shape within a group, the user must first **enter** the group via double-click. Once inside, shapes behave as if ungrouped. Clicking outside the group (or on empty canvas) **exits** the group and returns to the default mode.

## Key state: `activeGroupId`

A single piece of state — `activeGroupId: string | null` — gates all group-aware behavior:

- **`null` (default):** Groups are opaque. Clicks, drags, hovers, and marquee selection treat grouped shapes as part of their group.
- **Set to a group ID (after double-click):** The user has "entered" this group. Shapes within it behave as individual shapes (identical to today's ungrouped behavior). Everything outside the active group still follows default rules.

## Interaction rules

### Click on a grouped shape (default mode)
- Selects the entire group (all shapes in the group become selected).
- Does NOT set `activeGroupId`.

### Click-hold-drag on a grouped shape (default mode)
- Selects the entire group and drags all shapes in the group together.

### Double-click on a grouped shape (default mode)
- Sets `activeGroupId` to the shape's group.
- Selects the individual shape that was double-clicked.
- From this point the user can release to just select the shape, or hold and drag to move that shape alone.

### Click on a shape inside the active group
- Selects that individual shape (same as today's ungrouped click behavior).

### Shift+click on a shape inside the active group
- Toggles that individual shape in/out of the selection (multi-select within the group).

### Click on a shape outside the active group
- Clears `activeGroupId` (exits the group).
- If the clicked shape is in a different group: selects that group.
- If the clicked shape is ungrouped: selects that shape.

### Click on empty canvas
- Clears `activeGroupId`.
- Deselects everything.

### Shift+click on a grouped shape (default mode)
- Toggles the entire group in/out of the selection.

### Marquee selection
- If the marquee intersects any shape that belongs to a group (and that group is not the active group), the entire group is selected.
- If the marquee intersects a shape inside the active group, only that individual shape is selected.

## Hover behavior

### Canvas hover on a shape (default mode)
- If the shape belongs to a group: highlight the bounding box of the entire group (single rectangle encompassing all shapes, not individual outlines per shape).
- If the shape is ungrouped: highlight just that shape's bounding box.

### Canvas hover on a shape inside the active group
- Highlight only that individual shape's bounding box.

### Layer panel hover
- Hovering a group header: highlights the group bounding box (same single-rectangle treatment as canvas hover).
- Hovering an individual layer within a group: highlights that shape only.

## Layer panel behavior

The layer panel does NOT change. Clicking a layer always selects that individual shape. Clicking a group header selects the entire group. This is intentional — the layer panel is the "detailed" view where you always have direct access to individual shapes.

## Edge cases and decisions

| Scenario | Decision | Reasoning |
|----------|----------|-----------|
| Double-click into group, then click another shape in same group | Selects the new shape (stays inside group) | User has entered the group; they're working at the individual shape level |
| Double-click into group, shift+click another shape in same group | Multi-selects both shapes within the group | Consistent with normal shift+click behavior when inside a group |
| Click on a shape in group A while group B shapes are selected | Deselects group B, selects group A | A group is a single entity; clicking a new entity replaces selection |
| Marquee selects a corner of a group | Entire group is selected | A group is a single entity |
| Locked group | Click does nothing (existing behavior via `isShapeLocked`) | No change needed |
| Resize/rotate handles on selected group | Works like multi-select (bounding box with handles) | Existing multi-select infrastructure handles this |

## What this document does NOT cover

- Mobile/touch interactions (deferred)
- Layer panel drag-and-drop reordering
- Group creation/deletion UI
