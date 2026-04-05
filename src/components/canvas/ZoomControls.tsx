import { Plus, Minus } from 'lucide-react';

interface ZoomControlsProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  minZoom: number;
  maxZoom: number;
}

const btnBase =
  'h-7.5 flex items-center justify-center font-semibold text-xs transition-colors cursor-pointer disabled:opacity-35 disabled:cursor-default';

export function ZoomControls({
  zoom,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  minZoom,
  maxZoom,
}: ZoomControlsProps) {
  const zoomPercent = Math.round(zoom * 100);
  const canZoomIn = zoom < maxZoom - 0.001;
  const canZoomOut = zoom > minZoom + 0.001;
  const isDefaultZoom = Math.abs(zoom - 1) < 0.001;

  const btnStyle = {
    background: 'var(--color-card-bg)',
    border: 'var(--border-width, 2px) solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    boxShadow: 'var(--shadow-btn)',
    color: 'var(--color-text-primary)',
    fontFamily: 'inherit',
  };

  return (
    <div className="flex items-center gap-1">
      <button
        className={btnBase}
        style={{ ...btnStyle, padding: '0 0.5rem' }}
        onClick={onZoomIn}
        disabled={!canZoomIn}
        title="Zoom in"
      >
        <Plus size={14} strokeWidth={2.5} />
      </button>

      <button
        className={btnBase}
        style={{ ...btnStyle, padding: '0 0.625rem', cursor: isDefaultZoom ? 'default' : 'pointer' }}
        onClick={onResetZoom}
        disabled={isDefaultZoom}
        title="Reset zoom to 100%"
      >
        {zoomPercent}%
      </button>

      <button
        className={btnBase}
        style={{ ...btnStyle, padding: '0 0.5rem' }}
        onClick={onZoomOut}
        disabled={!canZoomOut}
        title="Zoom out"
      >
        <Minus size={14} strokeWidth={2.5} />
      </button>

    </div>
  );
}
