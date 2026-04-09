import type { Shape, ShapeGroup } from './index';

export type NotificationType = 'like' | 'follow' | 'friend_submitted';

export interface NotificationDataMap {
  like: {
    actor_id: string;
    actor_nickname: string | null;
    actor_avatar: string | null;
    submission_id: string;
    colors?: string[];
  };
  follow: {
    actor_id: string;
    actor_nickname: string | null;
    actor_avatar: string | null;
  };
  friend_submitted: {
    actor_id: string;
    actor_nickname: string | null;
    actor_avatar: string | null;
    submission_id: string;
    colors?: string[];
  };
}

export interface NotificationSubmission {
  shapes: Shape[];
  groups: ShapeGroup[] | null;
  background_color_index: number | null;
  challenge_date: string;
}

export type Notification = {
  [K in NotificationType]: {
    id: string;
    user_id: string;
    type: K;
    data: NotificationDataMap[K];
    is_read: boolean;
    created_at: string;
    submissions: NotificationSubmission | null;
  };
}[NotificationType];
