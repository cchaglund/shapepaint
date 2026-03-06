/**
 * Social Features Test Page
 *
 * Visual test page for social features (Wall of the Day, Follow system) with mock data.
 * Access via ?test=social in the URL.
 *
 * Uses mock data to test social features without requiring real database/auth.
 */

import { useState } from 'react';

import { SubmissionThumbnail } from '../components/shared/SubmissionThumbnail';
import { UserProfilePage } from '../pages/UserProfilePage';
import { FriendsFeedContent } from '../components/FriendsFeed/FriendsFeedContent';
import { FriendsModal } from '../components/modals/FriendsModal';
import { FriendsModalTabs, type FriendsTab } from '../components/modals/FriendsModalTabs';
import { FriendRow } from '../components/modals/FriendRow';
import { FriendsList } from '../components/modals/FriendsList';
import { UserSearchBar } from '../components/modals/UserSearchBar';
import type { FollowUser } from '../contexts/FollowsContext';
import { FollowsProvider } from '../contexts/FollowsContext';
import { getSocialTestScenario } from '../utils/urlParams';
import {
  MOCK_CHALLENGE,
  MOCK_PROFILES,
  MOCK_WALL_SUBMISSIONS,
  SCENARIOS,
} from './mockData';
import { BackToCanvasLink } from '../components/shared/BackToCanvasLink';

// ============================================================================
// Test Scenario Types
// ============================================================================

type TestScenario =
  // Wall of the Day scenarios (tasks 10-11)
  | 'wall-locked'
  | 'wall-grid'
  // Follow system scenarios (task 12)
  | 'follow-button'
  // Friends modal scenario (task 6+)
  | 'friends-modal'
  // User profile scenario (task 13)
  | 'user-profile'
  // Friends feed scenario (task 15)
  | 'friends-feed';

interface ScenarioConfig {
  name: string;
  description: string;
  /** Which mock scenario to use for context (user, profile, follows) */
  mockScenario: keyof typeof SCENARIOS;
}

const TEST_SCENARIOS: Record<TestScenario, ScenarioConfig> = {
  // Wall of the Day
  'wall-locked': {
    name: 'Wall - Locked',
    description: 'User has not saved art today - shows "Save your art first" message',
    mockScenario: 'loggedInNoSubmission',
  },
  'wall-grid': {
    name: 'Wall - Grid',
    description: 'Shows grid of 20 mock submissions from the wall',
    mockScenario: 'loggedInWithSubmission',
  },
  // Follow system
  'follow-button': {
    name: 'Follow Button States',
    description: 'Shows all follow button states: Follow, Following, Unfollow on hover',
    mockScenario: 'loggedInWithFollows',
  },
  // Friends modal
  'friends-modal': {
    name: 'Friends Modal',
    description: 'Friends modal with tab switching - shows logged out state (no auth in test page)',
    mockScenario: 'loggedOut',
  },
  // User profile
  'user-profile': {
    name: 'User Profile Page',
    description: 'User profile page with error states (not found, loading)',
    mockScenario: 'loggedOut',
  },
  // Friends feed
  'friends-feed': {
    name: 'Friends Feed',
    description: 'Grid and calendar views of friends submissions with sorting',
    mockScenario: 'loggedInWithFollows',
  },
};

// ============================================================================
// Follow Button Demo Component
// ============================================================================

type FollowState = 'follow' | 'following' | 'unfollow';

interface FollowButtonDemoProps {
  initialState: 'follow' | 'following';
  nickname: string;
}

