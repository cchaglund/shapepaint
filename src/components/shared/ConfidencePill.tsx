import cn from 'classnames';
import {
  RANKING_CONFIDENCE_LABELS,
  type RankingConfidence,
} from '../../utils/votingRules';

const STYLE_MAP: Record<RankingConfidence, { bg: string; text: string; dot: string }> = {
  high: {
    bg: 'bg-[var(--color-confidence-high-bg)]',
    text: 'text-[var(--color-confidence-high-text)]',
    dot: 'bg-[var(--color-confidence-high)]',
  },
  medium: {
    bg: 'bg-[var(--color-confidence-med-bg)]',
    text: 'text-[var(--color-confidence-med-text)]',
    dot: 'bg-[var(--color-confidence-med)]',
  },
  low: {
    bg: 'bg-[var(--color-confidence-low-bg)]',
    text: 'text-[var(--color-confidence-low-text)]',
    dot: 'bg-[var(--color-confidence-low)]',
  },
};

interface ConfidencePillProps {
  confidence: RankingConfidence;
  size?: 'sm' | 'md';
}

export function ConfidencePill({ confidence, size = 'md' }: ConfidencePillProps) {
  const styles = STYLE_MAP[confidence];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-semibold leading-none rounded-(--radius-pill)',
        styles.bg,
        styles.text,
        size === 'sm' ? 'text-[0.625rem] px-1.5 py-[3px]' : 'text-[0.6875rem] px-2 py-[3px]',
      )}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', styles.dot)} />
      {RANKING_CONFIDENCE_LABELS[confidence]}
    </span>
  );
}
