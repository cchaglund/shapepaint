import { useState, useEffect, useCallback, useRef } from 'react';
import type { Shape, ShapeGroup } from '../../types';
import { getTodayDateUTC } from '../../utils/dailyChallenge';
import { getAdjacentDates, isDateWithinLastTwoDays } from '../../utils/calendarUtils';
import { canViewCurrentDay as canViewCurrentDayUtil } from '../../utils/privacyRules';
import { fetchWallSubmissionsFromDB, fetchWallSubmissionsRanked, fetchNicknames, fetchRankingsBySubmissionIds, type WallSortMode } from '../../lib/api';

// =============================================================================
// Types
// =============================================================================

export type SortMode = 'newest' | 'oldest' | 'ranked' | 'likes';

export interface WallSubmission {
  id: string;
  user_id: string;
  nickname: string;
  shapes: Shape[];
  groups: ShapeGroup[];
  background_color_index: number | null;
  created_at: string;
  final_rank?: number;
  like_count: number;
}

export interface UseWallOfTheDayOptions {
  date: string;
  hasSubmittedToday: boolean;
}

export interface UseWallOfTheDayReturn {
  submissions: WallSubmission[];
  loading: boolean;
  error: string | null;

  sortMode: SortMode;
  setSortMode: (mode: SortMode) => void;

  canViewCurrentDay: boolean;
  isRankedAvailable: boolean;

  hasMore: boolean;
  loadMore: () => Promise<void>;

  adjacentDates: { prev: string | null; next: string | null };
}

// =============================================================================
// Module-level Cache (in-memory only, no localStorage)
// =============================================================================

const wallCache = new Map<string, WallSubmission[]>();
const pendingRequests = new Map<string, Promise<WallSubmission[]>>();

export function invalidateWallCache(date: string): void {
  // Invalidate all sort modes for this date
  for (const key of wallCache.keys()) {
    if (key.startsWith(`wall-${date}-`)) {
      wallCache.delete(key);
    }
  }
}

export function clearAllWallCache(): void {
  wallCache.clear();
}

// =============================================================================
// Data Fetching
// =============================================================================

const INITIAL_LIMIT = 100;

async function fetchRankedSubmissions(date: string, limit: number): Promise<WallSubmission[]> {
  const data = await fetchWallSubmissionsRanked(date, limit + 1);
  if (!data || data.length === 0) return [];

  // Extract embedded submission data from the join
  const submissions = data.map(r => {
    const s = r.submissions as unknown as {
      id: string; user_id: string; shapes: unknown; groups: unknown;
      background_color_index: number | null; created_at: string; like_count: number;
    };
    return {
      id: s.id,
      user_id: s.user_id,
      shapes: s.shapes as Shape[],
      groups: (s.groups as ShapeGroup[]) || [],
      background_color_index: s.background_color_index,
      created_at: s.created_at,
      like_count: s.like_count ?? 0,
      final_rank: r.final_rank as number,
    };
  });

  const userIds = [...new Set(submissions.map(s => s.user_id))];
  const nicknameMap = await fetchNicknames(userIds);

  return submissions.map(s => ({
    ...s,
    nickname: nicknameMap.get(s.user_id) || 'Anonymous',
  }));
}

async function fetchSortedSubmissions(date: string, sortMode: WallSortMode, limit: number): Promise<WallSubmission[]> {
  const submissions = await fetchWallSubmissionsFromDB(date, limit + 1, sortMode);
  if (!submissions || submissions.length === 0) return [];

  const userIds = [...new Set(submissions.map(s => s.user_id))];
  const nicknameMap = await fetchNicknames(userIds);

  const submissionIds = submissions.map(s => s.id);
  const rankMap = await fetchRankingsBySubmissionIds(submissionIds);

  return submissions.map(s => ({
    id: s.id,
    user_id: s.user_id,
    nickname: nicknameMap.get(s.user_id) || 'Anonymous',
    shapes: s.shapes as Shape[],
    groups: (s.groups as ShapeGroup[]) || [],
    background_color_index: s.background_color_index,
    created_at: s.created_at,
    final_rank: rankMap.get(s.id),
    like_count: s.like_count ?? 0,
  }));
}

export async function fetchWallSubmissions(date: string, sortMode: SortMode = 'newest'): Promise<WallSubmission[]> {
  const cacheKey = `wall-${date}-${sortMode}`;
  const isToday = date === getTodayDateUTC();

  // Always refetch today's wall so users see new submissions
  if (!isToday && wallCache.has(cacheKey)) {
    return wallCache.get(cacheKey)!;
  }

  if (pendingRequests.has(cacheKey)) {
    return pendingRequests.get(cacheKey)!;
  }

  const promise = sortMode === 'ranked'
    ? fetchRankedSubmissions(date, INITIAL_LIMIT)
    : fetchSortedSubmissions(date, sortMode, INITIAL_LIMIT);

  pendingRequests.set(cacheKey, promise);

  try {
    const data = await promise;
    wallCache.set(cacheKey, data);
    return data;
  } finally {
    pendingRequests.delete(cacheKey);
  }
}

// =============================================================================
// Hook
// =============================================================================

export function useWallOfTheDay(options: UseWallOfTheDayOptions): UseWallOfTheDayReturn {
  const { date, hasSubmittedToday } = options;
  const today = getTodayDateUTC();

  const [submissions, setSubmissions] = useState<WallSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>('newest');

  const [displayLimit, setDisplayLimit] = useState(INITIAL_LIMIT);

  const abortControllerRef = useRef<AbortController | null>(null);

  const canViewCurrentDay = canViewCurrentDayUtil(date, today, hasSubmittedToday);
  const isRankedAvailable = !isDateWithinLastTwoDays(date);
  const adjacentDates = getAdjacentDates(date);

  const fetchData = useCallback(async () => {
    if (!canViewCurrentDay) {
      setSubmissions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();

    try {
      const data = await fetchWallSubmissions(date, sortMode);
      setSubmissions(data);
      setDisplayLimit(INITIAL_LIMIT);
    } catch (err) {
      console.error('Failed to fetch wall submissions:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [date, canViewCurrentDay, sortMode]);

  useEffect(() => {
    fetchData();
    return () => {
      abortControllerRef.current?.abort();
    };
  }, [fetchData]);

  const displayedSubmissions = submissions.slice(0, displayLimit);
  const hasMore = submissions.length > displayLimit;

  const loadMore = useCallback(async () => {
    setDisplayLimit(prev => prev + INITIAL_LIMIT);
  }, []);

  const handleSetSortMode = useCallback((mode: SortMode) => {
    if (mode === 'ranked' && !isRankedAvailable) return;
    setSortMode(mode);
  }, [isRankedAvailable]);

  return {
    submissions: displayedSubmissions,
    loading,
    error,
    sortMode,
    setSortMode: handleSetSortMode,
    canViewCurrentDay,
    isRankedAvailable,
    hasMore,
    loadMore,
    adjacentDates,
  };
}
