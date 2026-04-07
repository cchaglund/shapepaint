import { useState, useEffect, useMemo, useCallback } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { navigate } from '../lib/router';
import { useAuth } from '../hooks/auth/useAuth';
import { useSubmissions, type Submission } from '../hooks/submission/useSubmissions';
import { getTodayDateUTC, getTwoDaysAgoDateUTC } from '../utils/dailyChallenge';
import { fetchChallengesBatch } from '../hooks/challenge/useDailyChallenge';
import { fetchRankingsBySubmissionIds, fetchMonthlyWinners } from '../lib/api';
import type { DailyChallenge } from '../types';
import { formatDate, getDaysInMonth, getFirstDayOfMonth, MONTHS } from '../utils/calendarUtils';
import type { ViewMode, WinnerEntry } from '../components/Calendar/types';
import { CalendarViewToggle } from '../components/Calendar/CalendarViewToggle';
import { ContentNavigation } from '../components/Calendar/ContentNavigation';
import { CalendarGrid } from '../components/Calendar/CalendarGrid';
import { CalendarDayCell } from '../components/Calendar/CalendarDayCell';
import { CalendarStats } from '../components/Calendar/CalendarStats';
import { WallTab } from '../components/Calendar/tabs/WallTab';
import { FriendsFeedTab } from '../components/Calendar/tabs/FriendsFeedTab';
import { useSetHeader } from '../contexts/HeaderContext';
import { BackButton } from '../components/shared/BackButton';

const TAB_HEADERS: Record<ViewMode, { title: string; description: string }> = {
  'my-submissions': {
    title: 'My Submissions',
    description: 'Your daily artwork history. Tap any day to revisit your creation.',
  },
  winners: {
    title: 'Winners',
    description: 'The top-voted artworks from each day, crowned by the community.',
  },
  wall: {
    title: 'Wall of the Day',
    description: 'Browse all submissions for a given day. See what the community created with the same constraints.',
  },
  friends: {
    title: 'Friends',
    description: 'See what the people you follow have been creating. Follow artists from their profile page, or add them by nickname from your profile.',
  },
};

function TabHeader({ viewMode }: { viewMode: ViewMode }) {
  const { title, description } = TAB_HEADERS[viewMode];
  return (
    <div className="mt-4 mb-8">
      <h2 className="text-2xl font-bold text-(--color-text-primary) font-display">{title}</h2>
      <p className="text-sm text-(--color-text-secondary) mt-1">{description}</p>
    </div>
  );
}

export interface GalleryPageProps {
  tab?: string;
  year?: number;
  month?: number;
  date?: string;
}

