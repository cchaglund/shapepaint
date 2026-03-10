// Shared color picking logic used by both the edge function and ColorTester.

/** Pick 3 unique indices from [0..4] using Fisher-Yates shuffle */
export function pick3From5(random: () => number): [number, number, number] {
  const indices = [0, 1, 2, 3, 4];
  for (let i = 0; i < 3; i++) {
    const j = i + Math.floor(random() * (5 - i));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return [indices[0], indices[1], indices[2]];
}

/** All 10 possible 3-element combinations from [0..4] */
export const ALL_COMBOS: [number, number, number][] = [
  [0,1,2],[0,1,3],[0,1,4],[0,2,3],[0,2,4],
  [0,3,4],[1,2,3],[1,2,4],[1,3,4],[2,3,4],
];

/** Convert hex color to relative luminance (WCAG 2.x) */
function relativeLuminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const toLinear = (c: number) => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/** WCAG contrast ratio between two hex colors (1 to 21) */
export function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hex1);
  const l2 = relativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Minimum contrast ratio for at least one pair — ensures one color stands out */
export const MIN_CONTRAST = 2.5;

/** Check if at least one pair in a set of colors meets the contrast threshold */
export function hasEnoughContrast(colors: string[]): boolean {
  for (let i = 0; i < colors.length; i++) {
    for (let j = i + 1; j < colors.length; j++) {
      if (contrastRatio(colors[i], colors[j]) >= MIN_CONTRAST) return true;
    }
  }
  return false;
}

/**
 * Pick 3 colors from a 5-color palette, ensuring at least one pair has
 * sufficient contrast. Falls back to the initial pick if no combination works.
 * @param palette - 5-color hex array
 * @param random - RNG function returning 0-1 (seeded or Math.random)
 */
export function pick3WithContrast(palette: string[], random: () => number): {
  colors: string[];
  pickedIndices: [number, number, number];
} {
  const picked = pick3From5(random);
  const initialColors = picked.map(i => palette[i]);

  if (hasEnoughContrast(initialColors)) {
    return { colors: initialColors, pickedIndices: picked };
  }

  // Try all 10 combinations in a shuffled (deterministic) order
  const shuffled = [...ALL_COMBOS];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  for (const combo of shuffled) {
    const colors = combo.map(i => palette[i]);
    if (hasEnoughContrast(colors)) {
      return { colors, pickedIndices: combo };
    }
  }

  // No combination has enough contrast — use the original pick
  return { colors: initialColors, pickedIndices: picked };
}
