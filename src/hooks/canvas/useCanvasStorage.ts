import { useEffect, useRef, useCallback } from 'react';
import type { Shape, ShapeGroup, CanvasState } from '../../types';
import { getTodayDateUTC } from '../../utils/dailyChallenge';

const STORAGE_KEY = '2colors2shapes_canvas';
const SAVE_DEBOUNCE_MS = 300;

interface StoredData {
  date: string;
  userId?: string;
  canvas: CanvasState;
}

function loadFromStorage(): StoredData | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Failed to load from localStorage:', e);
  }
  return null;
}

function saveToStorage(data: StoredData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save to localStorage:', e);
  }
}

export const initialCanvasState: CanvasState = {
  shapes: [],
  groups: [],
  backgroundColorIndex: 0,
  selectedShapeIds: new Set<string>(),
};

/**
 * Load initial canvas state from localStorage.
 * Returns stored state if it matches today's date, otherwise returns initialCanvasState.
 * Called once during useState initialization.
 */
export function getInitialCanvasState(): CanvasState {
  const stored = loadFromStorage();
  if (stored && stored.date === getTodayDateUTC()) {
    const canvas = stored.canvas;
    return {
      shapes: canvas.shapes,
      groups: canvas.groups || [],
      backgroundColorIndex: canvas.backgroundColorIndex,
      selectedShapeIds: new Set<string>(),
    };
  }
  // Clear stale localStorage data from previous days
  if (stored) {
    localStorage.removeItem(STORAGE_KEY);
  }
  return initialCanvasState;
}

/**
 * Hook that manages localStorage persistence for canvas state.
 * - Debounced auto-save on canvasState changes
 * - Immediate save via saveCanvasState() for external loads
 */
export function useCanvasStorage(canvasState: CanvasState, userId: string | undefined) {
  const userIdRef = useRef(userId);
  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced save on canvasState changes
  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveToStorage({
        date: getTodayDateUTC(),
        userId: userIdRef.current,
        canvas: canvasState,
      });
    }, SAVE_DEBOUNCE_MS);

    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [canvasState]);

  /**
   * Save canvas state to localStorage immediately (no debounce).
   * Used when loading external state (server submissions).
   */
  const saveCanvasStateNow = useCallback(
    (shapes: Shape[], groups: ShapeGroup[], backgroundColorIndex: number | null) => {
      saveToStorage({
        date: getTodayDateUTC(),
        userId: userIdRef.current,
        canvas: {
          shapes,
          groups,
          backgroundColorIndex,
          selectedShapeIds: new Set<string>(),
        },
      });
    },
    []
  );

  return { saveCanvasStateNow };
}
