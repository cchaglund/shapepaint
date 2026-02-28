import type { ThemeMode, ThemeName } from '../../hooks/ui/useThemeState';

interface ThemeToggleProps {
  mode: ThemeMode;
  onSetMode: (mode: ThemeMode) => void;
  theme: ThemeName;
  onSetTheme: (theme: ThemeName) => void;
}

const THEMES: ThemeName[] = ['a', 'b', 'c'];

export function ThemeToggle({ mode, onSetMode, theme, onSetTheme }: ThemeToggleProps) {
  return (
    <div className="flex flex-col gap-3">
      {/* Dark mode toggle */}
      <div>
        <h4 className="m-0 mb-1 text-xsuppercase text-(--color-text-tertiary)">Mode</h4>
        <div className="flex gap-1">
          {(['light', 'dark', 'system'] as ThemeMode[]).map((m) => (
            <button
              key={m}
              className={`flex-1 py-1.5 px-2 rounded-(--radius-sm) text-xsfont-medium transition-colors ${
                mode === m
                  ? 'bg-(--color-selected) text-(--color-accent) border border-(--color-accent)'
                  : 'bg-(--color-bg-tertiary) text-(--color-text-secondary) border border-transparent hover:bg-(--color-hover)'
              }`}
              onClick={() => onSetMode(m)}
              title={`${m.charAt(0).toUpperCase() + m.slice(1)} theme`}
            >
              {m === 'light' ? 'Light' : m === 'dark' ? 'Dark' : 'Auto'}
            </button>
          ))}
        </div>
      </div>

      {/* Theme selection (A/B/C/D) */}
      <div>
        <h4 className="m-0 mb-1 text-xsuppercase text-(--color-text-tertiary)">Theme</h4>
        <div className="flex gap-1">
          {THEMES.map((t) => (
            <button
              key={t}
              className={`flex-1 py-1.5 px-2 rounded-(--radius-sm) text-xsfont-semibold uppercase transition-colors ${
                theme === t
                  ? 'bg-(--color-selected) text-(--color-accent) border border-(--color-accent)'
                  : 'bg-(--color-bg-tertiary) text-(--color-text-secondary) border border-transparent hover:bg-(--color-hover)'
              }`}
              onClick={() => onSetTheme(t)}
              title={`Theme ${t.toUpperCase()}`}
            >
              {t.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
