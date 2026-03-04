import { useState, useEffect, useMemo, useCallback } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { navigate } from '../../lib/router';
import { Link } from '../shared/Link';
import { useAuth } from '../../hooks/auth/useAuth';
import { useSubmissions, type Submission } from '../../hooks/submission/useSubmissions';
import { getTodayDateUTC, getTwoDaysAgoDateUTC } from '../../utils/dailyChallenge';
import { fetchChallengesBatch } from '../../hooks/challenge/useDailyChallenge';
import { supabase } from '../../lib/supabase';
import type { Shape, ShapeGroup, DailyChallenge } from '../../types';
import { formatDate, getDaysInMonth, getFirstDayOfMonth, MONTHS } from '../../utils/calendarUtils';
import type { ViewMode, RankingInfo, WinnerEntry } from '../Calendar/types';
import { CalendarViewToggle } from '../Calendar/CalendarViewToggle';
import { ContentNavigation } from '../Calendar/ContentNavigation';
import { CalendarGrid } from '../Calendar/CalendarGrid';
import { CalendarDayCell } from '../Calendar/CalendarDayCell';
import { CalendarStats } from '../Calendar/CalendarStats';
import { WallTab } from '../Calendar/tabs/WallTab';
import { FriendsFeedTab } from '../Calendar/tabs/FriendsFeedTab';
import { TopBar } from '../canvas/TopBar';
import type { ThemeMode, ThemeName } from '../../hooks/ui/useThemeState';

interface GalleryPageProps {
  tab?: string;
  year?: number;
  month?: number;
  date?: string;
  themeMode: ThemeMode;
  onSetThemeMode: (mode: ThemeMode) => void;
  themeName: ThemeName;
  onSetThemeName: (name: ThemeName) => void;
}

export function GalleryPage({ tab: initialTab, year: initialYear, month: initialMonth, date: initialDate, themeMode, onSetThemeMode, themeName, onSetThemeName }: GalleryPageProps) {
  const { user } = useAuth();
  const todayStr = useMemo(() => getTodayDateUTC(), []);
  const { loadMySubmissions, loading, hasSubmittedToday: submittedToday, hasCheckedSubmission } = useSubmissions(user?.id, todayStr);
  // Optimistic: assume submitted while check is pending to avoid flashing locked state
  const hasSubmittedToday = !hasCheckedSubmission || submittedToday;
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

  // Load submissions (only when in my-submissions mode)
  useEffect(() => {
    if (user && effectiveViewMode === 'my-submissions') {
      loadMySubmissions().then(({ data }) => {
        setSubmissions(data);
        if (data.length > 0) {
          const submissionIds = data.map((s) => s.id);
          supabase
            .from('daily_rankings')
            .select('submission_id, final_rank')
            .in('submission_id', submissionIds)
            .not('final_rank', 'is', null)
            .then(({ data: rankingData }) => {
              if (rankingData) {
                const rankMap = new Map<string, number>();
                (rankingData as RankingInfo[]).forEach((r) => {
                  if (r.final_rank !== null) {
                    rankMap.set(r.submission_id, r.final_rank);
                  }
                });
                setRankings(rankMap);
              }
            });
        }
      });
    }
  }, [user, effectiveViewMode, loadMySubmissions]);

  // Load winners for the current month when in winners mode
  useEffect(() => {
    if (effectiveViewMode !== 'winners') return;

    const loadWinners = async () => {
      setWinnersLoading(true);

      const startDate = formatDate(currentYear, currentMonth, 1);
      const daysInMonth = getDaysInMonth(currentYear, currentMonth);
      const endDate = formatDate(currentYear, currentMonth, daysInMonth);

      const { data: rankingsData, error } = await supabase
        .from('daily_rankings')
        .select(`
          challenge_date,
          submission_id,
          user_id,
          final_rank,
          submissions!inner (
            shapes,
            groups,
            background_color_index
          )
        `)
        .eq('final_rank', 1)
        .gte('challenge_date', startDate)
        .lte('challenge_date', endDate <= latestWinnersDate ? endDate : latestWinnersDate)
        .order('challenge_date', { ascending: true });

      if (error) {
        console.error('Error loading winners:', error);
        setWinnersLoading(false);
        return;
      }

      if (!rankingsData || rankingsData.length === 0) {
        setWinners([]);
        setWinnersLoading(false);
        return;
      }

      const userIds = [...new Set(rankingsData.map((r: { user_id: string }) => r.user_id))];
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, nickname')
        .in('id', userIds);

      const profileMap = new Map<string, string>();
      if (profilesData) {
        profilesData.forEach((p: { id: string; nickname: string }) => {
          profileMap.set(p.id, p.nickname);
        });
      }

      interface RankingRow {
        challenge_date: string;
        submission_id: string;
        user_id: string;
        final_rank: number;
        submissions: { shapes: Shape[]; groups: ShapeGroup[] | null; background_color_index: number | null };
      }
      const winnerEntries: WinnerEntry[] = (rankingsData as unknown as RankingRow[]).map((row) => ({
        challenge_date: row.challenge_date,
        submission_id: row.submission_id,
        user_id: row.user_id,
        nickname: profileMap.get(row.user_id) || 'Anonymous',
        final_rank: row.final_rank,
        shapes: row.submissions?.shapes || [],
        groups: row.submissions?.groups || [],
        background_color_index: row.submissions?.background_color_index ?? null,
      }));

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

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-(--color-bg-primary)">
      <TopBar
        themeMode={themeMode}
        onSetThemeMode={onSetThemeMode}
        themeName={themeName}
        onSetThemeName={onSetThemeName}
        centerContent={
          <span className="text-lg font-semibold text-(--color-text-primary) font-display">Gallery</span>
        }
        rightContent={
          <Link
            href="/"
            className="h-9 md:h-8 px-2 md:px-3 rounded-(--radius-pill) text-xs font-medium transition-colors text-(--color-text-secondary) hover:bg-(--color-hover) hover:text-(--color-text-primary) no-underline flex items-center gap-1"
            style={{
              background: 'var(--color-selected)',
              border: 'var(--border-width, 2px) solid var(--color-border)',
              boxShadow: 'var(--shadow-btn)',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            <span className="hidden md:inline">Back to canvas</span>
          </Link>
        }
      />
      <div className="flex-1 overflow-auto p-4 md:p-8 theme-pattern">
        <div className="max-w-4xl mx-auto flex flex-col" style={{ minHeight: 'calc(100vh - 8rem)' }}>

        {/* Tab toggle */}
        <CalendarViewToggle
          effectiveViewMode={effectiveViewMode}
          user={user}
          onSetViewMode={handleSetViewMode}
        />

        {/* Tab content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={effectiveViewMode}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
          >
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
    </div>
  );
}
