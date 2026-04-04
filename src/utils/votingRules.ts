/**
 * Voting eligibility rules and constants
 *
 * These pure functions define the business logic for voting eligibility.
 */

export const MIN_SUBMISSIONS_FOR_RANKING = 5;
export const DEFAULT_REQUIRED_VOTES = 5;

/**
 * Calculate the number of unique pairs possible from N submissions
 * Formula: n * (n-1) / 2
 */
export function calculateTotalPairs(submissionCount: number): number {
  if (submissionCount < 2) return 0;
  return (submissionCount * (submissionCount - 1)) / 2;
}

/**
 * Calculate how many votes are required to enter ranking
 * - If there are enough submissions (5+), require 5 votes
 * - If there are fewer submissions, require voting on all available pairs
 * - If there are 0 submissions, no voting needed (just confirmation)
 */
export function calculateRequiredVotes(submissionCount: number): number {
  if (submissionCount === 0) return 0;
  const totalPairs = calculateTotalPairs(submissionCount);
  return Math.min(DEFAULT_REQUIRED_VOTES, totalPairs);
}

/**
 * Check if there are enough submissions for a proper ranking (5+)
 */
export function hasEnoughSubmissionsForRanking(submissionCount: number): boolean {
  return submissionCount >= MIN_SUBMISSIONS_FOR_RANKING;
}

/**
 * Check if there are enough submissions to enable voting (need at least 2 for pairs)
 */
export function hasEnoughSubmissions(submissionCount: number): boolean {
  return submissionCount >= 2;
}

/**
 * Check if user has voted enough to enter the ranking
 * Uses dynamic threshold based on available submissions
 */
export function hasEnteredRanking(voteCount: number, requiredVotes: number = DEFAULT_REQUIRED_VOTES): boolean {
  return voteCount >= requiredVotes;
}

/**
 * Check if a user can vote on a specific submission
 * (can't vote on their own submission)
 */
export function canVoteOnSubmission(
  submissionUserId: string,
  currentUserId: string
): boolean {
  return submissionUserId !== currentUserId;
}

/**
 * Check if a pair of submissions is valid for voting
 * (must be two different submissions, neither owned by voter)
 */
export function isValidVotingPair(
  submissionAUserId: string,
  submissionBUserId: string,
  currentUserId: string
): boolean {
  // Can't vote on your own submissions
  if (submissionAUserId === currentUserId || submissionBUserId === currentUserId) {
    return false;
  }
  // Submissions must be from different users (implicit from DB design)
  return true;
}

/**
 * Calculate how many more votes needed to enter ranking
 */
export function votesRemainingToEnterRanking(voteCount: number, requiredVotes: number = DEFAULT_REQUIRED_VOTES): number {
  return Math.max(0, requiredVotes - voteCount);
}

/**
 * Calculate vote progress as a percentage (capped at 100%)
 */
export function voteProgressPercentage(voteCount: number, requiredVotes: number = DEFAULT_REQUIRED_VOTES): number {
  if (requiredVotes === 0) return 100;
  return Math.min(100, (voteCount / requiredVotes) * 100);
}

/**
 * Determine voting state based on current conditions
 */
export type VotingState =
  | 'not_enough_submissions' // Less than 5 submissions exist
  | 'can_vote' // Normal voting state
  | 'entered_ranking' // User has voted 5+ times
  | 'no_more_pairs'; // All available pairs have been voted on

/**
 * Ranking confidence based on voter-to-submission ratio.
 * With 5 required pairs per voter, you need roughly as many voters
 * as submissions for reliable ELO convergence.
 */
export type RankingConfidence = 'high' | 'medium' | 'low';

export function calculateRankingConfidence(voterCount: number, submissionCount: number): RankingConfidence {
  if (submissionCount === 0 || voterCount === 0) return 'low';
  const ratio = voterCount / submissionCount;
  if (ratio >= 1) return 'high';
  if (ratio >= 0.5) return 'medium';
  return 'low';
}

export const RANKING_CONFIDENCE_LABELS: Record<RankingConfidence, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

export const RANKING_CONFIDENCE_TOOLTIP =
  'Ranking confidence reflects how reliable the rankings are based on voter turnout. More voters relative to submissions means more accurate rankings. Low confidence means results may not reflect true community preference.';

export function determineVotingState(options: {
  submissionCount: number;
  voteCount: number;
  hasMorePairs: boolean;
}): VotingState {
  const { submissionCount, voteCount, hasMorePairs } = options;

  if (!hasEnoughSubmissions(submissionCount)) {
    return 'not_enough_submissions';
  }

  if (!hasMorePairs) {
    return 'no_more_pairs';
  }

  if (hasEnteredRanking(voteCount)) {
    return 'entered_ranking';
  }

  return 'can_vote';
}
