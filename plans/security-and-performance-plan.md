# Security & Performance Plan

Production readiness audit for Shapepaint. Covers security vulnerabilities, performance bottlenecks, data integrity, and scalability.

## Architecture

- **Frontend**: Vite + React 19 SPA on Netlify
- **Backend**: Supabase (Postgres + Auth + Edge Functions + Storage)
- **Auth**: Supabase Auth (Google OAuth + email/password)
- **Mutations**: Client-side via Supabase SDK (RLS-protected) + Edge Functions for voting
- **Indexes**: Well-covered (`submissions_date_idx`, `submissions_user_date_idx`, `submissions_likes_sort_idx`, `daily_rankings_date_rank_idx`)

## What's Already Solid

- **RLS on all tables** - users can only write their own data
- **No XSS vectors** - zero `dangerouslySetInnerHTML`, all SVG paths hardcoded
- **No SQL injection** - all queries via Supabase SDK (parameterized)
- **No external scripts/CDNs** - everything bundled locally
- **User IDs from session** - all mutations derive `user_id` from `auth.uid()`, never from client input
- **Vote processing server-side** - Elo calculations in edge function, not client
- **Storage bucket RLS** - avatar uploads path-scoped to user folder
- **Zero npm audit vulnerabilities**
- **Good existing caching** - challenge data has 3-layer cache, wall has request dedup

---

## 1. Vote Double-Submission Vulnerability

**Severity**: CRITICAL (security)
**Files**: `supabase/functions/process-vote/index.ts`, `supabase/migrations/002_ranking.sql`

### Problem

The edge function inserts `submissionAId` and `submissionBId` as-is from the client request without normalizing order:

```typescript
// process-vote/index.ts:156-163 — current code
const { error: comparisonError } = await supabaseAdmin.from('comparisons').insert({
  voter_id: user.id,
  challenge_date: challengeDate,
  submission_a_id: submissionAId,   // <-- as-is from request
  submission_b_id: submissionBId,   // <-- as-is from request
  winner_id: winnerId,
});
```

The UNIQUE constraint is `(voter_id, submission_a_id, submission_b_id)` — directional. A malicious user can:

1. Vote on pair (A, B) normally via the UI
2. Send a manual API request with (B, A) — different unique key, passes the constraint
3. Both votes count, corrupting Elo scores

The `get_next_pair()` function checks both orientations in its `NOT EXISTS` clause, so the pair won't be shown again — but the double vote already happened.

### Fix

**Part 1 — Edge function: normalize order before insert**

```typescript
// process-vote/index.ts — add after validation, before insert

// Normalize pair order so (A,B) and (B,A) are stored identically
const [normalizedA, normalizedB] = submissionAId < submissionBId
  ? [submissionAId, submissionBId]
  : [submissionBId, submissionAId];

// Map winnerId to normalized pair
const normalizedWinnerId = winnerId; // winnerId is the actual submission ID, stays the same

// Use normalizedA/normalizedB for the insert:
const { error: comparisonError } = await supabaseAdmin.from('comparisons').insert({
  voter_id: user.id,
  challenge_date: challengeDate,
  submission_a_id: normalizedA,
  submission_b_id: normalizedB,
  winner_id: normalizedWinnerId,
});
```

**Part 2 — DB constraint: prevent bypass**

```sql
-- New migration: xxx_fix_comparisons_constraint.sql
ALTER TABLE comparisons
  ADD CONSTRAINT ordered_pair CHECK (submission_a_id < submission_b_id);
```

The CHECK constraint adds <0.1ms per INSERT (simple UUID string comparison). Zero impact on reads.

### Verification

```bash
# After deploying, attempt a reversed-pair vote:
curl -X POST "$SUPABASE_URL/functions/v1/process-vote" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"submissionAId": "<larger-uuid>", "submissionBId": "<smaller-uuid>", "winnerId": null}'
# Should succeed (edge function normalizes order)

# Direct DB insert with reversed order should fail:
# INSERT INTO comparisons (voter_id, submission_a_id, submission_b_id, ...)
# VALUES (..., '<larger-uuid>', '<smaller-uuid>', ...)
# ERROR: new row violates check constraint "ordered_pair"
```

---

## 2. Duplicate RLS Policies on Submissions Table

**Severity**: HIGH (data integrity + maintenance risk)
**File**: New migration to clean up

### Problem

