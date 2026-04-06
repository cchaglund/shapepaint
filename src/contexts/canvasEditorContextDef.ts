import { createContext, type RefObject } from 'react';
import type { Shape, CanvasState, DailyChallenge, ViewportState } from '../types';
import type { KeyMappings } from '../constants/keyboardActions';
import type { UndoRedoToast } from '../hooks/canvas/useCanvasState';

export interface CanvasEditorContextValue {
  canvasState: CanvasState;
  challenge: DailyChallenge;
  backgroundColor: string | null;

  viewport: ViewportState;
  zoomAtPoint: (delta: number, pointX: number, pointY: number) => void;
  setZoomAtPoint: (startZoom: number, scale: number, cx: number, cy: number, startPanX: number, startPanY: number) => void;
  setPan: (panX: number, panY: number) => void;

  addShape: (shapeIndex: number, colorIndex: number, options?: { x?: number; y?: number; size?: number }) => void;
  selectShape: (id: string | null, options?: { toggle?: boolean; range?: boolean; orderedIds?: string[] }) => void;
  selectShapes: (ids: string[], options?: { additive?: boolean }) => void;
  updateShape: (id: string, updates: Partial<Shape>, addToHistory?: boolean, label?: string) => void;
  updateShapes: (updates: Map<string, Partial<Shape>>, addToHistory?: boolean, label?: string) => void;
  commitToHistory: (label?: string) => void;
  duplicateShapes: (ids: string[]) => void;
  lastDuplicatedIdsRef: RefObject<string[]>;
  pendingAnimationIdsRef: RefObject<string[]>;
  deleteShape: (id: string) => void;
  deleteSelectedShapes: () => void;
  setBackgroundColor: (colorIndex: number | null) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  mirrorHorizontal: (ids: string[]) => void;
  mirrorVertical: (ids: string[]) => void;
  moveLayer: (id: string, direction: 'up' | 'down' | 'top' | 'bottom') => void;

  moveGroup: (groupId: string, direction: 'up' | 'down' | 'top' | 'bottom') => void;
  reorderLayers: (draggedId: string, targetIndex: number, targetGroupId: string | null) => void;
  reorderGroup: (draggedGroupId: string, targetTopLevelIndex: number) => void;
  createGroup: (shapeIds: string[], groupName?: string) => void;
  deleteGroup: (groupId: string) => void;
  ungroupShapes: (shapeIds: string[]) => void;
  renameGroup: (groupId: string, newName: string) => void;
  toggleGroupCollapsed: (groupId: string) => void;
  toggleShapeVisibility: (shapeId: string) => void;
  toggleGroupVisibility: (groupId: string) => void;
  toggleShapeLock: (shapeId: string) => void;
  toggleGroupLock: (groupId: string) => void;
  selectGroup: (groupId: string, options?: { toggle?: boolean }) => void;

  keyMappings: KeyMappings;
  showGrid: boolean;
  showOffCanvas: boolean;
  toggleGrid: () => void;

  hoveredShapeIds: Set<string> | null;
  setHoveredShapeIds: (ids: Set<string> | null) => void;

  toast: UndoRedoToast | null;
  dismissToast: () => void;
}

export const CanvasEditorContext = createContext<CanvasEditorContextValue | null>(null);
