import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useFollows } from '../../hooks/social/useFollows';
import { useAuth } from '../../hooks/auth/useAuth';
import { Button } from '../shared/Button';

interface FollowButtonProps {
  targetUserId: string;
  size?: 'sm' | 'md';
}

export function FollowButton({ targetUserId, size = 'sm' }: FollowButtonProps) {
  const { user } = useAuth();
  const { isFollowing, follow, unfollow, actionLoading } = useFollows();
  const [isHovered, setIsHovered] = useState(false);
  const [localLoading, setLocalLoading] = useState(false);

  const following = isFollowing(targetUserId);
  const loading = actionLoading || localLoading;

  // Don't show button for own profile
  if (user && user.id === targetUserId) {
    return null;
  }

  const handleClick = async () => {
    if (!user || loading) return;

    setLocalLoading(true);
    try {
      if (following) {
        await unfollow(targetUserId);
      } else {
        await follow(targetUserId);
      }
    } finally {
      setLocalLoading(false);
    }
  };

  // Not logged in: disabled state
  if (!user) {
    return (
      <Button variant="muted" size={size} disabled title="Sign in to follow" className="opacity-60 cursor-not-allowed!">
        Follow
      </Button>
    );
  }

  // Loading state
  if (loading) {
    return (
      <Button variant="muted" size={size} disabled className="cursor-not-allowed!">
        <Loader2 size={12} className="animate-spin" />
        {following ? 'Following' : 'Follow'}
      </Button>
    );
  }

  // Following state: show "Following", on hover show "Unfollow"
  if (following) {
    return (
      <Button
        variant="muted"
        size={size}
        onClick={handleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {isHovered ? 'Unfollow' : 'Following'}
      </Button>
    );
  }

  // Not following: accent "Follow" button
  return (
    <Button variant="primary" size={size} onClick={handleClick}>
      Follow
    </Button>
  );
}
