import { useState } from 'react';
import { Link } from './Link';
import { AvatarImage } from './AvatarImage';
import { SubmissionThumbnail } from './SubmissionThumbnail';
import { CardLikeButton } from './CardLikeButton';
import type { Shape, ShapeGroup, DailyChallenge } from '../../types';

interface SubmissionCardProps {
  shapes: Shape[];
  groups?: ShapeGroup[];
  challenge: DailyChallenge;
  backgroundColorIndex: number | null;
  showNickname?: boolean;
  nickname?: string;
  avatarUrl?: string | null;
  onClick?: () => void;
  href?: string;
  likeCount?: number;
  isLiked?: boolean;
  isOwnSubmission?: boolean;
  onLikeToggle?: () => void;
}

export function SubmissionCard({
  shapes,
  groups,
  challenge,
  backgroundColorIndex,
  showNickname = false,
  nickname,
  avatarUrl,
  onClick,
  href,
  likeCount,
  isLiked,
  isOwnSubmission,
  onLikeToggle,
}: SubmissionCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  const showFooter = (showNickname && nickname) || onLikeToggle;

  const cardStyle: React.CSSProperties = {
    borderRadius: 'var(--radius-lg)',
    border: 'var(--border-width, 2px) solid var(--color-border)',
    background: 'var(--color-card-bg)',
    boxShadow: isHovered ? 'var(--shadow-card)' : 'var(--shadow-btn)',
    overflow: 'hidden',
    transition: 'transform 0.15s, box-shadow 0.15s',
    transform: isHovered ? 'translateY(-4px)' : 'translateY(0)',
  };

  const cardInner = (
    <>
      <SubmissionThumbnail
        shapes={shapes}
        groups={groups}
        challenge={challenge}
        backgroundColorIndex={backgroundColorIndex}
        fill
      />
      {showFooter && (
        <div
          style={{ padding: 'var(--space-2) var(--space-3)' }}
          className="flex items-center gap-1"
        >
          {showNickname && nickname && (
            <span className="flex items-center gap-1.5 truncate text-sm font-bold text-(--color-text-primary)">
              <AvatarImage avatarUrl={avatarUrl ?? null} initial={(nickname || 'U')[0].toUpperCase()} size="sm" />
              {nickname}
            </span>
          )}
          {onLikeToggle && likeCount !== undefined && (
            <CardLikeButton
              isLiked={isLiked ?? false}
              likeCount={likeCount}
              disabled={isOwnSubmission}
              onToggle={onLikeToggle}
            />
          )}
        </div>
      )}
    </>
  );

  const hoverHandlers = {
    onMouseEnter: () => setIsHovered(true),
    onMouseLeave: () => setIsHovered(false),
  };

  if (href) {
    return (
      <Link href={href} style={cardStyle} className="block no-underline" {...hoverHandlers}>
        {cardInner}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button type="button" onClick={onClick} style={cardStyle} className="block w-full text-left" {...hoverHandlers}>
        {cardInner}
      </button>
    );
  }

  return (
    <div style={cardStyle} {...hoverHandlers}>
      {cardInner}
    </div>
  );
}
