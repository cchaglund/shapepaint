import { useEffect, useRef, useCallback } from 'react';
import type { RankingEntry } from '../../types';
import { useDailyChallenge } from '../../hooks/challenge/useDailyChallenge';
import { WinnerCard } from '../submission/WinnerCard';
import { Modal } from '../shared/Modal';
import { Button } from '../shared/Button';
import { LoadingSpinner } from '../shared/LoadingSpinner';

const CONFETTI_DURATION_MS = 6_000;
const CONFETTI_INTERVAL_MS = 300;

interface CongratulatoryModalProps {
  userEntry: RankingEntry;
  challengeDate: string;
  onDismiss: () => void;
}

const HEADINGS: Record<number, string> = {
  1: 'You won!',
  2: '2nd Place!',
  3: '3rd Place!',
};

export function CongratulatoryModal({
  userEntry,
  challengeDate,
  onDismiss,
}: CongratulatoryModalProps) {
  const { challenge, loading: challengeLoading } = useDailyChallenge(challengeDate);

  // Confetti refs and dismiss handler
  const confettiInstance = useRef<{ reset: () => void } | null>(null);
  const stopConfetti = useCallback(() => {
    confettiInstance.current?.reset();
    confettiInstance.current = null;
  }, []);

  const handleDismiss = useCallback(() => {
    stopConfetti();
    onDismiss();
  }, [stopConfetti, onDismiss]);

  // Confetti: continuous bursts for 6s, skip if prefers-reduced-motion
  useEffect(() => {
    if (challengeLoading) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let interval: ReturnType<typeof setInterval>;
    let timeout: ReturnType<typeof setTimeout>;

    import('canvas-confetti').then(({ default: confetti }) => {
      const instance = confetti.create(undefined, { resize: true });
      confettiInstance.current = instance;

      const fireConfetti = () => {
        instance({
          particleCount: 30,
          spread: 70,
          origin: { x: Math.random(), y: Math.random() * 0.4 },
          zIndex: 100,
        });
      };

      fireConfetti();
      interval = setInterval(fireConfetti, CONFETTI_INTERVAL_MS);
      timeout = setTimeout(() => {
        clearInterval(interval);
      }, CONFETTI_DURATION_MS);
    });

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
      confettiInstance.current?.reset();
      confettiInstance.current = null;
    };
  }, [challengeLoading]);

  // Show loading state while challenge is being fetched
  if (challengeLoading || !challenge) {
    return (
      <Modal onClose={handleDismiss} closeOnBackdropClick={false} dataTestId="congratulatory-modal">
        <LoadingSpinner message="Loading..." inline />
      </Modal>
    );
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T12:00:00');
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
  };

  const heading = HEADINGS[userEntry.rank] ?? `#${userEntry.rank}`;
  const placeLabel = userEntry.rank === 1 ? 'won' : `placed ${userEntry.rank === 2 ? '2nd' : '3rd'}`;
  const subtext = `The community has voted and your submission for ${formatDate(challengeDate)} ${placeLabel}!`;

  return (
    <Modal onClose={handleDismiss} ariaLabelledBy="congrats-title" dataTestId="congratulatory-modal">
      <div className="text-center mb-5">
        <h2 id="congrats-title" className="text-xl font-semibold text-(--color-text-primary) mb-0.5">
          {heading}
        </h2>
        <p className="text-sm text-(--color-text-secondary)">{subtext}</p>
      </div>

      <div className="flex justify-center mb-5">
        <WinnerCard
          entry={userEntry}
          size="lg"
        />
      </div>

      <Button variant="primary" size="md" fullWidth onClick={handleDismiss}>
        Yay!
      </Button>
    </Modal>
  );
}
