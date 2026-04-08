import { supabase } from './supabase';
import type { Shape, ShapeGroup, RankingEntry } from '../types';

// =============================================================================
// Submissions
// =============================================================================

export interface SubmissionRow {
  id: string;
  user_id: string;
  challenge_date: string;
  shapes: Shape[];
  groups: ShapeGroup[];
  background_color_index: number | null;
  created_at: string;
  updated_at: string;
  like_count: number;
}

export async function fetchSubmission(userId: string, challengeDate: string): Promise<SubmissionRow | null> {
  const { data, error } = await supabase
    .from('submissions')
    .select('*')
    .eq('user_id', userId)
    .eq('challenge_date', challengeDate)
    .maybeSingle();
  if (error) throw error;
  return data as SubmissionRow | null;
}

export interface SubmissionWithJoins extends SubmissionRow {
  profiles: { nickname: string | null; avatar_url: string | null } | null;
  daily_rankings: { final_rank: number | null; challenge_date: string }[] | null;
}

export async function fetchSubmissionById(submissionId: string): Promise<SubmissionWithJoins | null> {
  const { data, error } = await supabase
    .from('submissions')
    .select('*, profiles!user_id(nickname, avatar_url), daily_rankings(final_rank, challenge_date)')
    .eq('id', submissionId)
    .maybeSingle();
  if (error) throw error;
  return data as SubmissionWithJoins | null;
}

export async function checkSubmissionExists(userId: string, challengeDate: string): Promise<boolean> {
  const { data } = await supabase
    .from('submissions')
    .select('id')
    .eq('user_id', userId)
    .eq('challenge_date', challengeDate)
    .maybeSingle();
  return !!data;
}

