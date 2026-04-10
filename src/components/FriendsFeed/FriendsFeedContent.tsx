import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, SubmissionCard, ViewToggle, EmptyState, LoadingSpinner, LoadMoreButton } from '../shared';
import { useFriendsFeed, type SortMode } from '../../hooks/social/useFriendsFeed';
import { useDailyChallenge } from '../../hooks/challenge/useDailyChallenge';
import { useCalendarMonth } from '../../hooks/challenge/useCalendarMonth';
import { useCalendarChallenges } from '../../hooks/challenge/useCalendarChallenges';
import { useBatchLikedStatus } from '../../hooks/social/useBatchLikedStatus';
import { WallSortControls } from '../Wall/WallSortControls';
import { ContentNavigation } from '../Calendar/ContentNavigation';
import { ContentCalendarGrid } from '../Calendar/ContentCalendarGrid';
import { LoginPromptModal } from '../social/LoginPromptModal';
import { useAuth } from '../../hooks/auth/useAuth';
import { useFollows } from '../../hooks/social/useFollows';
import { countFriendsSubmissionsByDate, fetchFriendsSubmissionsByDateRange } from '../../lib/api';
import { formatDate, getDaysInMonth } from '../../utils/calendarUtils';

type ViewType = 'grid' | 'calendar';

interface FriendsFeedContentProps {
  date: string;
  onDateChange: (date: string) => void;
  hasSubmittedToday: boolean;
  showNavigation?: boolean;
  onSubmissionClick?: (submissionId: string) => void;
}

interface FriendsCountByDate {
  [date: string]: number;
}

