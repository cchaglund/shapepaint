import { useCallback } from 'react';
import type { Shape, CanvasState } from '../../types';
import { getShapeAABB } from '../../utils/shapeBounds';
import { getShapeDimensions } from '../../utils/shapes';

type SetCanvasState = (
  updater: CanvasState | ((prev: CanvasState) => CanvasState),
  addToHistory?: boolean,
  label?: string
) => void;

function normalizeZIndices(shapes: Shape[]): Shape[] {
  const sorted = [...shapes].sort(
    (a, b) => a.zIndex - b.zIndex || a.id.localeCompare(b.id)
  );
  return shapes.map((shape) => ({
    ...shape,
    zIndex: sorted.findIndex((s) => s.id === shape.id),
  }));
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

  const moveLayer = useCallback(
    (id: string, direction: 'up' | 'down' | 'top' | 'bottom') => {
      setCanvasState((prev) => {
        const sortedByZ = [...prev.shapes].sort((a, b) => a.zIndex - b.zIndex);
        const currentIndex = sortedByZ.findIndex((s) => s.id === id);
        if (currentIndex === -1) return prev;

        let newShapes: Shape[];

        if (direction === 'up' && currentIndex < sortedByZ.length - 1) {
          newShapes = prev.shapes.map((s) => {
            if (s.id === id) {
              return { ...s, zIndex: sortedByZ[currentIndex + 1].zIndex };
            }
            if (s.id === sortedByZ[currentIndex + 1].id) {
              return { ...s, zIndex: sortedByZ[currentIndex].zIndex };
            }
            return s;
          });
        } else if (direction === 'down' && currentIndex > 0) {
          newShapes = prev.shapes.map((s) => {
            if (s.id === id) {
              return { ...s, zIndex: sortedByZ[currentIndex - 1].zIndex };
            }
            if (s.id === sortedByZ[currentIndex - 1].id) {
              return { ...s, zIndex: sortedByZ[currentIndex].zIndex };
            }
            return s;
          });
        } else if (direction === 'top' && currentIndex < sortedByZ.length - 1) {
          const maxZ = sortedByZ[sortedByZ.length - 1].zIndex;
          newShapes = prev.shapes.map((s) =>
            s.id === id ? { ...s, zIndex: maxZ + 1 } : s
          );
        } else if (direction === 'bottom' && currentIndex > 0) {
          const minZ = sortedByZ[0].zIndex;
          newShapes = prev.shapes.map((s) =>
            s.id === id ? { ...s, zIndex: minZ - 1 } : s
          );
        } else {
          return prev;
        }

        return { ...prev, shapes: newShapes };
      }, true, 'Reorder');
    },
    [setCanvasState]
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

  const moveGroup = useCallback(
    (groupId: string, direction: 'up' | 'down' | 'top' | 'bottom') => {
      setCanvasState((prev) => {
        const group = prev.groups.find((g) => g.id === groupId);
        if (!group) return prev;

        const shapesInGroup = prev.shapes.filter((s) => s.groupId === groupId);
        if (shapesInGroup.length === 0) return prev;

        const groupMaxZ = Math.max(...shapesInGroup.map((s) => s.zIndex));
        const groupMinZ = Math.min(...shapesInGroup.map((s) => s.zIndex));

        type TopLevelItem =
          | { type: 'group'; groupId: string; maxZIndex: number; minZIndex: number }
          | { type: 'ungrouped-shape'; shapeId: string; zIndex: number };

        const topLevelItems: TopLevelItem[] = [];

        for (const g of prev.groups) {
          const gShapes = prev.shapes.filter((s) => s.groupId === g.id);
          if (gShapes.length === 0) continue;
          const maxZ = Math.max(...gShapes.map((s) => s.zIndex));
          const minZ = Math.min(...gShapes.map((s) => s.zIndex));
          topLevelItems.push({ type: 'group', groupId: g.id, maxZIndex: maxZ, minZIndex: minZ });
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
          (item) => item.type === 'group' && item.groupId === groupId
        );
        if (currentIndex === -1) return prev;

        let newShapes = prev.shapes;

        if (direction === 'up' && currentIndex > 0) {
          const itemAbove = topLevelItems[currentIndex - 1];
          if (itemAbove.type === 'group') {
            const aboveMaxZ = itemAbove.maxZIndex;
            const aboveMinZ = itemAbove.minZIndex;
            const groupRange = groupMaxZ - groupMinZ;
            const aboveRange = aboveMaxZ - aboveMinZ;

            newShapes = prev.shapes.map((s) => {
              if (s.groupId === groupId) {
                const offset = s.zIndex - groupMinZ;
                return { ...s, zIndex: aboveMaxZ - groupRange + offset + aboveRange + 1 };
              }
              if (s.groupId === itemAbove.groupId) {
                const offset = s.zIndex - aboveMinZ;
                return { ...s, zIndex: groupMinZ + offset };
              }
              return s;
            });
          } else {
            const shapeAboveZ = itemAbove.zIndex;
            const zDiff = shapeAboveZ - groupMaxZ;
            newShapes = prev.shapes.map((s) => {
              if (s.groupId === groupId) {
                return { ...s, zIndex: s.zIndex + zDiff + 1 };
              }
              if (s.id === itemAbove.shapeId) {
                return { ...s, zIndex: groupMinZ - 1 };
              }
              return s;
            });
          }
        } else if (direction === 'down' && currentIndex < topLevelItems.length - 1) {
          const itemBelow = topLevelItems[currentIndex + 1];
          if (itemBelow.type === 'group') {
            const belowMaxZ = itemBelow.maxZIndex;
            const belowMinZ = itemBelow.minZIndex;
            const groupRange = groupMaxZ - groupMinZ;
            const belowRange = belowMaxZ - belowMinZ;

            newShapes = prev.shapes.map((s) => {
              if (s.groupId === groupId) {
                const offset = s.zIndex - groupMinZ;
                return { ...s, zIndex: belowMinZ + offset };
              }
              if (s.groupId === itemBelow.groupId) {
                const offset = s.zIndex - belowMinZ;
                return { ...s, zIndex: groupMaxZ - belowRange + offset + groupRange + 1 };
              }
              return s;
            });
          } else {
            const shapeBelowZ = itemBelow.zIndex;
            const zDiff = groupMinZ - shapeBelowZ;
            newShapes = prev.shapes.map((s) => {
              if (s.groupId === groupId) {
                return { ...s, zIndex: s.zIndex - zDiff - 1 };
              }
              if (s.id === itemBelow.shapeId) {
                return { ...s, zIndex: groupMaxZ + 1 };
              }
              return s;
            });
          }
        } else if (direction === 'top' && currentIndex > 0) {
          const groupShapes = prev.shapes
            .filter((s) => s.groupId === groupId)
            .sort((a, b) => a.zIndex - b.zIndex);
          const otherShapes = prev.shapes
            .filter((s) => s.groupId !== groupId)
            .sort((a, b) => a.zIndex - b.zIndex);
          const reordered = [...otherShapes, ...groupShapes];
          newShapes = prev.shapes.map((shape) => ({
            ...shape,
            zIndex: reordered.findIndex((s) => s.id === shape.id),
          }));
        } else if (direction === 'bottom' && currentIndex < topLevelItems.length - 1) {
          const groupShapes = prev.shapes
            .filter((s) => s.groupId === groupId)
            .sort((a, b) => a.zIndex - b.zIndex);
          const otherShapes = prev.shapes
            .filter((s) => s.groupId !== groupId)
            .sort((a, b) => a.zIndex - b.zIndex);
          const reordered = [...groupShapes, ...otherShapes];
          newShapes = prev.shapes.map((shape) => ({
            ...shape,
            zIndex: reordered.findIndex((s) => s.id === shape.id),
          }));
        } else {
          return prev;
        }

        newShapes = normalizeZIndices(newShapes);

        return { ...prev, shapes: newShapes };
      }, true, 'Reorder');
    },
    [setCanvasState]
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
    reorderLayers,
    reorderGroup,
    setBackgroundColor,
    mirrorHorizontal,
    mirrorVertical,
  };
}
