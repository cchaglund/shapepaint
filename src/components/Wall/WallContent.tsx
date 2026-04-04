import { useState, useEffect, useCallback, useMemo } from 'react';
import { useWallOfTheDay, type SortMode } from '../../hooks/challenge/useWallOfTheDay';
import { useDailyChallenge } from '../../hooks/challenge/useDailyChallenge';
import { useCalendarMonth } from '../../hooks/challenge/useCalendarMonth';
import { useCalendarChallenges } from '../../hooks/challenge/useCalendarChallenges';
import { useAuth } from '../../hooks/auth/useAuth';
import { useBatchLikedStatus } from '../../hooks/social/useBatchLikedStatus';
import { WallSortControls } from './WallSortControls';
import { WallLockedState } from './WallLockedState';
import { WallEmptyState } from './WallEmptyState';
import { SubmissionCard, TrophyBadge, ViewToggle, LoadingSpinner, LoadMoreButton } from '../shared';
import { ContentNavigation } from '../Calendar/ContentNavigation';
import { ContentCalendarGrid } from '../Calendar/ContentCalendarGrid';
import { LoginPromptModal } from '../social/LoginPromptModal';
import { formatDate, getDaysInMonth } from '../../utils/calendarUtils';
import { fetchSubmissionCountsByDateRange } from '../../lib/api';
type ViewType = 'grid' | 'calendar';

interface SubmissionCountByDate {
  [date: string]: number;
}

interface WallContentProps {
  date: string;
  onDateChange: (date: string) => void;
  hasSubmittedToday: boolean;
  showNavigation?: boolean;
  showCalendarButton?: boolean;
  onSubmissionClick?: (submissionId: string) => void;
}

