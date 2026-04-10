import { useState, useEffect, useCallback, useRef } from 'react';
import type { Shape, ShapeGroup, SubmissionRenderData } from '../../types';
import { getTodayDateUTC } from '../../utils/dailyChallenge';
import { getAdjacentDates, isDateWithinLastTwoDays } from '../../utils/calendarUtils';
import { canViewCurrentDay as canViewCurrentDayUtil } from '../../utils/privacyRules';
import { fetchWallCached, type WallCacheSortMode } from '../../lib/api';

// =============================================================================
// Types
// =============================================================================

export type SortMode = 'newest' | 'oldest' | 'ranked' | 'likes';

export interface WallSubmission extends SubmissionRenderData {
  id: string;
  user_id: string;
  nickname: string;
  avatar_url: string | null;
  groups: ShapeGroup[];
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

// Single RPC call replaces the old 3-query flow (submissions + nicknames + rankings).
// The DB function handles the join and caches the result server-side (see wall_cache migration).
async function fetchFromRPC(date: string, sortMode: SortMode, limit: number): Promise<WallSubmission[]> {
  const data = await fetchWallCached(date, sortMode as WallCacheSortMode, limit + 1);
  return data.map(row => ({
    id: row.id,
    user_id: row.user_id,
    nickname: row.nickname,
    avatar_url: row.avatar_url,
    shapes: row.shapes as Shape[],
    groups: (row.groups as ShapeGroup[]) || [],
    background_color: row.background_color ?? undefined,
    created_at: row.created_at,
    final_rank: row.final_rank ?? undefined,
    like_count: row.like_count,
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

  const promise = fetchFromRPC(date, sortMode, INITIAL_LIMIT);

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

  // Reset to 'newest' if current sort mode isn't applicable for this day
  useEffect(() => {
    if (sortMode === 'ranked' && !isRankedAvailable) {
      setSortMode('newest');
    }
  }, [isRankedAvailable, sortMode]);

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
