# Deep Modules Refactor Plan

## Context

The codebase has grown organically with good instincts (feature-based dirs, hooks for logic, pure utils) but several modules have become **shallow** — wide interfaces that don't hide proportional complexity. This makes it harder for humans and agents to reason about how pieces connect.

The goal: make each module's interface proportional to what it hides. When you see `<Canvas />`, you shouldn't need to understand 27 props. When you open `CanvasEditorPage`, you shouldn't need to parse 20+ hook imports to find what you're looking for.

---

## Phase 1: CanvasContext — Eliminate 27-Prop Drilling

**Problem**: `Canvas` has 27 props. Most are pass-through from `CanvasEditorPage`. `LayerPanel` has 20 props. Both are shallow conduits.

**Solution**: A React Context that holds canvas document state + operations. Components consume what they need directly.

### 1.1 Create `CanvasEditorContext`

**New file**: `src/contexts/CanvasEditorContext.tsx`

```tsx
import { createContext, useContext } from 'react';
import type { Shape, ShapeGroup, CanvasState, DailyChallenge, ViewportState } from '../types';
import type { KeyMappings } from '../constants/keyboardActions';

interface CanvasEditorContextValue {
  // Document state
  canvasState: CanvasState;
  challenge: DailyChallenge;
  backgroundColor: string | null;

  // Viewport
  viewport: ViewportState;
  zoomAtPoint: (delta: number, pointX: number, pointY: number) => void;
  setZoomAtPoint: (startZoom: number, scale: number, cx: number, cy: number, startPanX: number, startPanY: number) => void;
  setPan: (panX: number, panY: number) => void;

  // Shape operations
  selectShape: (id: string | null, options?: { toggle?: boolean; range?: boolean; orderedIds?: string[] }) => void;
  selectShapes: (ids: string[], options?: { additive?: boolean }) => void;
  updateShape: (id: string, updates: Partial<Shape>, addToHistory?: boolean, label?: string) => void;
  updateShapes: (updates: Map<string, Partial<Shape>>, addToHistory?: boolean, label?: string) => void;
  commitToHistory: (label?: string) => void;
  duplicateShapes: (ids: string[]) => void;
  deleteSelectedShapes: () => void;
  undo: () => void;
  redo: () => void;
  mirrorHorizontal: (ids: string[]) => void;
  mirrorVertical: (ids: string[]) => void;
  moveLayer: (id: string, direction: 'front' | 'back' | 'up' | 'down') => void;

  // Layer/group operations (for LayerPanel)
  moveGroup: (groupId: string, direction: 'up' | 'down') => void;
  reorderLayers: (orderedIds: string[]) => void;
  reorderGroup: (groupId: string, orderedIds: string[]) => void;
  deleteShape: (id: string) => void;
  createGroup: (name: string, shapeIds: string[]) => void;
  deleteGroup: (groupId: string) => void;
  ungroupShapes: (groupId: string) => void;
  renameGroup: (groupId: string, name: string) => void;
  toggleGroupCollapsed: (groupId: string) => void;
  toggleShapeVisibility: (shapeId: string) => void;
  toggleGroupVisibility: (groupId: string) => void;
  selectGroup: (groupId: string) => void;

  // UI state
  keyMappings: KeyMappings;
  showGrid: boolean;
  showOffCanvas: boolean;
  toggleGrid: () => void;

  // Transient UI (shared between Canvas and LayerPanel)
  hoveredShapeIds: Set<string> | null;
  setHoveredShapeIds: (ids: Set<string> | null) => void;
}

const CanvasEditorContext = createContext<CanvasEditorContextValue | null>(null);

export function CanvasEditorProvider({ value, children }: { value: CanvasEditorContextValue; children: React.ReactNode }) {
  return <CanvasEditorContext.Provider value={value}>{children}</CanvasEditorContext.Provider>;
}

export function useCanvasEditor(): CanvasEditorContextValue {
  const ctx = useContext(CanvasEditorContext);
  if (!ctx) throw new Error('useCanvasEditor must be used within CanvasEditorProvider');
  return ctx;
}
```