export function WallContent({
  date,
  onDateChange,
  hasSubmittedToday,
  showNavigation = false,
  onSubmissionClick,
}: WallContentProps) {
  const [viewType, setViewType] = useState<ViewType>('grid');
  const [submissionCounts, setSubmissionCounts] = useState<SubmissionCountByDate>({});
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);

  const { user } = useAuth();

  const {
    calendarYear,
    calendarMonth,
    calendarDays,
    goToPreviousMonth,
    goToNextMonth,
    goToToday,
    canGoNext,
    monthYearLabel,
    shortDateLabel,
    todayStr: todayDate,
    isToday,
  } = useCalendarMonth(date, onDateChange);

  const challengesMap = useCalendarChallenges(calendarYear, calendarMonth, viewType === 'calendar');

  const {
    submissions,
    loading,
    error,
    sortMode,
    setSortMode,
    canViewCurrentDay,
    isRankedAvailable,
    hasMore,
    loadMore,
    adjacentDates,
  } = useWallOfTheDay({ date, hasSubmittedToday });

  // Fetch challenge data for the date to get colors from DB
  const { challenge } = useDailyChallenge(date);

  // Batch like status
  const submissionIds = useMemo(() => submissions.map(s => s.id), [submissions]);
  const { likedSet, countAdjustments, toggleLiked } = useBatchLikedStatus(user?.id, submissionIds);

  const handleLikeToggle = useCallback((submissionId: string) => {
    if (!user) {
      setShowLoginModal(true);
      return;
    }
    toggleLiked(submissionId);
  }, [user, toggleLiked]);

  // Fetch submission counts for calendar view
  const fetchSubmissionCounts = useCallback(async () => {
    setCalendarLoading(true);
    try {
      const startDate = formatDate(calendarYear, calendarMonth, 1);
      const daysInMonth = getDaysInMonth(calendarYear, calendarMonth);
      const endDate = formatDate(calendarYear, calendarMonth, daysInMonth);

      const counts = await fetchSubmissionCountsByDateRange(startDate, endDate);
      setSubmissionCounts(counts);
    } catch (err) {
      console.error('Failed to fetch submission counts:', err);
    } finally {
      setCalendarLoading(false);
    }
  }, [calendarYear, calendarMonth]);

  // Fetch counts when switching to calendar view or when month changes
  useEffect(() => {
    if (viewType === 'calendar') {
      fetchSubmissionCounts();
    }
  }, [viewType, fetchSubmissionCounts]);

  // Format submission time for tooltip
  const formatTime = (createdAt: string) => {
    const d = new Date(createdAt);
    return d.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const getSubmissionHref = (submissionId: string) =>
    `/?view=submission&id=${submissionId}`;

  const handleDayClick = useCallback((day: number) => {
    const dateStr = formatDate(calendarYear, calendarMonth, day);
    setViewType('grid');
    onDateChange(dateStr);
  }, [calendarYear, calendarMonth, onDateChange]);

  // Loading state - only for grid view
  if (loading && viewType === 'grid') {
    return <LoadingSpinner message="Loading submissions..." />;
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <p className="text-sm text-(--color-danger) mb-2">
          Failed to load submissions
        </p>
        <p className="text-sm text-(--color-text-tertiary)">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Navigation */}
      {showNavigation && (
        <ContentNavigation
          label={viewType === 'calendar' ? monthYearLabel : shortDateLabel}
          subtitle={viewType === 'grid' && challenge?.word ? `Word of the day: \u201C${challenge.word}\u201D` : undefined}
          onPrev={viewType === 'calendar' ? goToPreviousMonth : () => adjacentDates.prev && onDateChange(adjacentDates.prev)}
          onNext={viewType === 'calendar' ? goToNextMonth : () => adjacentDates.next && onDateChange(adjacentDates.next)}
          onToday={goToToday}
          canGoPrev={viewType === 'calendar' ? true : !!adjacentDates.prev}
          canGoNext={viewType === 'calendar' ? canGoNext : !!adjacentDates.next}
          showToday={!isToday}
        />
      )}

      {/* View toggle and sort controls */}
      <div className="flex items-center justify-between">
        <ViewToggle
          options={[
            { value: 'grid' as ViewType, label: 'Grid' },
            { value: 'calendar' as ViewType, label: 'Calendar' },
          ]}
          activeValue={viewType}
          onChange={setViewType}
        />

        {/* Sort controls - only show in grid view */}
        {viewType === 'grid' && (
          <WallSortControls
            sortMode={sortMode}
            onSortModeChange={(mode: SortMode) => setSortMode(mode)}
            isRankedAvailable={isRankedAvailable}
          />
        )}
      </div>

      {/* Calendar view */}
      {viewType === 'calendar' && (
        <div className="flex flex-col gap-4">
          <ContentCalendarGrid
            calendarYear={calendarYear}
            calendarMonth={calendarMonth}
            calendarDays={calendarDays}
            todayStr={todayDate}
            hasSubmittedToday={hasSubmittedToday}
            loading={calendarLoading}
            counts={submissionCounts}
            challengesMap={challengesMap}
            onDayClick={handleDayClick}
          />
        </div>
      )}

      {/* Grid view */}
      {viewType === 'grid' && (
        !canViewCurrentDay ? (
          <WallLockedState/>
        ) : submissions.length === 0 && canViewCurrentDay ? (
          <WallEmptyState />
        ) : challenge ? (
          <>
            {/* Grid of submissions */}
          <div
            className="grid gap-4"
            style={{
              gridTemplateColumns: 'repeat(auto-fill, minmax(12.5rem, 1fr))',
            }}
          >
            {submissions.map((submission) => (
              <div
                key={submission.id}
                className="relative"
                title={`Submitted at ${formatTime(submission.created_at)}`}
              >
                {submission.final_rank !== undefined && submission.final_rank >= 1 && submission.final_rank <= 3 && (
                  <div className="absolute top-0 right-0 z-10">
                    <TrophyBadge rank={submission.final_rank as 1 | 2 | 3} />
                  </div>
                )}
                <SubmissionCard
                  shapes={submission.shapes}
                  groups={submission.groups}
                  challenge={challenge}
                  backgroundColorIndex={submission.background_color_index}
                  showNickname={true}
                  nickname={submission.nickname}
                  avatarUrl={submission.avatar_url}
                  href={onSubmissionClick ? undefined : getSubmissionHref(submission.id)}
                  onClick={onSubmissionClick ? () => onSubmissionClick(submission.id) : undefined}
                  likeCount={submission.like_count + (countAdjustments.get(submission.id) ?? 0)}
                  isLiked={likedSet.has(submission.id)}
                  isOwnSubmission={user?.id === submission.user_id}
                  onLikeToggle={() => handleLikeToggle(submission.id)}
                />
              </div>
            ))}
          </div>

          {/* Load more button */}
          {hasMore && (
            <div className="flex justify-center pt-4">
              <LoadMoreButton onClick={loadMore} />
            </div>
          )}
          </>
        ) : null
      )}
      {showLoginModal && (
        <LoginPromptModal
          onClose={() => setShowLoginModal(false)}
          title="Sign In to Like"
          message="You need to be logged in to like submissions."
        />
      )}
    </div>
  );
}
