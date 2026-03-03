import { getTodayDateUTC } from './dailyChallenge';

export const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const DAYS_OF_WEEK_SHORT = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export function formatDate(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

export function getFirstDayOfMonth(year: number, month: number): number {
  // Monday-based: Mon=0, Tue=1, ..., Sun=6
  return (new Date(year, month, 1).getDay() + 6) % 7;
}

/**
 * Get the previous and next day strings relative to a given date.
 * Next is capped at today (no future dates).
 */
export function getAdjacentDates(date: string): { prev: string | null; next: string | null } {
  const today = getTodayDateUTC();
  const targetDate = new Date(date + 'T00:00:00Z');

  const prevDate = new Date(targetDate);
  prevDate.setUTCDate(prevDate.getUTCDate() - 1);
  const prev = prevDate.toISOString().split('T')[0];

  let next: string | null = null;
  if (date < today) {
    const nextDate = new Date(targetDate);
    nextDate.setUTCDate(nextDate.getUTCDate() + 1);
    const nextStr = nextDate.toISOString().split('T')[0];
    if (nextStr <= today) {
      next = nextStr;
    }
  }

  return { prev, next };
}

/**
 * Check if a date is today or yesterday.
 */
export function isDateWithinLastTwoDays(date: string): boolean {
  const today = getTodayDateUTC();
  const yesterday = new Date(today + 'T00:00:00Z');
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  return date === today || date === yesterdayStr;
}
