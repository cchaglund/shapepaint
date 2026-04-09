import { useRef, useState } from 'react';
import { useNotificationsContext } from '../../contexts/NotificationsContext';
import { useSubmissionStatus } from '../../contexts/SubmissionStatusContext';
import { NOTIFICATION_ICONS } from '../../config/notificationIcons';
import { navigate } from '../../lib/router';
import { SubmissionThumbnail } from '../shared/SubmissionThumbnail';
import { canViewCurrentDay } from '../../utils/privacyRules';
import { getTodayDateUTC } from '../../utils/dailyChallenge';
import type { Notification } from '../../types/notifications';
import type { DailyChallenge } from '../../types';

function formatTimeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  return `${Math.floor(days / 30)}mo`;
}

function getNotificationText(notification: Notification): { actor: string; action: string } {
  const actor = notification.data.actor_nickname || 'Someone';
  switch (notification.type) {
    case 'like':
      return { actor, action: 'liked your submission' };
    case 'follow':
      return { actor, action: 'started following you' };
    case 'friend_submitted':
      return { actor, action: 'submitted new artwork' };
  }
}

function getNotificationUrl(notification: Notification): string {
  switch (notification.type) {
    case 'like':
    case 'friend_submitted':
      return `?view=submission&id=${notification.data.submission_id}`;
    case 'follow':
      return `?view=profile&user=${notification.data.actor_id}`;
  }
}

function NotificationItem({
  notification,
  onClickNotification,
  markRead,
  shouldBlurThumbnail,
}: {
  notification: Notification;
  onClickNotification: (notification: Notification) => void;
  markRead: (id: string) => void;
  shouldBlurThumbnail: boolean;
}) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isHovering, setIsHovering] = useState(false);
  const { actor, action } = getNotificationText(notification);
  const { icon: Icon, bgClass, colorClass } = NOTIFICATION_ICONS[notification.type];

  const handleMouseEnter = () => {
    if (notification.is_read) return;
    setIsHovering(true);
    timerRef.current = setTimeout(() => {
      markRead(notification.id);
    }, 700);
  };

  const cancelTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setIsHovering(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onClickNotification(notification);
    }
  };

  // Build thumbnail props from joined submission data + baked-in colors
  const sub = notification.submissions;
  const colors = notification.type !== 'follow' ? notification.data.colors : undefined;
  const canRenderThumbnail = sub && colors && colors.length > 0;

  return (
    <div
      tabIndex={0}
      role="button"
      onClick={() => onClickNotification(notification)}
      onKeyDown={handleKeyDown}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={cancelTimer}
      onFocus={handleMouseEnter}
      onBlur={cancelTimer}
      className={`relative flex items-center gap-3 px-4 py-2.5 transition-colors cursor-pointer ${
        notification.is_read
          ? 'bg-(--color-card-bg) hover:bg-(--color-hover)'
          : 'bg-(--color-accent-subtle) hover:bg-(--color-accent-subtle)'
      }`}
    >
      {!notification.is_read && isHovering && (
        <div
          className="absolute left-0 top-0 w-[3px] h-full bg-(--color-accent) origin-top"
          style={{ animation: 'fillBar 700ms linear forwards' }}
        />
      )}
      <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${bgClass}`}>
        <Icon size={15} className={colorClass} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs text-(--color-text-primary) leading-relaxed">
          <span className="font-semibold">{actor}</span>{' '}
          {action}
        </div>
        <div className="text-xs text-(--color-text-tertiary) mt-0.5">
          {formatTimeAgo(notification.created_at)}
        </div>
      </div>
      {canRenderThumbnail && (
        <div
          className="shrink-0 w-9 h-9 rounded-md overflow-hidden border border-(--color-border-light)"
          style={shouldBlurThumbnail ? { filter: 'blur(3px)' } : undefined}
        >
          <SubmissionThumbnail
            shapes={sub.shapes}
            groups={sub.groups ?? []}
            challenge={{ colors } as unknown as DailyChallenge}
            backgroundColorIndex={sub.background_color_index}
            fill
          />
        </div>
      )}
    </div>
  );
}

export function NotificationsTab({ onClose }: { onClose: () => void }) {
  const { notifications, unreadCount, loading, error, markRead, markAllRead, reload } = useNotificationsContext();
  const { hasSubmittedToday } = useSubmissionStatus();
  const todayStr = getTodayDateUTC();

  const handleClickNotification = (notification: Notification) => {
    if (!notification.is_read) markRead(notification.id);
    navigate(getNotificationUrl(notification));
    onClose();
  };

  const showLoading = loading && notifications.length === 0;
  const showError = !showLoading && error && notifications.length === 0;
  const showEmpty = !showLoading && !showError && notifications.length === 0;

  return (
    <div className="flex flex-col">
      {unreadCount > 0 && (
        <div className="flex items-center justify-end px-3 py-1.5 border-b border-(--color-border-light)">
          <button
            onClick={() => markAllRead()}
            className="text-xs text-(--color-accent) hover:text-(--color-accent-hover) cursor-pointer transition-colors"
          >
            Mark all as read
          </button>
        </div>
      )}

      <div className="overflow-y-auto max-h-[40vh]">
        {showLoading ? (
          <div className="text-center py-8 text-xs text-(--color-text-secondary)">
            Loading...
          </div>
        ) : showError ? (
          <div className="text-center py-8 text-xs text-(--color-text-secondary)">
            <div>Failed to load notifications.</div>
            <button
              onClick={reload}
              className="mt-2 text-xs text-(--color-accent) hover:text-(--color-accent-hover) cursor-pointer transition-colors"
            >
              Retry
            </button>
          </div>
        ) : showEmpty ? (
          <div className="text-center py-8 px-4 text-xs text-(--color-text-secondary) leading-relaxed">
            When someone likes your art or follows you, you&apos;ll see it here.
          </div>
        ) : (
          notifications.map(notification => {
            const sub = notification.submissions;
            const isForToday = sub?.challenge_date != null && !canViewCurrentDay(sub.challenge_date, todayStr, hasSubmittedToday);
            return (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onClickNotification={handleClickNotification}
                markRead={markRead}
                shouldBlurThumbnail={isForToday}
              />
            );
          })
        )}
      </div>
    </div>
  );
}
