import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { RotateCcw } from 'lucide-react';
import type { DailyChallenge, Shape } from '../types';
import { getYesterdayDateUTC } from '../utils/dailyChallenge';
import { invalidateWallCache } from '../hooks/challenge/useWallOfTheDay';
import { setIncludedInRanking } from '../lib/api';
import { useAuthContext } from '../contexts/AuthContext';
import { useSetHeader } from '../contexts/HeaderContext';
import { useCanvasEditorState } from '../hooks/canvas/useCanvasEditorState';
import { useSidebarState } from '../hooks/ui/useSidebarState';
import { useAppModals } from '../hooks/ui/useAppModals';
import { useKeyboardSettings } from '../hooks/ui/useKeyboardSettings';
import { useWinnerAnnouncement } from '../hooks/ui/useWinnerAnnouncement';
import { useIsTouchDevice } from '../hooks/ui/useIsTouchDevice';
import { useIsDesktop, useBreakpoint } from '../hooks/ui/useBreakpoint';
import { useSubmissions } from '../hooks/submission/useSubmissions';
import { useSaveSubmission } from '../hooks/submission/useSaveSubmission';
import { useSubmissionSync } from '../hooks/submission/useSubmissionSync';
import { useSubmissionStatus } from '../contexts/SubmissionStatusContext';
import { CanvasEditorProvider } from '../contexts/CanvasEditorContext';
import { Canvas } from '../components/canvas/Canvas';
import { Button } from '../components/shared/Button';
import { LoginPromptModal } from '../components/social/LoginPromptModal';
import { BottomToolbar } from '../components/canvas/BottomToolbar';
import { ToolsPanel } from '../components/canvas/ToolsPanel';
import { ZoomControls } from '../components/canvas/ZoomControls';
import { KeyboardShortcutsPopover } from '../components/canvas/KeyboardShortcutsPopover';
import { UndoRedoToast } from '../components/canvas/UndoRedoToast';
import { CanvasModals } from '../components/canvas/CanvasModals';
import { LayerPanel } from '../components/LayerPanel';
import { OnboardingModal } from '../components/modals/OnboardingModal';
import { MAX_SHAPES, getShapeLimitSeverity, getShapeLimitColor } from '../utils/shapeLimit';
import { ChallengePreview } from '../components/shared/ChallengePreview';
import { useTour } from '../hooks/ui/useTour';
import { TourOverlay } from '../components/tour/TourOverlay';
import { useDiscoveryHints } from '../hooks/ui/useDiscoveryHints';
import { DiscoveryHint } from '../components/shared/DiscoveryHint';

function ChallengeDisplay({ challenge }: { challenge: DailyChallenge }) {
  const isSingleRow = useBreakpoint(520);
  const isWideEnoughForLabel = useBreakpoint(950);
  // Show label when >=950 (plenty of room) or <500 (two-row, dedicated challenge row)
  const showLabel = isWideEnoughForLabel || !isSingleRow;
  return (
    <div data-tour="challenge" className={`flex items-center ${isWideEnoughForLabel ? 'gap-6' : 'gap-3'}`}>
      {showLabel && (
        <span className={`uppercase tracking-widest text-(--color-accent) font-semibold whitespace-nowrap ${isSingleRow ? 'text-xs' : 'text-[0.625rem]'}`}>
          Today{'\''}s Challenge:
        </span>
      )}
      <ChallengePreview challenge={challenge} />
    </div>
  );
}

