import { useState } from 'react';
import type { KeyMappings } from '../../constants/keyboardActions';
import { formatKeyBinding, getDefaultMappings } from '../../constants/keyboardActions';

// --- SVG Icon components (18x18, viewBox 0 0 24 24) ---

const CollapseIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

const UndoIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 7v6h6" />
    <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6.36 2.64L3 13" />
  </svg>
);

const RedoIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 7v6h-6" />
    <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6.36 2.64L21 13" />
  </svg>
);

const DuplicateIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const DeleteIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

const MoveUpIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="19" x2="12" y2="5" />
    <polyline points="5 12 12 5 19 12" />
  </svg>
);

const MoveDownIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" />
    <polyline points="19 12 12 19 5 12" />
  </svg>
);

const MoveLeftIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </svg>
);

const MoveRightIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
);

const SizeDecreaseIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="4 14 10 14 10 20" />
    <polyline points="20 10 14 10 14 4" />
    <line x1="14" y1="10" x2="21" y2="3" />
    <line x1="3" y1="21" x2="10" y2="14" />
  </svg>
);

const SizeIncreaseIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 3 21 3 21 9" />
    <polyline points="9 21 3 21 3 15" />
    <line x1="21" y1="3" x2="14" y2="10" />
    <line x1="3" y1="21" x2="10" y2="14" />
  </svg>
);

const MirrorHorizontalIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="3" x2="12" y2="21" />
    <polyline points="16 7 20 12 16 17" />
    <polyline points="8 7 4 12 8 17" />
  </svg>
);

const MirrorVerticalIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="12" x2="21" y2="12" />
    <polyline points="7 8 12 4 17 8" />
    <polyline points="7 16 12 20 17 16" />
  </svg>
);

const BringForwardIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="8" y="2" width="14" height="14" rx="2" />
    <rect x="2" y="8" width="14" height="14" rx="2" fill="var(--color-bg-primary, white)" />
  </svg>
);

const SendBackwardIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="14" height="14" rx="2" />
    <rect x="8" y="8" width="14" height="14" rx="2" fill="var(--color-bg-primary, white)" />
  </svg>
);

const GridIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <line x1="8" y1="2" x2="8" y2="22" />
    <line x1="16" y1="2" x2="16" y2="22" />
    <line x1="2" y1="8" x2="22" y2="8" />
    <line x1="2" y1="16" x2="22" y2="16" />
  </svg>
);

const OffCanvasIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <rect x="5" y="5" width="14" height="14" />
    <circle cx="3" cy="12" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="21" cy="12" r="1.5" fill="currentColor" stroke="none" />
  </svg>
);

// --- Sub-components ---

interface ToolButtonProps {
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}

function ToolButton({ icon, label, shortcut, onClick, disabled, active }: ToolButtonProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div className="relative">
      <button
        className={`w-10 h-10 flex items-center justify-center rounded-(--radius-md) transition-all duration-150 cursor-pointer
          ${active
            ? 'bg-(--color-selected) text-(--color-text-primary)'
            : 'bg-(--color-card-bg) text-(--color-text-secondary) hover:enabled:bg-(--color-selected) hover:enabled:text-(--color-text-primary)'
          }
          disabled:opacity-40 disabled:cursor-not-allowed`}
        style={{
          border: `var(--border-width, 2px) solid var(${active ? '--color-border' : '--color-border-light'})`,
          boxShadow: 'none',
        }}
        onMouseEnter={(e) => {
          setIsHovered(true);
          if (!disabled && !active) {
            e.currentTarget.style.borderColor = 'var(--color-border)';
            e.currentTarget.style.boxShadow = 'var(--shadow-btn)';
          }
        }}
        onMouseLeave={(e) => {
          setIsHovered(false);
          if (!disabled && !active) {
            e.currentTarget.style.borderColor = 'var(--color-border-light)';
            e.currentTarget.style.boxShadow = 'none';
          }
        }}
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
      >
        {icon}
      </button>

      {isHovered && (
        <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2 py-1.5 rounded-(--radius-sm) text-xs whitespace-nowrap z-50 pointer-events-none bg-(--color-bg-primary) text-(--color-text-primary) border border-(--color-border) shadow-(--shadow-btn)">
          <div className="font-medium">{label}</div>
          {shortcut && <div className="text-(--color-text-tertiary)">{shortcut}</div>}
        </div>
      )}
    </div>
  );
}

function Divider() {
  return <div className="h-0.5 shrink-0 w-5 mx-auto bg-(--color-border-light) rounded-full" />;
}

// --- Main component ---

