/** Maximum shapes allowed per canvas. 1000 is valid; 1001+ is over the limit. */
export const MAX_SHAPES = 1000;

/** Warning threshold — start showing amber at this count. */
const WARN_THRESHOLD = 800;

export type ShapeLimitSeverity = 'ok' | 'warn' | 'over';

export function getShapeLimitSeverity(count: number): ShapeLimitSeverity {
  if (count > MAX_SHAPES) return 'over';
  if (count >= WARN_THRESHOLD) return 'warn';
  return 'ok';
}

/** Returns an inline color style based on severity, using existing confidence CSS vars. */
export function getShapeLimitColor(severity: ShapeLimitSeverity): string | undefined {
  switch (severity) {
    case 'warn': return 'var(--color-confidence-med)';
    case 'over': return 'var(--color-confidence-low)';
    default: return undefined;
  }
}