function FollowButtonDemo({ initialState, nickname }: FollowButtonDemoProps) {
  const [isFollowing, setIsFollowing] = useState(initialState === 'following');
  const [isHovered, setIsHovered] = useState(false);

  const getDisplayState = (): FollowState => {
    if (!isFollowing) return 'follow';
    return isHovered ? 'unfollow' : 'following';
  };

  const displayState = getDisplayState();

  const handleClick = () => {
    setIsFollowing(!isFollowing);
  };

  const buttonStyles: Record<FollowState, string> = {
    follow:
      'bg-(--color-accent) text-(--color-accent-text) hover:bg-(--color-accent-hover) border-transparent',
    following:
      'bg-transparent text-(--color-text-primary) border-(--color-border) hover:border-(--color-danger) hover:text-(--color-danger)',
    unfollow:
      'bg-(--color-danger)/10 text-(--color-danger) border-(--color-danger)',
  };

  const buttonText: Record<FollowState, string> = {
    follow: 'Follow',
    following: 'Following',
    unfollow: 'Unfollow',
  };

  return (
    <div className="flex items-center gap-4 p-4 bg-(--color-bg-secondary) rounded-lg border border-(--color-border)">
      <div className="flex-1">
        <p className="font-medium text-(--color-text-primary)">{nickname}</p>
        <p className="text-xs text-(--color-text-tertiary)">
          State: <span className="font-mono">{displayState}</span>
        </p>
      </div>
      <button
        onClick={handleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`px-4 py-1.5 text-sm font-medium rounded-full border transition-all duration-150 cursor-pointer ${buttonStyles[displayState]}`}
      >
        {buttonText[displayState]}
      </button>
    </div>
  );
}

// ============================================================================
// Friends Modal Demo Component
// ============================================================================

