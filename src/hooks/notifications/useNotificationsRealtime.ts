import { useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useNotificationsContext } from '../../contexts/NotificationsContext';
import { useToast } from '../../contexts/ToastContext';
import type { Notification, NotificationSubmission } from '../../types/notifications';

/** Fetch submission data for a notification that has a submission_id (Realtime payloads lack FK joins). */
async function enrichWithSubmission(notification: Notification): Promise<Notification> {
  if (notification.type === 'follow') return notification;

  const submissionId = notification.data.submission_id;
  const { data } = await supabase
    .from('submissions')
    .select('shapes, groups, background_color, challenge_date')
    .eq('id', submissionId)
    .single();

  return { ...notification, submissions: (data as NotificationSubmission) ?? null };
}

export function useNotificationsRealtime(userId: string | undefined) {
  const { prependNotification, reload } = useNotificationsContext();
  const { addToast } = useToast();

  useEffect(() => {
    if (!userId) return;

    let hasSubscribedOnce = false;

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        async (payload) => {
          const raw = payload.new as Notification;
          const notification = await enrichWithSubmission(raw);
          prependNotification(notification);
          addToast(notification);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          if (hasSubscribedOnce) {
            // Reconnection — reload to catch notifications missed during disconnect
            // Supabase Realtime does not replay missed events
            reload();
          }
          hasSubscribedOnce = true;
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, prependNotification, addToast, reload]);
}
