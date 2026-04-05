import { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import type { ThemeMode, ThemeName } from '../../hooks/ui/useThemeState';
import type { Profile } from '../../hooks/auth/useProfile';
import { useProfile } from '../../hooks/auth/useProfile';
import { useAuth } from '../../hooks/auth/useAuth';
import { UserMenuDropdown } from './UserMenuDropdown';
import { ThemePill, CollapsedThemePill } from './ThemePill';
import { Button } from '../shared/Button';
import { Link } from '../shared/Link';
import { MAX_SHAPES } from '../../utils/shapeLimit';
import { LoginPromptModal } from '../social/LoginPromptModal';
import { useIsDesktop, useBreakpoint } from '../../hooks/ui/useBreakpoint';

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
  saveError?: string | null;
  hasSubmittedToday?: boolean;
  isLoggedIn?: boolean;
  profile?: Profile | null;
  profileLoading?: boolean;
  shapeCount?: number;
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
  centerContent,
  rightContent,
  onReset,
  onSave,
  isSaving,
  saveStatus,
  saveError,
  hasSubmittedToday,
  isLoggedIn,
  profile: profileProp,
  profileLoading: profileLoadingProp,
  shapeCount,
}: TopBarProps) {
  const { user, loading: authLoading, signInWithGoogle, signOut } = useAuth();
  const { profile: ownProfile, loading: ownProfileLoading } = useProfile(user?.id);
  const isSingleRow = useBreakpoint(520);   // single-row header (>=520)
  const isDesktop = useIsDesktop();          // show logo + pill (>=768)
  const showGallery = useBreakpoint(900);    // gallery button in header (>=900)
  const isWide = useBreakpoint(1200);        // full theme pill (>=1200)

  // Use props if provided (canvas page passes these), otherwise use own hooks
  const profile = profileProp !== undefined ? profileProp : ownProfile;
  const profileLoading = profileLoadingProp !== undefined ? profileLoadingProp : ownProfileLoading;

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
      {rightContent ?? (
        <DefaultRightContent
          onReset={onReset}
          onSave={onSave}
          isSaving={isSaving}
          saveStatus={saveStatus}
          saveError={saveError}
          hasSubmittedToday={hasSubmittedToday}
          isLoggedIn={isLoggedIn}
          showGallery={showGallery}
          shapeCount={shapeCount}
        />
      )}
      {userMenu}
    </>
  );

  // Narrow mobile (<500px): two-row layout when centerContent exists
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

  // Single-row layout (>=500px)
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

// --- Default right-side content for canvas editor ---

function DefaultRightContent({
  onReset,
  onSave,
  isSaving,
  saveStatus,
  saveError,
  hasSubmittedToday,
  isLoggedIn,
  showGallery,
  shapeCount,
}: {
  onReset?: () => void;
  onSave?: () => void;
  isSaving?: boolean;
  saveStatus?: 'idle' | 'saved' | 'error';
  saveError?: string | null;
  hasSubmittedToday?: boolean;
  isLoggedIn?: boolean;
  showGallery?: boolean;
  shapeCount?: number;
}) {
  const isDesktop = useIsDesktop();
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);

  const isOverLimit = shapeCount != null && shapeCount > MAX_SHAPES;

  const saveLabel = isSaving
    ? 'Saving...'
    : isOverLimit
      ? 'Remove shapes to submit'
      : saveStatus === 'error'
        ? 'Failed'
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
          {isDesktop ? 'Reset' : <RotateCcw size={14} />}
        </Button>
      )}

      {/* Submit */}
      <div data-tour="submit">
        {onSave && isLoggedIn ? (
          <Button
            variant={saveStatus === 'error' ? 'secondary' : 'primary'}
            className={`px-4 font-bold disabled:opacity-50 disabled:cursor-not-allowed ${saveStatus === 'error' ? 'text-(--color-danger)' : ''}`}
            onClick={onSave}
            disabled={isSaving || hasSubmittedToday || isOverLimit}
            title={isOverLimit ? `Too many shapes (${shapeCount}/${MAX_SHAPES}) — remove some to submit` : saveStatus === 'error' && saveError ? saveError : hasSubmittedToday ? 'Already submitted today' : 'Submit your creation'}
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
      </div>

      {/* Divider + Gallery — hidden on mobile and narrow desktop (available in UserMenuDropdown) */}
      {showGallery && (
        <>
          <div className="w-px h-5 bg-(--color-border) mx-1" />
          <div data-hint="gallery">
            <Button as="a" variant="ghost" href="/?view=gallery">
              Gallery
            </Button>
          </div>
        </>
      )}
    </>
  );
}
