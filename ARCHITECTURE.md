# Architecture Diagrams: 2 Colors 2 Shapes

> Auto-generated architecture visualization. Re-generate by asking Claude to update this file.

## 1. High-Level System Architecture

```mermaid
graph TB
    subgraph Client["Client (React 19 + Vite SPA)"]
        App["App.tsx<br/>MotionConfig + URL routing"]

        subgraph Pages["Pages (lazy-loaded)"]
            CEP["CanvasEditorPage"]
            GP["GalleryPage"]
            WOTD["WallOfTheDayPage"]
            WDP["WinnersDayPage"]
            UPP["UserProfilePage"]
            SDP["SubmissionDetailPage"]
            Admin["Admin pages"]
        end

        subgraph State["State Layer"]
            Hooks["Custom Hooks<br/>(44 files, 6 domains)"]
            FC["FollowsContext<br/>(only React context)"]
            LS["localStorage<br/>canvas, challenges, theme"]
        end

        subgraph UI["Shared UI"]
            Modal["Modal"]
            Button["Button"]
            Card["Card"]
            SVGShape["SVGShape"]
            More["LoadingSpinner, EmptyState,<br/>TrophyBadge, InfoTooltip..."]
        end
    end

    subgraph Supabase["Supabase (Remote)"]
        Auth["Auth (Google, Email)"]
        DB["PostgreSQL"]
        EF["Edge Functions (3)"]
    end

    App --> Pages
    Pages --> Hooks
    Pages --> UI
    Hooks --> FC
    Hooks --> LS
    Hooks -->|"supabase-js"| Auth
    Hooks -->|"supabase-js"| DB
    Hooks -->|"functions.invoke()"| EF
    EF --> DB
```

## 2. Feature Domains & Hook Map

```mermaid
graph LR
    subgraph Canvas["Canvas Domain (33 files)"]
        direction TB
        CS[useCanvasState]
        CH[useCanvasHistory]
        CSt[useCanvasStorage]
        SO[useShapeOperations]
        SA[useShapeActions]
        SD[useShapeDrag]
        CK[useCanvasKeyboardShortcuts]
        CT[useCanvasTouchGestures]
        CP[useCanvasPanning]
        WZ[useWheelZoom]
        MS[useMarqueeSelection]
        VS[useViewportState]

        CS --> CH
        CS --> CSt
        CS --> SO
    end

    subgraph Challenge["Challenge Domain"]
        direction TB
        DC[useDailyChallenge]
        CC[useCalendarChallenges]
        WOT[useWallOfTheDay]
        UV[useVoting]
        UR[useRankings]
        UWA[useWinnerAnnouncement]
    end

    subgraph Submission["Submission Domain"]
        direction TB
        US[useSubmissions]
        USS[useSaveSubmission]
        USync[useSubmissionSync]
        UExp[useExport]
    end

    subgraph Social["Social Domain"]
        direction TB
        UF[useFollows via Context]
        UL[useLikes]
        UFr[useFriendsFeed]
        UP[useProfile]
    end

    subgraph Auth["Auth Domain"]
        direction TB
        UA[useAuth]
        UPr[useProfile]
        UAd[useAdmin]
    end

    subgraph UIHooks["UI Hooks"]
        direction TB
        UT[useThemeState]
        UM[useAppModals]
        UW[useWelcomeModal]
        UKS[useKeyboardSettings]
        USB[useSidebarState]
        UB[useBreakpoint]
    end
```

## 3. Core Data Flow: Challenge → Create → Submit → Vote → Rank

```mermaid
sequenceDiagram
    participant U as User
    participant App as App.tsx
    participant DC as useDailyChallenge
    participant DB as Supabase DB
    participant EF as Edge Functions
    participant CS as useCanvasState
    participant LS as localStorage
    participant Sub as useSubmissions
    participant Vote as useVoting

    Note over App,DC: 1. Load Today's Challenge
    App->>DC: useDailyChallenge(today)
    DC->>DC: Check memory cache
    DC->>DC: Check localStorage cache
    DC->>DB: SELECT from challenges
    alt Not in DB
        DC->>EF: get-daily-challenge
        EF->>EF: Generate colors (OKLCH, contrast checks)
        EF->>EF: Pick 2 shapes from 40+
        EF->>DB: INSERT challenge
        EF-->>DC: { colors, shapes, word }
    end
    DC-->>App: challenge data

    Note over U,CS: 2. Create Artwork
    App->>CS: CanvasEditorPage(challenge)
    CS->>LS: Load saved canvas (if today's date matches)
    U->>CS: Add shapes, pick colors, arrange
    CS->>LS: Auto-save (debounced 300ms)

    Note over U,DB: 3. Submit
    U->>Sub: Save submission
    Sub->>DB: UPSERT submissions (user_id + date unique)
    Sub->>DB: Initialize daily_rankings row

    Note over U,EF: 4. Vote on Others
    U->>Vote: Open voting modal
    Vote->>DB: get_next_pair(voter_id, date) RPC
    DB-->>Vote: { submissionA, submissionB }
    U->>Vote: Pick winner
    Vote->>EF: process-vote({ winnerId })
    EF->>EF: Calculate ELO (K=32)
    EF->>DB: UPDATE daily_rankings (elo_score)
    EF->>DB: UPDATE user_voting_status (vote_count)
    alt vote_count >= required
        EF->>DB: SET included_in_ranking = true
    end

    Note over DB: 5. Rankings visible on Wall
```

## 4. Canvas Editor Component Tree