function CanvasHeaderActions({
  onReset,
  onSave,
  isSaving,
  saveStatus,
  saveError,
  hasSubmittedToday,
  isLoggedIn,
  shapeCount,
}: {
  onReset: () => void;
  onSave: () => void;
  isSaving: boolean;
  saveStatus: 'idle' | 'saved' | 'error';
  saveError: string | null;
  hasSubmittedToday: boolean;
  isLoggedIn: boolean;
  shapeCount: number;
}) {
  const isDesktop = useIsDesktop();
  const showGallery = useBreakpoint(900);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);

  const isOverLimit = shapeCount > MAX_SHAPES;

  const saveLabel = isSaving
    ? 'Saving...'
    : isOverLimit
      ? 'Remove shapes to submit'
      : saveStatus === 'error'
        ? 'Failed'
        : saveStatus === 'saved'
          ? 'Saved'
          : hasSubmittedToday
            ? 'Submitted'
            : 'Submit!';

  return (
    <>
      {/* Reset — icon-only on mobile */}
      <Button
        variant="secondary"
        className="hover:text-(--color-danger)"
        onClick={onReset}
        title="Reset canvas"
      >
        {isDesktop ? 'Reset' : <RotateCcw size={14} />}
      </Button>

      {/* Submit */}
      <div data-tour="submit">
        {isLoggedIn ? (
          <Button
            variant={saveStatus === 'error' ? 'secondary' : 'primary'}
            className={`px-4 font-bold disabled:opacity-50 disabled:cursor-not-allowed ${saveStatus === 'error' ? 'text-(--color-danger)' : ''}`}
            onClick={onSave}
            disabled={isSaving || hasSubmittedToday || isOverLimit}
            title={isOverLimit ? `Too many shapes (${shapeCount}/${MAX_SHAPES}) — remove some to submit` : saveStatus === 'error' && saveError ? saveError : hasSubmittedToday ? 'Already submitted today' : 'Submit your creation'}
          >
            {saveLabel}
          </Button>
        ) : (
          <>
            <Button
              variant="primary"
              className="px-4 font-bold"
              onClick={() => setShowLoginPrompt(true)}
              title="Sign in to submit"
            >
              Submit!
            </Button>
            {showLoginPrompt && (
              <LoginPromptModal
                onClose={() => setShowLoginPrompt(false)}
                title="Submit Your Creation"
                message="Sign in to submit your artwork and join today's challenge."
              />
            )}
          </>
        )}
      </div>

      {/* Divider + Gallery — hidden on mobile and narrow desktop */}
      {showGallery && (
        <>
          <div className="w-px h-5 bg-(--color-border) mx-1" />
          <div data-hint="gallery">
            <Button as="a" variant="ghost" href="/?view=gallery">
              Gallery
            </Button>
          </div>
        </>
      )}
    </>
  );
}

interface CanvasEditorPageProps {
  challenge: DailyChallenge;
}

