import { useEffect, useRef } from 'react';
import { fetchLatestChallengeDate } from '../../lib/api';

const CHECK_COOLDOWN_MS = 5 * 60_000; // Min 5 minutes between server checks

/**
 * Reloads the page when the server has a newer challenge than what's displayed.
 *
 * On tab re-focus (debounced to once per 5 min) and on a 5 min interval,
 * asks the server for the latest challenge date. If it differs from what's
 * displayed, reloads. If the fetch fails (e.g. offline), does nothing —
 * the user keeps their current canvas.
 */
export function useDateChangeReload(currentChallengeDate: string) {
  const lastCheckRef = useRef(0);

  useEffect(() => {
    async function checkForNewChallenge() {
      // Debounce: skip if we checked recently
      const now = Date.now();
      if (now - lastCheckRef.current < CHECK_COOLDOWN_MS) return;
      lastCheckRef.current = now;

      // Ask the server what the latest challenge date is
      try {
        const latestDate = await fetchLatestChallengeDate();
        if (latestDate && latestDate !== currentChallengeDate) {
          window.location.reload();
        }
      } catch {
        // Offline or network error — do nothing, keep current state
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        checkForNewChallenge();
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Also check periodically in case the tab stays focused past midnight
    const interval = setInterval(checkForNewChallenge, CHECK_COOLDOWN_MS);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(interval);
    };
  }, [currentChallengeDate]);
}
