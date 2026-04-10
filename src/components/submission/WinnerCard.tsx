import { useState } from 'react';
import { SubmissionThumbnail } from '../shared/SubmissionThumbnail';
import { PlacementBanner } from '../shared/PlacementBanner';
import { AvatarImage } from '../shared/AvatarImage';
import { Link } from '../shared/Link';
import type { RankingEntry } from '../../types';

interface WinnerCardProps {
  entry: RankingEntry;
  size?: 'sm' | 'md' | 'lg';
  /** When true, cap thumbnail size based on viewport height so the modal doesn't scroll */
  fitViewport?: boolean;
}

const pxSizes = { lg: 360, md: 280, sm: 220 } as const;
const dvhCaps = { lg: '30dvh', md: '24dvh', sm: '18dvh' } as const;

export function WinnerCard({
  entry,
  size = 'md',
  fitViewport = false,
}: WinnerCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  const px = pxSizes[size];
  const href = `?view=submission&id=${entry.submission_id}`;

  const cardStyle: React.CSSProperties = {
    width: fitViewport ? `min(${px}px, ${dvhCaps[size]})` : px,
    borderRadius: 'var(--radius-lg)',
    border: 'var(--border-width, 2px) solid var(--color-border)',
    boxShadow: isHovered ? 'var(--shadow-card)' : 'var(--shadow-btn)',
    overflow: 'hidden',
    transition: 'transform 0.15s, box-shadow 0.15s',
    transform: isHovered ? 'translateY(-4px)' : 'translateY(0)',
  };

  return (
    <Link
      href={href}
      className="flex flex-col items-center no-underline cursor-pointer"
      title="View submission"
    >
      <div
        className="relative"
        style={cardStyle}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <SubmissionThumbnail
          shapes={entry.shapes}
          groups={entry.groups}
          backgroundColor={entry.background_color}
          fill
        />
        <PlacementBanner rank={entry.rank as 1 | 2 | 3} />
      </div>
      <span className="mt-3 flex items-center gap-1.5 text-sm font-medium text-(--color-text-primary)">
        <AvatarImage avatarUrl={entry.avatar_url} initial={(entry.nickname || 'A')[0].toUpperCase()} size="sm" />
        {entry.nickname}
      </span>
    </Link>
  );
}
