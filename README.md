# shapepaint.com

A daily art challenge app where you create art using only 3 colors and 2 geometric shapes.

https://shapepaint.com

- **Domain**: `shapepaint.com` registered at [Loopia.se](https://loopia.se), using Netlify DNS (nameservers pointed from Loopia → Netlify)
- **Previous domain**: `2colors2shapes.com` (also Loopia, same setup) — 301 redirects to shapepaint.com via `netlify.toml`
- **Hosting**: [Netlify](https://netlify.com) with automatic SSL via Let's Encrypt
- **Auth**: Google OAuth via Supabase — consent screen configured in [Google Cloud Console](https://console.cloud.google.com)
- **SEO**: [Google Search Console](https://search.google.com/search-console) — domain verified via DNS TXT record in Netlify DNS

### Changing the domain

If migrating to a new domain, update all of these:

1. **Loopia** — register new domain, point nameservers to Netlify (found in Netlify → Domain management → Netlify DNS)
2. **Netlify** — add new domain to site, set as primary domain. Renew SSL cert if needed (Domain management → HTTPS → Renew certificate). Rename project to match.
3. **Supabase** (Authentication → URL Configuration) — add new domain to Redirect URLs, then once live: update Site URL, swap netlify.app redirect URL to new project name
4. **Google Cloud Console** (APIs & Services):
   - OAuth consent screen → Branding: update app name, home page, privacy policy URL, add authorized domain
   - Clients → OAuth client: add new domain to Authorized JavaScript origins, update netlify.app origin if project renamed
5. **Google Search Console** — add new domain property, verify via DNS TXT record (added in Netlify DNS), submit sitemap
6. **Codebase** — update URLs in `index.html` (OG/Twitter/canonical/structured data), `public/robots.txt`, `public/sitemap.xml`, `README.md`. Add 301 redirect from old domain in `netlify.toml`
7. **Deploy** — build and deploy via `netlify deploy --prod --dir=dist`

## Concept

Every day, the app generates a unique set of constraints:
- **3 Colors**: Three visually distinct colors (ensured to be different enough to distinguish)
- **2 Shapes**: Two geometric shapes from 41 available shapes including basic shapes (circle, square, triangle, etc.), sophisticated polygons (diamond, trapezoid, parallelogram, etc.), and irregular abstract shapes with mixed straight/curved edges
- **1 Word** (optional): A daily word for creative inspiration — interpret it however you like, or ignore it entirely!

The same date always generates the same colors, shapes, and word (seed-based randomization).

## Features

### Current
- **800x800 SVG Canvas**: Create your art on a square canvas
- **Figma-style manipulation**:
  - Drag shapes to move them
  - Drag corner handles to resize
  - Drag rotation handles to rotate (handles on all 4 sides, hold Shift for 15° snapping)
  - Arrow keys to move selected shape (hold Shift for 10px steps)
  - Period/Comma keys to rotate (hold Shift for 15° steps)
  - Z to undo, Shift+Z to redo
  - D to duplicate selected shape
- **Customizable keyboard shortcuts**:
  - Click "Customize" in the Controls section to open keyboard settings
  - Remap any shortcut to your preferred key
  - Automatic conflict detection and resolution
  - Settings sync to cloud for logged-in users, localStorage for anonymous users
- **Multi-select**:
  - Shift+click on shapes or layers to select multiple
  - Combined bounding box encompasses all selected shapes (rotation-aware)
  - Move, resize, or rotate multiple shapes as a group
  - Shift+click selected shape to remove from selection
- **Layer system**:
  - Reorder shapes (bring to front, send to back, move up/down)
  - Visual layer panel showing all shapes
  - Click layers to select shapes
  - Double-click layer name to rename
  - Group multiple layers together for organization
  - Collapsible groups with expand/collapse toggle
  - Click group header to select all shapes in group
  - Rename groups by double-clicking the group name
- **Background toggle**: Set canvas background to either daily color or white
- **Auto-save**: Canvas state persists in localStorage (resets when the day changes)
- **Reset**: Clear canvas with confirmation dialog
- **User authentication**: Sign in with Google OAuth
- **Save submissions**: Save your creations to the cloud
- **Calendar view**: Browse your past submissions
  - Monthly grid showing thumbnails of your work
  - Navigate between months/years
  - Click any day to view full submission in new tab
  - Download as PNG or SVG
  - Copy shareable link
- **Welcome modal**: First-time visitors see an intro explaining the app
- **Action toolbar**: Mouse-friendly toolbar at top of canvas
  - Buttons for undo/redo, duplicate, delete, move, and rotate actions
  - Tooltips show action name and keyboard shortcut on hover
  - Collapsible to save screen space
  - Disabled states when actions aren't available (e.g., no selection)
- **Mirroring**: Flip shapes horizontally or vertically
- **Zoom & pan**: Zoom in/out with controls or scroll wheel, pan the canvas
- **Grid lines**: Toggle alignment grid for precise positioning
  - Rule of thirds lines (divides canvas into 9 equal sections)
  - Center lines (divides canvas into 4 quadrants)
  - Toggle with G key or toolbar button
  - Grid state saved in localStorage
  - Grid lines are editor-only (not included in exports)
- **Off-canvas shapes**: Toggle visibility of shapes outside the 800x800 canvas
  - Build "components" off-canvas and bring them in when ready
  - Toggle via button in the View section of the toolbar
  - Off-canvas shapes are visible for editing but not included in exports
  - Setting saved in localStorage
- **Touchscreen support**: Full touch gesture support for tablets and mobile devices
  - Tap to select shapes, tap empty space to deselect
  - Tap and drag to move shapes
  - Two-finger pinch to scale selected shapes (or zoom canvas when nothing selected)
  - Two-finger rotate to rotate selected shapes
  - Long press (hold 500ms) on a shape for context menu with quick actions
  - Layer panel shows action buttons inline (always visible, not hover-only)
  - "Select Multiple" toggle for multi-selecting layers without modifier keys
- **Voting system**: Vote on submissions using ELO-based pairwise comparison
  - Vote on pairs of yesterday's submissions to help rank the artwork
  - Cast 5 votes to enter the ranking yourself
  - Skip pairs if you can't decide
  - Timeline: Day X artwork is voted on during Day X+1, results shown Day X+2
- **Daily rankings**: ELO-based ranking system for submissions
  - Rankings computed from community votes
  - View your rank and total participants
- **Winner announcement**: See the top 3 submissions from the most recent completed ranking
  - Shown on first login of the day
  - Displays winners from 2 days ago (since yesterday's voting just completed their ranking)
- **Admin dashboard**: Real-time statistics for site administrators
  - Total users and recent signups (last 7 days)
  - Total submissions and submissions per day chart
  - Votes per day chart
  - Access restricted to users with admin role


## Tech Stack

- **Vite** + **React** + **TypeScript**
- **SVG** for rendering (React-managed DOM elements)
- **Supabase** for authentication, database, and edge functions
- **localStorage** for canvas auto-save

## Getting Started

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
```

### Docker Dev Mode

The reason we even have this is because we want to run agents safely. This allows us to run the Ralph loop (ralph-afk.sh), which runs Claude without requiring persmissions for everything. But to do this safely we want to isolate the AI from the host machine, so we use [Docker sandboxes](https://docs.docker.com/ai/sandboxes/). This works well, but the environment inside is isolated from out own (except for file syncing), so we can't view the dev server running in the agent's sandbox directly on our host machine. And because the environment inside the sandbox is Linux ARM64 (and our Mac is Darwin ARM64), we can't just run the dev server directly on our host either, because the node_modules which the agent has installed conflict with ours. As such, to view the dev server on our host, we could either remove and reinstall the node_modules every time we switch between running locally and in the sandbox (annoying), or we can run the dev server itself in a Docker container with the same architecture as the sandbox (Linux ARM64). This way, the dev server runs in an environment compatible with the node_modules installed by the agent inside the sandbox, and we can still view it on our host machine:

```bash
npm run dev:docker
```

See [AI/docker-sandbox.md](AI/docker-sandbox.md) for details.

## Deployment

This project is hosted on Netlify. **Automatic builds are disabled** to conserve credits.

### Manual Deployment via CLI

1. Login to Netlify (first time only):
   ```bash
   netlify login
   ```

2. Build and deploy:
   ```bash
   # Deploy to production (will also build)
   netlify deploy --prod --dir=dist
   ```

   Or for a preview deploy (doesn't affect production):
   ```bash
   netlify deploy --dir=dist
   ```

### Why manual deploys?

Netlify charges credits per build. With automatic builds enabled, every push to `main` triggers a build. Manual deploys let you control when builds happen, reducing credit usage.

## Development

### Supabase & Local Development

This project uses Supabase for authentication and storing submissions. Important notes:

- **Local dev uses the production database** - The `.env.local` file points to the same Supabase instance as production. Any submissions you save locally are saved to the real database.
- **Same account, same data** - If you sign in with the same Google account locally and on the production site, you'll see the same submissions in both places.
- **Offline limitations** - The canvas works offline (uses localStorage), but authentication and saving submissions require an internet connection.

If you wanted a separate development database, you would need to create a second Supabase project and use different environment variables.

### Supabase Edge Functions

Edge functions (located in `supabase/functions/`) handle server-side logic like the voting/rating system. They run on **Deno**, not Node.js.

#### Prerequisites for IDE Support

To avoid TypeScript errors in your IDE when editing edge functions:

1. Install the [Deno extension for VSCode](https://marketplace.visualstudio.com/items?itemName=denoland.vscode-deno)
2. The project includes a `deno.json` in `supabase/functions/` that configures imports

Without the Deno extension, you'll see errors like "Cannot find module" for Deno-specific imports.

#### Supabase CLI Commands

First, install the Supabase CLI if you haven't:
```bash
# macOS
brew install supabase/tap/supabase

# npm (alternative)
npm install -g supabase
```

Login to Supabase (first time only):
```bash
supabase login
```

Link your local project to your Supabase project:
```bash
supabase link --project-ref <your-project-ref>
```

Common commands:
```bash
# Deploy all edge functions to production
supabase functions deploy

# Deploy a specific function
supabase functions deploy process-vote

# Serve functions locally for testing
supabase functions serve

# View function logs
supabase functions logs process-vote

# List all functions
supabase functions list
```

#### Environment Variables

Edge functions use these environment variables (automatically available in Supabase):
- `SUPABASE_URL` - Your project URL
- `SUPABASE_ANON_KEY` - Public anon key
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (server-side only)

## Developer Tools

### Shape Explorer

A developer tool that displays all 41 available shape types with sample renderings. Useful as a reference when working with the daily challenges.

**Available shapes:**
- Basic: Circle, Square, Triangle, Pentagon, Hexagon, Star
- Triangular: Right Triangle, Isosceles Triangle
- Quadrilaterals: Diamond, Trapezoid, Parallelogram, Kite, Heptagon
- Curved: Semicircle, Quarter Circle, Ellipse, Blade, Lens, Drop
- Special: Cross, Arrow, Arch
- Abstract: Shard, Wedge, Fan, Hook, Wave, Crescent, Pill, Splinter, Chunk
- Mixed (straight + curved): Fang, Claw, Fin, Keyhole, Slant, Notch, Spike, Bulge, Scoop, Ridge

**Access via URL parameter:**
```
http://localhost:5173/?explorer
```

**Or via environment variable:**
```bash
VITE_SHAPE_EXPLORER=true npm run dev
```

### Visual Demo Pages (Not Automated Tests)

The `src/test/` directory contains **visual demo pages** for manually inspecting UI components in various states. These are similar to Storybook - they render components with mock data for visual inspection, but they do **not** run automated assertions or provide test coverage.

**Important limitations:**
- No automated assertions or test coverage
- Some demo components (e.g., `FollowButtonDemo`) are standalone reimplementations, not the actual production components
- Mock data may drift from actual component props over time
- Requires manual visual inspection to catch issues

**Available demo pages:**

#### Voting Test Page (`?test=voting`)
Visual demo for voting-related components with mock data.

```
http://localhost:5173/?test=voting
```

Scenarios: Voting UI, Interactive Flow, Vote Progress states, Dynamic Threshold, No More Pairs, Bootstrap states, Winner announcements (normal, tied, three-way tie), Calendar with Trophies.

#### Social Test Page (`?test=social`)
Visual demo for social features (Wall of the Day, Follow system, Friends modal).

```
http://localhost:5173/?test=social
```

Scenarios: Wall (locked/grid), Follow Button states, Friends Modal, User Profile, Friends Feed.

### Admin Dashboard

View real-time statistics about users, submissions, and voting activity. Requires admin privileges.

**Access via URL parameter:**
```
http://localhost:5173/?view=dashboard
```

**Granting admin access:**
Run this SQL in Supabase SQL Editor to grant admin access to a user:
```sql
SELECT set_admin_status('user@example.com', true);
```

Or directly update the profile:
```sql
UPDATE profiles SET is_admin = true WHERE id = (
  SELECT id FROM auth.users WHERE email = 'user@example.com'
);
```

## Testing

## Agent Browser/visual Testing

The agent can log in, allowing them to see and test many of the features (which are hidden behind a login). The account has admin privileges (`is_admin: true`), letting them also e.g. view the admin dashboard.

**Credentials:** 
See `TEST_USER_EMAIL` and `TEST_USER_PASSWORD` in `.env.local`

**Login from browser:**
- Browser console: `import('./lib/supabase').then(m => m.testLogin(email, password))`

**Login from Node.js script:**
```js
const { testLogin } = await import('./src/lib/supabase.ts');
await testLogin('agent@test.local', 'vbe2HJG7tfu*qvq0jrt');
```

**Login from React component:**
```js
const { signInWithEmail } = useAuth();
await signInWithEmail('agent@test.local', 'vbe2HJG7tfu*qvq0jrt');
```


### Unit Tests

Run unit tests with Vitest:

```bash
# Run tests in watch mode
npm test

# Run tests once
npm run test:run
```

**Test coverage:**
- **ELO calculation** (`src/utils/__tests__/elo.test.ts`): Tests for the ELO rating algorithm including expected scores, rating changes, upset wins, and edge cases
- **Voting rules** (`src/utils/__tests__/votingRules.test.ts`): Tests for vote eligibility, progress tracking, and state transitions

### Pure Utility Functions

The voting system uses pure functions that can be unit tested independently:

- `calculateElo(ratingA, ratingB, winner)` - ELO rating calculation
- `calculateExpectedScore(ratingA, ratingB)` - Expected win probability
- `hasEnoughSubmissions(count)` - Check minimum submission requirement
- `hasEnteredRanking(voteCount)` - Check if user entered ranking
- `voteProgressPercentage(voteCount)` - Calculate progress bar percentage
- `determineVotingState(options)` - Determine current voting state

## Project Structure

```
src/
├── components/
│   ├── Canvas.tsx        # Main SVG canvas with shape rendering
│   ├── ShapeElement.tsx  # Individual shape SVG component
│   ├── TransformHandles.tsx # Resize/rotate handles for selected shape
│   ├── LayerPanel.tsx    # Sidebar for layer management
│   ├── Toolbar.tsx       # Left sidebar with controls
│   ├── ActionToolbar.tsx # Top toolbar with action buttons
│   ├── Calendar.tsx      # Calendar modal for browsing submissions
│   ├── SubmissionThumbnail.tsx # Thumbnail renderer for submissions
│   ├── SubmissionDetailPage.tsx # Full submission view with export
│   └── ZoomControls.tsx  # Zoom in/out and reset controls
├── hooks/
│   ├── useCanvasState.ts # State management + localStorage persistence
│   ├── useAuth.ts        # Google OAuth authentication
│   ├── useProfile.ts     # User profile management
│   ├── useSubmissions.ts # Submission CRUD operations
│   ├── useWelcomeModal.ts # First-visit welcome modal state
│   ├── useKeyboardSettings.ts # Custom keyboard shortcut settings
│   ├── useVoting.ts      # Pairwise voting system
│   ├── useRanking.ts     # ELO rankings and leaderboard
│   ├── useWinnerAnnouncement.ts # Yesterday's winner modal
│   ├── useViewportState.ts # Zoom and pan state
│   └── useGridState.ts   # Grid lines visibility state
├── constants/
│   └── keyboardActions.ts # Keyboard action definitions and helpers
├── utils/
│   ├── dailyChallenge.ts # Seed-based color/shape generation
│   ├── shapeHelpers.ts   # SVG path generation for shapes
│   ├── elo.ts            # ELO rating calculation
│   ├── votingRules.ts    # Voting eligibility rules
│   └── __tests__/        # Unit tests for utilities
├── test/
│   ├── mockData.ts       # Mock data for visual testing
│   └── VotingTestPage.tsx # Visual test page for voting
├── types/
│   └── index.ts          # TypeScript type definitions
├── lib/
│   └── supabase.ts       # Supabase client configuration
├── App.tsx
└── main.tsx
```

## Adding Shapes

There are two ways to add shapes to the system:

1. **Parameterized** — Write a function that generates SVG path data scaled to any size (e.g., `getDropPath(width, height)`). Best for simple geometric shapes.
2. **Figma export** — Paste a fixed SVG path exported from Figma. The system scales it automatically via nested `<svg>` viewBox. Best for complex or designer-crafted shapes.

See [docs/adding-shapes.md](docs/adding-shapes.md) for full instructions.

## How the Daily Challenge Works

1. The current date (YYYY-MM-DD) is hashed to create a numeric seed
2. A seeded random number generator (mulberry32) ensures deterministic output
3. 3 of 5 colors are picked from the day's palette with a contrast check (see below)
4. Two shapes are randomly selected from the available set
5. Shape selection avoids repeating yesterday's pair

## Color System

Colors come from 365 curated Coolors.co palettes, with contrast-aware picking to ensure usable color combinations. See [docs/color-system.md](docs/color-system.md) for full details on how palettes are sourced, filtered, and how color picking works.

After updating color generation code, you **MUST** deploy:
```bash
supabase functions deploy get-daily-challenge
```


## License

MIT
