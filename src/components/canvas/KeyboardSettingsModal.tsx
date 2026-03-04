import { useState, useEffect, useCallback } from 'react';
import {
  type KeyMappings,
  type KeyboardActionId,
  type KeyBinding,
  KEYBOARD_ACTIONS,
  KEYBOARD_ACTIONS_MAP,
  formatKeyBinding,
  bindingFromEvent,
  findConflicts,
} from '../../constants/keyboardActions';
import { Button } from '../shared/Button';
import { Modal } from '../shared/Modal';

interface KeyboardSettingsModalProps {
  mappings: KeyMappings;
  onUpdateBinding: (
    actionId: KeyboardActionId,
    binding: KeyBinding,
    resolveConflicts?: boolean
  ) => Promise<{ success: boolean; conflicts?: KeyboardActionId[] }>;
  onResetAll: () => Promise<void>;
  onClose: () => void;
  syncing?: boolean;
}

export function KeyboardSettingsModal({
  mappings,
  onUpdateBinding,
  onResetAll,
  onClose,
  syncing,
}: KeyboardSettingsModalProps) {
  const [listeningFor, setListeningFor] = useState<KeyboardActionId | null>(null);
  const [pendingConflicts, setPendingConflicts] = useState<{
    actionId: KeyboardActionId;
    binding: KeyBinding;
    conflicts: KeyboardActionId[];
  } | null>(null);
  // Custom escape: cancel listening > dismiss conflicts > close modal
  // Modal's built-in escape is disabled since we need this priority logic.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (listeningFor) {
          setListeningFor(null);
        } else if (pendingConflicts) {
          setPendingConflicts(null);
        } else {
          onClose();
        }
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [listeningFor, pendingConflicts, onClose]);

  // Handle key capture when listening
  useEffect(() => {
    if (!listeningFor) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore modifier-only presses
      if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      const newBinding = bindingFromEvent(e);

      // Check for conflicts
      const conflicts = findConflicts(mappings, listeningFor, newBinding);

      if (conflicts.length > 0) {
        // Show conflict dialog
        setPendingConflicts({
          actionId: listeningFor,
          binding: newBinding,
          conflicts,
        });
      } else {
        // No conflicts, just update
        onUpdateBinding(listeningFor, newBinding);
      }

      setListeningFor(null);
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [listeningFor, mappings, onUpdateBinding]);

  const handleStartListening = useCallback((actionId: KeyboardActionId) => {
    const action = KEYBOARD_ACTIONS_MAP.get(actionId);
    if (action?.allowRemap === false) return;
    setListeningFor(actionId);
  }, []);

  const handleResolveConflict = useCallback(
    async (resolve: boolean) => {
      if (!pendingConflicts) return;

      if (resolve) {
        await onUpdateBinding(
          pendingConflicts.actionId,
          pendingConflicts.binding,
          true // resolve conflicts
        );
      }
      setPendingConflicts(null);
    },
    [pendingConflicts, onUpdateBinding]
  );

  const handleResetAll = useCallback(async () => {
    await onResetAll();
  }, [onResetAll]);

  // Group actions by category
  const actionsByCategory = {
    editing: KEYBOARD_ACTIONS.filter((a) => a.category === 'editing'),
    movement: KEYBOARD_ACTIONS.filter((a) => a.category === 'movement'),
    navigation: KEYBOARD_ACTIONS.filter((a) => a.category === 'navigation'),
  };

  const categoryLabels = {
    editing: 'Editing',
    movement: 'Shape Movement',
    navigation: 'Canvas Navigation',
  };

  return (
    <>
      <Modal
        onClose={onClose}
        closeOnEscape={false}
        ariaLabelledBy="keyboard-settings-title"
        dataTestId="keyboard-settings-modal"
        className="p-0! max-h-[80vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between border-(--color-border)">
          <h2
            id="keyboard-settings-title"
            className="m-0 text-xl font-semibold text-(--color-text-primary)"
          >
            Keyboard Shortcuts
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-(--radius-md) border-none cursor-pointer transition-colors bg-transparent text-(--color-text-tertiary)"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto flex-1">
          <p className="mt-0 mb-4 text-sm text-(--color-text-secondary)">
            Click on a shortcut to change it. Press Escape to cancel.
          </p>

          {Object.entries(actionsByCategory).map(([category, actions]) => (
            <div key={category} className="mb-6 last:mb-0">
              <h3 className="m-0 mb-3 text-xs uppercase font-medium text-(--color-text-tertiary)">
                {categoryLabels[category as keyof typeof categoryLabels]}
              </h3>
              <div className="space-y-2">
                {actions.map((action) => {
                  const binding = mappings[action.id];
                  const isListening = listeningFor === action.id;
                  const isRemappable = action.allowRemap !== false;

                  return (
                    <div
                      key={action.id}
                      className="flex items-center justify-between py-2 px-3 rounded-(--radius-md) bg-(--color-bg-tertiary)"
                    >
                      <div className="flex-1 min-w-0 pr-4">
                        <div className="text-sm font-medium text-(--color-text-primary)">
                          {action.label}
                        </div>
                        <div className="text-xs truncate text-(--color-text-tertiary)">
                          {action.description}
                        </div>
                      </div>
                      <button
                        onClick={() => handleStartListening(action.id)}
                        disabled={!isRemappable}
                        className={`px-3 py-1.5 rounded-(--radius-md) text-xs font-mono border transition-colors min-w-20 bg-(--color-bg-secondary) border-(--color-border) ${
                          isListening ? 'ring-2 ring-(--color-accent)' : ''
                        } ${
                          binding ? 'text-(--color-text-primary)' : 'text-(--color-text-tertiary)'
                        } ${
                          isRemappable ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'
                        }`}
                        title={
                          isRemappable
                            ? 'Click to change'
                            : 'This shortcut cannot be changed'
                        }
                      >
                        {isListening
                          ? 'Press a key...'
                          : binding
                          ? formatKeyBinding(binding)
                          : 'Not set'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 border-t flex items-center justify-between border-(--color-border)">
          <Button variant="ghost" onClick={handleResetAll}>
            Reset to Defaults
          </Button>
          <div className="flex items-center gap-3">
            {syncing && (
              <span className="text-xs text-(--color-text-tertiary)">
                Saving...
              </span>
            )}
            <Button variant="primary" size="md" onClick={onClose}>
              Done
            </Button>
          </div>
        </div>
      </Modal>

      {/* Conflict Resolution Dialog */}
      {pendingConflicts && (
        <Modal
          onClose={() => setPendingConflicts(null)}
          size="max-w-sm"
          className="text-center"
          zIndex="z-60"
          closeOnEscape={false}
          closeOnBackdropClick={false}
          dataTestId="keyboard-conflict-modal"
        >
          <h3 className="m-0 mb-3 text-xl font-semibold text-(--color-text-primary)">
            Shortcut Conflict
          </h3>
          <p className="m-0 mb-4 text-sm text-(--color-text-secondary)">
            <span className="font-mono font-medium">
              {formatKeyBinding(pendingConflicts.binding)}
            </span>{' '}
            is already used by{' '}
            <span className="font-medium">
              {pendingConflicts.conflicts
                .map((id) => KEYBOARD_ACTIONS_MAP.get(id)?.label)
                .join(', ')}
            </span>
            . Replace it?
          </p>
          <div className="flex flex-col items-center gap-3">
            <Button variant="primary" size="md" fullWidth onClick={() => handleResolveConflict(true)}>
              Replace
            </Button>
            <Button variant="link" onClick={() => handleResolveConflict(false)}>
              Cancel
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