### 1.2 Provide Context in `CanvasEditorPage`

The existing hook calls in `CanvasEditorPage` stay. We just wrap the render in `<CanvasEditorProvider>`:

```tsx
// In CanvasEditorPage, after all hooks:
const editorContext = useMemo(() => ({
  canvasState, challenge, backgroundColor,
  viewport, zoomAtPoint, setZoomAtPoint, setPan,
  selectShape, selectShapes, updateShape, updateShapes,
  commitToHistory, duplicateShapes, deleteSelectedShapes,
  undo, redo, mirrorHorizontal, mirrorVertical, moveLayer,
  moveGroup, reorderLayers, reorderGroup, deleteShape,
  createGroup, deleteGroup, ungroupShapes, renameGroup,
  toggleGroupCollapsed, toggleShapeVisibility, toggleGroupVisibility,
  selectGroup, keyMappings, showGrid, showOffCanvas, toggleGrid,
  hoveredShapeIds, setHoveredShapeIds,
}), [/* deps */]);

return (
  <CanvasEditorProvider value={editorContext}>
    {/* ... existing JSX, but Canvas and LayerPanel no longer need props */}
  </CanvasEditorProvider>
);
```

### 1.3 Simplify `Canvas` Component

**Before** (27 props):
```tsx
<Canvas
  shapes={canvasState.shapes}
  groups={canvasState.groups}
  selectedShapeIds={canvasState.selectedShapeIds}
  backgroundColor={backgroundColor}
  challenge={challenge}
  viewport={viewport}
  keyMappings={keyMappings}
  showGrid={showGrid}
  showOffCanvas={showOffCanvas}
  onSelectShape={selectShape}
  onSelectShapes={selectShapes}
  onUpdateShape={updateShape}
  onUpdateShapes={updateShapes}
  onCommitToHistory={commitToHistory}
  onDuplicateShapes={duplicateShapes}
  onDeleteSelectedShapes={deleteSelectedShapes}
  onUndo={undo}
  onRedo={redo}
  onMirrorHorizontal={mirrorHorizontal}
  onMirrorVertical={mirrorVertical}
  onZoomAtPoint={zoomAtPoint}
  onSetZoomAtPoint={setZoomAtPoint}
  onPan={setPan}
  onToggleGrid={toggleGrid}
  hoveredShapeIds={hoveredShapeIds}
  marqueeStartRef={marqueeStartRef}
/>
```

