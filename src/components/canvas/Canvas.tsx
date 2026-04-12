import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import type { Shape } from '../../types';
import { CANVAS_SIZE } from '../../types/canvas';
import { getShapeDimensions } from '../../utils/shapes';
import { getVisibleShapes, isShapeLocked } from '../../utils/visibility';
import { useCanvasEditor } from '../../contexts/useCanvasEditor';
import { ShapeElement } from './ShapeElement';
import {
  TransformInteractionLayer,
  MultiSelectTransformLayer,
  MultiSelectInteractionLayer,
  HoverHighlightLayer,
} from './TransformHandles';
import { makeRotationCursor } from '../../utils/cursors';
import { TouchContextMenu } from './TouchContextMenu';
import { CanvasGridLines } from './CanvasGridLines';

import { useCanvasCoordinates } from '../../hooks/canvas/useCanvasCoordinates';
import { useSelectionBounds } from '../../hooks/canvas/useSelectionBounds';
import { useCanvasKeyboardShortcuts } from '../../hooks/canvas/useCanvasKeyboardShortcuts';
import { useCanvasPanning } from '../../hooks/canvas/useCanvasPanning';
import { useWheelZoom } from '../../hooks/canvas/useWheelZoom';
import { useShapeDrag } from '../../hooks/canvas/useShapeDrag';
import { useCanvasTouchGestures } from '../../hooks/canvas/useCanvasTouchGestures';
import { useMarqueeSelection } from '../../hooks/canvas/useMarqueeSelection';

interface CanvasProps {
  marqueeStartRef?: React.MutableRefObject<((clientX: number, clientY: number) => void) | null>;
  onSetColorIndex?: (colorIndex: number) => void;
}

