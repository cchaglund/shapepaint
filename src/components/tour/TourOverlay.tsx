import { useEffect, useState, useCallback, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { TourStep } from '../../hooks/ui/useTour';
import { getStepConfig } from './tourSteps';
import { Button } from '../shared/Button';
import type { DailyChallenge } from '../../types';

interface TourOverlayProps {
  step: TourStep;
  selectedShapeId: string | null;
  challenge?: DailyChallenge | null;
  onNext: () => void;
  onSkip: () => void;
}

const CUTOUT_PADDING = 20;
const CUTOUT_PADDING_SHAPE = 105;
const CUTOUT_RADIUS = 16;
const TOOLTIP_GAP = 16;
const TOOLTIP_MAX_WIDTH = 320;
const VIEWPORT_MARGIN = 16;

// --- Tour tooltip styling ---
// Inverts with mode: dark bg in light mode, light bg in dark mode.
// Buttons use tooltip* variants from Button component which handle their own mode switching.
interface TourTooltipStyle {
  box: React.CSSProperties;
  skipClass: string;
}

const TOOLTIP_LIGHT_MODE: TourTooltipStyle = {
  box: {
    background: '#241B3D',
    color: '#E8E0FF',
    letterSpacing: '0.02em',
    borderRadius: 'var(--radius-lg)',
    boxShadow: '4px 4px 0 #1A1230',
  },
  skipClass: 'opacity-60 hover:opacity-100',
};

const TOOLTIP_DARK_MODE: TourTooltipStyle = {
  box: {
    background: '#FFFFFF',
    color: '#2D1B69',
    letterSpacing: '0.02em',
    border: '2px solid #2D1B69',
    borderRadius: 'var(--radius-lg)',
    boxShadow: '4px 4px 0 #2D1B69',
  },
  skipClass: 'opacity-50 hover:opacity-80',
};

function getTooltipStyle(): TourTooltipStyle {
  const isDark = document.documentElement.getAttribute('data-mode') === 'dark';
  return isDark ? TOOLTIP_DARK_MODE : TOOLTIP_LIGHT_MODE;
}

function useTargetRect(selector: string) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const retryRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const measure = useCallback(() => {
    if (!selector) { setRect(null); return; }
    const el = document.querySelector(selector);
    if (el) {
      setRect(el.getBoundingClientRect());
      if (retryRef.current) {
        clearInterval(retryRef.current);
        retryRef.current = undefined;
      }
    } else {
      setRect(null);
    }
  }, [selector]);

  useEffect(() => {
    const handleResize = () => measure();
    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleResize, true);

    const raf = requestAnimationFrame(() => {
      measure();
      // If element not found, retry briefly (handles async shape addition)
      if (selector && !document.querySelector(selector)) {
        let attempts = 0;
        retryRef.current = setInterval(() => {
          measure();
          attempts++;
          if (document.querySelector(selector) || attempts >= 10) {
            clearInterval(retryRef.current);
            retryRef.current = undefined;
          }
        }, 100);
      }
    });

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleResize, true);
      cancelAnimationFrame(raf);
      if (retryRef.current) {
        clearInterval(retryRef.current);
        retryRef.current = undefined;
      }
    };
  }, [measure, selector]);

  return { rect, remeasure: measure };
}

function getTooltipPosition(targetRect: DOMRect, padding: number) {
  const targetCenterY = targetRect.y + targetRect.height / 2;
  const isInBottomHalf = targetCenterY > window.innerHeight / 2;
  const placement = isInBottomHalf ? 'above' as const : 'below' as const;

  const top = placement === 'above'
    ? targetRect.y - padding - TOOLTIP_GAP
    : targetRect.y + targetRect.height + padding + TOOLTIP_GAP;

  let left = targetRect.x + targetRect.width / 2 - TOOLTIP_MAX_WIDTH / 2;
  left = Math.max(VIEWPORT_MARGIN, Math.min(left, window.innerWidth - TOOLTIP_MAX_WIDTH - VIEWPORT_MARGIN));

  return { top, left, placement };
}

function getSelector(step: TourStep, selectedShapeId: string | null): string {
  if (step === 'manipulate' && selectedShapeId) {
    return `[data-shape-id="${selectedShapeId}"]`;
  }
  return getStepConfig(step).targetSelector;
}

