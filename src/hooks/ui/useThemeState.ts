import { useState, useEffect, useCallback } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ThemeName = 'a' | 'b' | 'c';

const MODE_KEY = 'theme-mode';
const THEME_KEY = 'theme-name';

/** Google Fonts URLs per theme (loaded on demand) */
const THEME_FONT_URLS: Record<ThemeName, string[]> = {
  a: [
    'https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&display=swap',
    'https://fonts.googleapis.com/css2?family=Lilita+One&display=swap',
  ],
  b: [], // DM Sans is self-hosted
  c: [
    'https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700&display=swap',
  ],
};

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
}

function loadFromStorage<T>(key: string, valid: T[], fallback: T): T {
  try {
    const stored = localStorage.getItem(key);
    if (stored && (valid as unknown[]).includes(stored)) return stored as T;
  } catch { /* ignore */ }
  return fallback;
}

function saveToStorage(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* ignore */ }
}

/** Inject <link> for Google Fonts if not already present */
function loadThemeFonts(theme: ThemeName) {
  for (const url of THEME_FONT_URLS[theme]) {
    const id = `theme-font-${theme}-${url.length}`;
    if (!document.getElementById(id)) {
      const link = document.createElement('link');
      link.id = id;
      link.rel = 'stylesheet';
      link.href = url;
      document.head.appendChild(link);
    }
  }
}

/** Apply data-theme and data-mode attributes to <html> */
function applyThemeToDOM(theme: ThemeName, effectiveMode: 'light' | 'dark') {
  const root = document.documentElement;
  root.setAttribute('data-theme', theme);
  root.setAttribute('data-mode', effectiveMode);
  // Remove legacy .dark class (no longer used)
  root.classList.remove('dark');
}

/** Add transition class, remove after animation completes */
function triggerThemeTransition() {
  const root = document.documentElement;
  root.classList.add('theme-transitioning');
  const timer = setTimeout(() => {
    root.classList.remove('theme-transitioning');
  }, 400); // slightly longer than 0.35s to ensure animation completes
  return timer;
}

export function useThemeState() {
  const [mode, setModeState] = useState<ThemeMode>(
    () => loadFromStorage(MODE_KEY, ['light', 'dark', 'system'], 'system')
  );
  const [theme, setThemeState] = useState<ThemeName>(
    () => loadFromStorage(THEME_KEY, ['a', 'b', 'c'], 'a')
  );
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>(getSystemTheme);

  // Listen for system theme changes
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setSystemTheme(e.matches ? 'dark' : 'light');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const effectiveTheme: 'light' | 'dark' = mode === 'system' ? systemTheme : mode;

  // Apply theme to DOM whenever theme or mode changes
  useEffect(() => {
    applyThemeToDOM(theme, effectiveTheme);
    loadThemeFonts(theme);
  }, [theme, effectiveTheme]);

  // Persist to localStorage
  useEffect(() => { saveToStorage(MODE_KEY, mode); }, [mode]);
  useEffect(() => { saveToStorage(THEME_KEY, theme); }, [theme]);

  const setMode = useCallback((newMode: ThemeMode) => {
    triggerThemeTransition();
    setModeState(newMode);
  }, []);

  const setTheme = useCallback((newTheme: ThemeName) => {
    triggerThemeTransition();
    setThemeState(newTheme);
  }, []);

  const cycleTheme = useCallback(() => {
    setModeState((current) => {
      if (current === 'light') return 'dark';
      if (current === 'dark') return 'system';
      return 'light';
    });
    triggerThemeTransition();
  }, []);

  const toggleDarkMode = useCallback(() => {
    triggerThemeTransition();
    setModeState((current) => {
      if (current === 'system') {
        return systemTheme === 'dark' ? 'light' : 'dark';
      }
      return current === 'dark' ? 'light' : 'dark';
    });
  }, [systemTheme]);

  return {
    mode,
    theme,
    effectiveTheme,
    setMode,
    setTheme,
    cycleTheme,
    toggleDarkMode,
    isDark: effectiveTheme === 'dark',
  };
}
