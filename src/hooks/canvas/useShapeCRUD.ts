import { useCallback, useRef } from 'react';
import type { Shape, CanvasState, DailyChallenge, ShapeType, ShapeGroup } from '../../types';
import { generateId, SHAPE_NAMES } from '../../utils/shapes';
import { isShapeLocked } from '../../utils/visibility';

type SetCanvasState = (
  updater: CanvasState | ((prev: CanvasState) => CanvasState),
  addToHistory?: boolean,
  label?: string
) => void;

function shiftZIndicesAbove(shapes: Shape[], insertAfterZ: number, count: number): Shape[] {
  return shapes.map((s) => s.zIndex > insertAfterZ ? { ...s, zIndex: s.zIndex + count } : s);
}

function generateShapeName(type: ShapeType, existingShapes: Shape[]): string {
  const typeCount = existingShapes.filter(s => s.type === type).length + 1;
  return `${SHAPE_NAMES[type]} ${typeCount}`;
}

function generateGroupName(existingGroups: ShapeGroup[]): string {
  const existingNumbers = existingGroups
    .map((g) => {
      const match = g.name.match(/^Group (\d+)$/);
      return match ? parseInt(match[1], 10) : 0;
    })
    .filter((n) => n > 0);
  const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;
  return `Group ${nextNumber}`;
}

/** Mutable collectors passed through duplication to accumulate new shapes and track naming. */
interface DuplicationAccumulator {
  shapes: Shape[];
  selectedIds: string[];
  allShapesForNaming: Shape[];
  nextZ: number;
}

/** Creates a duplicate of `original`, assigns it `zIndex` and `groupId`, and pushes it into `acc`. */
function emitDuplicate(
  acc: DuplicationAccumulator,
  original: Shape,
  groupId: string | undefined,
): void {
  const newShape: Shape = {
    ...original,
    id: generateId(),
    name: generateShapeName(original.type, acc.allShapesForNaming),
    zIndex: acc.nextZ++,
    groupId,
    visible: undefined,
    locked: undefined,
  };
  acc.shapes.push(newShape);
  acc.selectedIds.push(newShape.id);
  acc.allShapesForNaming.push(newShape);
}

/**
 * A "duplication unit" represents either an entire group (all shapes selected)
 * or a single shape (from a partial group selection or ungrouped).
 * Units are sorted by z-position to preserve relative stacking order among duplicates.
 */
type DuplicationUnit =
  | { type: 'fullGroup'; groupId: string; shapes: Shape[]; maxZ: number }
  | { type: 'individual'; shape: Shape; maxZ: number };