export interface ToolsPanelProps {
  keyMappings: KeyMappings;
  hasSelection: boolean;
  canUndo: boolean;
  canRedo: boolean;
  showGrid: boolean;
  showOffCanvas: boolean;
  onClose: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onMoveLeft: () => void;
  onMoveRight: () => void;
  onSizeIncrease: () => void;
  onSizeDecrease: () => void;
  onMirrorHorizontal: () => void;
  onMirrorVertical: () => void;
  onBringForward: () => void;
  onSendBackward: () => void;
  onToggleGrid: () => void;
  onToggleOffCanvas: () => void;
}

export function ToolsPanel({
  keyMappings,
  hasSelection,
  canUndo,
  canRedo,
  showGrid,
  showOffCanvas,
  onClose,
  onUndo,
  onRedo,
  onDuplicate,
  onDelete,
  onMoveUp,
  onMoveDown,
  onMoveLeft,
  onMoveRight,
  onSizeIncrease,
  onSizeDecrease,
  onMirrorHorizontal,
  onMirrorVertical,
  onBringForward,
  onSendBackward,
  onToggleGrid,
  onToggleOffCanvas,
}: ToolsPanelProps) {
  const defaults = getDefaultMappings();
  const getShortcut = (actionId: keyof KeyMappings) => {
    const binding = keyMappings[actionId] || defaults[actionId];
    return binding ? formatKeyBinding(binding) : '';
  };

  return (
    <div
      className="flex flex-col items-center gap-1.5 py-1.5 px-1.5 bg-(--color-card-bg) overflow-y-auto"
      style={{
        border: 'var(--border-width, 2px) solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-card)',
        maxHeight: 'calc(100vh - 140px)',
      }}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Close */}
      <ToolButton icon={<CollapseIcon />} label="Hide tools" onClick={onClose} />

      <Divider />

      {/* Undo / Redo */}
      <ToolButton icon={<UndoIcon />} label="Undo" shortcut={getShortcut('undo')} onClick={onUndo} disabled={!canUndo} />
      <ToolButton icon={<RedoIcon />} label="Redo" shortcut={getShortcut('redo')} onClick={onRedo} disabled={!canRedo} />

      <Divider />

      {/* Duplicate / Delete */}
      <ToolButton icon={<DuplicateIcon />} label="Duplicate" shortcut={getShortcut('duplicate')} onClick={onDuplicate} disabled={!hasSelection} />
      <ToolButton icon={<DeleteIcon />} label="Delete" shortcut={getShortcut('delete')} onClick={onDelete} disabled={!hasSelection} />

      <Divider />

      {/* Movement */}
      <ToolButton icon={<MoveUpIcon />} label="Move up" shortcut={getShortcut('moveUp')} onClick={onMoveUp} disabled={!hasSelection} />
      <ToolButton icon={<MoveDownIcon />} label="Move down" shortcut={getShortcut('moveDown')} onClick={onMoveDown} disabled={!hasSelection} />
      <ToolButton icon={<MoveLeftIcon />} label="Move left" shortcut={getShortcut('moveLeft')} onClick={onMoveLeft} disabled={!hasSelection} />
      <ToolButton icon={<MoveRightIcon />} label="Move right" shortcut={getShortcut('moveRight')} onClick={onMoveRight} disabled={!hasSelection} />

      <Divider />

      {/* Size */}
      <ToolButton icon={<SizeDecreaseIcon />} label="Decrease size" onClick={onSizeDecrease} disabled={!hasSelection} />
      <ToolButton icon={<SizeIncreaseIcon />} label="Increase size" onClick={onSizeIncrease} disabled={!hasSelection} />

      <Divider />

      {/* Mirror */}
      <ToolButton icon={<MirrorHorizontalIcon />} label="Mirror horizontal" shortcut={getShortcut('mirrorHorizontal')} onClick={onMirrorHorizontal} disabled={!hasSelection} />
      <ToolButton icon={<MirrorVerticalIcon />} label="Mirror vertical" shortcut={getShortcut('mirrorVertical')} onClick={onMirrorVertical} disabled={!hasSelection} />

      <Divider />

      {/* Z-ordering */}
      <ToolButton icon={<BringForwardIcon />} label="Bring forward" onClick={onBringForward} disabled={!hasSelection} />
      <ToolButton icon={<SendBackwardIcon />} label="Send backward" onClick={onSendBackward} disabled={!hasSelection} />

      <Divider />

      {/* View toggles */}
      <ToolButton
        icon={<GridIcon />}
        label="Grid lines"
        shortcut={getShortcut('toggleGrid')}
        onClick={onToggleGrid}
        active={showGrid}
      />
      <ToolButton
        icon={<OffCanvasIcon />}
        label="Off-canvas shapes"
        onClick={onToggleOffCanvas}
        active={showOffCanvas}
      />
    </div>
  );
}
