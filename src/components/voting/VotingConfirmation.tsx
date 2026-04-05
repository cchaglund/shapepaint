import { useState, useEffect } from 'react';
import { Check } from 'lucide-react';
import { useDailyChallenge } from '../../hooks/challenge/useDailyChallenge';
import { fetchWallSubmissions, type WallSubmission } from '../../hooks/challenge/useWallOfTheDay';
import { Button } from '../shared/Button';
import { SubmissionThumbnail } from '../shared/SubmissionThumbnail';
import type { VotingConfirmationProps } from './types';

function wallGridCols(count: number): string {
  if (count <= 1) return 'grid-cols-1 max-w-[72px]';
  if (count === 2) return 'grid-cols-2 max-w-[148px]';
  return 'grid-cols-3 max-w-[220px]';
}

export function VotingConfirmation({
  isEntered,
  wallDate,
  onDone,
  userId,
  children,
}: VotingConfirmationProps) {
  const wallUrl = `?view=gallery&tab=wall&date=${wallDate}`;
  const { challenge } = useDailyChallenge(wallDate);
  const [previewSubmissions, setPreviewSubmissions] = useState<WallSubmission[]>([]);

  useEffect(() => {
    fetchWallSubmissions(wallDate).then((all) => {
      const others = all.filter((s) => s.user_id !== userId).slice(0, 6);
      setPreviewSubmissions(others);
    });
  }, [wallDate, userId]);

  return (
    <div className="bg-(--color-bg-primary) border border-(--color-border) rounded-(--radius-lg) shadow-(--shadow-modal) p-6 w-full max-w-md mx-auto text-center">
      {isEntered ? (
        <>
          <div className="text-3xl mb-3">🎉</div>
          <h2 id="voting-title" className="text-xl font-semibold text-(--color-text-primary) mb-1">
            Your art has been entered!
          </h2>
          <p className="text-sm text-(--color-text-secondary)">
            Tomorrow users will be able to vote on your artwork, with winners announced the following day.
          </p>
        </>
      ) : (
        <>
          <div className="w-12 h-12 rounded-(--radius-pill) bg-(--color-accent-subtle) flex items-center justify-center mx-auto mb-4">
            <Check size={24} color="var(--color-accent)" />
          </div>
          <h2 id="voting-title" className="text-xl font-semibold text-(--color-text-primary) mb-1">
            Artwork saved!
          </h2>
          <p className="text-sm text-(--color-text-secondary)">
            Your artwork has been saved to your gallery.
          </p>
        </>
      )}

      {/* Continue voting zone (optional, passed as children) */}
      {children && <div className="mt-5">{children}</div>}

      {/* Wall preview */}
      {challenge && previewSubmissions.length > 0 && (
        <div className="mt-5 text-center">
          <Button as="a" variant="link" href={wallUrl}>
            See what others submitted:
          </Button>
          <div className={`grid gap-1.5 mx-auto mt-2 ${wallGridCols(previewSubmissions.length)}`}>
            {previewSubmissions.map((s) => (
              <div key={s.id} className="aspect-square rounded-(--radius-sm) overflow-hidden">
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
        </div>
      )}

      {/* Done button at the bottom */}
      <div className="mt-4">
        <Button variant="primary" fullWidth size="md" onClick={onDone}>
          Done
        </Button>
      </div>
    </div>
  );
}
