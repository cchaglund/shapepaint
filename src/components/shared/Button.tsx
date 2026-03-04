import type { ComponentPropsWithoutRef, CSSProperties, ElementType, ReactNode } from 'react';

/**
 * Themed button used across the UI.
 * Shape adapts to the active theme (rounded in Pop Art/Cloud, sharp in Swiss/Brutalist).
 *
 * Variants:
 * - secondary: white/surface bg + shadow (Reset, user menu trigger)
 * - primary:   accent bg + shadow (Submit, modal CTAs)
 * - ghost:     selected/tinted bg, no shadow (Gallery, subtle actions)
 * - inverse:   dark bg (text-primary as bg), shadow (Log in)
 * - danger:    danger bg + shadow (destructive actions)
 * - link:      text-only, no bg/border/shadow (Cancel, dismiss, escape hatches)
 */

export type ButtonVariant = 'secondary' | 'primary' | 'ghost' | 'inverse' | 'danger' | 'link';

const variantClasses: Record<ButtonVariant, string> = {
  secondary:
    'bg-(--color-card-bg) text-(--color-text-primary) hover:text-(--color-text-primary) hover:translate-y-px active:translate-y-0.5',
  primary:
    'bg-(--color-accent) text-(--color-accent-text) hover:bg-(--color-accent-hover) hover:translate-y-px active:translate-y-0.5',
  ghost:
    'bg-(--color-selected) text-(--color-text-primary) hover:bg-(--color-selected-hover) hover:-translate-y-px active:translate-y-0',
  inverse:
    'hover:translate-y-px active:translate-y-0.5',
  danger:
    'bg-(--color-danger) text-(--color-accent-text) hover:bg-(--color-danger-hover) hover:translate-y-px active:translate-y-0.5',
  link:
    'text-(--color-text-secondary) hover:text-(--color-text-primary) hover:underline',
};

/** Variants that get the btn-shadow */
const shadowVariants = new Set<ButtonVariant>(['secondary', 'primary', 'inverse', 'danger']);

/** Variants that get a border */
const borderVariants = new Set<ButtonVariant>(['secondary', 'primary', 'ghost', 'inverse', 'danger']);

export type ButtonSize = 'sm' | 'md';

const sizeClasses: Record<ButtonSize, Record<'default' | 'link', string>> = {
  sm: { default: 'h-9 md:h-8 px-3 text-xs', link: 'h-9 md:h-8 px-3 text-sm' },
  md: { default: 'h-10 md:h-9 px-4 text-sm', link: 'h-10 md:h-9 px-4 text-base' },
};

type ButtonProps<T extends ElementType = 'button'> = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  as?: T;
  fullWidth?: boolean;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
} & Omit<ComponentPropsWithoutRef<T>, 'as' | 'children' | 'className' | 'style' | 'size'>;

export function Button<T extends ElementType = 'button'>({
  variant = 'secondary',
  size = 'sm',
  as,
  fullWidth = false,
  className = '',
  style,
  children,
  ...rest
}: ButtonProps<T>) {
  const Tag = as || 'button';
  const hasShadow = shadowVariants.has(variant);
  const hasBorder = borderVariants.has(variant);

  const inverseStyle = variant === 'inverse'
    ? {
        background: 'var(--color-text-primary)',
        color: 'var(--color-bg-primary)',
      }
    : {};

  return (
    <Tag
      className={`${sizeClasses[size][variant === 'link' ? 'link' : 'default']} rounded-(--radius-pill) font-semibold transition-all duration-150 cursor-pointer inline-flex items-center justify-center no-underline ${fullWidth ? 'w-full' : ''} ${variantClasses[variant]} ${className}`}
      style={{
        ...(hasBorder ? { border: 'var(--border-width, 2px) solid var(--color-border)' } : { border: 'none' }),
        ...(hasShadow ? { boxShadow: 'var(--shadow-btn)' } : {}),
        ...inverseStyle,
        ...style,
      }}
      {...rest}
    >
      {children}
    </Tag>
  );
}
