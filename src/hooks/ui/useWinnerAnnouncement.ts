import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  fetchSeenWinnerAnnouncement,
  countSubmissions,
  computeFinalRanks,
  fetchRankingsWithSubmissions,
  markWinnerAnnouncementSeen,
  fetchVoterCount,
} from '../../lib/api';
import { getTwoDaysAgoDateUTC } from '../../utils/dailyChallenge';
import { calculateRankingConfidence, type RankingConfidence } from '../../utils/votingRules';
import type { RankingEntry } from '../../types';

interface RankingStats {
  submissionCount: number;
  voterCount: number;
  confidence: RankingConfidence;
}

interface UseWinnerAnnouncementReturn {
  shouldShow: boolean;
  topThree: RankingEntry[];
  challengeDate: string;
  loading: boolean;
  userPlacement: RankingEntry | null;
  rankingStats: RankingStats | null;
  dismiss: () => Promise<void>;
  persistSeen: () => Promise<void>;
  checkAnnouncement: () => Promise<void>;
}

export function useWinnerAnnouncement(userId: string | undefined): UseWinnerAnnouncementReturn {
  const [shouldShow, setShouldShow] = useState(false);
  const [topThree, setTopThree] = useState<RankingEntry[]>([]);
  const [rankingStats, setRankingStats] = useState<RankingStats | null>(null);
  const [loading, setLoading] = useState(true);

  const challengeDate = getTwoDaysAgoDateUTC();

  const checkAnnouncement = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const alreadySeen = await fetchSeenWinnerAnnouncement(userId, challengeDate);
      if (alreadySeen) {
        setShouldShow(false);
        setLoading(false);
        return;
      }

      const total = await countSubmissions(challengeDate);
      if (total < 2) {
        setShouldShow(false);
        setLoading(false);
        return;
      }

      await computeFinalRanks(challengeDate);

      const [entries, voters] = await Promise.all([
        fetchRankingsWithSubmissions(challengeDate, 3),
        fetchVoterCount(challengeDate),
      ]);
      if (entries.length === 0) {
        setShouldShow(false);
        setLoading(false);
        return;
      }

      setTopThree(entries);
      setRankingStats({
        submissionCount: total,
        voterCount: voters,
        confidence: calculateRankingConfidence(voters, total),
      });
      setShouldShow(true);
    } catch (error) {
      console.error('Error checking winner announcement:', error);
      setShouldShow(false);
    }

    setLoading(false);
  }, [userId, challengeDate]);

  const userPlacement = useMemo(() => {
    if (!userId) return null;
    return topThree.find((entry) => entry.user_id === userId) ?? null;
  }, [userId, topThree]);

  const persistSeen = useCallback(async () => {
    if (!userId) return;

    try {
      await markWinnerAnnouncementSeen(userId, challengeDate);
    } catch (error) {
      console.error('Error persisting seen status:', error);
    }
  }, [userId, challengeDate]);

  const dismiss = useCallback(async () => {
    if (!userId) return;

    setShouldShow(false);

    try {
      await markWinnerAnnouncementSeen(userId, challengeDate);
    } catch (error) {
      console.error('Error dismissing announcement:', error);
    }
  }, [userId, challengeDate]);

  // Check on mount
  useEffect(() => {
    checkAnnouncement();
  }, [checkAnnouncement]);

  return {
    shouldShow,
    topThree,
    challengeDate,
    loading,
    userPlacement,
    rankingStats,
    dismiss,
    persistSeen,
    checkAnnouncement,
  };
}
