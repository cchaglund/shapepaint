import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import type { ViewportState } from '../../types';
import type { KeyMappings } from '../../constants/keyboardActions';

/**
 * Hook for canvas panning via spacebar+drag or middle mouse button drag.
 */
export function useCanvasPanning(
  viewport: ViewportState,
  keyMappings: KeyMappings,
  getClientPoint: (clientX: number, clientY: number) => { x: number; y: number },
  onPan: (panX: number, panY: number) => void
) {
  const [panMode, setPanMode] = useState(false); // space held or middle mouse active
  const [isDragging, setIsDragging] = useState(false);
  const panStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);

  // Keep latest values in refs so the drag listener doesn't re-register every frame
  const viewportRef = useRef(viewport);
  const getClientPointRef = useRef(getClientPoint);
  const onPanRef = useRef(onPan);
  useLayoutEffect(() => {
    viewportRef.current = viewport;
    getClientPointRef.current = getClientPoint;
    onPanRef.current = onPan;
  });

  // Start a pan drag from a given mouse position
  const startPan = useCallback((clientX: number, clientY: number) => {
    const point = getClientPointRef.current(clientX, clientY);
    panStartRef.current = {
      x: point.x,
      y: point.y,
      panX: viewportRef.current.panX,
      panY: viewportRef.current.panY,
    };
    setIsDragging(true);
  }, []);

  const stopPan = useCallback(() => {
    panStartRef.current = null;
    setIsDragging(false);
  }, []);

  // Spacebar activates pan mode (user then clicks to start dragging)
  useEffect(() => {
    const panKey = keyMappings.pan?.key || 'Space';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === panKey && !e.repeat) {
        e.preventDefault();
        setPanMode(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === panKey) {
        setPanMode(false);
        stopPan();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [keyMappings.pan, stopPan]);

  // Mouse listeners: space+click starts pan, middle mouse starts pan directly
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 1) {
        // Middle mouse: enter pan mode and start dragging immediately
        e.preventDefault();
        setPanMode(true);
        startPan(e.clientX, e.clientY);
      } else if (panStartRef.current === null && panMode) {
        // Space is held: any click starts the drag
        e.preventDefault();
        startPan(e.clientX, e.clientY);
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!panStartRef.current) return;
      const point = getClientPointRef.current(e.clientX, e.clientY);
      const dx = point.x - panStartRef.current.x;
      const dy = point.y - panStartRef.current.y;
      onPanRef.current(panStartRef.current.panX + dx, panStartRef.current.panY + dy);
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 1) {
        // Middle mouse released: exit pan mode entirely
        setPanMode(false);
        stopPan();
      } else {
        // Left mouse released during space-pan: stop drag but stay in pan mode
        stopPan();
      }
    };

    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [panMode, startPan, stopPan]);

  const cursorStyle = panMode ? (isDragging ? 'grabbing' : 'grab') : 'default';

  return { isSpacePressed: panMode, isPanning: isDragging, cursorStyle };
}
