import type { RankingEntry } from '../../types';
import { useDailyChallenge } from '../../hooks/challenge/useDailyChallenge';
import { WinnerCard } from '../submission/WinnerCard';
import { Modal } from '../shared/Modal';
import { Button } from '../shared/Button';
import { LoadingSpinner } from '../shared/LoadingSpinner';

interface WinnerAnnouncementModalProps {
  challengeDate: string;
  topThree: RankingEntry[];
  onDismiss: () => void;
}

export function WinnerAnnouncementModal({
  challengeDate,
  topThree,
  onDismiss,
}: WinnerAnnouncementModalProps) {
  const { challenge, loading: challengeLoading } = useDailyChallenge(challengeDate);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T12:00:00');
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
  };

  // Group entries by rank
  const winners = topThree.filter((e) => e.rank === 1);
  const runnerUps = topThree.filter((e) => e.rank === 2);
  const thirdPlaces = topThree.filter((e) => e.rank === 3);

  // Show loading state while challenge is being fetched
  if (challengeLoading || !challenge) {
    return (
      <Modal onClose={onDismiss} closeOnBackdropClick={false} dataTestId="winner-announcement-modal">
        <LoadingSpinner message="Loading..." inline />
      </Modal>
    );
  }

  return (
    <Modal onClose={onDismiss} size="max-w-140" ariaLabelledBy="winner-title" dataTestId="winner-announcement-modal">
      <div className="text-center mb-5">
        <h2 id="winner-title" className="text-xl font-semibold text-(--color-text-primary) mb-0.5">
          Winners of {formatDate(challengeDate)}
        </h2>
        <p className="text-sm text-(--color-text-secondary)">Word of the day was "{challenge.word}"</p>
        {winners.length > 1 && (
          <p className="text-xs text-(--color-text-tertiary) mt-0.5">
            {winners.length === 3 ? 'Three-way tie!' : winners.length === 2 ? 'Tie for 1st place!' : ''}
          </p>
        )}
      </div>

      {/* Winners (1st place) - show all tied winners */}
      {winners.length > 0 && (
        <div className={`flex justify-center ${winners.length > 1 ? 'gap-4' : ''} mb-5`}>
          {winners.map((winner) => (
            <WinnerCard
              key={winner.submission_id}
              entry={winner}
              challenge={challenge}

              size={winners.length > 2 ? 'sm' : 'lg'}
            />
          ))}
        </div>
      )}

      {/* 2nd and 3rd place - show if single winner, or show 3rd place for 2-way tie */}
      {(winners.length === 1 && (runnerUps.length > 0 || thirdPlaces.length > 0)) || (winners.length === 2 && thirdPlaces.length > 0) ? (
        <div className="flex justify-center gap-6 mb-5">
          {/* Only show 2nd place if there's a single winner (no tie for 1st) */}
          {winners.length === 1 && runnerUps.map((runnerUp) => (
            <WinnerCard
              key={runnerUp.submission_id}
              entry={runnerUp}
              challenge={challenge}

              size="sm"
            />
          ))}

          {thirdPlaces.map((thirdPlace) => (
            <WinnerCard
              key={thirdPlace.submission_id}
              entry={thirdPlace}
              challenge={challenge}

              size="sm"
            />
          ))}
        </div>
      ) : null}

      <Button variant="primary" size="md" fullWidth onClick={onDismiss}>
        Awesome!
      </Button>
    </Modal>
  );
}