The live `submissions` table has duplicate RLS policies (likely from running migrations that didn't `DROP POLICY IF EXISTS` first):

| Policy Name | Command | Duplicate? |
|---|---|---|
| "Users can delete own submissions" | DELETE | Yes |
| "Users can delete their own submissions" | DELETE | Yes (identical) |
| "Users can insert own submissions" | INSERT | Yes |
| "Users can insert their own submissions" | INSERT | Yes (identical) |
| "Users can update own submissions" | UPDATE | Missing `with_check` |
| "Users can update their own submissions" | UPDATE | Has `with_check` |

Postgres evaluates ALL matching policies with OR logic. While functionally harmless (OR of identical conditions = same condition), it:
- Doubles policy evaluation time on every query
- Creates maintenance confusion
- The UPDATE policy without `with_check` is less restrictive than intended

### Fix

```sql
-- New migration: xxx_cleanup_submissions_rls.sql

-- Remove duplicate DELETE policies (keep one)
DROP POLICY IF EXISTS "Users can delete own submissions" ON submissions;

-- Remove duplicate INSERT policies (keep one)
DROP POLICY IF EXISTS "Users can insert own submissions" ON submissions;

-- Remove the UPDATE policy missing with_check, keep the complete one
DROP POLICY IF EXISTS "Users can update own submissions" ON submissions;

-- Also remove redundant profile SELECT policy
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
-- "Anyone can read profiles" already covers this with qual=true
```

### Verification

```sql
SELECT policyname, cmd, qual, with_check FROM pg_policies
WHERE tablename = 'submissions' ORDER BY cmd;
-- Should show exactly 1 policy per command (SELECT, INSERT, UPDATE, DELETE)
```

---

## 3. Security Headers Missing on Netlify

**Severity**: HIGH (security)
**File**: `netlify.toml`

### Problem

No security headers are set. The app can be:
- **Framed** (clickjacking) — attacker embeds the voting page in an iframe with invisible overlays
- **MIME-sniffed** — browser could interpret uploaded avatars as executable content
- **Referrer-leaked** — full URLs with user IDs leak to external sites

### Fix

```toml
# Add to netlify.toml:

[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"
    Permissions-Policy = "geolocation=(), microphone=(), camera=()"
```

Not adding CSP — it's complex with Supabase + inline styles, and XSS risk is already very low (React, no `dangerouslySetInnerHTML`).

### Verification

After deploy, check in browser DevTools > Network tab > any response > Response Headers.

---

## 4. Canvas Payload Has No Size Limits

**Severity**: HIGH (abuse prevention)
**Files**: `src/hooks/submission/useSubmissions.ts`, new migration

### Problem

Users can create arbitrarily large canvas data (thousands of shapes). This JSON is stored in Supabase and loaded by every voter viewing the wall. A single malicious 10MB submission could slow down the experience for all users.

### Fix

**Part 1 — Client-side validation**

```typescript
// src/hooks/submission/useSubmissions.ts — in upsertSubmission(), before the DB call:

const MAX_SHAPES = 200;

if (params.shapes.length > MAX_SHAPES) {
  return { error: `Maximum ${MAX_SHAPES} shapes per canvas` };
}
```

**Part 2 — DB constraint (belt and suspenders)**

```sql
-- New migration: xxx_canvas_payload_limits.sql
ALTER TABLE submissions
  ADD CONSTRAINT max_shapes CHECK (jsonb_array_length(shapes) <= 200);
```

200 is generous (typical artwork uses 10-50 shapes) but prevents abuse.

### Verification

Try to save a canvas with 201+ shapes — should be rejected client-side with a message. If the client validation is bypassed, the DB constraint catches it.

---

## 5. Error Boundary Missing

**Severity**: MEDIUM (UX + error visibility)
**File**: `src/App.tsx`

### Problem

If any component throws during render, the entire app crashes to a white screen. No recovery, no error reporting.

### Fix

```tsx
// src/components/shared/ErrorBoundary.tsx
import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', height: '100vh', gap: '16px',
          fontFamily: 'system-ui', color: 'var(--color-text-primary, #333)',
        }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 600 }}>Something went wrong</h1>
          <p style={{ color: 'var(--color-text-secondary, #666)' }}>
            Please refresh the page to try again.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '8px 16px', borderRadius: '8px', cursor: 'pointer',
              background: 'var(--color-accent, #3B82F6)', color: 'white',
              border: 'none', fontSize: '0.875rem', fontWeight: 500,
            }}
          >
            Refresh
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
```

```tsx
// src/App.tsx — wrap the app root:
<ErrorBoundary>
  <RouterProvider router={router} />
</ErrorBoundary>
```

---

## 6. Admin Routes Loaded for Non-Admin Users

**Severity**: MEDIUM (code exposure)
**File**: `src/App.tsx`

### Problem

Admin pages (Dashboard, ShapeExplorer, ColorTester) are lazy-loaded for all users. The component checks `is_admin` after loading, but the code bundle is still downloaded. Data is protected (edge function checks admin), but the UI code leaks admin features.

### Fix

Gate admin routes behind the admin check so non-admin users don't even download the bundle:

```tsx
// Instead of always registering admin routes:
{isAdmin && (
  <>
    <Route path="/dashboard" element={<Suspense fallback={<Loading />}><Dashboard /></Suspense>} />
    <Route path="/shape-explorer" element={<Suspense fallback={<Loading />}><ShapeExplorer /></Suspense>} />
    <Route path="/color-tester" element={<Suspense fallback={<Loading />}><ColorTester /></Suspense>} />
  </>
)}
```

---

## 7. Server-Side Sorting for Wall & Friends Grid

**Severity**: HIGH (correctness)
**Files**: `src/components/Wall/WallSortControls.tsx`, `src/lib/api.ts`, `src/hooks/challenge/useWallOfTheDay.ts`, `src/hooks/social/useFriendsFeed.ts`, new migration

### Problem

Both wall and friends grid views fetch submissions without server-side ordering, then sort client-side. Current code in `useWallOfTheDay.ts:206-260`:

```typescript
// Current: fetch unordered, sort in JS
const sortedSubmissions = (() => {
  switch (sortMode) {
    case 'random':
      // Fisher-Yates shuffle of pre-fetched data
      sorted = shuffledIds.map(id => idToSubmission.get(id)).filter(Boolean);
      break;
    case 'newest':
      sorted = [...submissions].sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      break;
    case 'likes':
      sorted = [...submissions].sort((a, b) => b.like_count - a.like_count);
      break;
    // ...
  }
  return sorted.slice(0, displayLimit); // pagination on client-sorted data
})();
```

This breaks with pagination: if there are 300 submissions and you sort by "likes" but only load 100, you see the top-liked among a random 100 — not the globally top-liked.

### Fix

**Step 1: Remove `random` sort option**

True random can't be paginated or cached server-side. Remove from `SortMode` and `WallSortControls`. Change default to `newest`.

```typescript
// WallSortControls.tsx
export type SortMode = 'newest' | 'oldest' | 'ranked' | 'likes';

const SORT_LABELS: Record<SortMode, string> = {
  newest: 'Newest',
  oldest: 'Oldest',
  ranked: 'Ranked',
  likes: 'Likes',
};
```

**Step 2: Add sort parameter to fetch functions**

```typescript
// src/lib/api.ts

export type WallSortMode = 'newest' | 'oldest' | 'likes';

export async function fetchWallSubmissionsFromDB(
  date: string,
  limit: number,
  sortMode: WallSortMode = 'newest',
  offset: number = 0
) {
  let query = supabase
    .from('submissions')
    .select('id, user_id, shapes, groups, background_color_index, created_at, like_count')
    .eq('challenge_date', date)
    .eq('included_in_ranking', true);

  // Server-side ordering
  switch (sortMode) {
    case 'newest':
      query = query.order('created_at', { ascending: false });
      break;
    case 'oldest':
      query = query.order('created_at', { ascending: true });
      break;
    case 'likes':
      // Uses existing index: submissions_likes_sort_idx (challenge_date, like_count DESC, created_at)
      query = query
        .order('like_count', { ascending: false })
        .order('created_at', { ascending: true });
      break;
  }

  query = query.range(offset, offset + limit - 1);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

// For "ranked" mode, use a separate function that queries daily_rankings with a join:
export async function fetchWallSubmissionsRanked(date: string, limit: number, offset: number = 0) {
  const { data, error } = await supabase
    .from('daily_rankings')
    .select(`
      final_rank, submission_id, user_id, elo_score, vote_count,
      submissions!inner (id, shapes, groups, background_color_index, created_at, like_count)
    `)
    .eq('challenge_date', date)
    .not('final_rank', 'is', null)
    .order('final_rank', { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return data;
}
```

**Step 3: Remove client-side sorting from hooks**

In `useWallOfTheDay.ts`, remove the entire `sortedSubmissions` switch block. The data comes pre-sorted from the DB. When sort mode changes, re-fetch with the new sort parameter (cache keyed by `date-sortMode`).

```typescript
// useWallOfTheDay.ts — simplified
const [sortMode, setSortMode] = useState<SortMode>('newest');
const [offset, setOffset] = useState(0);

const fetchData = useCallback(async () => {
  setLoading(true);

  const cacheKey = `wall-${date}-${sortMode}`;
  if (wallCache.has(cacheKey)) {
    setSubmissions(wallCache.get(cacheKey)!);
    setLoading(false);
    return;
  }

  let data;
  if (sortMode === 'ranked') {
    data = await fetchWallSubmissionsRanked(date, INITIAL_LIMIT + 1);
    // Map ranked data to WallSubmission format...
  } else {
    data = await fetchWallSubmissionsFromDB(date, INITIAL_LIMIT + 1, sortMode);
    // Map to WallSubmission format...
  }

  wallCache.set(cacheKey, mapped);
  setSubmissions(mapped);
  setLoading(false);
}, [date, sortMode]);

// When sort mode changes, re-fetch
const handleSetSortMode = useCallback((mode: SortMode) => {
  setSortMode(mode);
  setOffset(0);  // Reset pagination
}, []);
```

**Step 4: Add index for newest/oldest**

```sql
-- New migration
CREATE INDEX IF NOT EXISTS idx_submissions_date_created
  ON submissions(challenge_date, created_at DESC);
```

The `likes` sort already has a perfect index (`submissions_likes_sort_idx`). The `ranked` sort uses `daily_rankings_date_rank_idx`.

### Same approach for Friends Feed

`useFriendsFeed.ts` uses the same sorting pattern. Apply identical changes: server-side ordering via `fetchFriendsSubmissionsFromDB()` with sort parameter.

---

## 8. Rate Limiting on Mutations

**Severity**: HIGH (abuse prevention)
**Files**: New migration for Postgres trigger function

### Problem

| Operation | Current Protection | Vulnerable? |
|---|---|---|
| Vote | Edge function + UNIQUE constraint | Low risk |
| Like/Unlike | Client-side RLS only | **YES** — can spam toggle |
| Follow/Unfollow | Client-side RLS only | **YES** — can spam toggle |
| Submit artwork | UNIQUE(user_id, challenge_date) | Low risk |

### Fix: Postgres Trigger Rate Limiting

Create a reusable rate limit function and attach triggers to vulnerable tables. Supabase fully supports Postgres triggers — the codebase already uses them (`increment_like_count` in `009_likes.sql`).

```sql
-- New migration: xxx_rate_limiting.sql

-- Reusable rate limit function
-- Checks: "has this user inserted into this table more than N times in the last M seconds?"
CREATE OR REPLACE FUNCTION check_rate_limit()
RETURNS TRIGGER AS $$
DECLARE
  max_requests INTEGER;
  window_seconds INTEGER;
  user_column TEXT;
  recent_count INTEGER;
  user_id_value UUID;
BEGIN
  -- Get config from trigger arguments
  max_requests := TG_ARGV[0]::INTEGER;    -- e.g., 10
  window_seconds := TG_ARGV[1]::INTEGER;  -- e.g., 60
  user_column := TG_ARGV[2];              -- e.g., 'user_id' or 'follower_id'

  -- Get the user ID from the new row dynamically
  EXECUTE format('SELECT ($1).%I', user_column) INTO user_id_value USING NEW;

  -- Count recent inserts by this user
  EXECUTE format(
    'SELECT COUNT(*) FROM %I.%I WHERE %I = $1 AND created_at > NOW() - INTERVAL ''%s seconds''',
    TG_TABLE_SCHEMA, TG_TABLE_NAME, user_column, window_seconds
  ) INTO recent_count USING user_id_value;

  IF recent_count >= max_requests THEN
    RAISE EXCEPTION 'Rate limit exceeded. Maximum % requests per % seconds.',
      max_requests, window_seconds
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach to likes: max 20 likes per 60 seconds
CREATE TRIGGER rate_limit_likes
  BEFORE INSERT ON likes
  FOR EACH ROW
  EXECUTE FUNCTION check_rate_limit('20', '60', 'user_id');

-- Attach to follows: max 10 follows per 60 seconds
CREATE TRIGGER rate_limit_follows
  BEFORE INSERT ON follows
  FOR EACH ROW
  EXECUTE FUNCTION check_rate_limit('10', '60', 'follower_id');
```

**Why this approach?**
- Works for ALL client mutations without changing client code
- Runs inside the DB transaction — can't be bypassed
- Reusable function with configurable thresholds
- Already a pattern in the codebase (triggers on likes, keyboard_settings)
- Adds ~1ms per insert (queries `created_at` with existing timestamps)

### Verification

```javascript
// Browser console — rapid-fire likes:
for (let i = 0; i < 25; i++) {
  supabase.from('likes').insert({ user_id: userId, submission_id: someId + i });
}
// First 20 should succeed, last 5 should fail with "Rate limit exceeded"
```

---

## 9. Wall Calendar Counts Fetched Inefficiently

**Severity**: MEDIUM (performance)
**Files**: `src/lib/api.ts`, `src/components/Wall/WallContent.tsx`, new migration

### Problem

The wall calendar view fetches ALL `challenge_date` values for a month range and counts client-side:

```typescript
// Current: api.ts — fetchSubmissionCountsByDateRange
const { data } = await supabase
  .from('submissions')
  .select('challenge_date')               // returns one row per submission
  .gte('challenge_date', startDate)
  .lte('challenge_date', endDate)
  .eq('included_in_ranking', true);

// Then counts client-side:
data.forEach((s) => {
  counts[s.challenge_date] = (counts[s.challenge_date] || 0) + 1;
});
```

If a day has 500 submissions, this returns 500 rows just to produce `count=500`. The friends calendar already has an optimized RPC (`count_friends_submissions_by_date`).

### Fix

```sql
-- New migration: xxx_count_submissions_rpc.sql

CREATE OR REPLACE FUNCTION count_submissions_by_date(
  p_start_date TEXT,
  p_end_date TEXT
)
RETURNS TABLE (challenge_date TEXT, submission_count BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT s.challenge_date, COUNT(*)::BIGINT
  FROM submissions s
  WHERE s.challenge_date >= p_start_date
    AND s.challenge_date <= p_end_date
    AND s.included_in_ranking = true
  GROUP BY s.challenge_date;
END;
$$ LANGUAGE plpgsql STABLE;
```

```typescript
// api.ts — replace fetchSubmissionCountsByDateRange:
export async function fetchSubmissionCountsByDateRange(
  startDate: string,
  endDate: string
): Promise<Record<string, number>> {
  const { data, error } = await supabase.rpc('count_submissions_by_date', {
    p_start_date: startDate,
    p_end_date: endDate,
  });

  if (error) throw error;

  const counts: Record<string, number> = {};
  (data ?? []).forEach((row: { challenge_date: string; submission_count: number }) => {
    counts[row.challenge_date] = row.submission_count;
  });
  return counts;
}
```

---

## 10. Gallery Month-Scoped Fetch

**Severity**: MEDIUM (performance)
**Files**: `src/hooks/submission/useSubmissions.ts`, `src/lib/api.ts`

### Problem

`loadMySubmissions()` fetches ALL user submissions at once with no limit:

```typescript
// Current: api.ts
.from('submissions').select('*').eq('user_id', userId)
  .order('challenge_date', { ascending: false })
// No limit — returns every submission the user has ever made
```

After a year that's 365+ rows with full JSONB shape data. The calendar view only displays one month at a time.

### Fix

```typescript
// api.ts — new function:
export async function fetchUserSubmissionsByMonth(
  userId: string,
  monthStart: string,  // e.g., '2026-03-01'
  monthEnd: string     // e.g., '2026-03-31'
): Promise<SubmissionRow[]> {
  const { data, error } = await supabase
    .from('submissions')
    .select('*')
    .eq('user_id', userId)
    .gte('challenge_date', monthStart)
    .lte('challenge_date', monthEnd)
    .order('challenge_date', { ascending: false });
  if (error) throw error;
  return (data as SubmissionRow[]) ?? [];
}
```

```typescript
// useSubmissions.ts — cache by month:
const monthCache = useRef<Map<string, SubmissionRow[]>>(new Map());

const loadSubmissionsForMonth = useCallback(async (monthStart: string, monthEnd: string) => {
  const cacheKey = `${userId}-${monthStart}`;
  if (monthCache.current.has(cacheKey)) {
    return monthCache.current.get(cacheKey)!;
  }
  const data = await fetchUserSubmissionsByMonth(userId, monthStart, monthEnd);
  monthCache.current.set(cacheKey, data);
  return data;
}, [userId]);
```

When the user navigates months, fetch that month's data. Previously fetched months stay cached in the ref.

---

## 11. `get_next_pair()` is O(n^2) — Will Break at Scale

**Severity**: CRITICAL (performance)
**Files**: `supabase/migrations/002_ranking.sql:146-201`, new migration

### Problem

The current function uses a CROSS JOIN on ALL eligible submissions to find the optimal pair:

```sql
-- Current: 002_ranking.sql:179-195
candidate_pairs AS (
  SELECT
    a.submission_id as sub_a, b.submission_id as sub_b,
    (a.vote_count + b.vote_count) as total_votes,
    ABS(a.elo_score - b.elo_score) as elo_diff
  FROM eligible_submissions a
  CROSS JOIN eligible_submissions b              -- O(n^2) here
  WHERE a.submission_id < b.submission_id
    AND NOT EXISTS (
      SELECT 1 FROM seen_pairs sp
      WHERE (sp.sub_a = a.submission_id AND sp.sub_b = b.submission_id)
         OR (sp.sub_a = b.submission_id AND sp.sub_b = a.submission_id)
    )
)
SELECT sub_a, sub_b FROM candidate_pairs
ORDER BY total_votes ASC, elo_diff ASC
LIMIT 1;
```

| Submissions | Candidate Pairs | Impact |
|---|---|---|
| 50 | 1,225 | Fine |
| 100 | 4,950 | Noticeable |
| 500 | 124,750 | Slow |
| 1,000 | 499,500 | Timeout likely |

Every voter triggers this query, so concurrent voters multiply the load.

### Why It's Designed This Way

The algorithm ensures perfectly fair vote distribution:
- Every pair gets equal exposure before any gets extra votes
- Closer Elo matchups prioritized (more meaningful comparisons)
- No submission over- or under-represented

### Will the Fix Affect Elo Quality?

Slightly, but acceptably. Elo is self-correcting — with enough votes, rankings converge regardless of pair selection strategy. The difference only matters with very few voters and many submissions.

### Fix: Two-Phase Sampling

```sql
-- New migration: xxx_optimize_get_next_pair.sql

CREATE OR REPLACE FUNCTION get_next_pair(
  p_voter_id UUID,
  p_challenge_date TEXT
) RETURNS TABLE (
  submission_a_id UUID,
  submission_b_id UUID,
  submission_a_user_id UUID,
  submission_b_user_id UUID
) AS $$
DECLARE
  v_user_submission_id UUID;
BEGIN
  -- Get voter's own submission for this date (to exclude)
  SELECT s.id INTO v_user_submission_id
  FROM submissions s
  WHERE s.user_id = p_voter_id AND s.challenge_date = p_challenge_date;

  RETURN QUERY
  WITH eligible_submissions AS (
    SELECT
      dr.submission_id,
      dr.user_id,
      dr.elo_score,
      dr.vote_count
    FROM daily_rankings dr
    WHERE dr.challenge_date = p_challenge_date
      AND dr.submission_id != COALESCE(v_user_submission_id, '00000000-0000-0000-0000-000000000000'::UUID)
  ),
  seen_pairs AS (
    SELECT c.submission_a_id AS sub_a, c.submission_b_id AS sub_b
    FROM comparisons c
    WHERE c.voter_id = p_voter_id AND c.challenge_date = p_challenge_date
  ),
  -- PHASE 1: Sample ~20 submissions, biased toward low vote counts
  sampled AS (
    SELECT * FROM eligible_submissions
    ORDER BY vote_count ASC, RANDOM()
    LIMIT 20
  ),
  -- PHASE 2: CROSS JOIN only the 20 sampled (max 190 pairs vs 500K)
  candidate_pairs AS (
    SELECT
      a.submission_id as sub_a,
      b.submission_id as sub_b,
      a.user_id as user_a,
      b.user_id as user_b,
      (a.vote_count + b.vote_count) as total_votes,
      ABS(a.elo_score - b.elo_score) as elo_diff
    FROM sampled a
    CROSS JOIN sampled b
    WHERE a.submission_id < b.submission_id
      AND NOT EXISTS (
        SELECT 1 FROM seen_pairs sp
        WHERE (sp.sub_a = a.submission_id AND sp.sub_b = b.submission_id)
           OR (sp.sub_a = b.submission_id AND sp.sub_b = a.submission_id)
      )
  )
  SELECT cp.sub_a, cp.sub_b, cp.user_a, cp.user_b
  FROM candidate_pairs cp
  ORDER BY cp.total_votes ASC, cp.elo_diff ASC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Key change**: Added the `sampled` CTE that selects 20 submissions biased toward low vote counts (`ORDER BY vote_count ASC, RANDOM() LIMIT 20`). The CROSS JOIN now operates on at most 20 rows instead of all eligible submissions.

- 20 * 19 / 2 = **190 candidate pairs maximum**, regardless of total submissions
- `vote_count ASC` bias ensures under-voted submissions get priority
- `RANDOM()` adds variety within the same vote count tier
- Same quality-optimizing ORDER BY (`total_votes ASC, elo_diff ASC`) picks the best from the sample

### Verification

```sql
-- Before: Run on test data with 200 submissions
EXPLAIN ANALYZE SELECT * FROM get_next_pair('some-uuid', '2026-03-05');
-- Note execution time

-- After: Same query
EXPLAIN ANALYZE SELECT * FROM get_next_pair('some-uuid', '2026-03-05');
-- Should be dramatically faster
```

---

## 12. Submission Detail Sequential Queries

**Severity**: LOW (performance)
**File**: `src/hooks/submission/useSubmissionDetail.ts`

### Problem

Loading a single submission detail makes 4 sequential queries:

```typescript
// Current: useSubmissionDetail.ts:50-91
// 1. Fetch submission
const { data } = await supabase.from('submissions').select('*').eq('id', submissionId).single();
// 2. Fetch profile nickname
const { data: profileData } = await supabase.from('profiles').select('nickname').eq('id', data.user_id).single();
// 3. Fetch ranking
const { data: rankingData } = await supabase.from('daily_rankings').select('final_rank, challenge_date').eq('submission_id', data.id).maybeSingle();
// 4. Fetch total count
const { count } = await supabase.from('daily_rankings').select('*', { count: 'exact', head: true }).eq('challenge_date', rankingData.challenge_date);
```

### Fix

Use PostgREST embedded joins to combine queries 1-3:

```typescript
const { data } = await supabase
  .from('submissions')
  .select(`
    *,
    profiles!user_id (nickname),
    daily_rankings!submission_id (final_rank, challenge_date)
  `)
  .eq('id', submissionId)
  .single();

// data.profiles.nickname — from the join
// data.daily_rankings?.final_rank — from the join
// Still need query 4 for total count (can't embed aggregate in join)
```

Goes from 4 sequential queries to 2 (one join + one count).

---

## Baseline Migration for Profiles + Submissions

These tables exist in the live DB but have no `CREATE TABLE` in any migration file. Create a baseline migration for auditability:

```sql
-- New migration: xxx_baseline_profiles_submissions.sql
-- NOTE: This is a documentation-only baseline. Tables already exist in production.
-- Only the policy cleanup runs.

-- =============================================================================
-- PROFILES TABLE (already exists, documenting schema)
-- =============================================================================
-- CREATE TABLE IF NOT EXISTS profiles (
--   id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
--   nickname TEXT NOT NULL UNIQUE,
--   avatar_url TEXT,
--   created_at TIMESTAMPTZ DEFAULT NOW(),
--   onboarding_complete BOOLEAN DEFAULT FALSE,
--   is_admin BOOLEAN NOT NULL DEFAULT FALSE
-- );
-- ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
-- Policies: "Anyone can read profiles" (SELECT), "Users can update own profile" (UPDATE)
-- Indexes: profiles_pkey, profiles_nickname_key, profiles_is_admin_idx

-- =============================================================================
-- SUBMISSIONS TABLE (already exists, documenting schema)
-- =============================================================================
-- CREATE TABLE IF NOT EXISTS submissions (
--   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--   user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
--   challenge_date TEXT NOT NULL,
--   shapes JSONB NOT NULL,
--   background_color_index SMALLINT,
--   created_at TIMESTAMPTZ DEFAULT NOW(),
--   updated_at TIMESTAMPTZ DEFAULT NOW(),
--   included_in_ranking BOOLEAN NOT NULL DEFAULT FALSE,
--   groups JSONB DEFAULT '[]'::jsonb,
--   like_count INTEGER NOT NULL DEFAULT 0,
--   UNIQUE(user_id, challenge_date)
-- );
-- ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
-- Indexes: submissions_pkey, submissions_date_idx, submissions_user_date_idx,
--          submissions_user_id_challenge_date_key, submissions_likes_sort_idx
```

---

## Implementation Order

| # | Task | Severity | Complexity |
|---|---|---|---|
| 1 | Vote double-submission fix (#1) | CRITICAL | Low |
| 2 | Cleanup duplicate RLS policies (#2) | HIGH | Low |
| 3 | Security headers (#3) | HIGH | Trivial |
| 4 | Canvas payload limits (#4) | HIGH | Low |
| 5 | Error boundary (#5) | MEDIUM | Low |
| 6 | Admin route gating (#6) | MEDIUM | Low |
| 7 | Server-side sorting (#7) | HIGH | Medium |
| 8 | Rate limiting triggers (#8) | HIGH | Medium |
| 9 | Wall calendar count RPC (#9) | MEDIUM | Low |
| 10 | Gallery month-scoped fetch (#10) | MEDIUM | Low |
| 11 | get_next_pair() rewrite (#11) | CRITICAL | High |
| 12 | Submission detail joins (#12) | LOW | Low |

---

## Detailed Task List

### Phase 1: Vote Double-Submission Fix (Item #1)

- [x] **1.1** Create migration `supabase/migrations/xxx_fix_comparisons_constraint.sql`
  - Add CHECK constraint: `ALTER TABLE comparisons ADD CONSTRAINT ordered_pair CHECK (submission_a_id < submission_b_id);`
  - NOTE: Must first verify no existing rows violate this. Run in Supabase SQL Editor:
    ```sql
    SELECT COUNT(*) FROM comparisons WHERE submission_a_id >= submission_b_id;
    ```
    If any exist, normalize them first:
    ```sql
    UPDATE comparisons
    SET submission_a_id = LEAST(submission_a_id, submission_b_id),
        submission_b_id = GREATEST(submission_a_id, submission_b_id)
    WHERE submission_a_id >= submission_b_id;
    ```
- [x] **1.2** Edit `supabase/functions/process-vote/index.ts`
  - After validation (line ~134), add normalization:
    ```typescript
    const [normalizedA, normalizedB] = submissionAId < submissionBId
      ? [submissionAId, submissionBId]
      : [submissionBId, submissionAId];
    ```
  - Replace all downstream uses of `submissionAId`/`submissionBId` with `normalizedA`/`normalizedB` in the insert (line ~157-163) and Elo lookup (line ~182, ~187-188, ~195-205)
  - Keep `winnerId` as-is (it references the actual submission, not the pair order)
- [ ] **1.3** Deploy the edge function (manual: `supabase functions deploy process-vote`)
- [ ] **1.4** Run the migration against production (manual: `supabase db push`)
- [ ] **1.5** Verify: attempt reversed-pair vote via curl, confirm it either normalizes or rejects

### Phase 2: Cleanup Duplicate RLS Policies (Item #2)

- [x] **2.1** Create migration `supabase/migrations/xxx_cleanup_rls_policies.sql`
  - Drop duplicate submissions policies:
    ```sql
    DROP POLICY IF EXISTS "Users can delete own submissions" ON submissions;
    DROP POLICY IF EXISTS "Users can insert own submissions" ON submissions;
    DROP POLICY IF EXISTS "Users can update own submissions" ON submissions;
    ```
  - Drop redundant profiles policy:
    ```sql
    DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
    ```
  - (The remaining policies — "Users can delete their own submissions", "Users can insert their own submissions", "Users can update their own submissions" — are the correct, complete ones)
- [x] **2.2** Create baseline migration `supabase/migrations/xxx_baseline_profiles_submissions.sql` with commented-out CREATE TABLE statements documenting the schema (as shown in plan)
- [ ] **2.3** Run migration against production
- [ ] **2.4** Verify: `SELECT policyname, cmd FROM pg_policies WHERE tablename = 'submissions' ORDER BY cmd;` — should show exactly 1 per command

### Phase 3: Security Headers (Item #3)

- [x] **3.1** Edit `netlify.toml` — append headers section:
  ```toml
  [[headers]]
    for = "/*"
    [headers.values]
      X-Frame-Options = "DENY"
      X-Content-Type-Options = "nosniff"
      Referrer-Policy = "strict-origin-when-cross-origin"
      Permissions-Policy = "geolocation=(), microphone=(), camera=()"
  ```
- [ ] **3.2** Deploy to Netlify
- [ ] **3.3** Verify: browser DevTools > Network > any request > check response headers present

### Phase 4: Canvas Payload Limits (Item #4)

- [ ] **4.1** Edit `src/hooks/submission/useSubmissions.ts` — in `upsertSubmission()`, add validation before the DB call:
  ```typescript
  const MAX_SHAPES = 200;
  if (params.shapes.length > MAX_SHAPES) {
    return { error: `Maximum ${MAX_SHAPES} shapes per canvas` };
  }
  ```
- [ ] **4.2** Create migration `supabase/migrations/xxx_canvas_payload_limits.sql`:
  ```sql
  ALTER TABLE submissions ADD CONSTRAINT max_shapes CHECK (jsonb_array_length(shapes) <= 200);
  ```
  - First verify no existing rows violate: `SELECT COUNT(*) FROM submissions WHERE jsonb_array_length(shapes) > 200;`
- [ ] **4.3** Run migration against production
- [ ] **4.4** Verify: try saving >200 shapes in the canvas editor — should show error message

### Phase 5: Error Boundary (Item #5)

- [ ] **5.1** Create `src/components/shared/ErrorBoundary.tsx` — class component with fallback UI (as shown in plan)
- [ ] **5.2** Edit `src/App.tsx` — wrap the root component (RouterProvider or equivalent) with `<ErrorBoundary>`
- [ ] **5.3** Test: temporarily throw an error in a component, verify fallback renders instead of white screen

### Phase 6: Admin Route Gating (Item #6)

- [x] **6.1** Read `src/App.tsx` to understand current admin route registration
- [x] **6.2** Add `AdminGuard` component that checks auth+admin status; wrap `ShapeExplorer`, `Dashboard`, and `ColorTester` lazy routes
- [x] **6.3** Typecheck passes

### Phase 7: Server-Side Sorting (Item #7)

This is the most involved change. Touches 5+ files.

**Migration:**
- [x] **7.1** Created `supabase/migrations/20260306000004_submissions_date_created_idx.sql`
- [ ] **7.2** Run migration against production

**Remove random sort:**
- [x] **7.3** Removed `'random'` from `WallSortControls` type, labels, and options
- [x] **7.4** Removed `'random'` from both hooks' `SortMode`, default changed to `'newest'`

**Modify API functions:**
- [x] **7.5** `fetchWallSubmissionsFromDB()` now accepts `sortMode` with `.order()` clauses
- [x] **7.6** Added `fetchWallSubmissionsRanked()` — queries `daily_rankings` with embedded `submissions` join
- [x] **7.7** `fetchFriendsSubmissionsFromDB()` updated with sort params

**Refactor hooks:**
- [x] **7.8** `useWallOfTheDay` — removed client-side sorting, shuffle, cache keyed by sort mode, re-fetches on sort change, ranked uses separate join query
- [x] **7.9** `useFriendsFeed` — same refactor, ranked sorts client-side (friends count too small for dedicated query)

**Components:**
- [x] **7.10-7.11** `WallContent` and `FriendsFeedContent` work with updated types (typecheck passes)
- [x] **7.12** `wallSorting.ts` kept (only has test file referencing it, no production imports)
- [ ] **7.13** Manual test: verify sort modes on wall and friends pages

### Phase 8: Rate Limiting Triggers (Item #8)

- [x] **8.1** Created `supabase/migrations/20260306000005_rate_limiting.sql` with reusable `check_rate_limit()` + triggers for likes (20/60s) and follows (10/60s)
- [ ] **8.2** Run migration against production
- [ ] **8.3** Verify: rapid-fire likes in browser console, confirm error after threshold
- [x] **8.4** Client-side already handles errors — optimistic update reverts on rate limit rejection

### Phase 9: Wall Calendar Count RPC (Item #9)

- [x] **9.1** Created `supabase/migrations/20260306000006_count_submissions_rpc.sql`
- [ ] **9.2** Run migration against production
- [x] **9.3** Updated `fetchSubmissionCountsByDateRange()` to use RPC, returns `Record<string, number>` directly
- [x] **9.4** Updated `WallContent.tsx` — removed client-side counting, uses server-aggregated data
- [ ] **9.5** Test: switch to calendar view on wall page, verify counts show correctly

### Phase 10: Gallery Month-Scoped Fetch (Item #10)

- [x] **10.1** Added `fetchUserSubmissionsByMonth()` in `api.ts`
- [x] **10.2** Added `loadSubmissionsForMonth()` to `useSubmissions` with month-keyed cache, invalidation on save
- [x] **10.3** Updated `GalleryPage` to use `loadSubmissionsForMonth` with current month boundaries, re-fetches on month navigation
- [ ] **10.4** Test: navigate between months in gallery, verify data loads per-month

### Phase 11: get_next_pair() Optimization (Item #11)

- [x] **11.1** Created `supabase/migrations/20260306000007_optimize_get_next_pair.sql` with two-phase sampling (sample 20, max 190 pairs)
- [ ] **11.2** Run `EXPLAIN ANALYZE` before/after migration
- [ ] **11.3** Run migration against production
- [ ] **11.4** Test voting flow end-to-end

### Phase 12: Submission Detail Joins (Item #12)

- [x] **12.1** `fetchSubmissionById()` now uses joined query with `profiles` and `daily_rankings` embedded
- [x] **12.2** Added `fetchRankTotal()` helper — only fetches the count (rank comes from join)
- [x] **12.3** Updated `useSubmissionDetail` — extracts nickname + rank from joined data, only makes 2 requests (join + count) instead of 4
- [ ] **12.4** Test: view a submission detail page, verify nickname and rank display correctly
