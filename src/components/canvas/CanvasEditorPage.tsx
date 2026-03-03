import { useCallback, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { supabase } from '../../lib/supabase';
import type { DailyChallenge, Shape } from '../../types';
import type { ThemeMode, ThemeName } from '../../hooks/ui/useThemeState';
import { getYesterdayDateUTC } from '../../utils/dailyChallenge';
import { invalidateWallCache } from '../../hooks/challenge/useWallOfTheDay';
import { useAuth } from '../../hooks/auth/useAuth';
import { useProfile } from '../../hooks/auth/useProfile';
import { useCanvasState } from '../../hooks/canvas/useCanvasState';
import { useViewportState } from '../../hooks/canvas/useViewportState';
import { useGridState } from '../../hooks/canvas/useGridState';
import { useOffCanvasState } from '../../hooks/canvas/useOffCanvasState';
import { useShapeActions } from '../../hooks/canvas/useShapeActions';
import { useSidebarState } from '../../hooks/ui/useSidebarState';
import { useAppModals } from '../../hooks/ui/useAppModals';
import { useWelcomeModal } from '../../hooks/ui/useWelcomeModal';
import { useKeyboardSettings } from '../../hooks/ui/useKeyboardSettings';
import { useWinnerAnnouncement } from '../../hooks/ui/useWinnerAnnouncement';
import { useIsTouchDevice } from '../../hooks/ui/useIsTouchDevice';
import { useIsDesktop } from '../../hooks/ui/useBreakpoint';
import { useSubmissions } from '../../hooks/submission/useSubmissions';
import { useSaveSubmission } from '../../hooks/submission/useSaveSubmission';
import { useSubmissionSync } from '../../hooks/submission/useSubmissionSync';
import { Canvas } from './Canvas';
import { TopBar } from './TopBar';
import { BottomToolbar } from './BottomToolbar';
import { ToolsPanel } from './ToolsPanel';
import { ZoomControls } from './ZoomControls';
import { KeyboardShortcutsPopover } from './KeyboardShortcutsPopover';
import { BackgroundColorPicker } from './BackgroundColorPicker';
import { UndoRedoToast } from './UndoRedoToast';
import { KeyboardSettingsModal } from './KeyboardSettingsModal';
import { ResetConfirmModal } from './ResetConfirmModal';
import { LayerPanel } from '../LayerPanel';
import { OnboardingModal } from '../modals/OnboardingModal';
import { WelcomeModal } from '../modals/WelcomeModal';
import { FriendsModal } from '../modals/FriendsModal';
import { WinnerAnnouncementModal } from '../modals/WinnerAnnouncementModal';
import { CongratulatoryModal } from '../modals/CongratulatoryModal';
import { VotingModal } from '../voting';
import { FollowsProvider } from '../../contexts/FollowsContext';

function InspirationCenter({ word }: { word: string }) {
  return (
    <div className="flex flex-col items-center leading-tight min-w-0">
      <span className="hidden md:block text-xs uppercase tracking-widest text-(--color-accent)">Today&apos;s Inspiration</span>
      <span className="text-sm md:text-xl font-semibold text-(--color-text-primary) capitalize font-display truncate max-w-full">{word}</span>
    </div>
  );
}

interface CanvasEditorPageProps {
  challenge: DailyChallenge;
  todayDate: string;
  themeMode: ThemeMode;
  onSetThemeMode: (mode: ThemeMode) => void;
  themeName: ThemeName;
  onSetThemeName: (name: ThemeName) => void;
}

export function CanvasEditorPage({ challenge, todayDate, themeMode, onSetThemeMode, themeName, onSetThemeName }: CanvasEditorPageProps) {
  // Modal states
  const {
    showKeyboardSettings,
    showVotingModal,
    showResetConfirm,
    showFriendsModal,
    congratsDismissed,
    winnerDismissed,
    openKeyboardSettings,
    closeKeyboardSettings,
    openVotingModal,
    closeVotingModal,
    openResetConfirm,
    closeResetConfirm,
    closeFriendsModal,
    dismissCongrats,
    dismissWinner,
  } = useAppModals();
  const { isOpen: showWelcome, dismiss: dismissWelcome } = useWelcomeModal();

  // Auth state
  const { user } = useAuth();
  const { profile, loading: profileLoading, updateNickname } = useProfile(user?.id);
  const { saveSubmission, loadSubmission, saving, hasSubmittedToday } = useSubmissions(user?.id, todayDate);

  // Winner announcement for yesterday's results
  const {
    shouldShow: showWinnerAnnouncement,
    topThree: winnerTopThree,
    challengeDate: winnerChallengeDate,
    dismiss: dismissWinnerAnnouncement,
    loading: winnerLoading,
    userPlacement,
    persistSeen,
  } = useWinnerAnnouncement(user?.id);

  // Yesterday's date for voting
  const yesterdayDate = useMemo(() => getYesterdayDateUTC(), []);

  // Keyboard settings
  const {
    mappings: keyMappings,
    updateBinding,
    resetAllBindings,
    syncing: keyboardSyncing,
  } = useKeyboardSettings(user?.id);

  // Canvas state
  const {
    canvasState,
    addShape,
    duplicateShapes,
    updateShape,
    updateShapes,
    deleteShape,
    deleteSelectedShapes,
    selectShape,
    selectShapes,
    moveLayer,
    moveGroup,
    reorderLayers,
    reorderGroup,
    setBackgroundColor,
    resetCanvas,
    mirrorHorizontal,
    mirrorVertical,
    undo,
    redo,
    canUndo,
    canRedo,
    commitToHistory,
    createGroup,
    deleteGroup,
    ungroupShapes,
    renameGroup,
    toggleGroupCollapsed,
    toggleShapeVisibility,
    toggleGroupVisibility,
    selectGroup,
    loadCanvasState,
    toast,
    dismissToast,
  } = useCanvasState(challenge, user?.id);

  // Sync submission from server
  const { hydrated } = useSubmissionSync({
    userId: user?.id,
    challenge,
    loadSubmission,
    loadCanvasState,
  });

  // Viewport state
  const {
    viewport,
    setZoom,
    setPan,
    zoomAtPoint,
    setZoomAtPoint,
    resetViewport,
    minZoom,
    maxZoom,
  } = useViewportState();

  // Sidebar state
  const {
    leftOpen,
    rightOpen,
    toggleLeft,
    toggleRight,
  } = useSidebarState();

  // Theme state (received from App)

  // Grid state
  const { showGrid, toggleGrid } = useGridState();

  // Off-canvas state
  const { showOffCanvas, toggleOffCanvas } = useOffCanvasState();

  // Shape actions (move, rotate, resize, mirror, duplicate)
  const {
    handleMoveShapes,
    handleDuplicate,
    handleMirrorHorizontal,
    handleMirrorVertical,
    handleResizeShapes,
  } = useShapeActions({
    shapes: canvasState.shapes,
    selectedShapeIds: canvasState.selectedShapeIds,
    updateShapes,
    duplicateShapes,
    mirrorHorizontal,
    mirrorVertical,
  });

  // Bring forward / send backward (z-ordering from tools panel)
  const handleBringForward = useCallback(() => {
    const sorted = [...canvasState.selectedShapeIds]
      .map(id => canvasState.shapes.find(s => s.id === id))
      .filter(Boolean)
      .sort((a, b) => b!.zIndex - a!.zIndex);
    sorted.forEach(shape => moveLayer(shape!.id, 'up'));
  }, [canvasState.selectedShapeIds, canvasState.shapes, moveLayer]);

  const handleSendBackward = useCallback(() => {
    const sorted = [...canvasState.selectedShapeIds]
      .map(id => canvasState.shapes.find(s => s.id === id))
      .filter(Boolean)
      .sort((a, b) => a!.zIndex - b!.zIndex);
    sorted.forEach(shape => moveLayer(shape!.id, 'down'));
  }, [canvasState.selectedShapeIds, canvasState.shapes, moveLayer]);

  // Save submission
  const { saveStatus, handleSave } = useSaveSubmission({
    challenge,
    shapes: canvasState.shapes,
    groups: canvasState.groups,
    backgroundColorIndex: canvasState.backgroundColorIndex,
    user,
    saveSubmission,
    onSaveSuccess: () => {
      if (challenge) {
        invalidateWallCache(challenge.date);
      }
      openVotingModal();
    },
  });

  // Zoom handlers
  const handleZoomIn = useCallback(() => {
    setZoom(viewport.zoom + 0.1);
  }, [viewport.zoom, setZoom]);

  const handleZoomOut = useCallback(() => {
    setZoom(viewport.zoom - 0.1);
  }, [viewport.zoom, setZoom]);

  // Reset handlers
  const handleReset = () => openResetConfirm();
  const confirmReset = () => {
    resetCanvas();
    closeResetConfirm();
  };
  const cancelReset = () => closeResetConfirm();

  // Handler for opting into ranking without voting (bootstrap case: < 2 other submissions)
  const handleOptInToRanking = useCallback(async () => {
    if (!user || !challenge) {
      console.error('[handleOptInToRanking] Missing user or challenge', { user: !!user, challenge: !!challenge });
      return;
    }
    const { error } = await supabase
      .from('submissions')
      .update({ included_in_ranking: true })
      .eq('user_id', user.id)
      .eq('challenge_date', challenge.date);
    if (error) {
      console.error('[handleOptInToRanking] Error:', error);
    }
  }, [user, challenge]);

  const isTouchDevice = useIsTouchDevice();
  const isDesktop = useIsDesktop();

  // Selected color for new shapes
  const [selectedColorIndex, setSelectedColorIndex] = useState<number>(0);

  // Add shape at canvas center with the given color
  const handleAddShape = useCallback((shapeIndex: number, colorIndex: number) => {
    addShape(shapeIndex, colorIndex);
  }, [addShape]);

  // When a color is clicked, also recolor any selected shapes
  const handleSetSelectedColor = useCallback((colorIndex: number) => {
    setSelectedColorIndex(colorIndex);
    if (canvasState.selectedShapeIds.size > 0) {
      const updates = new Map<string, Partial<Shape>>();
      canvasState.selectedShapeIds.forEach(id => {
        updates.set(id, { colorIndex });
      });
      updateShapes(updates, true, 'Change color');
    }
  }, [canvasState.selectedShapeIds, updateShapes]);

  // Hover highlight state (transient UI, not canvas document state)
  const [hoveredShapeIds, setHoveredShapeIds] = useState<Set<string> | null>(null);

  // Computed values
  const backgroundColor =
    canvasState.backgroundColorIndex !== null && challenge
      ? challenge.colors[canvasState.backgroundColorIndex]
      : null;

  // Marquee selection from outside the canvas (checkerboard background)
  const marqueeStartRef = useRef<((clientX: number, clientY: number) => void) | null>(null);
  const handleBackgroundMouseDown = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const target = e.target as HTMLElement;
    if (target === e.currentTarget || target.classList.contains('canvas-wrapper')) {
      if (e.button !== 0) return;
      e.preventDefault(); // Prevent text selection during marquee drag
      marqueeStartRef.current?.(e.clientX, e.clientY);
    }
  }, []);

  // Show onboarding modal if user is logged in but hasn't completed onboarding
  const showOnboarding = user && profile && !profile.onboarding_complete;

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {showWelcome && <WelcomeModal onDismiss={dismissWelcome} challenge={challenge} />}
      {showOnboarding && <OnboardingModal onComplete={updateNickname} />}

      {/* Top bar */}
      <TopBar
        themeMode={themeMode}
        onSetThemeMode={onSetThemeMode}
        themeName={themeName}
        onSetThemeName={onSetThemeName}
        centerContent={<InspirationCenter word={challenge.word} />}
        onReset={handleReset}
        onSave={handleSave}
        isSaving={saving}
        saveStatus={saveStatus}
        hasSubmittedToday={hasSubmittedToday}
        isLoggedIn={!!user}
        profile={profile}
        profileLoading={profileLoading}
      />

      {/* Canvas area wrapper (everything below top bar) */}
      <div className="flex-1 relative overflow-hidden">
        {/* Canvas fills area */}
        <main
          className="w-full h-full flex items-center justify-center bg-(--color-checkered-bg) overflow-auto"
          onMouseDown={handleBackgroundMouseDown}
        >
          <div className="overflow-visible p-4 md:p-16 canvas-wrapper">
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
          </div>
        </main>

        {/* Empty canvas prompt — only after hydration to avoid flash */}
        {hydrated && canvasState.shapes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center z-0 pointer-events-none">
            <div
              className="flex items-center gap-3 px-5 py-2.5 select-none pointer-events-auto"
              style={{
                background: 'var(--color-card-bg)',
                border: 'var(--border-width, 2px) solid var(--color-border)',
                borderRadius: 'var(--radius-xl)',
                boxShadow: 'var(--shadow-card)',
              }}
            >
              <p className="text-sm text-(--color-text-secondary)">
                Add a shape below to start creating!
              </p>
              <div className="w-px h-5 bg-(--color-border-light) shrink-0" />
              <div className="flex items-center gap-2">
                <span className="text-sm text-(--color-text-secondary)">
                  Background: 
                </span>
                <BackgroundColorPicker
                  colors={challenge.colors}
                  selectedIndex={canvasState.backgroundColorIndex}
                  onSelect={setBackgroundColor}
                />
              </div>
            </div>
          </div>
        )}

        {/* Left tools panel collapsed toggle */}
        {!leftOpen && (
          <button
            className="absolute left-3 top-3 z-20 w-10 h-10 flex items-center justify-center cursor-pointer transition-colors rounded-(--radius-md) bg-(--color-card-bg) text-(--color-text-secondary) hover:bg-(--color-hover) hover:text-(--color-text-primary)"
            style={{ border: 'var(--border-width, 2px) solid var(--color-border)', boxShadow: 'var(--shadow-btn)' }}
            onClick={toggleLeft}
            title="Show Tools"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
            </svg>
          </button>
        )}

        {/* Left tools panel */}
        <AnimatePresence>
          {leftOpen && (
            <motion.div
              key="left-tools"
              initial={{ x: -60, opacity: 0 }}
              animate={{ x: 0, opacity: 1, transition: { type: 'spring', stiffness: 400, damping: 30 } }}
              exit={{ x: -60, opacity: 0, transition: { duration: 0.2 } }}
              className="absolute top-3 left-3 z-20"
            >
              <ToolsPanel
                keyMappings={keyMappings}
                hasSelection={canvasState.selectedShapeIds.size > 0}
                canUndo={canUndo}
                canRedo={canRedo}
                showGrid={showGrid}
                showOffCanvas={showOffCanvas}
                onClose={toggleLeft}
                onUndo={undo}
                onRedo={redo}
                onDuplicate={handleDuplicate}
                onDelete={deleteSelectedShapes}
                onMoveUp={() => handleMoveShapes(0, -1)}
                onMoveDown={() => handleMoveShapes(0, 1)}
                onMoveLeft={() => handleMoveShapes(-1, 0)}
                onMoveRight={() => handleMoveShapes(1, 0)}
                onSizeIncrease={() => handleResizeShapes(5)}
                onSizeDecrease={() => handleResizeShapes(-5)}
                onMirrorHorizontal={handleMirrorHorizontal}
                onMirrorVertical={handleMirrorVertical}
                onBringForward={handleBringForward}
                onSendBackward={handleSendBackward}
                onToggleGrid={toggleGrid}
                onToggleOffCanvas={toggleOffCanvas}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bottom floating toolbar */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
          <BottomToolbar
            challenge={challenge}
            selectedColorIndex={selectedColorIndex}
            backgroundColorIndex={canvasState.backgroundColorIndex}
            hasSelection={canvasState.selectedShapeIds.size > 0}
            onAddShape={handleAddShape}
            onSetSelectedColor={handleSetSelectedColor}
            onSetBackground={setBackgroundColor}
          />
        </div>

        {/* Zoom controls — bottom right (raised on mobile to avoid BottomToolbar) */}
        <div className="absolute bottom-18 md:bottom-4 right-4 z-10">
          <ZoomControls
            zoom={viewport.zoom}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onResetZoom={resetViewport}
            minZoom={minZoom}
            maxZoom={maxZoom}
          />
        </div>

        {/* Keyboard shortcuts popover — bottom left (hidden on touch devices) */}
        {!isTouchDevice && (
          <div className="absolute bottom-4 left-4 z-30">
            <KeyboardShortcutsPopover
              keyMappings={keyMappings}
              onOpenSettings={openKeyboardSettings}
            />
          </div>
        )}

        {/* Right layers panel collapsed toggle */}
        {!rightOpen && (
          <button
            className={`absolute z-20 flex items-center gap-1.5 h-10 px-3.5 cursor-pointer transition-colors rounded-(--radius-md) bg-(--color-card-bg) hover:bg-(--color-hover) text-(--color-text-secondary) ${
              isDesktop ? 'right-3 top-3' : 'right-3 bottom-30'
            }`}
            style={{ border: 'var(--border-width, 2px) solid var(--color-border)', boxShadow: 'var(--shadow-btn)' }}
            onClick={toggleRight}
            title="Show Layers"
            aria-label="Open layers"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 2 7 12 12 22 7 12 2" />
              <polyline points="2 17 12 22 22 17" />
              <polyline points="2 12 12 17 22 12" />
            </svg>
            <span className="text-xs font-semibold leading-none">
              {canvasState.shapes.length}
            </span>
          </button>
        )}

        {/* Right layers panel — side panel on desktop, bottom sheet on mobile */}
        <AnimatePresence>
          {rightOpen && (
            <motion.div
              key="right-sidebar"
              initial={isDesktop ? { x: 40, opacity: 0 } : { y: 100, opacity: 0 }}
              animate={isDesktop
                ? { x: 0, opacity: 1, transition: { type: 'spring', stiffness: 400, damping: 30 } }
                : { y: 0, opacity: 1, transition: { type: 'spring', stiffness: 400, damping: 30 } }
              }
              exit={isDesktop
                ? { x: 40, opacity: 0, transition: { duration: 0.2 } }
                : { y: 100, opacity: 0, transition: { duration: 0.2 } }
              }
              className={isDesktop
                ? 'absolute top-3 right-3 z-20'
                : 'absolute bottom-18 left-0 right-0 z-20 max-h-[50vh]'
              }
              style={isDesktop ? { width: 280 } : undefined}
            >
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
            </motion.div>
          )}
        </AnimatePresence>

        {toast && (
          <UndoRedoToast
            key={toast.key}
            message={toast.message}
            onDismiss={dismissToast}
          />
        )}
      </div>

      {/* Modals (render above everything) */}
      {showResetConfirm && (
        <ResetConfirmModal onConfirm={confirmReset} onCancel={cancelReset} />
      )}

      {showKeyboardSettings && (
        <KeyboardSettingsModal
          mappings={keyMappings}
          onUpdateBinding={updateBinding}
          onResetAll={resetAllBindings}
          onClose={closeKeyboardSettings}
          syncing={keyboardSyncing}
        />
      )}

      {showWinnerAnnouncement && !winnerLoading && (
        <>
          {userPlacement && !congratsDismissed ? (
            <CongratulatoryModal
              userEntry={userPlacement}
              challengeDate={winnerChallengeDate}
              onDismiss={() => {
                persistSeen();
                dismissCongrats();
              }}
            />
          ) : !winnerDismissed ? (
            <WinnerAnnouncementModal
              challengeDate={winnerChallengeDate}
              topThree={winnerTopThree}
              onDismiss={() => {
                dismissWinnerAnnouncement();
                dismissWinner();
              }}
              onViewSubmission={(submissionId: string) => {
                window.location.href = `?view=submission&id=${submissionId}`;
              }}
            />
          ) : null}
        </>
      )}

      {showVotingModal && user && (
        <VotingModal
          userId={user.id}
          challengeDate={yesterdayDate}
          onComplete={closeVotingModal}
          onSkipVoting={closeVotingModal}
          onOptInToRanking={handleOptInToRanking}
        />
      )}

      {showFriendsModal && (
        <FollowsProvider>
          <FriendsModal onClose={closeFriendsModal} />
        </FollowsProvider>
      )}
    </div>
  );
}
