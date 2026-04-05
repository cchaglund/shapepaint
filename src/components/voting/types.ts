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

export interface VotingPairComparisonProps {
  currentPair: VotingPair;
  challenge: DailyChallenge;
  submitting: boolean;
  onVote: (winnerId: string) => void;
  /** Smaller thumbnails for inline/secondary contexts (e.g. continue voting) */
  compact?: boolean;
  /** Use secondary (outlined) vote buttons instead of primary */
  secondaryButtons?: boolean;
}

export interface VotingConfirmationProps {
  isEntered: boolean;
  wallDate: string;
  onDone: () => void;
  userId: string;
  /** Content rendered between the Done button and the wall preview (e.g. continue voting) */
  children?: React.ReactNode;
}

export interface VotingOptInPromptProps {
  onOptIn: () => void;
  onSkip: () => void;
}
