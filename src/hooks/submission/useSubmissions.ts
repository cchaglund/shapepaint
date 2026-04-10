import { useState, useCallback, useEffect, useRef } from 'react';
import {
  checkSubmissionExists,
  upsertSubmission,
  fetchSubmission,
  fetchUserSubmissions,
  fetchUserSubmissionsByMonth,
  fetchAdjacentSubmissionDates,
  type SubmissionRow,
} from '../../lib/api';
import { MAX_SHAPES } from '../../utils/shapeLimit';
import type { Shape, ShapeGroup } from '../../types';

export type Submission = SubmissionRow;

interface SaveSubmissionParams {
  challengeDate: string;
  shapes: Shape[];
  groups: ShapeGroup[];
  backgroundColorIndex: number | null;
  colors?: string[];
}

export function useSubmissions(userId: string | undefined, todayDate?: string) {
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasSubmittedToday, setHasSubmittedToday] = useState(false);
  const [hasCheckedSubmission, setHasCheckedSubmission] = useState(false);

  useEffect(() => {
    if (!userId || !todayDate) {
      return;
    }

    let cancelled = false;
    const check = async () => {
      const exists = await checkSubmissionExists(userId, todayDate);
      if (!cancelled) {
        setHasSubmittedToday(exists);
        setHasCheckedSubmission(true);
      }
    };

    setHasCheckedSubmission(false); // eslint-disable-line react-hooks/set-state-in-effect -- intentional reset before async check
    check();
    return () => { cancelled = true; };
  }, [userId, todayDate]);

  const mySubmissionsCache = useRef<{ userId: string; data: Submission[] } | null>(null);
  const monthCache = useRef<Map<string, Submission[]>>(new Map());

  const saveSubmission = useCallback(
    async (params: SaveSubmissionParams): Promise<{ success: boolean; error?: string }> => {
      if (!userId) {
        console.error('[saveSubmission] No userId — user session may have expired');
        return { success: false, error: 'Not authenticated — try refreshing the page' };
      }

      if (params.shapes.length > MAX_SHAPES) {
        console.error(`[saveSubmission] Shape limit exceeded: ${params.shapes.length}/${MAX_SHAPES}`);
        return { success: false, error: `Maximum ${MAX_SHAPES} shapes per canvas` };
      }

      setSaving(true);
      try {
        await upsertSubmission({
          userId,
          challengeDate: params.challengeDate,
          shapes: params.shapes,
          groups: params.groups,
          backgroundColorIndex: params.backgroundColorIndex,
          colors: params.colors,
        });
        setSaving(false);
        setHasSubmittedToday(true);
        mySubmissionsCache.current = null;
        monthCache.current.clear();
        return { success: true };
      } catch (err: unknown) {
        setSaving(false);
        const message = err instanceof Error ? err.message
          : typeof err === 'object' && err !== null && 'message' in err ? String((err as { message: unknown }).message)
          : 'Unknown error';
        console.error('[saveSubmission] Upsert failed:', err);
        return { success: false, error: message };
      }
    },
    [userId]
  );

  const loadSubmission = useCallback(
    async (challengeDate: string): Promise<{ data: Submission | null; error?: string }> => {
      if (!userId) return { data: null, error: 'Not authenticated' };

      setLoading(true);
      try {
        const data = await fetchSubmission(userId, challengeDate);
        setLoading(false);
        return { data };
      } catch (err) {
        setLoading(false);
        return { data: null, error: err instanceof Error ? err.message : 'Unknown error' };
      }
    },
    [userId]
  );

  const loadMySubmissions = useCallback(async (): Promise<{
    data: Submission[];
    error?: string;
  }> => {
    if (!userId) return { data: [], error: 'Not authenticated' };

    if (mySubmissionsCache.current && mySubmissionsCache.current.userId === userId) {
      return { data: mySubmissionsCache.current.data };
    }

    setLoading(true);
    try {
      const submissions = await fetchUserSubmissions(userId);
      setLoading(false);
      mySubmissionsCache.current = { userId, data: submissions };
      return { data: submissions };
    } catch (err) {
      setLoading(false);
      return { data: [], error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }, [userId]);

  const loadSubmissionsForMonth = useCallback(async (
    monthStart: string,
    monthEnd: string
  ): Promise<{ data: Submission[]; error?: string }> => {
    if (!userId) return { data: [], error: 'Not authenticated' };

    const cacheKey = `${userId}-${monthStart}`;
    const cached = monthCache.current.get(cacheKey);
    if (cached) return { data: cached };

    setLoading(true);
    try {
      const submissions = await fetchUserSubmissionsByMonth(userId, monthStart, monthEnd);
      setLoading(false);
      monthCache.current.set(cacheKey, submissions);
      return { data: submissions };
    } catch (err) {
      setLoading(false);
      return { data: [], error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }, [userId]);

  const getAdjacentSubmissionDates = useCallback(
    async (
      currentDate: string
    ): Promise<{ prev: string | null; next: string | null }> => {
      if (!userId) return { prev: null, next: null };
      return fetchAdjacentSubmissionDates(userId, currentDate);
    },
    [userId]
  );

  return {
    saveSubmission,
    loadSubmission,
    loadMySubmissions,
    loadSubmissionsForMonth,
    getAdjacentSubmissionDates,
    saving,
    loading,
    hasSubmittedToday,
    hasCheckedSubmission,
  };
}
