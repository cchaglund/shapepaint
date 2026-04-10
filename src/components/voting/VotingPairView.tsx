import { useState, useEffect, useCallback } from 'react';
import { Button } from '../shared/Button';
import { InfoTooltip } from '../shared/InfoTooltip';
import { SubmissionThumbnail } from '../shared/SubmissionThumbnail';
import { useIsDesktop } from '../../hooks/ui/useBreakpoint';
import type { VotingPairViewProps, VotingPairComparisonProps } from './types';
import type { VotingPair } from '../../types';

/** Expand icon shown on thumbnail hover */
function ExpandIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 3h5M3 3v5M3 3l5 5M17 17h-5M17 17v-5M17 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Full-size lightbox overlay for previewing a submission */
function SubmissionLightbox({
  submission,
  onClose,
}: {
  submission: VotingPair['submissionA'];
  onClose: () => void;
}) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 cursor-pointer"
      onClick={onClose}
    >
      <div
        className="w-[min(85vw,85vh)] max-w-[720px] rounded-(--radius-lg) overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <SubmissionThumbnail
          shapes={submission.shapes}
          groups={submission.groups}
          backgroundColor={submission.background_color}
          fill
        />
      </div>
    </div>
  );
}

/** Just the two thumbnails + vote buttons + lightbox. Reused in VotingPairView and continue-voting. */
export function VotingPairComparison({
  currentPair,
  submitting,
  onVote,
  compact,
  secondaryButtons,
}: VotingPairComparisonProps) {
  const isDesktop = useIsDesktop();
  const [previewSubmission, setPreviewSubmission] = useState<'A' | 'B' | null>(null);
  const thumbnailSize = compact ? (isDesktop ? 160 : undefined) : (isDesktop ? 288 : undefined);
  const closeLightbox = useCallback(() => setPreviewSubmission(null), []);
  const buttonVariant = secondaryButtons ? 'secondary' : 'primary';

  return (
    <>
      <div className={`relative ${compact ? 'py-2' : 'py-2 md:py-3'}`}>
        <div className={`flex flex-col md:flex-row justify-center items-stretch ${compact ? 'gap-3 mb-2' : 'gap-4 mb-3'} transition-opacity ${submitting ? 'opacity-40' : ''}`}>
          {/* Submission A */}
          <div className="flex flex-col items-center gap-3 w-full md:w-auto">
            <button
              onClick={() => setPreviewSubmission('A')}
              disabled={submitting}
              className="cursor-pointer group relative border border-(--color-border) rounded-(--radius-lg) overflow-hidden hover:border-(--color-accent) transition-all focus:outline-none focus:ring-2 focus:ring-(--color-accent) focus:ring-offset-2 disabled:cursor-not-allowed w-full md:w-auto"
              aria-label="Preview submission A full size"
            >
              <SubmissionThumbnail
                shapes={currentPair.submissionA.shapes}
                groups={currentPair.submissionA.groups}
                backgroundColor={currentPair.submissionA.background_color}
                size={thumbnailSize}
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                <div className="flex items-center gap-1.5 text-sm font-medium bg-black/50 px-3 py-1.5 rounded-(--radius-pill)">
                  <ExpandIcon />
                  View full size
                </div>
              </div>
            </button>
            <Button
              variant={buttonVariant}
              size="md"
              onClick={() => onVote(currentPair.submissionA.id)}
              disabled={submitting}
            >
              Vote for this one
            </Button>
          </div>

          {/* Submission B */}
          <div className="flex flex-col items-center gap-3 w-full md:w-auto">
            <button
              onClick={() => setPreviewSubmission('B')}
              disabled={submitting}
              className="cursor-pointer group relative border border-(--color-border) rounded-(--radius-lg) overflow-hidden hover:border-(--color-accent) transition-all focus:outline-none focus:ring-2 focus:ring-(--color-accent) focus:ring-offset-2 disabled:cursor-not-allowed w-full md:w-auto"
              aria-label="Preview submission B full size"
            >
              <SubmissionThumbnail
                shapes={currentPair.submissionB.shapes}
                groups={currentPair.submissionB.groups}
                backgroundColor={currentPair.submissionB.background_color}
                size={thumbnailSize}
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                <div className="flex items-center gap-1.5 text-sm font-medium bg-black/50 px-3 py-1.5 rounded-(--radius-pill)">
                  <ExpandIcon />
                  View full size
                </div>
              </div>
            </button>
            <Button
              variant={buttonVariant}
              size="md"
              onClick={() => onVote(currentPair.submissionB.id)}
              disabled={submitting}
            >
              Vote for this one
            </Button>
          </div>
        </div>

        {submitting && (
          <div className="absolute inset-0 flex items-center justify-center mb-6">
            <div className="flex flex-col items-center gap-3 px-6 py-4 rounded-(--radius-lg) bg-(--color-bg-primary)/90 shadow-(--shadow-card) border border-(--color-border)">
              <div className="w-5 h-5 border-2 border-(--color-border) border-t-(--color-accent) rounded-full animate-spin" />
              <span className="text-sm font-medium text-(--color-text-primary)">Loading next pair…</span>
            </div>
          </div>
        )}
      </div>

      {/* Lightbox preview */}
      {previewSubmission && (
        <SubmissionLightbox
          submission={previewSubmission === 'A' ? currentPair.submissionA : currentPair.submissionB}
          onClose={closeLightbox}
        />
      )}
    </>
  );
}

