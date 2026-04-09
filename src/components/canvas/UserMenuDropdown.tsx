import { useState, useRef, useCallback } from 'react';
import { ChevronDown, LayoutGrid, Sun, Moon, Monitor, LogOut, Trash2 } from 'lucide-react';
import { findProfileByNickname } from '../../lib/api';
import { navigate } from '../../lib/router';
import { AnimatePresence, motion } from 'motion/react';
import { Link, AvatarImage, Button, LoadingSpinner } from '../shared';
import { FollowButton } from '../social/FollowButton';
import { NotificationsTab } from '../notifications/NotificationsTab';
import { DeleteAccountModal } from '../modals/DeleteAccountModal';
import type { Profile } from '../../hooks/auth/useProfile';
import type { ThemeMode, ThemeName } from '../../hooks/ui/useThemeState';
import { FollowsProvider } from '../../contexts/FollowsContext';
import { useFollows } from '../../hooks/social/useFollows';
import { useAuthContext } from '../../contexts/AuthContext';
import { useNotificationsContext } from '../../contexts/NotificationsContext';
import { useBreakpoint } from '../../hooks/ui/useBreakpoint';
import { useClickOutside } from '../../hooks/ui/useClickOutside';
import { THEME_NAMES, MODE_CYCLE, MODE_TITLE } from '../../constants/themes';

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
  const showGalleryInHeader = useBreakpoint(900);
  const { unreadCount } = useNotificationsContext();

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
        <div className="relative">
          <AvatarImage avatarUrl={profile.avatar_url} initial={initial} size="sm" />
          {unreadCount > 0 && (
            <span
              className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-(--color-accent) border-2 border-(--color-bg-secondary)"
              aria-label={`${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}`}
            />
          )}
        </div>
        <span className="max-w-20 truncate">{displayName}</span>
        <ChevronDown
          size={12}
          className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </Button>

      {/* Dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            className="absolute top-full right-0 mt-2 w-85 max-w-[calc(100vw-2rem)] rounded-(--radius-md) overflow-hidden z-50"
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
                showGalleryInHeader={showGalleryInHeader}
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
  showGalleryInHeader,
  themeMode,
  onSetThemeMode,
  themeName,
  onSetThemeName,
}: {
  profile: Profile;
  onSignOut: () => void;
  onClose: () => void;
  showGalleryInHeader: boolean;
  themeMode?: ThemeMode;
  onSetThemeMode?: (mode: ThemeMode) => void;
  themeName?: ThemeName;
  onSetThemeName?: (name: ThemeName) => void;
}) {
  const { following, followers, followingCount, followersCount, loading, follow, isFollowing } = useFollows();
  const { deleteAccount } = useAuthContext();
  const { unreadCount } = useNotificationsContext();
  const [activeTab, setActiveTab] = useState<'notifications' | 'following' | 'followers'>(
    unreadCount > 0 ? 'notifications' : 'following'
  );
  const [addNickname, setAddNickname] = useState('');
  const [addStatus, setAddStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [addError, setAddError] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);

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
      const profile = await findProfileByNickname(nickname);
      if (!profile) {
        setAddStatus('error');
        setAddError('User not found');
        return;
      }

      const result = await follow(profile.id);
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
    <div className="flex flex-col max-h-105">
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

      {/* Tabs: Notifications | Following | Followers */}
      <div className="flex border-b border-(--color-border-light)">
        {([
          { key: 'notifications' as const, label: 'Notifications', count: unreadCount || undefined },
          { key: 'following' as const, label: 'Following', count: followingCount || undefined },
          { key: 'followers' as const, label: 'Followers', count: followersCount || undefined },
        ]).map(tab => (
          <button
            key={tab.key}
            className={`flex-1 py-2 text-xs font-medium transition-colors cursor-pointer relative ${
              activeTab === tab.key
                ? 'text-(--color-accent)'
                : 'text-(--color-text-secondary) hover:text-(--color-text-primary)'
            }`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}{tab.count !== undefined && <span className="text-[10px] opacity-70"> ({tab.count})</span>}
            {activeTab === tab.key && (
              <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-(--color-accent) rounded-(--radius-pill)" />
            )}
          </button>
        ))}
      </div>

      {activeTab === 'notifications' ? (
        <NotificationsTab onClose={onClose} />
      ) : (
        <>
          {/* Friend list (scrollable) */}
          <div className="flex-1 overflow-y-auto min-h-0 pb-1">
            {loading ? (
              <LoadingSpinner size="sm" inline />
            ) : friends.length === 0 ? (
              <div className="text-center py-6 text-xs text-(--color-text-secondary)">
                {activeTab === 'following' ? 'Not following anyone yet' : 'No followers yet'}
              </div>
            ) : (
              friends.map(friend => (
                <div
                  key={friend.id}
                  className="group w-full flex items-center gap-2 px-4 py-2 text-sm text-(--color-text-primary) hover:bg-(--color-hover) transition-colors"
                >
                  <button
                    className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer text-left"
                    onClick={() => handleNavigateToProfile(friend.id)}
                  >
                    <AvatarImage avatarUrl={friend.avatar_url} initial={(friend.nickname || 'U')[0].toUpperCase()} size="md" />
                    <span className="truncate">@{friend.nickname}</span>
                  </button>
                  {activeTab === 'following' && (
                    <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                      <FollowButton targetUserId={friend.id} />
                    </div>
                  )}
                  {activeTab === 'followers' && !isFollowing(friend.id) && (
                    <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                      <FollowButton targetUserId={friend.id} />
                    </div>
                  )}
                </div>
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
        </>
      )}

      {/* Gallery link (when header button hidden) + theme switcher (mobile) */}
      {!showGalleryInHeader && (
        <div className="px-3 py-2 border-t border-(--color-border-light) flex flex-col gap-2">
          <Link
            href="/?view=gallery"
            onClick={onClose}
            className="flex items-center gap-2 px-2 py-1.5 text-xs font-medium text-(--color-text-secondary) hover:text-(--color-text-primary) hover:bg-(--color-hover) rounded-(--radius-sm) transition-colors no-underline"
          >
            <LayoutGrid size={14} />
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
                  ? <Sun size={14} />
                  : themeMode === 'dark'
                  ? <Moon size={14} />
                  : <Monitor size={14} />
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

      {/* Log out + Delete account */}
      <div className="px-3 py-2 border-t border-(--color-border-light) flex items-center gap-1">
        <button
          onClick={onSignOut}
          className="flex-1 flex items-center gap-2 px-2 py-1.5 text-xs font-medium text-(--color-text-secondary) hover:text-(--color-danger) hover:bg-(--color-hover) rounded-(--radius-sm) transition-colors cursor-pointer"
        >
          <LogOut size={14} />
          Log out
        </button>
        <button
          onClick={() => setShowDeleteModal(true)}
          className="flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-(--color-text-tertiary) hover:text-(--color-danger) hover:bg-(--color-hover) rounded-(--radius-sm) transition-colors cursor-pointer"
          title="Delete account"
        >
          <Trash2 size={14} />
          Delete account
        </button>
      </div>

      {showDeleteModal && (
        <DeleteAccountModal
          nickname={profile.nickname || ''}
          onConfirm={deleteAccount}
          onCancel={() => setShowDeleteModal(false)}
        />
      )}
    </div>
  );
}
