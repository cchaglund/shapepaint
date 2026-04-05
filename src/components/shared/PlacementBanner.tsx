import { RANK_COLORS } from '../../constants/rankColors';

const RANK_LABELS: Record<1 | 2 | 3, string> = {
  1: '1ST',
  2: '2ND',
  3: '3RD',
};

interface PlacementBannerProps {
  rank: 1 | 2 | 3;
  /** Compact mode for small containers like calendar cells */
  compact?: boolean;
}

/**
 * Corner ribbon badge showing 1st/2nd/3rd place.
 * Renders a diagonal ribbon in the top-right corner of a positioned parent.
 * Parent must have `position: relative` and `overflow: hidden`.
 */
export function PlacementBanner({ rank, compact = false }: PlacementBannerProps) {
  const label = RANK_LABELS[rank];
  const bg = RANK_COLORS[rank];

  // Outer clip box — shifted inward so the ribbon sits more visibly on the art
  const outerW = compact ? 44 : 79;
  const outerH = compact ? 40 : 72;
  // Inner rotated strip
  const stripWidth = compact ? 64 : 115;

  return (
    <div
      className="absolute z-10 overflow-hidden pointer-events-none"
      style={{
        top: compact ? 0 : 0,
        right: compact ? -2 : -4,
        width: outerW,
        height: outerH,
      }}
    >
      <div
        className="absolute text-center font-display text-(--color-text-primary)"
        style={{
          left: compact ? -4 : -2,
          top: compact ? 8 : 16,
          width: stripWidth,
          background: bg,
          transform: 'rotate(45deg)',
          transformOrigin: 'center center',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          padding: compact ? '1px 0' : '3px 0',
          fontSize: compact ? '0.4rem' : '0.55rem',
          letterSpacing: '0.04em',
        }}
      >
        {label}
      </div>
    </div>
  );
}

/** Small colored swatch for use in stats/inline contexts */
export function PlacementSwatch({ rank }: { rank: 1 | 2 | 3 }) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: 20,
        height: 10,
        borderRadius: 2,
        background: RANK_COLORS[rank],
      }}
    />
  );
}
