import { lazy, Suspense, useMemo } from 'react';
import { MotionConfig } from 'motion/react';
import { FollowsProvider } from './contexts/FollowsContext';
import { getTodayDateUTC } from './utils/dailyChallenge';
import { useDailyChallenge } from './hooks/challenge/useDailyChallenge';
import { useAppRoute, isStandaloneRoute } from './hooks/useAppRoute';
import { useThemeState } from './hooks/ui/useThemeState';
import { LoadingSpinner } from './components/shared/LoadingSpinner';

// Route-based code splitting: each page loads only when navigated to
const ShapeExplorer = lazy(() => import('./components/admin/ShapeExplorer').then(m => ({ default: m.ShapeExplorer })));
const ColorTester = lazy(() => import('./components/admin/ColorTester').then(m => ({ default: m.ColorTester })));
const Dashboard = lazy(() => import('./components/admin/Dashboard').then(m => ({ default: m.Dashboard })));
const GalleryPage = lazy(() => import('./pages/GalleryPage').then(m => ({ default: m.GalleryPage })));
const SubmissionDetailPage = lazy(() => import('./pages/SubmissionDetailPage').then(m => ({ default: m.SubmissionDetailPage })));
const WinnersDayPage = lazy(() => import('./pages/WinnersDayPage').then(m => ({ default: m.WinnersDayPage })));
const WallOfTheDayPage = lazy(() => import('./pages/WallOfTheDayPage').then(m => ({ default: m.WallOfTheDayPage })));
const UserProfilePage = lazy(() => import('./pages/UserProfilePage').then(m => ({ default: m.UserProfilePage })));
const VotingTestPage = lazy(() => import('./test/VotingTestPage').then(m => ({ default: m.VotingTestPage })));
const SocialTestPage = lazy(() => import('./test/SocialTestPage').then(m => ({ default: m.SocialTestPage })));
const CanvasEditorPage = lazy(() => import('./pages/CanvasEditorPage').then(m => ({ default: m.CanvasEditorPage })));

function AppContent() {
  // Apply theme globally so all pages respect the selected theme + dark mode
  const { mode: themeMode, setMode: setThemeMode, theme: themeName, setTheme: setThemeName } = useThemeState();

  // Resolve current route from URL params
  const route = useAppRoute();

  // Only fetch today's challenge for the canvas editor (standalone pages fetch their own)
  const todayDate = useMemo(() => getTodayDateUTC(), []);
  const needsChallenge = route.type === 'canvas';
  const { challenge, loading: challengeLoading } = useDailyChallenge(needsChallenge ? todayDate : '');

  // Render standalone pages (fetch their own data, no need to wait for today's challenge)
  if (isStandaloneRoute(route)) {
    const page = (() => {
      switch (route.type) {
        case 'explorer': return <ShapeExplorer />;
        case 'voting-test': return <VotingTestPage />;
        case 'social-test': return <SocialTestPage />;
        case 'dashboard': return <Dashboard />;
        case 'color-tester': return <ColorTester />;
        case 'gallery': return <FollowsProvider><GalleryPage tab={route.tab} year={route.year} month={route.month} date={route.date} themeMode={themeMode} onSetThemeMode={setThemeMode} themeName={themeName} onSetThemeName={setThemeName} /></FollowsProvider>;
        case 'wall-of-the-day': return <WallOfTheDayPage date={route.date} />;
        case 'profile': return <FollowsProvider><UserProfilePage userId={route.userId} /></FollowsProvider>;
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
    <MotionConfig reducedMotion="user">
      <AppContent />
    </MotionConfig>
  );
}

export default App;
