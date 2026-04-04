/**
 * URL parameter checking utilities
 */

// Check if Shape Explorer mode is enabled via URL parameter or environment variable
export function isShapeExplorerEnabled(): boolean {
  // Check URL parameter: ?explorer or ?explorer=true
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has('explorer')) {
    const value = urlParams.get('explorer');
    return value === null || value === '' || value === 'true';
  }
  // Check environment variable
  return import.meta.env.VITE_SHAPE_EXPLORER === 'true';
}

// Check if submission detail view is requested
export function getSubmissionView(): { view: 'submission'; date: string } | { view: 'submission'; id: string } | null {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('view') === 'submission') {
    const id = urlParams.get('id');
    if (id) {
      return { view: 'submission', id };
    }
    const date = urlParams.get('date');
    if (date) {
      return { view: 'submission', date };
    }
  }
  return null;
}

// Check if voting test page is requested
export function isVotingTestEnabled(): boolean {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('test') === 'voting';
}

// Check if dashboard view is requested
export function isDashboardEnabled(): boolean {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('view') === 'dashboard';
}

// Check if color tester is requested
export function isColorTesterEnabled(): boolean {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.has('colors');
}

// Check if winners-day view is requested
export function getWinnersDayView(): { view: 'winners-day'; date: string } | null {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('view') === 'winners-day') {
    const date = urlParams.get('date');
    if (date) {
      return { view: 'winners-day', date };
    }
  }
  return null;
}

// Check if profile view is requested
export function getProfileView(): { view: 'profile'; userId: string } | null {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('view') === 'profile') {
    const userId = urlParams.get('user');
    if (userId) return { view: 'profile', userId };
  }
  return null;
}


// Check if gallery view is requested
export function getGalleryView(): { tab?: string; year?: number; month?: number; date?: string } | null {
  const urlParams = new URLSearchParams(window.location.search);
  const view = urlParams.get('view');

  // Legacy wall-of-the-day URLs redirect to gallery wall tab
  if (view === 'wall-of-the-day') {
    const dateStr = urlParams.get('date') || undefined;
    const validDate = dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? dateStr : undefined;
    return { tab: 'wall', date: validDate };
  }

  if (view === 'gallery') {
    const tab = urlParams.get('tab') || undefined;

    const yearStr = urlParams.get('year');
    const monthStr = urlParams.get('month');
    const year = yearStr ? parseInt(yearStr, 10) : undefined;
    const month = monthStr ? parseInt(monthStr, 10) : undefined;
    const validYear = year !== undefined && !isNaN(year) && year >= 2024 && year <= 2100 ? year : undefined;
    const validMonth = month !== undefined && !isNaN(month) && month >= 0 && month <= 11 ? month : undefined;

    const dateStr = urlParams.get('date') || undefined;
    const validDate = dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? dateStr : undefined;

    return { tab, year: validYear, month: validMonth, date: validDate };
  }
  return null;
}
