/* eslint-disable react-refresh/only-export-components -- Context exported for useFollows hook */
import { createContext, useState, useEffect, useCallback, useMemo, useRef, type ReactNode } from 'react';
import { useAuth } from '../hooks/auth/useAuth';
import {
  fetchFollowing,
  fetchFollowers,
  fetchNicknames,
  insertFollow,
  deleteFollow,
  fetchProfileNickname,
} from '../lib/api';

export interface FollowUser {
  id: string;
  nickname: string;
  avatar_url: string | null;
  followedAt: string;
}

export interface FollowsContextValue {
  // Data
  following: FollowUser[];
  followers: FollowUser[];
  followingIds: Set<string>;
  followingCount: number;
  followersCount: number;

  // Methods
  isFollowing: (userId: string) => boolean;
  follow: (userId: string) => Promise<{ success: boolean; error?: string }>;
  unfollow: (userId: string) => Promise<{ success: boolean; error?: string }>;
  refetch: () => Promise<void>;

  // State
  loading: boolean;
  actionLoading: boolean;
}

export const FollowsContext = createContext<FollowsContextValue | null>(null);

interface FollowsProviderProps {
  children: ReactNode;
}

export function FollowsProvider({ children }: FollowsProviderProps) {
  const { user } = useAuth();
  const [following, setFollowing] = useState<FollowUser[]>([]);
  const [followers, setFollowers] = useState<FollowUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Dedup: track which user ID we've already fetched for
  const fetchedForRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // O(1) lookup set for isFollowing checks
  const followingIds = useMemo(() => new Set(following.map(f => f.id)), [following]);

  const followingCount = following.length;
  const followersCount = followers.length;

  const isFollowing = useCallback((userId: string) => followingIds.has(userId), [followingIds]);

  // Fetch following and followers lists
  const fetchFollowData = useCallback(async (forceRefresh = false) => {
    if (!user) {
      setFollowing([]);
      setFollowers([]);
      fetchedForRef.current = null;
      return;
    }

    // Skip if already fetched for this user (prevents StrictMode + auth-change duplicates)
    if (!forceRefresh && fetchedForRef.current === user.id) return;
    fetchedForRef.current = user.id;

    // Cancel any in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    try {
      const followingData = await fetchFollowing(user.id);
      if (controller.signal.aborted) return;

      const followersData = await fetchFollowers(user.id);
      if (controller.signal.aborted) return;

      const followingUserIds = followingData.map(f => f.following_id);
      const followersUserIds = followersData.map(f => f.follower_id);
      const allUserIds = [...new Set([...followingUserIds, ...followersUserIds])];

      const nicknameMap = await fetchNicknames(allUserIds);
      if (controller.signal.aborted) return;

      const followingList: FollowUser[] = followingData.map(f => {
        const profile = nicknameMap.get(f.following_id);
        return {
          id: f.following_id,
          nickname: profile?.nickname || 'Anonymous',
          avatar_url: profile?.avatar_url ?? null,
          followedAt: f.created_at,
        };
      });

      const followersList: FollowUser[] = followersData.map(f => {
        const profile = nicknameMap.get(f.follower_id);
        return {
          id: f.follower_id,
          nickname: profile?.nickname || 'Anonymous',
          avatar_url: profile?.avatar_url ?? null,
          followedAt: f.created_at,
        };
      });

      if (!controller.signal.aborted) {
        setFollowing(followingList);
        setFollowers(followersList);
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        console.error('Error fetching follow data:', error);
        fetchedForRef.current = null; // Allow retry on error
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, [user]);

  // Fetch on mount and when user changes
  useEffect(() => {
    fetchFollowData();
    return () => {
      abortRef.current?.abort();
      fetchedForRef.current = null;
    };
  }, [fetchFollowData]);

  // Follow a user with optimistic update
  const follow = useCallback(async (userId: string): Promise<{ success: boolean; error?: string }> => {
    if (!user) {
      return { success: false, error: 'Must be logged in to follow users' };
    }

    if (userId === user.id) {
      return { success: false, error: 'Cannot follow yourself' };
    }

    if (followingIds.has(userId)) {
      return { success: false, error: 'Already following this user' };
    }

    // Enforce 500-user follow limit
    if (followingIds.size >= 500) {
      return { success: false, error: 'You can follow a maximum of 500 users' };
    }

    setActionLoading(true);

    // Optimistic update: add to following list immediately
    const optimisticUser: FollowUser = {
      id: userId,
      nickname: 'Loading...',
      avatar_url: null,
      followedAt: new Date().toISOString(),
    };
    const previousFollowing = following;
    setFollowing(prev => [...prev, optimisticUser]);

    try {
      await insertFollow(user.id, userId);

      const nickname = await fetchProfileNickname(userId);

      setFollowing(prev =>
        prev.map(f => f.id === userId
          ? { ...f, nickname: nickname || 'Anonymous' }
          : f
        )
      );

      return { success: true };
    } catch (error) {
      // Rollback on error
      setFollowing(previousFollowing);
      console.error('Error following user:', error);
      return { success: false, error: 'Failed to follow user' };
    } finally {
      setActionLoading(false);
    }
  }, [user, followingIds, following]);

  // Unfollow a user with optimistic update
  const unfollow = useCallback(async (userId: string): Promise<{ success: boolean; error?: string }> => {
    if (!user) {
      return { success: false, error: 'Must be logged in to unfollow users' };
    }

    if (!followingIds.has(userId)) {
      return { success: false, error: 'Not following this user' };
    }

    setActionLoading(true);

    // Optimistic update: remove from following list immediately
    const previousFollowing = following;
    setFollowing(prev => prev.filter(f => f.id !== userId));

    try {
      await deleteFollow(user.id, userId);

      return { success: true };
    } catch (error) {
      // Rollback on error
      setFollowing(previousFollowing);
      console.error('Error unfollowing user:', error);
      return { success: false, error: 'Failed to unfollow user' };
    } finally {
      setActionLoading(false);
    }
  }, [user, followingIds, following]);

  const value: FollowsContextValue = {
    following,
    followers,
    followingIds,
    followingCount,
    followersCount,
    isFollowing,
    follow,
    unfollow,
    refetch: useCallback(() => fetchFollowData(true), [fetchFollowData]),
    loading,
    actionLoading,
  };

  return (
    <FollowsContext.Provider value={value}>
      {children}
    </FollowsContext.Provider>
  );
}
