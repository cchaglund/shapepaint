import { useState, useEffect, useCallback, useRef } from 'react';
import type { Shape, ShapeGroup } from '../../types';
import { getVisibleShapes, isShapeLocked } from '../../utils/visibility';
import { shapeIntersectsRect } from '../../utils/shapeBounds';

export interface MarqueeState {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

/** Minimum drag distance (in SVG units) before we treat it as a marquee vs a click. */
const DRAG_THRESHOLD = 3;

interface UseMarqueeSelectionOptions {
  shapes: Shape[];
  groups: ShapeGroup[];
  getSVGPoint: (clientX: number, clientY: number) => { x: number; y: number };
  isSpacePressed: boolean;
  onSelectShapes: (ids: string[], options?: { additive?: boolean }) => void;
  onSelectShape: (id: string | null) => void;
}

export function useMarqueeSelection({
  shapes,
  groups,
  getSVGPoint,
  isSpacePressed,
  onSelectShapes,
  onSelectShape,
}: UseMarqueeSelectionOptions) {
  const [marqueeState, setMarqueeState] = useState<MarqueeState | null>(null);
  const marqueeRef = useRef<MarqueeState | null>(null);
  const activeRef = useRef(false);

  // Keep refs to latest callbacks/data for use in window listeners.
  const shapesRef = useRef(shapes);
  const groupsRef = useRef(groups);
  const getSVGPointRef = useRef(getSVGPoint);
  const onSelectShapesRef = useRef(onSelectShapes);
  const onSelectShapeRef = useRef(onSelectShape);
  shapesRef.current = shapes;
  groupsRef.current = groups;
  getSVGPointRef.current = getSVGPoint;
  onSelectShapesRef.current = onSelectShapes;
  onSelectShapeRef.current = onSelectShape;

  const getIntersectingIds = useCallback(
    (rect: { minX: number; minY: number; maxX: number; maxY: number }) => {
      const visible = getVisibleShapes(shapesRef.current, groupsRef.current);
      const ids: string[] = [];
      for (const shape of visible) {
        if (isShapeLocked(shape, groupsRef.current)) continue;
        if (shapeIntersectsRect(shape, rect)) {
          ids.push(shape.id);
        }
      }
      return ids;
    },
    []
  );

  const startMarqueeAt = useCallback(
    (clientX: number, clientY: number) => {
      if (isSpacePressed) return;
      const point = getSVGPoint(clientX, clientY);
      const state: MarqueeState = {
        startX: point.x,
        startY: point.y,
        currentX: point.x,
        currentY: point.y,
      };
      marqueeRef.current = state;
      activeRef.current = true;
      setMarqueeState(state);
    },
    [isSpacePressed, getSVGPoint]
  );

  // Attach window-level listeners while marquee is active.
  useEffect(() => {
    if (!activeRef.current || !marqueeState) return;

    const handleMouseMove = (e: MouseEvent) => {
      const prev = marqueeRef.current;
      if (!prev) return;
      const point = getSVGPointRef.current(e.clientX, e.clientY);
      const updated: MarqueeState = { ...prev, currentX: point.x, currentY: point.y };
      marqueeRef.current = updated;
      setMarqueeState(updated);

      // Live preview: update selection during drag.
      const dx = Math.abs(updated.currentX - updated.startX);
      const dy = Math.abs(updated.currentY - updated.startY);
      if (dx >= DRAG_THRESHOLD || dy >= DRAG_THRESHOLD) {
        const rect = {
          minX: Math.min(updated.startX, updated.currentX),
          minY: Math.min(updated.startY, updated.currentY),
          maxX: Math.max(updated.startX, updated.currentX),
          maxY: Math.max(updated.startY, updated.currentY),
        };
        onSelectShapesRef.current(getIntersectingIds(rect), { additive: e.shiftKey });
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      const prev = marqueeRef.current;
      if (!prev) return;

      const dx = Math.abs(prev.currentX - prev.startX);
      const dy = Math.abs(prev.currentY - prev.startY);
      if (dx < DRAG_THRESHOLD && dy < DRAG_THRESHOLD) {
        // Tiny drag = click-to-deselect.
        onSelectShapeRef.current(null);
      } else {
        // Final selection.
        const rect = {
          minX: Math.min(prev.startX, prev.currentX),
          minY: Math.min(prev.startY, prev.currentY),
          maxX: Math.max(prev.startX, prev.currentX),
          maxY: Math.max(prev.startY, prev.currentY),
        };
        onSelectShapesRef.current(getIntersectingIds(rect), { additive: e.shiftKey });
      }

      marqueeRef.current = null;
      activeRef.current = false;
      setMarqueeState(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
    // Only re-attach when marquee becomes active/inactive.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marqueeState !== null]);

  return { marqueeState, startMarqueeAt };
}
