import { Link } from '../shared/Link';

interface CalendarCellProps {
  day: number;
  isToday: boolean;
  isFuture: boolean;
  hasContent?: boolean;
  disabled?: boolean;
  /** When true, children fill entire cell (no padding), day number overlays on art */
  artFill?: boolean;
  href?: string;
  onClick?: () => void;
  className?: string;
  'data-testid'?: string;
  'data-date'?: string;
  children: React.ReactNode;
}

const cellBase = 'aspect-square rounded-(--radius-md) relative transition-all overflow-hidden';

export function CalendarCell({
  day,
  isToday,
  isFuture,
  hasContent = false,
  disabled = false,
  artFill = false,
  href,
  onClick,
  className = '',
  'data-testid': dataTestId,
  'data-date': dataDate,
  children,
}: CalendarCellProps) {
  const isInteractive = !disabled && (!!href || !!onClick);

  const classes = `
    ${cellBase}
    ${artFill ? '' : 'p-1'}
    ${hasContent ? 'bg-(--color-bg-tertiary)' : 'bg-(--color-bg-secondary)'}
    ${isInteractive ? 'cursor-pointer hover:ring-1 hover:ring-inset hover:ring-(--color-accent)' : ''}
    ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
    ${isFuture && !disabled ? 'opacity-30' : ''}
    ${isToday ? 'ring-2 ring-inset ring-(--color-accent)' : ''}
    ${className}
  `;

  const content = (
    <>
      {artFill ? (
        <>
          <div className="absolute z-10 bg-(--color-overlay) text-(--color-accent-text) text-xs font-medium tabular-nums px-1 rounded-sm leading-tight top-1 left-1">
            {day}
          </div>
          <div className="absolute inset-0">
            {children}
          </div>
        </>
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center">
          <div
            className={`text-xs font-medium tabular-nums mb-1 ${
              isToday
                ? 'text-(--color-accent)'
                : hasContent
                ? 'text-(--color-text-primary)'
                : 'text-(--color-text-tertiary)'
            }`}
          >
            {day}
          </div>
          <div className="flex items-center justify-center">
            {children}
          </div>
        </div>
      )}
    </>
  );

  const dataAttrs = { 'data-testid': dataTestId, 'data-date': dataDate };

  if (href) {
    return <Link href={href} className={`block ${classes}`} {...dataAttrs}>{content}</Link>;
  }

  if (onClick && !disabled) {
    return <button onClick={onClick} className={classes} {...dataAttrs}>{content}</button>;
  }

  if (onClick && disabled) {
    return <button onClick={onClick} disabled className={classes} {...dataAttrs}>{content}</button>;
  }

  return <div className={classes} {...dataAttrs}>{content}</div>;
}
