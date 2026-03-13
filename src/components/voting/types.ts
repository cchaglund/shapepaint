import type { VotingPair, DailyChallenge } from '../../types';

export interface VotingProgressProps {
  voteCount: number;
  requiredVotes: number;
}

export interface VotingPairViewProps {
  currentPair: VotingPair;
  challenge: DailyChallenge;
  voteCount: number;
  requiredVotes: number;
  submitting: boolean;
  onVote: (winnerId: string) => void;
  onSkipVoting: () => void;
}

export interface VotingConfirmationProps {
  isEntered: boolean;
  wallDate: string;
  canContinueVoting: boolean;
  onContinue: () => void;
  onDone: () => void;
  userId: string;
}

export interface VotingOptInPromptProps {
  onOptIn: () => void;
  onSkip: () => void;
}
