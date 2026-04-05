interface ViewToggleOption<T extends string> {
  value: T;
  label: string;
  disabled?: boolean;
  disabledTitle?: string;
}

interface ViewToggleProps<T extends string> {
  options: ViewToggleOption<T>[];
  activeValue: T;
  onChange: (value: T) => void;
  /** 'sm' = compact (11px, radius-sm). 'md' = larger (13px, radius-md). Default: 'sm' */
  size?: 'sm' | 'md';
  /** When true, buttons get flex-1 to fill available width. Default: false */
  fullWidth?: boolean;
  /** Additional className on the root container */
  className?: string;
}

const sizeConfig = {
  sm: {
    fontSize: 'text-xs',
    buttonRadius: '--radius-sm',
    containerRadius: '--radius-md',
    containerPadding: 'var(--space-1)',
    activeBorder: '--color-border',
    activeFontWeight: 'font-bold',
    inactiveFontWeight: 'font-bold',
    buttonPadding: 'px-3.5 py-1',
  },
  md: {
    fontSize: 'text-sm',
    buttonRadius: '--radius-md',
    containerRadius: '--radius-lg',
    containerPadding: 'var(--space-1)',
    activeBorder: '--color-border',
    activeFontWeight: 'font-bold',
    inactiveFontWeight: 'font-semibold',
    buttonPadding: 'px-4 py-2',
  },
} as const;

export function ViewToggle<T extends string>({
  options,
  activeValue,
  onChange,
  size = 'sm',
  fullWidth = false,
  className = '',
}: ViewToggleProps<T>) {
  const config = sizeConfig[size];

  const activeStyle: React.CSSProperties = {
    background: 'var(--color-card-bg)',
    border: `var(--border-width, 2px) solid var(${config.activeBorder})`,
    borderRadius: `var(${config.buttonRadius})`,
    boxShadow: 'var(--shadow-btn)',
  };

  const inactiveStyle: React.CSSProperties = {
    border: 'var(--border-width, 2px) solid transparent',
    borderRadius: `var(${config.buttonRadius})`,
  };

  return (
    <div
      className={`flex gap-1 ${className}`}
      style={{
        background: 'var(--color-selected)',
        borderRadius: `var(${config.containerRadius})`,
        border: 'var(--border-width, 2px) solid var(--color-border-light)',
        padding: config.containerPadding,
      }}
    >
      {options.map(({ value, label, disabled, disabledTitle }) => {
        const isActive = activeValue === value;
        return (
          <button
            key={value}
            onClick={() => onChange(value)}
            disabled={disabled}
            title={disabled ? disabledTitle : undefined}
            className={`view-toggle-btn ${isActive ? 'view-toggle-active' : ''} ${config.buttonPadding} ${config.fontSize} transition-all ${
              fullWidth ? 'flex-1' : ''
            } ${
              disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
            } ${
              isActive
                ? `text-(--color-text-primary) ${config.activeFontWeight}`
                : `text-(--color-text-secondary) ${config.inactiveFontWeight}`
            }`}
            style={isActive ? activeStyle : inactiveStyle}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
