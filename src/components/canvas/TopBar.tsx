import { useState } from 'react';
import type { ThemeMode, ThemeName } from '../../hooks/ui/useThemeState';
import type { Profile } from '../../hooks/auth/useProfile';
import { THEME_META, MODE_CYCLE, MODE_TITLE } from '../../constants/themes';
import { useAuth } from '../../hooks/auth/useAuth';
import { UserMenuDropdown } from './UserMenuDropdown';
import { Button } from '../shared/Button';
import { LoginPromptModal } from '../social/LoginPromptModal';
import { useIsDesktop } from '../../hooks/ui/useBreakpoint';

// --- Theme Pill (dark mode toggle + divider + theme buttons) ---

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function MonitorIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  );
}

function ThemePill({
  mode,
  onSetMode,
  theme,
  onSetTheme,
}: {
  mode: ThemeMode;
  onSetMode: (mode: ThemeMode) => void;
  theme: ThemeName;
  onSetTheme: (theme: ThemeName) => void;
}) {
  const cycleMode = () => onSetMode(MODE_CYCLE[mode]);
  const modeIcon = mode === 'light' ? <SunIcon /> : mode === 'dark' ? <MoonIcon /> : <MonitorIcon />;

  return (
    <div className="flex items-center gap-0 rounded-(--radius-pill) h-8 bg-(--color-card-bg)" style={{ border: 'var(--border-width, 2px) solid var(--color-border)', boxShadow: 'var(--shadow-btn)' }}>
      {/* Dark mode toggle */}
      <button
        className="flex items-center justify-center w-8 h-full rounded-l-(--radius-pill) transition-colors cursor-pointer text-(--color-text-secondary) hover:text-(--color-text-primary) hover:bg-(--color-hover)"
        onClick={cycleMode}
        title={MODE_TITLE[mode]}
      >
        {modeIcon}
      </button>

      {/* Divider */}
      <div className="w-px h-4 bg-(--color-border) mx-0.5" />

      {/* Theme buttons */}
      {THEME_META.map(({ key, label, accent }, i) => {
        const isActive = theme === key;
        const isLast = i === THEME_META.length - 1;
        return (
          <button
            key={key}
            className={`flex items-center justify-center gap-1.5 h-full px-2 text-[11px] font-bold tracking-wide transition-colors cursor-pointer ${
              isActive
                ? 'text-(--color-text-primary)'
                : 'text-(--color-text-tertiary) hover:text-(--color-text-primary) hover:bg-(--color-hover)'
            } ${isLast ? 'rounded-r-(--radius-pill)' : ''}`}
            onClick={() => onSetTheme(key)}
            title={`${label} theme`}
          >
            <span
              className="shrink-0 rounded-full transition-all duration-150"
              style={{
                width: isActive ? 10 : 8,
                height: isActive ? 10 : 8,
                backgroundColor: accent,
                boxShadow: isActive ? `0 0 0 2px var(--color-card-bg), 0 0 0 3.5px ${accent}` : 'none',
              }}
            />
            {label}
          </button>
        );
      })}
    </div>
  );
}

// --- Top Bar ---

interface TopBarProps {
  // Theme
  themeMode: ThemeMode;
  onSetThemeMode: (mode: ThemeMode) => void;
  themeName: ThemeName;
  onSetThemeName: (name: ThemeName) => void;
  // Center content
  centerContent?: React.ReactNode;
  // Right content (overrides default buttons)
  rightContent?: React.ReactNode;
  // Default right-side buttons (canvas editor mode)
  onReset?: () => void;
  onSave?: () => void;
  isSaving?: boolean;
  saveStatus?: 'idle' | 'saved' | 'error';
  hasSubmittedToday?: boolean;
  isLoggedIn?: boolean;
  profile?: Profile | null;
  profileLoading?: boolean;
}