function SkipConfirmContent({
  onConfirmSkip,
  onCancel,
  tooltipStyle,
}: {
  onConfirmSkip: () => void;
  onCancel: () => void;
  tooltipStyle: TourTooltipStyle;
}) {
  return (
    <motion.div
      key="skip-confirm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
    >
      <p className="font-bold text-base mb-2">Skip the tour?</p>
      <p className={`text-xs mb-4 leading-relaxed ${tooltipStyle.skipClass}`}>
        You can always take it again — click the <strong>?</strong> in the bottom left and select <strong>Replay tour</strong>.
      </p>
      <div className="flex flex-col items-center gap-2">
        <Button variant="tooltipDanger" fullWidth onClick={onConfirmSkip}>
          Skip tour
        </Button>
        <Button variant="tooltipSecondary" fullWidth onClick={onCancel}>
          Continue tour
        </Button>
      </div>
    </motion.div>
  );
}

function TourStepContent({
  config,
  tooltipStyle,
  onNext,
  onRequestSkip,
}: {
  config: ReturnType<typeof getStepConfig>;
  tooltipStyle: TourTooltipStyle;
  onNext: () => void;
  onRequestSkip: () => void;
}) {
  return (
    <motion.div
      key="step-content"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
    >
      <p className="font-bold text-xl mb-4">{config.heading}</p>
      <div className="mb-6 leading-relaxed">{config.body}</div>

      <div className="flex flex-col items-center gap-2">
        <Button variant="tooltipPrimary" size="md" fullWidth onClick={onNext}>
          {config.buttonLabel}
        </Button>
        {config.showSkip && (
          <button
            className={`text-xs hover:underline cursor-pointer transition-all ${tooltipStyle.skipClass}`}
            onClick={onRequestSkip}
          >
            Skip tour
          </button>
        )}
      </div>
    </motion.div>
  );
}

const CUTOUT_FADE_MS = 200;
const CUTOUT_FLARE = 30; // px overshoot on each side when spotlight "turns on"
const CUTOUT_SPRING = { type: 'spring' as const, stiffness: 500, damping: 25, mass: 0.8 };

interface CutoutRect {
  cx: number;
  cy: number;
  cw: number;
  ch: number;
}

function computeCutout(rect: DOMRect, step: TourStep): CutoutRect {
  const padding = step === 'manipulate' ? CUTOUT_PADDING_SHAPE : CUTOUT_PADDING;
  return {
    cx: rect.x - padding,
    cy: rect.y - padding,
    cw: rect.width + padding * 2,
    ch: rect.height + padding * 2,
  };
}

