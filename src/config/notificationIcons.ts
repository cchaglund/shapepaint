import { Heart, UserPlus, Store, type LucideIcon } from 'lucide-react';
import type { NotificationType } from '../types/notifications';

export const NOTIFICATION_ICONS: Record<NotificationType, {
  icon: LucideIcon;
  bgClass: string;
  colorClass: string;
}> = {
  like:             { icon: Heart,    bgClass: 'bg-(--color-accent-subtle)', colorClass: 'text-(--color-accent)' },
  follow:           { icon: UserPlus, bgClass: 'bg-purple-500/18',           colorClass: 'text-purple-400' },
  friend_submitted: { icon: Store,    bgClass: 'bg-green-500/15',            colorClass: 'text-green-400' },
};