export function useShapeCRUD(
  challenge: DailyChallenge | null,
  setCanvasState: SetCanvasState,
) {
  // Track the IDs of shapes created by the last duplicate operation,
  // so pressing duplicate with no selection re-duplicates them.
  const lastDuplicatedIdsRef = useRef<string[]>([]);
  // IDs of shapes just created by a user action (add/duplicate).
  // Canvas reads & clears this to animate them regardless of batch size.
  const pendingAnimationIdsRef = useRef<string[]>([]);

  const addShape = useCallback(
    (shapeIndex: number, colorIndex: number, options?: { x?: number; y?: number; size?: number }) => {
      if (!challenge) return;

      setCanvasState((prev) => {
        const maxZIndex = Math.max(0, ...prev.shapes.map((s) => s.zIndex));

        const shapeType = challenge.shapes[shapeIndex].type;
        const defaultName = generateShapeName(shapeType, prev.shapes);

        const size = options?.size ?? 100;
        const x = options?.x != null ? options.x - size / 2 : 350;
        const y = options?.y != null ? options.y - size / 2 : 350;

        const newShape: Shape = {
          id: generateId(),
          type: challenge.shapes[shapeIndex].type,
          name: defaultName,
          x,
          y,
          size,
          rotation: 0,
          colorIndex,
          zIndex: maxZIndex + 1,
        };

        pendingAnimationIdsRef.current = [...pendingAnimationIdsRef.current, newShape.id];

        return {
          ...prev,
          shapes: [...prev.shapes, newShape],
          selectedShapeIds: new Set([newShape.id]),
        };
      }, true, 'Add shape');
    },
    [challenge, setCanvasState]
  );

  const duplicateShape = useCallback(
    (id: string) => {
      setCanvasState((prev) => {
        const shape = prev.shapes.find((s) => s.id === id);
        if (!shape) return prev;

        const shiftedShapes = shiftZIndicesAbove(prev.shapes, shape.zIndex, 1);

        const newShape: Shape = {
          ...shape,
          id: generateId(),
          name: generateShapeName(shape.type, prev.shapes),
          zIndex: shape.zIndex + 1,
        };

        lastDuplicatedIdsRef.current = [newShape.id];
        pendingAnimationIdsRef.current = [...pendingAnimationIdsRef.current, newShape.id];

        return {
          ...prev,
          shapes: [...shiftedShapes, newShape],
          selectedShapeIds: new Set([newShape.id]),
        };
      }, true, 'Duplicate');
    },
    [setCanvasState]
  );

  // Duplicates multiple shapes using Figma-style placement rules:
  //
  // 1. Categorize each group as "full" (all shapes selected) or "partial" (some selected).
  // 2. If every selected shape belongs to ONE group and it's partial → "single-group" mode:
  //    duplicates stay in the group, inserted above the topmost selected shape.
  // 3. Otherwise → "multi-source" mode: full groups duplicate as new groups, partial/ungrouped
  //    shapes duplicate as ungrouped. All duplicates go above the topmost involved group,
  //    preserving their relative stacking order.
  const duplicateShapes = useCallback(
    (ids: string[]) => {
      if (ids.length === 0) return;

      if (ids.length === 1) {
        duplicateShape(ids[0]);
        return;
      }

      setCanvasState((prev) => {
        const idSet = new Set(ids);
        const selectedShapes = prev.shapes.filter((s) => idSet.has(s.id));
        if (selectedShapes.length === 0) return prev;

        // --- Categorize by group membership ---
        const selectedByGroup = new Map<string, Shape[]>();
        const ungroupedSelected: Shape[] = [];

        for (const shape of selectedShapes) {
          if (shape.groupId) {
            const arr = selectedByGroup.get(shape.groupId) || [];
            arr.push(shape);
            selectedByGroup.set(shape.groupId, arr);
          } else {
            ungroupedSelected.push(shape);
          }
        }

        const fullGroupIds = new Set<string>();
        const partialGroupIds = new Set<string>();

        for (const [groupId, selectedInGroup] of selectedByGroup) {
          const totalInGroup = prev.shapes.filter((s) => s.groupId === groupId).length;
          if (selectedInGroup.length === totalInGroup) {
            fullGroupIds.add(groupId);
          } else {
            partialGroupIds.add(groupId);
          }
        }

        // --- Determine mode ---
        const isSingleGroupPartial =
          partialGroupIds.size === 1 &&
          fullGroupIds.size === 0 &&
          ungroupedSelected.length === 0;

        if (isSingleGroupPartial) {
          // Single-group mode: duplicates stay in the group, above topmost selected.
          const groupId = selectedShapes[0].groupId!;
          const sortedSelected = [...selectedShapes].sort((a, b) => a.zIndex - b.zIndex);
          const topZ = Math.max(...sortedSelected.map((s) => s.zIndex));

          const shiftedShapes = shiftZIndicesAbove(prev.shapes, topZ, sortedSelected.length);
          const acc: DuplicationAccumulator = {
            shapes: [], selectedIds: [], allShapesForNaming: [...shiftedShapes], nextZ: topZ + 1,
          };

          for (const original of sortedSelected) {
            emitDuplicate(acc, original, groupId);
          }

          lastDuplicatedIdsRef.current = acc.selectedIds;
          pendingAnimationIdsRef.current = [...pendingAnimationIdsRef.current, ...acc.selectedIds];

          return {
            ...prev,
            shapes: [...shiftedShapes, ...acc.shapes],
            selectedShapeIds: new Set(acc.selectedIds),
          };
        }

        // --- Multi-source mode ---
        const units: DuplicationUnit[] = [];

        for (const groupId of fullGroupIds) {
          const groupShapes = selectedByGroup.get(groupId)!;
          const maxZ = Math.max(...groupShapes.map((s) => s.zIndex));
          units.push({ type: 'fullGroup', groupId, shapes: groupShapes, maxZ });
        }

        for (const groupId of partialGroupIds) {
          for (const shape of selectedByGroup.get(groupId)!) {
            units.push({ type: 'individual', shape, maxZ: shape.zIndex });
          }
        }

        for (const shape of ungroupedSelected) {
          units.push({ type: 'individual', shape, maxZ: shape.zIndex });
        }

        units.sort((a, b) => a.maxZ - b.maxZ);

        // Insertion point must be above ALL involved groups (not just selected shapes).
        let topSourceZ = Math.max(...units.map((u) => u.maxZ));
        for (const groupId of partialGroupIds) {
          const allGroupShapes = prev.shapes.filter((s) => s.groupId === groupId);
          topSourceZ = Math.max(topSourceZ, ...allGroupShapes.map((s) => s.zIndex));
        }
        const totalNewShapes = units.reduce(
          (sum, u) => sum + (u.type === 'fullGroup' ? u.shapes.length : 1),
          0,
        );

        const shiftedShapes = shiftZIndicesAbove(prev.shapes, topSourceZ, totalNewShapes);
        let newGroups = [...prev.groups];
        const acc: DuplicationAccumulator = {
          shapes: [], selectedIds: [], allShapesForNaming: [...shiftedShapes], nextZ: topSourceZ + 1,
        };

        for (const unit of units) {
          if (unit.type === 'fullGroup') {
            const newGroupId = generateId();
            const maxGroupZIndex = newGroups.length > 0
              ? Math.max(...newGroups.map((g) => g.zIndex))
              : 0;
            newGroups = [...newGroups, {
              id: newGroupId,
              name: generateGroupName(newGroups),
              isCollapsed: false,
              zIndex: maxGroupZIndex + 1,
            }];

            const sortedGroupShapes = [...unit.shapes].sort((a, b) => a.zIndex - b.zIndex);
            for (const shape of sortedGroupShapes) {
              emitDuplicate(acc, shape, newGroupId);
            }
          } else {
            emitDuplicate(acc, unit.shape, undefined);
          }
        }

        lastDuplicatedIdsRef.current = acc.selectedIds;
        pendingAnimationIdsRef.current = [...pendingAnimationIdsRef.current, ...acc.selectedIds];

        return {
          ...prev,
          shapes: [...shiftedShapes, ...acc.shapes],
          groups: newGroups,
          selectedShapeIds: new Set(acc.selectedIds),
        };
      }, true, 'Duplicate');
    },
    [duplicateShape, setCanvasState],
  );

  const updateShape = useCallback(
    (id: string, updates: Partial<Shape>, addToHistory = true, label?: string) => {
      setCanvasState((prev) => ({
        ...prev,
        shapes: prev.shapes.map((s) => (s.id === id ? { ...s, ...updates } : s)),
      }), addToHistory, label);
    },
    [setCanvasState]
  );

  const updateShapes = useCallback(
    (updates: Map<string, Partial<Shape>>, addToHistory = true, label?: string) => {
      setCanvasState((prev) => ({
        ...prev,
        shapes: prev.shapes.map((s) => {
          const shapeUpdates = updates.get(s.id);
          return shapeUpdates ? { ...s, ...shapeUpdates } : s;
        }),
      }), addToHistory, label);
    },
    [setCanvasState]
  );

  const deleteShape = useCallback(
    (id: string) => {
      setCanvasState((prev) => {
        const shape = prev.shapes.find(s => s.id === id);
        if (shape && isShapeLocked(shape, prev.groups)) return prev;
        const newSelectedIds = new Set(prev.selectedShapeIds);
        newSelectedIds.delete(id);
        return {
          ...prev,
          shapes: prev.shapes.filter((s) => s.id !== id),
          selectedShapeIds: newSelectedIds,
        };
      }, true, 'Delete');
    },
    [setCanvasState]
  );

  const deleteSelectedShapes = useCallback(() => {
    setCanvasState((prev) => {
      if (prev.selectedShapeIds.size === 0) return prev;
      const toDelete = prev.shapes.filter(
        (s) => prev.selectedShapeIds.has(s.id) && !isShapeLocked(s, prev.groups)
      );
      if (toDelete.length === 0) return prev;
      const deleteIds = new Set(toDelete.map(s => s.id));
      return {
        ...prev,
        shapes: prev.shapes.filter((s) => !deleteIds.has(s.id)),
        selectedShapeIds: new Set<string>(
          [...prev.selectedShapeIds].filter(id => !deleteIds.has(id))
        ),
      };
    }, true, 'Delete');
  }, [setCanvasState]);

  return {
    addShape,
    duplicateShape,
    duplicateShapes,
    lastDuplicatedIdsRef,
    pendingAnimationIdsRef,
    updateShape,
    updateShapes,
    deleteShape,
    deleteSelectedShapes,
  };
}
