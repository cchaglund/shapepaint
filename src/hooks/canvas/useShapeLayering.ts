import { useCallback } from 'react';
import type { Shape, CanvasState } from '../../types';
import { getShapeAABB } from '../../utils/shapeBounds';
import { getShapeDimensions } from '../../utils/shapes';

type SetCanvasState = (
  updater: CanvasState | ((prev: CanvasState) => CanvasState),
  addToHistory?: boolean,
  label?: string
) => void;

/** The set of shapes that share a movement context with `shape`: same group, or all root-level shapes. */
export function getShapeContextPool(shape: Shape, allShapes: Shape[]): Shape[] {
  return shape.groupId
    ? allShapes.filter((s) => s.groupId === shape.groupId)
    : allShapes;
}

/**
 * True iff applying a `direction` reorder to `selectedIds` would actually change
 * the layering. Used to drive disabled state for the bring-forward/send-backward
 * toolbar buttons — guarantees the UI matches the reorder algorithm exactly.
 */
export function canReorderSelection(
  state: CanvasState,
  selectedIds: Set<string>,
  direction: 'up' | 'down',
): boolean {
  if (selectedIds.size === 0) return false;
  return reorderInContexts(state, selectedIds, new Set(), direction) !== state;
}

type ReorderMode = 'up' | 'down' | 'top' | 'bottom';

/**
 * Reorder `items` in-place by moving "active" items in `mode` direction.
 *
 * Rules:
 *  - up/down: each active item swaps with its neighbor in the direction, but only
 *    if that neighbor is inactive. Iteration starts at the leading edge so that
 *    after a swap, the next active item sees the newly-vacated slot — letting
 *    "bundles" of adjacent active items move together past unselected neighbors.
 *  - top/bottom: active items partition to the chosen edge, preserving their
 *    relative order; inactive items keep their relative order in the remainder.
 */
function reorderInPlace<T>(items: T[], isActive: (t: T) => boolean, mode: ReorderMode) {
  if (mode === 'up' || mode === 'down') {
    const isUp = mode === 'up';
    const start = isUp ? items.length - 1 : 0;
    const end = isUp ? -1 : items.length;
    const step = isUp ? -1 : 1;
    for (let i = start; i !== end; i += step) {
      if (!isActive(items[i])) continue;
      const j = i + (isUp ? 1 : -1);
      if (j < 0 || j >= items.length) continue;
      if (isActive(items[j])) continue;
      [items[i], items[j]] = [items[j], items[i]];
    }
    return;
  }
  const active: T[] = [];
  const inactive: T[] = [];
  for (const item of items) (isActive(item) ? active : inactive).push(item);
  items.length = 0;
  items.push(...(mode === 'top' ? [...inactive, ...active] : [...active, ...inactive]));
}

type RootItem = { kind: 'shape'; id: string } | { kind: 'group'; id: string };

/**
 * Single algorithm that backs every step-style reorder operation (single shape,
 * single group, or full selection). The core idea:
 *
 *   1. Classify groups: a group is "root-active" if it's in `activeGroupIds` or all
 *      its shapes are in `activeShapeIds`. Otherwise, partially-selected groups have
 *      their selected shapes treated as "in-group active".
 *   2. Build the root context (ungrouped shapes + groups-as-units, z-ascending) and
 *      reorder it using `reorderInPlace`.
 *   3. For each partial group, build its internal context and reorder it.
 *   4. Walk the new root order, assigning contiguous z-indices. Group items expand
 *      to their members in their (possibly reordered) internal order.
 *
 * Returns `prev` unchanged if no z-indices would actually change.
 */
