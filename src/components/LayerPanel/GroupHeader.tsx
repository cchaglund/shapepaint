import type { GroupHeaderProps } from './types';

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
  onToggleGroupVisibility: _onToggleGroupVisibility,
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

  return (
    <li
      draggable={editingGroupId !== group.id}
      onDragStart={(e) => onGroupDragStart(e, group.id)}
      onDragEnd={onGroupDragEnd}
      onDragOver={(e) => onGroupDragOver(e, topLevelIndex)}
      onDrop={(e) => onGroupDrop(e, topLevelIndex)}
      className={`group relative flex items-center gap-1.5 py-1 px-2 rounded-(--radius-sm) cursor-grab transition-colors ${
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
        <svg
          width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"
          style={{ transform: group.isCollapsed ? 'rotate(-90deg)' : 'rotate(0)', transition: 'transform 0.15s' }}
        >
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </button>

      {/* Folder icon */}
      <svg className="shrink-0 text-(--color-text-secondary)" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
      </svg>

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
          className="flex-1 text-xs overflow-hidden text-ellipsis whitespace-nowrap cursor-text font-semibold text-(--color-text-primary)"
          onDoubleClick={(e) => {
            e.stopPropagation();
            onStartEditingGroup(group);
          }}
        >
          {group.name}
        </span>
      )}

      {/* Count */}
      <span className="text-xs font-medium text-(--color-text-tertiary) shrink-0">
        {shapesInGroup.length}
      </span>

      {/* Ungroup icon button */}
      <button
        className="w-4 h-4 flex items-center justify-center shrink-0 bg-transparent border-none cursor-pointer rounded text-(--color-text-tertiary) hover:text-(--color-text-primary) hover:bg-(--color-hover) transition-colors"
        onClick={(e) => {
          e.stopPropagation();
          onUngroupShapes(shapesInGroup.map(s => s.id));
        }}
        title="Ungroup"
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="2" width="8" height="8" rx="1" />
          <rect x="14" y="14" width="8" height="8" rx="1" />
          <path d="M14 7h3M7 14v3" />
        </svg>
      </button>

      {/* Group actions: top / up / down / bottom / delete */}
      <div className="flex gap-0.5 shrink-0">
        <button
          className="w-3.5 h-3.5 p-0 bg-transparent border-none cursor-pointer flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed text-(--color-text-secondary) hover:enabled:text-(--color-text-primary) rounded-(--radius-sm)"
          title="Move to top"
          disabled={isTop}
          onClick={(e) => {
            e.stopPropagation();
            onMoveGroup(group.id, 'top');
          }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m18 11-6-6-6 6"/><path d="M5 19h14"/></svg>
        </button>
        <button
          className="w-3.5 h-3.5 p-0 bg-transparent border-none cursor-pointer flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed text-(--color-text-secondary) hover:enabled:text-(--color-text-primary) rounded-(--radius-sm)"
          title="Move up"
          disabled={isTop}
          onClick={(e) => {
            e.stopPropagation();
            onMoveGroup(group.id, 'up');
          }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6"/></svg>
        </button>
        <button
          className="w-3.5 h-3.5 p-0 bg-transparent border-none cursor-pointer flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed text-(--color-text-secondary) hover:enabled:text-(--color-text-primary) rounded-(--radius-sm)"
          title="Move down"
          disabled={isBottom}
          onClick={(e) => {
            e.stopPropagation();
            onMoveGroup(group.id, 'down');
          }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
        </button>
        <button
          className="w-3.5 h-3.5 p-0 bg-transparent border-none cursor-pointer flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed text-(--color-text-secondary) hover:enabled:text-(--color-text-primary) rounded-(--radius-sm)"
          title="Move to bottom"
          disabled={isBottom}
          onClick={(e) => {
            e.stopPropagation();
            onMoveGroup(group.id, 'bottom');
          }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 13 6 6 6-6"/><path d="M5 5h14"/></svg>
        </button>
        <button
          className="w-3.5 h-3.5 p-0 bg-transparent border-none cursor-pointer flex items-center justify-center text-(--color-accent) rounded-(--radius-sm)"
          title="Delete group and shapes"
          onClick={(e) => {
            e.stopPropagation();
            onDeleteGroup(group.id);
          }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      </div>
    </li>
  );
}
