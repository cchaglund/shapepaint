/**
 * Voting Test Page
 *
 * Visual test page for voting components with mock data.
 * Access via ?test=voting in the URL.
 *
 * Uses the actual production components with mock data to ensure
 * tests verify real component behavior.
 */

import { useState, useMemo } from 'react';
import { getTodayDateUTC } from '../utils/dailyChallenge';

import {
  VotingPairView,
  VotingConfirmation,
  VotingOptInPrompt,
  VotingProgress,
  ContinueVotingZone,
} from '../components/voting';
import {
  MOCK_CHALLENGE,
  MOCK_VOTING_PAIRS,
  MOCK_TOP_THREE,
  MOCK_TIED_TOP_THREE,
  MOCK_THREE_WAY_TIE,
} from './mockData';
import { calculateRequiredVotes, calculateTotalPairs } from '../utils/votingRules';
import type { RankingEntry } from '../types';
import { WinnerAnnouncementModal } from '../components/modals/WinnerAnnouncementModal';
import { CongratulatoryModal } from '../components/modals/CongratulatoryModal';
import { BackToCanvasLink } from '../components/shared/BackToCanvasLink';

type TestScenario =
  | 'voting-ui'
  | 'voting-flow'
  | 'voting-progress'
  | 'voting-dynamic-threshold'
  | 'voting-confirmation'
  | 'voting-no-pairs'
  | 'voting-bootstrap-zero'
  | 'voting-bootstrap-one'
  | 'winner-normal'
  | 'winner-tied'
  | 'winner-three-way'
  | 'congrats-1st'
  | 'congrats-2nd'
  | 'congrats-3rd';

interface ScenarioConfig {
  name: string;
  description: string;
}

const SCENARIOS: Record<TestScenario, ScenarioConfig> = {
  'voting-ui': {
    name: 'Voting UI',
    description: 'Main voting interface with a pair of submissions',
  },
  'voting-flow': {
    name: 'Interactive Flow',
    description: 'Simulate full voting flow with confirmation modal',
  },
  'voting-progress': {
    name: 'Voting Progress',
    description: 'Vote progress states (0-5 votes)',
  },
  'voting-dynamic-threshold': {
    name: 'Dynamic Threshold',
    description: 'Vote requirements based on available submissions (2-4 subs)',
  },
  'voting-confirmation': {
    name: 'Voting Confirmation',
    description: 'Confirmation screen after reaching vote requirement',
  },
  'voting-no-pairs': {
    name: 'No More Pairs',
    description: 'When all pairs have been voted on',
  },
  'voting-bootstrap-zero': {
    name: 'Bootstrap (0 subs)',
    description: 'Day 1: No submissions exist yet - opt-in prompt',
  },
  'voting-bootstrap-one': {
    name: 'Bootstrap (1 sub)',
    description: 'Only 1 submission exists - no pairs possible',
  },
  'winner-normal': {
    name: 'Winner - Normal',
    description: 'Standard winner announcement with top 3',
  },
  'winner-tied': {
    name: 'Winner - Tied',
    description: 'Winner announcement with 1st place tie',
  },
  'winner-three-way': {
    name: 'Winner - Three-Way Tie',
    description: 'Winner announcement with three-way tie',
  },
  'congrats-1st': {
    name: 'Congrats - 1st',
    description: 'Congratulatory modal for 1st place winner',
  },
  'congrats-2nd': {
    name: 'Congrats - 2nd',
    description: 'Congratulatory modal for 2nd place',
  },
  'congrats-3rd': {
    name: 'Congrats - 3rd',
    description: 'Congratulatory modal for 3rd place',
  },
};

