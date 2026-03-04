/**
 * Minimal SPA router store.
 * Provides navigate() + useSyncExternalStore-compatible subscribe/getSnapshot.
 */

const listeners = new Set<() => void>();

function notify() {
  for (const fn of listeners) fn();
}

// Browser back/forward
window.addEventListener('popstate', notify);

/** Navigate to a URL without full page reload. */
export function navigate(url: string, { replace = false }: { replace?: boolean } = {}) {
  if (replace) {
    history.replaceState(null, '', url);
  } else {
    history.pushState(null, '', url);
    window.scrollTo(0, 0);
  }
  notify();
}

/** Subscribe to URL changes (for useSyncExternalStore). */
export function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => { listeners.delete(callback); };
}

/** Current snapshot of location.search (for useSyncExternalStore). */
export function getLocationSearch() {
  return window.location.search;
}