export async function upsertSubmission(params: {
  userId: string;
  challengeDate: string;
  shapes: Shape[];
  groups: ShapeGroup[];
  backgroundColorIndex: number | null;
}): Promise<void> {
  const { error } = await supabase.from('submissions').upsert(
    {
      user_id: params.userId,
      challenge_date: params.challengeDate,
      shapes: params.shapes,
      groups: params.groups,
      background_color_index: params.backgroundColorIndex,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,challenge_date' }
  );
  if (error) throw error;
}

export async function fetchUserSubmissions(userId: string): Promise<SubmissionRow[]> {
  const { data, error } = await supabase
    .from('submissions')
    .select('*')
    .eq('user_id', userId)
    .order('challenge_date', { ascending: false });
  if (error) throw error;
  return (data as SubmissionRow[]) ?? [];
}

export async function fetchUserSubmissionsByMonth(
  userId: string,
  monthStart: string,
  monthEnd: string
): Promise<SubmissionRow[]> {
  const { data, error } = await supabase
    .from('submissions')
    .select('*')
    .eq('user_id', userId)
    .gte('challenge_date', monthStart)
    .lte('challenge_date', monthEnd)
    .order('challenge_date', { ascending: false });
  if (error) throw error;
  return (data as SubmissionRow[]) ?? [];
}

export async function fetchAdjacentSubmissionDates(
  userId: string,
  currentDate: string
): Promise<{ prev: string | null; next: string | null }> {
  const [{ data: prevData }, { data: nextData }] = await Promise.all([
    supabase
      .from('submissions')
      .select('challenge_date')
      .eq('user_id', userId)
      .lt('challenge_date', currentDate)
      .order('challenge_date', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('submissions')
      .select('challenge_date')
      .eq('user_id', userId)
      .gt('challenge_date', currentDate)
      .order('challenge_date', { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);
  return {
    prev: prevData?.challenge_date ?? null,
    next: nextData?.challenge_date ?? null,
  };
}

export async function setIncludedInRanking(userId: string, challengeDate: string): Promise<void> {
  const { error } = await supabase
    .from('submissions')
    .update({ included_in_ranking: true })
    .eq('user_id', userId)
    .eq('challenge_date', challengeDate);
  if (error) throw error;
}

export async function countSubmissions(challengeDate: string): Promise<number> {
  const { count, error } = await supabase
    .from('submissions')
    .select('*', { count: 'exact', head: true })
    .eq('challenge_date', challengeDate);
  if (error) throw error;
  return count ?? 0;
}

export async function fetchVoterCount(challengeDate: string): Promise<number> {
  const { data, error } = await supabase
    .from('comparisons')
    .select('voter_id')
    .eq('challenge_date', challengeDate)
    .not('winner_id', 'is', null);
  if (error) throw error;
  return new Set(data?.map((r) => r.voter_id)).size;
}

export async function countOtherSubmissions(challengeDate: string, userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('submissions')
    .select('*', { count: 'exact', head: true })
    .eq('challenge_date', challengeDate)
    .neq('user_id', userId);
  if (error) throw error;
  return count ?? 0;
}

export async function fetchSubmissionCountsByDateRange(
  startDate: string,
  endDate: string
): Promise<Record<string, number>> {
  const { data, error } = await supabase.rpc('count_submissions_by_date', {
    p_start_date: startDate,
    p_end_date: endDate,
  });
  if (error) throw error;
  const counts: Record<string, number> = {};
  if (data) {
    for (const row of data as { challenge_date: string; submission_count: number }[]) {
      counts[row.challenge_date] = row.submission_count;
    }
  }
  return counts;
}

export async function fetchSubmissionPair(submissionAId: string, submissionBId: string) {
  const { data, error } = await supabase
    .from('submissions')
    .select('id, user_id, shapes, groups, background_color_index')
    .in('id', [submissionAId, submissionBId]);
  if (error) throw error;
  return data;
}

// =============================================================================
// Challenges (direct DB read — fast ~100ms via PostgREST)
// =============================================================================

export interface ChallengeRow {
  challenge_date: string;
  color_1: string;
  color_2: string;
  color_3: string | null;
  shape_1: string;
  shape_2: string;
  word: string;
}

export async function fetchChallengeRow(date: string): Promise<ChallengeRow | null> {
  const { data } = await supabase
    .from('challenges')
    .select('*')
    .eq('challenge_date', date)
    .single();
  return data as ChallengeRow | null;
}

export async function fetchLatestChallengeDate(): Promise<string | null> {
  const { data } = await supabase
    .from('challenges')
    .select('challenge_date')
    .order('challenge_date', { ascending: false })
    .limit(1)
    .single();
  return (data as { challenge_date: string } | null)?.challenge_date ?? null;
}

export async function fetchChallengeRows(dates: string[]): Promise<ChallengeRow[]> {
  if (dates.length === 0) return [];
  const { data } = await supabase
    .from('challenges')
    .select('*')
    .in('challenge_date', dates);
  return (data as ChallengeRow[]) || [];
}

export async function generateChallenge(date: string) {
  const { data, error } = await supabase.functions.invoke('get-daily-challenge', {
    body: { date },
  });
  if (error) throw new Error(error.message || 'Failed to generate challenge');
  return data;
}

// =============================================================================
// Wall of the Day
// =============================================================================

// Server-side cached wall query via get_wall_cached RPC (see wall_cache migration).
// The RPC returns fully enriched submissions (with nicknames + ranks) from a cache
// table. Past dates are cached forever; today's wall has a 30s TTL. This collapses
// N concurrent users into 1 actual DB join per cache interval.

export type WallCacheSortMode = 'newest' | 'oldest' | 'ranked' | 'likes';

export interface WallCachedSubmission {
  id: string;
  user_id: string;
  nickname: string;
  avatar_url: string | null;
  shapes: unknown;
  groups: unknown;
  background_color_index: number | null;
  created_at: string;
  final_rank: number | null;
  like_count: number;
}

export async function fetchWallCached(date: string, sortMode: WallCacheSortMode = 'newest', limit: number = 101): Promise<WallCachedSubmission[]> {
  const { data, error } = await supabase.rpc('get_wall_cached', {
    p_date: date,
    p_sort_mode: sortMode,
    p_limit: limit,
  });
  if (error) throw error;
  return (data as WallCachedSubmission[]) || [];
}

export type FriendsSortMode = 'newest' | 'oldest' | 'ranked';

export async function fetchFriendsSubmissionsFromDB(date: string, followingIds: string[], limit: number, sortMode: FriendsSortMode = 'newest') {
  let query = supabase
    .from('submissions')
    .select('id, user_id, shapes, groups, background_color_index, created_at, like_count')
    .eq('challenge_date', date)
    .eq('included_in_ranking', true)
    .in('user_id', followingIds);

  switch (sortMode) {
    case 'newest':
      query = query.order('created_at', { ascending: false });
      break;
    case 'oldest':
      query = query.order('created_at', { ascending: true });
      break;
    case 'ranked':
      break;
  }

  const { data, error } = await query.limit(limit);
  if (error) throw error;
  return data;
}

// =============================================================================
// Profiles
// =============================================================================

export async function fetchProfile(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data;
}

export async function updateProfileFields(userId: string, fields: Record<string, unknown>) {
  const { error } = await supabase
    .from('profiles')
    .update(fields)
    .eq('id', userId);
  if (error) throw error;
}

export interface ProfileSummary {
  nickname: string;
  avatar_url: string | null;
}

// Global nickname cache — nicknames rarely change, so we cache for the session.
// Only uncached userIds hit the DB; callers don't need to know about the cache.
const nicknameCache = new Map<string, ProfileSummary>();

export async function fetchNicknames(userIds: string[]): Promise<Map<string, ProfileSummary>> {
  if (userIds.length === 0) return new Map();

  const uncached = userIds.filter(id => !nicknameCache.has(id));

  if (uncached.length > 0) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, nickname, avatar_url')
      .in('id', uncached);
    if (error) throw error;
    if (data) {
      for (const p of data) {
        nicknameCache.set(p.id as string, {
          nickname: (p.nickname as string) || 'Anonymous',
          avatar_url: (p.avatar_url as string | null) ?? null,
        });
      }
    }
  }

  const result = new Map<string, ProfileSummary>();
  for (const id of userIds) {
    const cached = nicknameCache.get(id);
    if (cached) result.set(id, cached);
  }
  return result;
}

export function invalidateNicknameCache(userId?: string): void {
  if (userId) nicknameCache.delete(userId);
  else nicknameCache.clear();
}

export async function searchProfilesByNickname(query: string, excludeUserId?: string): Promise<{ id: string; nickname: string; avatar_url: string | null }[]> {
  let queryBuilder = supabase
    .from('profiles')
    .select('id, nickname, avatar_url')
    .ilike('nickname', `%${query}%`)
    .limit(20);

  if (excludeUserId) {
    queryBuilder = queryBuilder.neq('id', excludeUserId);
  }

  const { data, error } = await queryBuilder;
  if (error) throw error;
  return (data as { id: string; nickname: string; avatar_url: string | null }[]) || [];
}

export async function findProfileByNickname(nickname: string): Promise<{ id: string; nickname: string } | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, nickname')
    .ilike('nickname', nickname)
    .limit(1);
  if (error) throw error;
  return data?.[0] ?? null;
}

export async function fetchProfileNickname(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from('profiles')
    .select('nickname')
    .eq('id', userId)
    .single();
  return data?.nickname ?? null;
}

export async function checkIsAdmin(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', userId)
    .single();
  if (error) return false;
  return data?.is_admin ?? false;
}

// =============================================================================
// Voting
// =============================================================================

export async function initializeDailyRankings(challengeDate: string): Promise<void> {
  const { error } = await supabase.rpc('initialize_daily_rankings', {
    p_challenge_date: challengeDate,
  });
  if (error) console.error('Error initializing rankings:', error);
}

export async function fetchVotingStatus(userId: string, challengeDate: string) {
  const { data } = await supabase
    .from('user_voting_status')
    .select('*')
    .eq('user_id', userId)
    .eq('challenge_date', challengeDate)
    .maybeSingle();
  return data;
}

export async function fetchNextVotingPair(userId: string, challengeDate: string) {
  const { data, error } = await supabase.rpc('get_next_pair', {
    p_voter_id: userId,
    p_challenge_date: challengeDate,
  });
  if (error) throw error;
  return data;
}

export async function processVote(submissionAId: string, submissionBId: string, winnerId: string | null) {
  const response = await supabase.functions.invoke('process-vote', {
    body: { submissionAId, submissionBId, winnerId },
  });
  if (response.error) throw response.error;
  return response.data;
}

// =============================================================================
// Rankings
// =============================================================================

export async function computeFinalRanks(challengeDate: string): Promise<void> {
  const { error } = await supabase.rpc('compute_final_ranks', { p_challenge_date: challengeDate });
  if (error) {
    // Expected to fail sometimes (e.g., permissions or already computed)
  }
}

interface RankingRowWithSubmission {
  final_rank: number;
  submission_id: string;
  user_id: string;
  elo_score: number;
  vote_count: number;
  submissions: {
    shapes: Shape[];
    groups?: ShapeGroup[] | null;
    background_color_index: number | null;
  };
}

export async function fetchRankingsWithSubmissions(
  challengeDate: string,
  limit: number
): Promise<RankingEntry[]> {
  const { data, error } = await supabase
    .from('daily_rankings')
    .select(`
      final_rank, submission_id, user_id, elo_score, vote_count,
      submissions!inner (shapes, groups, background_color_index)
    `)
    .eq('challenge_date', challengeDate)
    .not('final_rank', 'is', null)
    .order('final_rank', { ascending: true })
    .limit(limit);

  if (error) throw error;
  if (!data || data.length === 0) return [];

  const userIds = [...new Set(data.map((r: { user_id: string }) => r.user_id))];
  const nicknameMap = await fetchNicknames(userIds);

  return (data as unknown as RankingRowWithSubmission[]).map((row) => ({
    rank: row.final_rank,
    submission_id: row.submission_id,
    user_id: row.user_id,
    nickname: nicknameMap.get(row.user_id)?.nickname || 'Anonymous',
    avatar_url: nicknameMap.get(row.user_id)?.avatar_url ?? null,
    elo_score: row.elo_score,
    vote_count: row.vote_count,
    shapes: row.submissions?.shapes || [],
    groups: row.submissions?.groups || [],
    background_color_index: row.submissions?.background_color_index ?? null,
  }));
}

export async function fetchRankingsCount(challengeDate: string): Promise<number> {
  const { count } = await supabase
    .from('daily_rankings')
    .select('*', { count: 'exact', head: true })
    .eq('challenge_date', challengeDate);
  return count ?? 0;
}

export async function fetchUserRank(challengeDate: string, userId: string): Promise<number | null> {
  const { data, error } = await supabase
    .from('daily_rankings')
    .select('final_rank')
    .eq('challenge_date', challengeDate)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data?.final_rank ?? null;
}

export async function fetchSubmissionRankInfo(submissionId: string): Promise<{ rank: number; total: number } | null> {
  const { data, error } = await supabase
    .from('daily_rankings')
    .select('final_rank, challenge_date')
    .eq('submission_id', submissionId)
    .maybeSingle();
  if (error) throw error;
  if (!data?.final_rank) return null;

  const { count } = await supabase
    .from('daily_rankings')
    .select('*', { count: 'exact', head: true })
    .eq('challenge_date', data.challenge_date);

  return { rank: data.final_rank, total: count ?? 0 };
}

export async function fetchRankTotal(challengeDate: string): Promise<number> {
  const { count } = await supabase
    .from('daily_rankings')
    .select('*', { count: 'exact', head: true })
    .eq('challenge_date', challengeDate);
  return count ?? 0;
}

// Rankings are immutable once set — cache forever for the session.
const rankingsCache = new Map<string, number>();
// Track IDs we've already queried that had no rank, so we don't re-query them.
const rankingsQueriedNoResult = new Set<string>();

export async function fetchRankingsBySubmissionIds(submissionIds: string[]): Promise<Map<string, number>> {
  if (submissionIds.length === 0) return new Map();

  const uncached = submissionIds.filter(id => !rankingsCache.has(id) && !rankingsQueriedNoResult.has(id));

  if (uncached.length > 0) {
    const { data, error } = await supabase
      .from('daily_rankings')
      .select('submission_id, final_rank')
      .in('submission_id', uncached)
      .not('final_rank', 'is', null);

    if (error) {
      console.error('Failed to fetch rankings:', error);
    } else {
      const returnedIds = new Set<string>();
      if (data) {
        for (const r of data) {
          rankingsCache.set(r.submission_id, r.final_rank as number);
          returnedIds.add(r.submission_id);
        }
      }
      // Mark IDs that had no rank so we don't re-query them
      for (const id of uncached) {
        if (!returnedIds.has(id)) rankingsQueriedNoResult.add(id);
      }
    }
  }

  const result = new Map<string, number>();
  for (const id of submissionIds) {
    const rank = rankingsCache.get(id);
    if (rank !== undefined) result.set(id, rank);
  }
  return result;
}

export async function fetchMonthlyWinners(
  startDate: string,
  endDate: string
): Promise<Array<{
  challenge_date: string;
  submission_id: string;
  user_id: string;
  nickname: string;
  avatar_url: string | null;
  final_rank: number;
  shapes: Shape[];
  groups: ShapeGroup[];
  background_color_index: number | null;
}>> {
  const { data: rankingsData, error } = await supabase
    .from('daily_rankings')
    .select(`
      challenge_date,
      submission_id,
      user_id,
      final_rank,
      submissions!inner (
        shapes,
        groups,
        background_color_index
      )
    `)
    .eq('final_rank', 1)
    .gte('challenge_date', startDate)
    .lte('challenge_date', endDate)
    .order('challenge_date', { ascending: true });

  if (error) {
    console.error('Error loading winners:', error);
    return [];
  }

  if (!rankingsData || rankingsData.length === 0) return [];

  interface WinnerRankingRow {
    challenge_date: string;
    submission_id: string;
    user_id: string;
    final_rank: number;
    submissions: { shapes: Shape[]; groups: ShapeGroup[] | null; background_color_index: number | null };
  }

  const userIds = [...new Set(rankingsData.map((r: { user_id: string }) => r.user_id))];
  const nicknameMap = await fetchNicknames(userIds);

  return (rankingsData as unknown as WinnerRankingRow[]).map((row) => ({
    challenge_date: row.challenge_date,
    submission_id: row.submission_id,
    user_id: row.user_id,
    nickname: nicknameMap.get(row.user_id)?.nickname || 'Anonymous',
    avatar_url: nicknameMap.get(row.user_id)?.avatar_url ?? null,
    final_rank: row.final_rank,
    shapes: row.submissions?.shapes || [],
    groups: row.submissions?.groups || [],
    background_color_index: row.submissions?.background_color_index ?? null,
  }));
}

export async function fetchAdjacentRankingDates(
  currentDate: string
): Promise<{ prev: string | null; next: string | null }> {
  const [{ data: prevData }, { data: nextData }] = await Promise.all([
    supabase
      .from('daily_rankings')
      .select('challenge_date')
      .lt('challenge_date', currentDate)
      .not('final_rank', 'is', null)
      .order('challenge_date', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('daily_rankings')
      .select('challenge_date')
      .gt('challenge_date', currentDate)
      .not('final_rank', 'is', null)
      .order('challenge_date', { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);
  return {
    prev: prevData?.challenge_date ?? null,
    next: nextData?.challenge_date ?? null,
  };
}

// =============================================================================
// Likes
// =============================================================================

export async function checkLikeExists(userId: string, submissionId: string): Promise<boolean> {
  const { data } = await supabase
    .from('likes')
    .select('id')
    .eq('user_id', userId)
    .eq('submission_id', submissionId)
    .maybeSingle();
  return !!data;
}

export async function checkLikesExistBatch(userId: string, submissionIds: string[]): Promise<Set<string>> {
  if (!submissionIds.length) return new Set();
  const { data } = await supabase
    .from('likes')
    .select('submission_id')
    .eq('user_id', userId)
    .in('submission_id', submissionIds);
  return new Set((data ?? []).map(r => r.submission_id));
}

export async function insertLike(userId: string, submissionId: string): Promise<void> {
  const { error } = await supabase
    .from('likes')
    .insert({ user_id: userId, submission_id: submissionId });
  if (error) throw error;
}

export async function deleteLike(userId: string, submissionId: string): Promise<void> {
  const { error } = await supabase
    .from('likes')
    .delete()
    .eq('user_id', userId)
    .eq('submission_id', submissionId);
  if (error) throw error;
}

export interface Liker {
  id: string;
  nickname: string;
  avatar_url: string | null;
}

export async function fetchSubmissionLikers(submissionId: string): Promise<Liker[]> {
  const { data, error } = await supabase
    .from('likes')
    .select('user_id, created_at, profiles!user_id(nickname, avatar_url)')
    .eq('submission_id', submissionId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row) => {
    const profile = row.profiles as unknown as { nickname: string; avatar_url: string | null } | null;
    return {
      id: row.user_id,
      nickname: profile?.nickname ?? 'Anonymous',
      avatar_url: profile?.avatar_url ?? null,
    };
  });
}

// =============================================================================
// Follows
// =============================================================================

export async function fetchFollowing(userId: string) {
  const { data, error } = await supabase
    .from('follows')
    .select('following_id, created_at')
    .eq('follower_id', userId);
  if (error) throw error;
  return data ?? [];
}

export async function fetchFollowers(userId: string) {
  const { data, error } = await supabase
    .from('follows')
    .select('follower_id, created_at')
    .eq('following_id', userId);
  if (error) throw error;
  return data ?? [];
}

export async function insertFollow(followerId: string, followingId: string): Promise<void> {
  const { error } = await supabase
    .from('follows')
    .insert({ follower_id: followerId, following_id: followingId });
  if (error) throw error;
}

export async function deleteFollow(followerId: string, followingId: string): Promise<void> {
  const { error } = await supabase
    .from('follows')
    .delete()
    .eq('follower_id', followerId)
    .eq('following_id', followingId);
  if (error) throw error;
}

export async function fetchFollowCounts(userId: string): Promise<{ following: number; followers: number }> {
  const [followingResult, followersResult] = await Promise.all([
    supabase
      .from('follows')
      .select('id', { count: 'exact', head: true })
      .eq('follower_id', userId),
    supabase
      .from('follows')
      .select('id', { count: 'exact', head: true })
      .eq('following_id', userId),
  ]);
  return {
    following: followingResult.count ?? 0,
    followers: followersResult.count ?? 0,
  };
}

// =============================================================================
// Winner Announcement / Voting Status
// =============================================================================

export async function fetchSeenWinnerAnnouncement(userId: string, challengeDate: string): Promise<boolean> {
  const { data } = await supabase
    .from('user_voting_status')
    .select('seen_winner_announcement')
    .eq('user_id', userId)
    .eq('challenge_date', challengeDate)
    .maybeSingle();
  return !!data?.seen_winner_announcement;
}

export async function markWinnerAnnouncementSeen(userId: string, challengeDate: string): Promise<void> {
  await supabase.from('user_voting_status').upsert(
    { user_id: userId, challenge_date: challengeDate, seen_winner_announcement: true },
    { onConflict: 'user_id,challenge_date' }
  );
}

// =============================================================================
// Keyboard Settings
// =============================================================================

export async function fetchKeyboardSettings(userId: string) {
  const { data, error } = await supabase
    .from('keyboard_settings')
    .select('mappings')
    .eq('user_id', userId)
    .single();
  return { data, error };
}

export async function upsertKeyboardSettings(userId: string, mappings: Record<string, unknown>): Promise<void> {
  const { error } = await supabase
    .from('keyboard_settings')
    .upsert(
      { user_id: userId, mappings, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    );
  if (error) throw error;
}

export async function insertKeyboardSettings(userId: string, mappings: Record<string, unknown>): Promise<void> {
  const { error } = await supabase
    .from('keyboard_settings')
    .insert({ user_id: userId, mappings });
  if (error) throw error;
}

// =============================================================================
// Admin
// =============================================================================


export async function fetchDashboardStats() {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) throw new Error('No access token available');

  const { data, error } = await supabase.functions.invoke('dashboard-stats', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (error) throw error;
  return data;
}

// =============================================================================
// Friends Feed Calendar
// =============================================================================

export async function countFriendsSubmissionsByDate(userId: string, startDate: string, endDate: string) {
  const { data, error } = await supabase.rpc('count_friends_submissions_by_date', {
    p_user_id: userId,
    p_start_date: startDate,
    p_end_date: endDate,
  });
  return { data, error };
}

export async function fetchFriendsSubmissionsByDateRange(
  followingIds: string[],
  startDate: string,
  endDate: string
) {
  const { data } = await supabase
    .from('submissions')
    .select('challenge_date, user_id')
    .in('user_id', followingIds)
    .gte('challenge_date', startDate)
    .lte('challenge_date', endDate)
    .eq('included_in_ranking', true);
  return data;
}

// =============================================================================
// User Profile (public view)
// =============================================================================

export async function fetchUserPublicProfile(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, nickname, avatar_url')
    .eq('id', userId)
    .single();
  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data;
}

export async function fetchUserPublicSubmissions(userId: string) {
  const { data, error } = await supabase
    .from('submissions')
    .select(`
      id, challenge_date, shapes, groups, background_color_index, created_at,
      daily_rankings!daily_rankings_submission_id_fkey(final_rank)
    `)
    .eq('user_id', userId)
    .eq('included_in_ranking', true)
    .order('challenge_date', { ascending: false });
  if (error) throw error;
  return data;
}