export function FriendsFeedContent({
  date,
  onDateChange,
  hasSubmittedToday,
  showNavigation = false,
  onSubmissionClick,
}: FriendsFeedContentProps) {
  const { user } = useAuth();
  const { followingIds, followingCount } = useFollows();
  const [viewType, setViewType] = useState<ViewType>('grid');
  const [friendsCounts, setFriendsCounts] = useState<FriendsCountByDate>({});
  const [calendarLoading, setCalendarLoading] = useState(false);

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
    todayStr,
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
  } = useFriendsFeed({ date, hasSubmittedToday });

  // Fetch challenge data for the date to get colors from DB
  const { challenge } = useDailyChallenge(date);

  // Batch like status
  const [showLoginModal, setShowLoginModal] = useState(false);
  const submissionIds = useMemo(() => submissions.map(s => s.id), [submissions]);
  const { likedSet, countAdjustments, toggleLiked } = useBatchLikedStatus(user?.id, submissionIds);

  const handleLikeToggle = useCallback((submissionId: string) => {
    if (!user) {
      setShowLoginModal(true);
      return;
    }
    toggleLiked(submissionId);
  }, [user, toggleLiked]);

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

  // Fetch friends counts for calendar view
  const fetchFriendsCounts = useCallback(async () => {
    if (!user || followingIds.size === 0) {
      setFriendsCounts({});
      return;
    }

    setCalendarLoading(true);
    try {
      const startDate = formatDate(calendarYear, calendarMonth, 1);
      const daysInMonth = getDaysInMonth(calendarYear, calendarMonth);
      const endDate = formatDate(calendarYear, calendarMonth, daysInMonth);

      const { data, error: rpcError } = await countFriendsSubmissionsByDate(user.id, startDate, endDate);

      if (rpcError) {
        console.error('RPC failed, falling back to manual count:', rpcError);
        const followingIdsArray = Array.from(followingIds);
        const submissionsData = await fetchFriendsSubmissionsByDateRange(followingIdsArray, startDate, endDate);

        if (submissionsData) {
          const counts: FriendsCountByDate = {};
          const usersByDate = new Map<string, Set<string>>();

          submissionsData.forEach((s: { challenge_date: string; user_id: string }) => {
            if (!usersByDate.has(s.challenge_date)) {
              usersByDate.set(s.challenge_date, new Set());
            }
            usersByDate.get(s.challenge_date)!.add(s.user_id);
          });

          usersByDate.forEach((users, dateKey) => {
            counts[dateKey] = users.size;
          });

          setFriendsCounts(counts);
        }
      } else if (data) {
        const counts: FriendsCountByDate = {};
        (data as { challenge_date: string; friend_count: number }[]).forEach(row => {
          counts[row.challenge_date] = row.friend_count;
        });
        setFriendsCounts(counts);
      }
    } catch (err) {
      console.error('Failed to fetch friends counts:', err);
    } finally {
      setCalendarLoading(false);
    }
  }, [user, followingIds, calendarYear, calendarMonth]);

  // Fetch counts when switching to calendar view or when month changes
  useEffect(() => {
    if (viewType === 'calendar') {
      fetchFriendsCounts();
    }
  }, [viewType, fetchFriendsCounts]);

  const handleDayClick = useCallback((day: number) => {
    const dateStr = formatDate(calendarYear, calendarMonth, day);
    // Switch to grid view and show that day's submissions
    setViewType('grid');
    onDateChange(dateStr);
  }, [calendarYear, calendarMonth, onDateChange]);

  // Not logged in state
  if (!user) {
    return (
      <EmptyState
        icon={
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-tertiary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        }
        message="Please sign in to see friends' submissions"
      />
    );
  }

  // No friends state
  if (followingCount === 0) {
    return (
      <EmptyState
        icon={
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-tertiary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <line x1="19" y1="8" x2="19" y2="14" />
            <line x1="22" y1="11" x2="16" y2="11" />
          </svg>
        }
        message="Follow some artists to see their work here"
      />
    );
  }

  // Loading state
  if (loading && viewType === 'grid') {
    return <LoadingSpinner message="Loading friends' submissions..." />;
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
            onSortModeChange={(mode) => setSortMode(mode as SortMode)}
            isRankedAvailable={isRankedAvailable}
            showLikesOption={false}
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
            todayStr={todayStr}
            hasSubmittedToday={hasSubmittedToday}
            loading={calendarLoading}
            counts={friendsCounts}
            challengesMap={challengesMap}
            onDayClick={handleDayClick}
          />
        </div>
      )}

      {/* Grid view */}
      {viewType === 'grid' && (
        !canViewCurrentDay ? (
          <EmptyState
            icon={
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-tertiary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            }
            message="Save your art first, in order to see friends' submissions for today"
          >
            <Link href="/" className="text-sm text-(--color-accent) hover:underline">
              ← Back to canvas
            </Link>
          </EmptyState>
        ) : (
          <>
            {/* Empty state for no submissions on this day */}
            {submissions.length === 0 ? (
            <EmptyState
              icon={
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-tertiary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                </svg>
              }
              message="None of your friends posted on this day"
            />
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
                    title={`Submitted at ${formatTime(submission.created_at)}`}
                  >
                    <SubmissionCard
                      shapes={submission.shapes}
                      groups={submission.groups}
                      backgroundColor={submission.background_color}
                      showNickname={true}
                      nickname={submission.nickname}
                      avatarUrl={submission.avatar_url}
                      href={onSubmissionClick ? undefined : getSubmissionHref(submission.id)}
                      onClick={onSubmissionClick ? () => onSubmissionClick(submission.id) : undefined}
                      likeCount={submission.like_count + (countAdjustments.get(submission.id) ?? 0)}
                      isLiked={likedSet.has(submission.id)}
                      isOwnSubmission={user?.id === submission.user_id}
                      onLikeToggle={() => handleLikeToggle(submission.id)}
                      rank={submission.final_rank !== undefined && submission.final_rank >= 1 && submission.final_rank <= 3 ? submission.final_rank as 1 | 2 | 3 : undefined}
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
          ) : null}
          </>
        )
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
