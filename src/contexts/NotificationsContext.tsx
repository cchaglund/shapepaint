/* eslint-disable react-refresh/only-export-components -- Context exported for useNotificationsContext hook */
import { createContext, useContext, type ReactNode } from 'react';
import { useNotifications } from '../hooks/notifications/useNotifications';
import type { Notification } from '../types/notifications';

export interface NotificationsContextValue {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  fetched: boolean;
  error: string | null;
  markRead: (notificationId: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  prependNotification: (notification: Omit<Notification, 'submissions'> & { submissions?: Notification['submissions'] }) => void;
  reload: () => void;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

interface NotificationsProviderProps {
  userId: string | undefined;
  children: ReactNode;
}

export function NotificationsProvider({ userId, children }: NotificationsProviderProps) {
  const value = useNotifications(userId);

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotificationsContext(): NotificationsContextValue {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error('useNotificationsContext must be used within a NotificationsProvider');
  }
  return context;
}
