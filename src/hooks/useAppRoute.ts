import { useSyncExternalStore } from 'react';
import { subscribe, getLocationSearch } from '../lib/router';
import {
  isShapeExplorerEnabled,
  getSubmissionView,
  isVotingTestEnabled,
  isSocialTestEnabled,
  isDashboardEnabled,
  isColorTesterEnabled,
  getWinnersDayView,
  getWallOfTheDayView,
  getProfileView,
  getGalleryView,
} from '../utils/urlParams';

// Routes that render standalone pages (fetch their own data)
type StandaloneRoute =
  | { type: 'explorer' }
  | { type: 'voting-test' }
  | { type: 'social-test' }
  | { type: 'dashboard' }
  | { type: 'color-tester' }
  | { type: 'gallery'; tab?: string; year?: number; month?: number; date?: string }
  | { type: 'wall-of-the-day'; date: string }
  | { type: 'profile'; userId: string }
  | { type: 'winners-day'; date: string }
  | { type: 'submission-by-id'; id: string }
  | { type: 'submission-by-date'; date: string };

// Routes that need today's challenge data loaded first
type ChallengeRoute =
  | { type: 'canvas' };

export type AppRoute = StandaloneRoute | ChallengeRoute;

function resolveRoute(): AppRoute {
  if (isShapeExplorerEnabled()) return { type: 'explorer' };
  if (isVotingTestEnabled()) return { type: 'voting-test' };
  if (isSocialTestEnabled()) return { type: 'social-test' };
  if (isDashboardEnabled()) return { type: 'dashboard' };
  if (isColorTesterEnabled()) return { type: 'color-tester' };

  const gallery = getGalleryView();
  if (gallery) return { type: 'gallery', tab: gallery.tab, year: gallery.year, month: gallery.month, date: gallery.date };

  const wall = getWallOfTheDayView();
  if (wall) return { type: 'wall-of-the-day', date: wall.date };

  const profile = getProfileView();
  if (profile) return { type: 'profile', userId: profile.userId };

  const winners = getWinnersDayView();
  if (winners) return { type: 'winners-day', date: winners.date };

  const submission = getSubmissionView();
  if (submission) {
    if ('id' in submission) return { type: 'submission-by-id', id: submission.id };
    return { type: 'submission-by-date', date: submission.date };
  }

  return { type: 'canvas' };
}

export function useAppRoute(): AppRoute {
  // Subscribe to URL changes so the route re-evaluates on navigate()/popstate
  const search = useSyncExternalStore(subscribe, getLocationSearch, () => '');
  // search is used as the reactive trigger — resolveRoute reads window.location.search directly
  void search;
  return resolveRoute();
}

/** Check if a route needs challenge data before rendering */
export function isStandaloneRoute(route: AppRoute): route is StandaloneRoute {
  return route.type !== 'canvas';
}
