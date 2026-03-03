/** Detect Apple platform (macOS, iOS, iPadOS) for keyboard shortcut display */
export const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.userAgent);
