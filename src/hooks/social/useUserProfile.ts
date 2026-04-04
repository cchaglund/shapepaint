import { useState, useEffect, useCallback, useRef } from 'react';
import type { Shape, ShapeGroup } from '../../types';
import { fetchUserPublicProfile, fetchUserPublicSubmissions, fetchFollowCounts } from '../../lib/api';

// =============================================================================
// Types
// =============================================================================

export interface UserProfile {
  id: string;
  nickname: string;
  avatar_url: string | null;
  followingCount: number;
  followersCount: number;
}

export interface UserSubmission {
  id: string;
  challenge_date: string;
  shapes: Shape[];
  groups: ShapeGroup[];
  background_color_index: number | null;
  created_at: string;
  final_rank?: number;
}

export interface UseUserProfileOptions {
  userId: string;
}

export interface UseUserProfileReturn {
  profile: UserProfile | null;
  submissions: UserSubmission[];
  loading: boolean;
  error: string | null;
  notFound: boolean;
  refetch: () => Promise<void>;
}

// =============================================================================
// Module-level Cache (in-memory only)
// =============================================================================

interface CachedUserData {
  profile: UserProfile;
  submissions: UserSubmission[];
  fetchedAt: number;
}

const userCache = new Map<string, CachedUserData>();
const pendingRequests = new Map<string, Promise<CachedUserData | null>>();

// Cache duration: 5 minutes
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Invalidate user profile cache for a specific user.
 * Call this when follow/unfollow actions happen.
 */
export function invalidateUserProfileCache(userId: string): void {
  userCache.delete(userId);
}

/**
 * Clear entire user profile cache
 */
export function clearAllUserProfileCache(): void {
  userCache.clear();
}

// =============================================================================
// Data Fetching
// =============================================================================

async function fetchUserProfile(userId: string): Promise<CachedUserData | null> {
  // Check cache (with TTL)
  const cached = userCache.get(userId);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached;
  }

  // Check for pending request (request deduplication)
  if (pendingRequests.has(userId)) {
    return pendingRequests.get(userId)!;
  }

  // Create and track new request
  const promise = (async (): Promise<CachedUserData | null> => {
    const profileData = await fetchUserPublicProfile(userId);
    if (!profileData) {
      return null;
    }

    const [followCounts, submissionsData] = await Promise.all([
      fetchFollowCounts(userId),
      fetchUserPublicSubmissions(userId),
    ]);

    const profile: UserProfile = {
      id: profileData.id,
      nickname: profileData.nickname || 'Anonymous',
      avatar_url: profileData.avatar_url ?? null,
      followingCount: followCounts.following,
      followersCount: followCounts.followers,
    };

    const submissions: UserSubmission[] = (submissionsData || []).map(s => ({
      id: s.id,
      challenge_date: s.challenge_date,
      shapes: s.shapes as Shape[],
      groups: (s.groups as ShapeGroup[]) || [],
      background_color_index: s.background_color_index,
      created_at: s.created_at,
      final_rank: (s.daily_rankings as { final_rank: number | null }[] | null)?.[0]?.final_rank ?? undefined,
    }));

    return {
      profile,
      submissions,
      fetchedAt: Date.now(),
    };
  })();

  pendingRequests.set(userId, promise);

  try {
    const data = await promise;
    if (data) {
      userCache.set(userId, data);
    }
    return data;
  } finally {
    pendingRequests.delete(userId);
  }
}

// =============================================================================
// Hook
// =============================================================================

export function useUserProfile(options: UseUserProfileOptions): UseUserProfileReturn {
  const { userId } = options;

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [submissions, setSubmissions] = useState<UserSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async () => {
    if (!userId) {
      setProfile(null);
      setSubmissions([]);
      setNotFound(true);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setNotFound(false);

    // Cancel any in-flight request
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();

    try {
      const data = await fetchUserProfile(userId);

      if (!data) {
        setProfile(null);
        setSubmissions([]);
        setNotFound(true);
      } else {
        setProfile(data.profile);
        setSubmissions(data.submissions);
        setNotFound(false);
      }
    } catch (err) {
      console.error('Failed to fetch user profile:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setProfile(null);
      setSubmissions([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Fetch on mount and when userId changes
  useEffect(() => {
    fetchData();
    return () => {
      abortControllerRef.current?.abort();
    };
  }, [fetchData]);

  const refetch = useCallback(async () => {
    // Invalidate cache before refetching
    invalidateUserProfileCache(userId);
    await fetchData();
  }, [userId, fetchData]);

  return {
    profile,
    submissions,
    loading,
    error,
    notFound,
    refetch,
  };
}
