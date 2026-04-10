import { useState, useCallback } from 'react';
import type { Shape, ShapeGroup, DailyChallenge } from '../../types';
import type { User } from '@supabase/supabase-js';

interface UseSaveSubmissionOptions {
  challenge: DailyChallenge | null;
  shapes: Shape[];
  groups: ShapeGroup[];
  backgroundColorIndex: number | null;
  user: User | null;
  saveSubmission: (params: {
    challengeDate: string;
    shapes: Shape[];
    groups: ShapeGroup[];
    backgroundColorIndex: number | null;
    colors?: string[];
  }) => Promise<{ success: boolean; error?: string }>;
  onSaveSuccess?: () => void;
}

/**
 * Hook for managing save submission logic with status management
 */
export function useSaveSubmission({
  challenge,
  shapes,
  groups,
  backgroundColorIndex,
  user,
  saveSubmission,
  onSaveSuccess,
}: UseSaveSubmissionOptions) {
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleSave = useCallback(async () => {
    if (!challenge) {
      console.error('[handleSave] No challenge data available');
      return;
    }
    setSaveStatus('idle');
    setSaveError(null);
    const result = await saveSubmission({
      challengeDate: challenge.date,
      shapes,
      groups,
      backgroundColorIndex,
      colors: challenge.colors,
    });
    if (result.success) {
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
      if (user) {
        onSaveSuccess?.();
      }
    } else {
      console.error('[handleSave] Save failed:', result.error);
      setSaveStatus('error');
      setSaveError(result.error ?? 'Something went wrong');
      setTimeout(() => {
        setSaveStatus('idle');
        setSaveError(null);
      }, 4000);
    }
  }, [saveSubmission, challenge, shapes, groups, backgroundColorIndex, user, onSaveSuccess]);

  return {
    saveStatus,
    saveError,
    handleSave,
  };
}
