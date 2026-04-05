# Supabase + Netlify Integration Plan

## Overview

Add Google authentication and cloud storage for user creations using:
- **Supabase** → Auth (Google OAuth) + Database (Postgres)
- **Netlify** → Hosts the React app (static files)

```
┌─────────────────┐         ┌─────────────────┐
│    Netlify      │         │    Supabase     │
│                 │         │                 │
│  React App      │◄───────►│  - Google Auth  │
│  (static)       │         │  - Postgres DB  │
│                 │         │  - Row Security │
└─────────────────┘         └─────────────────┘
```

---

## Phase 1: Supabase Setup (One-time, ~20 min)

### 1.1 Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign up/login
2. Click "New Project"
3. Choose organization, name it (e.g., `2-colors-2-shapes`)
4. Set a database password (save it securely)
5. Choose region closest to your users
6. Wait for project to provision (~2 min)

### 1.2 Get API Credentials

From Project Settings → API:
- **Project URL**: `https://xxxxx.supabase.co`
- **anon/public key**: `eyJhbGc...` (safe to expose in frontend)

You'll add these as environment variables later.

### 1.3 Enable Google Auth

1. In Supabase dashboard: Authentication → Providers → Google
2. Toggle "Enable Google provider"
3. You'll need Google OAuth credentials (next step)

### 1.4 Create Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create new project (or select existing)
3. APIs & Services → Credentials → Create Credentials → OAuth client ID
4. Configure consent screen first if prompted:
   - User type: External
   - App name: "Shapepaint"
   - Support email: your email
   - Authorized domains: add `supabase.co` and your custom domain later
5. Create OAuth client ID:
   - Application type: Web application
   - Authorized redirect URIs: `https://xxxxx.supabase.co/auth/v1/callback`
   - (Replace xxxxx with your Supabase project ID)
6. Copy **Client ID** and **Client Secret**

### 1.5 Finish Google Auth in Supabase

Back in Supabase → Authentication → Providers → Google:
- Paste Client ID
- Paste Client Secret
- Save

---

## Phase 2: Database Schema

### 2.1 Create Tables

Run this SQL in Supabase SQL Editor (or via CLI):

```sql
-- Profiles table (extends Supabase auth.users)
-- Stores public-facing user data (nickname instead of real name/email for privacy)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  nickname text unique not null,                    -- Public display name, chosen by user
  avatar_url text,                                  -- Google avatar or custom
  onboarding_complete boolean default false,        -- Has user set their nickname?
  created_at timestamptz default now(),

  -- Nickname validation: 1-15 chars, alphanumeric only
  constraint nickname_length check (char_length(nickname) between 1 and 15),
  constraint nickname_format check (nickname ~ '^[a-zA-Z0-9]+$')
);

-- Submissions table (user creations)
create table public.submissions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  challenge_date date not null,
  shapes jsonb not null,
  background_color_index smallint,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  -- One submission per user per day
  unique(user_id, challenge_date)
);

-- Index for fast lookups
create index submissions_user_date_idx on public.submissions(user_id, challenge_date);
create index submissions_date_idx on public.submissions(challenge_date);
```

### 2.2 Row Level Security (RLS)

This ensures users can only access their own data:

```sql
-- Enable RLS
alter table public.profiles enable row level security;
alter table public.submissions enable row level security;

-- Profiles: users can read/update their own profile
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Submissions: users can CRUD their own, read everyone's (for gallery)
create policy "Users can view all submissions"
  on public.submissions for select
  to authenticated
  using (true);

create policy "Users can insert own submissions"
  on public.submissions for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own submissions"
  on public.submissions for update
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can delete own submissions"
  on public.submissions for delete
  to authenticated
  using (auth.uid() = user_id);
```

### 2.3 Auto-create Profile on Signup

```sql
-- Function to create profile on signup
-- Note: nickname is set to a temporary random value; user must complete onboarding to set real nickname
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, nickname, avatar_url, onboarding_complete)
  values (
    new.id,
    'user' || substr(md5(random()::text), 1, 8),  -- Temp nickname like "user3f8a2b1c"
    new.raw_user_meta_data->>'avatar_url',
    false  -- Must complete onboarding to set real nickname
  );
  return new;
end;
$$ language plpgsql security definer;

-- Trigger on auth.users insert
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

---

## Phase 3: Code Changes

### 3.1 Install Supabase Client

```bash
npm install @supabase/supabase-js
```

### 3.2 New Files to Create

```
src/
├── lib/
│   └── supabase.ts          # Supabase client instance
├── hooks/
│   ├── useAuth.ts           # Auth state & methods
│   └── useSubmissions.ts    # Save/load submissions
├── components/
│   ├── AuthButton.tsx       # Login/logout button
│   └── UserMenu.tsx         # User avatar dropdown (optional)
└── types/
    └── database.ts          # Generated types for Supabase tables
