import { useState, useRef, useCallback } from 'react';
import { navigate } from '../../lib/router';
import { AnimatePresence, motion } from 'motion/react';
import { Link } from '../shared/Link';
import type { Profile } from '../../hooks/auth/useProfile';
import type { ThemeMode, ThemeName } from '../../hooks/ui/useThemeState';
import { FollowsProvider } from '../../contexts/FollowsContext';
import { useFollows } from '../../hooks/social/useFollows';
import { useIsDesktop } from '../../hooks/ui/useBreakpoint';
import { useClickOutside } from '../../hooks/ui/useClickOutside';
import { THEME_NAMES, MODE_CYCLE, MODE_TITLE } from '../../constants/themes';
import { supabase } from '../../lib/supabase';
import { AvatarImage } from '../shared/AvatarImage';
import { Button } from '../shared/Button';
import { LoadingSpinner } from '../shared/LoadingSpinner';

interface UserMenuDropdownProps {
  profile: Profile | null;
  loading: boolean;
  isLoggedIn: boolean;
  onSignIn: () => void;
  onSignOut: () => void;
  themeMode?: ThemeMode;
  onSetThemeMode?: (mode: ThemeMode) => void;
  themeName?: ThemeName;
  onSetThemeName?: (name: ThemeName) => void;
}

