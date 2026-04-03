import type { Shape, ShapeGroup, DailyChallenge } from '../../types';

export interface LayerPanelProps {
  onToggle: () => void;
}

// Helper type for rendering grouped and ungrouped shapes
export interface LayerItem {
  type: 'shape' | 'group-header';
  shape?: Shape;
  group?: ShapeGroup;
  shapesInGroup?: Shape[];
  belongsToGroupId?: string; // Track which group this item belongs to for drag-drop
  isTopItem?: boolean; // For group headers: is this group at the top of the unified list
  isBottomItem?: boolean; // For group headers: is this group at the bottom of the unified list
  topLevelIndex?: number; // Index in the unified top-level list (for drag-drop)
}

export interface LayerItemProps {
  shape: Shape;
  index: number;
  isInGroup: boolean;
  groupId: string | null;
  challenge: DailyChallenge;
  selectedShapeIds: Set<string>;
  editingId: string | null;
  editValue: string;
  draggedId: string | null;
  dropTargetIndex: number | null;
  isTopLayer: boolean;
  isBottomLayer: boolean;
  layerHint: string;
  onLayerClick: (e: React.MouseEvent, shapeId: string) => void;
  onStartEditing: (shape: Shape) => void;
  onEditValueChange: (value: string) => void;
  onFinishEditing: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onDragStart: (e: React.DragEvent, shapeId: string) => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent, index: number, groupId: string | null) => void;
  onDrop: (e: React.DragEvent, targetIndex: number, targetGroupId: string | null) => void;
  onMoveLayer: (id: string, direction: 'up' | 'down' | 'top' | 'bottom') => void;
  onDeleteShape: (id: string) => void;
  onToggleVisibility: (id: string) => void;
  onToggleLock: (id: string) => void;
  onHoverShape: (ids: Set<string> | null) => void;
  groupVisible: boolean;
  groupLocked: boolean;
}

export interface GroupHeaderProps {
  group: ShapeGroup;
  shapesInGroup: Shape[];
  selectedShapeIds: Set<string>;
  editingGroupId: string | null;
  editValue: string;
  isTouchDevice: boolean;
  isMultiSelectMode: boolean;
  modifierKeyHint: string;
  isTop: boolean;
  isBottom: boolean;
  topLevelIndex: number;
  draggedGroupId: string | null;
  dropTargetTopLevelIndex: number | null;
  onGroupClick: (e: React.MouseEvent, groupId: string) => void;
  onStartEditingGroup: (group: ShapeGroup) => void;
  onEditValueChange: (value: string) => void;
  onFinishEditing: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onToggleGroupCollapsed: (groupId: string) => void;
  onToggleGroupVisibility: (groupId: string) => void;
  onToggleGroupLock: (groupId: string) => void;
  onDeleteGroup: (groupId: string) => void;
  onMoveGroup: (groupId: string, direction: 'up' | 'down' | 'top' | 'bottom') => void;
  onGroupDragStart: (e: React.DragEvent, groupId: string) => void;
  onGroupDragEnd: () => void;
  onGroupDragOver: (e: React.DragEvent, topLevelIndex: number) => void;
  onGroupDrop: (e: React.DragEvent, targetTopLevelIndex: number) => void;
  onHoverShape: (ids: Set<string> | null) => void;
  onUngroupShapes: (shapeIds: string[]) => void;
}
