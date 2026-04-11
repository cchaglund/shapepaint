import { useState, useCallback } from 'react';
import type { ViewportState } from '../../types';

const MIN_ZOOM = 0.25; // 25%
const MAX_ZOOM = 5; // 500%
const ZOOM_STEP = 0.05; // 5% per scroll notch (reduced from 10% for finer control)

const initialViewportState: ViewportState = {
  zoom: 1,
  panX: 0,
  panY: 0,
};

export function useViewportState() {
  const [viewport, setViewport] = useState<ViewportState>(initialViewportState);

  const setZoom = useCallback((zoom: number) => {
    setViewport((prev) => ({
      ...prev,
      zoom: Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom)),
    }));
  }, []);

  const setPan = useCallback((panX: number, panY: number) => {
    setViewport((prev) => ({
      ...prev,
      panX,
      panY,
    }));
  }, []);

  const zoomAtPoint = useCallback(
    (delta: number, pointX: number, pointY: number) => {
      setViewport((prev) => {
        const newZoom = Math.max(
          MIN_ZOOM,
          Math.min(MAX_ZOOM, prev.zoom + delta * ZOOM_STEP)
        );

        if (newZoom === prev.zoom) return prev;

        // Zoom toward cursor: adjust pan so the point stays in the same position
        const zoomRatio = newZoom / prev.zoom;
        const newPanX = pointX - (pointX - prev.panX) * zoomRatio;
        const newPanY = pointY - (pointY - prev.panY) * zoomRatio;

        return {
          zoom: newZoom,
          panX: newPanX,
          panY: newPanY,
        };
      });
    },
    []
  );

  // For pinch zoom: set zoom to a specific value, zooming around a center point
  // startZoom is the zoom level when the pinch started
  // scale is the pinch scale factor (1.0 = no change)
  // centerX/Y is the pinch center point in canvas coordinates
  // startPanX/Y are the pan values when the pinch started
  const setZoomAtPoint = useCallback(
    (
      startZoom: number,
      scale: number,
      centerX: number,
      centerY: number,
      startPanX: number,
      startPanY: number
    ) => {
      const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, startZoom * scale));

      // Zoom toward pinch center: adjust pan so the center point stays fixed
      const zoomRatio = newZoom / startZoom;
      const newPanX = centerX - (centerX - startPanX) * zoomRatio;
      const newPanY = centerY - (centerY - startPanY) * zoomRatio;

      setViewport({
        zoom: newZoom,
        panX: newPanX,
        panY: newPanY,
      });
    },
    []
  );

  const resetViewport = useCallback(() => {
    setViewport(initialViewportState);
  }, []);

  return {
    viewport,
    setZoom,
    setPan,
    zoomAtPoint,
    setZoomAtPoint,
    resetViewport,
    minZoom: MIN_ZOOM,
    maxZoom: MAX_ZOOM,
  };
}