function FriendsModalDemo() {
  const [showModal, setShowModal] = useState(false);
  // Standalone tabs demo state
  const [standaloneTab, setStandaloneTab] = useState<FriendsTab>('following');

  // Mock following data for FriendsList demo
  const mockFollowing: FollowUser[] = [
    { id: MOCK_PROFILES.alice.id, nickname: MOCK_PROFILES.alice.nickname, followedAt: '2025-01-15T10:00:00Z' },
    { id: MOCK_PROFILES.bob.id, nickname: MOCK_PROFILES.bob.nickname, followedAt: '2025-01-14T10:00:00Z' },
    { id: MOCK_PROFILES.carol.id, nickname: MOCK_PROFILES.carol.nickname, followedAt: '2025-01-13T10:00:00Z' },
  ];

  return (
    <div className="max-w-md mx-auto space-y-6">
      {/* Instructions */}
      <div className="p-4 bg-(--color-bg-tertiary) rounded-lg border border-(--color-border)">
        <h3 className="text-sm font-semibold text-(--color-text-primary) mb-2">
          How to test
        </h3>
        <ul className="text-xs text-(--color-text-secondary) space-y-1 list-disc list-inside">
          <li>Test the standalone tabs below - click to switch between Following/Followers</li>
          <li>Click "Open Friends Modal" to show the full modal (logged-out state)</li>
          <li>Test closing via: X button, clicking overlay, pressing Escape</li>
        </ul>
      </div>

      {/* Standalone FriendsModalTabs demo */}
      <div>
        <h4 className="text-xs font-semibold text-(--color-text-secondary) uppercase tracking-wide mb-2">
          FriendsModalTabs Component (Standalone)
        </h4>
        <div className="bg-(--color-bg-secondary) rounded-lg border border-(--color-border) overflow-hidden">
          <FriendsModalTabs
            activeTab={standaloneTab}
            onTabChange={setStandaloneTab}
            followingCount={42}
            followersCount={108}
            loading={false}
          />
          <div className="p-4 text-center text-sm text-(--color-text-secondary)">
            Active tab: <span className="font-mono font-medium text-(--color-text-primary)">{standaloneTab}</span>
          </div>
        </div>
      </div>

      {/* FriendRow Component demo */}
      <div>
        <h4 className="text-xs font-semibold text-(--color-text-secondary) uppercase tracking-wide mb-2">
          FriendRow Component (Standalone)
        </h4>
        <div className="bg-(--color-bg-secondary) rounded-lg border border-(--color-border) divide-y divide-(--color-border)">
          <FollowsProvider>
            <FriendRow
              userId={MOCK_PROFILES.alice.id}
              nickname={MOCK_PROFILES.alice.nickname}
              onNavigateToProfile={(id) => alert(`Navigate to profile: ${id}`)}
            />
            <FriendRow
              userId={MOCK_PROFILES.bob.id}
              nickname={MOCK_PROFILES.bob.nickname}
              onNavigateToProfile={(id) => alert(`Navigate to profile: ${id}`)}
            />
            <FriendRow
              userId={MOCK_PROFILES.carol.id}
              nickname={MOCK_PROFILES.carol.nickname}
              onNavigateToProfile={(id) => alert(`Navigate to profile: ${id}`)}
            />
          </FollowsProvider>
        </div>
        <p className="text-xs text-(--color-text-tertiary) mt-2">
          Note: FollowButton shows disabled state (no auth context). Click nickname to test navigation callback.
        </p>
      </div>

      {/* FriendsList Component demo */}
      <div>
        <h4 className="text-xs font-semibold text-(--color-text-secondary) uppercase tracking-wide mb-2">
          FriendsList Component (Standalone)
        </h4>
        <div className="space-y-4">
          {/* List with users */}
          <div>
            <p className="text-xs text-(--color-text-tertiary) mb-2">With users (following list):</p>
            <div className="bg-(--color-bg-secondary) rounded-lg border border-(--color-border) p-2">
              <FollowsProvider>
                <FriendsList
                  users={mockFollowing}
                  listType="following"
                  loading={false}
                  onNavigateToProfile={(id) => alert(`Navigate to profile: ${id}`)}
                />
              </FollowsProvider>
            </div>
          </div>
          {/* Empty following state */}
          <div>
            <p className="text-xs text-(--color-text-tertiary) mb-2">Empty following state:</p>
            <div className="bg-(--color-bg-secondary) rounded-lg border border-(--color-border) p-2">
              <FriendsList
                users={[]}
                listType="following"
                loading={false}
              />
            </div>
          </div>
          {/* Empty followers state */}
          <div>
            <p className="text-xs text-(--color-text-tertiary) mb-2">Empty followers state:</p>
            <div className="bg-(--color-bg-secondary) rounded-lg border border-(--color-border) p-2">
              <FriendsList
                users={[]}
                listType="followers"
                loading={false}
              />
            </div>
          </div>
          {/* Loading state */}
          <div>
            <p className="text-xs text-(--color-text-tertiary) mb-2">Loading state:</p>
            <div className="bg-(--color-bg-secondary) rounded-lg border border-(--color-border) p-2">
              <FriendsList
                users={[]}
                listType="following"
                loading={true}
              />
            </div>
          </div>
        </div>
      </div>

      {/* UserSearchBar Component demo */}
      <div>
        <h4 className="text-xs font-semibold text-(--color-text-secondary) uppercase tracking-wide mb-2">
          UserSearchBar Component (Standalone)
        </h4>
        <div className="bg-(--color-bg-secondary) rounded-lg border border-(--color-border) p-4">
          <UserSearchBar onNavigateToProfile={(id) => alert(`Navigate to profile: ${id}`)} />
          <p className="text-xs text-(--color-text-tertiary) mt-3">
            Type a nickname to search (300ms debounce). Results show FriendRow with FollowButton.
            Note: Requires real Supabase connection to show results.
          </p>
        </div>
      </div>

      {/* Open modal button */}
      <button
        onClick={() => setShowModal(true)}
        className="w-full px-4 py-3 text-sm font-medium rounded-lg bg-(--color-accent) text-(--color-accent-text) hover:bg-(--color-accent-hover) transition-colors cursor-pointer"
      >
        Open Friends Modal
      </button>

      {/* Modal - wrapped in FollowsProvider since test page doesn't have auth context */}
      {showModal && (
        <FollowsProvider>
          <FriendsModal onClose={() => setShowModal(false)} />
        </FollowsProvider>
      )}
    </div>
  );
}