export function Canvas({ marqueeStartRef, onSetColorIndex }: CanvasProps) {
  const {
    canvasState: { shapes, groups, selectedShapeIds },
    backgroundColor, challenge, viewport, keyMappings,
    showGrid, showOffCanvas,
    selectShape: onSelectShape,
    selectShapes: onSelectShapes,
    updateShape: onUpdateShape,
    updateShapes: onUpdateShapes,
    commitToHistory: onCommitToHistory,
    duplicateShapes: onDuplicateShapes,
    lastDuplicatedIdsRef,
    pendingAnimationIdsRef,
    deleteSelectedShapes: onDeleteSelectedShapes,
    undo: onUndo, redo: onRedo,
    mirrorHorizontal: onMirrorHorizontal,
    mirrorVertical: onMirrorVertical,
    handleResizeShapes: onResizeShapes,
    handleBringForward: onBringForward,
    handleSendBackward: onSendBackward,
    zoomAtPoint: onZoomAtPoint,
    setZoomAtPoint: onSetZoomAtPoint,
    setPan: onPan,
    moveLayer: onMoveLayer,
    toggleGrid: onToggleGrid,
    hoveredShapeIds,
  } = useCanvasEditor();
  const svgRef = useRef<SVGSVGElement>(null);

  // Filter to only visible shapes
  const visibleShapes = useMemo(() => getVisibleShapes(shapes, groups), [shapes, groups]);

  // Exclude hidden and locked shapes from effective selection
  const effectiveSelectedShapeIds = useMemo(() => {
    const visibleIds = new Set(visibleShapes.map(s => s.id));
    const filtered = new Set<string>();
    selectedShapeIds.forEach(id => {
      if (!visibleIds.has(id)) return;
      const shape = shapes.find(s => s.id === id);
      if (shape && isShapeLocked(shape, groups)) return;
      filtered.add(id);
    });
    return filtered;
  }, [visibleShapes, selectedShapeIds, shapes, groups]);

  // Track newly added shapes for entrance animation.
  // knownShapeIds holds all IDs from the previous render cycle. New IDs that
  // aren't in this set trigger the bounce-in animation on ShapeElement.
  // The state update is deferred to an effect so the render that first detects
  // new IDs can pass them to ShapeElement before they become "known".
  // Bulk loads (e.g. Supabase hydration) skip animation unless the shapes were
  // explicitly created by a user action (tracked via pendingAnimationIdsRef).
  const [knownShapeIds, setKnownShapeIds] = useState(() => new Set(shapes.map(s => s.id)));
  const newShapeIds: ReadonlySet<string> = useMemo(() => {
    const added = new Set<string>();
    for (const s of shapes) {
      if (!knownShapeIds.has(s.id)) added.add(s.id);
    }
    // Always animate shapes explicitly created by user actions.
    // Only suppress animation for bulk loads (e.g. Supabase hydration).
    // Safe to read ref during render: it's set synchronously by the same
    // state transition that causes this render.
    /* eslint-disable react-hooks/refs */
    const pending = pendingAnimationIdsRef.current;
    if (pending.length > 0) {
      const pendingSet = new Set(pending);
      const userCreated = new Set<string>();
      for (const id of added) {
        if (pendingSet.has(id)) userCreated.add(id);
      }
      if (userCreated.size > 0) return userCreated;
    }
    /* eslint-enable react-hooks/refs */
    return added.size > 3 ? new Set<string>() : added;
  }, [shapes, knownShapeIds, pendingAnimationIdsRef]);

  useEffect(() => {
    // Intentionally deferred: the render that first detects new IDs must
    // complete before we mark them as known, so ShapeElement can animate.
    setKnownShapeIds(new Set(shapes.map(s => s.id)));
    // Clear pending animation IDs after they've been consumed.
    pendingAnimationIdsRef.current = [];
  }, [shapes, pendingAnimationIdsRef]);

  // Use extracted hooks
  const { getSVGPoint, getClientPoint } = useCanvasCoordinates(svgRef);

  const {
    selectedShapes,
    hasSelection,
    hasSingleSelection,
    singleSelectedShape,
    selectionBounds,
  } = useSelectionBounds(visibleShapes, effectiveSelectedShapeIds);

  const { isSpacePressed, cursorStyle } = useCanvasPanning(
    viewport,
    keyMappings,
    getClientPoint,
    onPan
  );

  const { marqueeState, startMarqueeAt } = useMarqueeSelection({
    shapes: visibleShapes,
    groups,
    getSVGPoint,
    isSpacePressed,
    onSelectShapes,
    onSelectShape,
  });

  // Expose startMarqueeAt to parent so marquee can start from outside the SVG
  useEffect(() => {
    if (marqueeStartRef) {
      marqueeStartRef.current = startMarqueeAt;
    }
  }, [marqueeStartRef, startMarqueeAt]);

  useWheelZoom(svgRef, onZoomAtPoint, onPan, viewport);

  const onSelectAll = useCallback(() => {
    onSelectShapes(visibleShapes.map(s => s.id));
  }, [visibleShapes, onSelectShapes]);

  const onDeselectAll = useCallback(() => {
    onSelectShapes([]);
  }, [onSelectShapes]);

  useCanvasKeyboardShortcuts({
    shapes,
    selectedShapes,
    hasSelection,
    keyMappings,
    onUpdateShapes,
    onUndo,
    onRedo,
    onDuplicateShapes,
    lastDuplicatedIdsRef,
    onDeleteSelectedShapes,
    onMirrorHorizontal,
    onMirrorVertical,
    onResizeShapes,
    onBringForward,
    onSendBackward,
    onSelectAll,
    onDeselectAll,
    onSetColorIndex,
    onToggleGrid,
  });

  const { dragState, setDragState, rotationDelta } = useShapeDrag({
    shapes,
    getSVGPoint,
    onUpdateShape,
    onUpdateShapes,
    onCommitToHistory,
  });

  const {
    contextMenu,
    setContextMenu,
    handleCanvasTouchStart,
    handleCanvasTouchMove,
    handleCanvasTouchEnd,
  } = useCanvasTouchGestures({
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
  });

  // Track which transform handle is hovered for visual feedback (1.3x scale)
  const [hoveredHandleId, setHoveredHandleId] = useState<string | null>(null);

  // Lock the cursor to the active drag action (move/resize/rotate) for the
  // duration of the drag. Without this, dragging across other shapes or
  // transform handles would cause the cursor to flicker to their cursors
  // (e.g. showing a move cursor while mid-resize). When dragCursor is set,
  // interaction layers are unmounted so nothing competes with this cursor.
  //
  // The cursor is captured from the element at mousedown time (via
  // capturedCursorRef) rather than recomputed, so it always matches what
  // the user saw before clicking.
  const [capturedCursor, setCapturedCursor] = useState<{ cursor: string; isRotation: boolean } | null>(null);
  const dragCursor = useMemo(() => {
    if (!dragState || !capturedCursor) return undefined;
    if (capturedCursor.isRotation) {
      // Extract the base angle from the captured rotation cursor SVG and add the live delta
      const match = decodeURIComponent(capturedCursor.cursor).match(/rotate\((\d+)/);
      const baseAngle = match ? parseInt(match[1]) : 0;
      return makeRotationCursor(baseAngle + rotationDelta);
    }
    return capturedCursor.cursor;
  }, [dragState, capturedCursor, rotationDelta]);

  // Capture the CSS cursor from the element under the mouse at drag start.
  const captureCursor = (e: React.MouseEvent | React.TouchEvent) => {
    const target = ('target' in e ? e.target : null) as Element | null;
    const cursor = target ? window.getComputedStyle(target).cursor : 'default';
    const isRotation = cursor.startsWith('url(') && cursor.includes('crosshair');
    setCapturedCursor({ cursor, isRotation });
  };

  // Event handlers that need to set drag state
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.target === svgRef.current) {
      startMarqueeAt(e.clientX, e.clientY);
    }
  };

  const handleShapeMouseDown = useCallback(
    (e: React.MouseEvent, shapeId: string) => {
      const shape = shapes.find((s) => s.id === shapeId);
      if (!shape) return;
      // Locked shapes should be inert — let the event bubble to canvas for marquee
      if (isShapeLocked(shape, groups)) return;
      e.stopPropagation();

      const isShiftKey = e.shiftKey;
      const isAlreadySelected = selectedShapeIds.has(shapeId);

      // Handle selection logic
      if (isShiftKey) {
        onSelectShape(shapeId, { toggle: true });
        if (isAlreadySelected) {
          return;
        }
      } else if (!isAlreadySelected) {
        onSelectShape(shapeId);
      }

      // Start drag for move
      captureCursor(e);
      const point = getSVGPoint(e.clientX, e.clientY);

      let shapesToDrag: Shape[];
      if (isShiftKey) {
        shapesToDrag = [...selectedShapes, shape];
      } else if (isAlreadySelected) {
        shapesToDrag = selectedShapes;
      } else {
        shapesToDrag = [shape];
      }

      const startPositions = new Map<string, { x: number; y: number }>();
      shapesToDrag.forEach(s => {
        startPositions.set(s.id, { x: s.x, y: s.y });
      });

      setDragState({
        mode: 'move',
        shapeId: shape.id,
        startX: point.x,
        startY: point.y,
        startShapeX: shape.x,
        startShapeY: shape.y,
        startSize: shape.size,
        startRotation: shape.rotation,
        resizeCorner: '',
        startPositions,
      });
    },
    [shapes, groups, selectedShapeIds, selectedShapes, getSVGPoint, onSelectShape, setDragState]
  );

  const handleResizeStart = useCallback(
    (e: React.MouseEvent | React.TouchEvent, corner: string) => {
      e.stopPropagation();
      if (!singleSelectedShape) return;
      captureCursor(e);

      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      const point = getSVGPoint(clientX, clientY);
      const dims = getShapeDimensions(singleSelectedShape.type, singleSelectedShape.size);
      setDragState({
        mode: 'resize',
        shapeId: singleSelectedShape.id,
        startX: point.x,
        startY: point.y,
        startShapeX: singleSelectedShape.x,
        startShapeY: singleSelectedShape.y,
        startSize: singleSelectedShape.size,
        startWidth: dims.width,
        startHeight: dims.height,
        startRotation: singleSelectedShape.rotation,
        resizeCorner: corner,
        flipX: singleSelectedShape.flipX,
        flipY: singleSelectedShape.flipY,
      });
    },
    [singleSelectedShape, getSVGPoint, setDragState]
  );

  const handleRotateStart = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.stopPropagation();
      if (!singleSelectedShape) return;
      captureCursor(e);

      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      const point = getSVGPoint(clientX, clientY);
      const rotDims = getShapeDimensions(singleSelectedShape.type, singleSelectedShape.size);
      setDragState({
        mode: 'rotate',
        shapeId: singleSelectedShape.id,
        startX: point.x,
        startY: point.y,
        startShapeX: singleSelectedShape.x,
        startShapeY: singleSelectedShape.y,
        startSize: singleSelectedShape.size,
        startWidth: rotDims.width,
        startHeight: rotDims.height,
        startRotation: singleSelectedShape.rotation,
        resizeCorner: '',
        flipX: singleSelectedShape.flipX,
        flipY: singleSelectedShape.flipY,
      });
    },
    [singleSelectedShape, getSVGPoint, setDragState]
  );

  const handleMoveStart = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.stopPropagation();
      if (!hasSelection) return;
      captureCursor(e);

      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      const point = getSVGPoint(clientX, clientY);

      const startPositions = new Map<string, { x: number; y: number }>();
      selectedShapes.forEach(s => {
        startPositions.set(s.id, { x: s.x, y: s.y });
      });

      const refShape = selectedShapes[0];

      setDragState({
        mode: 'move',
        shapeId: refShape.id,
        startX: point.x,
        startY: point.y,
        startShapeX: refShape.x,
        startShapeY: refShape.y,
        startSize: refShape.size,
        startRotation: refShape.rotation,
        resizeCorner: '',
        startPositions,
      });
    },
    [hasSelection, selectedShapes, getSVGPoint, setDragState]
  );

  const handleMultiResizeStart = useCallback(
    (e: React.MouseEvent | React.TouchEvent, corner: string) => {
      e.stopPropagation();
      if (selectedShapes.length < 2 || !selectionBounds) return;
      captureCursor(e);

      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      const point = getSVGPoint(clientX, clientY);

      const startShapeData = new Map<string, { x: number; y: number; size: number; rotation: number; width: number; height: number }>();
      selectedShapes.forEach(s => {
        const dims = getShapeDimensions(s.type, s.size);
        startShapeData.set(s.id, { x: s.x, y: s.y, size: s.size, rotation: s.rotation, width: dims.width, height: dims.height });
      });

      const refShape = selectedShapes[0];

      setDragState({
        mode: 'resize',
        shapeId: refShape.id,
        startX: point.x,
        startY: point.y,
        startShapeX: refShape.x,
        startShapeY: refShape.y,
        startSize: refShape.size,
        startRotation: refShape.rotation,
        resizeCorner: corner,
        startShapeData,
        startBounds: { ...selectionBounds },
      });
    },
    [selectedShapes, selectionBounds, getSVGPoint, setDragState]
  );

  const handleMultiRotateStart = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.stopPropagation();
      if (selectedShapes.length < 2 || !selectionBounds) return;
      captureCursor(e);

      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      const point = getSVGPoint(clientX, clientY);

      const startShapeData = new Map<string, { x: number; y: number; size: number; rotation: number; width: number; height: number }>();
      selectedShapes.forEach(s => {
        const dims = getShapeDimensions(s.type, s.size);
        startShapeData.set(s.id, { x: s.x, y: s.y, size: s.size, rotation: s.rotation, width: dims.width, height: dims.height });
      });

      const refShape = selectedShapes[0];

      setDragState({
        mode: 'rotate',
        shapeId: refShape.id,
        startX: point.x,
        startY: point.y,
        startShapeX: refShape.x,
        startShapeY: refShape.y,
        startSize: refShape.size,
        startRotation: refShape.rotation,
        resizeCorner: '',
        startShapeData,
        startBounds: { ...selectionBounds },
      });
    },
    [selectedShapes, selectionBounds, getSVGPoint, setDragState]
  );

  // Context menu handlers
  const handleCloseContextMenu = useCallback(() => {
    setContextMenu({ isOpen: false, x: 0, y: 0, shapeId: null });
  }, [setContextMenu]);

  const handleContextMenuDuplicate = useCallback(() => {
    if (selectedShapeIds.size > 0) {
      onDuplicateShapes(Array.from(selectedShapeIds));
    }
  }, [selectedShapeIds, onDuplicateShapes]);

  const handleContextMenuDelete = useCallback(() => {
    onDeleteSelectedShapes();
  }, [onDeleteSelectedShapes]);

  const handleContextMenuMirrorH = useCallback(() => {
    if (selectedShapeIds.size > 0) {
      onMirrorHorizontal(Array.from(selectedShapeIds));
    }
  }, [selectedShapeIds, onMirrorHorizontal]);

  const handleContextMenuMirrorV = useCallback(() => {
    if (selectedShapeIds.size > 0) {
      onMirrorVertical(Array.from(selectedShapeIds));
    }
  }, [selectedShapeIds, onMirrorVertical]);

  const handleContextMenuBringToFront = useCallback(() => {
    if (contextMenu.shapeId) {
      onMoveLayer(contextMenu.shapeId, 'top');
    }
  }, [contextMenu.shapeId, onMoveLayer]);

  const handleContextMenuSendToBack = useCallback(() => {
    if (contextMenu.shapeId) {
      onMoveLayer(contextMenu.shapeId, 'bottom');
    }
  }, [contextMenu.shapeId, onMoveLayer]);

  // Sort visible shapes by zIndex for rendering
  const sortedShapes = useMemo(() => [...visibleShapes].sort((a, b) => a.zIndex - b.zIndex), [visibleShapes]);

  // Compute shapes to highlight on hover (excluding already-selected and hidden shapes)
  const hoveredShapes = useMemo(() => {
    if (!hoveredShapeIds || hoveredShapeIds.size === 0) return [];
    return visibleShapes.filter(s => hoveredShapeIds.has(s.id) && !effectiveSelectedShapeIds.has(s.id));
  }, [visibleShapes, hoveredShapeIds, effectiveSelectedShapeIds]);

  // Calculate viewBox based on zoom and pan
  const viewBoxSize = CANVAS_SIZE / viewport.zoom;
  const viewBoxX = -viewport.panX / viewport.zoom;
  const viewBoxY = -viewport.panY / viewport.zoom;

  return (
    <>
      <svg
        ref={svgRef}
        width={CANVAS_SIZE}
        height={CANVAS_SIZE}
        viewBox={`${viewBoxX} ${viewBoxY} ${viewBoxSize} ${viewBoxSize}`}
        className="touch-none overflow-visible max-h-[calc(100dvh-16rem)] max-w-[calc(100vw-8rem)] w-auto h-auto"
        style={{ cursor: dragCursor ?? (marqueeState ? 'crosshair' : cursorStyle), aspectRatio: '1 / 1' }}
        onMouseDown={handleCanvasMouseDown}
        onTouchStart={handleCanvasTouchStart}
        onTouchMove={handleCanvasTouchMove}
        onTouchEnd={handleCanvasTouchEnd}
        onTouchCancel={handleCanvasTouchEnd}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Clip rect for the canvas content (shapes) */}
        <defs>
          <clipPath id="canvas-clip">
            <rect x={0} y={0} width={CANVAS_SIZE} height={CANVAS_SIZE} />
          </clipPath>
        </defs>

        {/* Canvas background rect — animated fill for smooth color transitions */}
        <motion.rect
          x={0}
          y={0}
          width={CANVAS_SIZE}
          height={CANVAS_SIZE}
          animate={{ fill: backgroundColor || 'var(--color-bg-elevated)' }}
          transition={{ duration: 0.3 }}
          onMouseDown={(e) => {
            if (!isSpacePressed) startMarqueeAt(e.clientX, e.clientY);
          }}
        />

        {/* Canvas boundary — moves with viewBox when panning (Figma-like) */}
        <rect
          x={0}
          y={0}
          width={CANVAS_SIZE}
          height={CANVAS_SIZE}
          fill="none"
          stroke="var(--color-border)"
          strokeWidth={2 / viewport.zoom}
          style={{ pointerEvents: 'none' }}
        />

        {/* Render shapes - optionally clipped to canvas bounds */}
        <g clipPath={showOffCanvas ? undefined : "url(#canvas-clip)"}>
          {sortedShapes.map((shape) => {
            const locked = isShapeLocked(shape, groups);
            return (
            <g key={shape.id}>
              <g
                style={locked || dragCursor ? { pointerEvents: 'none' } : undefined}
                onMouseDown={(e) => {
                  if (!isSpacePressed) handleShapeMouseDown(e, shape.id);
                }}
              >
                <ShapeElement
                  shape={shape}
                  color={challenge.colors[shape.colorIndex]}
                  isSelected={selectedShapeIds.has(shape.id)}
                  locked={isShapeLocked(shape, groups)}
                  animateEntrance={newShapeIds.has(shape.id)}
                />
              </g>
            </g>
            );
          })}
        </g>

        {/* Grid lines - rendered on top of shapes but don't export/print */}
        {showGrid && <CanvasGridLines zoom={viewport.zoom} showOffCanvas={showOffCanvas} />}

        {/* Hover highlight from layer panel */}
        {hoveredShapes.length > 0 && (
          <HoverHighlightLayer shapes={hoveredShapes} zoom={viewport.zoom} />
        )}

        {/* Interaction layers - outside clip path for better hit detection.
            During drag, disable pointer-events so the SVG's drag cursor wins. */}
        {!isSpacePressed && !dragCursor && sortedShapes.map((shape) => (
          <g key={`interaction-${shape.id}`}>
            {/* Render invisible interaction layer for single-selected shape */}
            {hasSingleSelection && selectedShapeIds.has(shape.id) && (
              <TransformInteractionLayer
                shape={shape}
                zoom={viewport.zoom}
                onMoveStart={handleMoveStart}
                onResizeStart={handleResizeStart}
                onRotateStart={handleRotateStart}
                onHandleHover={setHoveredHandleId}
              />
            )}
          </g>
        ))}

        {/* Render visible transform UI on top of everything - outside clip path */}
        {hasSingleSelection && singleSelectedShape && (
          <MultiSelectTransformLayer
            shapes={[singleSelectedShape]}
            bounds={selectionBounds!}
            zoom={viewport.zoom}
            showIndividualOutlines={true}
            hoveredHandleId={hoveredHandleId}
          />
        )}

        {/* Multi-select: interaction layer + visual layer */}
        {selectedShapes.length > 1 && selectionBounds && (
          <>
            {!isSpacePressed && !dragCursor && (
              <MultiSelectInteractionLayer
                bounds={selectionBounds}
                zoom={viewport.zoom}
                onResizeStart={handleMultiResizeStart}
                onRotateStart={handleMultiRotateStart}
                onHandleHover={setHoveredHandleId}
              />
            )}
            <MultiSelectTransformLayer
              shapes={selectedShapes}
              bounds={selectionBounds}
              zoom={viewport.zoom}
              showIndividualOutlines={true}
              hoveredHandleId={hoveredHandleId}
            />
          </>
        )}

        {/* Marquee selection rectangle */}
        {marqueeState && (
          <rect
            x={Math.min(marqueeState.startX, marqueeState.currentX)}
            y={Math.min(marqueeState.startY, marqueeState.currentY)}
            width={Math.abs(marqueeState.currentX - marqueeState.startX)}
            height={Math.abs(marqueeState.currentY - marqueeState.startY)}
            style={{ fill: 'var(--sel-hover-fill)', stroke: 'var(--sel-border)' }}
            strokeWidth={1 / viewport.zoom}
            strokeDasharray={`${4 / viewport.zoom} ${2 / viewport.zoom}`}
            pointerEvents="none"
          />
        )}
      </svg>

      {/* Touch context menu */}
      {contextMenu.isOpen && (
        <TouchContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={handleCloseContextMenu}
          onDuplicate={handleContextMenuDuplicate}
          onDelete={handleContextMenuDelete}
          onMirrorHorizontal={handleContextMenuMirrorH}
          onMirrorVertical={handleContextMenuMirrorV}
          onBringToFront={handleContextMenuBringToFront}
          onSendToBack={handleContextMenuSendToBack}
        />
      )}
    </>
  );
}
