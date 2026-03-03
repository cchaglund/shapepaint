interface CloseButtonProps {
  onClick: () => void;
  size?: 'sm' | 'md';
  label?: string;
}

export function CloseButton({ onClick, size = 'md', label = 'Close' }: CloseButtonProps) {
  const iconSize = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';
  return (
    <button
      onClick={onClick}
      className="text-(--color-text-secondary) hover:text-(--color-text-primary) transition-colors cursor-pointer"
      aria-label={label}
    >
      <svg className={iconSize} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  );
}
