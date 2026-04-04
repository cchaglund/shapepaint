import { useState, useCallback } from 'react';
import type { RankingEntry } from '../../types';
import {
  computeFinalRanks,
  fetchRankingsWithSubmissions,
  fetchRankingsCount,
  fetchUserRank as apiFetchUserRank,
  fetchSubmissionRankInfo,
  fetchAdjacentRankingDates,
  countSubmissions,
  fetchVoterCount,
} from '../../lib/api';
import { calculateRankingConfidence, type RankingConfidence } from '../../utils/votingRules';

interface RankingStats {
  submissionCount: number;
  voterCount: number;
  confidence: RankingConfidence;
}

interface UseRankingReturn {
  topThree: RankingEntry[];
  rankings: RankingEntry[];
  totalSubmissions: number;
  rankingStats: RankingStats | null;
  userRank: number | null;
  loading: boolean;
  fetchTopThree: (date: string) => Promise<void>;
  fetchRankings: (date: string) => Promise<void>;
  fetchUserRank: (date: string, userId: string) => Promise<number | null>;
  fetchSubmissionRank: (submissionId: string) => Promise<{ rank: number; total: number } | null>;
  getAdjacentRankingDates: (currentDate: string) => Promise<{ prev: string | null; next: string | null }>;
}

export function useRanking(): UseRankingReturn {
  const [topThree, setTopThree] = useState<RankingEntry[]>([]);
  const [rankings, setRankings] = useState<RankingEntry[]>([]);
  const [totalSubmissions, setTotalSubmissions] = useState(0);
  const [rankingStats, setRankingStats] = useState<RankingStats | null>(null);
  const [userRank, setUserRank] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchTopThree = useCallback(async (date: string) => {
    setLoading(true);

    try {
      try {
        await computeFinalRanks(date);
      } catch {
        // RPC may fail if user doesn't have permission or ranks already computed — expected
      }

      const [entries, submissions, voters] = await Promise.all([
        fetchRankingsWithSubmissions(date, 3),
        countSubmissions(date),
        fetchVoterCount(date),
      ]);
      setTopThree(entries);
      setRankingStats({
        submissionCount: submissions,
        voterCount: voters,
        confidence: calculateRankingConfidence(voters, submissions),
      });
    } catch (error) {
      console.error('Error fetching top three:', error);
    }

    setLoading(false);
  }, []);

  const fetchRankings = useCallback(async (date: string) => {
    setLoading(true);

    try {
      const count = await fetchRankingsCount(date);
      setTotalSubmissions(count);

      const entries = await fetchRankingsWithSubmissions(date, 50);
      setRankings(entries);
    } catch (error) {
      console.error('Error fetching rankings:', error);
    }

    setLoading(false);
  }, []);

  const fetchUserRank = useCallback(async (date: string, userId: string): Promise<number | null> => {
    try {
      const rank = await apiFetchUserRank(date, userId);
      setUserRank(rank);
      return rank;
    } catch (error) {
      console.error('Error fetching user rank:', error);
      return null;
    }
  }, []);

  const fetchSubmissionRank = useCallback(
    async (submissionId: string): Promise<{ rank: number; total: number } | null> => {
      try {
        return await fetchSubmissionRankInfo(submissionId);
      } catch (error) {
        console.error('Error fetching submission rank:', error);
        return null;
      }
    },
    []
  );

  const getAdjacentRankingDates = useCallback(
    async (
      currentDate: string
    ): Promise<{ prev: string | null; next: string | null }> => {
      try {
        return await fetchAdjacentRankingDates(currentDate);
      } catch (error) {
        console.error('Error fetching adjacent ranking dates:', error);
        return { prev: null, next: null };
      }
    },
    []
  );

  return {
    topThree,
    rankings,
    totalSubmissions,
    rankingStats,
    userRank,
    loading,
    fetchTopThree,
    fetchRankings,
    fetchUserRank,
    fetchSubmissionRank,
    getAdjacentRankingDates,
  };
}
