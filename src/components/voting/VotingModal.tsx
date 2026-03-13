import { useEffect, useMemo, useState } from 'react';
import { useVoting } from '../../hooks/challenge/useVoting';
import { useDailyChallenge } from '../../hooks/challenge/useDailyChallenge';
import { fetchWallSubmissions } from '../../hooks/challenge/useWallOfTheDay';
import { getTodayDateUTC } from '../../utils/dailyChallenge';
import { Modal } from '../shared/Modal';
import { VotingPairView } from './VotingPairView';
import { VotingConfirmation } from './VotingConfirmation';
import { VotingOptInPrompt } from './VotingOptInPrompt';

interface VotingModalProps {
  userId: string;
  challengeDate: string; // The date to vote on (yesterday)
  onComplete: () => void;
  onSkipVoting: () => void;
  onOptInToRanking?: () => void; // Called when user opts in without voting (bootstrap case)
}

export function VotingModal({
  userId,
  challengeDate,
  onComplete,
  onSkipVoting,
  onOptInToRanking,
}: VotingModalProps) {
  // Track if user dismissed confirmation to continue voting
  const [dismissedConfirmation, setDismissedConfirmation] = useState(false);
  // Track confirmation state after opt-in prompt: 'entered' | 'skipped' | null
  const [optInConfirmation, setOptInConfirmation] = useState<'entered' | 'skipped' | null>(null);

  // Today's date for Wall URL
  const todayDate = useMemo(() => getTodayDateUTC(), []);

  // Fetch challenge for the date being voted on
  const { challenge } = useDailyChallenge(challengeDate);

  const {
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
    fetchNextPair,
    initializeVoting,
  } = useVoting(userId, challengeDate);

  // Initialize voting on mount + prefetch wall data for confirmation preview
  useEffect(() => {
    initializeVoting().then(() => {
      fetchNextPair();
    });
    fetchWallSubmissions(todayDate);
  }, [initializeVoting, fetchNextPair, todayDate]);

  // Derive showConfirmation from state instead of using an effect
  const showConfirmation = hasEnteredRanking && !dismissedConfirmation;

  // Close action depends on modal state: confirmation/opt-in screens → onComplete, voting → onSkipVoting
  const handleClose = showConfirmation || optInConfirmation ? onComplete : onSkipVoting;

  const handleVote = async (winnerId: string) => {
    await vote(winnerId);
  };

  const handleContinueVoting = () => {
    setDismissedConfirmation(true);
  };

  const handleOptIn = () => {
    // User opts in to ranking without voting (bootstrap case)
    onOptInToRanking?.();
    setOptInConfirmation('entered');
  };

  const handleOptInSkip = () => {
    // User skips ranking (bootstrap case)
    setOptInConfirmation('skipped');
  };

  // Determine content to render
  const renderContent = () => {
    // Show confirmation after opt-in prompt action
    if (optInConfirmation) {
      return (
        <VotingConfirmation
          isEntered={optInConfirmation === 'entered'}
          wallDate={todayDate}
          canContinueVoting={false}
          onContinue={() => {}} // Not used when canContinueVoting is false
          onDone={onComplete}
          userId={userId}
        />
      );
    }

    // Bootstrap case: No submissions yesterday
    if ((noSubmissions || submissionCount === 0) && !loading) {
      return <VotingOptInPrompt onOptIn={handleOptIn} onSkip={handleOptInSkip} />;
    }

    // Confirmation screen after reaching required votes
    if (showConfirmation) {
      return (
        <VotingConfirmation
          isEntered={true}
          wallDate={todayDate}
          canContinueVoting={!noMorePairs}
          onContinue={handleContinueVoting}
          onDone={onComplete}
          userId={userId}
        />
      );
    }

    // No more pairs to vote on - show confirmation with canContinueVoting=false
    if (noMorePairs && !loading) {
      return (
        <VotingConfirmation
          isEntered={hasEnteredRanking}
          wallDate={todayDate}
          canContinueVoting={false}
          onContinue={() => {}} // Not used when canContinueVoting is false
          onDone={onComplete}
          userId={userId}
        />
      );
    }

    // Main voting UI
    if (loading || !currentPair || !challenge) {
      return (
        <div className="bg-(--color-bg-primary) border border-(--color-border) rounded-(--radius-xl) p-6 w-full max-w-3xl mx-auto shadow-(--shadow-modal)">
          <div className="flex items-center justify-center h-64">
            <div className="text-(--color-text-secondary)">Loading...</div>
          </div>
        </div>
      );
    }

    return (
      <VotingPairView
        currentPair={currentPair}
        challenge={challenge}
        voteCount={voteCount}
        requiredVotes={requiredVotes}
        submitting={submitting}
        onVote={handleVote}
        onSkipVoting={onSkipVoting}
      />
    );
  };

  return (
    <Modal
      onClose={handleClose}
      size="max-w-3xl"
      className="p-0! border-0! bg-transparent! rounded-none! shadow-none! overflow-visible!"
      ariaLabelledBy="voting-title"
      dataTestId="voting-modal"
    >
      {renderContent()}
    </Modal>
  );
}
