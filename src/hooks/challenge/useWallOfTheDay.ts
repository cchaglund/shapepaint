import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import type { Shape, ShapeGroup } from '../../types';
import { getTodayDateUTC } from '../../utils/dailyChallenge';
import { getAdjacentDates, isDateWithinLastTwoDays } from '../../utils/calendarUtils';
import { canViewCurrentDay as canViewCurrentDayUtil } from '../../utils/privacyRules';
import { fisherYatesShuffle } from '../../utils/wallSorting';

// =============================================================================
// Types
// =============================================================================

export type SortMode = 'random' | 'newest' | 'oldest' | 'ranked' | 'likes';

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

/**
 * Invalidate wall cache for a specific date.
 * Call this when user saves a submission to ensure fresh data.
 */
export function invalidateWallCache(date: string): void {
  wallCache.delete(`wall-${date}`);
}

/**
 * Clear entire wall cache (useful for debugging)
 */
export function clearAllWallCache(): void {
  wallCache.clear();
}

// =============================================================================
// Data Fetching
// =============================================================================

const INITIAL_LIMIT = 100;

export async function fetchWallSubmissions(date: string): Promise<WallSubmission[]> {
  const cacheKey = `wall-${date}`;

  // Check cache
  if (wallCache.has(cacheKey)) {
    return wallCache.get(cacheKey)!;
  }

  // Check for pending request (request deduplication)
  if (pendingRequests.has(cacheKey)) {
    return pendingRequests.get(cacheKey)!;
  }

  // Create and track new request
  const promise = (async (): Promise<WallSubmission[]> => {
    // Fetch submissions
    const { data: submissions, error: submissionsError } = await supabase
      .from('submissions')
      .select(`
        id,
        user_id,
        shapes,
        groups,
        background_color_index,
        created_at,
        like_count
      `)
      .eq('challenge_date', date)
      .eq('included_in_ranking', true)
      .limit(INITIAL_LIMIT + 1); // +1 to check if more exist

    if (submissionsError) {
      throw new Error(submissionsError.message || 'Failed to fetch submissions');
    }

    if (!submissions || submissions.length === 0) {
      return [];
    }

    // Batch fetch nicknames separately (avoid RLS join issues)
    const userIds = [...new Set(submissions.map(s => s.user_id))];
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, nickname')
      .in('id', userIds);

    if (profilesError) {
      console.error('Failed to fetch profiles:', profilesError);
    }

    // Create nickname lookup map
    const nicknameMap = new Map<string, string>();
    if (profiles) {
      for (const profile of profiles) {
        nicknameMap.set(profile.id, profile.nickname || 'Anonymous');
      }
    }

    // Batch fetch final_rank from daily_rankings
    const submissionIds = submissions.map(s => s.id);
    const rankMap = new Map<string, number>();
    const { data: rankings, error: rankingsError } = await supabase
      .from('daily_rankings')
      .select('submission_id, final_rank')
      .in('submission_id', submissionIds)
      .not('final_rank', 'is', null);

    if (rankingsError) {
      console.error('Failed to fetch rankings:', rankingsError);
    } else if (rankings) {
      for (const r of rankings) {
        rankMap.set(r.submission_id, r.final_rank as number);
      }
    }

    // Map submissions with nicknames and ranks
    const wallSubmissions: WallSubmission[] = submissions.map(s => ({
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

    return wallSubmissions;
  })();

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
  const [sortMode, setSortMode] = useState<SortMode>('random');

  // Store shuffled order separately - only shuffle once per fetch
  const [shuffledIds, setShuffledIds] = useState<string[]>([]);

  // Track displayed count for pagination
  const [displayLimit, setDisplayLimit] = useState(INITIAL_LIMIT);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Determine if user can view current day
  const canViewCurrentDay = canViewCurrentDayUtil(date, today, hasSubmittedToday);

  // Determine if ranked sort is available (only for n-2+ days)
  const isRankedAvailable = !isDateWithinLastTwoDays(date);

  // Calculate adjacent dates
  const adjacentDates = getAdjacentDates(date);

  // Fetch submissions
  const fetchData = useCallback(async () => {
    // Skip fetch if blocked
    if (!canViewCurrentDay) {
      setSubmissions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    // Cancel any in-flight request
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();

    try {
      const data = await fetchWallSubmissions(date);
      setSubmissions(data);

      // Shuffle IDs for random sort (only once per fetch)
      if (data.length > 0) {
        setShuffledIds(fisherYatesShuffle(data.map(s => s.id)));
      } else {
        setShuffledIds([]);
      }

      // Reset display limit when date changes
      setDisplayLimit(INITIAL_LIMIT);
    } catch (err) {
      console.error('Failed to fetch wall submissions:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [date, canViewCurrentDay]);

  // Fetch on mount and when date changes
  useEffect(() => {
    fetchData();
    return () => {
      abortControllerRef.current?.abort();
    };
  }, [fetchData]);

  // Sort submissions based on current mode
  const sortedSubmissions = (() => {
    if (submissions.length === 0) return [];

    let sorted: WallSubmission[];

    switch (sortMode) {
      case 'random': {
        // Use pre-shuffled order
        const idToSubmission = new Map(submissions.map(s => [s.id, s]));
        sorted = shuffledIds
          .map(id => idToSubmission.get(id))
          .filter((s): s is WallSubmission => s !== undefined);
        break;
      }

      case 'newest':
        sorted = [...submissions].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        break;

      case 'oldest':
        sorted = [...submissions].sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        break;

      case 'ranked':
        // Only show ranked if available and has final_rank
        if (!isRankedAvailable) {
          sorted = [...submissions];
        } else {
          // Filter out submissions without final_rank, then sort
          const withRank = submissions.filter(s => s.final_rank !== undefined);
          sorted = withRank.sort((a, b) => (a.final_rank ?? 0) - (b.final_rank ?? 0));
        }
        break;

      case 'likes':
        // Sort by like_count DESC, ties broken by earliest submission time
        sorted = [...submissions].sort((a, b) => {
          const likeDiff = b.like_count - a.like_count;
          if (likeDiff !== 0) return likeDiff;
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        });
        break;

      default:
        sorted = [...submissions];
    }

    // Apply display limit for pagination
    return sorted.slice(0, displayLimit);
  })();

  // Check if there are more submissions to load
  const hasMore = submissions.length > displayLimit;

  // Load more submissions
  const loadMore = useCallback(async () => {
    setDisplayLimit(prev => prev + INITIAL_LIMIT);
  }, []);

  // Handle sort mode change - reset to random if ranked not available
  const handleSetSortMode = useCallback((mode: SortMode) => {
    if (mode === 'ranked' && !isRankedAvailable) {
      return; // Ignore invalid sort mode
    }
    setSortMode(mode);
  }, [isRankedAvailable]);

  return {
    submissions: sortedSubmissions,
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
