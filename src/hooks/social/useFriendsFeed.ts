import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import type { Shape, ShapeGroup } from '../../types';
import { getTodayDateUTC } from '../../utils/dailyChallenge';
import { getAdjacentDates, isDateWithinLastTwoDays } from '../../utils/calendarUtils';
import { canViewCurrentDay as canViewCurrentDayUtil } from '../../utils/privacyRules';
import { fisherYatesShuffle } from '../../utils/wallSorting';
import { useFollows } from './useFollows';
import { useAuth } from '../auth/useAuth';

// =============================================================================
// Types
// =============================================================================

export type SortMode = 'random' | 'newest' | 'oldest' | 'ranked' | 'likes';

export interface FriendsSubmission {
  id: string;
  user_id: string;
  nickname: string;
  shapes: Shape[];
  groups: ShapeGroup[];
  background_color_index: number | null;
  created_at: string;
  final_rank?: number;
}

export interface UseFriendsFeedOptions {
  date: string;
  hasSubmittedToday: boolean;
}

export interface UseFriendsFeedReturn {
  submissions: FriendsSubmission[];
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

const friendsFeedCache = new Map<string, FriendsSubmission[]>();
const pendingRequests = new Map<string, Promise<FriendsSubmission[]>>();

/**
 * Invalidate friends feed cache for a specific date.
 * Call this when user follows/unfollows to ensure fresh data.
 */
export function invalidateFriendsFeedCache(date?: string): void {
  if (date) {
    friendsFeedCache.delete(`friends-feed-${date}`);
  } else {
    // Clear all cache when date not specified (e.g., on follow/unfollow)
    friendsFeedCache.clear();
  }
}

/**
 * Clear entire friends feed cache (useful for debugging)
 */
export function clearAllFriendsFeedCache(): void {
  friendsFeedCache.clear();
}

// =============================================================================
// Data Fetching
// =============================================================================

const INITIAL_LIMIT = 100;

async function fetchFriendsSubmissions(
  date: string,
  followingIds: string[]
): Promise<FriendsSubmission[]> {
  const cacheKey = `friends-feed-${date}`;

  // Check cache
  if (friendsFeedCache.has(cacheKey)) {
    return friendsFeedCache.get(cacheKey)!;
  }

  // Check for pending request (request deduplication)
  if (pendingRequests.has(cacheKey)) {
    return pendingRequests.get(cacheKey)!;
  }

  // No friends = no submissions
  if (followingIds.length === 0) {
    return [];
  }

  // Create and track new request
  const promise = (async (): Promise<FriendsSubmission[]> => {
    // Fetch submissions from users we follow
    const { data: submissions, error: submissionsError } = await supabase
      .from('submissions')
      .select(`
        id,
        user_id,
        shapes,
        groups,
        background_color_index,
        created_at
      `)
      .eq('challenge_date', date)
      .eq('included_in_ranking', true)
      .in('user_id', followingIds)
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
    const friendsSubmissions: FriendsSubmission[] = submissions.map(s => ({
      id: s.id,
      user_id: s.user_id,
      nickname: nicknameMap.get(s.user_id) || 'Anonymous',
      shapes: s.shapes as Shape[],
      groups: (s.groups as ShapeGroup[]) || [],
      background_color_index: s.background_color_index,
      created_at: s.created_at,
      final_rank: rankMap.get(s.id),
    }));

    return friendsSubmissions;
  })();

  pendingRequests.set(cacheKey, promise);

  try {
    const data = await promise;
    friendsFeedCache.set(cacheKey, data);
    return data;
  } finally {
    pendingRequests.delete(cacheKey);
  }
}

// =============================================================================
// Hook
// =============================================================================

export function useFriendsFeed(options: UseFriendsFeedOptions): UseFriendsFeedReturn {
  const { date, hasSubmittedToday } = options;
  const today = getTodayDateUTC();
  const { user } = useAuth();
  const { followingIds } = useFollows();

  const [submissions, setSubmissions] = useState<FriendsSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>('random');

  // Store shuffled order separately - only shuffle once per fetch
  const [shuffledIds, setShuffledIds] = useState<string[]>([]);

  // Track displayed count for pagination
  const [displayLimit, setDisplayLimit] = useState(INITIAL_LIMIT);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Convert Set to array for dependency tracking and API calls
  const followingIdsArray = useMemo(() => Array.from(followingIds), [followingIds]);

  // Track previous following IDs to detect changes
  const prevFollowingIdsRef = useRef<string[]>([]);

  // Determine if user can view current day
  const canViewCurrentDay = canViewCurrentDayUtil(date, today, hasSubmittedToday);

  // Determine if ranked sort is available (only for n-2+ days)
  const isRankedAvailable = !isDateWithinLastTwoDays(date);

  // Calculate adjacent dates
  const adjacentDates = getAdjacentDates(date);

  // Invalidate cache when following list changes
  useEffect(() => {
    const prevIds = prevFollowingIdsRef.current;
    const currentIds = followingIdsArray;

    // Check if following list has changed
    const hasChanged =
      prevIds.length !== currentIds.length ||
      prevIds.some((id, i) => currentIds[i] !== id);

    if (hasChanged && prevIds.length > 0) {
      // Following list changed, invalidate all cache
      invalidateFriendsFeedCache();
    }

    prevFollowingIdsRef.current = currentIds;
  }, [followingIdsArray]);

  // Fetch submissions
  const fetchData = useCallback(async () => {
    // Skip fetch if not logged in
    if (!user) {
      setSubmissions([]);
      setLoading(false);
      return;
    }

    // Skip fetch if blocked by privacy rules
    if (!canViewCurrentDay) {
      setSubmissions([]);
      setLoading(false);
      return;
    }

    // Skip fetch if no friends
    if (followingIdsArray.length === 0) {
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
      const data = await fetchFriendsSubmissions(date, followingIdsArray);
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
      console.error('Failed to fetch friends feed submissions:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [date, canViewCurrentDay, followingIdsArray, user]);

  // Fetch on mount and when dependencies change
  useEffect(() => {
    fetchData();
    return () => {
      abortControllerRef.current?.abort();
    };
  }, [fetchData]);

  // Sort submissions based on current mode
  const sortedSubmissions = (() => {
    if (submissions.length === 0) return [];

    let sorted: FriendsSubmission[];

    switch (sortMode) {
      case 'random': {
        // Use pre-shuffled order
        const idToSubmission = new Map(submissions.map(s => [s.id, s]));
        sorted = shuffledIds
          .map(id => idToSubmission.get(id))
          .filter((s): s is FriendsSubmission => s !== undefined);
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
