import type { ThemeMode, ThemeName } from '../../hooks/ui/useThemeState';
import { useAuthContext } from '../../contexts/AuthContext';
import { useHeaderConfig } from '../../contexts/HeaderContext';
import { UserMenuDropdown } from './UserMenuDropdown';
import { ThemePill, CollapsedThemePill } from './ThemePill';
import { Link } from '../shared/Link';
import { useIsDesktop, useBreakpoint } from '../../hooks/ui/useBreakpoint';

// --- Top Bar ---

interface TopBarProps {
  themeMode: ThemeMode;
  onSetThemeMode: (mode: ThemeMode) => void;
  themeName: ThemeName;
  onSetThemeName: (name: ThemeName) => void;
}

const headerStyle = {
  borderBottom: 'var(--border-width, 2px) solid var(--color-border)',
  paddingLeft: 'max(1rem, env(safe-area-inset-left))',
  paddingRight: 'max(1rem, env(safe-area-inset-right))',
  paddingTop: 'env(safe-area-inset-top)',
};

export function TopBar({
  themeMode,
  onSetThemeMode,
  themeName,
  onSetThemeName,
}: TopBarProps) {
  const { user, loading: authLoading, profile, profileLoading, signInWithGoogle, signOut } = useAuthContext();
  const { centerContent, rightContent } = useHeaderConfig();
  const isSingleRow = useBreakpoint(520);   // single-row header (>=520)
  const isDesktop = useIsDesktop();          // show logo + pill (>=768)
  const isWide = useBreakpoint(1200);        // full theme pill (>=1200)

  const userMenu = (
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
  );

  const rightGroup = (
    <>
      {rightContent}
      {userMenu}
    </>
  );

  // Narrow mobile (<520px): two-row layout when centerContent exists
  if (!isSingleRow) {
    return (
      <header className="flex flex-col bg-(--color-card-bg) shrink-0 z-30 relative" style={headerStyle}>
        {centerContent && (
          <div className="flex items-center justify-center py-1.5 px-4" style={{ borderBottom: 'var(--border-width, 2px) solid var(--color-border-light)' }}>
            {centerContent}
          </div>
        )}
        <div className="h-12 flex items-center justify-end px-4 gap-1.5">
          {rightGroup}
        </div>
      </header>
    );
  }

  // Single-row layout (>=520px)
  return (
    <header className="h-14 flex items-center bg-(--color-card-bg) shrink-0 z-30 relative" style={headerStyle}>
      {/* Left group: logo + theme pill (desktop only) */}
      {isDesktop && (
        <div className="flex items-center gap-3 shrink-0">
          <Link href="/" className="flex items-center gap-2 no-underline text-(--color-text-primary)">
            <span className="text-base font-semibold">shapepaint.com</span>
          </Link>
          {isWide ? (
            <ThemePill
              mode={themeMode}
              onSetMode={onSetThemeMode}
              theme={themeName}
              onSetTheme={onSetThemeName}
            />
          ) : (
            <CollapsedThemePill
              mode={themeMode}
              onSetMode={onSetThemeMode}
              theme={themeName}
              onSetTheme={onSetThemeName}
            />
          )}
        </div>
      )}

      {/* Center group — flex-based centering */}
      {centerContent && (
        <div className="flex-1 flex justify-center items-end min-w-0 px-4 overflow-x-clip self-stretch pb-3">
          {centerContent}
        </div>
      )}

      {/* Spacer when no center content */}
      {!centerContent && <div className="flex-1" />}

      {/* Right group */}
      <div className="flex items-center gap-2 shrink-0">
        {rightGroup}
      </div>
    </header>
  );
}
