import logoSvg from '../../assets/logo.svg';
import type { ThemeMode, ThemeName } from '../../hooks/ui/useThemeState';
import type { Profile } from '../../hooks/auth/useProfile';
import { useAuth } from '../../hooks/auth/useAuth';
import { UserMenuDropdown } from './UserMenuDropdown';
import { Button } from '../shared/Button';
import { useIsDesktop } from '../../hooks/ui/useBreakpoint';

// --- Theme Pill (dark mode toggle + divider + A/B/C/D) ---

const THEMES: ThemeName[] = ['a', 'b', 'c'];

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
  // Resolve effective mode for icon display
  const isDark = mode === 'dark' || (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  const toggleDarkMode = () => {
    if (isDark) {
      onSetMode('light');
    } else {
      onSetMode('dark');
    }
  };

  return (
    <div className="flex items-center gap-0 rounded-(--radius-pill) h-8 bg-(--color-card-bg)" style={{ border: 'var(--border-width, 2px) solid var(--color-border)', boxShadow: 'var(--shadow-btn)' }}>
      {/* Dark mode toggle */}
      <button
        className="flex items-center justify-center w-8 h-full rounded-l-(--radius-pill) transition-colors cursor-pointer text-(--color-text-secondary) hover:text-(--color-text-primary) hover:bg-(--color-hover)"
        onClick={toggleDarkMode}
        title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {isDark ? <SunIcon /> : <MoonIcon />}
      </button>

      {/* Divider */}
      <div className="w-px h-4 bg-(--color-border)" />

      {/* Theme buttons A/B/C/D */}
      {THEMES.map((t) => (
        <button
          key={t}
          className={`flex items-center justify-center w-7 h-full text-xs font-bold uppercase transition-colors cursor-pointer ${
            theme === t
              ? 'bg-(--color-accent) text-(--color-accent-text)'
              : 'text-(--color-text-secondary) hover:text-(--color-text-primary) hover:bg-(--color-hover)'
          } ${t === 'd' ? 'rounded-r-(--radius-pill)' : ''}`}
          onClick={() => onSetTheme(t)}
          title={`Theme ${t.toUpperCase()}`}
        >
          {t.toUpperCase()}
        </button>
      ))}
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
          <img src={logoSvg} alt="" width="24" height="24" />
          <span className="hidden md:inline text-base font-semibold">2colors</span>
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
        <Button
          variant="primary"
          className="px-4 font-bold"
          onClick={onSave}
          title="Sign in to submit"
        >
          Submit!
        </Button>
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

// --- Center content for canvas editor ---

export function InspirationCenter({ word }: { word: string }) {
  return (
    <div className="flex flex-col items-center leading-tight min-w-0">
      <span className="hidden md:block text-xs uppercase tracking-widest text-(--color-accent)">Today&apos;s Inspiration</span>
      <span className="text-sm md:text-xl font-semibold text-(--color-text-primary) capitalize font-display truncate max-w-full">{word}</span>
    </div>
  );
}
