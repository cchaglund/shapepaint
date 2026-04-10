import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { VotingPairComparison } from './VotingPairView';
import type { VotingPair, DailyChallenge } from '../../types';

interface ContinueVotingZoneProps {
  currentPair: VotingPair | null;
  challenge: DailyChallenge;
  submitting: boolean;
  onVote: (winnerId: string) => void;
}

export function ContinueVotingZone({
  currentPair,
  challenge,
  submitting,
  onVote,
}: ContinueVotingZoneProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="rounded-(--radius-md) text-center"
      style={{
        background: 'var(--color-selected)',
        border: 'var(--border-width) solid var(--color-border-light)',
        padding: '0.75rem',
      }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        className="flex items-center justify-center gap-1.5 w-full cursor-pointer bg-transparent border-none text-(--color-text-secondary) text-sm font-semibold hover:text-(--color-text-primary) transition-colors"
      >
        Continue voting (optional)
        <ChevronDown
          size={14}
          className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="mt-2">
              <p className="text-xs text-(--color-text-tertiary) mb-1">
                Word of the day was "<span className="font-semibold text-(--color-text-secondary)">{challenge.word}</span>"
              </p>
              {currentPair ? (
                <VotingPairComparison
                  currentPair={currentPair}
                  submitting={submitting}
                  onVote={onVote}
                  compact
                  secondaryButtons
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-32 gap-3">
                  <div className="w-6 h-6 border-2 border-(--color-text-tertiary) border-t-(--color-accent) rounded-full animate-spin" />
                  <div className="text-sm text-(--color-text-secondary)">Loading next pair…</div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
