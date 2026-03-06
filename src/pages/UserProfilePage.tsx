import { useState, useMemo, useCallback, useEffect } from 'react';
import { Link } from '../components/shared/Link';
import { useUserProfile } from '../hooks/social/useUserProfile';
import { useAuth } from '../hooks/auth/useAuth';
import { useSubmissions } from '../hooks/submission/useSubmissions';
import { FollowButton } from '../components/social/FollowButton';
import { getTodayDateUTC } from '../utils/dailyChallenge';
import { fetchChallengesBatch } from '../hooks/challenge/useDailyChallenge';
import { canViewCurrentDay } from '../utils/privacyRules';
import {
  MONTHS,
  formatDate,
  getDaysInMonth,
  getFirstDayOfMonth,
} from '../utils/calendarUtils';
import { CalendarGrid } from '../components/Calendar/CalendarGrid';
import { CalendarDayCell } from '../components/Calendar/CalendarDayCell';
import { ContentNavigation } from '../components/Calendar/ContentNavigation';
import type { DailyChallenge } from '../types';
import { BackToCanvasLink } from '../components/shared/BackToCanvasLink';

interface UserProfilePageProps {
  userId: string;
}

export function UserProfilePage({ userId }: UserProfilePageProps) {
  const { user } = useAuth();
  const todayDate = useMemo(() => getTodayDateUTC(), []);
  const { hasSubmittedToday } = useSubmissions(user?.id, todayDate);
  const { profile, submissions, loading, notFound, error } = useUserProfile({ userId });

  const [currentYear, setCurrentYear] = useState(() => new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(() => new Date().getMonth());
  const [challenges, setChallenges] = useState<Map<string, DailyChallenge>>(new Map());

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

  // Create a map of date -> submission for quick lookup
  const submissionsByDate = useMemo(() => {
    const map = new Map<string, (typeof submissions)[number]>();
    submissions.forEach((sub) => {
      map.set(sub.challenge_date, sub);
    });
    return map;
  }, [submissions]);

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

  // Check if we can go to next month
  const canGoNext = useMemo(() => {
    const now = new Date();
    return (
      currentYear < now.getFullYear() ||
      (currentYear === now.getFullYear() && currentMonth < now.getMonth())
    );
  }, [currentYear, currentMonth]);

  // Error state (network errors, etc.)
  if (error && !loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-(--color-bg-primary)">
        <div className="text-center">
          <p className="text-(--color-text-secondary) mb-4">Something went wrong</p>
          <p className="text-base text-(--color-text-tertiary) mb-4">{error}</p>
          <BackToCanvasLink/>
        </div>
      </div>
    );
  }

  // Not found state
  if (notFound && !loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-(--color-bg-primary)">
        <div className="text-center">
          <p className="text-(--color-text-secondary) mb-4">User not found</p>
          <BackToCanvasLink/>
        </div>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-(--color-bg-primary)">
        <div className="text-(--color-text-secondary)">Loading profile...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8 bg-(--color-bg-primary) theme-pattern">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-base hover:underline text-(--color-text-secondary) mb-4"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Back to app
          </Link>

          {/* Profile header */}
          <div className="flex items-start justify-between gap-4 mb-2">
            <div>
              <h1 className="text-2xl font-bold text-(--color-text-primary) font-display">
                @{profile?.nickname || 'Anonymous'}
              </h1>
              <p className="text-base text-(--color-text-secondary) mt-1">
                {profile?.followingCount ?? 0} following · {profile?.followersCount ?? 0} followers
              </p>
            </div>
            <FollowButton targetUserId={userId} />
          </div>
        </div>

        {/* Calendar Navigation */}
        <div className="mb-4">
          <ContentNavigation
            label={`${MONTHS[currentMonth]} ${currentYear}`}
            onPrev={goToPreviousMonth}
            onNext={goToNextMonth}
            onToday={goToToday}
            canGoNext={canGoNext}
          />
        </div>

        {/* Calendar Grid */}
        <CalendarGrid emptySlotCount={calendarDays.findIndex((d) => d !== null)}>
          {calendarDays
            .filter((day): day is number => day !== null)
            .map((day) => {
              const dateStr = formatDate(currentYear, currentMonth, day);
              const isToday = dateStr === todayDate;
              const isFuture = dateStr > todayDate;
              const submission = submissionsByDate.get(dateStr);
              const challenge = challenges.get(dateStr);
              const canViewThisDay = canViewCurrentDay(dateStr, todayDate, hasSubmittedToday);

              return (
                <CalendarDayCell
                  key={dateStr}
                  day={day}
                  dateStr={dateStr}
                  viewMode="my-submissions"
                  isToday={isToday}
                  isFuture={isFuture}
                  challenge={challenge}
                  submission={canViewThisDay ? submission : undefined}
                  ranking={undefined}
                  dayWinners={undefined}
                  latestWinnersDate=""
                  canView={canViewThisDay}
                  lockedContent={
                    <div className="text-xs text-center text-(--color-text-tertiary) px-1">
                      Save your art to see
                    </div>
                  }
                  hideEmptyDayIcon
                  href={submission && canViewThisDay ? `/?view=submission&date=${dateStr}&user=${userId}` : undefined}
                />
              );
            })}
        </CalendarGrid>

        {/* Stats */}
        <div className="mt-4 text-base text-(--color-text-secondary) text-center">
          {submissions.length} public {submissions.length === 1 ? 'submission' : 'submissions'}
        </div>
      </div>
    </div>
  );
}
