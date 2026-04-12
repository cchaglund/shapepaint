import { useState, useRef, useMemo } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Settings, Play } from 'lucide-react';
import { KEYBOARD_ACTIONS, formatKeyBinding, type KeyMappings, type KeyboardActionId } from '../../constants/keyboardActions';
import { useClickOutside } from '../../hooks/ui/useClickOutside';
import { IS_MAC } from '../../utils/platform';

interface KeyboardShortcutsPopoverProps {
  keyMappings: KeyMappings;
  onOpenSettings: () => void;
  onReplayTour?: () => void;
}

export function KeyboardShortcutsPopover({ keyMappings, onOpenSettings, onReplayTour }: KeyboardShortcutsPopoverProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useClickOutside(containerRef, open, () => setOpen(false));

  // Format a binding by action ID, falling back to default
  const fmt = useMemo(() => {
    const actionMap = new Map(KEYBOARD_ACTIONS.map(a => [a.id, a]));
    return (id: KeyboardActionId) => {
      const action = actionMap.get(id);
      if (!action) return '?';
      const binding = keyMappings[action.id] ?? action.defaultBinding;
      return formatKeyBinding(binding);
    };
  }, [keyMappings]);

  const altKey = IS_MAC ? '⌥' : 'Alt';
  const shortcuts = useMemo(() => [
    { key: `${fmt('undo')} / ${fmt('redo')}`, action: 'Undo / Redo' },
    { key: `${fmt('selectAll')} / ${fmt('deselectAll')}`, action: 'Select / Deselect all' },
    { key: fmt('duplicate'), action: 'Duplicate' },
    { key: fmt('delete'), action: 'Delete' },
    { key: [fmt('moveUp'), fmt('moveDown'), fmt('moveLeft'), fmt('moveRight')].join(' '), action: `Move (⇧ 10x · ${altKey} 0.2x)` },
    { key: `${fmt('rotateCounterClockwise')} / ${fmt('rotateClockwise')}`, action: `Rotate (⇧ 15x · ${altKey} 0.2x)` },
    { key: `${fmt('sizeIncrease')} / ${fmt('sizeDecrease')}`, action: `Size (⇧ 10x · ${altKey} 0.2x)` },
    { key: fmt('mirrorHorizontal'), action: 'Mirror horizontal' },
    { key: fmt('mirrorVertical'), action: 'Mirror vertical' },
    { key: `${fmt('bringForward')} / ${fmt('sendBackward')}`, action: 'Layer forward / back' },
    { key: `${fmt('setColor1')} ${fmt('setColor2')} ${fmt('setColor3')}`, action: 'Set color 1 / 2 / 3' },
    { key: fmt('toggleGrid'), action: 'Grid toggle' },
  ], [fmt, altKey]);

  const mouseControls = useMemo(() => [
    { key: 'Shift+Click', action: 'Multi-select' },
    { key: '⇧+Drag corner', action: 'Resize from center' },
    { key: '⇧+Drag rotate', action: 'Snap to 15°' },
    { key: `${fmt('pan')}+Drag`, action: 'Pan canvas' },
    { key: 'Middle mouse+Drag', action: 'Pan canvas' },
    { key: IS_MAC ? '⌘+Scroll' : 'Ctrl+Scroll', action: 'Zoom' },
  ], [fmt]);

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger button */}
      <button
        data-hint="keyboard-shortcuts"
        onClick={() => setOpen(prev => !prev)}
        className="w-7.5 h-7.5 flex items-center justify-center cursor-pointer transition-colors rounded-(--radius-md) bg-(--color-card-bg) text-(--color-text-secondary) hover:bg-(--color-selected) hover:text-(--color-text-primary) text-base font-bold"
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
            className="absolute bottom-full left-0 mb-2 w-65 overflow-hidden"
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
            <div className="px-4 pb-3 max-h-80 overflow-y-auto">
              {shortcuts.map(({ key, action }) => (
                <div key={action} className="flex justify-between items-center py-0.75">
                  <span
                    className="text-xs font-semibold whitespace-nowrap px-1.5 py-px rounded-(--radius-sm) bg-(--color-selected) text-(--color-text-primary)"
                  >{key}</span>
                  <span className="text-xs font-medium text-(--color-text-tertiary)">{action}</span>
                </div>
              ))}

              <div className="mt-2.5 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wide text-(--color-text-tertiary)">Mouse</span>
              </div>
              {mouseControls.map(({ key, action }) => (
                <div key={action} className="flex justify-between items-center py-0.75">
                  <span
                    className="text-xs font-semibold whitespace-nowrap px-1.5 py-px rounded-(--radius-sm) bg-(--color-selected) text-(--color-text-primary)"
                  >{key}</span>
                  <span className="text-xs font-medium text-(--color-text-tertiary)">{action}</span>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="px-4 pb-3.5 pt-2.5 border-t border-(--color-border-light) flex flex-col gap-2">
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
                <Settings size={12} />
                Customize shortcuts
              </button>
              {onReplayTour && (
                <button
                  onClick={() => {
                    setOpen(false);
                    onReplayTour();
                  }}
                  className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-semibold cursor-pointer transition-colors text-(--color-text-tertiary) hover:bg-(--color-hover) hover:text-(--color-text-primary)"
                  style={{
                    border: 'var(--border-width, 2px) solid var(--color-border-light)',
                    borderRadius: 'var(--radius-sm)',
                  }}
                >
                  <Play size={12} />
                  Replay tour
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
