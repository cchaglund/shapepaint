import { useState, useEffect } from 'react';
import { useDailyChallenge } from '../../hooks/challenge/useDailyChallenge';
import { fetchWallSubmissions, type WallSubmission } from '../../hooks/challenge/useWallOfTheDay';
import { Button } from '../shared/Button';
import { SubmissionThumbnail } from '../shared/SubmissionThumbnail';
import type { VotingConfirmationProps } from './types';

export function VotingConfirmation({
  isEntered,
  wallDate,
  canContinueVoting,
  onContinue,
  onDone,
  userId,
}: VotingConfirmationProps) {
  const wallUrl = `?view=wall-of-the-day&date=${wallDate}`;
  const { challenge } = useDailyChallenge(wallDate);
  const [previewSubmissions, setPreviewSubmissions] = useState<WallSubmission[]>([]);

  useEffect(() => {
    fetchWallSubmissions(wallDate).then((all) => {
      const others = all.filter((s) => s.user_id !== userId).slice(0, 6);
      setPreviewSubmissions(others);
    });
  }, [wallDate, userId]);

  return (
    <div className="bg-(--color-bg-primary) border border-(--color-border) rounded-(--radius-lg) p-6 w-full max-w-sm mx-auto text-center">
      {isEntered ? (
        <>
          <div className="text-3xl mb-3">🎉</div>
          <h2 id="voting-title" className="text-xl font-semibold text-(--color-text-primary) mb-1">
            Your art has been entered!
          </h2>
          <p className="text-sm text-(--color-text-secondary) mb-2">
            Tomorrow users will be able to vote on your artwork, with winners announced the following day.
          </p>
          <p className="text-sm text-(--color-text-secondary) mb-5">
            Thanks for participating!
          </p>
        </>
      ) : (
        <>
          <div className="w-12 h-12 rounded-(--radius-pill) bg-(--color-accent-subtle) flex items-center justify-center mx-auto mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h2 id="voting-title" className="text-xl font-semibold text-(--color-text-primary) mb-1">
            Artwork saved!
          </h2>
          <p className="text-sm text-(--color-text-secondary) mb-5">
            Your artwork has been saved to your gallery.
          </p>
        </>
      )}

      {challenge && previewSubmissions.length > 0 && (
        <div className="relative mb-4 overflow-hidden rounded-(--radius-sm)">
          <div className="grid grid-cols-3 gap-1.5">
            {previewSubmissions.map((s) => (
              <div key={s.id} className="aspect-square">
                <SubmissionThumbnail
                  shapes={s.shapes}
                  groups={s.groups}
                  challenge={challenge}
                  backgroundColorIndex={s.background_color_index}
                  fill
                />
              </div>
            ))}
          </div>
          <div
            className="absolute inset-x-0 bottom-0 h-2/5 pointer-events-none"
            style={{ background: 'linear-gradient(to bottom, transparent, var(--color-bg-primary))' }}
          />
        </div>
      )}

      <div className="flex flex-col items-center gap-2">
        {canContinueVoting && (
          <Button variant="secondary" size="md" onClick={onContinue}>
            Continue Voting
          </Button>
        )}
        <Button variant="primary" size="md" onClick={onDone}>
          Done
        </Button>
        <Button as="a" variant="secondary" size="md" href={wallUrl}>
          See what others submitted
        </Button>
      </div>
    </div>
  );
}