function reorderInContexts(
  prev: CanvasState,
  activeShapeIds: Set<string>,
  activeGroupIds: Set<string>,
  mode: ReorderMode,
): CanvasState {
  // --- Classify groups ---
  const fullyActiveGroupIds = new Set(activeGroupIds);
  const inGroupActive = new Map<string, Set<string>>(); // groupId → active shape ids in group
  {
    const selectedByGroup = new Map<string, Shape[]>();
    for (const s of prev.shapes) {
      if (activeShapeIds.has(s.id) && s.groupId) {
        const arr = selectedByGroup.get(s.groupId) || [];
        arr.push(s);
        selectedByGroup.set(s.groupId, arr);
      }
    }
    for (const [groupId, shapes] of selectedByGroup) {
      if (fullyActiveGroupIds.has(groupId)) continue;
      const total = prev.shapes.filter((s) => s.groupId === groupId).length;
      if (shapes.length === total) {
        fullyActiveGroupIds.add(groupId);
      } else {
        inGroupActive.set(groupId, new Set(shapes.map((s) => s.id)));
      }
    }
  }

  // --- Build root context (z-ascending) ---
  const rootEntries: { item: RootItem; anchorZ: number }[] = [];
  for (const g of prev.groups) {
    const gShapes = prev.shapes.filter((s) => s.groupId === g.id);
    if (gShapes.length === 0) continue;
    rootEntries.push({
      item: { kind: 'group', id: g.id },
      anchorZ: Math.max(...gShapes.map((s) => s.zIndex)),
    });
  }
  for (const s of prev.shapes) {
    if (!s.groupId) rootEntries.push({ item: { kind: 'shape', id: s.id }, anchorZ: s.zIndex });
  }
  rootEntries.sort((a, b) => a.anchorZ - b.anchorZ);
  const rootItems = rootEntries.map((e) => e.item);

  reorderInPlace(
    rootItems,
    (item) => item.kind === 'group' ? fullyActiveGroupIds.has(item.id) : activeShapeIds.has(item.id),
    mode,
  );

  // --- Reorder partial group contexts ---
  const groupOrder = new Map<string, string[]>();
  for (const [groupId, activeIds] of inGroupActive) {
    const ordered = prev.shapes
      .filter((s) => s.groupId === groupId)
      .sort((a, b) => a.zIndex - b.zIndex);
    reorderInPlace(ordered, (s) => activeIds.has(s.id), mode);
    groupOrder.set(groupId, ordered.map((s) => s.id));
  }

  // --- Assign contiguous z-indices following the new order ---
  const newZ = new Map<string, number>();
  let nextZ = 0;
  for (const item of rootItems) {
    if (item.kind === 'shape') {
      newZ.set(item.id, nextZ++);
      continue;
    }
    const ids = groupOrder.get(item.id)
      ?? prev.shapes
        .filter((s) => s.groupId === item.id)
        .sort((a, b) => a.zIndex - b.zIndex)
        .map((s) => s.id);
    for (const id of ids) newZ.set(id, nextZ++);
  }

  const changed = prev.shapes.some((s) => s.zIndex !== newZ.get(s.id));
  if (!changed) return prev;
  return {
    ...prev,
    shapes: prev.shapes.map((s) => ({ ...s, zIndex: newZ.get(s.id) ?? s.zIndex })),
  };
}


