import type { ThemeMode, ThemeName } from '../hooks/ui/useThemeState';

/** Theme metadata — accent colors hardcoded so previews work regardless of active theme */
export const THEME_META: { key: ThemeName; label: string; accent: string }[] = [
  { key: 'a', label: 'Pop', accent: '#FF3366' },
  { key: 'b', label: 'Swiss', accent: '#E63322' },
  { key: 'c', label: 'Cloud', accent: '#E07A5F' },
];

export const THEME_NAMES: ThemeName[] = THEME_META.map(t => t.key);

export const MODE_CYCLE: Record<ThemeMode, ThemeMode> = {
  light: 'dark',
  dark: 'system',
  system: 'light',
};

export const MODE_TITLE: Record<ThemeMode, string> = {
  light: 'Light mode — click for dark',
  dark: 'Dark mode — click for auto',
  system: 'Auto mode — click for light',
};