// ============================================================================
// User Profile Demo Component
// ============================================================================

function UserProfileDemo() {
  // Use a valid UUID format that doesn't exist in the database
  const [testUserId, setTestUserId] = useState('11111111-2222-3333-4444-555555555555');

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="max-w-md mx-auto p-4 bg-(--color-bg-secondary) rounded-lg border border-(--color-border)">
        <h3 className="text-sm font-semibold text-(--color-text-primary) mb-3">
          Test User Profile Error States
        </h3>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-(--color-text-secondary) mb-1">User ID:</label>
            <input
              type="text"
              value={testUserId}
              onChange={(e) => setTestUserId(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-(--color-border) bg-(--color-bg-primary) text-(--color-text-primary)"
              placeholder="Enter user ID to test"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setTestUserId('11111111-2222-3333-4444-555555555555')}
              className="px-3 py-1.5 text-xs rounded-lg border border-(--color-border) hover:bg-(--color-bg-tertiary) text-(--color-text-primary)"
            >
              Non-existent User
            </button>
            <button
              onClick={() => setTestUserId('not-a-uuid')}
              className="px-3 py-1.5 text-xs rounded-lg border border-(--color-border) hover:bg-(--color-bg-tertiary) text-(--color-text-primary)"
            >
              Invalid Format
            </button>
            <button
              onClick={() => setTestUserId('')}
              className="px-3 py-1.5 text-xs rounded-lg border border-(--color-border) hover:bg-(--color-bg-tertiary) text-(--color-text-primary)"
            >
              Empty ID
            </button>
          </div>
        </div>
        <p className="text-xs text-(--color-text-tertiary) mt-3">
          The UserProfilePage below will show "User not found" for invalid IDs, or "Loading..." while fetching.
        </p>
      </div>

      {/* Embedded UserProfilePage */}
      <div className="border border-(--color-border) rounded-lg overflow-hidden">
        <FollowsProvider>
          <UserProfilePage userId={testUserId} />
        </FollowsProvider>
      </div>
    </div>
  );
}

// ============================================================================
// Friends Feed Demo Component
// ============================================================================

function FriendsFeedDemo() {
  const [feedDate, setFeedDate] = useState(new Date().toISOString().split('T')[0]);

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Instructions */}
      <div className="p-4 bg-(--color-bg-tertiary) rounded-lg border border-(--color-border)">
        <h3 className="text-sm font-semibold text-(--color-text-primary) mb-2">
          How to test
        </h3>
        <ul className="text-xs text-(--color-text-secondary) space-y-1 list-disc list-inside">
          <li>Toggle between Grid and Calendar views</li>
          <li>Test sort controls (Random, Newest, Oldest, Ranked)</li>
          <li>In Calendar view, click days to switch to Grid view for that day</li>
          <li>Note: Shows "Please sign in" or "Follow some artists" without auth context</li>
        </ul>
      </div>

      {/* FriendsFeedContent embedded */}
      <div className="bg-(--color-bg-secondary) rounded-lg border border-(--color-border) p-4">
        <FollowsProvider>
          <FriendsFeedContent
            date={feedDate}
            onDateChange={setFeedDate}
            hasSubmittedToday={true}
            showNavigation={true}
          />
        </FollowsProvider>
      </div>
    </div>
  );
}

// ============================================================================
// SocialTestPage Component
// ============================================================================

