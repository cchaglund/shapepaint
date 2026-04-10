import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';
import { useToast, type Toast } from '../../contexts/ToastContext';
import { useSubmissionStatus } from '../../contexts/SubmissionStatusContext';
import { NOTIFICATION_ICONS } from '../../config/notificationIcons';
import { navigate } from '../../lib/router';
import { SubmissionThumbnail } from '../shared/SubmissionThumbnail';
import { canViewCurrentDay } from '../../utils/privacyRules';
import { getTodayDateUTC } from '../../utils/dailyChallenge';
import type { Notification } from '../../types/notifications';

const TOAST_DURATION_MS = 5000;

function getToastText(n: Notification): { actor: string; action: string } {
  const actor = n.data.actor_nickname || 'Someone';
  switch (n.type) {
    case 'like':
      return { actor, action: 'liked your submission' };
    case 'follow':
      return { actor, action: 'started following you' };
    case 'friend_submitted':
      return { actor, action: 'submitted new artwork' };
  }
}

function getToastAction(n: Notification): string {
  switch (n.type) {
    case 'like':
    case 'friend_submitted':
      return 'View submission \u2192';
    case 'follow':
      return 'View profile \u2192';
  }
}

function getToastUrl(n: Notification): string {
  switch (n.type) {
    case 'like':
    case 'friend_submitted':
      return `?view=submission&id=${n.data.submission_id}`;
    case 'follow':
      return `?view=profile&user=${n.data.actor_id}`;
  }
}

function ToastItem({ toast, onDismiss, shouldBlurThumbnail }: { toast: Toast; onDismiss: (id: string) => void; shouldBlurThumbnail: boolean }) {
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const remainingRef = useRef(TOAST_DURATION_MS);
  const startTimeRef = useRef(0);

  const n = toast.notification;
  const config = NOTIFICATION_ICONS[n.type];
  const Icon = config.icon;
  const { actor, action } = getToastText(n);
  const actionLabel = getToastAction(n);
  const sub = n.submissions;
  const canRenderThumbnail = sub && sub.shapes.length > 0;

  // Sync JS timer with pause/resume — tracks remaining time so bar stays in sync
  useEffect(() => {
    if (paused) {
      if (startTimeRef.current) {
        remainingRef.current -= Date.now() - startTimeRef.current;
      }
      return;
    }
    const now = Date.now();
    startTimeRef.current = now;
    timerRef.current = setTimeout(() => onDismiss(toast.id), remainingRef.current);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [paused, toast.id, onDismiss]);

  const handleClick = () => {
    navigate(getToastUrl(n));
    onDismiss(toast.id);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 32, scale: 0.96 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 32, scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      className="
        group relative flex items-center gap-3 w-full max-w-90
        px-3 py-2.5 rounded-(--radius-md) cursor-pointer overflow-hidden
        bg-(--color-bg-elevated)
        hover:-translate-y-0.5 transition-transform
      "
      style={{
        border: 'var(--border-width, 2px) solid var(--color-border)',
        boxShadow: 'var(--shadow-card)',
      }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onClick={handleClick}
    >
      {/* Event icon */}
      <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${config.bgClass}`}>
        <Icon size={15} className={config.colorClass} />
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <div className="text-xs text-(--color-text-primary) leading-snug">
          <strong>{actor}</strong> {action}
        </div>
        <div className="text-[0.5rem] text-(--color-text-tertiary) mt-0.5">{actionLabel}</div>
      </div>

      {/* Submission thumbnail */}
      {canRenderThumbnail && (
        <div
          className="shrink-0 w-9 h-9 rounded-md overflow-hidden border border-(--color-border-light)"
          style={shouldBlurThumbnail ? { filter: 'blur(3px)' } : undefined}
        >
          <SubmissionThumbnail
            shapes={sub.shapes}
            groups={sub.groups ?? []}
            backgroundColor={sub.background_color}
            fill
          />
        </div>
      )}

      {/* Close button (appears on hover) */}
      <button
        className="absolute top-1 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity text-(--color-text-tertiary) hover:text-(--color-text-primary) cursor-pointer bg-none border-none p-0.5"
        onClick={(e) => { e.stopPropagation(); onDismiss(toast.id); }}
        aria-label="Dismiss notification"
      >
        <X size={12} />
      </button>

      {/* Progress bar — drains left-to-right over 5s, pauses on hover */}
      <div
        className="absolute bottom-0 left-0 h-1 bg-(--color-accent) opacity-45"
        style={{
          animation: `progressDrain ${TOAST_DURATION_MS}ms linear forwards`,
          animationPlayState: paused ? 'paused' : 'running',
        }}
      />
    </motion.div>
  );
}

export function ToastContainer() {
  const { toasts, dismissToast } = useToast();
  const { hasSubmittedToday } = useSubmissionStatus();
  const todayStr = getTodayDateUTC();

  return (
    <div className="fixed bottom-5 right-5 z-200 flex flex-col-reverse gap-2 items-end pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map(t => {
          const sub = t.notification.submissions;
          const shouldBlur = sub?.challenge_date != null && !canViewCurrentDay(sub.challenge_date, todayStr, hasSubmittedToday);
          return (
            <div key={t.id} className="pointer-events-auto">
              <ToastItem toast={t} onDismiss={dismissToast} shouldBlurThumbnail={shouldBlur} />
            </div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
