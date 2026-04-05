import { useEffect, useMemo, useState } from 'react';
import { useVoting } from '../../hooks/challenge/useVoting';
import { useDailyChallenge } from '../../hooks/challenge/useDailyChallenge';
import { fetchWallSubmissions } from '../../hooks/challenge/useWallOfTheDay';
import { getTodayDateUTC } from '../../utils/dailyChallenge';
import { Modal } from '../shared/Modal';
import { VotingPairView } from './VotingPairView';
import { VotingConfirmation } from './VotingConfirmation';
import { VotingOptInPrompt } from './VotingOptInPrompt';
import { ContinueVotingZone } from './ContinueVotingZone';

interface VotingModalProps {
  userId: string;
  challengeDate: string;
  onComplete: () => void;
  onSkipVoting: () => void;
  onOptInToRanking?: () => void;
}

export function VotingModal({
  userId,
  challengeDate,
  onComplete,
  onSkipVoting,
  onOptInToRanking,
}: VotingModalProps) {
  const [optInConfirmation, setOptInConfirmation] = useState<'entered' | 'skipped' | null>(null);

  const todayDate = useMemo(() => getTodayDateUTC(), []);
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

  useEffect(() => {
    initializeVoting().then(() => {
      fetchNextPair();
    });
    fetchWallSubmissions(todayDate);
  }, [initializeVoting, fetchNextPair, todayDate]);

  const showConfirmation = hasEnteredRanking;
  const handleClose = showConfirmation || optInConfirmation ? onComplete : onSkipVoting;

  const handleVote = async (winnerId: string) => {
    await vote(winnerId);
  };

  const handleOptIn = () => {
    onOptInToRanking?.();
    setOptInConfirmation('entered');
  };

  const handleOptInSkip = () => {
    setOptInConfirmation('skipped');
  };

  const renderContent = () => {
    if (optInConfirmation) {
      return (
        <VotingConfirmation
          isEntered={optInConfirmation === 'entered'}
          wallDate={todayDate}
          onDone={onComplete}
          userId={userId}
        />
      );
    }

    if ((noSubmissions || submissionCount === 0) && !loading) {
      return <VotingOptInPrompt onOptIn={handleOptIn} onSkip={handleOptInSkip} />;
    }

    if (showConfirmation) {
      // Only show continue voting zone if there are more pairs available
      const continueVoting = !noMorePairs && challenge ? (
        <ContinueVotingZone
          currentPair={currentPair}
          challenge={challenge}
          submitting={submitting}
          onVote={handleVote}
        />
      ) : null;

      return (
        <VotingConfirmation
          isEntered={true}
          wallDate={todayDate}
          onDone={onComplete}
          userId={userId}
        >
          {continueVoting}
        </VotingConfirmation>
      );
    }

    if (noMorePairs && !loading) {
      return (
        <VotingConfirmation
          isEntered={hasEnteredRanking}
          wallDate={todayDate}
          onDone={onComplete}
          userId={userId}
        />
      );
    }

    if (loading || !currentPair || !challenge) {
      return (
        <div className="bg-(--color-bg-primary) border border-(--color-border) rounded-(--radius-xl) p-6 w-full max-w-3xl mx-auto shadow-(--shadow-modal)">
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <div className="w-6 h-6 border-2 border-(--color-text-tertiary) border-t-(--color-accent) rounded-full animate-spin" />
            <div className="text-sm text-(--color-text-secondary)">Loading next pair…</div>
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
      size="max-w-[700px]"
      className="p-0! border-0! bg-transparent! rounded-none! shadow-none! overflow-visible!"
      ariaLabelledBy="voting-title"
      dataTestId="voting-modal"
    >
      {renderContent()}
    </Modal>
  );
}