export function SocialTestPage() {
  // Get initial scenario from URL parameter (?scenario=wall-grid)
  const getInitialScenario = (): TestScenario | null => {
    const urlScenario = getSocialTestScenario();
    if (urlScenario && urlScenario in TEST_SCENARIOS) {
      return urlScenario as TestScenario;
    }
    return null;
  };

  const [activeScenario, setActiveScenario] = useState<TestScenario | null>(getInitialScenario);

  // Get the mock scenario data for the active test
  const currentConfig = activeScenario ? TEST_SCENARIOS[activeScenario] : null;
  // Mock data will be used when implementing the actual scenario components
  // const mockData: Scenario | null = currentConfig
  //   ? SCENARIOS[currentConfig.mockScenario]
  //   : null;

  // Reset all localStorage state for clean testing
  const handleReset = () => {
    // Clear any social feature localStorage keys
    const keysToRemove = Object.keys(localStorage).filter(
      (key) =>
        key.startsWith('social-') ||
        key.startsWith('wall-') ||
        key.startsWith('follow-')
    );
    keysToRemove.forEach((key) => localStorage.removeItem(key));

    // Force re-render by toggling scenario
    if (activeScenario) {
      const current = activeScenario;
      setActiveScenario(null);
      setTimeout(() => setActiveScenario(current), 0);
    }
  };

  // ============================================================================
  // Scenario Renderers
  // ============================================================================

  const renderScenario = () => {
    switch (activeScenario) {
      case 'wall-locked':
        return (
          <div className="flex items-center justify-center min-h-100">
            <div className="text-center p-8 bg-(--color-bg-secondary) rounded-xl border border-(--color-border)">
              <div className="text-4xl mb-4">🔒</div>
              <h3 className="text-lg font-semibold text-(--color-text-primary) mb-2">
                Save your art first
              </h3>
              <p className="text-sm text-(--color-text-secondary)">
                Submit your creation for today's challenge to see the Wall of the Day
              </p>
            </div>
          </div>
        );

      case 'wall-grid': {
        // Take first 20 submissions for the grid display
        const wallSubmissions = MOCK_WALL_SUBMISSIONS.slice(0, 20);
        return (
          <div className="grid grid-cols-4 gap-4 max-w-3xl mx-auto">
            {wallSubmissions.map((submission) => (
              <div key={submission.id} className="flex flex-col items-center">
                <SubmissionThumbnail
                  shapes={submission.shapes}
                  challenge={MOCK_CHALLENGE}
                  backgroundColorIndex={submission.background_color_index}
                  size={140}
                />
                <span className="text-xs text-(--color-text-secondary) truncate max-w-full">
                  {submission.nickname}
                </span>
              </div>
            ))}
          </div>
        );
      }

      case 'follow-button':
        return (
          <div className="max-w-md mx-auto space-y-6">
            {/* Instructions */}
            <div className="p-4 bg-(--color-bg-tertiary) rounded-lg border border-(--color-border)">
              <h3 className="text-sm font-semibold text-(--color-text-primary) mb-2">
                How to test
              </h3>
              <ul className="text-xs text-(--color-text-secondary) space-y-1 list-disc list-inside">
                <li>Click buttons to toggle follow state</li>
                <li>Hover over "Following" button to see "Unfollow" state</li>
                <li>Watch the state indicator below each nickname</li>
              </ul>
            </div>

            {/* Follow state - user not being followed */}
            <div>
              <h4 className="text-xs font-semibold text-(--color-text-secondary) uppercase tracking-wide mb-2">
                Not Following (Click to follow)
              </h4>
              <FollowButtonDemo
                initialState="follow"
                nickname={MOCK_PROFILES.carol.nickname}
              />
            </div>

            {/* Following state - user already being followed */}
            <div>
              <h4 className="text-xs font-semibold text-(--color-text-secondary) uppercase tracking-wide mb-2">
                Already Following (Hover to see unfollow)
              </h4>
              <FollowButtonDemo
                initialState="following"
                nickname={MOCK_PROFILES.alice.nickname}
              />
              <div className="mt-2">
                <FollowButtonDemo
                  initialState="following"
                  nickname={MOCK_PROFILES.bob.nickname}
                />
              </div>
            </div>

            {/* Static state previews */}
            <div>
              <h4 className="text-xs font-semibold text-(--color-text-secondary) uppercase tracking-wide mb-2">
                All Button States (Static Preview)
              </h4>
              <div className="flex gap-3 p-4 bg-(--color-bg-secondary) rounded-lg border border-(--color-border)">
                <button className="px-4 py-1.5 text-sm font-medium rounded-full border border-transparent bg-(--color-accent) text-(--color-accent-text)">
                  Follow
                </button>
                <button className="px-4 py-1.5 text-sm font-medium rounded-full border border-(--color-border) bg-transparent text-(--color-text-primary)">
                  Following
                </button>
                <button className="px-4 py-1.5 text-sm font-medium rounded-full border border-(--color-danger) bg-(--color-danger)/10 text-(--color-danger)">
                  Unfollow
                </button>
              </div>
            </div>
          </div>
        );

      case 'friends-modal':
        return (
          <FriendsModalDemo />
        );

      case 'user-profile':
        return (
          <UserProfileDemo />
        );

      case 'friends-feed':
        return (
          <FriendsFeedDemo />
        );

      default:
        return (
          <div className="text-center text-(--color-text-secondary)">
            Select a scenario from the sidebar
          </div>
        );
    }
  };

  // ============================================================================
  // Main Render
  // ============================================================================

  return (
    <div className="min-h-screen bg-(--color-bg-primary) flex">
      {/* Sidebar */}
      <div className="w-64 border-r border-(--color-border) p-4 overflow-y-auto">
        <h1 className="text-xl font-bold text-(--color-text-primary) mb-4">
          Social Features
        </h1>
        <p className="text-xs text-(--color-text-tertiary) mb-6">
          Visual test page for social features
        </p>

        {/* Wall of the Day section */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-(--color-text-secondary) uppercase tracking-wide mb-2">
            Wall of the Day
          </h3>
          {(['wall-locked', 'wall-grid'] as TestScenario[]).map((scenario) => (
            <button
              key={scenario}
              onClick={() => setActiveScenario(scenario)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                activeScenario === scenario
                  ? 'bg-(--color-accent) text-(--color-accent-text)'
                  : 'text-(--color-text-primary) hover:bg-(--color-bg-secondary)'
              }`}
            >
              {TEST_SCENARIOS[scenario].name}
            </button>
          ))}

          {/* Follow System section */}
          <h3 className="text-xs font-semibold text-(--color-text-secondary) uppercase tracking-wide mt-6 mb-2">
            Follow System
          </h3>
          {(['follow-button', 'friends-modal', 'user-profile', 'friends-feed'] as TestScenario[]).map((scenario) => (
            <button
              key={scenario}
              onClick={() => setActiveScenario(scenario)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                activeScenario === scenario
                  ? 'bg-(--color-accent) text-(--color-accent-text)'
                  : 'text-(--color-text-primary) hover:bg-(--color-bg-secondary)'
              }`}
            >
              {TEST_SCENARIOS[scenario].name}
            </button>
          ))}
        </div>

        {/* Reset button and back link */}
        <div className="mt-8 pt-4 border-t border-(--color-border) space-y-3">
          <button
            onClick={handleReset}
            className="w-full px-3 py-2 text-sm border border-(--color-border) rounded-lg hover:bg-(--color-bg-tertiary) transition-colors text-(--color-text-primary)"
          >
            🔄 Reset State
          </button>
          <BackToCanvasLink />
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 p-8">
        {activeScenario && currentConfig && (
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-(--color-text-primary)">
              {currentConfig.name}
            </h2>
            <p className="text-(--color-text-secondary)">{currentConfig.description}</p>
            <p className="text-xs text-(--color-text-tertiary) mt-1">
              Mock scenario: {currentConfig.mockScenario}
            </p>
          </div>
        )}

        {renderScenario()}
      </div>
    </div>
  );
}
