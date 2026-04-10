import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { Shape, ShapeGroup, SubmissionRenderData } from '../../types';
import { getTodayDateUTC } from '../../utils/dailyChallenge';
import { getAdjacentDates, isDateWithinLastTwoDays } from '../../utils/calendarUtils';
import { canViewCurrentDay as canViewCurrentDayUtil } from '../../utils/privacyRules';
import { useFollows } from './useFollows';
import { useAuth } from '../auth/useAuth';
import { fetchFriendsSubmissionsFromDB, fetchNicknames, fetchRankingsBySubmissionIds, type FriendsSortMode } from '../../lib/api';

// =============================================================================
// Types
// =============================================================================

export type SortMode = 'newest' | 'oldest' | 'ranked';

export interface FriendsSubmission extends SubmissionRenderData {
  id: string;
  user_id: string;
  nickname: string;
  avatar_url: string | null;
  groups: ShapeGroup[];
  created_at: string;
  final_rank?: number;
  like_count: number;
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

export function invalidateFriendsFeedCache(date?: string): void {
  if (date) {
    for (const key of friendsFeedCache.keys()) {
      if (key.startsWith(`friends-feed-${date}-`)) {
        friendsFeedCache.delete(key);
      }
    }
  } else {
    friendsFeedCache.clear();
  }
}

export function clearAllFriendsFeedCache(): void {
  friendsFeedCache.clear();
}

// =============================================================================
// Data Fetching
// =============================================================================

const INITIAL_LIMIT = 100;

async function fetchFriendsSubmissions(
  date: string,
  followingIds: string[],
  sortMode: SortMode
): Promise<FriendsSubmission[]> {
  const cacheKey = `friends-feed-${date}-${sortMode}`;

  if (friendsFeedCache.has(cacheKey)) {
    return friendsFeedCache.get(cacheKey)!;
  }

  if (pendingRequests.has(cacheKey)) {
    return pendingRequests.get(cacheKey)!;
  }

  if (followingIds.length === 0) {
    return [];
  }

  const dbSortMode: FriendsSortMode = sortMode === 'ranked' ? 'newest' : sortMode;

  const promise = (async (): Promise<FriendsSubmission[]> => {
    const submissions = await fetchFriendsSubmissionsFromDB(date, followingIds, INITIAL_LIMIT + 1, dbSortMode);

    if (!submissions || submissions.length === 0) {
      return [];
    }

    const userIds = [...new Set(submissions.map(s => s.user_id))];
    const nicknameMap = await fetchNicknames(userIds);

    const submissionIds = submissions.map(s => s.id);
    const rankMap = await fetchRankingsBySubmissionIds(submissionIds);

    const friendsSubmissions: FriendsSubmission[] = submissions.map(s => ({
      id: s.id,
      user_id: s.user_id,
      nickname: nicknameMap.get(s.user_id)?.nickname || 'Anonymous',
      avatar_url: nicknameMap.get(s.user_id)?.avatar_url ?? null,
      shapes: s.shapes as Shape[],
      groups: (s.groups as ShapeGroup[]) || [],
      background_color: s.background_color ?? undefined,
      created_at: s.created_at,
      final_rank: rankMap.get(s.id),
      like_count: s.like_count ?? 0,
    }));

    if (sortMode === 'ranked') {
      const withRank = friendsSubmissions.filter(s => s.final_rank !== undefined);
      withRank.sort((a, b) => (a.final_rank ?? 0) - (b.final_rank ?? 0));
      return withRank;
    }

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
  const [sortMode, setSortMode] = useState<SortMode>('newest');

  const [displayLimit, setDisplayLimit] = useState(INITIAL_LIMIT);

  const abortControllerRef = useRef<AbortController | null>(null);

  const followingIdsArray = useMemo(() => Array.from(followingIds), [followingIds]);
  const prevFollowingIdsRef = useRef<string[]>([]);

  const canViewCurrentDay = canViewCurrentDayUtil(date, today, hasSubmittedToday);
  const isRankedAvailable = !isDateWithinLastTwoDays(date);
  const adjacentDates = getAdjacentDates(date);

  // Invalidate cache when following list changes
  useEffect(() => {
    const prevIds = prevFollowingIdsRef.current;
    const currentIds = followingIdsArray;

    const hasChanged =
      prevIds.length !== currentIds.length ||
      prevIds.some((id, i) => currentIds[i] !== id);

    if (hasChanged && prevIds.length > 0) {
      invalidateFriendsFeedCache();
    }

    prevFollowingIdsRef.current = currentIds;
  }, [followingIdsArray]);

  const fetchData = useCallback(async () => {
    if (!user) {
      setSubmissions([]);
      setLoading(false);
      return;
    }

    if (!canViewCurrentDay) {
      setSubmissions([]);
      setLoading(false);
      return;
    }

    if (followingIdsArray.length === 0) {
      setSubmissions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();

    try {
      const data = await fetchFriendsSubmissions(date, followingIdsArray, sortMode);
      setSubmissions(data);
      setDisplayLimit(INITIAL_LIMIT);
    } catch (err) {
      console.error('Failed to fetch friends feed submissions:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [date, canViewCurrentDay, followingIdsArray, user, sortMode]);

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
