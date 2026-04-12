import { useState, useEffect, useRef } from 'react';
import type { Shape } from '../../types';
import type { DragState } from '../../types/canvas';
import { getShapeDimensions } from '../../utils/shapes';

interface UseShapeDragOptions {
  shapes: Shape[];
  getSVGPoint: (clientX: number, clientY: number) => { x: number; y: number };
  onUpdateShape: (id: string, updates: Partial<Shape>, addToHistory?: boolean) => void;
  onUpdateShapes: (updates: Map<string, Partial<Shape>>, addToHistory?: boolean) => void;
  onCommitToHistory: (label?: string) => void;
}

/**
 * Hook for handling mouse/touch drag state for move/resize/rotate operations
 */
export function useShapeDrag({
  shapes,
  getSVGPoint,
  onUpdateShape,
  onUpdateShapes,
  onCommitToHistory,
}: UseShapeDragOptions) {
  const [dragState, setDragState] = useState<DragState | null>(null);
  // Tracks the visual rotation delta (in degrees) during an active rotate drag.
  // Used by Canvas to dynamically update the rotation cursor icon.
  const [rotationDelta, setRotationDelta] = useState(0);

  // Keep latest values in refs to avoid effect re-registration on every render frame
  const shapesRef = useRef(shapes);
  const getSVGPointRef = useRef(getSVGPoint);
  const onUpdateShapeRef = useRef(onUpdateShape);
  const onUpdateShapesRef = useRef(onUpdateShapes);
  const onCommitToHistoryRef = useRef(onCommitToHistory);
  const dragStateRef = useRef(dragState);
  useEffect(() => {
    shapesRef.current = shapes;
    getSVGPointRef.current = getSVGPoint;
    onUpdateShapeRef.current = onUpdateShape;
    onUpdateShapesRef.current = onUpdateShapes;
    onCommitToHistoryRef.current = onCommitToHistory;
    dragStateRef.current = dragState;
  });

  useEffect(() => {
    if (!dragState || dragState.mode === 'none') return;

    const handleMouseMove = (e: MouseEvent) => {
      const ds = dragStateRef.current;
      if (!ds) return;

      const point = getSVGPointRef.current(e.clientX, e.clientY);

      if (ds.mode === 'move') {
        const dx = point.x - ds.startX;
        const dy = point.y - ds.startY;

        // Move all shapes in startPositions
        if (ds.startPositions && ds.startPositions.size > 1) {
          const updates = new Map<string, Partial<Shape>>();
          ds.startPositions.forEach((startPos, id) => {
            updates.set(id, {
              x: startPos.x + dx,
              y: startPos.y + dy,
            });
          });
          onUpdateShapesRef.current(updates, false);
        } else {
          // Single shape move
          onUpdateShapeRef.current(ds.shapeId, {
            x: ds.startShapeX + dx,
            y: ds.startShapeY + dy,
          }, false);
        }
      } else if (ds.mode === 'resize') {
        // Pure screen-space resize logic
        // We completely ignore rotation/flip - just use where the mouse actually is

        // For multi-select, use the bounds center; for single, use shape center
        const isMulti = !!(ds.startShapeData && ds.startBounds);
        const startW = ds.startWidth ?? ds.startSize;
        const startH = ds.startHeight ?? ds.startSize;
        const centerX = isMulti
          ? ds.startBounds!.x + ds.startBounds!.width / 2
          : ds.startShapeX + startW / 2;
        const centerY = isMulti
          ? ds.startBounds!.y + ds.startBounds!.height / 2
          : ds.startShapeY + startH / 2;

        // Where the drag started (the grabbed corner's screen position)
        const grabX = ds.startX;
        const grabY = ds.startY;

        // Direction from center to grabbed point (this is the "outward" direction)
        const outDirX = grabX - centerX;
        const outDirY = grabY - centerY;
        const outLen = Math.sqrt(outDirX * outDirX + outDirY * outDirY);

        if (outLen < 1) {
          // Grabbed too close to center, skip
          return;
        }

        // Normalize the outward direction
        const unitOutX = outDirX / outLen;
        const unitOutY = outDirY / outLen;

        // Mouse movement since drag start
        const dx = point.x - ds.startX;
        const dy = point.y - ds.startY;

        // Project mouse movement onto the outward direction
        // Positive = moving away from center = enlarge
        // Negative = moving toward center = shrink
        const projection = dx * unitOutX + dy * unitOutY;

        // Shift = resize from center (like toolbar/keyboard resize),
        // otherwise resize from the opposite corner (default drag behavior)
        const resizeFromCenter = e.shiftKey;
        const anchorX = resizeFromCenter ? centerX : centerX - outDirX;
        const anchorY = resizeFromCenter ? centerY : centerY - outDirY;

        // Size change: scale by sqrt(2) because corners are on the diagonal
        const sizeDelta = projection * Math.SQRT2;

        // Multi-select resize
        if (ds.startShapeData && ds.startBounds) {
          const bounds = ds.startBounds;
          const maxDimension = Math.max(bounds.width, bounds.height);
          const scale = Math.max(0.1, (maxDimension + sizeDelta) / maxDimension);

          const updates = new Map<string, Partial<Shape>>();
          ds.startShapeData.forEach((startData, id) => {
            const relX = startData.x - anchorX;
            const relY = startData.y - anchorY;
            const newX = anchorX + relX * scale;
            const newY = anchorY + relY * scale;
            const newSize = Math.max(10, startData.size * scale);

            updates.set(id, { x: newX, y: newY, size: newSize });
          });
          onUpdateShapesRef.current(updates, false);
        } else {
          // Single shape resize
          const newSize = Math.max(10, ds.startSize + sizeDelta);

          // Keep anchor fixed, scale the center position relative to anchor
          const ratio = newSize / ds.startSize;
          const newCenterX = anchorX + (centerX - anchorX) * ratio;
          const newCenterY = anchorY + (centerY - anchorY) * ratio;

          // Convert center to top-left using actual dimensions (scale proportionally)
          const newW = startW * ratio;
          const newH = startH * ratio;
          const newX = newCenterX - newW / 2;
          const newY = newCenterY - newH / 2;

          onUpdateShapeRef.current(ds.shapeId, {
            size: newSize,
            x: newX,
            y: newY,
          }, false);
        }
      } else if (ds.mode === 'rotate') {
        // Multi-select rotate
        if (ds.startShapeData && ds.startBounds) {
          const bounds = ds.startBounds;
          const centerX = bounds.x + bounds.width / 2;
          const centerY = bounds.y + bounds.height / 2;

          const startAngle = Math.atan2(
            ds.startY - centerY,
            ds.startX - centerX
          );
          const currentAngle = Math.atan2(point.y - centerY, point.x - centerX);

          // For group rotation, use raw angle delta for position changes
          let angleDelta = ((currentAngle - startAngle) * 180) / Math.PI;

          if (e.shiftKey) {
            angleDelta = Math.round(angleDelta / 15) * 15;
          }

          const updates = new Map<string, Partial<Shape>>();
          ds.startShapeData.forEach((startData, id) => {
            // Find the actual shape to check its flip state
            const shape = shapesRef.current.find(s => s.id === id);
            const shapeFlipX = shape?.flipX ?? false;
            const shapeFlipY = shape?.flipY ?? false;

            // Rotate position around the center of the bounding box (same for all shapes)
            // Use actual shape dimensions (not size×size) to find the true visual center
            const halfW = startData.width / 2;
            const halfH = startData.height / 2;
            const shapeCenter = {
              x: startData.x + halfW,
              y: startData.y + halfH,
            };
            const relX = shapeCenter.x - centerX;
            const relY = shapeCenter.y - centerY;
            const angleRad = (angleDelta * Math.PI) / 180;
            const rotatedX = relX * Math.cos(angleRad) - relY * Math.sin(angleRad);
            const rotatedY = relX * Math.sin(angleRad) + relY * Math.cos(angleRad);
            const newCenterX = centerX + rotatedX;
            const newCenterY = centerY + rotatedY;

            // For the shape's own rotation value, mirrored shapes need inverted delta
            // to visually rotate the same direction as non-mirrored shapes
            const shapeFlipInverts = (shapeFlipX ? 1 : 0) ^ (shapeFlipY ? 1 : 0);
            const shapeRotationDelta = shapeFlipInverts ? -angleDelta : angleDelta;

            updates.set(id, {
              x: newCenterX - halfW,
              y: newCenterY - halfH,
              rotation: startData.rotation + shapeRotationDelta,
            });
          });
          onUpdateShapesRef.current(updates, false);
          setRotationDelta(angleDelta);
        } else {
          // Single shape rotate
          const draggedShape = shapesRef.current.find((s) => s.id === ds.shapeId);
          if (!draggedShape) return;

          const rotDims = getShapeDimensions(draggedShape.type, draggedShape.size);
          const centerX = draggedShape.x + rotDims.width / 2;
          const centerY = draggedShape.y + rotDims.height / 2;

          const startAngle = Math.atan2(
            ds.startY - centerY,
            ds.startX - centerX
          );
          const currentAngle = Math.atan2(point.y - centerY, point.x - centerX);

          // For single shape, mirrored shapes need inverted rotation to match visual drag direction
          const flipInvertsRotation = (ds.flipX ? 1 : 0) ^ (ds.flipY ? 1 : 0);
          const rotationMult = flipInvertsRotation ? -1 : 1;

          const rawAngleDelta = ((currentAngle - startAngle) * 180) / Math.PI;
          const angleDelta = rawAngleDelta * rotationMult;
          let newRotation = ds.startRotation + angleDelta;

          if (e.shiftKey) {
            newRotation = Math.round(newRotation / 15) * 15;
          }

          onUpdateShapeRef.current(ds.shapeId, { rotation: newRotation }, false);
          setRotationDelta(rawAngleDelta);
        }
      }
    };

    const handleMouseUp = () => {
      const ds = dragStateRef.current;
      if (ds) {
        const label = ds.mode === 'move' ? 'Move'
          : ds.mode === 'resize' ? 'Resize'
          : ds.mode === 'rotate' ? 'Rotate'
          : undefined;
        onCommitToHistoryRef.current(label);
      }
      setDragState(null);
      setRotationDelta(0);
    };

    const handleTouchMove = (e: TouchEvent) => {
      const ds = dragStateRef.current;
      if (!ds || e.touches.length !== 1) return;
      e.preventDefault();

      const touch = e.touches[0];
      const point = getSVGPointRef.current(touch.clientX, touch.clientY);

      if (ds.mode === 'move') {
        const dx = point.x - ds.startX;
        const dy = point.y - ds.startY;

        if (ds.startPositions && ds.startPositions.size > 1) {
          const updates = new Map<string, Partial<Shape>>();
          ds.startPositions.forEach((startPos, id) => {
            updates.set(id, {
              x: startPos.x + dx,
              y: startPos.y + dy,
            });
          });
          onUpdateShapesRef.current(updates, false);
        } else {
          onUpdateShapeRef.current(ds.shapeId, {
            x: ds.startShapeX + dx,
            y: ds.startShapeY + dy,
          }, false);
        }
      } else if (ds.mode === 'resize') {
        const isMulti = !!(ds.startShapeData && ds.startBounds);
        const tStartW = ds.startWidth ?? ds.startSize;
        const tStartH = ds.startHeight ?? ds.startSize;
        const centerX = isMulti
          ? ds.startBounds!.x + ds.startBounds!.width / 2
          : ds.startShapeX + tStartW / 2;
        const centerY = isMulti
          ? ds.startBounds!.y + ds.startBounds!.height / 2
          : ds.startShapeY + tStartH / 2;
        const grabX = ds.startX;
        const grabY = ds.startY;
        const outDirX = grabX - centerX;
        const outDirY = grabY - centerY;
        const outLen = Math.sqrt(outDirX * outDirX + outDirY * outDirY);

        if (outLen < 1) return;

        const unitOutX = outDirX / outLen;
        const unitOutY = outDirY / outLen;
        const dx = point.x - ds.startX;
        const dy = point.y - ds.startY;
        const projection = dx * unitOutX + dy * unitOutY;
        const anchorX = centerX - outDirX;
        const anchorY = centerY - outDirY;
        const sizeDelta = projection * Math.SQRT2;

        if (ds.startShapeData && ds.startBounds) {
          const bounds = ds.startBounds;
          const maxDimension = Math.max(bounds.width, bounds.height);
          const scale = Math.max(0.1, (maxDimension + sizeDelta) / maxDimension);

          const updates = new Map<string, Partial<Shape>>();
          ds.startShapeData.forEach((startData, id) => {
            const relX = startData.x - anchorX;
            const relY = startData.y - anchorY;
            const newX = anchorX + relX * scale;
            const newY = anchorY + relY * scale;
            const newSize = Math.max(10, startData.size * scale);
            updates.set(id, { x: newX, y: newY, size: newSize });
          });
          onUpdateShapesRef.current(updates, false);
        } else {
          const newSize = Math.max(10, ds.startSize + sizeDelta);
          const ratio = newSize / ds.startSize;
          const newCenterX = anchorX + (centerX - anchorX) * ratio;
          const newCenterY = anchorY + (centerY - anchorY) * ratio;
          const newW = tStartW * ratio;
          const newH = tStartH * ratio;
          const newX = newCenterX - newW / 2;
          const newY = newCenterY - newH / 2;
          onUpdateShapeRef.current(ds.shapeId, { size: newSize, x: newX, y: newY }, false);
        }
      } else if (ds.mode === 'rotate') {
        if (ds.startShapeData && ds.startBounds) {
          const bounds = ds.startBounds;
          const centerX = bounds.x + bounds.width / 2;
          const centerY = bounds.y + bounds.height / 2;

          const startAngle = Math.atan2(ds.startY - centerY, ds.startX - centerX);
          const currentAngle = Math.atan2(point.y - centerY, point.x - centerX);
          const angleDelta = ((currentAngle - startAngle) * 180) / Math.PI;

          const updates = new Map<string, Partial<Shape>>();
          ds.startShapeData.forEach((startData, id) => {
            const shape = shapesRef.current.find(s => s.id === id);
            const shapeFlipX = shape?.flipX ?? false;
            const shapeFlipY = shape?.flipY ?? false;

            const halfW = startData.width / 2;
            const halfH = startData.height / 2;
            const shapeCenter = {
              x: startData.x + halfW,
              y: startData.y + halfH,
            };
            const relX = shapeCenter.x - centerX;
            const relY = shapeCenter.y - centerY;
            const angleRad = (angleDelta * Math.PI) / 180;
            const cos = Math.cos(angleRad);
            const sin = Math.sin(angleRad);
            const rotatedX = relX * cos - relY * sin;
            const rotatedY = relX * sin + relY * cos;
            const newCenterX = centerX + rotatedX;
            const newCenterY = centerY + rotatedY;

            const shapeFlipInverts = (shapeFlipX ? 1 : 0) ^ (shapeFlipY ? 1 : 0);
            const shapeRotationDelta = shapeFlipInverts ? -angleDelta : angleDelta;

            updates.set(id, {
              x: newCenterX - halfW,
              y: newCenterY - halfH,
              rotation: startData.rotation + shapeRotationDelta,
            });
          });
          onUpdateShapesRef.current(updates, false);
        } else {
          const draggedShape = shapesRef.current.find((s) => s.id === ds.shapeId);
          if (!draggedShape) return;

          const tRotDims = getShapeDimensions(draggedShape.type, draggedShape.size);
          const centerX = draggedShape.x + tRotDims.width / 2;
          const centerY = draggedShape.y + tRotDims.height / 2;

          const startAngle = Math.atan2(ds.startY - centerY, ds.startX - centerX);
          const currentAngle = Math.atan2(point.y - centerY, point.x - centerX);

          const flipInvertsRotation = (ds.flipX ? 1 : 0) ^ (ds.flipY ? 1 : 0);
          const rotationMult = flipInvertsRotation ? -1 : 1;

          const angleDelta = ((currentAngle - startAngle) * 180) / Math.PI * rotationMult;
          const newRotation = ds.startRotation + angleDelta;

          onUpdateShapeRef.current(ds.shapeId, { rotation: newRotation }, false);
        }
      }
    };

    const handleTouchEnd = () => {
      const ds = dragStateRef.current;
      if (ds) {
        const label = ds.mode === 'move' ? 'Move'
          : ds.mode === 'resize' ? 'Resize'
          : ds.mode === 'rotate' ? 'Rotate'
          : undefined;
        onCommitToHistoryRef.current(label);
      }
      setDragState(null);
      setRotationDelta(0);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);
    window.addEventListener('touchcancel', handleTouchEnd);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [dragState]);

  return { dragState, setDragState, rotationDelta };
}
