import { useMemo } from 'react';
import { navigate } from '../lib/router';
import { WallContent } from '../Wall/WallContent';
import { useAuth } from '../hooks/auth/useAuth';
import { useSubmissions } from '../hooks/submission/useSubmissions';
import { getTodayDateUTC } from '../utils/dailyChallenge';
import { BackToCanvasLink } from '../shared/BackToCanvasLink';

interface WallOfTheDayPageProps {
  date: string;
}

export function WallOfTheDayPage({ date }: WallOfTheDayPageProps) {
  const { user } = useAuth();
  const todayDate = useMemo(() => getTodayDateUTC(), []);
  const { hasSubmittedToday } = useSubmissions(user?.id, todayDate);

  const handleDateChange = (newDate: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set('date', newDate);
    navigate(url.toString());
  };

  // Format date for display
  const formattedDate = useMemo(() => {
    const d = new Date(date + 'T00:00:00Z');
    return d.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC',
    });
  }, [date]);

  return (
    <div className="min-h-screen p-4 md:p-8 bg-(--color-bg-primary) theme-pattern">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <BackToCanvasLink />
          <h1 className="text-2xl font-bold mb-2 text-(--color-text-primary) font-display">
            Wall of the Day
          </h1>
          <p className="text-(--color-text-secondary)">{formattedDate}</p>
        </div>

        {/* Wall content */}
        <WallContent
          date={date}
          onDateChange={handleDateChange}
          hasSubmittedToday={hasSubmittedToday}
          showNavigation={true}
        />
      </div>
    </div>
  );
}