export function useShapeLayering(setCanvasState: SetCanvasState) {
  const selectShape = useCallback(
    (id: string | null, options?: { toggle?: boolean; range?: boolean; orderedIds?: string[] }) => {
      const { toggle = false, range = false, orderedIds = [] } = options || {};
      setCanvasState(
        (prev) => {
          if (id === null) {
            return { ...prev, selectedShapeIds: new Set<string>() };
          }

          if (toggle) {
            const newSelectedIds = new Set(prev.selectedShapeIds);
            if (newSelectedIds.has(id)) {
              newSelectedIds.delete(id);
            } else {
              newSelectedIds.add(id);
            }
            return { ...prev, selectedShapeIds: newSelectedIds };
          }

          if (range && orderedIds.length > 0) {
            const currentlySelected = Array.from(prev.selectedShapeIds);
            let anchorIndex = -1;

            for (let i = 0; i < orderedIds.length; i++) {
              if (currentlySelected.includes(orderedIds[i])) {
                anchorIndex = i;
                break;
              }
            }

            if (anchorIndex === -1) {
              return { ...prev, selectedShapeIds: new Set([id]) };
            }

            const targetIndex = orderedIds.indexOf(id);
            if (targetIndex === -1) return prev;

            const startIndex = Math.min(anchorIndex, targetIndex);
            const endIndex = Math.max(anchorIndex, targetIndex);
            const rangeIds = orderedIds.slice(startIndex, endIndex + 1);

            return { ...prev, selectedShapeIds: new Set(rangeIds) };
          }

          return { ...prev, selectedShapeIds: new Set([id]) };
        },
        false
      );
    },
    [setCanvasState]
  );

  const selectShapes = useCallback(
    (ids: string[], options?: { additive?: boolean }) => {
      const additive = options?.additive ?? false;
      setCanvasState(
        (prev) => {
          if (additive) {
            const newSelected = new Set(prev.selectedShapeIds);
            for (const id of ids) newSelected.add(id);
            return { ...prev, selectedShapeIds: newSelected };
          }
          return { ...prev, selectedShapeIds: new Set(ids) };
        },
        false
      );
    },
    [setCanvasState]
  );

  // Move a single shape one step in its context (its group, or root if ungrouped).
  // Backed by `reorderInContexts` with a single-shape activation set.
  const moveLayer = useCallback(
    (id: string, direction: ReorderMode) => {
      setCanvasState(
        (prev) => reorderInContexts(prev, new Set([id]), new Set(), direction),
        true, 'Reorder',
      );
    },
    [setCanvasState],
  );

  // Move every selected shape (and any fully-selected group, as a unit) one step
  // within its context. Selected items preserve their relative order, so adjacent
  // selected items move together as a "bundle" past unselected neighbors.
  const reorderSelection = useCallback(
    (direction: 'up' | 'down') => {
      setCanvasState(
        (prev) => prev.selectedShapeIds.size === 0
          ? prev
          : reorderInContexts(prev, prev.selectedShapeIds, new Set(), direction),
        true, 'Reorder',
      );
    },
    [setCanvasState],
  );

  const reorderLayers = useCallback(
    (draggedId: string, targetIndex: number, targetGroupId: string | null) => {
      setCanvasState((prev) => {
        // Prevent dropping into a locked group
        if (targetGroupId) {
          const targetGroup = prev.groups.find(g => g.id === targetGroupId);
          if (targetGroup?.locked) return prev;
        }

        const sortedByZDesc = [...prev.shapes].sort((a, b) => b.zIndex - a.zIndex);
        const draggedIndex = sortedByZDesc.findIndex((s) => s.id === draggedId);

        if (draggedIndex === -1 || draggedIndex === targetIndex) return prev;

        const draggedShape = sortedByZDesc[draggedIndex];
        const oldGroupId = draggedShape.groupId;

        const reordered = [...sortedByZDesc];
        const [removed] = reordered.splice(draggedIndex, 1);
        reordered.splice(targetIndex, 0, removed);

        const newShapes = prev.shapes.map((shape) => {
          const newPosition = reordered.findIndex((s) => s.id === shape.id);
          const newZIndex = reordered.length - 1 - newPosition;

          if (shape.id === draggedId) {
            return { ...shape, zIndex: newZIndex, groupId: targetGroupId || undefined };
          }
          return { ...shape, zIndex: newZIndex };
        });

        let newGroups = prev.groups;
        if (oldGroupId && oldGroupId !== targetGroupId) {
          const shapesStillInOldGroup = newShapes.filter((s) => s.groupId === oldGroupId);
          if (shapesStillInOldGroup.length === 0) {
            newGroups = prev.groups.filter((g) => g.id !== oldGroupId);
          }
        }

        return { ...prev, shapes: newShapes, groups: newGroups };
      }, true, 'Reorder');
    },
    [setCanvasState]
  );

  // Move an entire group (as a unit) one step in the root context.
  // Backed by `reorderInContexts` with an empty shape set and a single active group.
  const moveGroup = useCallback(
    (groupId: string, direction: ReorderMode) => {
      setCanvasState(
        (prev) => reorderInContexts(prev, new Set(), new Set([groupId]), direction),
        true, 'Reorder',
      );
    },
    [setCanvasState],
  );

  const reorderGroup = useCallback(
    (draggedGroupId: string, targetTopLevelIndex: number) => {
      setCanvasState((prev) => {
        const group = prev.groups.find((g) => g.id === draggedGroupId);
        if (!group) return prev;

        const shapesInGroup = prev.shapes.filter((s) => s.groupId === draggedGroupId);
        if (shapesInGroup.length === 0) return prev;

        type TopLevelItem =
          | { type: 'group'; groupId: string; maxZIndex: number; minZIndex: number; shapeIds: string[] }
          | { type: 'ungrouped-shape'; shapeId: string; zIndex: number };

        const topLevelItems: TopLevelItem[] = [];

        for (const g of prev.groups) {
          const gShapes = prev.shapes.filter((s) => s.groupId === g.id);
          if (gShapes.length === 0) continue;
          const maxZ = Math.max(...gShapes.map((s) => s.zIndex));
          const minZ = Math.min(...gShapes.map((s) => s.zIndex));
          topLevelItems.push({
            type: 'group',
            groupId: g.id,
            maxZIndex: maxZ,
            minZIndex: minZ,
            shapeIds: gShapes.map((s) => s.id),
          });
        }

        for (const s of prev.shapes) {
          if (!s.groupId) {
            topLevelItems.push({ type: 'ungrouped-shape', shapeId: s.id, zIndex: s.zIndex });
          }
        }

        topLevelItems.sort((a, b) => {
          const aZ = a.type === 'group' ? a.maxZIndex : a.zIndex;
          const bZ = b.type === 'group' ? b.maxZIndex : b.zIndex;
          return bZ - aZ;
        });

        const currentIndex = topLevelItems.findIndex(
          (item) => item.type === 'group' && item.groupId === draggedGroupId
        );
        if (currentIndex === -1 || currentIndex === targetTopLevelIndex) return prev;

        const reordered = [...topLevelItems];
        const [removed] = reordered.splice(currentIndex, 1);
        reordered.splice(targetTopLevelIndex, 0, removed);

        let currentZ = reordered.length * 10;
        const newZIndexMap = new Map<string, number>();

        for (const item of reordered) {
          if (item.type === 'group') {
            const groupShapes = prev.shapes.filter((s) => s.groupId === item.groupId);
            const sortedGroupShapes = [...groupShapes].sort((a, b) => b.zIndex - a.zIndex);
            for (const shape of sortedGroupShapes) {
              newZIndexMap.set(shape.id, currentZ--);
            }
          } else {
            newZIndexMap.set(item.shapeId, currentZ--);
          }
        }

        const newShapes = prev.shapes.map((shape) => {
          const newZ = newZIndexMap.get(shape.id);
          if (newZ !== undefined && newZ !== shape.zIndex) {
            return { ...shape, zIndex: newZ };
          }
          return shape;
        });

        return { ...prev, shapes: newShapes };
      }, true, 'Reorder');
    },
    [setCanvasState]
  );

  const setBackgroundColor = useCallback(
    (colorIndex: number | null) => {
      setCanvasState((prev) => ({ ...prev, backgroundColorIndex: colorIndex }), true, 'Background');
    },
    [setCanvasState]
  );

  const mirrorHorizontal = useCallback(
    (ids: string[]) => {
      if (ids.length === 0) return;

      setCanvasState((prev) => {
        const shapesToMirror = prev.shapes.filter((s) => ids.includes(s.id));
        if (shapesToMirror.length === 0) return prev;

        const updates = new Map<string, Partial<Shape>>();

        if (shapesToMirror.length === 1) {
          const shape = shapesToMirror[0];
          updates.set(shape.id, { flipX: !shape.flipX });
        } else {
          // Use AABB to find the visual group bounds (accounts for rotation + actual dimensions)
          let minX = Infinity, maxX = -Infinity;
          for (const shape of shapesToMirror) {
            const aabb = getShapeAABB(shape);
            minX = Math.min(minX, aabb.minX);
            maxX = Math.max(maxX, aabb.maxX);
          }
          const centerX = (minX + maxX) / 2;

          for (const shape of shapesToMirror) {
            const dims = getShapeDimensions(shape.type, shape.size);
            const shapeCenterX = shape.x + dims.width / 2;
            const newShapeCenterX = centerX + (centerX - shapeCenterX);
            const newX = newShapeCenterX - dims.width / 2;
            updates.set(shape.id, { x: newX, flipX: !shape.flipX });
          }
        }

        return {
          ...prev,
          shapes: prev.shapes.map((s) => {
            const shapeUpdates = updates.get(s.id);
            return shapeUpdates ? { ...s, ...shapeUpdates } : s;
          }),
        };
      }, true, 'Mirror');
    },
    [setCanvasState]
  );

  const mirrorVertical = useCallback(
    (ids: string[]) => {
      if (ids.length === 0) return;

      setCanvasState((prev) => {
        const shapesToMirror = prev.shapes.filter((s) => ids.includes(s.id));
        if (shapesToMirror.length === 0) return prev;

        const updates = new Map<string, Partial<Shape>>();

        if (shapesToMirror.length === 1) {
          const shape = shapesToMirror[0];
          updates.set(shape.id, { flipY: !shape.flipY });
        } else {
          // Use AABB to find the visual group bounds (accounts for rotation + actual dimensions)
          let minY = Infinity, maxY = -Infinity;
          for (const shape of shapesToMirror) {
            const aabb = getShapeAABB(shape);
            minY = Math.min(minY, aabb.minY);
            maxY = Math.max(maxY, aabb.maxY);
          }
          const centerY = (minY + maxY) / 2;

          for (const shape of shapesToMirror) {
            const dims = getShapeDimensions(shape.type, shape.size);
            const shapeCenterY = shape.y + dims.height / 2;
            const newShapeCenterY = centerY + (centerY - shapeCenterY);
            const newY = newShapeCenterY - dims.height / 2;
            updates.set(shape.id, { y: newY, flipY: !shape.flipY });
          }
        }

        return {
          ...prev,
          shapes: prev.shapes.map((s) => {
            const shapeUpdates = updates.get(s.id);
            return shapeUpdates ? { ...s, ...shapeUpdates } : s;
          }),
        };
      }, true, 'Mirror');
    },
    [setCanvasState]
  );

  return {
    selectShape,
    selectShapes,
    moveLayer,
    moveGroup,
    reorderSelection,
    reorderLayers,
    reorderGroup,
    setBackgroundColor,
    mirrorHorizontal,
    mirrorVertical,
  };
}
