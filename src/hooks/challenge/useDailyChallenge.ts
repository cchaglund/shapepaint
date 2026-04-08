import { useState, useEffect, useCallback, useRef } from 'react';
import type { DailyChallenge, ShapeType } from '../../types';
import { fetchChallengeRow, fetchChallengeRows, generateChallenge } from '../../lib/api';
import type { ChallengeRow } from '../../lib/api';
import { SHAPE_NAMES } from '../../utils/shapes/utils';

// =============================================================================
// Challenge Cache
// =============================================================================
// In-memory Map caches all fetched challenges for the session (clears on refresh).
// localStorage only persists TODAY's challenge (avoids unbounded storage growth).
// =============================================================================

const CACHE_KEY = 'challenge-today';

// In-memory cache (fast access, any date)
const challengeCache = new Map<string, DailyChallenge>();

// Track in-flight requests to avoid duplicate fetches
const pendingRequests = new Map<string, Promise<DailyChallenge>>();

function getTodayStr(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;
}

// Load today's challenge from localStorage on module init
function loadCacheFromStorage(): void {
  try {
    const stored = localStorage.getItem(CACHE_KEY);
    if (!stored) return;

    const challenge: DailyChallenge = JSON.parse(stored);

    // Only load if it's still today's challenge
    if (challenge.date === getTodayStr()) {
      challengeCache.set(challenge.date, challenge);
    } else {
      localStorage.removeItem(CACHE_KEY);
    }
  } catch {
    localStorage.removeItem(CACHE_KEY);
  }
}

// Persist only today's challenge to localStorage
function saveTodayToStorage(challenge: DailyChallenge): void {
  if (challenge.date !== getTodayStr()) return;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(challenge));
  } catch {
    // Storage full or unavailable — not critical
  }
}

// Add to in-memory cache + persist if today
function cacheChallenge(challenge: DailyChallenge): void {
  challengeCache.set(challenge.date, challenge);
  saveTodayToStorage(challenge);
}

// Initialize cache from storage
loadCacheFromStorage();

// Clean up old cache key from previous version
localStorage.removeItem('challenge-cache');

// =============================================================================
// Direct DB Access (fast, no edge function cold start)
// =============================================================================
// The challenges table has public SELECT RLS. Reading directly from the DB
// via PostgREST (~100ms) avoids the edge function cold start (~5-30s).
// The edge function is only needed to GENERATE a new challenge (once per day).
// =============================================================================

function rowToChallenge(row: ChallengeRow): DailyChallenge {
  const shape1Type = row.shape_1 as ShapeType;
  const shape2Type = row.shape_2 as ShapeType;

  return {
    date: row.challenge_date,
    colors: [row.color_1, row.color_2, row.color_3].filter(Boolean) as string[],
    shapes: [
      {
        type: shape1Type,
        name: SHAPE_NAMES[shape1Type] || shape1Type,
      },
      {
        type: shape2Type,
        name: SHAPE_NAMES[shape2Type] || shape2Type,
      },
    ],
    word: row.word,
  };
}

async function readChallengeFromDB(date: string): Promise<DailyChallenge | null> {
  const row = await fetchChallengeRow(date);
  return row ? rowToChallenge(row) : null;
}

async function readChallengesFromDB(dates: string[]): Promise<DailyChallenge[]> {
  const rows = await fetchChallengeRows(dates);
  return rows.map(rowToChallenge);
}

async function generateChallengeViaEdgeFunction(date: string): Promise<DailyChallenge> {
  const data = await generateChallenge(date);
  return {
    date: data.date,
    colors: data.colors,
    shapes: data.shapes,
    word: data.word,
  };
}

// =============================================================================
// Hook and Utilities
// =============================================================================

