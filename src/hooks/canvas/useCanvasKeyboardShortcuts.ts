import { useEffect } from 'react';
import type { Shape } from '../../types';
import { type KeyMappings, matchesBinding } from '../../constants/keyboardActions';

interface UseCanvasKeyboardShortcutsOptions {
  selectedShapes: Shape[];
  hasSelection: boolean;
  keyMappings: KeyMappings;
  onUpdateShapes: (updates: Map<string, Partial<Shape>>, addToHistory?: boolean, label?: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  onDuplicateShapes: (ids: string[]) => void;
  onDeleteSelectedShapes: () => void;
  onMirrorHorizontal: (ids: string[]) => void;
  onMirrorVertical: (ids: string[]) => void;
  onToggleGrid?: () => void;
}

/**
 * Hook for handling keyboard shortcuts (movement, rotation, undo/redo, duplicate, etc.)
 */
export function useCanvasKeyboardShortcuts({
  selectedShapes,
  hasSelection,
  keyMappings,
  onUpdateShapes,
  onUndo,
  onRedo,
  onDuplicateShapes,
  onDeleteSelectedShapes,
  onMirrorHorizontal,
  onMirrorVertical,
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

      // Check for duplicate binding - only when shapes are selected
      const duplicateBinding = keyMappings.duplicate;
      if (duplicateBinding && matchesBinding(e, duplicateBinding)) {
        if (selectedShapes.length > 0) {
          e.preventDefault();
          onDuplicateShapes(selectedShapes.map(s => s.id));
          return;
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

      // Movement and rotation shortcuts require selected shapes
      if (!hasSelection) return;

      const SMALL_MOVE = 1;
      const LARGE_MOVE = 10;
      const SMALL_ROTATE = 1;
      const LARGE_ROTATE = 15;

      const moveStep = e.shiftKey ? LARGE_MOVE : SMALL_MOVE;
      const rotateStep = e.shiftKey ? LARGE_ROTATE : SMALL_ROTATE;

      let dx = 0;
      let dy = 0;
      let dRotation = 0;

      // Check movement bindings (ignore shift modifier for movement keys)
      const moveUpBinding = keyMappings.moveUp;
      const moveDownBinding = keyMappings.moveDown;
      const moveLeftBinding = keyMappings.moveLeft;
      const moveRightBinding = keyMappings.moveRight;
      const rotateClockwiseBinding = keyMappings.rotateClockwise;
      const rotateCounterClockwiseBinding = keyMappings.rotateCounterClockwise;

      // For movement, we only check the key code (shift is used for step size)
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
      } else {
        return;
      }

      e.preventDefault();

      if (dx !== 0 || dy !== 0) {
        // Move all selected shapes
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
        // Rotate all selected shapes
        const updates = new Map<string, Partial<Shape>>();
        selectedShapes.forEach(shape => {
          updates.set(shape.id, {
            rotation: shape.rotation + dRotation,
          });
        });
        onUpdateShapes(updates, true, 'Rotate');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    selectedShapes,
    hasSelection,
    keyMappings,
    onUpdateShapes,
    onUndo,
    onRedo,
    onDuplicateShapes,
    onDeleteSelectedShapes,
    onMirrorHorizontal,
    onMirrorVertical,
    onToggleGrid,
  ]);
}
