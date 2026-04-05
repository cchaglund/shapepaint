import { useState, useEffect } from 'react';
import { navigate } from '../lib/router';
import { Button } from '../components/shared/Button';
import { useRanking } from '../hooks/challenge/useRanking';
import { useDailyChallenge } from '../hooks/challenge/useDailyChallenge';
import { WinnerCard } from '../components/submission/WinnerCard';
import { getShapeSVGData } from '../utils/shapes';
import { RANKING_CONFIDENCE_TOOLTIP } from '../utils/votingRules';
import { TopBar } from '../components/canvas/TopBar';
import { ConfidencePill } from '../components/shared/ConfidencePill';
import { InfoTooltip } from '../components/shared/InfoTooltip';
import type { ThemeMode, ThemeName } from '../hooks/ui/useThemeState';

interface WinnersDayPageProps {
  date: string;
  themeMode: ThemeMode;
  onSetThemeMode: (mode: ThemeMode) => void;
  themeName: ThemeName;
  onSetThemeName: (name: ThemeName) => void;
}

export function WinnersDayPage({ date, themeMode, onSetThemeMode, themeName, onSetThemeName }: WinnersDayPageProps) {
  const { fetchTopThree, topThree, loading, getAdjacentRankingDates, rankingStats } = useRanking();
  const { challenge, loading: challengeLoading } = useDailyChallenge(date);
  const [adjacentDates, setAdjacentDates] = useState<{ prev: string | null; next: string | null }>({ prev: null, next: null });

  useEffect(() => {
    fetchTopThree(date);
    getAdjacentRankingDates(date).then(setAdjacentDates);
  }, [date, fetchTopThree, getAdjacentRankingDates]);

  const formattedDate = date
    ? new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'Loading...';


  // Group entries by rank
  const winners = topThree.filter((e) => e.rank === 1);
  const runnerUps = topThree.filter((e) => e.rank === 2);
  const thirdPlaces = topThree.filter((e) => e.rank === 3);

  if (loading || challengeLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-(--color-bg-primary)">
        <div className="text-(--color-text-secondary)">
          Loading rankings...
        </div>
      </div>
    );
  }

  if (!challenge) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-(--color-bg-primary)">
        <div className="text-(--color-text-secondary)">
          Challenge not found for {formattedDate}.
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-(--color-bg-primary)">
      <TopBar
        themeMode={themeMode}
        onSetThemeMode={onSetThemeMode}
        themeName={themeName}
        onSetThemeName={onSetThemeName}
        centerContent={
          <span className="text-lg font-semibold text-(--color-text-primary) font-display">Winners</span>
        }
        rightContent={
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              className="gap-1 disabled:opacity-30 disabled:cursor-not-allowed"
              onClick={() => adjacentDates.prev && navigate(`?view=winners-day&date=${adjacentDates.prev}`)}
              disabled={!adjacentDates.prev}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              <span className="hidden md:inline">Previous</span>
            </Button>
            <Button
              variant="ghost"
              className="gap-1 disabled:opacity-30 disabled:cursor-not-allowed"
              onClick={() => adjacentDates.next && navigate(`?view=winners-day&date=${adjacentDates.next}`)}
              disabled={!adjacentDates.next}
            >
              <span className="hidden md:inline">Next</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </Button>
            <Button as="a" variant="ghost" href="/?view=gallery&tab=winners" className="gap-1">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              <span className="hidden md:inline">Back to gallery</span>
            </Button>
          </div>
        }
      />
      <div className="flex-1 overflow-auto p-4 md:p-8 theme-pattern">
        <div className="max-w-5xl mx-auto">
          {/* Date heading */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold mb-2 text-(--color-text-primary) font-display">
              {formattedDate}
            </h1>
            <p className="text-(--color-text-secondary)">
              Daily Challenge Rankings
            </p>
          </div>

          {/* Main content */}
          <div className="flex flex-col md:flex-row gap-6 items-start justify-center">
            {/* Rankings */}
            <div className="flex-1 space-y-6">
              {topThree.length === 0 ? (
                <div className="text-center py-12 text-(--color-text-secondary)">
                  No rankings available for this day.
                </div>
              ) : (
                <>
                  {/* Winners (1st place) */}

                  {winners.length > 0 && (
                    <div className="text-center">
                      {winners.length > 1 && (
                        <h2 className="text-base font-medium mb-4 text-(--color-text-tertiary)">
                          Tie for 1st Place
                        </h2>
                      )}
                      <div className={`flex flex-wrap justify-center ${winners.length > 1 ? 'gap-4 md:gap-6' : ''}`}>
                        {winners.map((winner) => (
                          <WinnerCard
                            key={winner.submission_id}
                            entry={winner}
                            challenge={challenge}

                            size={winners.length > 2 ? 'sm' : winners.length > 1 ? 'md' : 'lg'}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 2nd and 3rd place */}
                  {(runnerUps.length > 0 || thirdPlaces.length > 0) && (
                    <div className="flex flex-wrap justify-center gap-4 md:gap-8">
                      {runnerUps.map((entry) => (
                        <WinnerCard
                          key={entry.submission_id}
                          entry={entry}
                          challenge={challenge}

                          size="sm"
                        />
                      ))}
                      {thirdPlaces.map((entry) => (
                        <WinnerCard
                          key={entry.submission_id}
                          entry={entry}
                          challenge={challenge}

                          size="sm"
                        />
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Challenge details sidebar */}
            <div className="w-full md:w-75 space-y-4">
              <div
                className="rounded-(--radius-xl) p-4 bg-(--color-bg-primary)"
                style={{
                  border: 'var(--border-width, 2px) solid var(--color-border)',
                  boxShadow: 'var(--shadow-card)',
                }}
              >
                <h2 className="text-base font-semibold mb-3 text-(--color-text-primary)">
                  Challenge Details
                </h2>

                {/* Daily Word */}
                <div className="mb-4">
                  <span className="text-xs text-(--color-text-tertiary)">
                    Inspiration
                  </span>
                  <p className="mt-1 text-sm font-medium italic text-(--color-text-primary) capitalize">
                    "{challenge.word}"
                  </p>
                </div>

                {/* Colors */}
                <div className="mb-4">
                  <span className="text-xs text-(--color-text-tertiary)">
                    Colors
                  </span>
                  <div className="flex gap-2 mt-1">
                    {challenge.colors.map((color, i) => (
                      <div
                        key={i}
                        className="w-8 h-8 rounded-(--radius-md) border border-(--color-border)"
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                  </div>
                </div>

                {/* Shapes */}
                <div>
                  <span className="text-xs text-(--color-text-tertiary)">
                    Shapes
                  </span>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {challenge.shapes.map((shapeData, i) => {
                      const { element, props, viewBox } = getShapeSVGData(shapeData.type, 32);
                      return (
                        <div
                          key={i}
                          className="rounded-(--radius-md) p-1 flex items-center justify-center bg-(--color-bg-tertiary)"
                          title={shapeData.name}
                        >
                          <svg width={40} height={40} viewBox={`0 0 ${viewBox.width} ${viewBox.height}`} preserveAspectRatio="xMidYMid meet">
                            {element === 'ellipse' && (
                              <ellipse {...props} fill="var(--color-text-primary)" />
                            )}
                            {element === 'rect' && (
                              <rect {...props} fill="var(--color-text-primary)" />
                            )}
                            {element === 'polygon' && (
                              <polygon {...props} fill="var(--color-text-primary)" />
                            )}
                            {element === 'path' && (
                              <path {...props} fill="var(--color-text-primary)" />
                            )}
                          </svg>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {rankingStats && (
                  <>
                    <hr className="border-t border-(--color-border-light,var(--color-border)) opacity-50 my-3" />
                    <div className="text-xs font-semibold uppercase tracking-wide text-(--color-text-tertiary) mb-2">
                      Ranking
                    </div>
                    <div className="flex flex-wrap gap-4 items-baseline">
                      <div>
                        <span className="text-xs text-(--color-text-tertiary) block">Submissions</span>
                        <span className="text-sm font-medium text-(--color-text-primary) mt-0.5 inline-block">{rankingStats.submissionCount}</span>
                      </div>
                      <div>
                        <span className="text-xs text-(--color-text-tertiary) block">Voters</span>
                        <span className="text-sm font-medium text-(--color-text-primary) mt-0.5 inline-block">{rankingStats.voterCount}</span>
                      </div>
                      <div>
                        <span className="text-xs text-(--color-text-tertiary) flex gap-1 items-center">
                          Confidence
                          <InfoTooltip text={RANKING_CONFIDENCE_TOOLTIP} />
                        </span>
                        <span className="mt-0.5 inline-block">
                          <ConfidencePill confidence={rankingStats.confidence} />
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
