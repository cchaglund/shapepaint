import { useState, useRef, useEffect, useMemo } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { KEYBOARD_ACTIONS, formatKeyBinding, type KeyMappings } from '../../constants/keyboardActions';

interface KeyboardShortcutsPopoverProps {
  keyMappings: KeyMappings;
  onOpenSettings: () => void;
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.userAgent);

export function KeyboardShortcutsPopover({ keyMappings, onOpenSettings }: KeyboardShortcutsPopoverProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open]);

  // Format a binding by action ID, falling back to default
  const fmt = useMemo(() => {
    const actionMap = new Map(KEYBOARD_ACTIONS.map(a => [a.id, a]));
    return (id: string) => {
      const action = actionMap.get(id as any);
      if (!action) return '?';
      const binding = keyMappings[action.id] ?? action.defaultBinding;
      return formatKeyBinding(binding);
    };
  }, [keyMappings]);

  const shortcuts = useMemo(() => [
    { key: fmt('undo'), action: 'Undo' },
    { key: fmt('redo'), action: 'Redo' },
    { key: fmt('duplicate'), action: 'Duplicate' },
    { key: fmt('delete'), action: 'Delete' },
    { key: [fmt('moveUp'), fmt('moveDown'), fmt('moveLeft'), fmt('moveRight')].join(' '), action: 'Move (Shift = 10px)' },
    { key: `${fmt('rotateCounterClockwise')} / ${fmt('rotateClockwise')}`, action: 'Rotate CCW / CW' },
    { key: fmt('mirrorHorizontal'), action: 'Mirror horizontal' },
    { key: fmt('mirrorVertical'), action: 'Mirror vertical' },
    { key: fmt('toggleGrid'), action: 'Grid toggle' },
    { key: 'Shift+Click', action: 'Multi-select' },
    { key: `${fmt('pan')}+Drag`, action: 'Pan canvas' },
    { key: isMac ? '⌘+Scroll' : 'Ctrl+Scroll', action: 'Zoom' },
  ], [fmt]);

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger button */}
      <button
        onClick={() => setOpen(prev => !prev)}
        className="w-[30px] h-[30px] flex items-center justify-center cursor-pointer transition-colors rounded-(--radius-md) bg-(--color-card-bg) text-(--color-text-secondary) hover:bg-(--color-hover) hover:text-(--color-text-primary) text-base font-bold"
        style={{ border: 'var(--border-width, 2px) solid var(--color-border)', boxShadow: 'var(--shadow-btn)' }}
        title="Keyboard shortcuts"
        aria-label="Keyboard shortcuts"
      >
        ?
      </button>

      {/* Popover */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 8 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full left-0 mb-2 w-[260px] overflow-hidden"
            style={{
              background: 'var(--color-card-bg)',
              border: 'var(--border-width, 2px) solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            {/* Header */}
            <div className="px-4 pt-3.5 pb-2.5">
              <span className="text-xs font-bold uppercase tracking-wide text-(--color-text-primary)">Keyboard Shortcuts</span>
            </div>

            {/* Shortcuts list */}
            <div className="px-4 pb-3 max-h-[320px] overflow-y-auto">
              {shortcuts.map(({ key, action }) => (
                <div key={action} className="flex justify-between items-center py-[3px]">
                  <span
                    className="text-xs font-semibold whitespace-nowrap px-1.5 py-px rounded-(--radius-sm) bg-(--color-selected) text-(--color-text-primary)"
                  >{key}</span>
                  <span className="text-xs font-medium text-(--color-text-tertiary)">{action}</span>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="px-4 pb-3.5 pt-2.5 border-t border-(--color-border-light)">
              <button
                onClick={() => {
                  setOpen(false);
                  onOpenSettings();
                }}
                className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-semibold cursor-pointer transition-colors text-(--color-text-tertiary) hover:bg-(--color-hover) hover:text-(--color-text-primary)"
                style={{
                  border: 'var(--border-width, 2px) solid var(--color-border-light)',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
                Customize shortcuts
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
