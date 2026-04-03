import { ChevronDown, ChevronUp, ChevronsUp, ChevronsDown, Folder, X } from 'lucide-react';
import type { GroupHeaderProps } from './types';
import { VisibilityToggle } from './VisibilityToggle';
import { LockToggle } from './LockToggle';

/**
 * Renders a group header in the layer panel
 */
export function GroupHeader({
  group,
  shapesInGroup,
  selectedShapeIds,
  editingGroupId,
  editValue,
  isTouchDevice,
  isMultiSelectMode,
  modifierKeyHint,
  isTop,
  isBottom,
  topLevelIndex,
  draggedGroupId,
  dropTargetTopLevelIndex,
  onGroupClick,
  onStartEditingGroup,
  onEditValueChange,
  onFinishEditing,
  onKeyDown,
  onToggleGroupCollapsed,
  onToggleGroupVisibility,
  onToggleGroupLock,
  onDeleteGroup,
  onMoveGroup,
  onGroupDragStart,
  onGroupDragEnd,
  onGroupDragOver,
  onGroupDrop,
  onHoverShape,
  onUngroupShapes,
}: GroupHeaderProps) {
  // Check if all shapes in group are selected
  const allSelected = shapesInGroup.every((s) => selectedShapeIds.has(s.id));
  const someSelected = shapesInGroup.some((s) => selectedShapeIds.has(s.id));

  const isDragging = draggedGroupId === group.id;
  const isDropTarget = dropTargetTopLevelIndex === topLevelIndex && draggedGroupId !== group.id;
  const isGroupVisible = group.visible !== false;
  const isGroupLocked = group.locked === true;

  return (
    <li
      draggable={editingGroupId !== group.id && !isGroupLocked}
      onDragStart={(e) => onGroupDragStart(e, group.id)}
      onDragEnd={onGroupDragEnd}
      onDragOver={(e) => onGroupDragOver(e, topLevelIndex)}
      onDrop={(e) => onGroupDrop(e, topLevelIndex)}
      className={`group relative flex items-center gap-1.5 py-1 px-2 rounded-(--radius-sm) select-none transition-colors ${
        isGroupLocked ? 'cursor-default' : 'cursor-grab'
      } ${
        isDragging ? 'opacity-50' : ''
      } ${
        isDropTarget ? 'border-t-2 border-(--color-accent)' : ''
      } ${
        allSelected
          ? 'bg-(--color-selected)'
          : someSelected
          ? 'bg-(--color-selected-partial) hover:bg-(--color-hover)'
          : 'hover:bg-(--color-hover)'
      } ${!isGroupVisible ? 'opacity-50' : ''}`}
      onClick={(e) => onGroupClick(e, group.id)}
      onMouseEnter={() => onHoverShape(new Set(shapesInGroup.map(s => s.id)))}
      onMouseLeave={() => onHoverShape(null)}
      title={isTouchDevice
        ? (isMultiSelectMode ? 'Tap to toggle group selection' : 'Tap to select group')
        : `Click to select all shapes in group, ${modifierKeyHint}+click to add to selection`}
    >
      {/* Collapse/expand chevron */}
      <button
        className="w-4 h-4 flex items-center justify-center shrink-0 bg-transparent border-none cursor-pointer rounded text-(--color-text-secondary)"
        onClick={(e) => {
          e.stopPropagation();
          onToggleGroupCollapsed(group.id);
        }}
        title={group.isCollapsed ? 'Expand group' : 'Collapse group'}
      >
        <ChevronDown
          size={10}
          strokeWidth={3}
          style={{ transform: group.isCollapsed ? 'rotate(-90deg)' : 'rotate(0)', transition: 'transform 0.15s' }}
        />
      </button>

      {/* Folder icon */}
      <Folder size={12} strokeWidth={2.5} className="shrink-0 text-(--color-text-secondary)" />

      {/* Group name */}
      {editingGroupId === group.id ? (
        <input
          className="flex-1 text-xs py-0.5 px-1 border border-(--color-accent) rounded-(--radius-sm) outline-none min-w-0 font-semibold bg-(--color-bg-primary) text-(--color-text-primary)"
          value={editValue}
          onChange={(e) => onEditValueChange(e.target.value)}
          onBlur={onFinishEditing}
          onKeyDown={onKeyDown}
          onClick={(e) => e.stopPropagation()}
          autoFocus
        />
      ) : (
        <span
          className="text-xs overflow-hidden text-ellipsis whitespace-nowrap font-semibold text-(--color-text-primary)"
          title={isGroupLocked ? undefined : 'Double-click to rename'}
          onDoubleClick={isGroupLocked ? undefined : (e) => {
            e.stopPropagation();
            onStartEditingGroup(group);
          }}
        >
          {group.name}
        </span>
      )}

      {/* Visibility, lock, ungroup controls */}
      <div className="flex gap-[0.1rem] shrink-0 items-center">
        <VisibilityToggle
          visible={isGroupVisible}
          onToggle={(e) => {
            e.stopPropagation();
            onToggleGroupVisibility(group.id);
          }}
        />

        <LockToggle
          locked={isGroupLocked}
          onToggle={(e) => {
            e.stopPropagation();
            onToggleGroupLock(group.id);
          }}
        />

        {/* Ungroup icon button */}
        <button
          className="w-5 h-5 flex items-center justify-center shrink-0 bg-transparent border-none cursor-pointer rounded text-(--color-text-tertiary) hover:text-(--color-text-primary) hover:bg-(--color-hover) transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          disabled={isGroupLocked}
          onClick={(e) => {
            e.stopPropagation();
            onUngroupShapes(shapesInGroup.map(s => s.id));
          }}
          title={isGroupLocked ? 'Unlock group to ungroup' : 'Ungroup'}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="2" width="8" height="8" rx="1" />
            <rect x="14" y="14" width="8" height="8" rx="1" />
            <path d="M14 7h3M7 14v3" />
          </svg>
        </button>
      </div>

      {/* Group actions: top / up / down / bottom / delete */}
      <div className="flex gap-0.5 shrink-0 ml-auto">
        <button
          className="w-3.5 h-3.5 p-0 bg-transparent border-none cursor-pointer flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed text-(--color-text-secondary) hover:enabled:text-(--color-text-primary) rounded-(--radius-sm)"
          title="Move to top"
          disabled={isTop || isGroupLocked}
          onClick={(e) => {
            e.stopPropagation();
            onMoveGroup(group.id, 'top');
          }}
        >
          <ChevronsUp size={10} strokeWidth={2.5} />
        </button>
        <button
          className="w-3.5 h-3.5 p-0 bg-transparent border-none cursor-pointer flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed text-(--color-text-secondary) hover:enabled:text-(--color-text-primary) rounded-(--radius-sm)"
          title="Move up"
          disabled={isTop || isGroupLocked}
          onClick={(e) => {
            e.stopPropagation();
            onMoveGroup(group.id, 'up');
          }}
        >
          <ChevronUp size={10} strokeWidth={2.5} />
        </button>
        <button
          className="w-3.5 h-3.5 p-0 bg-transparent border-none cursor-pointer flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed text-(--color-text-secondary) hover:enabled:text-(--color-text-primary) rounded-(--radius-sm)"
          title="Move down"
          disabled={isBottom || isGroupLocked}
          onClick={(e) => {
            e.stopPropagation();
            onMoveGroup(group.id, 'down');
          }}
        >
          <ChevronDown size={10} strokeWidth={2.5} />
        </button>
        <button
          className="w-3.5 h-3.5 p-0 bg-transparent border-none cursor-pointer flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed text-(--color-text-secondary) hover:enabled:text-(--color-text-primary) rounded-(--radius-sm)"
          title="Move to bottom"
          disabled={isBottom || isGroupLocked}
          onClick={(e) => {
            e.stopPropagation();
            onMoveGroup(group.id, 'bottom');
          }}
        >
          <ChevronsDown size={10} strokeWidth={2.5} />
        </button>
        <button
          className="w-3.5 h-3.5 p-0 bg-transparent border-none cursor-pointer flex items-center justify-center text-(--color-accent) rounded-(--radius-sm) disabled:opacity-30 disabled:cursor-not-allowed"
          title="Delete group and shapes"
          disabled={isGroupLocked}
          onClick={(e) => {
            e.stopPropagation();
            onDeleteGroup(group.id);
          }}
        >
          <X size={10} strokeWidth={2.5} />
        </button>
      </div>
    </li>
  );
}
