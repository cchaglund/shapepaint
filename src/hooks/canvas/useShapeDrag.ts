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

  // Keep latest values in refs to avoid effect re-registration on every render frame
  const shapesRef = useRef(shapes);
  shapesRef.current = shapes;
  const getSVGPointRef = useRef(getSVGPoint);
  getSVGPointRef.current = getSVGPoint;
  const onUpdateShapeRef = useRef(onUpdateShape);
  onUpdateShapeRef.current = onUpdateShape;
  const onUpdateShapesRef = useRef(onUpdateShapes);
  onUpdateShapesRef.current = onUpdateShapes;
  const onCommitToHistoryRef = useRef(onCommitToHistory);
  onCommitToHistoryRef.current = onCommitToHistory;
  const dragStateRef = useRef(dragState);
  dragStateRef.current = dragState;

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

        // Shape center in screen space (use actual rendered dimensions)
        const startW = ds.startWidth ?? ds.startSize;
        const startH = ds.startHeight ?? ds.startSize;
        const centerX = ds.startShapeX + startW / 2;
        const centerY = ds.startShapeY + startH / 2;

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

        // The anchor is the point opposite the grabbed corner (through center)
        const anchorX = centerX - outDirX;
        const anchorY = centerY - outDirY;

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
            const newSize = Math.max(20, startData.size * scale);

            updates.set(id, { x: newX, y: newY, size: newSize });
          });
          onUpdateShapesRef.current(updates, false);
        } else {
          // Single shape resize
          const newSize = Math.max(20, ds.startSize + sizeDelta);

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

          const angleDelta = ((currentAngle - startAngle) * 180) / Math.PI * rotationMult;
          let newRotation = ds.startRotation + angleDelta;

          if (e.shiftKey) {
            newRotation = Math.round(newRotation / 15) * 15;
          }

          onUpdateShapeRef.current(ds.shapeId, { rotation: newRotation }, false);
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
        const tStartW = ds.startWidth ?? ds.startSize;
        const tStartH = ds.startHeight ?? ds.startSize;
        const centerX = ds.startShapeX + tStartW / 2;
        const centerY = ds.startShapeY + tStartH / 2;
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
            const newSize = Math.max(20, startData.size * scale);
            updates.set(id, { x: newX, y: newY, size: newSize });
          });
          onUpdateShapesRef.current(updates, false);
        } else {
          const newSize = Math.max(20, ds.startSize + sizeDelta);
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
    // Only re-register listeners when a drag starts/stops, not on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragState]);

  return { dragState, setDragState };
}
