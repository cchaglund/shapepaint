import { lazy, Suspense, useMemo, type ReactNode } from 'react';
import { MotionConfig } from 'motion/react';
import { FollowsProvider } from './contexts/FollowsContext';
import { getTodayDateUTC } from './utils/dailyChallenge';
import { useDailyChallenge } from './hooks/challenge/useDailyChallenge';
import { useAppRoute, isStandaloneRoute } from './hooks/useAppRoute';
import { useThemeState } from './hooks/ui/useThemeState';
import { useAuth } from './hooks/auth/useAuth';
import { useAdmin } from './hooks/auth/useAdmin';
import { useDateChangeReload } from './hooks/ui/useDateChangeReload';
import { LoadingSpinner } from './components/shared/LoadingSpinner';
import { ErrorBoundary } from './components/shared/ErrorBoundary';

// Route-based code splitting: each page loads only when navigated to
const ShapeExplorer = lazy(() => import('./components/admin/ShapeExplorer').then(m => ({ default: m.ShapeExplorer })));
const ColorTester = lazy(() => import('./components/admin/ColorTester').then(m => ({ default: m.ColorTester })));
const Dashboard = lazy(() => import('./components/admin/Dashboard').then(m => ({ default: m.Dashboard })));
const GalleryPage = lazy(() => import('./pages/GalleryPage').then(m => ({ default: m.GalleryPage })));
const SubmissionDetailPage = lazy(() => import('./pages/SubmissionDetailPage').then(m => ({ default: m.SubmissionDetailPage })));
const WinnersDayPage = lazy(() => import('./pages/WinnersDayPage').then(m => ({ default: m.WinnersDayPage })));
const UserProfilePage = lazy(() => import('./pages/UserProfilePage').then(m => ({ default: m.UserProfilePage })));
const VotingTestPage = lazy(() => import('./test/VotingTestPage').then(m => ({ default: m.VotingTestPage })));
const CanvasEditorPage = lazy(() => import('./pages/CanvasEditorPage').then(m => ({ default: m.CanvasEditorPage })));

function AdminGuard({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin(user?.id);

  if (authLoading || adminLoading) return <LoadingSpinner size="lg" fullScreen />;
  if (!isAdmin) return null;
  return <>{children}</>;
}

function AppContent() {
  // Apply theme globally so all pages respect the selected theme + dark mode
  const { mode: themeMode, setMode: setThemeMode, theme: themeName, setTheme: setThemeName } = useThemeState();

  // Resolve current route from URL params
  const route = useAppRoute();

  // Only fetch today's challenge for the canvas editor (standalone pages fetch their own)
  const todayDate = useMemo(() => getTodayDateUTC(), []);

  // Reload the page when the server confirms a new day's challenge exists
  useDateChangeReload(todayDate);
  const needsChallenge = route.type === 'canvas';
  const { challenge, loading: challengeLoading } = useDailyChallenge(needsChallenge ? todayDate : '');

  // Render standalone pages (fetch their own data, no need to wait for today's challenge)
  if (isStandaloneRoute(route)) {
    const page = (() => {
      switch (route.type) {
        case 'explorer': return <AdminGuard><ShapeExplorer /></AdminGuard>;
        case 'voting-test': return <VotingTestPage />;
        case 'dashboard': return <AdminGuard><Dashboard /></AdminGuard>;
        case 'color-tester': return <ColorTester />;
        case 'gallery': return <FollowsProvider><GalleryPage tab={route.tab} year={route.year} month={route.month} date={route.date} themeMode={themeMode} onSetThemeMode={setThemeMode} themeName={themeName} onSetThemeName={setThemeName} /></FollowsProvider>;
        case 'profile': return <FollowsProvider><UserProfilePage userId={route.userId} themeMode={themeMode} onSetThemeMode={setThemeMode} themeName={themeName} onSetThemeName={setThemeName} /></FollowsProvider>;
        case 'winners-day': return <WinnersDayPage date={route.date} themeMode={themeMode} onSetThemeMode={setThemeMode} themeName={themeName} onSetThemeName={setThemeName} />;
        case 'submission-by-id': return <FollowsProvider><SubmissionDetailPage submissionId={route.id} themeMode={themeMode} onSetThemeMode={setThemeMode} themeName={themeName} onSetThemeName={setThemeName} /></FollowsProvider>;
        case 'submission-by-date': return <FollowsProvider><SubmissionDetailPage date={route.date} themeMode={themeMode} onSetThemeMode={setThemeMode} themeName={themeName} onSetThemeName={setThemeName} /></FollowsProvider>;
      }
    })();
    return <Suspense fallback={<LoadingSpinner size="lg" fullScreen />}>{page}</Suspense>;
  }

  // Only the canvas editor needs today's challenge loaded first
  if (challengeLoading || !challenge) {
    return <LoadingSpinner size="lg" fullScreen />;
  }

  return (
    <Suspense fallback={<LoadingSpinner size="lg" fullScreen />}>
      <CanvasEditorPage challenge={challenge} todayDate={todayDate} themeMode={themeMode} onSetThemeMode={setThemeMode} themeName={themeName} onSetThemeName={setThemeName} />
    </Suspense>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <MotionConfig reducedMotion="user">
        <AppContent />
      </MotionConfig>
    </ErrorBoundary>
  );
}

export default App;
