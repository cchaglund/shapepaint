// Keyboard action definitions and default bindings

export type KeyboardActionId =
  | 'undo'
  | 'redo'
  | 'duplicate'
  | 'delete'
  | 'moveUp'
  | 'moveDown'
  | 'moveLeft'
  | 'moveRight'
  | 'rotateClockwise'
  | 'rotateCounterClockwise'
  | 'mirrorHorizontal'
  | 'mirrorVertical'
  | 'pan'
  | 'toggleGrid';

export interface KeyBinding {
  key: string; // The key code (e.g., 'KeyZ', 'ArrowUp', 'Space')
  shift?: boolean;
  ctrl?: boolean;
  alt?: boolean;
  meta?: boolean;
}

export interface KeyboardAction {
  id: KeyboardActionId;
  label: string;
  description: string;
  category: 'editing' | 'movement' | 'navigation' | 'view';
  defaultBinding: KeyBinding;
  // Some actions shouldn't be remapped (like pan which uses space)
  allowRemap?: boolean;
}

// Default keyboard actions with standard bindings
export const KEYBOARD_ACTIONS: KeyboardAction[] = [
  {
    id: 'undo',
    label: 'Undo',
    description: 'Undo the last action',
    category: 'editing',
    defaultBinding: { key: 'KeyZ' },
    allowRemap: true,
  },
  {
    id: 'redo',
    label: 'Redo',
    description: 'Redo the last undone action',
    category: 'editing',
    defaultBinding: { key: 'KeyZ', shift: true },
    allowRemap: true,
  },
  {
    id: 'duplicate',
    label: 'Duplicate',
    description: 'Duplicate selected shapes',
    category: 'editing',
    defaultBinding: { key: 'KeyD' },
    allowRemap: true,
  },
  {
    id: 'delete',
    label: 'Delete',
    description: 'Delete selected shapes',
    category: 'editing',
    defaultBinding: { key: 'Backspace' },
    allowRemap: true,
  },
  {
    id: 'moveUp',
    label: 'Move Up',
    description: 'Move selected shapes up (Shift for larger steps)',
    category: 'movement',
    defaultBinding: { key: 'ArrowUp' },
    allowRemap: true,
  },
  {
    id: 'moveDown',
    label: 'Move Down',
    description: 'Move selected shapes down (Shift for larger steps)',
    category: 'movement',
    defaultBinding: { key: 'ArrowDown' },
    allowRemap: true,
  },
  {
    id: 'moveLeft',
    label: 'Move Left',
    description: 'Move selected shapes left (Shift for larger steps)',
    category: 'movement',
    defaultBinding: { key: 'ArrowLeft' },
    allowRemap: true,
  },
  {
    id: 'moveRight',
    label: 'Move Right',
    description: 'Move selected shapes right (Shift for larger steps)',
    category: 'movement',
    defaultBinding: { key: 'ArrowRight' },
    allowRemap: true,
  },
  {
    id: 'rotateClockwise',
    label: 'Rotate Clockwise',
    description: 'Rotate selected shapes clockwise (Shift for 15° steps)',
    category: 'movement',
    defaultBinding: { key: 'Period' },
    allowRemap: true,
  },
  {
    id: 'rotateCounterClockwise',
    label: 'Rotate Counter-Clockwise',
    description: 'Rotate selected shapes counter-clockwise (Shift for 15° steps)',
    category: 'movement',
    defaultBinding: { key: 'Comma' },
    allowRemap: true,
  },
  {
    id: 'mirrorHorizontal',
    label: 'Mirror Horizontal',
    description: 'Flip selected shapes horizontally (left/right)',
    category: 'movement',
    defaultBinding: { key: 'KeyH' },
    allowRemap: true,
  },
  {
    id: 'mirrorVertical',
    label: 'Mirror Vertical',
    description: 'Flip selected shapes vertically (up/down)',
    category: 'movement',
    defaultBinding: { key: 'KeyV' },
    allowRemap: true,
  },
  {
    id: 'pan',
    label: 'Pan',
    description: 'Hold and drag to pan the canvas',
    category: 'navigation',
    defaultBinding: { key: 'Space' },
    allowRemap: false, // Space is special, don't allow remapping
  },
  {
    id: 'toggleGrid',
    label: 'Toggle Grid',
    description: 'Show/hide grid lines for alignment',
    category: 'view',
    defaultBinding: { key: 'KeyG' },
    allowRemap: true,
  },
];