export function TourOverlay({ step, selectedShapeId, challenge, onNext, onSkip }: TourOverlayProps) {
  const isDark = document.documentElement.getAttribute('data-mode') === 'dark';
  const config = getStepConfig(step, { challenge, isDark });
  const isWelcome = step === 'welcome';
  const selector = isWelcome ? '' : getSelector(step, selectedShapeId);
  const { rect, remeasure } = useTargetRect(selector);
  const [showSkipConfirm, setShowSkipConfirm] = useState(false);
  const tooltipStyle = getTooltipStyle();

  // "Spotlight off / reposition / spotlight on" transition
  const [cutoutVisible, setCutoutVisible] = useState(true);
  const [prevStep, setPrevStep] = useState(step);
  const [frozenCutout, setFrozenCutout] = useState<CutoutRect | null>(null);

  // Detect step change during render — freeze old cutout position before fading out
  if (prevStep !== step) {
    if (rect) {
      setFrozenCutout(computeCutout(rect, prevStep));
    }
    setPrevStep(step);
    setCutoutVisible(false);
    setShowSkipConfirm(false);
  }

  // Phase 2: after fade-out completes, remeasure new target and fade in
  useEffect(() => {
    if (!cutoutVisible) {
      const timer = setTimeout(() => {
        setFrozenCutout(null);
        remeasure();
        setCutoutVisible(true);
      }, CUTOUT_FADE_MS);
      return () => clearTimeout(timer);
    }
  }, [cutoutVisible, remeasure]);

  const isInteractive = config.interactionType === 'click-next-interactive';

  // --- Welcome step: centered modal, no cutout ---
  if (isWelcome) {
    return (
      <div className="fixed inset-0 z-100">
        <motion.div
          className="absolute inset-0"
          style={{ background: 'var(--color-modal-overlay)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-auto">
          <motion.div
            className="px-8 py-7 text-base w-95 max-w-[90vw] overflow-hidden"
            style={tooltipStyle.box}
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ opacity: { duration: 0.25, delay: 0.15 }, scale: { duration: 0.25, delay: 0.15 }, y: { duration: 0.25, delay: 0.15 }, layout: { duration: 0.2 } }}
            layout
          >
            <AnimatePresence mode="wait" initial={false}>
              {showSkipConfirm ? (
                <SkipConfirmContent
                  onConfirmSkip={onSkip}
                  onCancel={() => setShowSkipConfirm(false)}
                  tooltipStyle={tooltipStyle}
                />
              ) : (
                <TourStepContent
                  config={config}
                  tooltipStyle={tooltipStyle}
                  onNext={onNext}
                  onRequestSkip={() => setShowSkipConfirm(true)}
                />
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </div>
    );
  }

  // --- Spotlight steps: cutout + tooltip ---
  if (!rect) return null;

  // During fade-out, show frozen (old) position; otherwise use live rect
  const cutout = frozenCutout ?? computeCutout(rect, step);
  const { cx, cy, cw, ch } = cutout;
  const isShapeStep = step === 'manipulate';
  const padding = isShapeStep ? CUTOUT_PADDING_SHAPE : CUTOUT_PADDING;
  const tooltip = getTooltipPosition(rect, padding);

  return (
    <div className="fixed inset-0 z-100 pointer-events-none">
      <svg className="absolute inset-0 w-full h-full">
        <defs>
          <mask id="tour-mask">
            <rect width="100%" height="100%" fill="white" />
            {cutoutVisible ? (
              <motion.rect
                key={step}
                rx={CUTOUT_RADIUS}
                fill="black"
                initial={{ opacity: 0, x: cx - CUTOUT_FLARE, y: cy - CUTOUT_FLARE, width: cw + CUTOUT_FLARE * 2, height: ch + CUTOUT_FLARE * 2 }}
                animate={{ opacity: 1, x: cx, y: cy, width: cw, height: ch }}
                transition={CUTOUT_SPRING}
              />
            ) : (
              <motion.rect
                rx={CUTOUT_RADIUS}
                fill="black"
                initial={{ opacity: 1 }}
                animate={{ opacity: 0 }}
                transition={{ duration: CUTOUT_FADE_MS / 1000 }}
                x={cx} y={cy} width={cw} height={ch}
              />
            )}
          </mask>
        </defs>
        <motion.rect
          width="100%"
          height="100%"
          fill="var(--color-modal-overlay)"
          mask="url(#tour-mask)"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        />
      </svg>

      {/* Block clicks outside cutout — skipped for manipulate step so shape can be freely dragged */}
      {!isShapeStep && (
        <div
          className="absolute inset-0 pointer-events-auto"
          style={{
            clipPath: `polygon(
              0% 0%, 100% 0%, 100% 100%, 0% 100%,
              0% ${cy}px,
              ${cx}px ${cy}px,
              ${cx}px ${cy + ch}px,
              ${cx + cw}px ${cy + ch}px,
              ${cx + cw}px ${cy}px,
              0% ${cy}px
            )`,
          }}
        />
      )}

      {/* For non-interactive steps, also block clicks in the cutout area */}
      {!isInteractive && (
        <div
          className="absolute pointer-events-auto"
          style={{
            left: cx,
            top: cy,
            width: cw,
            height: ch,
            borderRadius: CUTOUT_RADIUS,
          }}
        />
      )}


      {/* Tooltip */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          className="absolute pointer-events-auto"
          style={{
            top: tooltip.placement === 'above' ? undefined : tooltip.top,
            bottom: tooltip.placement === 'above' ? window.innerHeight - tooltip.top : undefined,
            left: tooltip.left,
            width: TOOLTIP_MAX_WIDTH,
          }}
          initial={{ opacity: 0, y: tooltip.placement === 'above' ? 8 : -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: tooltip.placement === 'above' ? 8 : -8 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            className="px-6 py-5 text-base overflow-hidden"
            style={tooltipStyle.box}
            layout
            transition={{ duration: 0.2 }}
          >
            <AnimatePresence mode="wait" initial={false}>
              {showSkipConfirm ? (
                <SkipConfirmContent
                  onConfirmSkip={onSkip}
                  onCancel={() => setShowSkipConfirm(false)}
                  tooltipStyle={tooltipStyle}
                />
              ) : (
                <TourStepContent
                  config={config}
                  tooltipStyle={tooltipStyle}
                  onNext={onNext}
                  onRequestSkip={() => setShowSkipConfirm(true)}
                />
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
