import { lazy, Suspense, useMemo, type ReactNode } from 'react';
import { MotionConfig } from 'motion/react';
import { AuthProvider, useAuthContext } from './contexts/AuthContext';
import { HeaderProvider } from './contexts/HeaderContext';
import { FollowsProvider } from './contexts/FollowsContext';
import { NotificationsProvider } from './contexts/NotificationsContext';
import { ToastProvider } from './contexts/ToastContext';
import { SubmissionStatusProvider } from './contexts/SubmissionStatusContext';
import { useNotificationsRealtime } from './hooks/notifications/useNotificationsRealtime';
import { getTodayDateUTC } from './utils/dailyChallenge';
import { useDailyChallenge } from './hooks/challenge/useDailyChallenge';
import { useAppRoute, isStandaloneRoute } from './hooks/useAppRoute';
import { useThemeState } from './hooks/ui/useThemeState';
import { useAdmin } from './hooks/auth/useAdmin';
import { useDateChangeReload } from './hooks/ui/useDateChangeReload';
import { TopBar } from './components/canvas/TopBar';
import { ToastContainer } from './components/notifications/ToastContainer';
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
  const { user, loading: authLoading } = useAuthContext();
  const { isAdmin, loading: adminLoading } = useAdmin(user?.id);

  if (authLoading || adminLoading) return <LoadingSpinner size="lg" fullScreen />;
  if (!isAdmin) return null;
  return <>{children}</>;
}

/** Admin/test routes that render standalone without the shared header layout */
function StandaloneRoute({ route }: { route: { type: string } }) {
  switch (route.type) {
    case 'explorer': return <AdminGuard><ShapeExplorer /></AdminGuard>;
    case 'voting-test': return <VotingTestPage />;
    case 'dashboard': return <AdminGuard><Dashboard /></AdminGuard>;
    case 'color-tester': return <ColorTester />;
    default: return null;
  }
}

const STANDALONE_ADMIN_ROUTES = new Set(['explorer', 'voting-test', 'dashboard', 'color-tester']);

/** Mounts Realtime subscription + toast overlay. Must live inside both NotificationsProvider and ToastProvider. */
function RealtimeAndToasts({ userId }: { userId: string | undefined }) {
  useNotificationsRealtime(userId);
  return <ToastContainer />;
}

function AppContent() {
  const { user } = useAuthContext();
  const { mode: themeMode, setMode: setThemeMode, theme: themeName, setTheme: setThemeName } = useThemeState();
  const route = useAppRoute();
  const todayDate = useMemo(() => getTodayDateUTC(), []);

  useDateChangeReload(todayDate);
  const needsChallenge = route.type === 'canvas';
  const { challenge, loading: challengeLoading } = useDailyChallenge(needsChallenge ? todayDate : '');

  // Admin/test routes render standalone without the shared header
  if (STANDALONE_ADMIN_ROUTES.has(route.type)) {
    return (
      <Suspense fallback={<LoadingSpinner size="lg" fullScreen />}>
        <StandaloneRoute route={route} />
      </Suspense>
    );
  }

  // All main pages share the persistent header layout
  const pageContent = (() => {
    if (isStandaloneRoute(route)) {
      switch (route.type) {
        case 'gallery': return <FollowsProvider><GalleryPage tab={route.tab} year={route.year} month={route.month} date={route.date} /></FollowsProvider>;
        case 'profile': return <FollowsProvider><UserProfilePage userId={route.userId} /></FollowsProvider>;
        case 'winners-day': return <WinnersDayPage date={route.date} />;
        case 'submission-by-id': return <FollowsProvider><SubmissionDetailPage submissionId={route.id} /></FollowsProvider>;
        case 'submission-by-date': return <FollowsProvider><SubmissionDetailPage date={route.date} /></FollowsProvider>;
      }
    }

    // Canvas editor — needs challenge data
    if (challengeLoading || !challenge) {
      return <LoadingSpinner size="lg" fullScreen />;
    }
    return <CanvasEditorPage challenge={challenge} />;
  })();

  return (
    <SubmissionStatusProvider userId={user?.id} todayDate={todayDate}>
      <ToastProvider>
        <NotificationsProvider userId={user?.id}>
          <RealtimeAndToasts userId={user?.id} />
          <HeaderProvider>
            <div className="h-dvh flex flex-col overflow-hidden">
              <TopBar
                themeMode={themeMode}
                onSetThemeMode={setThemeMode}
                themeName={themeName}
                onSetThemeName={setThemeName}
              />
              <Suspense fallback={<LoadingSpinner size="lg" fullScreen />}>
                {pageContent}
              </Suspense>
            </div>
          </HeaderProvider>
        </NotificationsProvider>
      </ToastProvider>
    </SubmissionStatusProvider>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <MotionConfig reducedMotion="user">
          <AppContent />
        </MotionConfig>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
