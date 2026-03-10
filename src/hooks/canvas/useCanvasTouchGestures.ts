import { useRef, useCallback, useState } from 'react';
import type { Shape, ShapeGroup, ViewportState } from '../../types';
import type { TouchState, ContextMenuState } from '../../types/canvas';
import { LONG_PRESS_DURATION, TAP_THRESHOLD, CANVAS_SIZE } from '../../types/canvas';
import { getShapeDimensions } from '../../utils/shapes';
import { isShapeVisible } from '../../utils/visibility';

interface UseCanvasTouchGesturesOptions {
  shapes: Shape[];
  groups: ShapeGroup[];
  selectedShapes: Shape[];
  selectedShapeIds: Set<string>;
  viewport: ViewportState;
  svgRef: React.RefObject<SVGSVGElement | null>;
  onSelectShape: (id: string | null, options?: { toggle?: boolean; range?: boolean; orderedIds?: string[] }) => void;
  onUpdateShape: (id: string, updates: Partial<Shape>) => void;
  onUpdateShapes: (updates: Map<string, Partial<Shape>>) => void;
  onPan: (panX: number, panY: number) => void;
  onSetZoomAtPoint: (startZoom: number, scale: number, centerX: number, centerY: number, startPanX: number, startPanY: number) => void;
  getSVGPoint: (clientX: number, clientY: number) => { x: number; y: number };
  getClientPoint: (clientX: number, clientY: number) => { x: number; y: number };
}

/**
 * Hook for handling multi-touch gestures (pinch, rotate, pan)
 */
