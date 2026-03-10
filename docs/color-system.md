# Color System

## Overview

Each daily challenge uses 3 colors drawn from a 5-color palette. There are 365 palettes
(one per day of the year), all sourced from [Coolors.co](https://coolors.co) and
pre-filtered so that every palette contains at least one 3-color combination where
a pair has a WCAG contrast ratio >= 2.5. This guarantees that the daily colors always
include at least one color that visually stands out from the others.

## Key Files

| File | Purpose |
|------|---------|
| `supabase/functions/_shared/palettes.ts` | The 365 palettes (single source of truth) |
| `supabase/functions/_shared/colorPicking.ts` | Contrast checking + pick-3-from-5 logic (shared) |
| `supabase/functions/get-daily-challenge/index.ts` | Edge function that generates challenges (server-side) |
| `src/components/admin/ColorTester.tsx` | Admin tool for previewing palette color picks |

## How Palette Selection Works

1. **Day of year** (1–365) maps directly to a palette index: `paletteIndex = dayOfYear - 1`.
2. A **seeded PRNG** (Mulberry32) with seed `dayIndex * 1000 + year` picks 3 of the
   5 colors via Fisher-Yates shuffle.
3. The picked colors are checked for **contrast** — at least one pair must have a
   WCAG contrast ratio >= 2.5.
4. If the initial pick fails the contrast check, all 10 possible 3-color combinations
   are tried (in a deterministic shuffled order). The first passing combination is used.
5. If no combination passes (shouldn't happen since palettes are pre-filtered), the
   original pick is used as a fallback.

Because the seed includes the year, the **same calendar date will pick different colors
next year** (different 3 of 5 from the same palette). It's seeded, so the same date
always produces the same result within a given year.

## Contrast Guarantee

The contrast check uses WCAG 2.x relative luminance:

- Convert sRGB hex → linear RGB → weighted luminance
- Contrast ratio = `(lighter + 0.05) / (darker + 0.05)`
- Threshold: **2.5** (at least one pair in the 3 chosen colors must meet this)

This prevents days where all 3 colors blend together, which makes it hard to create
distinguishable artwork.

All 365 palettes are pre-filtered to ensure at least one 3-color combination passes
the contrast check. So in practice, the fallback path should never be reached.

## Scraping New Palettes from Coolors.co

If palettes need to be added or replaced (e.g., some are removed for quality):

1. Open [coolors.co](https://coolors.co) (any palette URL works as a starting point,
   e.g. `https://coolors.co/264653-2a9d8f-e9c46a-f4a261-e76f51`)
2. Press **spacebar** to generate random palettes — each press creates a new 5-color
   palette and updates the URL
3. The palette colors are in the URL path: `coolors.co/AAAAAA-BBBBBB-CCCCCC-DDDDDD-EEEEEE`
4. Collect palettes and convert to hex format: `["#aaaaaa", "#bbbbbb", ...]`

### Automated scraping

Use browser automation (e.g. Playwright MCP) to press spacebar in a loop, reading the
URL after each press:

```js
// Playwright example
for (let i = 0; i < 100; i++) {
  await page.keyboard.press('Space');
  await page.waitForTimeout(350);
  const url = page.url(); // https://coolors.co/XXXXX-XXXXX-XXXXX-XXXXX-XXXXX
  const colors = url.split('coolors.co/')[1].split('-').map(c => '#' + c);
  palettes.push(colors);
}
```

### Filtering

After scraping, filter palettes using the contrast check in `colorPicking.ts`:

```js
import { hasEnoughContrast, ALL_COMBOS } from './colorPicking';

const isGoodPalette = (palette) =>
  ALL_COMBOS.some(combo => hasEnoughContrast(combo.map(i => palette[i])));
```

Discard any palette where no 3-color combination has a contrast ratio >= 2.5.

## ColorTester (`?colors`)

The admin ColorTester at `?colors` previews palette color picks **client-side**. It
imports the same palettes and `pick3WithContrast` logic from the shared modules, so
the contrast rules match production.

**How it differs from production:**
- Uses `Math.random` instead of the date-seeded PRNG — each click gives a different
  random 3-of-5 pick (production is deterministic per date)
- Runs entirely client-side — no DB reads/writes, no edge function calls
- Useful for eyeballing palette quality and verifying the contrast filter works

## Deploying Changes

After modifying palette data or color picking logic:

```bash
supabase functions deploy get-daily-challenge
```

Existing challenges cached in the DB won't be affected. To regenerate a specific day's
colors, delete its row from the `challenges` table — the edge function will recreate it
on next request.
