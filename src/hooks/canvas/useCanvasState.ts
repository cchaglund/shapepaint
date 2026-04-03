import { useState, useCallback, useRef } from 'react';
import type { Shape, ShapeGroup, CanvasState, DailyChallenge } from '../../types';
import { useCanvasHistory } from './useCanvasHistory';
import { useCanvasStorage, getInitialCanvasState, initialCanvasState } from './useCanvasStorage';
import { useShapeOperations } from './useShapeOperations';

export interface UndoRedoToast {
  message: string;
  key: number;
}

export function useCanvasState(challenge: DailyChallenge | null, userId: string | undefined) {
  const [canvasState, setCanvasStateInternal] = useState<CanvasState>(getInitialCanvasState);

  // Storage persistence (debounced save + immediate save helper)
  const { saveCanvasStateNow } = useCanvasStorage(canvasState, userId);

  // History management (extracted hook)
  const {
    pushHistory,
    commitToHistory: historyCommit,
    undo: historyUndo,
    redo: historyRedo,
    canUndo,
    canRedo,
    resetHistory,
  } = useCanvasHistory(canvasState);

  // Toast state for undo/redo notifications
  const [toast, setToast] = useState<UndoRedoToast | null>(null);
  const toastKeyRef = useRef(0);

  // Wrapper that adds to history
  const setCanvasState = useCallback(
    (
      updater: CanvasState | ((prev: CanvasState) => CanvasState),
      addToHistory = true,
      label?: string
    ) => {
      setCanvasStateInternal((prev) => {
        const newState =
          typeof updater === 'function' ? updater(prev) : updater;

        if (addToHistory) {
          pushHistory(newState, label);
        }

        return newState;
      });
    },
    [pushHistory]
  );

  const undo = useCallback(() => {
    historyUndo((restored, label) => {
      setCanvasStateInternal(restored);
      toastKeyRef.current += 1;
      setToast({ message: `Undo: ${label || 'Edit'}`, key: toastKeyRef.current });
    });
  }, [historyUndo]);

  const redo = useCallback(() => {
    historyRedo((restored, label) => {
      setCanvasStateInternal(restored);
      toastKeyRef.current += 1;
      setToast({ message: `Redo: ${label || 'Edit'}`, key: toastKeyRef.current });
    });
  }, [historyRedo]);

  const dismissToast = useCallback(() => setToast(null), []);

  // Shape CRUD, selection, layer ordering, mirror, and group operations
  const {
    addShape,
    duplicateShape,
    duplicateShapes,
    lastDuplicatedIdsRef,
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
    mirrorHorizontal,
    mirrorVertical,
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
  } = useShapeOperations(challenge, setCanvasState);

  // Commit current state to history (used after drag operations complete)
  const commitToHistory = useCallback((label?: string) => {
    historyCommit(canvasState, label);
  }, [canvasState, historyCommit]);

  const resetCanvas = useCallback(() => {
    setCanvasState(initialCanvasState, true, 'Reset canvas');
  }, [setCanvasState]);

  // Get shapes in a group (helper for LayerPanel)
  const getShapesInGroup = useCallback(
    (groupId: string): Shape[] => {
      return canvasState.shapes.filter((s) => s.groupId === groupId);
    },
    [canvasState.shapes]
  );

  // Load canvas state from an external source (e.g., a submission from the server)
  const loadCanvasState = useCallback(
    (shapes: Shape[], groups: ShapeGroup[], backgroundColorIndex: number | null) => {
      const newState: CanvasState = {
        shapes,
        groups,
        backgroundColorIndex,
        selectedShapeIds: new Set<string>(),
      };

      resetHistory(newState);
      setCanvasStateInternal(newState);
      saveCanvasStateNow(shapes, groups, backgroundColorIndex);
    },
    [resetHistory, saveCanvasStateNow]
  );

  return {
    canvasState,
    addShape,
    duplicateShape,
    duplicateShapes,
    lastDuplicatedIdsRef,
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
    // Group management
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
    getShapesInGroup,
    // External loading
    loadCanvasState,
    // Toast
    toast,
    dismissToast,
  };
}
