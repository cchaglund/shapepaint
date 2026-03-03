import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';

export interface Profile {
  id: string;
  nickname: string;
  avatar_url: string | null;
  onboarding_complete: boolean;
  created_at: string;
}

export function useProfile(userId: string | undefined) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    if (!userId) {
      setProfile(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    let { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      setError(error.message);
      setProfile(null);
    } else {
      if (data.avatar_url?.includes('googleusercontent.com')) {
        const { cacheGoogleAvatar } = await import('../../lib/avatarCache');
        const cachedUrl = await cacheGoogleAvatar(supabase, userId, data.avatar_url);
        if (cachedUrl) {
          await supabase.from('profiles').update({ avatar_url: cachedUrl }).eq('id', userId);
          data = { ...data, avatar_url: cachedUrl };
        }
      }
      setProfile(data);
      setError(null);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Async data fetching is legitimate
    fetchProfile();
  }, [fetchProfile]);

  const updateNickname = async (nickname: string): Promise<{ success: boolean; error?: string }> => {
    if (!userId) return { success: false, error: 'Not authenticated' };

    // Client-side validation
    if (nickname.length < 1 || nickname.length > 15) {
      return { success: false, error: 'Nickname must be 1-15 characters' };
    }
    if (!/^[a-zA-Z0-9]+$/.test(nickname)) {
      return { success: false, error: 'Nickname can only contain letters and numbers' };
    }

    const { error } = await supabase
      .from('profiles')
      .update({ nickname, onboarding_complete: true })
      .eq('id', userId);

    if (error) {
      // Handle unique constraint violation
      if (error.code === '23505') {
        return { success: false, error: 'This nickname is already taken' };
      }
      return { success: false, error: error.message };
    }

    // Refetch profile to get updated data
    await fetchProfile();
    return { success: true };
  };

  return { profile, loading, error, updateNickname, refetchProfile: fetchProfile };
}