export function VotingPairView({
  currentPair,
  challenge,
  voteCount,
  requiredVotes,
  submitting,
  onVote,
  onSkipVoting,
}: VotingPairViewProps) {
  const [showSkipConfirm, setShowSkipConfirm] = useState(false);
  const remaining = Math.max(0, requiredVotes - voteCount);
  const percentage = requiredVotes > 0 ? Math.min((voteCount / requiredVotes) * 100, 100) : 100;

  return (
    <div className="bg-(--color-bg-primary) border border-(--color-border) rounded-(--radius-lg) shadow-(--shadow-modal) w-full max-w-[700px] overflow-hidden">
      {/* Voting section */}
      <div className="p-4 md:p-5">
        <h2 id="voting-title" className="text-2xl md:text-3xl font-semibold text-(--color-text-primary) text-center flex items-center justify-center gap-1.5 mb-1.5">
          Vote on yesterday's submissions
          <InfoTooltip text="By voting you submit your artwork for the competition and it will be visible for others to vote on tomorrow. Winners are announced the following day." />
        </h2>
        <p className="text-sm text-(--color-text-secondary) text-center mb-4">
          Word of the day was "<span className="font-medium">{challenge.word}</span>"
        </p>

        <VotingPairComparison
          currentPair={currentPair}
          submitting={submitting}
          onVote={onVote}
        />

        {/* Vote progress */}
        <div className="mt-1 mb-3 flex flex-col items-center">
          <div className="w-full max-w-md">
            <p className="text-sm text-center text-(--color-text-secondary) mb-3">
              {remaining > 0
                ? `${remaining} more vote${remaining !== 1 ? 's' : ''} to enter competition`
                : 'Entered in competition!'}
            </p>
            <div className="w-full h-2 bg-(--color-text-tertiary)/30 rounded-(--radius-pill) overflow-hidden mb-1.5">
              <div
                className="h-full bg-(--color-accent) transition-all duration-300"
                style={{ width: `${percentage}%` }}
              />
            </div>
            <div className="text-right text-xs text-(--color-text-tertiary) tabular-nums">
              {voteCount} of {requiredVotes} votes
            </div>
          </div>
        </div>
      </div>

      {/* Footer — de-emphasized opt-out section */}
      <div className="px-4 py-4 md:px-6 md:py-5 border-t border-(--color-border) bg-(--color-bg-tertiary)">
        <h3 className="text-center text-base font-semibold text-(--color-text-secondary) mb-1">
          Your art has been saved!
        </h3>
        <p className="text-xs text-(--color-text-tertiary) text-center max-w-sm mx-auto mb-3">
          Vote to compete for the leaderboard, or skip if you prefer not to enter today.
        </p>
        <div className="flex flex-col items-center gap-2">
          {showSkipConfirm ? (
            <>
              <p className="text-xs font-medium text-(--color-text-secondary) mb-1">
                Skip voting? Your artwork won't be entered into today's competition.
              </p>
              <div className="flex gap-3">
                <Button variant="secondary" onClick={() => setShowSkipConfirm(false)}>
                  Keep voting
                </Button>
                <Button variant="danger" onClick={onSkipVoting}>
                  Skip
                </Button>
              </div>
            </>
          ) : (
            <Button variant="ghost" onClick={() => setShowSkipConfirm(true)}>
              Skip participation
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