export function VotingTestPage() {
  const todayDate = useMemo(() => getTodayDateUTC(), []);
  const [activeScenario, setActiveScenario] = useState<TestScenario | null>(null);
  const [voteCount, setVoteCount] = useState(0);
  const [currentPairIndex, setCurrentPairIndex] = useState(0);
  const [showModal, setShowModal] = useState(false);

  // Interactive flow state
  const [flowSubmissionCount, setFlowSubmissionCount] = useState(5);
  const [flowVoteCount, setFlowVoteCount] = useState(0);
  const [flowPairIndex, setFlowPairIndex] = useState(0);
  const [flowShowConfirmation, setFlowShowConfirmation] = useState(false);
  const [flowHasEnteredRanking, setFlowHasEnteredRanking] = useState(false);
  const [flowSubmitting, setFlowSubmitting] = useState(false);

  const flowRequiredVotes = calculateRequiredVotes(flowSubmissionCount);
  const flowTotalPairs = calculateTotalPairs(flowSubmissionCount);

  const handleVote = () => {
    setVoteCount((prev) => Math.min(prev + 1, 10));
    setCurrentPairIndex((prev) => Math.min(prev + 1, MOCK_VOTING_PAIRS.length - 1));
  };

  const currentPair = MOCK_VOTING_PAIRS[currentPairIndex];

  // Interactive flow handlers — simulate production delay
  const handleFlowVote = () => {
    setFlowSubmitting(true);
    setTimeout(() => {
      const newVoteCount = flowVoteCount + 1;
      const newPairIndex = flowPairIndex + 1;
      setFlowVoteCount(newVoteCount);
      setFlowPairIndex(newPairIndex);
      setFlowSubmitting(false);

      // Check if just reached the threshold
      if (newVoteCount >= flowRequiredVotes && !flowHasEnteredRanking) {
        setFlowHasEnteredRanking(true);
        setFlowShowConfirmation(true);
      }
    }, 500);
  };

  const handleFlowDone = () => {
    // Reset flow
    setFlowVoteCount(0);
    setFlowPairIndex(0);
    setFlowShowConfirmation(false);
    setFlowHasEnteredRanking(false);
  };

  const resetFlow = () => {
    setFlowVoteCount(0);
    setFlowPairIndex(0);
    setFlowShowConfirmation(false);
    setFlowHasEnteredRanking(false);
  };


  const renderDynamicThreshold = (submissionCount: number) => {
    const required = calculateRequiredVotes(submissionCount);
    const totalPairs = calculateTotalPairs(submissionCount);
    return (
      <div className="bg-(--color-bg-primary) border border-(--color-border) rounded-xl p-6 w-full max-w-md shadow-xl">
        <div className="text-center mb-4">
          <div className="text-3xl font-bold text-(--color-text-primary)">{submissionCount}</div>
          <div className="text-sm text-(--color-text-secondary)">submissions</div>
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-(--color-text-secondary)">Total possible pairs:</span>
            <span className="text-(--color-text-primary) font-medium">{totalPairs}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-(--color-text-secondary)">Votes required:</span>
            <span className="text-(--color-text-primary) font-medium">{required}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-(--color-text-secondary)">Formula:</span>
            <span className="text-(--color-text-tertiary)">min(5, pairs)</span>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-(--color-border)">
          <div className="text-xs text-(--color-text-tertiary)">
            {required === 5
              ? 'Standard: 5 votes required'
              : `Reduced: Only ${required} vote${required !== 1 ? 's' : ''} needed`}
          </div>
        </div>
      </div>
    );
  };

  const renderWinnerModal = (topThree: RankingEntry[]) => (
    <WinnerAnnouncementModal
      challengeDate={MOCK_CHALLENGE.date}
      topThree={topThree}
      rankingStats={{ submissionCount: 10, voterCount: 3, confidence: 'low' }}
      onDismiss={() => setShowModal(false)}
    />
  );

  const renderScenario = () => {
    switch (activeScenario) {
      case 'voting-ui':
        return (
          <div className="flex items-center justify-center min-h-150">
            <VotingPairView
              currentPair={currentPair}
              challenge={MOCK_CHALLENGE}
              voteCount={voteCount}
              requiredVotes={5}
              submitting={false}
              onVote={handleVote}
              onSkipVoting={() => {}}
            />
          </div>
        );

      case 'voting-flow': {
        const flowPair = MOCK_VOTING_PAIRS[flowPairIndex % MOCK_VOTING_PAIRS.length];
        const noMorePairs = flowPairIndex >= flowTotalPairs;

        return (
          <div className="space-y-6">
            {/* Controls */}
            <div className="bg-(--color-bg-secondary) border border-(--color-border) rounded-lg p-4">
              <h3 className="text-sm font-semibold text-(--color-text-primary) mb-3">Flow Controls</h3>
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <label className="text-sm text-(--color-text-secondary)">Submissions:</label>
                  <select
                    value={flowSubmissionCount}
                    onChange={(e) => {
                      setFlowSubmissionCount(Number(e.target.value));
                      resetFlow();
                    }}
                    className="px-2 py-1 rounded border border-(--color-border) bg-(--color-bg-primary) text-(--color-text-primary) text-sm"
                  >
                    <option value={2}>2 (1 pair, 1 vote req)</option>
                    <option value={3}>3 (3 pairs, 3 votes req)</option>
                    <option value={4}>4 (6 pairs, 5 votes req)</option>
                    <option value={5}>5 (10 pairs, 5 votes req)</option>
                    <option value={10}>10 (45 pairs, 5 votes req)</option>
                  </select>
                </div>
                <button
                  onClick={resetFlow}
                  className="px-3 py-1 text-sm border border-(--color-border) rounded hover:bg-(--color-bg-tertiary) transition-colors"
                >
                  Reset Flow
                </button>
                <div className="flex-1" />
                <div className="text-xs text-(--color-text-tertiary)">
                  Status: {flowHasEnteredRanking ? '✓ Entered ranking' : 'Not in ranking yet'} |
                  Pairs seen: {flowPairIndex}/{flowTotalPairs}
                </div>
              </div>
            </div>

            {/* Interactive voting UI or confirmation */}
            <div className="flex flex-col items-center justify-center min-h-125">
              {flowShowConfirmation ? (
                <VotingConfirmation
                  isEntered={true}
                  wallDate={MOCK_CHALLENGE.date}
                  onDone={handleFlowDone}
                  userId="mock-user-id"
                >
                  {!noMorePairs && (
                    <ContinueVotingZone
                      currentPair={flowPair}
                      challenge={MOCK_CHALLENGE}
                      submitting={flowSubmitting}
                      onVote={handleFlowVote}
                    />
                  )}
                </VotingConfirmation>
              ) : noMorePairs ? (
                <VotingConfirmation
                  isEntered={flowHasEnteredRanking}
                  wallDate={MOCK_CHALLENGE.date}
                  onDone={handleFlowDone}
                  userId="mock-user-id"
                />
              ) : (
                <VotingPairView
                  currentPair={flowPair}
                  challenge={MOCK_CHALLENGE}
                  voteCount={flowVoteCount}
                  requiredVotes={flowRequiredVotes}
                  submitting={flowSubmitting}
                  onVote={handleFlowVote}
                  onSkipVoting={() => {}}
                />
              )}
            </div>
          </div>
        );
      }

      case 'voting-progress':
        return (
          <div className="space-y-8">
            <h3 className="text-lg font-medium text-(--color-text-primary)">Vote Progress States</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[0, 1, 2, 3, 4, 5, 7].map((count) => (
                <div key={count} className="p-4 border border-(--color-border) rounded-lg">
                  <p className="text-sm text-(--color-text-secondary) mb-2">
                    {count} vote{count !== 1 ? 's' : ''}
                  </p>
                  <VotingProgress voteCount={count} requiredVotes={5} />
                </div>
              ))}
            </div>
          </div>
        );

      case 'voting-confirmation':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-sm text-(--color-text-secondary) mb-2">
                  Entered ranking (with continue voting)
                </p>
                <VotingConfirmation
                  isEntered={true}
                  wallDate={todayDate}
                  onDone={() => {}}
                  userId="mock-user-id"
                >
                  <ContinueVotingZone
                    currentPair={MOCK_VOTING_PAIRS[0]}
                    challenge={MOCK_CHALLENGE}
                    submitting={false}
                    onVote={() => {}}
                  />
                </VotingConfirmation>
              </div>
              <div>
                <p className="text-sm text-(--color-text-secondary) mb-2">
                  Entered ranking (no other submissions)
                </p>
                <VotingConfirmation
                  isEntered={true}
                  wallDate="1999-01-01"
                  onDone={() => {}}
                  userId="mock-user-id"
                />
              </div>
            </div>
          </div>
        );

      case 'voting-no-pairs':
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-medium text-(--color-text-primary)">
              No More Pairs Scenarios
            </h3>
            <p className="text-sm text-(--color-text-secondary) mb-4">
              "No More Pairs" only occurs when you've voted on ALL available pairs. With few submissions,
              this naturally leads to entering the ranking since you voted on everything available.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Scenario: Entered ranking */}
              <div>
                <p className="text-sm text-(--color-text-secondary) mb-2">
                  Entered ranking (no more pairs)
                </p>
                <VotingConfirmation
                  isEntered={true}
                  wallDate={MOCK_CHALLENGE.date}

                  onDone={() => {}}
                  userId="mock-user-id"
                />
              </div>
              {/* Scenario: Not entered ranking */}
              <div>
                <p className="text-sm text-(--color-text-secondary) mb-2">
                  Not entered (skipped voting)
                </p>
                <VotingConfirmation
                  isEntered={false}
                  wallDate={MOCK_CHALLENGE.date}

                  onDone={() => {}}
                  userId="mock-user-id"
                />
              </div>
              {/* Scenario: All pairs exhausted — no continue voting zone shown */}
              <div>
                <p className="text-sm text-(--color-text-secondary) mb-2">
                  All pairs exhausted
                </p>
                <VotingConfirmation
                  isEntered={true}
                  wallDate={MOCK_CHALLENGE.date}
                  onDone={() => {}}
                  userId="mock-user-id"
                />
              </div>
            </div>
          </div>
        );

      case 'voting-dynamic-threshold':
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-medium text-(--color-text-primary)">
              Dynamic Vote Requirements
            </h3>
            <p className="text-sm text-(--color-text-secondary)">
              When fewer than 5 submissions exist, the vote requirement adjusts to the number of available pairs.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[2, 3, 4, 5, 6, 10].map((count) => (
                <div key={count}>{renderDynamicThreshold(count)}</div>
              ))}
            </div>
          </div>
        );

      case 'voting-bootstrap-zero':
        return (
          <div className="flex items-center justify-center min-h-100">
            <VotingOptInPrompt
              onOptIn={() => {}}
              onSkip={() => {}}
            />
          </div>
        );

      case 'voting-bootstrap-one':
        return (
          <div className="flex items-center justify-center min-h-100">
            <VotingOptInPrompt
              onOptIn={() => {}}
              onSkip={() => {}}
            />
          </div>
        );

      case 'winner-normal':
        return showModal ? (
          renderWinnerModal(MOCK_TOP_THREE)
        ) : (
          <div className="text-center">
            <button
              onClick={() => setShowModal(true)}
              className="px-6 py-3 bg-(--color-accent) text-(--color-accent-text) rounded-lg font-medium hover:bg-(--color-accent-hover)"
            >
              Show Winner Modal
            </button>
          </div>
        );

      case 'winner-tied':
        return showModal ? (
          renderWinnerModal(MOCK_TIED_TOP_THREE)
        ) : (
          <div className="text-center">
            <button
              onClick={() => setShowModal(true)}
              className="px-6 py-3 bg-(--color-accent) text-(--color-accent-text) rounded-lg font-medium hover:bg-(--color-accent-hover)"
            >
              Show Tied Winner Modal
            </button>
          </div>
        );

      case 'winner-three-way':
        return showModal ? (
          renderWinnerModal(MOCK_THREE_WAY_TIE)
        ) : (
          <div className="text-center">
            <button
              onClick={() => setShowModal(true)}
              className="px-6 py-3 bg-(--color-accent) text-(--color-accent-text) rounded-lg font-medium hover:bg-(--color-accent-hover)"
            >
              Show Three-Way Tie Modal
            </button>
          </div>
        );

      case 'congrats-1st':
      case 'congrats-2nd':
      case 'congrats-3rd': {
        const entryIndex = activeScenario === 'congrats-1st' ? 0 : activeScenario === 'congrats-2nd' ? 1 : 2;
        return showModal ? (
          <CongratulatoryModal
            userEntry={MOCK_TOP_THREE[entryIndex]}
            challengeDate={MOCK_CHALLENGE.date}
            onDismiss={() => setShowModal(false)}
          />
        ) : (
          <div className="text-center">
            <button
              onClick={() => setShowModal(true)}
              className="px-6 py-3 bg-(--color-accent) text-(--color-accent-text) rounded-lg font-medium hover:bg-(--color-accent-hover)"
            >
              Show Congrats Modal
            </button>
          </div>
        );
      }

      default:
        return (
          <div className="text-center text-(--color-text-secondary)">
            Select a scenario from the sidebar
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-(--color-bg-primary) flex">
      {/* Sidebar */}
      <div className="w-64 border-r border-(--color-border) p-4 overflow-y-auto">
        <h1 className="text-xl font-bold text-(--color-text-primary) mb-4">Voting Tests</h1>
        <p className="text-xs text-(--color-text-tertiary) mb-6">
          Visual test page for voting components
        </p>

        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-(--color-text-secondary) uppercase tracking-wide mb-2">
            Voting Modal
          </h3>
          {(
            ['voting-ui', 'voting-flow', 'voting-progress', 'voting-dynamic-threshold', 'voting-confirmation', 'voting-no-pairs', 'voting-bootstrap-zero', 'voting-bootstrap-one'] as TestScenario[]
          ).map((scenario) => (
            <button
              key={scenario}
              onClick={() => {
                setActiveScenario(scenario);
                setShowModal(false);
                setVoteCount(0);
                setCurrentPairIndex(0);
                if (scenario === 'voting-flow') {
                  resetFlow();
                }
              }}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                activeScenario === scenario
                  ? 'bg-(--color-accent) text-(--color-accent-text)'
                  : 'text-(--color-text-primary) hover:bg-(--color-bg-secondary)'
              }`}
            >
              {SCENARIOS[scenario].name}
            </button>
          ))}

          <h3 className="text-xs font-semibold text-(--color-text-secondary) uppercase tracking-wide mt-6 mb-2">
            Winner Announcement
          </h3>
          {(
            ['winner-normal', 'winner-tied', 'winner-three-way'] as TestScenario[]
          ).map((scenario) => (
            <button
              key={scenario}
              onClick={() => {
                setActiveScenario(scenario);
                setShowModal(false);
              }}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                activeScenario === scenario
                  ? 'bg-(--color-accent) text-(--color-accent-text)'
                  : 'text-(--color-text-primary) hover:bg-(--color-bg-secondary)'
              }`}
            >
              {SCENARIOS[scenario].name}
            </button>
          ))}

          <h3 className="text-xs font-semibold text-(--color-text-secondary) uppercase tracking-wide mt-6 mb-2">
            Congratulatory
          </h3>
          {(
            ['congrats-1st', 'congrats-2nd', 'congrats-3rd'] as TestScenario[]
          ).map((scenario) => (
            <button
              key={scenario}
              onClick={() => {
                setActiveScenario(scenario);
                setShowModal(false);
              }}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                activeScenario === scenario
                  ? 'bg-(--color-accent) text-(--color-accent-text)'
                  : 'text-(--color-text-primary) hover:bg-(--color-bg-secondary)'
              }`}
            >
              {SCENARIOS[scenario].name}
            </button>
          ))}

        </div>

        <div className="mt-8 pt-4 border-t border-(--color-border)">
          <BackToCanvasLink />
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 p-8">
        {activeScenario && (
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-(--color-text-primary)">
              {SCENARIOS[activeScenario].name}
            </h2>
            <p className="text-(--color-text-secondary)">{SCENARIOS[activeScenario].description}</p>
          </div>
        )}

        {renderScenario()}
      </div>
    </div>
  );
}