interface UseDailyChallengeReturn {
  challenge: DailyChallenge | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useDailyChallenge(date: string): UseDailyChallengeReturn {
  const [challenge, setChallenge] = useState<DailyChallenge | null>(() => {
    // Check cache first for instant display
    return challengeCache.get(date) || null;
  });
  const [loading, setLoading] = useState(!challengeCache.has(date));
  const [error, setError] = useState<Error | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchChallenge = useCallback(async () => {
    // Skip fetching if date is empty/invalid
    if (!date) {
      setChallenge(null);
      setLoading(false);
      return;
    }

    // Check cache
    if (challengeCache.has(date)) {
      setChallenge(challengeCache.get(date)!);
      setLoading(false);
      return;
    }

    // Check if there's already a pending request for this date
    const pending = pendingRequests.get(date);
    if (pending) {
      try {
        const result = await pending;
        setChallenge(result);
        setLoading(false);
        return;
      } catch {
        // Will be handled by the original request
      }
    }

    setLoading(true);
    setError(null);

    // Cancel any in-flight request
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();

    const fetchPromise = (async (): Promise<DailyChallenge> => {
      // Try direct DB read first (fast, ~100ms via PostgREST)
      const fromDB = await readChallengeFromDB(date);
      const base = fromDB ?? await generateChallengeViaEdgeFunction(date);

      // DEBUG: Override shapes/colors for testing (uncomment as needed)
      return {
        ...base,
        // shapes: [
        //   { type: 'fin', name: SHAPE_NAMES['fin'] },
        //   { type: 'hourglass', name: SHAPE_NAMES['hourglass'] },
        // ],
        // colors: ['hsl(270, 100%, 85%)', 'hsl(324, 100%, 44%)'],
      };
    })();

    pendingRequests.set(date, fetchPromise);

    try {
      const result = await fetchPromise;
      // Cache the result (with persistence)
      cacheChallenge(result);
      setChallenge(result);
    } catch (err) {
      console.error('Failed to fetch challenge:', err);
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      pendingRequests.delete(date);
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    fetchChallenge();
    return () => {
      abortControllerRef.current?.abort();
    };
  }, [fetchChallenge]);

  return {
    challenge,
    loading,
    error,
    refetch: fetchChallenge,
  };
}

// Batch fetch for Calendar - reads directly from DB, no edge function needed
export async function fetchChallengesBatch(
  dates: string[]
): Promise<Map<string, DailyChallenge>> {
  // Check cache for all dates first
  const uncachedDates = dates.filter((d) => !challengeCache.has(d));

  if (uncachedDates.length === 0) {
    // All cached - no network request needed
    const result = new Map<string, DailyChallenge>();
    for (const d of dates) {
      const cached = challengeCache.get(d);
      if (cached) result.set(d, cached);
    }
    return result;
  }

  // Read directly from DB (fast, ~100ms via PostgREST)
  const challenges = await readChallengesFromDB(uncachedDates);

  // Cache all fetched challenges (with persistence)
  for (const challenge of challenges) {
    cacheChallenge(challenge);
  }

  // Return all requested dates that have data
  const result = new Map<string, DailyChallenge>();
  for (const d of dates) {
    const cached = challengeCache.get(d);
    if (cached) result.set(d, cached);
  }
  return result;
}

// Simple sync getter for components that need immediate access
// Returns cached challenge or null if not cached
export function getChallengeSync(date: string): DailyChallenge | null {
  return challengeCache.get(date) || null;
}

// Prefetch a challenge (useful for preloading)
export async function prefetchChallenge(date: string): Promise<void> {
  if (challengeCache.has(date)) {
    return;
  }

  try {
    // Try direct DB read first
    const fromDB = await readChallengeFromDB(date);
    if (fromDB) {
      cacheChallenge(fromDB);
      return;
    }

    // Not in DB — generate via edge function
    const generated = await generateChallengeViaEdgeFunction(date);
    cacheChallenge(generated);
  } catch {
    // Silently fail prefetch
  }
}

// Clear the cache (useful for debugging or forced refresh)
export function clearChallengeCache(): void {
  challengeCache.clear();
  localStorage.removeItem(CACHE_KEY);
}