export function UserMenuDropdown({ profile, loading, isLoggedIn, onSignIn, onSignOut, themeMode, onSetThemeMode, themeName, onSetThemeName }: UserMenuDropdownProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDesktop = useIsDesktop();

  useClickOutside(containerRef, open, () => setOpen(false));

  if (loading) {
    return <div className="h-8 px-3 flex items-center text-xs text-(--color-text-tertiary)">...</div>;
  }

  if (!isLoggedIn || !profile) {
    return (
      <Button variant="inverse" onClick={onSignIn}>
        Log in
      </Button>
    );
  }

  const initial = (profile.nickname || 'U')[0].toUpperCase();
  const displayName = profile.onboarding_complete ? profile.nickname : 'New user';

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger: avatar + name + chevron */}
      <Button
        variant="secondary"
        className="gap-2"
        onClick={() => setOpen(prev => !prev)}
      >
        <AvatarImage avatarUrl={profile.avatar_url} initial={initial} size="sm" />
        <span className="max-w-20 truncate">{displayName}</span>
        <svg
          width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </Button>

      {/* Dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            className="absolute top-full right-0 mt-2 w-[280px] max-w-[calc(100vw-2rem)] rounded-(--radius-md) overflow-hidden z-50"
            style={{
              background: 'var(--color-card-bg)',
              border: 'var(--border-width, 2px) solid var(--color-border)',
              boxShadow: 'var(--shadow-modal)',
            }}
          >
            <FollowsProvider>
              <UserMenuContent
                profile={profile}
                onSignOut={() => { setOpen(false); onSignOut(); }}
                onClose={() => setOpen(false)}
                isDesktop={isDesktop}
                themeMode={themeMode}
                onSetThemeMode={onSetThemeMode}
                themeName={themeName}
                onSetThemeName={onSetThemeName}
              />
            </FollowsProvider>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Dropdown content (requires FollowsProvider ancestor) ---

function UserMenuContent({
  profile,
  onSignOut,
  onClose,
  isDesktop,
  themeMode,
  onSetThemeMode,
  themeName,
  onSetThemeName,
}: {
  profile: Profile;
  onSignOut: () => void;
  onClose: () => void;
  isDesktop: boolean;
  themeMode?: ThemeMode;
  onSetThemeMode?: (mode: ThemeMode) => void;
  themeName?: ThemeName;
  onSetThemeName?: (name: ThemeName) => void;
}) {
  const { following, followers, followingCount, followersCount, loading, follow } = useFollows();
  const [activeTab, setActiveTab] = useState<'following' | 'followers'>('following');
  const [addNickname, setAddNickname] = useState('');
  const [addStatus, setAddStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [addError, setAddError] = useState('');

  const friends = activeTab === 'following' ? following : followers;

  const handleNavigateToProfile = useCallback((userId: string) => {
    onClose();
    navigate(`?view=profile&user=${userId}`);
  }, [onClose]);

  const handleAddByNickname = useCallback(async () => {
    const nickname = addNickname.trim();
    if (!nickname) return;

    setAddStatus('loading');
    setAddError('');

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, nickname')
        .ilike('nickname', nickname)
        .limit(1);

      if (error) throw error;
      if (!data || data.length === 0) {
        setAddStatus('error');
        setAddError('User not found');
        return;
      }

      const result = await follow(data[0].id);
      if (result.success) {
        setAddStatus('success');
        setAddNickname('');
        setTimeout(() => setAddStatus('idle'), 2000);
      } else {
        setAddStatus('error');
        setAddError(result.error || 'Failed to follow');
      }
    } catch {
      setAddStatus('error');
      setAddError('Something went wrong');
    }
  }, [addNickname, follow]);

  const initial = (profile.nickname || 'U')[0].toUpperCase();

  return (
    <div className="flex flex-col max-h-[420px]">
      {/* Header: large avatar + name + stats */}
      <div className="px-4 py-3 border-b border-(--color-border-light)">
        <div className="flex items-center gap-3">
          <AvatarImage avatarUrl={profile.avatar_url} initial={initial} size="lg" />
          <div className="min-w-0">
            <div className="text-base font-semibold text-(--color-text-primary) truncate">
              {profile.nickname || 'New user'}
            </div>
            <div className="text-xs text-(--color-text-secondary)">
              {loading ? '...' : `${followingCount} following · ${followersCount} followers`}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs: Following | Followers */}
      <div className="flex border-b border-(--color-border-light)">
        {(['following', 'followers'] as const).map(tab => (
          <button
            key={tab}
            className={`flex-1 px-3 py-2 text-xs font-medium transition-colors cursor-pointer relative ${
              activeTab === tab
                ? 'text-(--color-accent)'
                : 'text-(--color-text-secondary) hover:text-(--color-text-primary)'
            }`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'following' ? `Following (${followingCount})` : `Followers (${followersCount})`}
            {activeTab === tab && (
              <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-(--color-accent) rounded-(--radius-pill)" />
            )}
          </button>
        ))}
      </div>

      {/* Friend list (scrollable) */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {loading ? (
          <LoadingSpinner size="sm" inline />
        ) : friends.length === 0 ? (
          <div className="text-center py-6 text-xs text-(--color-text-secondary)">
            {activeTab === 'following' ? 'Not following anyone yet' : 'No followers yet'}
          </div>
        ) : (
          friends.map(friend => (
            <button
              key={friend.id}
              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-(--color-text-primary) hover:bg-(--color-hover) transition-colors cursor-pointer text-left"
              onClick={() => handleNavigateToProfile(friend.id)}
            >
              <div className="w-6 h-6 rounded-(--radius-pill) bg-(--color-accent)/20 text-(--color-accent) flex items-center justify-center text-xs font-semibold shrink-0 leading-none">
                {(friend.nickname || 'U')[0].toUpperCase()}
              </div>
              <span className="truncate">@{friend.nickname}</span>
            </button>
          ))
        )}
      </div>

      {/* Add by nickname */}
      <div className="px-3 py-2 border-t border-(--color-border-light)">
        <div className="flex gap-2">
          <input
            type="text"
            value={addNickname}
            onChange={e => { setAddNickname(e.target.value); setAddStatus('idle'); }}
            onKeyDown={e => { if (e.key === 'Enter') handleAddByNickname(); }}
            placeholder="Add by nickname..."
            className="flex-1 min-w-0 px-2 py-1.5 text-xs bg-(--color-bg-secondary) border border-(--color-border) rounded-(--radius-sm) text-(--color-text-primary) placeholder:text-(--color-text-secondary) focus:outline-none focus:ring-1 focus:ring-(--color-accent)"
          />
          <button
            onClick={handleAddByNickname}
            disabled={!addNickname.trim() || addStatus === 'loading'}
            className="px-3 py-1.5 text-xs font-medium rounded-(--radius-sm) bg-(--color-accent) text-(--color-accent-text) hover:bg-(--color-accent-hover) disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            {addStatus === 'loading' ? '...' : 'Add'}
          </button>
        </div>
        {addStatus === 'success' && (
          <div className="text-xs text-(--color-accent) mt-1">Followed!</div>
        )}
        {addStatus === 'error' && (
          <div className="text-xs text-(--color-danger) mt-1">{addError}</div>
        )}
      </div>

      {/* Mobile-only: Gallery link + theme switcher */}
      {!isDesktop && (
        <div className="px-3 py-2 border-t border-(--color-border-light) flex flex-col gap-2">
          <Link
            href="/?view=gallery"
            onClick={onClose}
            className="flex items-center gap-2 px-2 py-1.5 text-xs font-medium text-(--color-text-secondary) hover:text-(--color-text-primary) hover:bg-(--color-hover) rounded-(--radius-sm) transition-colors no-underline"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
            </svg>
            Gallery
          </Link>
          {themeMode !== undefined && onSetThemeMode && themeName && onSetThemeName && (
            <div className="flex items-center gap-1 px-2">
              <button
                className="flex items-center justify-center w-7 h-7 rounded-(--radius-sm) transition-colors text-(--color-text-secondary) hover:text-(--color-text-primary) hover:bg-(--color-hover) cursor-pointer"
                onClick={() => onSetThemeMode(MODE_CYCLE[themeMode])}
                title={MODE_TITLE[themeMode]}
              >
                {themeMode === 'light'
                  ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" /></svg>
                  : themeMode === 'dark'
                  ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
                  : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>
                }
              </button>
              <div className="w-px h-4 bg-(--color-border) mx-0.5" />
              {THEME_NAMES.map((t) => (
                <button
                  key={t}
                  className={`flex items-center justify-center w-7 h-7 text-xs font-bold uppercase transition-colors rounded-(--radius-sm) cursor-pointer ${
                    themeName === t
                      ? 'bg-(--color-accent) text-(--color-accent-text)'
                      : 'text-(--color-text-secondary) hover:text-(--color-text-primary) hover:bg-(--color-hover)'
                  }`}
                  onClick={() => onSetThemeName(t)}
                  title={`Theme ${t.toUpperCase()}`}
                >
                  {t.toUpperCase()}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Log out */}
      <div className="px-3 py-2 border-t border-(--color-border-light)">
        <button
          onClick={onSignOut}
          className="w-full flex items-center gap-2 px-2 py-1.5 text-xs font-medium text-(--color-text-secondary) hover:text-(--color-danger) hover:bg-(--color-hover) rounded-(--radius-sm) transition-colors cursor-pointer"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Log out
        </button>
      </div>
    </div>
  );
}
