// Cursor computation utilities for resize and rotation handles

// Get the effective cursor for a resize handle, accounting for rotation and flip transforms
// The cursor should always point away from the center of the shape in screen space
export function getEffectiveCursor(handleId: string, flipX: boolean, flipY: boolean, rotation: number): string {
  // Local handle offsets from center (before any transforms)
  const handleVectors: Record<string, { x: number; y: number }> = {
    nw: { x: -1, y: -1 },
    n: { x: 0, y: -1 },
    ne: { x: 1, y: -1 },
    e: { x: 1, y: 0 },
    se: { x: 1, y: 1 },
    s: { x: 0, y: 1 },
    sw: { x: -1, y: 1 },
    w: { x: -1, y: 0 },
  };

  const local = handleVectors[handleId] || { x: 1, y: 1 };

  // SVG transform order is right-to-left: rotate first, then flip
  // So we apply: rotation, then flip

  // Step 1: Apply rotation
  const rad = (rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const rotatedX = local.x * cos - local.y * sin;
  const rotatedY = local.x * sin + local.y * cos;

  // Step 2: Apply flip
  const screenX = rotatedX * (flipX ? -1 : 1);
  const screenY = rotatedY * (flipY ? -1 : 1);

  // Convert to angle (0 = right/east, goes clockwise)
  let angle = Math.atan2(screenY, screenX) * (180 / Math.PI);
  if (angle < 0) angle += 360;

  // Map the angle to the nearest cursor direction
  // Cursors are at 45° intervals: 0=e, 45=se, 90=s, 135=sw, 180=w, 225=nw, 270=n, 315=ne
  const cursorMap = ['e', 'se', 's', 'sw', 'w', 'nw', 'n', 'ne'];
  const index = Math.round(angle / 45) % 8;
  const cursor = cursorMap[index];

  // Convert cardinal directions to resize cursors
  // n/s use ns-resize, e/w use ew-resize, diagonals use their standard names
  if (cursor === 'n' || cursor === 's') return 'ns-resize';
  if (cursor === 'e' || cursor === 'w') return 'ew-resize';
  return `${cursor}-resize`;
}

/** Generate a rotation cursor SVG rotated to a given angle (Figma-style curved arrow) */
const _cursorCache = new Map<number, string>();
const ROTATION_CURSOR_PATH = "M13.1785 16.0527C13.3737 16.248 13.6903 16.248 13.8856 16.0527L17.0676 12.8707C17.2628 12.6755 17.2628 12.3589 17.0676 12.1636C16.8723 11.9684 16.5557 11.9684 16.3604 12.1636L13.532 14.992L10.7036 12.1636C10.5083 11.9684 10.1917 11.9684 9.99649 12.1636C9.80122 12.3589 9.80122 12.6755 9.99649 12.8707L13.1785 16.0527ZM0.146446 3.32932C-0.0488161 3.52459 -0.0488161 3.84117 0.146446 4.03643L3.32843 7.21841C3.52369 7.41367 3.84027 7.41367 4.03553 7.21841C4.2308 7.02315 4.2308 6.70657 4.03553 6.51131L1.20711 3.68288L4.03553 0.854451C4.2308 0.659189 4.2308 0.342606 4.03553 0.147344C3.84027 -0.0479175 3.52369 -0.0479175 3.32843 0.147344L0.146446 3.32932ZM13.532 15.6991L14.032 15.6991C14.032 12.192 14.0328 9.6453 13.8252 7.82323C13.6186 6.01068 13.1931 4.76521 12.2064 4.01202C11.2463 3.2791 9.86525 3.10596 8.04128 3.07989C7.11347 3.06662 6.03373 3.09271 4.78995 3.12167C3.54284 3.1507 2.12262 3.18288 0.499999 3.18288L0.499999 3.68288L0.499999 4.18288C2.13539 4.18288 3.56592 4.15043 4.81322 4.1214C6.06385 4.09228 7.12218 4.06685 8.02699 4.07978C9.86828 4.10611 10.9307 4.29626 11.5996 4.80688C12.242 5.29724 12.6309 6.17558 12.8316 7.93647C13.0312 9.68784 13.032 12.1642 13.032 15.6991L13.532 15.6991Z";
export function makeRotationCursor(angleDeg: number): string {
  const key = Math.round(((angleDeg % 360) + 360) % 360);
  const cached = _cursorCache.get(key);
  if (cached) return cached;
  // SVG viewBox is 18x17; center at (9, 8.5); pad to 24x24 with offset (3, 3.5)
  const svg = [
    "<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none'>",
    `<g transform='rotate(${key}, 12, 12)'>`,
    // white outline for contrast
    `<path d='${ROTATION_CURSOR_PATH}' fill='white' transform='translate(3, 3.5)' stroke='white' stroke-width='2.5' stroke-linejoin='round'/>`,
    // black foreground
    `<path d='${ROTATION_CURSOR_PATH}' fill='black' transform='translate(3, 3.5)'/>`,
    "</g>",
    "</svg>",
  ].join('');
  const cursor = `url("data:image/svg+xml,${encodeURIComponent(svg)}") 12 12, crosshair`;
  _cursorCache.set(key, cursor);
  return cursor;
}

/** Compute screen-space rotation angle for a corner's cursor */
export function getRotationCursorAngle(cornerId: string, flipX: boolean, flipY: boolean, rotation: number): number {
  const vectors: Record<string, { x: number; y: number }> = {
    'rotate-ne': { x: 1, y: -1 },
    'rotate-se': { x: 1, y: 1 },
    'rotate-sw': { x: -1, y: 1 },
    'rotate-nw': { x: -1, y: -1 },
  };
  const v = vectors[cornerId] ?? { x: 1, y: -1 };
  // Apply rotation then flip (matching SVG transform order)
  const rad = (rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const rx = v.x * cos - v.y * sin;
  const ry = v.x * sin + v.y * cos;
  const sx = rx * (flipX ? -1 : 1);
  const sy = ry * (flipY ? -1 : 1);
  // Base cursor (0°) points NE (-45° in math coords), so offset +45°
  return Math.atan2(sy, sx) * (180 / Math.PI) + 45;
}