```

### 3.3 Supabase Client (`src/lib/supabase.ts`)

```typescript
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
```

### 3.4 Auth Hook (`src/hooks/useAuth.ts`)

```typescript
import { useState, useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    });
    if (error) console.error('Login error:', error);
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) console.error('Logout error:', error);
  };

  return { user, loading, signInWithGoogle, signOut };
}
```

### 3.5 Submissions Hook (`src/hooks/useSubmissions.ts`)

```typescript
import { supabase } from '../lib/supabase';
import type { Shape } from '../types';

interface SaveSubmissionParams {
  challengeDate: string;
  shapes: Shape[];
  backgroundColorIndex: 0 | 1 | null;
}

export function useSubmissions(userId: string | undefined) {

  const saveSubmission = async (params: SaveSubmissionParams) => {
    if (!userId) return { error: 'Not authenticated' };

    const { data, error } = await supabase
      .from('submissions')
      .upsert({
        user_id: userId,
        challenge_date: params.challengeDate,
        shapes: params.shapes,
        background_color_index: params.backgroundColorIndex,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,challenge_date',
      })
      .select()
      .single();

    return { data, error };
  };

  const loadSubmission = async (challengeDate: string) => {
    if (!userId) return { data: null, error: 'Not authenticated' };

    const { data, error } = await supabase
      .from('submissions')
      .select('*')
      .eq('user_id', userId)
      .eq('challenge_date', challengeDate)
      .single();

    return { data, error };
  };

  const loadMySubmissions = async () => {
    if (!userId) return { data: [], error: 'Not authenticated' };

    const { data, error } = await supabase
      .from('submissions')
      .select('*')
      .eq('user_id', userId)
      .order('challenge_date', { ascending: false });

    return { data: data ?? [], error };
  };

  return { saveSubmission, loadSubmission, loadMySubmissions };
}
```

### 3.6 Auth Button Component (`src/components/AuthButton.tsx`)

```typescript
import { useAuth } from '../hooks/useAuth';

