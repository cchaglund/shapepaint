import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { fetchProfile as apiFetchProfile, updateProfileFields, invalidateNicknameCache } from '../lib/api';
import type { Profile } from '../hooks/auth/useProfile';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  profile: Profile | null;
  profileLoading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<{ error: unknown }>;
  signOut: () => Promise<void>;
  updateNickname: (nickname: string) => Promise<{ success: boolean; error?: string }>;
  refetchProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  // --- Auth ---
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // --- Profile ---
  const fetchProfile = useCallback(async (userId: string | undefined) => {
    if (!userId) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }

    setProfileLoading(true);
    try {
      let data = await apiFetchProfile(userId);

      if (data.avatar_url?.includes('googleusercontent.com')) {
        const { cacheGoogleAvatar } = await import('../lib/avatarCache');
        const cachedUrl = await cacheGoogleAvatar(supabase, userId, data.avatar_url);
        if (cachedUrl) {
          await updateProfileFields(userId, { avatar_url: cachedUrl });
          data = { ...data, avatar_url: cachedUrl };
        }
      }
      setProfile(data);
    } catch {
      setProfile(null);
    }
    setProfileLoading(false);
  }, []);

  // Fetch profile when user changes
  useEffect(() => {
    if (loading) return; // wait for auth to resolve first
    fetchProfile(user?.id);
  }, [user?.id, loading, fetchProfile]);

  const refetchProfile = useCallback(async () => {
    await fetchProfile(user?.id);
  }, [fetchProfile, user?.id]);

  // --- Auth actions ---
  const signInWithGoogle = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (error) console.error('Login error:', error);
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) console.error('Login error:', error);
    return { error };
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) console.error('Logout error:', error);
  }, []);

  // --- Nickname update ---
  const updateNickname = useCallback(async (nickname: string): Promise<{ success: boolean; error?: string }> => {
    if (!user?.id) return { success: false, error: 'Not authenticated' };

    if (nickname.length < 1 || nickname.length > 15) {
      return { success: false, error: 'Nickname must be 1-15 characters' };
    }
    if (!/^[a-zA-Z0-9]+$/.test(nickname)) {
      return { success: false, error: 'Nickname can only contain letters and numbers' };
    }

    try {
      await updateProfileFields(user.id, { nickname, onboarding_complete: true });
      invalidateNicknameCache(user.id);
    } catch (err) {
      const pgError = err as { code?: string; message?: string };
      if (pgError.code === '23505') {
        return { success: false, error: 'This nickname is already taken' };
      }
      return { success: false, error: pgError.message ?? 'Failed to update nickname' };
    }

    await fetchProfile(user.id);
    return { success: true };
  }, [user?.id, fetchProfile]);

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      profile,
      profileLoading,
      signInWithGoogle,
      signInWithEmail,
      signOut,
      updateNickname,
      refetchProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

// Hook exported from this file for co-location; re-exported via barrel if needed
// eslint-disable-next-line react-refresh/only-export-components
export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext must be used within AuthProvider');
  return ctx;
}
