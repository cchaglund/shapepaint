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
  RotateCw,
  RotateCcw,
  Grid3x3,
  BoxSelect,
  SquareX,
} from 'lucide-react';
import type { KeyMappings } from '../../constants/keyboardActions';
import { formatKeyBinding, getDefaultMappings } from '../../constants/keyboardActions';
import { Tooltip } from '../shared/InfoTooltip';
import { IS_MAC } from '../../utils/platform';

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
  hints?: string[];
  onClick: (e: React.MouseEvent) => void;
  disabled?: boolean;
  active?: boolean;
}

function ToolButton({ icon, label, shortcut, hints, onClick, disabled, active }: ToolButtonProps) {
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
          {hints && hints.map((hint, i) => (
            <div key={i} className="opacity-50 text-[10px]">{hint}</div>
          ))}
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

function ButtonRow({ children }: { children: React.ReactNode }) {
  return <div className="flex gap-1.5">{children}</div>;
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
  onMove: (dx: number, dy: number) => void;
  onResize: (delta: number) => void;
  onRotate: (delta: number) => void;
  onMirrorHorizontal: () => void;
  onMirrorVertical: () => void;
  onBringForward: () => void;
  onSendBackward: () => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
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
  onMove,
  onResize,
  onRotate,
  onMirrorHorizontal,
  onMirrorVertical,
  onBringForward,
  onSendBackward,
  onSelectAll,
  onDeselectAll,
  onToggleGrid,
  onToggleOffCanvas,
  onToolButtonClick,
}: ToolsPanelProps) {
  const defaults = getDefaultMappings();
  const getShortcut = (actionId: keyof KeyMappings) => {
    const binding = keyMappings[actionId] || defaults[actionId];
    return binding ? formatKeyBinding(binding) : '';
  };

  const altLabel = IS_MAC ? '⌥' : 'Alt';
  const modHints = ['+ ⇧ = 10x', `+ ${altLabel} = 0.2x`];
  const rotateHints = ['+ ⇧ = 15x', `+ ${altLabel} = 0.2x`];

  // Step multiplier based on modifier keys held during click
  const step = (e: React.MouseEvent, base: number) =>
    e.shiftKey ? base * 10 : e.altKey ? base * 0.2 : base;
  const rotateStep = (e: React.MouseEvent) =>
    e.shiftKey ? 15 : e.altKey ? 0.2 : 1;

  return (
    <div
      className="flex flex-col items-stretch gap-1.5 py-1.5 px-1.5 bg-(--color-card-bg) overflow-y-auto scrollbar-hide"
      style={{
        border: 'var(--border-width, 2px) solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-card)',
        maxHeight: 'calc(100vh - 8.75rem)',
      }}
      onClick={(e) => { e.stopPropagation(); onToolButtonClick?.(); }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Close — full width */}
      <Tooltip
        placement="right"
        delay={500}
        gap={14}
        content={<div className="whitespace-nowrap font-medium">Hide tools</div>}
      >
        <button
          className="tool-btn-hover w-full h-10 flex items-center justify-center rounded-(--radius-md) transition-all duration-150 cursor-pointer bg-(--color-card-bg) text-(--color-text-secondary) hover:enabled:bg-(--color-selected) hover:enabled:text-(--color-text-primary)"
          onClick={onClose}
        >
          <ChevronLeft size={18} />
        </button>
      </Tooltip>

      <ButtonRow>
        <ToolButton icon={<Undo2 size={18} />} label="Undo" shortcut={getShortcut('undo')} onClick={onUndo} disabled={!canUndo} />
        <ToolButton icon={<Redo2 size={18} />} label="Redo" shortcut={getShortcut('redo')} onClick={onRedo} disabled={!canRedo} />
      </ButtonRow>

      <ButtonRow>
        <ToolButton icon={<SquareX size={18} />} label="Deselect all" shortcut={getShortcut('deselectAll')} onClick={onDeselectAll} />
        <ToolButton icon={<BoxSelect size={18} />} label="Select all" shortcut={getShortcut('selectAll')} onClick={onSelectAll} />
      </ButtonRow>
      <ButtonRow>
        <ToolButton icon={<Trash2 size={18} />} label="Delete" shortcut={getShortcut('delete')} onClick={onDelete} disabled={!hasSelection} />
        <ToolButton icon={<Copy size={18} />} label="Duplicate" shortcut={getShortcut('duplicate')} onClick={onDuplicate} disabled={!hasSelection} />
      </ButtonRow>

      <ButtonRow>
        <ToolButton icon={<ArrowUp size={18} />} label="Move up" shortcut={getShortcut('moveUp')} hints={modHints} onClick={(e) => onMove(0, -step(e, 1))} disabled={!hasSelection} />
        <ToolButton icon={<ArrowDown size={18} />} label="Move down" shortcut={getShortcut('moveDown')} hints={modHints} onClick={(e) => onMove(0, step(e, 1))} disabled={!hasSelection} />
      </ButtonRow>
      <ButtonRow>
        <ToolButton icon={<ArrowLeft size={18} />} label="Move left" shortcut={getShortcut('moveLeft')} hints={modHints} onClick={(e) => onMove(-step(e, 1), 0)} disabled={!hasSelection} />
        <ToolButton icon={<ArrowRight size={18} />} label="Move right" shortcut={getShortcut('moveRight')} hints={modHints} onClick={(e) => onMove(step(e, 1), 0)} disabled={!hasSelection} />
      </ButtonRow>

      <ButtonRow>
        <ToolButton icon={<Minimize2 size={18} />} label="Decrease size" shortcut={getShortcut('sizeDecrease')} hints={modHints} onClick={(e) => onResize(-step(e, 5))} disabled={!hasSelection} />
        <ToolButton icon={<Maximize2 size={18} />} label="Increase size" shortcut={getShortcut('sizeIncrease')} hints={modHints} onClick={(e) => onResize(step(e, 5))} disabled={!hasSelection} />
      </ButtonRow>

      <ButtonRow>
        <ToolButton icon={<RotateCcw size={18} />} label="Rotate CCW" shortcut={getShortcut('rotateCounterClockwise')} hints={rotateHints} onClick={(e) => onRotate(-rotateStep(e))} disabled={!hasSelection} />
        <ToolButton icon={<RotateCw size={18} />} label="Rotate CW" shortcut={getShortcut('rotateClockwise')} hints={rotateHints} onClick={(e) => onRotate(rotateStep(e))} disabled={!hasSelection} />
      </ButtonRow>

      <ButtonRow>
        <ToolButton icon={<FlipHorizontal2 size={18} />} label="Mirror horizontal" shortcut={getShortcut('mirrorHorizontal')} onClick={onMirrorHorizontal} disabled={!hasSelection} />
        <ToolButton icon={<FlipVertical2 size={18} />} label="Mirror vertical" shortcut={getShortcut('mirrorVertical')} onClick={onMirrorVertical} disabled={!hasSelection} />
      </ButtonRow>

      <ButtonRow>
        <ToolButton icon={<SendBackwardIcon />} label="Send backward" shortcut={getShortcut('sendBackward')} onClick={onSendBackward} disabled={!hasSelection} />
        <ToolButton icon={<BringForwardIcon />} label="Bring forward" shortcut={getShortcut('bringForward')} onClick={onBringForward} disabled={!hasSelection} />
      </ButtonRow>

      <ButtonRow>
        <ToolButton icon={<Grid3x3 size={18} strokeWidth={1.5} />} label="Grid lines" shortcut={getShortcut('toggleGrid')} onClick={onToggleGrid} active={showGrid} />
        <ToolButton icon={<OffCanvasIcon />} label="Off-canvas shapes" onClick={onToggleOffCanvas} active={showOffCanvas} />
      </ButtonRow>
    </div>
  );
}
