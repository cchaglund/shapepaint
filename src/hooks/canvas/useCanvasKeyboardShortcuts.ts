import { useEffect, type RefObject } from 'react';
import type { Shape } from '../../types';
import { type KeyMappings, matchesBinding } from '../../constants/keyboardActions';

interface UseCanvasKeyboardShortcutsOptions {
  shapes: Shape[];
  selectedShapes: Shape[];
  hasSelection: boolean;
  keyMappings: KeyMappings;
  onUpdateShapes: (updates: Map<string, Partial<Shape>>, addToHistory?: boolean, label?: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  onDuplicateShapes: (ids: string[]) => void;
  lastDuplicatedIdsRef: RefObject<string[]>;
  onDeleteSelectedShapes: () => void;
  onMirrorHorizontal: (ids: string[]) => void;
  onMirrorVertical: (ids: string[]) => void;
  onResizeShapes: (delta: number) => void;
  onBringForward: () => void;
  onSendBackward: () => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onSetColorIndex?: (colorIndex: number) => void;
  onToggleGrid?: () => void;
}

/**
 * Hook for handling keyboard shortcuts (movement, rotation, undo/redo, duplicate, etc.)
 */
export function useCanvasKeyboardShortcuts({
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
}: UseCanvasKeyboardShortcutsOptions) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      // Check for undo binding
      const undoBinding = keyMappings.undo;
      if (undoBinding && matchesBinding(e, undoBinding)) {
        e.preventDefault();
        onUndo();
        return;
      }

      // Check for redo binding
      const redoBinding = keyMappings.redo;
      if (redoBinding && matchesBinding(e, redoBinding)) {
        e.preventDefault();
        onRedo();
        return;
      }

      // Check for duplicate binding - selected shapes, or re-duplicate last duplicated
      const duplicateBinding = keyMappings.duplicate;
      if (duplicateBinding && matchesBinding(e, duplicateBinding)) {
        if (selectedShapes.length > 0) {
          e.preventDefault();
          onDuplicateShapes(selectedShapes.map(s => s.id));
          return;
        }
        const lastIds = lastDuplicatedIdsRef.current;
        if (lastIds.length > 0) {
          const stillExist = lastIds.filter(id => shapes.some(s => s.id === id));
          if (stillExist.length > 0) {
            e.preventDefault();
            onDuplicateShapes(stillExist);
            return;
          }
        }
      }

      // Check for delete binding
      const deleteBinding = keyMappings.delete;
      if (deleteBinding && matchesBinding(e, deleteBinding)) {
        if (selectedShapes.length > 0) {
          e.preventDefault();
          onDeleteSelectedShapes();
          return;
        }
      }

      // Check for mirror horizontal binding
      const mirrorHBinding = keyMappings.mirrorHorizontal;
      if (mirrorHBinding && matchesBinding(e, mirrorHBinding)) {
        if (selectedShapes.length > 0) {
          e.preventDefault();
          onMirrorHorizontal(selectedShapes.map(s => s.id));
          return;
        }
      }

      // Check for mirror vertical binding
      const mirrorVBinding = keyMappings.mirrorVertical;
      if (mirrorVBinding && matchesBinding(e, mirrorVBinding)) {
        if (selectedShapes.length > 0) {
          e.preventDefault();
          onMirrorVertical(selectedShapes.map(s => s.id));
          return;
        }
      }

      // Check for toggle grid binding
      const toggleGridBinding = keyMappings.toggleGrid;
      if (toggleGridBinding && matchesBinding(e, toggleGridBinding)) {
        e.preventDefault();
        onToggleGrid?.();
        return;
      }

      // Check for select all binding
      const selectAllBinding = keyMappings.selectAll;
      if (selectAllBinding && matchesBinding(e, selectAllBinding)) {
        e.preventDefault();
        onSelectAll();
        return;
      }

      // Check for deselect all binding
      const deselectAllBinding = keyMappings.deselectAll;
      if (deselectAllBinding && matchesBinding(e, deselectAllBinding)) {
        e.preventDefault();
        onDeselectAll();
        return;
      }

      // Check for bring forward binding
      const bringForwardBinding = keyMappings.bringForward;
      if (bringForwardBinding && matchesBinding(e, bringForwardBinding)) {
        if (selectedShapes.length > 0) {
          e.preventDefault();
          onBringForward();
          return;
        }
      }

