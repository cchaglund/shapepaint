import {
  ChevronLeft,
  Undo2,
  Redo2,
  Copy,
  Trash2,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Minimize2,
  Maximize2,
  FlipHorizontal2,
  FlipVertical2,
  Grid3x3,
} from 'lucide-react';
import type { KeyMappings } from '../../constants/keyboardActions';
import { formatKeyBinding, getDefaultMappings } from '../../constants/keyboardActions';
import { Tooltip } from '../shared/InfoTooltip';

// --- Custom SVG icons (no Lucide equivalent) ---

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
  return (
    <Tooltip
      placement="right"
      delay={500}
      disabled={disabled}
      gap={14}
      content={
        <div className="whitespace-nowrap">
          <div className="font-medium">{label}</div>
          {shortcut && <div className="opacity-70">{shortcut}</div>}
        </div>
      }
    >
      <button
        className={`tool-btn-hover w-10 h-10 flex items-center justify-center rounded-(--radius-md) transition-all duration-150 cursor-pointer
          ${active
            ? 'bg-(--color-selected) text-(--color-text-primary) !border-(--color-border)'
            : 'bg-(--color-card-bg) text-(--color-text-secondary) hover:enabled:bg-(--color-selected) hover:enabled:text-(--color-text-primary)'
          }
          disabled:opacity-40 disabled:cursor-not-allowed`}
        onClick={onClick}
        disabled={disabled}
      >
        {icon}
      </button>
    </Tooltip>
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
  onToolButtonClick?: () => void;
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
  onToolButtonClick,
}: ToolsPanelProps) {
  const defaults = getDefaultMappings();
  const getShortcut = (actionId: keyof KeyMappings) => {
    const binding = keyMappings[actionId] || defaults[actionId];
    return binding ? formatKeyBinding(binding) : '';
  };

  return (
    <div
      className="flex flex-col items-center gap-1.5 py-1.5 px-1.5 bg-(--color-card-bg) overflow-y-auto scrollbar-hide"
      style={{
        border: 'var(--border-width, 2px) solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-card)',
        maxHeight: 'calc(100vh - 8.75rem)',
      }}
      onClick={(e) => { e.stopPropagation(); onToolButtonClick?.(); }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Close */}
      <ToolButton icon={<ChevronLeft size={18} />} label="Hide tools" onClick={onClose} />

      <Divider />

      {/* Undo / Redo */}
      <ToolButton icon={<Undo2 size={18} />} label="Undo" shortcut={getShortcut('undo')} onClick={onUndo} disabled={!canUndo} />
      <ToolButton icon={<Redo2 size={18} />} label="Redo" shortcut={getShortcut('redo')} onClick={onRedo} disabled={!canRedo} />

      <Divider />

      {/* Duplicate / Delete */}
      <ToolButton icon={<Copy size={18} />} label="Duplicate" shortcut={getShortcut('duplicate')} onClick={onDuplicate} disabled={!hasSelection} />
      <ToolButton icon={<Trash2 size={18} />} label="Delete" shortcut={getShortcut('delete')} onClick={onDelete} disabled={!hasSelection} />

      <Divider />

      {/* Movement */}
      <ToolButton icon={<ArrowUp size={18} />} label="Move up" shortcut={getShortcut('moveUp')} onClick={onMoveUp} disabled={!hasSelection} />
      <ToolButton icon={<ArrowDown size={18} />} label="Move down" shortcut={getShortcut('moveDown')} onClick={onMoveDown} disabled={!hasSelection} />
      <ToolButton icon={<ArrowLeft size={18} />} label="Move left" shortcut={getShortcut('moveLeft')} onClick={onMoveLeft} disabled={!hasSelection} />
      <ToolButton icon={<ArrowRight size={18} />} label="Move right" shortcut={getShortcut('moveRight')} onClick={onMoveRight} disabled={!hasSelection} />

      <Divider />

      {/* Size */}
      <ToolButton icon={<Minimize2 size={18} />} label="Decrease size" onClick={onSizeDecrease} disabled={!hasSelection} />
      <ToolButton icon={<Maximize2 size={18} />} label="Increase size" onClick={onSizeIncrease} disabled={!hasSelection} />

      <Divider />

      {/* Mirror */}
      <ToolButton icon={<FlipHorizontal2 size={18} />} label="Mirror horizontal" shortcut={getShortcut('mirrorHorizontal')} onClick={onMirrorHorizontal} disabled={!hasSelection} />
      <ToolButton icon={<FlipVertical2 size={18} />} label="Mirror vertical" shortcut={getShortcut('mirrorVertical')} onClick={onMirrorVertical} disabled={!hasSelection} />

      <Divider />

      {/* Z-ordering */}
      <ToolButton icon={<BringForwardIcon />} label="Bring forward" onClick={onBringForward} disabled={!hasSelection} />
      <ToolButton icon={<SendBackwardIcon />} label="Send backward" onClick={onSendBackward} disabled={!hasSelection} />

      <Divider />

      {/* View toggles */}
      <ToolButton
        icon={<Grid3x3 size={18} strokeWidth={1.5} />}
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
