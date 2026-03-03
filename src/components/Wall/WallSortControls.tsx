import { useState, useRef } from 'react';
import { useClickOutside } from '../../hooks/ui/useClickOutside';

export type SortMode = 'random' | 'newest' | 'oldest' | 'ranked' | 'likes';

interface WallSortControlsProps {
  sortMode: SortMode;
  onSortModeChange: (mode: SortMode) => void;
  isRankedAvailable: boolean;
  showLikesOption?: boolean;
}

const SORT_LABELS: Record<SortMode, string> = {
  random: 'Random',
  newest: 'Newest',
  oldest: 'Oldest',
  ranked: 'Ranked',
  likes: 'Likes',
};

const triggerStyle: React.CSSProperties = {
  background: 'var(--color-card-bg)',
  border: 'var(--border-width, 2px) solid var(--color-border-light)',
  borderRadius: 'var(--radius-md)',
};

const dropdownStyle: React.CSSProperties = {
  background: 'var(--color-card-bg)',
  border: 'var(--border-width, 2px) solid var(--color-border-light)',
  borderRadius: 'var(--radius-md)',
  boxShadow: 'var(--shadow-card)',
};

export function WallSortControls({
  sortMode,
  onSortModeChange,
  isRankedAvailable,
  showLikesOption = true,
}: WallSortControlsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useClickOutside(dropdownRef, isOpen, () => setIsOpen(false));

  const allOptions: SortMode[] = ['random', 'newest', 'oldest', 'ranked', 'likes'];
  const options = showLikesOption
    ? allOptions
    : allOptions.filter(o => o !== 'likes');

  const handleSelect = (mode: SortMode) => {
    if (mode === 'ranked' && !isRankedAvailable) return;
    onSortModeChange(mode);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-1.5 whitespace-nowrap px-3 py-1.5 text-sm font-semibold cursor-pointer transition-all text-(--color-text-primary) hover:opacity-80"
        style={triggerStyle}
      >
        {SORT_LABELS[sortMode]}
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {isOpen && (
        <div
          className="absolute right-0 top-full mt-1 py-1 min-w-30 z-10"
          style={dropdownStyle}
        >
          {options.map((mode) => {
            const isDisabled = mode === 'ranked' && !isRankedAvailable;
            const isSelected = sortMode === mode;

            return (
              <button
                key={mode}
                onClick={() => handleSelect(mode)}
                disabled={isDisabled}
                className={`w-full text-left px-3 py-1.5 text-sm transition-colors ${
                  isDisabled
                    ? 'opacity-50 cursor-not-allowed text-(--color-text-tertiary)'
                    : 'cursor-pointer hover:bg-(--color-bg-secondary)'
                } ${
                  isSelected
                    ? 'text-(--color-accent) font-medium'
                    : 'text-(--color-text-secondary)'
                }`}
                title={isDisabled ? 'Voting still in progress' : undefined}
              >
                {SORT_LABELS[mode]}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
