import { useState, useCallback } from 'react';
import {
  countSubmissions,
  countOtherSubmissions,
  initializeDailyRankings,
  fetchVotingStatus,
  fetchNextVotingPair,
  fetchSubmissionPair,
  processVoteV2,
} from '../../lib/api';
import { calculateRequiredVotes } from '../../utils/votingRules';
import type { VotingPair, Shape } from '../../types';

interface SubmissionRow {
  id: string;
  user_id: string;
  shapes: Shape[];
  background_color: string | null;
}

interface UseVotingReturn {
  currentPair: VotingPair | null;
  loading: boolean;
  submitting: boolean;
  voteCount: number;
  requiredVotes: number;
  hasEnteredRanking: boolean;
  noMorePairs: boolean;
  noSubmissions: boolean; // 0 submissions - bootstrap case
  submissionCount: number;
  vote: (winnerId: string) => Promise<void>;
  skip: () => Promise<void>;
  fetchNextPair: () => Promise<void>;
  initializeVoting: () => Promise<void>;
}

export function useVoting(userId: string | undefined, challengeDate: string): UseVotingReturn {
  const [currentPair, setCurrentPair] = useState<VotingPair | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [voteCount, setVoteCount] = useState(0);
  const [requiredVotes, setRequiredVotes] = useState(5);
  const [hasEnteredRanking, setHasEnteredRanking] = useState(false);
  const [noMorePairs, setNoMorePairs] = useState(false);
  const [noSubmissions, setNoSubmissions] = useState(false);
  const [submissionCount, setSubmissionCount] = useState(0);

  // Initialize daily rankings for the challenge date if needed
  const initializeVoting = useCallback(async () => {
    if (!userId) return;

    setLoading(true);

    try {
      const totalSubmissions = await countSubmissions(challengeDate);
      setSubmissionCount(totalSubmissions);

      if (totalSubmissions === 0) {
        setNoSubmissions(true);
        setRequiredVotes(0);
        setLoading(false);
        return;
      }

      const otherSubmissions = await countOtherSubmissions(challengeDate, userId);

      if (otherSubmissions < 2) {
        setNoSubmissions(true);
        setRequiredVotes(0);
        setLoading(false);
        return;
      }

      const required = calculateRequiredVotes(otherSubmissions);
      setRequiredVotes(required);

      if (totalSubmissions >= 2) {
        await initializeDailyRankings(challengeDate);
      }

      const status = await fetchVotingStatus(userId, challengeDate);

      if (status) {
        setVoteCount(status.vote_count);
        setHasEnteredRanking(status.entered_ranking || status.vote_count >= required);
      }
    } catch (error) {
      console.error('Error initializing voting:', error);
    }

    setLoading(false);
  }, [userId, challengeDate]);

  // Fetch the next pair to vote on
  const fetchNextPair = useCallback(async () => {
    if (!userId || noSubmissions || submissionCount < 2) return;

    setLoading(true);

    try {
      const pairData = await fetchNextVotingPair(userId, challengeDate);

      if (!pairData || pairData.length === 0) {
        setNoMorePairs(true);
        setCurrentPair(null);
        setLoading(false);
        return;
      }

      const pair = pairData[0];
      const submissions = await fetchSubmissionPair(pair.submission_a_id, pair.submission_b_id);

      if (!submissions || submissions.length < 2) {
        setNoMorePairs(true);
        setCurrentPair(null);
        setLoading(false);
        return;
      }

      const subA = submissions.find((s) => s.id === pair.submission_a_id) as SubmissionRow | undefined;
      const subB = submissions.find((s) => s.id === pair.submission_b_id) as SubmissionRow | undefined;

      if (!subA || !subB) {
        setNoMorePairs(true);
        setCurrentPair(null);
        setLoading(false);
        return;
      }

      setCurrentPair({
        submissionA: {
          id: subA.id,
          user_id: subA.user_id,
          shapes: subA.shapes as Shape[],
          background_color: subA.background_color,
        },
        submissionB: {
          id: subB.id,
          user_id: subB.user_id,
          shapes: subB.shapes as Shape[],
          background_color: subB.background_color,
        },
      });
      setNoMorePairs(false);
    } catch (error) {
      console.error('Error fetching next pair:', error);
    }

    setLoading(false);
  }, [userId, challengeDate, noSubmissions, submissionCount]);

  // Process a vote or skip via single RPC call that returns the next pair
  const submitVote = useCallback(
    async (winnerId: string | null) => {
      if (!userId || !currentPair) return;

      setSubmitting(true);

      try {
        const result = await processVoteV2(
          currentPair.submissionA.id,
          currentPair.submissionB.id,
          winnerId
        );

        setVoteCount(result.voteCount);
        setRequiredVotes(result.requiredVotes);
        setHasEnteredRanking(result.enteredRanking || result.voteCount >= result.requiredVotes);

        if (result.nextPair) {
          setCurrentPair({
            submissionA: {
              id: result.nextPair.submissionA.id,
              user_id: result.nextPair.submissionA.user_id,
              shapes: result.nextPair.submissionA.shapes as Shape[],
              background_color: result.nextPair.submissionA.background_color,
            },
            submissionB: {
              id: result.nextPair.submissionB.id,
              user_id: result.nextPair.submissionB.user_id,
              shapes: result.nextPair.submissionB.shapes as Shape[],
              background_color: result.nextPair.submissionB.background_color,
            },
          });
          setNoMorePairs(false);
        } else {
          setCurrentPair(null);
          setNoMorePairs(true);
        }
      } catch (error) {
        console.error('Error submitting vote:', error);
      }

      setSubmitting(false);
    },
    [userId, currentPair]
  );

  const vote = useCallback(
    (winnerId: string) => submitVote(winnerId),
    [submitVote]
  );

  const skip = useCallback(
    () => submitVote(null),
    [submitVote]
  );

  return {
    currentPair,
    loading,
    submitting,
    voteCount,
    requiredVotes,
    hasEnteredRanking,
    noMorePairs,
    noSubmissions,
    submissionCount,
    vote,
    skip,
    fetchNextPair,
    initializeVoting,
  };
}
