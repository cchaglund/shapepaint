/**
 * Mock data for testing voting components and social features
 */

import type { Shape, RankingEntry, VotingPair, DailyChallenge } from '../types';
import type { Profile } from '../hooks/auth/useProfile';

// ============================================================================
// MOCK USERS - Minimal Supabase User objects for testing
// ============================================================================

export interface MockUser {
  id: string;
  email: string;
  created_at: string;
}

export const MOCK_USERS = {
  viewer: {
    id: 'user-viewer-001',
    email: 'viewer@test.com',
    created_at: '2024-01-01T00:00:00.000Z',
  },
  alice: {
    id: 'user-alice-002',
    email: 'alice@test.com',
    created_at: '2024-01-02T00:00:00.000Z',
  },
  bob: {
    id: 'user-bob-003',
    email: 'bob@test.com',
    created_at: '2024-01-03T00:00:00.000Z',
  },
  carol: {
    id: 'user-carol-004',
    email: 'carol@test.com',
    created_at: '2024-01-04T00:00:00.000Z',
  },
} as const satisfies Record<string, MockUser>;

// ============================================================================
// MOCK PROFILES - Corresponding profiles for each mock user
// ============================================================================

export const MOCK_PROFILES = {
  viewer: {
    id: MOCK_USERS.viewer.id,
    nickname: 'Viewer',
    avatar_url: null,
    onboarding_complete: true,
    created_at: MOCK_USERS.viewer.created_at,
  },
  alice: {
    id: MOCK_USERS.alice.id,
    nickname: 'AliceArt',
    avatar_url: 'https://example.com/alice.jpg',
    onboarding_complete: true,
    created_at: MOCK_USERS.alice.created_at,
  },
  bob: {
    id: MOCK_USERS.bob.id,
    nickname: 'BobCreates',
    avatar_url: 'https://example.com/bob.jpg',
    onboarding_complete: true,
    created_at: MOCK_USERS.bob.created_at,
  },
  carol: {
    id: MOCK_USERS.carol.id,
    nickname: 'CarolDesign',
    avatar_url: null,
    onboarding_complete: true,
    created_at: MOCK_USERS.carol.created_at,
  },
} as const satisfies Record<string, Profile>;

// ============================================================================
// MOCK FOLLOWS - Follow relationships between mock users
// Relationships: viewer follows alice+bob, alice follows viewer
// ============================================================================

export interface MockFollow {
  id: string;
  follower_id: string;
  following_id: string;
  created_at: string;
}

export const MOCK_FOLLOWS: MockFollow[] = [
  {
    id: 'follow-001',
    follower_id: MOCK_USERS.viewer.id,
    following_id: MOCK_USERS.alice.id,
    created_at: '2024-01-10T00:00:00.000Z',
  },
  {
    id: 'follow-002',
    follower_id: MOCK_USERS.viewer.id,
    following_id: MOCK_USERS.bob.id,
    created_at: '2024-01-11T00:00:00.000Z',
  },
  {
    id: 'follow-003',
    follower_id: MOCK_USERS.alice.id,
    following_id: MOCK_USERS.viewer.id,
    created_at: '2024-01-12T00:00:00.000Z',
  },
];

// Helper to check follow relationships
export function isFollowing(followerId: string, followingId: string): boolean {
  return MOCK_FOLLOWS.some(
    f => f.follower_id === followerId && f.following_id === followingId
  );
}

// Get all users that a user follows
export function getFollowing(userId: string): string[] {
  return MOCK_FOLLOWS
    .filter(f => f.follower_id === userId)
    .map(f => f.following_id);
}

// Get all users that follow a user
export function getFollowers(userId: string): string[] {
  return MOCK_FOLLOWS
    .filter(f => f.following_id === userId)
    .map(f => f.follower_id);
}

// Fixed challenge for consistent test rendering
export const MOCK_CHALLENGE: DailyChallenge = {
  date: '2024-01-15',
  colors: ['#FF6B6B', '#4ECDC4'],
  shapes: [
    { type: 'circle', name: 'Circle' },
    { type: 'square', name: 'Square' },
  ],
  word: 'creativity',
};

// Mock shapes for test submissions
function createMockShapes(seed: number): Shape[] {
  const shapes: Shape[] = [];
  const count = 2 + (seed % 4);

  for (let i = 0; i < count; i++) {
    shapes.push({
      id: `shape-${seed}-${i}`,
      type: (seed + i) % 2 === 0 ? 'circle' : 'square',
      name: `Shape ${i + 1}`,
      x: 150 + (((seed * 37 + i * 73) % 500)),
      y: 150 + (((seed * 53 + i * 97) % 500)),
      size: 80 + ((seed * 17 + i * 31) % 120),
      rotation: (seed * 41 + i * 67) % 360,
      colorIndex: (seed + i) % 2 === 0 ? 0 : 1,
      color: (seed + i) % 2 === 0 ? MOCK_CHALLENGE.colors[0] : MOCK_CHALLENGE.colors[1],
      zIndex: i,
      flipX: (seed + i) % 5 === 0,
      flipY: (seed + i) % 7 === 0,
    });
  }

  return shapes;
}

