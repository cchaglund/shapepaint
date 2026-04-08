import { useState, useCallback, useEffect, useRef } from 'react';
import {
  fetchNotifications,
  fetchUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
} from '../../lib/api';
import type { Notification } from '../../types/notifications';

export function useNotifications(userId: string | undefined) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchedForRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const [items, count] = await Promise.all([
        fetchNotifications(userId),
        fetchUnreadCount(userId),
      ]);
      setNotifications(items);
      setUnreadCount(count);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load notifications';
      setError(message);
    } finally {
      setLoading(false);
      setFetched(true);
    }
  }, [userId]);

  // Fetch on mount, deduped by userId
  useEffect(() => {
    if (!userId) {
      setLoading(false);
      setFetched(true);
      return;
    }
    if (fetchedForRef.current === userId) return;
    fetchedForRef.current = userId;
    load();
  }, [userId, load]);

  const markRead = useCallback(async (notificationId: string) => {
    // Optimistic update
    const prev = notifications;
    const prevCount = unreadCount;
    setNotifications(ns => ns.map(n => n.id === notificationId ? { ...n, is_read: true } : n));
    setUnreadCount(c => Math.max(0, c - 1));

    try {
      await markNotificationRead(notificationId);
    } catch {
      // Rollback
      setNotifications(prev);
      setUnreadCount(prevCount);
    }
  }, [notifications, unreadCount]);

  const markAllRead = useCallback(async () => {
    if (!userId) return;

    // Optimistic update
    const prev = notifications;
    const prevCount = unreadCount;
    setNotifications(ns => ns.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);

    try {
      await markAllNotificationsRead(userId);
    } catch {
      // Rollback
      setNotifications(prev);
      setUnreadCount(prevCount);
    }
  }, [userId, notifications, unreadCount]);

  const prependNotification = useCallback((notification: Notification) => {
    setNotifications(ns => {
      // Dedup guard — skip if already present
      if (ns.some(n => n.id === notification.id)) return ns;
      return [notification, ...ns];
    });
    if (!notification.is_read) {
      setUnreadCount(c => c + 1);
    }
  }, []);

  const reload = useCallback(() => {
    fetchedForRef.current = null;
    load();
  }, [load]);

  return {
    notifications,
    unreadCount,
    loading,
    fetched,
    error,
    markRead,
    markAllRead,
    prependNotification,
    reload,
  };
}