export function CanvasEditorPage({ challenge }: CanvasEditorPageProps) {
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

  // Auth state
  const { user, profile, updateNickname } = useAuthContext();
  const { saveSubmission, loadSubmission, saving } = useSubmissions(user?.id);
  const { hasSubmittedToday, markAsSubmitted } = useSubmissionStatus();

  // Winner announcement for yesterday's results
  const {
    shouldShow: showWinnerAnnouncement,
    topThree: winnerTopThree,
    challengeDate: winnerChallengeDate,
    dismiss: dismissWinnerAnnouncement,
    loading: winnerLoading,
    userPlacement,
    rankingStats: winnerRankingStats,
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

  // Canvas editor state (composes canvas, viewport, grid, off-canvas, shape actions)
  const {
    editorContext,
    canvasState,
    loadCanvasState,
    resetCanvas,
    viewport,
    resetViewport,
    minZoom,
    maxZoom,
    handleZoomIn,
    handleZoomOut,
    showGrid,
    toggleGrid,
    showOffCanvas,
    toggleOffCanvas,
    handleMoveShapes,
    handleDuplicate,
    handleMirrorHorizontal,
    handleMirrorVertical,
    handleResizeShapes,
    handleBringForward,
    handleSendBackward,
    addShape,
    selectShapes,
    setBackgroundColor,
    updateShapes,
    deleteSelectedShapes,
    undo,
    redo,
    canUndo,
    canRedo,
    marqueeStartRef,
    toast,
    dismissToast,
  } = useCanvasEditorState({ challenge, userId: user?.id, keyMappings });

  // Sync submission from server
  const { hydrated } = useSubmissionSync({
    userId: user?.id,
    challenge,
    loadSubmission,
    loadCanvasState,
  });

  // Sidebar state
  const {
    leftOpen,
    rightOpen,
    toggleLeft,
    toggleRight,
  } = useSidebarState();

  // Save submission
  const { saveStatus, saveError, handleSave } = useSaveSubmission({
    challenge,
    shapes: canvasState.shapes,
    groups: canvasState.groups,
    backgroundColorIndex: canvasState.backgroundColorIndex,
    user,
    saveSubmission,
    onSaveSuccess: () => {
      markAsSubmitted();
      if (challenge) {
        invalidateWallCache(challenge.date);
      }
      openVotingModal();
    },
  });

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
    try {
      await setIncludedInRanking(user.id, challenge.date);
    } catch (error) {
      console.error('[handleOptInToRanking] Error:', error);
    }
  }, [user, challenge]);

  const isTouchDevice = useIsTouchDevice();
  const isDesktop = useIsDesktop();
  const tour = useTour();
  const hints = useDiscoveryHints({ tourActive: tour.active });

  useEffect(() => {
    hints.onShapeSelectionChange(canvasState.selectedShapeIds.size);
  }, [canvasState.selectedShapeIds.size]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    hints.onShapeCountChange(canvasState.shapes.length);
  }, [canvasState.shapes.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Base color index for new shapes (updated when user clicks a color swatch)
  const [baseColorIndex, setBaseColorIndex] = useState<number>(0);

  // Derive effective color: if all selected shapes share a color, show that; otherwise use base
  const selectedColorIndex = useMemo(() => {
    if (canvasState.selectedShapeIds.size === 0) return baseColorIndex;
    const selectedShapes = canvasState.shapes.filter((s) =>
      canvasState.selectedShapeIds.has(s.id)
    );
    if (selectedShapes.length === 0) return baseColorIndex;
    const firstColor = selectedShapes[0].colorIndex;
    const allSameColor = selectedShapes.every((s) => s.colorIndex === firstColor);
    return allSameColor ? firstColor : baseColorIndex;
  }, [canvasState.selectedShapeIds, canvasState.shapes, baseColorIndex]);

  const handleAddShape = useCallback((shapeIndex: number, colorIndex: number) => {
    addShape(shapeIndex, colorIndex);
  }, [addShape]);

  // When advancing from add-shape step, auto-add a shape if none on canvas
  const handleTourNext = useCallback(() => {
    if (tour.step === 'add-shape') {
      addShape(0, 1);
      // Delay so shape renders and selectedShapeId propagates before manipulate step
      requestAnimationFrame(() => tour.next());
      return;
    }
    tour.next();
  }, [tour, addShape]);

  // When a color is clicked, also recolor any selected shapes
  const handleSetSelectedColor = useCallback((colorIndex: number) => {
    setBaseColorIndex(colorIndex);
    if (canvasState.selectedShapeIds.size > 0) {
      const updates = new Map<string, Partial<Shape>>();
      canvasState.selectedShapeIds.forEach((id: string) => {
        updates.set(id, { colorIndex });
      });
      updateShapes(updates, true, 'Change color');
    }
  }, [canvasState.selectedShapeIds, updateShapes]);

  const handleBackgroundMouseDown = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const target = e.target as HTMLElement;
    if (target === e.currentTarget || target.classList.contains('canvas-wrapper')) {
      if (e.button !== 0) return;
      e.preventDefault();
      marqueeStartRef.current?.(e.clientX, e.clientY);
    }
  }, [marqueeStartRef]);

  const showOnboarding = user && profile && !profile.onboarding_complete;
  const anyModalOpen = !!(showOnboarding || showWinnerAnnouncement || showVotingModal || showResetConfirm || showFriendsModal);

  // Push header config to the shared TopBar
  useSetHeader({
    centerContent: <ChallengeDisplay challenge={challenge} />,
    rightContent: (
      <CanvasHeaderActions
        onReset={handleReset}
        onSave={handleSave}
        isSaving={saving}
        saveStatus={saveStatus}
        saveError={saveError}
        hasSubmittedToday={hasSubmittedToday}
        isLoggedIn={!!user}
        shapeCount={canvasState.shapes.length}
      />
    ),
  });

  return (
    <CanvasEditorProvider value={editorContext}>
      {showOnboarding && <OnboardingModal onComplete={updateNickname} />}

      <AnimatePresence>
        {tour.active && !anyModalOpen && (
          <TourOverlay
            step={tour.step}
            selectedShapeId={canvasState.selectedShapeIds.size === 1 ? [...canvasState.selectedShapeIds][0] : null}
            challenge={challenge}
            onNext={handleTourNext}
            onSkip={tour.skip}
          />
        )}
      </AnimatePresence>

      {hints.activeHint && !tour.active && (
        <DiscoveryHint hintId={hints.activeHint} onDismiss={hints.dismissHint} />
      )}

      {/* Canvas area wrapper */}
      <div className="flex-1 relative overflow-hidden">
        {/* Canvas fills area */}
        <main
          className="w-full h-full flex items-center justify-center bg-(--color-checkered-bg) overflow-auto"
          onMouseDown={handleBackgroundMouseDown}
        >
          <div className="overflow-visible p-4 md:p-16 canvas-wrapper">
            <Canvas marqueeStartRef={marqueeStartRef} onSetColorIndex={handleSetSelectedColor} />
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
            </div>
          </div>
        )}

        {/* Left tools panel collapsed toggle */}
        {!leftOpen && (
          <button
            data-hint="left-toolbar"
            className="absolute left-3 top-3 z-20 w-10 h-10 flex items-center justify-center cursor-pointer transition-colors rounded-(--radius-md) bg-(--color-card-bg) text-(--color-text-secondary) hover:bg-(--color-selected) hover:text-(--color-text-primary)"
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
              data-hint="left-toolbar"
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
                onMove={(dx, dy) => handleMoveShapes(dx, dy)}
                onResize={(delta) => handleResizeShapes(delta)}
                onRotate={(delta) => {
                  const ids = [...canvasState.selectedShapeIds];
                  if (ids.length === 0) return;
                  const updates = new Map<string, Partial<Shape>>();
                  ids.forEach(id => {
                    const shape = canvasState.shapes.find(s => s.id === id);
                    if (shape) updates.set(id, { rotation: shape.rotation + delta });
                  });
                  updateShapes(updates, true, 'Rotate');
                }}
                onMirrorHorizontal={handleMirrorHorizontal}
                onMirrorVertical={handleMirrorVertical}
                onBringForward={handleBringForward}
                onSendBackward={handleSendBackward}
                onSelectAll={() => selectShapes(canvasState.shapes.map(s => s.id))}
                onDeselectAll={() => selectShapes([])}
                onToggleGrid={toggleGrid}
                onToggleOffCanvas={toggleOffCanvas}
                onToolButtonClick={hints.onToolbarButtonClick}
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

        {/* Zoom controls — bottom right (raised on narrow screens to avoid BottomToolbar) */}
        <div className="absolute bottom-18 xl:bottom-4 right-4 z-10">
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
              onReplayTour={tour.replay}
            />
          </div>
        )}

        {/* Right layers panel collapsed toggle */}
        {!rightOpen && (
          <button
            data-hint="layers-panel"
            className={`absolute z-20 flex items-center gap-1.5 h-10 px-3.5 cursor-pointer transition-colors rounded-(--radius-md) bg-(--color-card-bg) hover:bg-(--color-selected) text-(--color-text-secondary) ${
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
            <span
              className="text-xs font-semibold leading-none"
              style={{ color: getShapeLimitColor(getShapeLimitSeverity(canvasState.shapes.length)) }}
            >
              {canvasState.shapes.length} / {MAX_SHAPES}
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
              style={isDesktop ? { width: 350 } : undefined}
            >
              <LayerPanel onToggle={toggleRight} />
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

      <CanvasModals
        showResetConfirm={showResetConfirm}
        onConfirmReset={confirmReset}
        onCancelReset={cancelReset}
        showKeyboardSettings={showKeyboardSettings}
        keyMappings={keyMappings}
        onUpdateBinding={updateBinding}
        onResetAllBindings={resetAllBindings}
        onCloseKeyboardSettings={closeKeyboardSettings}
        keyboardSyncing={keyboardSyncing}
        showWinnerAnnouncement={showWinnerAnnouncement}
        winnerLoading={winnerLoading}
        userPlacement={userPlacement}
        congratsDismissed={congratsDismissed}
        winnerDismissed={winnerDismissed}
        winnerChallengeDate={winnerChallengeDate}
        winnerTopThree={winnerTopThree}
        winnerRankingStats={winnerRankingStats}
        onPersistSeen={persistSeen}
        onDismissCongrats={dismissCongrats}
        onDismissWinnerAnnouncement={dismissWinnerAnnouncement}
        onDismissWinner={dismissWinner}
        showVotingModal={showVotingModal}
        votingUserId={user?.id}
        yesterdayDate={yesterdayDate}
        onCloseVotingModal={closeVotingModal}
        onOptInToRanking={handleOptInToRanking}
        showFriendsModal={showFriendsModal}
        onCloseFriendsModal={closeFriendsModal}
      />
    </CanvasEditorProvider>
  );
}
