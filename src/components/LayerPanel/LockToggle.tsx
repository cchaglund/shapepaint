import { Lock, Unlock } from 'lucide-react';

interface LockToggleProps {
  locked: boolean;
  disabled?: boolean;
  onToggle: (e: React.MouseEvent) => void;
}

export function LockToggle({ locked, disabled, onToggle }: LockToggleProps) {
  return (
    <button
      className={`w-5 h-5 flex items-center justify-center shrink-0 bg-transparent border-none rounded transition-colors ${
        disabled
          ? 'cursor-not-allowed text-(--color-text-tertiary) opacity-40'
          : locked
            ? 'cursor-pointer text-(--color-text-secondary) hover:text-(--color-text-primary)'
            : 'cursor-pointer text-(--color-text-tertiary) opacity-30 hover:opacity-100 hover:text-(--color-text-primary)'
      }`}
      disabled={disabled}
      onClick={onToggle}
      title={disabled ? 'Unlock group first' : locked ? 'Unlock layer' : 'Lock layer'}
    >
      {locked ? <Lock size={12} strokeWidth={2.5} /> : <Unlock size={12} strokeWidth={2.5} />}
    </button>
  );
}
