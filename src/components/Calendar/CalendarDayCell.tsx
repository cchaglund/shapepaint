import type { DailyChallenge, Shape } from '../../types';
import type { ViewMode, WinnerEntry } from './types';
import { SubmissionThumbnail } from '../shared/SubmissionThumbnail';
import { ChallengeShapeIndicators } from '../shared/ChallengeShapeIndicators';
import { TrophyBadge } from '../shared/TrophyBadge';
import { Tooltip } from '../shared/InfoTooltip';
import { CalendarCell } from './CalendarCell';

/** Minimal submission shape needed by CalendarDayCell */
interface CalendarSubmission {
  shapes: Shape[];
  background_color_index: number | null;
}

interface CalendarDayCellProps {
  day: number;
  dateStr: string;
  viewMode: ViewMode;
  isToday: boolean;
  isFuture: boolean;
  challenge: DailyChallenge | undefined;
  submission: CalendarSubmission | undefined;
  ranking: number | undefined;
  dayWinners: WinnerEntry[] | undefined;
  latestWinnersDate: string;
  href?: string;
  onClick?: (day: number) => void;
  canView?: boolean;
  lockedContent?: React.ReactNode;
  hideEmptyDayIcon?: boolean;
}

export function CalendarDayCell({
  day,
  dateStr,
  viewMode,
  isToday,
  isFuture,
  challenge,
  submission,
  ranking,
  dayWinners,
  latestWinnersDate: _latestWinnersDate,
  href,
  onClick,
  canView = true,
  lockedContent,
}: CalendarDayCellProps) {
  const showWordTooltip = !isFuture && challenge?.word;

  if (viewMode === 'my-submissions') {
    // Locked day (profile privacy check)
    if (!canView && !isFuture) {
      return (
        <CalendarCell day={day} isToday={isToday} isFuture={false} data-testid="calendar-day-cell" data-date={dateStr}>
          {lockedContent}
        </CalendarCell>
      );
    }

    const hasArt = !!submission && !!challenge;
    const isClickable = !isFuture && (!!submission || isToday);
    const hasRank = hasArt && ranking !== undefined && ranking >= 1 && ranking <= 3 ? (ranking as 1 | 2 | 3) : undefined;
    const todayCreateHref = isToday && !submission ? '/' : undefined;

    const cellContent = (
      <CalendarCell
        day={day}
        isToday={isToday}
        isFuture={isFuture}
        hasContent={hasArt}
        artFill={hasArt}
        href={isClickable ? (todayCreateHref ?? href) : undefined}
        onClick={isClickable && !href && !todayCreateHref && onClick ? () => onClick(day) : undefined}
        className="group"
        data-testid="calendar-day-cell"
        data-date={dateStr}
      >
        {hasArt && (
          <div className="absolute z-10 hidden group-hover:flex bg-(--color-overlay) rounded-sm px-1 py-0.5 top-0.5 left-7">
            <ChallengeShapeIndicators shapes={challenge.shapes} size={12} gap={4} color="white" />
          </div>
        )}
        {hasRank && (
          <div className="absolute top-0.5 right-0.5 z-10">
            <TrophyBadge rank={hasRank} />
          </div>
        )}
        {hasArt ? (
          <SubmissionThumbnail
            shapes={submission.shapes}
            challenge={challenge}
            backgroundColorIndex={submission.background_color_index}
            fill
          />
        ) : isToday && !submission ? (
          <span className="text-xs font-semibold text-(--color-accent)">Create!</span>
        ) : null}
      </CalendarCell>
    );

    if (showWordTooltip) {
      return <Tooltip content={`"${challenge.word}"`} capitalize={true}>{cellContent}</Tooltip>;
    }
    return cellContent;
  }

  // Winners view
  const hasWinner = dayWinners && dayWinners.length > 0;
  const hasWinnerArt = !!hasWinner && !!challenge;

  const cellContent = (
    <CalendarCell
      day={day}
      isToday={isToday}
      isFuture={isFuture}
      hasContent={hasWinnerArt}
      artFill={hasWinnerArt}
      href={hasWinner ? href : undefined}
      onClick={hasWinner && !href && onClick ? () => onClick(day) : undefined}
      data-testid="calendar-day-cell"
      data-date={dateStr}
    >
      {hasWinnerArt ? (
        <>
          <SubmissionThumbnail
            shapes={dayWinners[0].shapes}
            groups={dayWinners[0].groups}
            challenge={challenge}
            backgroundColorIndex={dayWinners[0].background_color_index}
            fill
          />
          {dayWinners.length > 1 && (
            <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 z-10 text-xs px-1 rounded-(--radius-sm) bg-(--color-overlay) text-(--color-accent-text)">
              +{dayWinners.length - 1}
            </div>
          )}
        </>
      ) : null}
    </CalendarCell>
  );

  if (showWordTooltip) {
    return <Tooltip content={`"${challenge.word}"`} capitalize={true}>{cellContent}</Tooltip>;
  }
  return cellContent;
}
