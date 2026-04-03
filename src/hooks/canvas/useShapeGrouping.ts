import { useCallback } from 'react';
import type { ShapeGroup, CanvasState } from '../../types';
import { generateId } from '../../utils/shapes';

type SetCanvasState = (
  updater: CanvasState | ((prev: CanvasState) => CanvasState),
  addToHistory?: boolean,
  label?: string
) => void;

export function useShapeGrouping(setCanvasState: SetCanvasState) {
  const createGroup = useCallback(
    (shapeIds: string[], groupName?: string) => {
      if (shapeIds.length === 0) return;

      setCanvasState((prev) => {
        const existingGroupNumbers = prev.groups
          .map((g) => {
            const match = g.name.match(/^Group (\d+)$/);
            return match ? parseInt(match[1], 10) : 0;
          })
          .filter((n) => n > 0);
        const nextNumber = existingGroupNumbers.length > 0 ? Math.max(...existingGroupNumbers) + 1 : 1;
        const name = groupName || `Group ${nextNumber}`;

        const maxGroupZIndex = prev.groups.length > 0
          ? Math.max(...prev.groups.map((g) => g.zIndex))
          : 0;

        const newGroup: ShapeGroup = {
          id: generateId(),
          name,
          isCollapsed: false,
          zIndex: maxGroupZIndex + 1,
        };

        let newShapes = prev.shapes.map((s) =>
          shapeIds.includes(s.id) ? { ...s, groupId: newGroup.id } : s
        );

        const groupShapes = newShapes
          .filter((s) => s.groupId === newGroup.id)
          .sort((a, b) => a.zIndex - b.zIndex);
        const otherShapes = newShapes
          .filter((s) => s.groupId !== newGroup.id)
          .sort((a, b) => a.zIndex - b.zIndex);

        const maxSelectedZIndex = Math.max(...groupShapes.map((s) => s.zIndex));

        const shapesBelow = otherShapes.filter((s) => s.zIndex < maxSelectedZIndex);
        const shapesAbove = otherShapes.filter((s) => s.zIndex > maxSelectedZIndex);

        const reordered = [...shapesBelow, ...groupShapes, ...shapesAbove];
        newShapes = newShapes.map((shape) => ({
          ...shape,
          zIndex: reordered.findIndex((s) => s.id === shape.id),
        }));

        return {
          ...prev,
          shapes: newShapes,
          groups: [...prev.groups, newGroup],
        };
      }, true, 'Group');
    },
    [setCanvasState]
  );

  const deleteGroup = useCallback(
    (groupId: string) => {
      setCanvasState((prev) => {
        const newShapes = prev.shapes.filter((s) => s.groupId !== groupId);
        const newGroups = prev.groups.filter((g) => g.id !== groupId);
        return { ...prev, shapes: newShapes, groups: newGroups };
      }, true, 'Delete group');
    },
    [setCanvasState]
  );

  const ungroupShapes = useCallback(
    (shapeIds: string[]) => {
      setCanvasState((prev) => {
        const affectedGroupIds = new Set<string>();
        for (const shape of prev.shapes) {
          if (shapeIds.includes(shape.id) && shape.groupId) {
            affectedGroupIds.add(shape.groupId);
          }
        }

        let newShapes = prev.shapes.map((s) =>
          shapeIds.includes(s.id) ? { ...s, groupId: undefined } : s
        );

        const ungroupedShapeIds = new Set(shapeIds);
        const ungroupedShapes = newShapes
          .filter((s) => ungroupedShapeIds.has(s.id))
          .sort((a, b) => a.zIndex - b.zIndex);
        const otherShapes = newShapes
          .filter((s) => !ungroupedShapeIds.has(s.id))
          .sort((a, b) => a.zIndex - b.zIndex);

        const maxUngroupedZ = Math.max(...ungroupedShapes.map((s) => s.zIndex));
        const insertIndex = otherShapes.filter((s) => s.zIndex <= maxUngroupedZ).length;

        const reordered = [
          ...otherShapes.slice(0, insertIndex),
          ...ungroupedShapes,
          ...otherShapes.slice(insertIndex),
        ];
        newShapes = newShapes.map((shape) => ({
          ...shape,
          zIndex: reordered.findIndex((s) => s.id === shape.id),
        }));

        const groupsToRemove = new Set<string>();
        for (const gId of affectedGroupIds) {
          const remainingShapesInGroup = newShapes.filter((s) => s.groupId === gId);
          if (remainingShapesInGroup.length === 0) {
            groupsToRemove.add(gId);
          }
        }

        const newGroups = prev.groups.filter((g) => !groupsToRemove.has(g.id));

        return { ...prev, shapes: newShapes, groups: newGroups };
      }, true, 'Ungroup');
    },
    [setCanvasState]
  );

  const renameGroup = useCallback(
    (groupId: string, newName: string) => {
      setCanvasState((prev) => ({
        ...prev,
        groups: prev.groups.map((g) =>
          g.id === groupId ? { ...g, name: newName } : g
        ),
      }), true, 'Rename group');
    },
    [setCanvasState]
  );

  const toggleGroupCollapsed = useCallback(
    (groupId: string) => {
      setCanvasState((prev) => ({
        ...prev,
        groups: prev.groups.map((g) =>
          g.id === groupId ? { ...g, isCollapsed: !g.isCollapsed } : g
        ),
      }), false);
    },
    [setCanvasState]
  );

  const toggleShapeVisibility = useCallback(
    (id: string) => {
      setCanvasState((prev) => ({
        ...prev,
        shapes: prev.shapes.map((s) =>
          s.id === id ? { ...s, visible: s.visible === false ? undefined : false } : s
        ),
      }), true, 'Toggle visibility');
    },
    [setCanvasState]
  );

  const toggleGroupVisibility = useCallback(
    (groupId: string) => {
      setCanvasState((prev) => ({
        ...prev,
        groups: prev.groups.map((g) =>
          g.id === groupId ? { ...g, visible: g.visible === false ? undefined : false } : g
        ),
      }), true, 'Toggle visibility');
    },
    [setCanvasState]
  );

  const toggleShapeLock = useCallback(
    (id: string) => {
      setCanvasState((prev) => {
        // If the shape's group is locked, don't allow toggling individual shape lock
        const shape = prev.shapes.find(s => s.id === id);
        if (shape?.groupId) {
          const group = prev.groups.find(g => g.id === shape.groupId);
          if (group?.locked) return prev;
        }
        const newLocked = shape?.locked ? false : true;
        return {
          ...prev,
          shapes: prev.shapes.map((s) =>
            s.id === id ? { ...s, locked: newLocked } : s
          ),
          // Deselect shape when locking
          selectedShapeIds: newLocked
            ? new Set([...prev.selectedShapeIds].filter(sid => sid !== id))
            : prev.selectedShapeIds,
        };
      }, true, 'Toggle lock');
    },
    [setCanvasState]
  );

  const toggleGroupLock = useCallback(
    (groupId: string) => {
      setCanvasState((prev) => {
        const group = prev.groups.find(g => g.id === groupId);
        const newLocked = group?.locked ? false : true;
        const shapeIdsInGroup = new Set(
          prev.shapes.filter(s => s.groupId === groupId).map(s => s.id)
        );
        return {
          ...prev,
          groups: prev.groups.map((g) =>
            g.id === groupId ? { ...g, locked: newLocked } : g
          ),
          // Deselect shapes in group when locking
          selectedShapeIds: newLocked
            ? new Set([...prev.selectedShapeIds].filter(id => !shapeIdsInGroup.has(id)))
            : prev.selectedShapeIds,
        };
      }, true, 'Toggle lock');
    },
    [setCanvasState]
  );

  const moveToGroup = useCallback(
    (shapeIds: string[], groupId: string | null) => {
      setCanvasState((prev) => {
        const newShapes = prev.shapes.map((s) =>
          shapeIds.includes(s.id) ? { ...s, groupId: groupId || undefined } : s
        );

        const groupsWithShapes = new Set<string>();
        for (const shape of newShapes) {
          if (shape.groupId) {
            groupsWithShapes.add(shape.groupId);
          }
        }

        const newGroups = prev.groups.filter((g) => groupsWithShapes.has(g.id));

        return { ...prev, shapes: newShapes, groups: newGroups };
      }, true, 'Move to group');
    },
    [setCanvasState]
  );

  const selectGroup = useCallback(
    (groupId: string, options?: { toggle?: boolean }) => {
      const { toggle = false } = options || {};
      setCanvasState((prev) => {
        const shapeIdsInGroup = prev.shapes
          .filter((s) => s.groupId === groupId)
          .map((s) => s.id);

        if (toggle) {
          const newSelectedIds = new Set(prev.selectedShapeIds);
          const allAlreadySelected = shapeIdsInGroup.every((id) => newSelectedIds.has(id));

          if (allAlreadySelected) {
            for (const id of shapeIdsInGroup) {
              newSelectedIds.delete(id);
            }
          } else {
            for (const id of shapeIdsInGroup) {
              newSelectedIds.add(id);
            }
          }

          return { ...prev, selectedShapeIds: newSelectedIds };
        }

        return { ...prev, selectedShapeIds: new Set(shapeIdsInGroup) };
      }, false);
    },
    [setCanvasState]
  );

  return {
    createGroup,
    deleteGroup,
    ungroupShapes,
    renameGroup,
    toggleGroupCollapsed,
    toggleShapeVisibility,
    toggleGroupVisibility,
    toggleShapeLock,
    toggleGroupLock,
    moveToGroup,
    selectGroup,
  };
}