export function AuthButton() {
  const { user, loading, signInWithGoogle, signOut } = useAuth();

  if (loading) {
    return <div className="text-sm text-gray-500">Loading...</div>;
  }

  if (user) {
    return (
      <div className="flex items-center gap-2">
        <img
          src={user.user_metadata.avatar_url}
          alt="Avatar"
          className="w-8 h-8 rounded-full"
        />
        <span className="text-sm truncate max-w-30">
          {user.user_metadata.full_name || user.email}
        </span>
        <button
          onClick={signOut}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={signInWithGoogle}
      className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
    >
      <svg className="w-5 h-5" viewBox="0 0 24 24">
        {/* Google icon SVG path */}
      </svg>
      Sign in with Google
    </button>
  );
}
```

### 3.7 Integrate into Toolbar

In `Toolbar.tsx`, add the AuthButton and a "Save" button:

```typescript
// Add to imports
import { AuthButton } from './AuthButton';
import { useAuth } from '../hooks/useAuth';
import { useSubmissions } from '../hooks/useSubmissions';

// Inside component
const { user } = useAuth();
const { saveSubmission } = useSubmissions(user?.id);

const handleSave = async () => {
  if (!user) return;
  const result = await saveSubmission({
    challengeDate: challenge.date,
    shapes,
    backgroundColorIndex,
  });
  if (result.error) {
    console.error('Save failed:', result.error);
  } else {
    // Show success feedback
  }
};

// In JSX, add:
<AuthButton />
{user && (
  <button onClick={handleSave}>
    Save Creation
  </button>
)}
```

---

## Phase 4: Netlify Setup

### 4.1 Create netlify.toml

Create `netlify.toml` in project root:

```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

The redirect rule ensures client-side routing works (SPA behavior).

### 4.2 Deploy to Netlify

**Option A: Via Netlify CLI**
```bash
npm install -g netlify-cli
netlify login
netlify init
# Follow prompts, link to Git repo
netlify deploy --prod
```

**Option B: Via Netlify Dashboard**
1. Go to [app.netlify.com](https://app.netlify.com)
2. "Add new site" → "Import an existing project"
3. Connect GitHub/GitLab
4. Select your repo
5. Build settings auto-detected from netlify.toml
6. Deploy

### 4.3 Set Environment Variables

In Netlify dashboard → Site settings → Environment variables:

```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
```

### 4.4 Update Google OAuth Redirect

Once you have your Netlify domain (e.g., `2colors2shapes.netlify.app`):

1. In Google Cloud Console → Credentials → Your OAuth client
2. Add authorized redirect URI: `https://xxxxx.supabase.co/auth/v1/callback`
3. Add authorized JavaScript origin: `https://2colors2shapes.netlify.app`

### 4.5 Configure Supabase Redirect URLs

In Supabase → Authentication → URL Configuration:
- Site URL: `https://2colors2shapes.netlify.app`
- Redirect URLs: Add `https://2colors2shapes.netlify.app/*`

---

## Phase 5: Local Development

### 5.1 Create `.env.local`

```bash
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
```

Add to `.gitignore`:
```
.env.local
.env*.local
```

### 5.2 Update Google OAuth for localhost

Add to Google OAuth credentials:
- Authorized JavaScript origins: `http://localhost:5173`

Add to Supabase → Authentication → URL Configuration:
- Redirect URLs: `http://localhost:5173/*`

---

## Implementation Order

1. **Set up Supabase project** (Phase 1)
2. **Create database schema** (Phase 2) - can do via SQL editor
3. **Install dependencies** - `npm install @supabase/supabase-js`
4. **Create `src/lib/supabase.ts`**
5. **Create `src/hooks/useAuth.ts`**
6. **Create `src/components/AuthButton.tsx`**
7. **Add AuthButton to Toolbar**
8. **Test login locally**
9. **Create `src/hooks/useSubmissions.ts`**
10. **Add save/load functionality**
11. **Create `netlify.toml`**
12. **Deploy to Netlify**
13. **Configure production URLs**

---

## Cost Estimate

| Service | Free Tier | When You'd Pay |
|---------|-----------|----------------|
| Supabase | 500MB DB, 50k MAU | Very unlikely for this app |
| Netlify | 100GB bandwidth, 300 build min/mo | Very unlikely |
| Google OAuth | Free | Never |

**Total: $0/month** for typical usage

---

## Phase 6: Onboarding Flow (Nickname Selection)

### 6.1 Create Onboarding Modal (`src/components/OnboardingModal.tsx`)

Shows on first login when `onboarding_complete === false`.

```typescript
// Component that:
// 1. Prompts user to enter a nickname
// 2. Validates: 1-15 chars, alphanumeric only
// 3. Checks uniqueness against DB
// 4. Updates profile with nickname and sets onboarding_complete = true
```

### 6.2 Flow Logic in App.tsx

```typescript
const { user } = useAuth();
const { profile, loading } = useProfile(user?.id);

// Show onboarding modal if logged in but hasn't set nickname
if (user && profile && !profile.onboarding_complete) {
  return <OnboardingModal />;
}
```

---

## Phase 7: Google OAuth Verification (For Public Launch)

To allow anyone to log in (not just test users), you need to verify your app with Google.

### 7.1 Verify Domain in Google Search Console

1. Go to [Google Search Console](https://search.google.com/search-console)
2. Add property: `https://2-colors-2-shapes.netlify.app`
3. Choose "URL prefix" verification method
4. Select "HTML file" verification:
   - Download the `googleXXXXXXXX.html` file Google provides
   - Put it in your `public/` folder
   - Deploy to Netlify
   - Click "Verify" in Search Console

### 7.2 Update OAuth Consent Screen

1. Go to [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → OAuth consent screen
2. Fill in required fields:
   - **App name**: Shapepaint
   - **User support email**: your email
   - **App logo**: (optional, can add later)
   - **App domain**: `https://2-colors-2-shapes.netlify.app`
   - **Privacy policy**: `https://2-colors-2-shapes.netlify.app/privacy.html`
   - **Terms of service**: (optional, can use privacy policy URL)
   - **Authorized domains**: `2-colors-2-shapes.netlify.app`
   - **Developer contact**: your email
3. Scopes: Only need `email` and `profile` (non-sensitive)
4. Click "Publish App" to move from Testing to Production

### 7.3 What Happens Next

- For non-sensitive scopes (email, profile), Google usually auto-approves
- Your app moves to "In production" status
- Anyone with a Google account can now log in
- No more 100 test user limit

### 7.4 Files Created

- `public/privacy.html` - Privacy policy page (accessible at /privacy.html)
- `public/googleXXXXXXXX.html` - Search Console verification (you'll add this)

---

## Future Enhancements (Optional)

- [ ] Gallery page showing all users' submissions for a day
- [ ] Calendar view of your past submissions
- [ ] "Like" or vote on submissions
- [ ] Social sharing (generate image from canvas)
- [ ] Custom domains on Netlify
