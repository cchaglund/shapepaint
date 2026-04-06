import { useCallback, useRef, useState } from 'react';
import type { DailyChallenge, Shape } from '../../types';
import type { CanvasEditorContextValue } from '../../contexts/CanvasEditorContext';
import { useCanvasState } from './useCanvasState';
import { useViewportState } from './useViewportState';
import { useGridState } from './useGridState';
import { useOffCanvasState } from './useOffCanvasState';
import { useShapeActions } from './useShapeActions';
import type { KeyMappings } from '../../constants/keyboardActions';

interface UseCanvasEditorStateOptions {
  challenge: DailyChallenge;
  userId: string | undefined;
  keyMappings: KeyMappings;
}

export function useCanvasEditorState({ challenge, userId, keyMappings }: UseCanvasEditorStateOptions) {
  const {
    canvasState,
    addShape,
    duplicateShapes,
    lastDuplicatedIdsRef,
    pendingAnimationIdsRef,
    updateShape,
    updateShapes,
    deleteShape,
    deleteSelectedShapes,
    selectShape,
    selectShapes,
    moveLayer,
    moveGroup,
    reorderLayers,
    reorderGroup,
    setBackgroundColor,
    resetCanvas,
    mirrorHorizontal,
    mirrorVertical,
    undo,
    redo,
    canUndo,
    canRedo,
    commitToHistory,
    createGroup,
    deleteGroup,
    ungroupShapes,
    renameGroup,
    toggleGroupCollapsed,
    toggleShapeVisibility,
    toggleGroupVisibility,
    toggleShapeLock,
    toggleGroupLock,
    selectGroup,
    loadCanvasState,
    toast,
    dismissToast,
  } = useCanvasState(challenge, userId);

  const {
    viewport,
    setZoom,
    setPan,
    zoomAtPoint,
    setZoomAtPoint,
    resetViewport,
    minZoom,
    maxZoom,
  } = useViewportState();

  const { showGrid, toggleGrid } = useGridState();
  const { showOffCanvas, toggleOffCanvas } = useOffCanvasState();

  const {
    handleMoveShapes,
    handleDuplicate,
    handleMirrorHorizontal,
    handleMirrorVertical,
    handleResizeShapes,
  } = useShapeActions({
    shapes: canvasState.shapes,
    groups: canvasState.groups,
    selectedShapeIds: canvasState.selectedShapeIds,
    updateShapes,
    duplicateShapes,
    lastDuplicatedIdsRef,
    mirrorHorizontal,
    mirrorVertical,
  });

  const [hoveredShapeIds, setHoveredShapeIds] = useState<Set<string> | null>(null);

  const backgroundColor =
    canvasState.backgroundColorIndex !== null && challenge
      ? challenge.colors[canvasState.backgroundColorIndex]
      : null;

  const marqueeStartRef = useRef<((clientX: number, clientY: number) => void) | null>(null);

  const handleBringForward = useCallback(() => {
    const sorted = [...canvasState.selectedShapeIds]
      .map(id => canvasState.shapes.find(s => s.id === id))
      .filter((s): s is Shape => s !== undefined)
      .sort((a, b) => b.zIndex - a.zIndex);
    sorted.forEach(shape => moveLayer(shape.id, 'up'));
  }, [canvasState.selectedShapeIds, canvasState.shapes, moveLayer]);

  const handleSendBackward = useCallback(() => {
    const sorted = [...canvasState.selectedShapeIds]
      .map(id => canvasState.shapes.find(s => s.id === id))
      .filter((s): s is Shape => s !== undefined)
      .sort((a, b) => a.zIndex - b.zIndex);
    sorted.forEach(shape => moveLayer(shape.id, 'down'));
  }, [canvasState.selectedShapeIds, canvasState.shapes, moveLayer]);

  const handleZoomIn = useCallback(() => {
    setZoom(viewport.zoom + 0.1);
  }, [viewport.zoom, setZoom]);

  const handleZoomOut = useCallback(() => {
    setZoom(viewport.zoom - 0.1);
  }, [viewport.zoom, setZoom]);

  const editorContext: CanvasEditorContextValue = {
    canvasState, challenge, backgroundColor,
    viewport, zoomAtPoint, setZoomAtPoint, setPan,
    addShape, selectShape, selectShapes, updateShape, updateShapes,
    commitToHistory, duplicateShapes, lastDuplicatedIdsRef, pendingAnimationIdsRef, deleteShape, deleteSelectedShapes,
    setBackgroundColor, undo, redo, canUndo, canRedo,
    mirrorHorizontal, mirrorVertical, moveLayer,
    moveGroup, reorderLayers, reorderGroup,
    createGroup, deleteGroup, ungroupShapes, renameGroup,
    toggleGroupCollapsed, toggleShapeVisibility, toggleGroupVisibility, toggleShapeLock, toggleGroupLock,
    selectGroup, keyMappings, showGrid, showOffCanvas, toggleGrid,
    hoveredShapeIds, setHoveredShapeIds, toast, dismissToast,
  };

  return {
    editorContext,
    canvasState,
    loadCanvasState,
    resetCanvas,

    viewport,
    resetViewport,
    minZoom,
    maxZoom,
    handleZoomIn,
    handleZoomOut,

    showGrid,
    toggleGrid,
    showOffCanvas,
    toggleOffCanvas,

    handleMoveShapes,
    handleDuplicate,
    handleMirrorHorizontal,
    handleMirrorVertical,
    handleResizeShapes,
    handleBringForward,
    handleSendBackward,

    addShape,
    setBackgroundColor,
    updateShapes,
    deleteSelectedShapes,
    undo,
    redo,
    canUndo,
    canRedo,

    hoveredShapeIds,
    setHoveredShapeIds,
    backgroundColor,
    marqueeStartRef,
    toast,
    dismissToast,
  };
}
