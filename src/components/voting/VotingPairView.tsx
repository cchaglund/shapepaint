import { Button } from '../shared/Button';
import { InfoTooltip } from '../shared/InfoTooltip';
import { SubmissionThumbnail } from '../shared/SubmissionThumbnail';
import { useIsDesktop } from '../../hooks/ui/useBreakpoint';
import type { VotingPairViewProps } from './types';

export function VotingPairView({
  currentPair,
  challenge,
  voteCount,
  requiredVotes,
  submitting,
  onVote,
  onSkipVoting,
}: VotingPairViewProps) {
  const isDesktop = useIsDesktop();
  const thumbnailSize = isDesktop ? 260 : undefined; // undefined = full width
  const remaining = Math.max(0, requiredVotes - voteCount);
  const percentage = requiredVotes > 0 ? Math.min((voteCount / requiredVotes) * 100, 100) : 100;

  return (
    <div className="bg-(--color-bg-primary) border border-(--color-border) rounded-(--radius-lg) shadow-(--shadow-modal) w-full max-w-3xl overflow-hidden">
      {/* Voting section */}
      <div className="p-4 md:p-6">
        <h2 id="voting-title" className="text-2xl md:text-3xl font-semibold text-(--color-text-primary) text-center flex items-center justify-center gap-1.5 mb-2">
          Vote on yesterday's submissions
          <InfoTooltip text="By voting you submit your artwork for the competition and it will be visible for others to vote on tomorrow. Winners are announced the following day." />
        </h2>
        <p className="text-sm text-(--color-text-secondary) text-center mb-6">
          Word of the day was "<span className="font-medium">{challenge.word}</span>"
        </p>

        {/* Side by side comparison (stacks vertically on mobile) */}
        <div className="flex flex-col md:flex-row justify-center items-center gap-4 mb-6">
          <button
            onClick={() => onVote(currentPair.submissionA.id)}
            disabled={submitting}
            className="cursor-pointer group relative border border-(--color-border) rounded-(--radius-lg) overflow-hidden hover:border-(--color-accent) transition-all focus:outline-none focus:ring-2 focus:ring-(--color-accent) focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed w-full md:w-auto"
          >
            <SubmissionThumbnail
              shapes={currentPair.submissionA.shapes}
              groups={currentPair.submissionA.groups}
              challenge={challenge}
              backgroundColorIndex={currentPair.submissionA.background_color_index}
              size={thumbnailSize}
            />
            <div className="absolute inset-0 flex items-center justify-center bg-(--color-accent)/85 text-(--color-accent-text) text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
              Choose this one
            </div>
          </button>

          <button
            onClick={() => onVote(currentPair.submissionB.id)}
            disabled={submitting}
            className="cursor-pointer group relative border border-(--color-border) rounded-(--radius-lg) overflow-hidden hover:border-(--color-accent) transition-all focus:outline-none focus:ring-2 focus:ring-(--color-accent) focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed w-full md:w-auto"
          >
            <SubmissionThumbnail
              shapes={currentPair.submissionB.shapes}
              groups={currentPair.submissionB.groups}
              challenge={challenge}
              backgroundColorIndex={currentPair.submissionB.background_color_index}
              size={thumbnailSize}
            />
            <div className="absolute inset-0 flex items-center justify-center bg-(--color-accent)/85 text-(--color-accent-text) text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
              Choose this one
            </div>
          </button>
        </div>

        {/* Vote progress */}
        <p className="text-sm text-center text-(--color-text-secondary) mb-3">
          {remaining > 0
            ? `${remaining} more vote${remaining !== 1 ? 's' : ''} to enter competition`
            : 'Entered in competition!'}
        </p>
        <div className="w-full h-2 bg-(--color-border-light) rounded-(--radius-pill) overflow-hidden mb-1.5">
          <div
            className="h-full bg-(--color-accent) transition-all duration-300"
            style={{ width: `${percentage}%` }}
          />
        </div>
        <div className="text-right text-xs text-(--color-text-tertiary) tabular-nums">
          {voteCount} of {requiredVotes} votes
        </div>
      </div>

      {/* Footer banner */}
      <div className="px-4 py-4 md:px-6 md:py-5 border-t border-(--color-border-light) bg-(--color-bg-tertiary)">
        <h3 className="text-center text-xl font-semibold text-(--color-text-primary) mb-2">
          Your art has been saved!
        </h3>
        <p className="text-sm text-(--color-text-secondary) text-center max-w-md mx-auto mb-4">
          Compete for the leaderboard by voting on others' submissions. Vote to participate, or skip if you prefer not to enter today.
        </p>
        <div className="flex justify-center">
          <Button variant="danger" onClick={onSkipVoting}>
            Skip participation
          </Button>
        </div>
      </div>
    </div>
  );
}