      // Check for send backward binding
      const sendBackwardBinding = keyMappings.sendBackward;
      if (sendBackwardBinding && matchesBinding(e, sendBackwardBinding)) {
        if (selectedShapes.length > 0) {
          e.preventDefault();
          onSendBackward();
          return;
        }
      }

      // Color shortcuts
      if (onSetColorIndex) {
        const color1Binding = keyMappings.setColor1;
        const color2Binding = keyMappings.setColor2;
        const color3Binding = keyMappings.setColor3;
        if (color1Binding && matchesBinding(e, color1Binding)) {
          e.preventDefault(); onSetColorIndex(0); return;
        }
        if (color2Binding && matchesBinding(e, color2Binding)) {
          e.preventDefault(); onSetColorIndex(1); return;
        }
        if (color3Binding && matchesBinding(e, color3Binding)) {
          e.preventDefault(); onSetColorIndex(2); return;
        }
      }

      // Movement, rotation, and resize shortcuts require selected shapes
      if (!hasSelection) return;

      // Step sizes: Shift = 10x (large), Alt/Opt = 0.2x (fine), default = 1x
      const FINE_MOVE = 0.2;
      const SMALL_MOVE = 1;
      const LARGE_MOVE = 10;
      const FINE_ROTATE = 0.2;
      const SMALL_ROTATE = 1;
      const LARGE_ROTATE = 15;
      const FINE_RESIZE = 1;
      const SMALL_RESIZE = 5;
      const LARGE_RESIZE = 50;

      const stepMultiplier = e.shiftKey ? 'large' : e.altKey ? 'fine' : 'normal';
      const moveStep = stepMultiplier === 'large' ? LARGE_MOVE : stepMultiplier === 'fine' ? FINE_MOVE : SMALL_MOVE;
      const rotateStep = stepMultiplier === 'large' ? LARGE_ROTATE : stepMultiplier === 'fine' ? FINE_ROTATE : SMALL_ROTATE;
      const resizeStep = stepMultiplier === 'large' ? LARGE_RESIZE : stepMultiplier === 'fine' ? FINE_RESIZE : SMALL_RESIZE;

      let dx = 0;
      let dy = 0;
      let dRotation = 0;
      let dSize = 0;

      // Check movement/rotation/size bindings (ignore shift/alt modifier for key matching — they control step size)
      const moveUpBinding = keyMappings.moveUp;
      const moveDownBinding = keyMappings.moveDown;
      const moveLeftBinding = keyMappings.moveLeft;
      const moveRightBinding = keyMappings.moveRight;
      const rotateClockwiseBinding = keyMappings.rotateClockwise;
      const rotateCounterClockwiseBinding = keyMappings.rotateCounterClockwise;
      const sizeIncreaseBinding = keyMappings.sizeIncrease;
      const sizeDecreaseBinding = keyMappings.sizeDecrease;

      // For these actions, we only check the key code (shift/alt control step size)
      if (moveUpBinding && e.code === moveUpBinding.key) {
        dy = -moveStep;
      } else if (moveDownBinding && e.code === moveDownBinding.key) {
        dy = moveStep;
      } else if (moveLeftBinding && e.code === moveLeftBinding.key) {
        dx = -moveStep;
      } else if (moveRightBinding && e.code === moveRightBinding.key) {
        dx = moveStep;
      } else if (rotateClockwiseBinding && e.code === rotateClockwiseBinding.key) {
        dRotation = rotateStep;
      } else if (rotateCounterClockwiseBinding && e.code === rotateCounterClockwiseBinding.key) {
        dRotation = -rotateStep;
      } else if (sizeIncreaseBinding && e.code === sizeIncreaseBinding.key) {
        dSize = resizeStep;
      } else if (sizeDecreaseBinding && e.code === sizeDecreaseBinding.key) {
        dSize = -resizeStep;
      } else {
        return;
      }

      e.preventDefault();

      if (dx !== 0 || dy !== 0) {
        const updates = new Map<string, Partial<Shape>>();
        selectedShapes.forEach(shape => {
          updates.set(shape.id, {
            x: shape.x + dx,
            y: shape.y + dy,
          });
        });
        onUpdateShapes(updates, true, 'Move');
      }

      if (dRotation !== 0) {
        const updates = new Map<string, Partial<Shape>>();
        selectedShapes.forEach(shape => {
          updates.set(shape.id, {
            rotation: shape.rotation + dRotation,
          });
        });
        onUpdateShapes(updates, true, 'Rotate');
      }

      if (dSize !== 0) {
        onResizeShapes(dSize);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
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
  ]);
}