// Mock submission for voting pair
export function createMockSubmission(id: string, userId: string, seed: number) {
  const bgIndex = seed % 3 === 0 ? 0 : seed % 3 === 1 ? 1 : null;
  return {
    id,
    user_id: userId,
    shapes: createMockShapes(seed),
    background_color_index: bgIndex,
    background_color: bgIndex !== null ? MOCK_CHALLENGE.colors[bgIndex] : null,
  };
}

// Mock voting pairs for different test scenarios
export const MOCK_VOTING_PAIRS: VotingPair[] = [
  {
    submissionA: createMockSubmission('sub-a1', 'user-1', 1),
    submissionB: createMockSubmission('sub-b1', 'user-2', 2),
  },
  {
    submissionA: createMockSubmission('sub-a2', 'user-3', 3),
    submissionB: createMockSubmission('sub-b2', 'user-4', 4),
  },
  {
    submissionA: createMockSubmission('sub-a3', 'user-5', 5),
    submissionB: createMockSubmission('sub-b3', 'user-6', 6),
  },
  {
    submissionA: createMockSubmission('sub-a4', 'user-7', 7),
    submissionB: createMockSubmission('sub-b4', 'user-8', 8),
  },
  {
    submissionA: createMockSubmission('sub-a5', 'user-9', 9),
    submissionB: createMockSubmission('sub-b5', 'user-10', 10),
  },
];

// Mock ranking entries for winner announcement
export const MOCK_TOP_THREE: RankingEntry[] = [
  {
    rank: 1,
    submission_id: 'sub-winner',
    user_id: 'user-winner',
    nickname: 'ArtistPro',
    avatar_url: null,
    elo_score: 1150,
    vote_count: 12,
    shapes: createMockShapes(100),
    background_color: MOCK_CHALLENGE.colors[0],
  },
  {
    rank: 2,
    submission_id: 'sub-second',
    user_id: 'user-second',
    nickname: 'DesignMaster',
    avatar_url: null,
    elo_score: 1080,
    vote_count: 10,
    shapes: createMockShapes(200),
    background_color: MOCK_CHALLENGE.colors[1],
  },
  {
    rank: 3,
    submission_id: 'sub-third',
    user_id: 'user-third',
    nickname: 'CreativeGuru',
    avatar_url: null,
    elo_score: 1020,
    vote_count: 8,
    shapes: createMockShapes(300),
    background_color: null,
  },
];

// Tied ranking scenario
export const MOCK_TIED_TOP_THREE: RankingEntry[] = [
  {
    rank: 1,
    submission_id: 'sub-tie-1',
    user_id: 'user-tie-1',
    nickname: 'TieBreaker1',
    avatar_url: null,
    elo_score: 1100,
    vote_count: 10,
    shapes: createMockShapes(400),
    background_color: MOCK_CHALLENGE.colors[0],
  },
  {
    rank: 1,
    submission_id: 'sub-tie-2',
    user_id: 'user-tie-2',
    nickname: 'TieBreaker2',
    avatar_url: null,
    elo_score: 1100,
    vote_count: 10,
    shapes: createMockShapes(500),
    background_color: MOCK_CHALLENGE.colors[1],
  },
  {
    rank: 3,
    submission_id: 'sub-third-tied',
    user_id: 'user-third-tied',
    nickname: 'AlmostFirst',
    avatar_url: null,
    elo_score: 1050,
    vote_count: 9,
    shapes: createMockShapes(600),
    background_color: null,
  },
];

// Three-way tie scenario
export const MOCK_THREE_WAY_TIE: RankingEntry[] = [
  {
    rank: 1,
    submission_id: 'sub-3tie-1',
    user_id: 'user-3tie-1',
    nickname: 'TripleThreat1',
    avatar_url: null,
    elo_score: 1100,
    vote_count: 10,
    shapes: createMockShapes(700),
    background_color: MOCK_CHALLENGE.colors[0],
  },
  {
    rank: 1,
    submission_id: 'sub-3tie-2',
    user_id: 'user-3tie-2',
    nickname: 'TripleThreat2',
    avatar_url: null,
    elo_score: 1100,
    vote_count: 10,
    shapes: createMockShapes(800),
    background_color: MOCK_CHALLENGE.colors[1],
  },
  {
    rank: 1,
    submission_id: 'sub-3tie-3',
    user_id: 'user-3tie-3',
    nickname: 'TripleThreat3',
    avatar_url: null,
    elo_score: 1100,
    vote_count: 10,
    shapes: createMockShapes(900),
    background_color: null,
  },
];