```mermaid
graph TB
    CEP["CanvasEditorPage"]

    CEP --> TB["TopBar"]
    CEP --> C["Canvas (SVG)"]
    CEP --> LP["LayerPanel"]
    CEP --> TP["ToolsPanel"]
    CEP --> BT["BottomToolbar"]
    CEP --> ZC["ZoomControls"]
    CEP --> KSP["KeyboardShortcutsPopover"]
    CEP --> Modals

    TB --> IC["InspirationCenter<br/>(daily word)"]
    TB --> ThP["ThemePill"]
    TB --> UMD["UserMenuDropdown"]

    C --> GL["CanvasGridLines"]
    C --> SE["ShapeElement[]"]
    C --> TIL["TransformInteractionLayer"]
    C --> MSTL["MultiSelectTransformLayer"]
    C --> HHL["HoverHighlightLayer"]
    C --> TCM["TouchContextMenu"]

    LP --> LI["LayerItem[]"]

    BT --> ShapePicker["Shape buttons"]
    BT --> ColorSwatch["Color swatches"]

    subgraph Modals
        WM["WelcomeModal"]
        OM["OnboardingModal"]
        VM["VotingModal"]
        FM["FriendsModal"]
        KSM["KeyboardSettingsModal"]
        RCM["ResetConfirmModal"]
        WAM["WinnerAnnouncementModal"]
        CM["CongratulatoryModal"]
    end

    VM --> VPV["VotingPairView"]
    VM --> VPr["VotingProgress"]
    VM --> VC["VotingConfirmation"]
```

## 5. Page Routing & Code Splitting

```mermaid
graph TB
    App["App.tsx"] --> AR["useAppRoute()"]
    AR -->|"URL params"| Route{"Route?"}

    Route -->|"default"| CEP["CanvasEditorPage<br/>(waits for challenge)"]
    Route -->|"tab=gallery"| GP["GalleryPage<br/>(lazy)"]
    Route -->|"page=wall-of-the-day"| WOTD["WallOfTheDayPage<br/>(lazy)"]
    Route -->|"page=winners"| WDP["WinnersDayPage<br/>(lazy)"]
    Route -->|"page=profile"| UPP["UserProfilePage<br/>(lazy)"]
    Route -->|"page=submission"| SDP["SubmissionDetailPage<br/>(lazy)"]
    Route -->|"page=dashboard"| Dash["Dashboard<br/>(lazy, admin)"]
    Route -->|"page=explorer"| SE["ShapeExplorer<br/>(lazy, admin)"]
    Route -->|"page=color-tester"| CT["ColorTester<br/>(lazy, admin)"]

    GP -.- FP["FollowsProvider"]
    UPP -.- FP
    SDP -.- FP
```

## 6. Persistence & Caching Strategy

```mermaid
graph LR
    subgraph Hot["In-Memory (fastest)"]
        ChallengeCache["challengeCache<br/>(module-level Map)"]
        WallCache["wallCache<br/>(module-level Map)"]
        PendingReqs["pendingRequests<br/>(dedup Maps)"]
    end

    subgraph Warm["localStorage"]
        CanvasLS["canvas state<br/>(debounced 300ms,<br/>daily reset)"]
        ChallengeLS["challenge cache<br/>(version-validated)"]
        ThemeLS["theme preferences"]
        KeyboardLS["keyboard settings"]
        SidebarLS["sidebar/grid state"]
    end

    subgraph Cold["Supabase DB"]
        ChallengesDB["challenges"]
        SubmissionsDB["submissions"]
        ProfilesDB["profiles"]
        FollowsDB["follows"]
        LikesDB["likes"]
        RankingsDB["daily_rankings"]
        ComparisonsDB["comparisons"]
        VotingStatusDB["user_voting_status"]
    end

    ChallengeCache -->|"miss"| ChallengeLS
    ChallengeLS -->|"miss"| ChallengesDB
    WallCache -->|"invalidated on save"| SubmissionsDB
    CanvasLS -->|"save submission"| SubmissionsDB
```

## 7. Database Schema (Key Tables)

```mermaid
erDiagram
    challenges {
        date challenge_date PK
        string color_1
        string color_2
        string color_3
        string shape_1
        string shape_2
        string shape_1_svg
        string shape_2_svg
        string word
    }

    profiles {
        uuid id PK
        string nickname
        boolean is_admin
    }

    submissions {
        uuid id PK
        uuid user_id FK
        date challenge_date FK
        json shapes
        json groups
        int background_color_index
        boolean included_in_ranking
        int like_count
    }

    daily_rankings {
        uuid submission_id FK
        float elo_score
        int vote_count
        int final_rank
    }

    comparisons {
        uuid voter_id FK
        uuid submission_a_id FK
        uuid submission_b_id FK
        uuid winner_id
    }

    user_voting_status {
        uuid user_id FK
        date challenge_date
        int vote_count
        boolean entered_ranking
    }

    follows {
        uuid follower_id FK
        uuid following_id FK
    }

    likes {
        uuid user_id FK
        uuid submission_id FK
    }

    profiles ||--o{ submissions : creates
    challenges ||--o{ submissions : "for date"
    submissions ||--o| daily_rankings : ranked
    submissions ||--o{ comparisons : "voted on"
    profiles ||--o{ comparisons : votes
    profiles ||--o{ follows : follows
    profiles ||--o{ likes : likes
    submissions ||--o{ likes : liked
    profiles ||--o{ user_voting_status : tracks
```