export function GalleryPage({ tab: initialTab, year: initialYear, month: initialMonth, date: initialDate }: GalleryPageProps) {
  const { user } = useAuth();
  const todayStr = useMemo(() => getTodayDateUTC(), []);
  const { loadSubmissionsForMonth, loading, hasSubmittedToday: submittedToday, hasCheckedSubmission } = useSubmissions(user?.id, todayStr);
  // Optimistic: assume submitted while check is pending to avoid flashing locked state
  // But for logged-out users (no check will ever run), default to false
  const hasSubmittedToday = user ? (!hasCheckedSubmission || submittedToday) : false;
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [rankings, setRankings] = useState<Map<string, number>>(new Map());
  const [currentYear, setCurrentYear] = useState(() => initialYear ?? new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(() => initialMonth ?? new Date().getMonth());
  const [viewMode, setViewMode] = useState<ViewMode | null>(() => {
    if (initialTab && ['my-submissions', 'winners', 'wall', 'friends'].includes(initialTab)) {
      return initialTab as ViewMode;
    }
    return null;
  });
  const [winners, setWinners] = useState<WinnerEntry[]>([]);
  const [winnersLoading, setWinnersLoading] = useState(false);
  const [challenges, setChallenges] = useState<Map<string, DailyChallenge>>(new Map());
  const [wallDate, setWallDate] = useState(() => initialDate ?? getTodayDateUTC());
  const [friendsFeedDate, setFriendsFeedDate] = useState(() => initialDate ?? getTodayDateUTC());

  // Determine effective view mode - null until auth loads, then based on user
  const effectiveViewMode: ViewMode = viewMode ?? (user ? 'my-submissions' : 'winners');
  const latestWinnersDate = useMemo(() => getTwoDaysAgoDateUTC(), []);

  // Keep URL in sync with gallery state (tab, calendar position, date)
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('view', 'gallery');
    url.searchParams.set('tab', effectiveViewMode);

    if (effectiveViewMode === 'winners' || effectiveViewMode === 'my-submissions') {
      url.searchParams.set('year', String(currentYear));
      url.searchParams.set('month', String(currentMonth));
      url.searchParams.delete('date');
    } else {
      const date = effectiveViewMode === 'wall' ? wallDate : friendsFeedDate;
      url.searchParams.set('date', date);
      url.searchParams.delete('year');
      url.searchParams.delete('month');
    }

    if (url.toString() !== window.location.href) {
      navigate(url.toString(), { replace: true });
    }
  }, [effectiveViewMode, currentYear, currentMonth, wallDate, friendsFeedDate]);

  const handleSetViewMode = useCallback((mode: ViewMode) => {
    setViewMode(mode);
  }, []);

  // Load submissions for the current month (only when in my-submissions mode)
  useEffect(() => {
    if (user && effectiveViewMode === 'my-submissions') {
      const monthStart = formatDate(currentYear, currentMonth, 1);
      const daysInMonth = getDaysInMonth(currentYear, currentMonth);
      const monthEnd = formatDate(currentYear, currentMonth, daysInMonth);

      loadSubmissionsForMonth(monthStart, monthEnd).then(({ data }) => {
        setSubmissions(data);
        if (data.length > 0) {
          const submissionIds = data.map((s) => s.id);
          fetchRankingsBySubmissionIds(submissionIds).then((rankMap) => {
            setRankings(rankMap);
          });
        }
      });
    }
  }, [user, effectiveViewMode, currentYear, currentMonth, loadSubmissionsForMonth]);

  // Load winners for the current month when in winners mode
  useEffect(() => {
    if (effectiveViewMode !== 'winners') return;

    const loadWinners = async () => {
      setWinnersLoading(true);

      const startDate = formatDate(currentYear, currentMonth, 1);
      const daysInMonth = getDaysInMonth(currentYear, currentMonth);
      const endDate = formatDate(currentYear, currentMonth, daysInMonth);
      const clampedEnd = endDate <= latestWinnersDate ? endDate : latestWinnersDate;

      const winnerEntries = await fetchMonthlyWinners(startDate, clampedEnd);
      setWinners(winnerEntries);
      setWinnersLoading(false);
    };

    loadWinners();
  }, [effectiveViewMode, currentYear, currentMonth, latestWinnersDate]);

  // Fetch challenges for all days in the current month
  useEffect(() => {
    const daysInMonth = getDaysInMonth(currentYear, currentMonth);
    const dates: string[] = [];
    for (let day = 1; day <= daysInMonth; day++) {
      dates.push(formatDate(currentYear, currentMonth, day));
    }

    fetchChallengesBatch(dates).then((challengeMap) => {
      setChallenges(challengeMap);
    });
  }, [currentYear, currentMonth]);

  // Map date -> submission for quick lookup
  const submissionsByDate = useMemo(() => {
    const map = new Map<string, Submission>();
    submissions.forEach((sub) => {
      map.set(sub.challenge_date, sub);
    });
    return map;
  }, [submissions]);

  // Map date -> winners for quick lookup
  const winnersByDate = useMemo(() => {
    const map = new Map<string, WinnerEntry[]>();
    winners.forEach((winner) => {
      const existing = map.get(winner.challenge_date) || [];
      existing.push(winner);
      map.set(winner.challenge_date, existing);
    });
    return map;
  }, [winners]);

  // Generate calendar grid data
  const calendarDays = useMemo(() => {
    const daysInMonth = getDaysInMonth(currentYear, currentMonth);
    const firstDay = getFirstDayOfMonth(currentYear, currentMonth);
    const days: (number | null)[] = [];

    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
    }

    return days;
  }, [currentYear, currentMonth]);

  const goToPreviousMonth = useCallback(() => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  }, [currentMonth]);

  const goToNextMonth = useCallback(() => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  }, [currentMonth]);

  const goToToday = useCallback(() => {
    const now = new Date();
    setCurrentYear(now.getFullYear());
    setCurrentMonth(now.getMonth());
  }, []);

  const getDayHref = useCallback((day: number): string | undefined => {
    const dateStr = formatDate(currentYear, currentMonth, day);

    if (effectiveViewMode === 'my-submissions') {
      const submission = submissionsByDate.get(dateStr);
      if (submission) {
        return `/?view=submission&date=${dateStr}`;
      }
    } else {
      const dayWinners = winnersByDate.get(dateStr);
      if (dayWinners && dayWinners.length > 0) {
        return `/?view=winners-day&date=${dateStr}`;
      }
    }
    return undefined;
  }, [currentYear, currentMonth, effectiveViewMode, submissionsByDate, winnersByDate]);

  const canGoNext = useMemo(() => {
    const now = new Date();
    return currentYear < now.getFullYear() ||
      (currentYear === now.getFullYear() && currentMonth < now.getMonth());
  }, [currentYear, currentMonth]);

  const isCurrentMonth = useMemo(() => {
    const now = new Date();
    return currentYear === now.getFullYear() && currentMonth === now.getMonth();
  }, [currentYear, currentMonth]);

  const isLoading = (effectiveViewMode === 'my-submissions' && loading) ||
    (effectiveViewMode === 'winners' && winnersLoading);
  const loadingMessage = effectiveViewMode === 'my-submissions'
    ? 'Loading submissions...'
    : 'Loading winners...';

  useSetHeader({
    centerContent: <span className="text-lg font-semibold text-(--color-text-primary) font-display">Gallery</span>,
    rightContent: <BackButton href="/" label="Back to canvas" />,
  });

  return (
    <div className="flex-1 overflow-auto p-4 md:p-8 theme-pattern bg-(--color-bg-primary)">
        <div className="max-w-4xl mx-auto flex flex-col" style={{ minHeight: 'calc(100vh - 8rem)' }}>

        {/* Tab toggle */}
        <CalendarViewToggle
          effectiveViewMode={effectiveViewMode}
          user={user}
          onSetViewMode={handleSetViewMode}
        />

        {/* Tab header + content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={effectiveViewMode}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
          >
        <TabHeader viewMode={effectiveViewMode} />
        {effectiveViewMode === 'wall' ? (
          <WallTab
            date={wallDate}
            onDateChange={setWallDate}
            hasSubmittedToday={hasSubmittedToday}
          />
        ) : effectiveViewMode === 'friends' ? (
          <FriendsFeedTab
            date={friendsFeedDate}
            onDateChange={setFriendsFeedDate}
            hasSubmittedToday={hasSubmittedToday}
          />
        ) : (
          <>
            <ContentNavigation
              label={`${MONTHS[currentMonth]} ${currentYear}`}
              canGoNext={canGoNext}
              onPrev={goToPreviousMonth}
              onNext={goToNextMonth}
              onToday={goToToday}
              showToday={!isCurrentMonth}
            />

            {isLoading ? (
              <div className="flex items-center justify-center py-12 text-(--color-text-secondary) h-full">
                {loadingMessage}
              </div>
            ) : (
              <CalendarGrid
                className="mt-7"
                emptySlotCount={calendarDays.findIndex((d) => d !== null)}
              >
                {calendarDays
                  .filter((day): day is number => day !== null)
                  .map((day) => {
                    const dateStr = formatDate(currentYear, currentMonth, day);
                    const isToday = dateStr === todayStr;
                    const isFuture = dateStr > todayStr;
                    const challenge = challenges.get(dateStr);
                    const submission = submissionsByDate.get(dateStr);
                    const ranking = submission ? rankings.get(submission.id) : undefined;
                    const dayWinners = winnersByDate.get(dateStr);

                    return (
                      <CalendarDayCell
                        key={dateStr}
                        day={day}
                        dateStr={dateStr}
                        viewMode={effectiveViewMode}
                        isToday={isToday}
                        isFuture={isFuture}
                        challenge={challenge}
                        submission={submission}
                        ranking={ranking}
                        dayWinners={dayWinners}
                        latestWinnersDate={latestWinnersDate}
                        href={getDayHref(day)}
                      />
                    );
                  })}
              </CalendarGrid>
            )}

            <CalendarStats
              effectiveViewMode={effectiveViewMode}
              submissions={submissions}
              rankings={rankings}
              winners={winners}
            />
          </>
        )}
          </motion.div>
        </AnimatePresence>
        </div>
      </div>
  );
}
