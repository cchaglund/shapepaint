# Deep Modules Refactor — Todo List

## Phase 1: CanvasEditorContext (Eliminate Prop Drilling)

- [x] **1.1** Create `src/contexts/CanvasEditorContext.tsx`
  - Define `CanvasEditorContextValue` interface (all canvas state + operations)
  - Export `CanvasEditorProvider` component
  - Export `useCanvasEditor()` consumer hook with null guard
- [x] **1.2** Wire up provider in `CanvasEditorPage`
  - Build `editorContext` object from existing hook returns via `useMemo`
  - Wrap render tree in `<CanvasEditorProvider value={editorContext}>`
  - Keep all existing hook calls — only the wiring changes
- [x] **1.3** Refactor `Canvas` component to consume context
  - Replace 27-prop interface with `useCanvasEditor()` + `marqueeStartRef` prop
  - Remove `CanvasProps` interface (or reduce to just `marqueeStartRef`)
  - Update all internal references from `props.onXxx` to destructured context values
  - Verify all 8 internal hooks still receive correct values
- [x] **1.4** Refactor `LayerPanel` component to consume context
  - Replace 20-prop interface with `useCanvasEditor()` + `onToggle` prop only
  - `hoveredShapeIds`/`setHoveredShapeIds` now consumed from context (not props)
  - Update `LayerPanelProps` type in `src/components/LayerPanel/types.ts`
  - Update barrel export in `src/components/LayerPanel/index.ts`
  - Update `GroupHeader` and `LayerItem` sub-components if they receive props from LayerPanel
- [x] **1.5** Clean up `CanvasEditorPage` JSX
  - Remove 27-prop `<Canvas ... />` call, replace with `<Canvas marqueeStartRef={marqueeStartRef} />`
  - Remove 20-prop `<LayerPanel ... />` call, replace with `<LayerPanel onToggle={toggleRight} />`
- [x] **1.6** Verify Phase 1
  - `npm run build` — no type errors
  - Run tests
  - Manual test: add shape, drag, resize, rotate, select, multi-select, marquee, undo/redo
  - Manual test: layer panel — reorder, rename, group, ungroup, visibility toggle, delete
  - Manual test: keyboard shortcuts, grid toggle, zoom, pan

---

## Phase 2: Composite `useCanvasEditorState` Hook

- [x] **2.1** Create `src/hooks/canvas/useCanvasEditorState.ts`
  - Import and compose: `useCanvasState`, `useViewportState`, `useGridState`, `useOffCanvasState`, `useShapeActions`
  - Move `backgroundColor` computation from `CanvasEditorPage` into hook
  - Move `hoveredShapeIds` state from `CanvasEditorPage` into hook
  - Move `marqueeStartRef` from `CanvasEditorPage` into hook
  - Move `handleBringForward`/`handleSendBackward` from `CanvasEditorPage` into hook
  - Return flat object with all values
- [x] **2.2** Update `CanvasEditorPage` to use composite hook
  - Replace 5 individual hook imports with single `useCanvasEditorState` import
  - Replace ~80 lines of individual hook calls with single call
  - Remove moved state/computed values (`hoveredShapeIds`, `backgroundColor`, `marqueeStartRef`, z-order handlers)
  - Update `editorContext` memo to use values from composite hook
- [x] **2.3** Verify Phase 2
  - `npm run build` — no type errors
  - Run tests
  - Manual test: all canvas interactions still work

---

## Phase 3: Extract `<CanvasModals />`

- [x] **3.1** Create `src/components/canvas/CanvasModals.tsx`
  - Define `CanvasModalsProps` interface for all modal state + callbacks
  - Move all 7 modal renders from `CanvasEditorPage` JSX into this component:
    - `ResetConfirmModal`
    - `KeyboardSettingsModal`
    - `CongratulatoryModal`
    - `WinnerAnnouncementModal`
    - `VotingModal`
    - `FriendsModal`
    - (Note: `WelcomeModal` and `OnboardingModal` render at the top of the page — decide whether to include)
- [x] **3.2** Update `CanvasEditorPage`
  - Import `CanvasModals`
  - Replace inline modal JSX with `<CanvasModals ... />`
  - Move modal-specific handlers (`confirmReset`, `cancelReset`, `handleOptInToRanking`) into `CanvasModals` or pass as props
- [x] **3.3** Verify Phase 3
  - `npm run build`
  - Manual test: open each modal (keyboard settings, reset confirm, voting, friends, winner announcement, congratulatory)
  - Verify modals render above everything (z-index correct)
  - Verify escape/backdrop close still works

---

## Phase 4: Centralized Query Layer (`src/lib/api.ts`)

- [x] **4.1** Create `src/lib/api.ts`
- [x] **4.2** Migrate `useSubmissions` hook
- [x] **4.3** Migrate `useDailyChallenge` hook
- [x] **4.4** Migrate `useWallOfTheDay` hook
- [x] **4.5** Migrate `useVoting` hook
- [x] **4.6** Migrate `useLikes` hook
- [x] **4.7** Migrate `useProfile` hook
- [x] **4.8** Migrate `useAuth` hook (auth calls stay, data queries moved)
- [x] **4.9** Migrate `FollowsContext`
- [x] **4.10** Migrate remaining hooks (`useKeyboardSettings`, `useWinnerAnnouncement`, `useAdmin`)
- [x] **4.11** Migrate `CanvasEditorPage`, `FriendsFeedContent`, `ColorTester`, `UserSearchBar`, `WallContent`, `GalleryPage`, `UserMenuDropdown`
- [x] **4.12** Verify Phase 4 — only `api.ts` and `useAuth.ts` import supabase

---

## Phase 5: Split `SubmissionThumbnail`

- [x] **5.1** Extract `SubmissionThumbnail` base component
- [x] **5.2** Create `SubmissionCard` component
- [x] **5.3** Update all consumers
- [x] **5.4** Update barrel export in `shared/index.ts`
- [x] **5.5** Verify Phase 5
  - `npm run build`
  - Manual test: gallery page (cards render correctly)
  - Manual test: voting modal (thumbnails render correctly)
  - Manual test: submission detail page
  - Verify hover effects, like counts, nicknames display correctly

---

## Phase 6: Split `useShapeOperations` (936 lines)

- [x] **6.1** Create `useShapeCRUD.ts` (CRUD + helpers)
- [x] **6.2** Create `useShapeGrouping.ts` (group management)
- [x] **6.3** Create `useShapeLayering.ts` (selection, z-order, mirror)
- [x] **6.4** Refactor `useShapeOperations` into thin composer (22 lines)
- [x] **6.5** Verify Phase 6 — typecheck passes

---

## Phase 7: Barrel Exports

- [x] **7.1** Create `src/components/shared/index.ts` (18 exports)
- [x] **7.2** Create `src/components/modals/index.ts` (9 exports)
- [x] **7.3** Update imports in touched files (FriendsFeedContent, WallContent, CanvasModals, UserMenuDropdown, ColorTester)
- [x] **7.4** Verify Phase 7 — typecheck passes

---

## Phase 8: Final Verification

- [x] **8.1** Full build check — `npx tsc --noEmit` passes with zero errors
- [x] **8.2** Verify no `supabase` imports remain outside allowed files (`api.ts`, `useAuth.ts`, `useProfile.ts` auth call, `UserMenuDropdown.tsx` signOut)
- [x] **8.3** Verify all imports resolve
