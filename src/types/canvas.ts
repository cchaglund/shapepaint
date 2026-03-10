// Canvas-specific types for drag, touch, and context menu state

export type DragMode = 'none' | 'move' | 'resize' | 'rotate';

export interface DragState {
  mode: DragMode;
  shapeId: string;
  startX: number;
  startY: number;
  startShapeX: number;
  startShapeY: number;
  startSize: number;
  startRotation: number;
  resizeCorner: string;
  // Actual rendered dimensions (accounts for aspect ratio)
  startWidth?: number;
  startHeight?: number;
  // Store flip state to compensate for inverted coordinates
  flipX?: boolean;
  flipY?: boolean;
  // For multi-select: store start positions and sizes of all selected shapes
  startPositions?: Map<string, { x: number; y: number }>;
  startShapeData?: Map<string, { x: number; y: number; size: number; rotation: number; width: number; height: number }>;
  // For multi-select resize/rotate: store the initial bounds
  startBounds?: { x: number; y: number; width: number; height: number };
}

export interface TouchState {
  // Single touch tracking
  startPoint: { x: number; y: number; clientX: number; clientY: number } | null;
  currentPoint: { x: number; y: number } | null;
  touchedShapeId: string | null;
  isDragging: boolean;
  hasMoved: boolean;
  longPressTimer: ReturnType<typeof setTimeout> | null;
  isLongPress: boolean;

  // Multi-touch (pinch/rotate) tracking
  isMultiTouch: boolean;
  startDistance: number;
  startAngle: number;
  startCenter: { x: number; y: number };
  startShapeData: Map<string, { x: number; y: number; size: number; rotation: number; width: number; height: number }> | null;
  // For canvas zoom when no shapes selected
  startZoom: number;
  startPanX: number;
  startPanY: number;
}

export interface ContextMenuState {
  isOpen: boolean;
  x: number;
  y: number;
  shapeId: string | null;
}

export interface SelectionBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Canvas constants
export const CANVAS_SIZE = 800;
export const LONG_PRESS_DURATION = 500; // ms
export const TAP_THRESHOLD = 10; // pixels of movement allowed for a tap