// Map of action ID to action for quick lookup
export const KEYBOARD_ACTIONS_MAP = new Map<KeyboardActionId, KeyboardAction>(
  KEYBOARD_ACTIONS.map((action) => [action.id, action])
);

// Type for custom key mappings stored in settings
export type KeyMappings = Partial<Record<KeyboardActionId, KeyBinding>>;

// Get the default mappings as a KeyMappings object
export function getDefaultMappings(): KeyMappings {
  const mappings: KeyMappings = {};
  for (const action of KEYBOARD_ACTIONS) {
    mappings[action.id] = { ...action.defaultBinding };
  }
  return mappings;
}

// Format a key binding for display
export function formatKeyBinding(binding: KeyBinding): string {
  const parts: string[] = [];

  if (binding.ctrl) parts.push('Ctrl');
  if (binding.alt) parts.push('Alt');
  if (binding.shift) parts.push('Shift');
  if (binding.meta) parts.push('⌘');

  // Format the key name for display
  let keyName = binding.key;
  if (keyName.startsWith('Key')) {
    keyName = keyName.slice(3);
  } else if (keyName.startsWith('Digit')) {
    keyName = keyName.slice(5);
  } else if (keyName === 'ArrowUp') {
    keyName = '↑';
  } else if (keyName === 'ArrowDown') {
    keyName = '↓';
  } else if (keyName === 'ArrowLeft') {
    keyName = '←';
  } else if (keyName === 'ArrowRight') {
    keyName = '→';
  } else if (keyName === 'Period') {
    keyName = '.';
  } else if (keyName === 'Comma') {
    keyName = ',';
  } else if (keyName === 'Space') {
    keyName = 'Space';
  } else if (keyName === 'Backspace') {
    keyName = '⌫';
  } else if (keyName === 'Delete') {
    keyName = 'Del';
  } else if (keyName === 'Escape') {
    keyName = 'Esc';
  }

  parts.push(keyName);

  return parts.join('+');
}

// Check if a keyboard event matches a binding
export function matchesBinding(event: KeyboardEvent, binding: KeyBinding): boolean {
  if (event.code !== binding.key) return false;
  if (!!binding.shift !== event.shiftKey) return false;
  if (!!binding.ctrl !== event.ctrlKey) return false;
  if (!!binding.alt !== event.altKey) return false;
  if (!!binding.meta !== event.metaKey) return false;
  return true;
}

// Create a binding from a keyboard event
export function bindingFromEvent(event: KeyboardEvent): KeyBinding {
  const binding: KeyBinding = {
    key: event.code,
  };
  if (event.shiftKey) binding.shift = true;
  if (event.ctrlKey) binding.ctrl = true;
  if (event.altKey) binding.alt = true;
  if (event.metaKey) binding.meta = true;
  return binding;
}

// Check if two bindings are equal
export function bindingsEqual(a: KeyBinding, b: KeyBinding): boolean {
  return (
    a.key === b.key &&
    !!a.shift === !!b.shift &&
    !!a.ctrl === !!b.ctrl &&
    !!a.alt === !!b.alt &&
    !!a.meta === !!b.meta
  );
}

// Find conflicts in mappings
export function findConflicts(
  mappings: KeyMappings,
  newActionId: KeyboardActionId,
  newBinding: KeyBinding
): KeyboardActionId[] {
  const conflicts: KeyboardActionId[] = [];
  for (const [actionId, binding] of Object.entries(mappings)) {
    if (actionId !== newActionId && binding && bindingsEqual(binding, newBinding)) {
      conflicts.push(actionId as KeyboardActionId);
    }
  }
  return conflicts;
}
