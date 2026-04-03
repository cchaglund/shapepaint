import { useState, useEffect, useRef } from 'react';
import type { Submission } from './useSubmissions';
import type { User } from '@supabase/supabase-js';
import { fetchSubmissionById, fetchRankTotal } from '../../lib/api';

interface UseSubmissionDetailOptions {
  date?: string;
  submissionId?: string;
  user: User | null;
  loadSubmission: (date: string) => Promise<{ data: Submission | null; error?: string }>;
  fetchSubmissionRank: (submissionId: string) => Promise<{ rank: number; total: number } | null>;
  getAdjacentSubmissionDates: (date: string) => Promise<{ prev: string | null; next: string | null }>;
}

export function useSubmissionDetail({
  date,
  submissionId,
  user,
  loadSubmission,
  fetchSubmissionRank,
  getAdjacentSubmissionDates,
}: UseSubmissionDetailOptions) {
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [loading, setLoading] = useState(true);
  const [rankInfo, setRankInfo] = useState<{ rank: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adjacentDates, setAdjacentDates] = useState<{ prev: string | null; next: string | null }>({ prev: null, next: null });
  const [nickname, setNickname] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const loadedForRef = useRef<string | null>(null);

  useEffect(() => {
    const loadKey = submissionId || (date && user?.id ? `${date}-${user.id}` : null);

    if (!loadKey || loadedForRef.current === loadKey) return;

    loadedForRef.current = loadKey;

    const loadData = async () => {
      setLoading(true);
      setError(null);

      try {
        if (submissionId) {
          const data = await fetchSubmissionById(submissionId);

          if (!data) {
            setError('Submission not found');
            loadedForRef.current = null;
          } else {
            setSubmission(data as unknown as Submission);

            // Extract profile data from join
            setNickname(data.profiles?.nickname ?? null);
            setAvatarUrl(data.profiles?.avatar_url ?? null);

            // Extract rank from joined daily_rankings data, fetch total count separately
            const rankings = data.daily_rankings;
            const ranking = Array.isArray(rankings) ? rankings[0] : rankings;
            if (ranking?.final_rank && ranking?.challenge_date) {
              const total = await fetchRankTotal(ranking.challenge_date);
              setRankInfo({ rank: ranking.final_rank, total });
            }
          }
        } else if (date && user) {
          const { data: submissionData, error: fetchError } = await loadSubmission(date);
          if (fetchError) {
            setError(fetchError);
            loadedForRef.current = null;
          } else {
            setSubmission(submissionData);
            if (submissionData?.id) {
              const info = await fetchSubmissionRank(submissionData.id);
              setRankInfo(info);
            }
          }
          const adjacent = await getAdjacentSubmissionDates(date);
          setAdjacentDates(adjacent);
        } else if (date && !user) {
          setError('Please sign in to view this submission.');
        }
      } catch (err: unknown) {
        console.error('Error loading submission:', err);
        setError('Failed to load submission');
        loadedForRef.current = null;
      }

      setLoading(false);
    };

    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submissionId, date, user?.id]);

  return {
    submission,
    loading,
    rankInfo,
    error,
    adjacentDates,
    nickname,
    avatarUrl,
  };
}