export function TopBar({
  themeMode,
  onSetThemeMode,
  themeName,
  onSetThemeName,
  centerContent,
  rightContent,
  onReset,
  onSave,
  isSaving,
  saveStatus,
  hasSubmittedToday,
  isLoggedIn,
  profile,
  profileLoading,
}: TopBarProps) {
  return (
    <header className="h-14 flex items-center justify-between px-4 bg-(--color-card-bg) shrink-0 z-30 relative" style={{ borderBottom: 'var(--border-width, 2px) solid var(--color-border)', paddingLeft: 'max(1rem, env(safe-area-inset-left))', paddingRight: 'max(1rem, env(safe-area-inset-right))', paddingTop: 'env(safe-area-inset-top)' }}>
      {/* Left group: logo + theme pill */}
      <div className="flex items-center gap-2 md:gap-3 shrink-0">
        <a href="/" className="flex items-center gap-2 no-underline text-(--color-text-primary)">
          <span className="hidden md:inline text-base font-semibold">shapepaint.com</span>
        </a>

        <div className="hidden md:block">
          <ThemePill
            mode={themeMode}
            onSetMode={onSetThemeMode}
            theme={themeName}
            onSetTheme={onSetThemeName}
          />
        </div>
      </div>

      {/* Center group — absolute centered, hidden on mobile to prevent overlap */}
      {centerContent && (
        <div className="hidden md:block absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          {centerContent}
        </div>
      )}

      {/* Right group */}
      <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
        {rightContent ?? (
          <DefaultRightContent
            onReset={onReset}
            onSave={onSave}
            isSaving={isSaving}
            saveStatus={saveStatus}
            hasSubmittedToday={hasSubmittedToday}
            isLoggedIn={isLoggedIn}
            profile={profile}
            profileLoading={profileLoading}
            themeMode={themeMode}
            onSetThemeMode={onSetThemeMode}
            themeName={themeName}
            onSetThemeName={onSetThemeName}
          />
        )}
      </div>
    </header>
  );
}

// --- Default right-side content for canvas editor ---

function DefaultRightContent({
  onReset,
  onSave,
  isSaving,
  saveStatus,
  hasSubmittedToday,
  isLoggedIn,
  profile,
  profileLoading,
  themeMode,
  onSetThemeMode,
  themeName,
  onSetThemeName,
}: {
  onReset?: () => void;
  onSave?: () => void;
  isSaving?: boolean;
  saveStatus?: 'idle' | 'saved' | 'error';
  hasSubmittedToday?: boolean;
  isLoggedIn?: boolean;
  profile?: Profile | null;
  profileLoading?: boolean;
  themeMode: ThemeMode;
  onSetThemeMode: (mode: ThemeMode) => void;
  themeName: ThemeName;
  onSetThemeName: (name: ThemeName) => void;
}) {
  const { user, loading: authLoading, signInWithGoogle, signOut } = useAuth();
  const isDesktop = useIsDesktop();
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);

  const saveLabel = isSaving
    ? 'Saving...'
    : saveStatus === 'saved'
      ? 'Saved'
      : hasSubmittedToday
        ? 'Submitted'
        : 'Submit!';

  return (
    <>
      {/* Reset — icon-only on mobile */}
      {onReset && (
        <Button
          variant="secondary"
          className="hover:text-(--color-danger)"
          onClick={onReset}
          title="Reset canvas"
        >
          {isDesktop ? 'Reset' : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="1 4 1 10 7 10" />
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
            </svg>
          )}
        </Button>
      )}

      {/* Submit */}
      {onSave && isLoggedIn ? (
        <Button
          variant="primary"
          className="px-4 font-bold disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={onSave}
          disabled={isSaving || hasSubmittedToday}
          title={hasSubmittedToday ? 'Already submitted today' : 'Submit your creation'}
        >
          {saveLabel}
        </Button>
      ) : onSave ? (
        <>
          <Button
            variant="primary"
            className="px-4 font-bold"
            onClick={() => setShowLoginPrompt(true)}
            title="Sign in to submit"
          >
            Submit!
          </Button>
          {showLoginPrompt && (
            <LoginPromptModal
              onClose={() => setShowLoginPrompt(false)}
              title="Submit Your Creation"
              message="Sign in to submit your artwork and join today's challenge."
            />
          )}
        </>
      ) : null}

      {/* Divider + Gallery — hidden on mobile (available in UserMenuDropdown) */}
      <div className="hidden md:block w-px h-5 bg-(--color-border) mx-1" />
      <div className="hidden md:block">
        <Button as="a" variant="ghost" href="/?view=gallery">
          Gallery
        </Button>
      </div>

      {/* Login / User menu */}
      <UserMenuDropdown
        profile={profile ?? null}
        loading={!!(authLoading || profileLoading)}
        isLoggedIn={!!user}
        onSignIn={signInWithGoogle}
        onSignOut={signOut}
        themeMode={themeMode}
        onSetThemeMode={onSetThemeMode}
        themeName={themeName}
        onSetThemeName={onSetThemeName}
      />
    </>
  );
}

