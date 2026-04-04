# Design Spec: Ranking Confidence Indicator

## Context

Our ELO-based voting system produces unreliable rankings when voter turnout is low relative to submission count. We want to surface ranking confidence to users so they understand when rankings are solid vs. noisy.

The confidence is derived from a simple ratio: `voters / submissions`. Roughly, you need as many voters as submissions (with 5 required pairs each) for rankings to be statistically meaningful.

**Three confidence levels:**
| Level | Condition | Meaning |
|---|---|---|
| High | `voters >= submissions` | Rankings are reliable |
| Medium | `voters >= submissions × 0.5` | Rankings are roughly directional |
| Low | `voters < submissions × 0.5` | Rankings are noisy — take with a grain of salt |

---

## Locations

### 1. Winners Day Page — Challenge Details Card (right sidebar)

**File:** `src/pages/WinnersDayPage.tsx`
**Current state:** The card currently shows Inspiration (word), Colors, and Shapes.

**Add three new rows below "Shapes":**

```
Submissions     10
Voters           3
Ranking Confidence   [Low] [?]
```

- **Submissions** — total number of submissions for that day's challenge
- **Voters** — number of unique users who voted (distinct voter_id from comparisons where winner_id is not null)
- **Ranking Confidence** — the computed confidence level: "High", "Medium", or "Low"

The confidence value should have a visual treatment that communicates the level at a glance (see "Visual Treatment" below). Next to the confidence label, show an `InfoTooltip` (the existing `?` icon component) that explains what the confidence rating means on hover.

**Tooltip text (suggestion, refine as needed):**
> "Ranking confidence reflects how reliable the rankings are based on voter turnout. More voters relative to submissions means more accurate rankings. Low confidence means results may not reflect true community preference."

**Layout reference:** Match the existing label/value pattern in the card (label in `text-xs text-(--color-text-tertiary)`, value below in `text-base` or `text-sm`). The three new rows should feel like a natural extension of the existing card content, perhaps separated by a subtle divider from the challenge details above.

---

### 2. Winner Announcement Modal

**File:** `src/components/modals/WinnerAnnouncementModal.tsx`
**Current state:** Shows "Winners of [date]" heading, "Word of the day was [word]" subtitle, winner cards, and an "Awesome!" dismiss button.

**Add a small confidence indicator** somewhere in the modal — likely below the subtitle or above the dismiss button. This should be more compact than the sidebar version since the modal is focused on celebration, not analytics.

**Suggested format:** A single line like:
> "Ranked by 3 voters across 10 submissions · Low confidence [?]"

or a more compact version:
> "3 voters · 10 submissions · Low confidence [?]"

The `[?]` is the same `InfoTooltip` component, same tooltip text as above.

The confidence indicator should be subtle/secondary — it shouldn't dampen the celebratory tone of the modal but should be visible enough that users notice it.

---

## Visual Treatment for Confidence Levels

The confidence level needs a visual signifier beyond just the text label. Some options to explore:

### Option A: Colored badge/pill
A small pill/badge with background color indicating the level:
- **High** — a muted green or positive-tone background
- **Medium** — a muted amber/yellow background
- **Low** — a muted red/warm background

Challenge: Our theme system uses CSS variables and supports 4 themes × 2 modes. Hardcoded colors would break theme consistency. Consider whether semantic color tokens (like `--color-success`, `--color-warning`, `--color-danger`) exist or could be added, or whether the coloring should be theme-aware.

### Option B: Icon-based indicator
Use simple visual icons (e.g., filled/empty dots, a signal-strength-style icon, or checkmarks) alongside the text label. This avoids the color problem entirely and works across all themes.

### Option C: Text-only with weight/opacity variation
No color — just vary the font weight or opacity. "High" in normal weight, "Low" in a lighter/more muted treatment. Simplest approach, least visually distinct.

### Option D: Hybrid
Text label + a small colored dot or icon. The dot provides quick visual scanning while the text provides clarity. The dot color could potentially use `--color-accent` for high, `--color-text-tertiary` for medium, and a warm tone for low.

**Please mock up at least 2 of these options** so we can compare them in context.

---

## Existing Components to Reuse

- **`Tooltip`** and **`InfoTooltip`** (`src/components/shared/InfoTooltip.tsx`) — the `?` icon with hover tooltip. `InfoTooltip` takes a `text` prop and renders a 16px lucide `Info` icon that shows the tooltip on hover. Already used elsewhere in the app.
- **`Modal`** (`src/components/shared/Modal.tsx`) — the WinnerAnnouncementModal already uses this.
- **Design tokens** — all colors via `var(--color-*)`, spacing on 4px grid via `var(--space-*)`, typography via `var(--text-*)`. The card in the sidebar already uses `--color-bg-primary`, `--color-border`, `--radius-xl`, `--shadow-card`, `--border-width`.
- **Label pattern** — the sidebar card uses `text-xs text-(--color-text-tertiary)` for labels and regular weight for values. Follow this pattern for the new rows.

---

## Theme Considerations

The app has 4 themes (Pop Art, Swiss, Cloud, Brutalist) × 2 modes (light/dark) = 8 combinations. Design for **Theme A Pop Art (light)** first, but ensure the solution works across all themes:

- Never hardcode colors — use CSS variables
- Pop Art has chunky borders (`2px solid`) and drop shadows (`4px 4px 0`)
- Swiss is minimal with subtle shadows
- Cloud is soft with rounded corners and diffuse shadows
- Brutalist is sharp/angular

If colored confidence badges are used, the color values may need to be added as new semantic tokens in the theme system (e.g., `--color-confidence-high`, `--color-confidence-medium`, `--color-confidence-low`) so each theme can define appropriate values. Alternatively, avoid theme-specific colors entirely with the icon-based approach.

---

## Summary of Deliverables

1. **Challenge Details card** — mock up the three new rows (Submissions, Voters, Ranking Confidence) integrated into the existing sidebar card on the Winners Day page, with InfoTooltip on the confidence row
2. **Winner Announcement Modal** — mock up a compact confidence indicator integrated into the existing modal layout
3. **Confidence visual treatment** — mock up at least 2 visual options (e.g., colored pill vs. icon-based) for the confidence level indicator
4. **Theme check** — show that the chosen approach works in at least 2 themes (Pop Art light + one other)