**After** (1 prop — marqueeStartRef stays because it's a ref cross-wiring concern):
```tsx
<Canvas marqueeStartRef={marqueeStartRef} />
```

Inside `Canvas.tsx`:
```tsx
export function Canvas({ marqueeStartRef }: { marqueeStartRef?: React.MutableRefObject<...> }) {
  const {
    canvasState: { shapes, groups, selectedShapeIds },
    backgroundColor, challenge, viewport, keyMappings,
    showGrid, showOffCanvas,
    selectShape, selectShapes, updateShape, updateShapes,
    commitToHistory, duplicateShapes, deleteSelectedShapes,
    undo, redo, mirrorHorizontal, mirrorVertical,
    zoomAtPoint, setZoomAtPoint, setPan, moveLayer, toggleGrid,
    hoveredShapeIds,
  } = useCanvasEditor();

  // ... rest unchanged
}
```

### 1.4 Simplify `LayerPanel` Component

**Before** (20 props):
```tsx
<LayerPanel
  shapes={canvasState.shapes}
  groups={canvasState.groups}
  selectedShapeIds={canvasState.selectedShapeIds}
  challenge={challenge}
  onSelectShape={selectShape}
  onMoveLayer={moveLayer}
  onMoveGroup={moveGroup}
  onReorderLayers={reorderLayers}
  onReorderGroup={reorderGroup}
  onDeleteShape={deleteShape}
  onRenameShape={(id, name) => updateShape(id, { name }, true, 'Rename')}
  onCreateGroup={createGroup}
  onDeleteGroup={deleteGroup}
  onUngroupShapes={ungroupShapes}
  onRenameGroup={renameGroup}
  onToggleGroupCollapsed={toggleGroupCollapsed}
  onToggleShapeVisibility={toggleShapeVisibility}
  onToggleGroupVisibility={toggleGroupVisibility}
  onSelectGroup={selectGroup}
  onToggle={toggleRight}
  onHoverShape={setHoveredShapeIds}
/>
```

**After** (1 prop — `hoveredShapeIds` is now in context too):
```tsx
<LayerPanel onToggle={toggleRight} />
```

Inside `LayerPanel.tsx`:
```tsx
export function LayerPanel({ onToggle }: { onToggle: () => void }) {
  const {
    canvasState: { shapes, groups, selectedShapeIds },
    challenge, selectShape, moveLayer, moveGroup, reorderLayers,
    reorderGroup, deleteShape, updateShape, createGroup, deleteGroup,
    ungroupShapes, renameGroup, toggleGroupCollapsed,
    toggleShapeVisibility, toggleGroupVisibility, selectGroup,
    setHoveredShapeIds,
  } = useCanvasEditor();

  const handleRenameShape = useCallback((id: string, name: string) => {
    updateShape(id, { name }, true, 'Rename');
  }, [updateShape]);

  // ... rest unchanged
}
```

---

## Phase 2: Composite `useCanvasEditorState` Hook

**Problem**: `CanvasEditorPage` imports 20+ hooks individually, making it hard to scan.

**Solution**: A composite hook that assembles all canvas-editor concerns into one return value.

### 2.1 Create `useCanvasEditorState`

**New file**: `src/hooks/canvas/useCanvasEditorState.ts`

```tsx
import { useCallback, useMemo, useRef, useState } from 'react';
import type { DailyChallenge, Shape } from '../../types';
import { useCanvasState } from './useCanvasState';
import { useViewportState } from './useViewportState';
import { useGridState } from './useGridState';
import { useOffCanvasState } from './useOffCanvasState';
import { useShapeActions } from './useShapeActions';

/**
 * Composes all canvas document + viewport + UI state into a single interface.
 * This is the "deep module" for the canvas editor — simple to consume,
 * hides the coordination of 5+ individual hooks.
 */
export function useCanvasEditorState(challenge: DailyChallenge, userId: string | undefined) {
  const canvas = useCanvasState(challenge, userId);
  const viewportState = useViewportState();
  const { showGrid, toggleGrid } = useGridState();
  const { showOffCanvas, toggleOffCanvas } = useOffCanvasState();

  const shapeActions = useShapeActions({
    shapes: canvas.canvasState.shapes,
    selectedShapeIds: canvas.canvasState.selectedShapeIds,
    updateShapes: canvas.updateShapes,
    duplicateShapes: canvas.duplicateShapes,
    mirrorHorizontal: canvas.mirrorHorizontal,
    mirrorVertical: canvas.mirrorVertical,
  });

  // Computed background color
  const backgroundColor = useMemo(() =>
    canvas.canvasState.backgroundColorIndex !== null && challenge
      ? challenge.colors[canvas.canvasState.backgroundColorIndex]
      : null,
    [canvas.canvasState.backgroundColorIndex, challenge]
  );

  // Hover state (transient UI, not document state)
  const [hoveredShapeIds, setHoveredShapeIds] = useState<Set<string> | null>(null);

  // Marquee ref for cross-component wiring
  const marqueeStartRef = useRef<((clientX: number, clientY: number) => void) | null>(null);

  // Bring forward / send backward
  const handleBringForward = useCallback(() => {
    const sorted = [...canvas.canvasState.selectedShapeIds]
      .map(id => canvas.canvasState.shapes.find(s => s.id === id))
      .filter(Boolean)
      .sort((a, b) => b!.zIndex - a!.zIndex);
    sorted.forEach(shape => canvas.moveLayer(shape!.id, 'up'));
  }, [canvas.canvasState.selectedShapeIds, canvas.canvasState.shapes, canvas.moveLayer]);

  const handleSendBackward = useCallback(() => {
    const sorted = [...canvas.canvasState.selectedShapeIds]
      .map(id => canvas.canvasState.shapes.find(s => s.id === id))
      .filter(Boolean)
      .sort((a, b) => a!.zIndex - b!.zIndex);
    sorted.forEach(shape => canvas.moveLayer(shape!.id, 'down'));
  }, [canvas.canvasState.selectedShapeIds, canvas.canvasState.shapes, canvas.moveLayer]);

  return {
    // Canvas document state (spread to keep flat)
    ...canvas,
    // Viewport
    ...viewportState,
    // Grid/off-canvas toggles
    showGrid, toggleGrid,
    showOffCanvas, toggleOffCanvas,
    // Shape actions (move/resize/mirror shortcuts)
    ...shapeActions,
    // Computed
    backgroundColor,
    // Z-order shortcuts
    handleBringForward,
    handleSendBackward,
    // Transient UI
    hoveredShapeIds, setHoveredShapeIds,
    marqueeStartRef,
  };
}
```

### 2.2 Simplify `CanvasEditorPage` Imports

**Before** (20+ hook imports, ~200 lines of hook calls):
```tsx
import { useCanvasState } from '../../hooks/canvas/useCanvasState';
import { useViewportState } from '../../hooks/canvas/useViewportState';
import { useGridState } from '../../hooks/canvas/useGridState';
import { useOffCanvasState } from '../../hooks/canvas/useOffCanvasState';
import { useShapeActions } from '../../hooks/canvas/useShapeActions';
// ... 15 more
```

**After** (~8 focused imports):
```tsx
import { useCanvasEditorState } from '../../hooks/canvas/useCanvasEditorState';
import { useAuth } from '../../hooks/auth/useAuth';
import { useProfile } from '../../hooks/auth/useProfile';
import { useSubmissions } from '../../hooks/submission/useSubmissions';
import { useSaveSubmission } from '../../hooks/submission/useSaveSubmission';
import { useSubmissionSync } from '../../hooks/submission/useSubmissionSync';
import { useAppModals } from '../../hooks/ui/useAppModals';
import { useKeyboardSettings } from '../../hooks/ui/useKeyboardSettings';
// ... UI hooks that remain separate (welcome, winner, sidebar, touch, breakpoint)
```

The hook calls section shrinks from ~130 lines to ~40 lines.

---

## Phase 3: Extract `<CanvasModals />`

**Problem**: `CanvasEditorPage` renders 7 modals inline, adding ~60 lines of JSX + the modal state wiring.

**Solution**: Move all modal rendering to a dedicated component.

### 3.1 Create `CanvasModals`

**New file**: `src/components/canvas/CanvasModals.tsx`

```tsx
import type { DailyChallenge } from '../../types';
import type { KeyMappings } from '../../constants/keyboardActions';
import { ResetConfirmModal } from './ResetConfirmModal';
import { KeyboardSettingsModal } from './KeyboardSettingsModal';
import { WinnerAnnouncementModal } from '../modals/WinnerAnnouncementModal';
import { CongratulatoryModal } from '../modals/CongratulatoryModal';
import { VotingModal } from '../voting';
import { FriendsModal } from '../modals/FriendsModal';
import { FollowsProvider } from '../../contexts/FollowsContext';

interface CanvasModalsProps {
  // Reset
  showResetConfirm: boolean;
  onConfirmReset: () => void;
  onCancelReset: () => void;
  // Keyboard settings
  showKeyboardSettings: boolean;
  keyMappings: KeyMappings;
  onUpdateBinding: (action: string, key: string) => void;
  onResetAllBindings: () => void;
  onCloseKeyboardSettings: () => void;
  keyboardSyncing: boolean;
  // Winner announcement
  showWinnerAnnouncement: boolean;
  winnerLoading: boolean;
  winnerTopThree: any[];
  winnerChallengeDate: string;
  userPlacement: any;
  congratsDismissed: boolean;
  winnerDismissed: boolean;
  onDismissCongrats: () => void;
  onDismissWinner: () => void;
  onPersistSeen: () => void;
  // Voting
  showVotingModal: boolean;
  userId?: string;
  yesterdayDate: string;
  onCloseVoting: () => void;
  onOptInToRanking: () => void;
  // Friends
  showFriendsModal: boolean;
  onCloseFriends: () => void;
}

export function CanvasModals(props: CanvasModalsProps) {
  // ... all 7 modal renders moved here from CanvasEditorPage
}
```

This removes ~60 lines of JSX from `CanvasEditorPage` and groups all modal rendering in one place.

---

## Phase 4: Centralized Query Layer

**Problem**: 10+ hooks import `supabase` directly. Each writes its own queries with ad-hoc caching. Finding "where does data come from" requires checking many files.

**Solution**: `src/lib/api.ts` — typed query functions. Hooks still own state/caching, but raw DB access is in one file.

### 4.1 Create `src/lib/api.ts`

```tsx
import { supabase } from './supabase';
import type { Shape, ShapeGroup, DailyChallenge } from '../types';

// ─── Challenges ───────────────────────────────────────────────

export async function fetchChallenge(date: string) {
  const { data, error } = await supabase
    .from('daily_challenges')
    .select('*')
    .eq('date', date)
    .single();
  if (error) throw error;
  return data as DailyChallenge;
}

// ─── Submissions ──────────────────────────────────────────────

export interface SubmissionRow {
  id: string;
  user_id: string;
  challenge_date: string;
  shapes: Shape[];
  groups: ShapeGroup[];
  background_color_index: number | null;
  created_at: string;
  updated_at: string;
  like_count: number;
}

export async function fetchSubmission(userId: string, challengeDate: string) {
  const { data, error } = await supabase
    .from('submissions')
    .select('*')
    .eq('user_id', userId)
    .eq('challenge_date', challengeDate)
    .maybeSingle();
  if (error) throw error;
  return data as SubmissionRow | null;
}

export async function upsertSubmission(params: {
  userId: string;
  challengeDate: string;
  shapes: Shape[];
  groups: ShapeGroup[];
  backgroundColorIndex: number | null;
}) {
  const { error } = await supabase.from('submissions').upsert(
    {
      user_id: params.userId,
      challenge_date: params.challengeDate,
      shapes: params.shapes,
      groups: params.groups,
      background_color_index: params.backgroundColorIndex,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,challenge_date' }
  );
  if (error) throw error;
}

export async function fetchUserSubmissions(userId: string) {
  const { data, error } = await supabase
    .from('submissions')
    .select('*')
    .eq('user_id', userId)
    .order('challenge_date', { ascending: false });
  if (error) throw error;
  return (data as SubmissionRow[]) ?? [];
}

export async function checkSubmissionExists(userId: string, challengeDate: string) {
  const { data, error } = await supabase
    .from('submissions')
    .select('id')
    .eq('user_id', userId)
    .eq('challenge_date', challengeDate)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

export async function setIncludedInRanking(userId: string, challengeDate: string) {
  const { error } = await supabase
    .from('submissions')
    .update({ included_in_ranking: true })
    .eq('user_id', userId)
    .eq('challenge_date', challengeDate);
  if (error) throw error;
}

export async function fetchAdjacentSubmissionDates(userId: string, currentDate: string) {
  const [{ data: prevData }, { data: nextData }] = await Promise.all([
    supabase
      .from('submissions')
      .select('challenge_date')
      .eq('user_id', userId)
      .lt('challenge_date', currentDate)
      .order('challenge_date', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('submissions')
      .select('challenge_date')
      .eq('user_id', userId)
      .gt('challenge_date', currentDate)
      .order('challenge_date', { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);
  return {
    prev: prevData?.challenge_date ?? null,
    next: nextData?.challenge_date ?? null,
  };
}

// ─── Wall ─────────────────────────────────────────────────────

export async function fetchWallSubmissions(challengeDate: string) {
  const { data, error } = await supabase
    .from('submissions')
    .select('*, profiles!inner(nickname, avatar_style)')
    .eq('challenge_date', challengeDate);
  if (error) throw error;
  return data ?? [];
}

// ─── Voting ───────────────────────────────────────────────────

export async function fetchVotingPair(userId: string, challengeDate: string) {
  // Specific query logic extracted from useVoting
  const { data, error } = await supabase.rpc('get_voting_pair', {
    p_user_id: userId,
    p_challenge_date: challengeDate,
  });
  if (error) throw error;
  return data;
}

export async function recordVote(userId: string, challengeDate: string, winnerId: string, loserId: string) {
  const { error } = await supabase.from('votes').insert({
    user_id: userId,
    challenge_date: challengeDate,
    winner_id: winnerId,
    loser_id: loserId,
  });
  if (error) throw error;
}

// ─── Likes ────────────────────────────────────────────────────

export async function toggleLike(userId: string, submissionId: string, isLiked: boolean) {
  if (isLiked) {
    const { error } = await supabase
      .from('likes')
      .delete()
      .eq('user_id', userId)
      .eq('submission_id', submissionId);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('likes')
      .insert({ user_id: userId, submission_id: submissionId });
    if (error) throw error;
  }
}

// ─── Profiles ─────────────────────────────────────────────────

export async function fetchProfile(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data;
}

export async function updateProfile(userId: string, updates: Record<string, unknown>) {
  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId);
  if (error) throw error;
}
```

### 4.2 Migrate Hooks to Use `api.ts`

Each hook replaces inline supabase queries with imports from `api.ts`. Example for `useSubmissions`:

**Before**:
```tsx
import { supabase } from '../../lib/supabase';

// ... inside hook:
const { data, error } = await supabase
  .from('submissions')
  .select('*')
  .eq('user_id', userId)
  .eq('challenge_date', challengeDate)
  .maybeSingle();
```

**After**:
```tsx
import { fetchSubmission, upsertSubmission, fetchUserSubmissions, checkSubmissionExists } from '../../lib/api';

// ... inside hook:
const data = await fetchSubmission(userId, challengeDate);
```

The hooks keep their state management, caching, and loading logic. Only the raw query is extracted.

---

## Phase 5: Split `SubmissionThumbnail`

**Problem**: 12 props with boolean flags controlling rendering modes (card vs plain, with/without nickname, with/without likes). Caller must know which combos are valid.

**Solution**: Extract a base SVG renderer and a card wrapper.

### 5.1 Refactor into Base + Card

**`SubmissionThumbnail`** (base — renders the SVG only):
```tsx
interface SubmissionThumbnailProps {
  shapes: Shape[];
  groups?: ShapeGroup[];
  challenge: DailyChallenge;
  backgroundColorIndex: number | null;
  size?: number;
  fill?: boolean;
}

export function SubmissionThumbnail({ shapes, groups = [], challenge, backgroundColorIndex, size = 100, fill = false }: SubmissionThumbnailProps) {
  const sortedShapes = [...getVisibleShapes(shapes, groups)].sort((a, b) => a.zIndex - b.zIndex);
  const backgroundColor = backgroundColorIndex !== null ? challenge.colors[backgroundColorIndex] : '#ffffff';

  return (
    <svg
      data-testid="submission-thumbnail"
      width={fill ? '100%' : size}
      height={fill ? '100%' : size}
      viewBox={`0 0 ${CANVAS_SIZE} ${CANVAS_SIZE}`}
      className={fill ? '' : 'rounded-(--radius-sm)'}
    >
      <rect x={0} y={0} width={CANVAS_SIZE} height={CANVAS_SIZE} fill={backgroundColor} />
      {sortedShapes.map((shape) => (
        <SVGShape key={shape.id} type={shape.type} size={shape.size} x={shape.x} y={shape.y}
          rotation={shape.rotation} flipX={shape.flipX} flipY={shape.flipY}
          color={challenge.colors[shape.colorIndex]} />
      ))}
    </svg>
  );
}
```

**`SubmissionCard`** (card variant — wraps thumbnail with chrome):
```tsx
interface SubmissionCardProps {
  shapes: Shape[];
  groups?: ShapeGroup[];
  challenge: DailyChallenge;
  backgroundColorIndex: number | null;
  nickname?: string;
  onClick?: () => void;
  href?: string;
  likeCount?: number;
}

export function SubmissionCard({ shapes, groups, challenge, backgroundColorIndex, nickname, onClick, href, likeCount }: SubmissionCardProps) {
  // Card chrome, hover effects, nickname bar, like count overlay
  // Uses <SubmissionThumbnail fill /> internally
}
```

**Impact**: Each component has a clear, non-overlapping purpose. No boolean flags controlling rendering modes.

---

## Phase 6: Split `useShapeOperations` (936 lines)

**Problem**: One hook does CRUD, selection, z-ordering, mirroring, and group management. Hard to find what you need.

**Solution**: Split into 3 focused sub-hooks, re-exported from `useShapeOperations` for backward compat.

### Sub-hooks:

1. **`useShapeCRUD.ts`** (~300 lines) — `addShape`, `duplicateShape`, `duplicateShapes`, `updateShape`, `updateShapes`, `deleteShape`, `deleteSelectedShapes`
2. **`useShapeGrouping.ts`** (~300 lines) — `createGroup`, `deleteGroup`, `ungroupShapes`, `renameGroup`, `toggleGroupCollapsed`, `toggleShapeVisibility`, `toggleGroupVisibility`, `moveToGroup`, `selectGroup`
3. **`useShapeLayering.ts`** (~200 lines) — `moveLayer`, `moveGroup`, `reorderLayers`, `reorderGroup`, `setBackgroundColor`, `mirrorHorizontal`, `mirrorVertical`, `selectShape`, `selectShapes`

**`useShapeOperations.ts`** becomes a thin composer:
```tsx
export function useShapeOperations(challenge: DailyChallenge | null, setCanvasState: SetCanvasState) {
  const crud = useShapeCRUD(challenge, setCanvasState);
  const grouping = useShapeGrouping(setCanvasState);
  const layering = useShapeLayering(setCanvasState);
  return { ...crud, ...grouping, ...layering };
}
```

Each sub-hook is independently readable. The composite maintains the existing interface.

---

## Phase 7: Barrel Exports for `shared/` and `modals/`

**Problem**: `shared/` (15 files) and `modals/` (9 files) have no barrel exports, forcing consumers to write deep import paths.

**Solution**: Add `index.ts` to each.

```tsx
// src/components/shared/index.ts
export { Button } from './Button';
export { Modal } from './Modal';
export { Card } from './Card';
export { Link } from './Link';
export { LoadingSpinner } from './LoadingSpinner';
export { Avatar } from './Avatar';
export { SubmissionThumbnail } from './SubmissionThumbnail';
export { SubmissionCard } from './SubmissionCard';
export { SVGShape } from './SVGShape';
// ... etc
```

```tsx
// src/components/modals/index.ts
export { WelcomeModal } from './WelcomeModal';
export { OnboardingModal } from './OnboardingModal';
export { FriendsModal } from './FriendsModal';
export { WinnerAnnouncementModal } from './WinnerAnnouncementModal';
export { CongratulatoryModal } from './CongratulatoryModal';
// ... etc
```

---

## Verification

After each phase:
1. `npm run build` — no type errors
2. Run existing tests — all pass
3. Manual test: canvas editor interactions (add shape, drag, resize, rotate, undo/redo, groups)
4. Manual test: voting modal flow, gallery page, submission detail
5. Verify code splitting still works (lazy imports in `App.tsx`)
6. Spot-check that no visual regressions occurred

---

## Resolved Design Decisions

1. **`marqueeStartRef`** → **Keep as prop** on Canvas. Refs are imperative escape hatches, not reactive state. Anti-pattern in context. Canvas goes from 27 props to 1.
2. **`hoveredShapeIds`** → **Put in context** (including `setHoveredShapeIds`). Shared state between siblings (LayerPanel writes, Canvas reads). Removes `onHoverShape` prop from LayerPanel — it goes from 20 props to 1 (`onToggle`).
3. **`CanvasModals` wiring** → **Just props**. Single consumer (CanvasEditorPage → CanvasModals). Context for one parent-child relationship is over-engineering.
4. **API error handling** → **Throw on error**. Simpler return types, can't silently ignore errors, standard JS pattern. Callers use try/catch.
5. **Phase ordering** → **Sequential, as written**. Each phase builds on verified state. Easier to review and bisect.
