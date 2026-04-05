import { SubmissionThumbnail } from '../shared/SubmissionThumbnail';
import { TrophyBadge } from '../shared/TrophyBadge';
import { AvatarImage } from '../shared/AvatarImage';
import { Link } from '../shared/Link';
import type { RankingEntry, DailyChallenge } from '../../types';

interface WinnerCardProps {
  entry: RankingEntry;
  challenge: DailyChallenge;
  size?: 'sm' | 'md' | 'lg';
}

export function WinnerCard({
  entry,
  challenge,
  size = 'md',
}: WinnerCardProps) {

  // Page uses different thumbnail sizes than modal
  const thumbnailSize = (size === 'lg' ? 360 : size === 'md' ? 280 : 220)
  const href = `?view=submission&id=${entry.submission_id}`;

  return (
    <Link
      href={href}
      className={`flex flex-col items-center no-underline cursor-pointer transition-transform hover:scale-102`}
      title="View submission"
    >
      <div className="relative">
        <div className="absolute -top-3 -right-3 z-10">
          <TrophyBadge rank={entry.rank as 1 | 2 | 3} />
        </div>
        <div className="rounded-(--radius-xl) overflow-hidden shadow-(--shadow-card)">
          <SubmissionThumbnail
            shapes={entry.shapes}
            groups={entry.groups}
            challenge={challenge}
            backgroundColorIndex={entry.background_color_index}
            size={thumbnailSize}
          />
        </div>
      </div>
      <span className="mt-2 flex items-center gap-1.5 text-sm font-medium text-(--color-text-primary)">
        <AvatarImage avatarUrl={entry.avatar_url} initial={(entry.nickname || 'A')[0].toUpperCase()} size="sm" />
        {entry.nickname}
      </span>
    </Link>
  );
}