export function useCanvasTouchGestures({
  shapes,
  groups,
  selectedShapes,
  selectedShapeIds,
  viewport,
  svgRef,
  onSelectShape,
  onUpdateShape,
  onUpdateShapes,
  onPan,
  onSetZoomAtPoint,
  getSVGPoint,
  getClientPoint,
}: UseCanvasTouchGesturesOptions) {
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    isOpen: false,
    x: 0,
    y: 0,
    shapeId: null,
  });

  const touchStateRef = useRef<TouchState>({
    startPoint: null,
    currentPoint: null,
    touchedShapeId: null,
    isDragging: false,
    hasMoved: false,
    longPressTimer: null,
    isLongPress: false,
    isMultiTouch: false,
    startDistance: 0,
    startAngle: 0,
    startCenter: { x: 0, y: 0 },
    startShapeData: null,
    startZoom: 1,
    startPanX: 0,
    startPanY: 0,
  });

  // Helper to get touch point in SVG coordinates
  const getTouchSVGPoint = useCallback(
    (touch: React.Touch | Touch) => {
      const svgPoint = getSVGPoint(touch.clientX, touch.clientY);
      return {
        ...svgPoint,
        clientX: touch.clientX,
        clientY: touch.clientY,
      };
    },
    [getSVGPoint]
  );

  // Helper to get distance between two touches
  const getTouchDistance = useCallback((t1: React.Touch | Touch, t2: React.Touch | Touch) => {
    const dx = t2.clientX - t1.clientX;
    const dy = t2.clientY - t1.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }, []);

  // Helper to get angle between two touches
  const getTouchAngle = useCallback((t1: React.Touch | Touch, t2: React.Touch | Touch) => {
    return Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX);
  }, []);

  // Helper to get center point between two touches in SVG coordinates
  const getTouchCenter = useCallback(
    (t1: React.Touch | Touch, t2: React.Touch | Touch) => {
      const centerClientX = (t1.clientX + t2.clientX) / 2;
      const centerClientY = (t1.clientY + t2.clientY) / 2;
      return getSVGPoint(centerClientX, centerClientY);
    },
    [getSVGPoint]
  );

  // Clear long press timer
  const clearLongPressTimer = useCallback(() => {
    const state = touchStateRef.current;
    if (state.longPressTimer) {
      clearTimeout(state.longPressTimer);
      state.longPressTimer = null;
    }
  }, []);

  // Find shape at touch point
  const findShapeAtPoint = useCallback(
    (x: number, y: number): Shape | null => {
      // Search from top to bottom (highest zIndex first)
      const sortedByZ = [...shapes].sort((a, b) => b.zIndex - a.zIndex);
      for (const shape of sortedByZ) {
        if (!isShapeVisible(shape, groups)) continue;
        const dims = getShapeDimensions(shape.type, shape.size);
        const centerX = shape.x + dims.width / 2;
        const centerY = shape.y + dims.height / 2;

        // Rotate the test point around the shape center (inverse rotation)
        const angleRad = (-shape.rotation * Math.PI) / 180;
        const cos = Math.cos(angleRad);
        const sin = Math.sin(angleRad);
        const relX = x - centerX;
        const relY = y - centerY;
        const rotatedX = relX * cos - relY * sin + centerX;
        const rotatedY = relX * sin + relY * cos + centerY;

        // Check if point is within shape bounds
        if (
          rotatedX >= shape.x &&
          rotatedX <= shape.x + dims.width &&
          rotatedY >= shape.y &&
          rotatedY <= shape.y + dims.height
        ) {
          return shape;
        }
      }
      return null;
    },
    [shapes, groups]
  );

  // Handle touch start on canvas
  const handleCanvasTouchStart = useCallback(
    (e: React.TouchEvent) => {
      // Close context menu if open
      if (contextMenu.isOpen) {
        setContextMenu({ isOpen: false, x: 0, y: 0, shapeId: null });
        return;
      }

      const touches = e.touches;
      const state = touchStateRef.current;

      if (touches.length === 1) {
        // Single touch
        const touch = touches[0];
        const point = getTouchSVGPoint(touch);
        const shape = findShapeAtPoint(point.x, point.y);

        state.startPoint = point;
        state.currentPoint = point;
        state.touchedShapeId = shape?.id || null;
        state.isDragging = false;
        state.hasMoved = false;
        state.isLongPress = false;
        state.isMultiTouch = false;

        // If touching a shape, select it (if not already selected)
        if (shape && !selectedShapeIds.has(shape.id)) {
          onSelectShape(shape.id);
        }

        // Start long press timer
        clearLongPressTimer();
        if (shape) {
          state.longPressTimer = setTimeout(() => {
            if (!state.hasMoved && state.touchedShapeId && state.startPoint) {
              state.isLongPress = true;
              // Trigger haptic feedback if available
              if (navigator.vibrate) {
                navigator.vibrate(50);
              }
              // Open context menu
              setContextMenu({
                isOpen: true,
                x: state.startPoint.clientX,
                y: state.startPoint.clientY,
                shapeId: state.touchedShapeId,
              });
            }
          }, LONG_PRESS_DURATION);
        }
      } else if (touches.length === 2) {
        // Multi-touch (pinch/rotate)
        e.preventDefault();
        clearLongPressTimer();

        const t1 = touches[0];
        const t2 = touches[1];

        state.isMultiTouch = true;
        state.isDragging = false;
        state.startDistance = getTouchDistance(t1, t2);
        state.startAngle = getTouchAngle(t1, t2);
        state.startCenter = getTouchCenter(t1, t2);

        // Store start data for all selected shapes, or store viewport state for canvas zoom
        if (selectedShapes.length > 0) {
          state.startShapeData = new Map();
          selectedShapes.forEach((s) => {
            const dims = getShapeDimensions(s.type, s.size);
            state.startShapeData!.set(s.id, {
              x: s.x,
              y: s.y,
              size: s.size,
              rotation: s.rotation,
              width: dims.width,
              height: dims.height,
            });
          });
        } else {
          // No shapes selected - prepare for canvas zoom/pan
          state.startShapeData = null;
          state.startZoom = viewport.zoom;
          state.startPanX = viewport.panX;
          state.startPanY = viewport.panY;
        }
      }
    },
    [
      contextMenu.isOpen,
      getTouchSVGPoint,
      findShapeAtPoint,
      selectedShapeIds,
      onSelectShape,
      clearLongPressTimer,
      getTouchDistance,
      getTouchAngle,
      getTouchCenter,
      selectedShapes,
      viewport.zoom,
      viewport.panX,
      viewport.panY,
    ]
  );

  // Handle touch move on canvas
  const handleCanvasTouchMove = useCallback(
    (e: React.TouchEvent) => {
      const touches = e.touches;
      const state = touchStateRef.current;

      if (touches.length === 1 && !state.isMultiTouch) {
        const touch = touches[0];
        const point = getTouchSVGPoint(touch);
        const startPoint = state.startPoint;

        if (startPoint) {
          const dx = point.x - startPoint.x;
          const dy = point.y - startPoint.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance > TAP_THRESHOLD) {
            state.hasMoved = true;
            clearLongPressTimer();
          }

          // If we have a touched shape and we're moving, drag it
          if (state.touchedShapeId && state.hasMoved && !state.isLongPress) {
            e.preventDefault();

            if (!state.isDragging) {
              state.isDragging = true;
            }

            // Move all selected shapes
            if (selectedShapeIds.has(state.touchedShapeId)) {
              const updates = new Map<string, Partial<Shape>>();
              const prevPoint = state.currentPoint || startPoint;
              const moveDx = point.x - prevPoint.x;
              const moveDy = point.y - prevPoint.y;

              selectedShapes.forEach((shape) => {
                updates.set(shape.id, {
                  x: shape.x + moveDx,
                  y: shape.y + moveDy,
                });
              });
              onUpdateShapes(updates);
            } else {
              // Single shape not in selection
              const shape = shapes.find((s) => s.id === state.touchedShapeId);
              if (shape) {
                const prevPoint = state.currentPoint || startPoint;
                onUpdateShape(state.touchedShapeId, {
                  x: shape.x + (point.x - prevPoint.x),
                  y: shape.y + (point.y - prevPoint.y),
                });
              }
            }
          } else if (!state.touchedShapeId && state.hasMoved) {
            // No shape touched - pan the canvas
            e.preventDefault();
            const clientPoint = getClientPoint(touch.clientX, touch.clientY);
            const svg = svgRef.current;
            if (svg) {
              const rect = svg.getBoundingClientRect();
              const startClientPoint = {
                x: ((startPoint.clientX - rect.left) / rect.width) * CANVAS_SIZE,
                y: ((startPoint.clientY - rect.top) / rect.height) * CANVAS_SIZE,
              };
              const panDx = clientPoint.x - startClientPoint.x;
              const panDy = clientPoint.y - startClientPoint.y;
              onPan(viewport.panX + panDx, viewport.panY + panDy);
              state.startPoint = { ...point, clientX: touch.clientX, clientY: touch.clientY };
            }
          }
        }

        state.currentPoint = point;
      } else if (touches.length === 2 && state.isMultiTouch) {
        e.preventDefault();

        const t1 = touches[0];
        const t2 = touches[1];

        const currentDistance = getTouchDistance(t1, t2);
        const currentAngle = getTouchAngle(t1, t2);
        const currentCenter = getTouchCenter(t1, t2);

        // Calculate scale and rotation delta
        const scale = currentDistance / state.startDistance;
        const rotationDelta = ((currentAngle - state.startAngle) * 180) / Math.PI;

        // Apply transformations to selected shapes
        if (state.startShapeData && state.startShapeData.size > 0) {
          const updates = new Map<string, Partial<Shape>>();

          state.startShapeData.forEach((startData, id) => {
            const shape = shapes.find((s) => s.id === id);
            if (!shape) return;

            // Calculate new size
            const newSize = Math.max(20, startData.size * scale);

            // Calculate new position (scale around pinch center)
            // Use actual shape dimensions for correct center calculation
            const shapeCenterX = startData.x + startData.width / 2;
            const shapeCenterY = startData.y + startData.height / 2;

            // Vector from pinch center to shape center
            const relX = shapeCenterX - state.startCenter.x;
            const relY = shapeCenterY - state.startCenter.y;

            // Rotate this vector
            const angleRad = (rotationDelta * Math.PI) / 180;
            const cos = Math.cos(angleRad);
            const sin = Math.sin(angleRad);
            const rotatedX = relX * cos - relY * sin;
            const rotatedY = relX * sin + relY * cos;

            // Scale and translate to new center
            const newCenterX = currentCenter.x + rotatedX * scale;
            const newCenterY = currentCenter.y + rotatedY * scale;

            // Convert center to top-left position (dimensions scale proportionally with size)
            const newX = newCenterX - (startData.width * scale) / 2;
            const newY = newCenterY - (startData.height * scale) / 2;

            // Calculate new rotation, accounting for flip
            const flipInverts = (shape.flipX ? 1 : 0) ^ (shape.flipY ? 1 : 0);
            const shapeRotationDelta = flipInverts ? -rotationDelta : rotationDelta;

            updates.set(id, {
              x: newX,
              y: newY,
              size: newSize,
              rotation: startData.rotation + shapeRotationDelta,
            });
          });

          onUpdateShapes(updates);
        } else {
          // No shapes selected - pinch to zoom canvas
          onSetZoomAtPoint(
            state.startZoom,
            scale,
            currentCenter.x,
            currentCenter.y,
            state.startPanX,
            state.startPanY
          );
        }
      }
    },
    [
      getTouchSVGPoint,
      clearLongPressTimer,
      selectedShapeIds,
      selectedShapes,
      shapes,
      onUpdateShape,
      onUpdateShapes,
      getClientPoint,
      svgRef,
      viewport.panX,
      viewport.panY,
      onPan,
      onSetZoomAtPoint,
      getTouchDistance,
      getTouchAngle,
      getTouchCenter,
    ]
  );

  // Handle touch end on canvas
  const handleCanvasTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const state = touchStateRef.current;
      clearLongPressTimer();

      if (state.isMultiTouch) {
        // Multi-touch ended
        if (e.touches.length < 2) {
          state.isMultiTouch = false;
          state.startShapeData = null;

          // If one finger remains, reset for potential new single touch
          if (e.touches.length === 1) {
            const touch = e.touches[0];
            const point = getTouchSVGPoint(touch);
            state.startPoint = point;
            state.currentPoint = point;
            state.hasMoved = false;
          }
        }
      } else if (e.touches.length === 0) {
        // All touches ended
        if (!state.hasMoved && !state.isLongPress) {
          // It was a tap
          if (!state.touchedShapeId) {
            // Tap on empty canvas - deselect all
            onSelectShape(null);
          }
          // Tap on shape already handled in touchstart
        }

        // Reset state
        state.startPoint = null;
        state.currentPoint = null;
        state.touchedShapeId = null;
        state.isDragging = false;
        state.hasMoved = false;
        state.isLongPress = false;
      }
    },
    [clearLongPressTimer, getTouchSVGPoint, onSelectShape]
  );

  return {
    contextMenu,
    setContextMenu,
    handleCanvasTouchStart,
    handleCanvasTouchMove,
    handleCanvasTouchEnd,
  };
}
