import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useFollows } from '../../hooks/social/useFollows';
import { useAuth } from '../../hooks/auth/useAuth';
import { Button } from '../shared/Button';

interface FollowButtonProps {
  targetUserId: string;
}

const compact = 'h-auto! py-1! text-xs!';

export function FollowButton({ targetUserId }: FollowButtonProps) {
  const { user } = useAuth();
  const { isFollowing, follow, unfollow, actionLoading } = useFollows();
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
      <Button variant="ghost" size="sm" disabled title="Sign in to follow" className={`${compact} opacity-60 cursor-not-allowed!`}>
        Follow
      </Button>
    );
  }

  // Loading state
  if (loading) {
    return (
      <Button variant="ghost" size="sm" disabled className={`${compact} cursor-not-allowed!`}>
        <Loader2 size={12} className="animate-spin" />
      </Button>
    );
  }

  // Following state: show "Unfollow"
  if (following) {
    return (
      <Button variant="ghost" size="sm" onClick={handleClick} className={compact}>
        Unfollow
      </Button>
    );
  }

  // Not following: "Follow"
  return (
    <Button variant="ghost" size="sm" onClick={handleClick} className={compact}>
      Follow
    </Button>
  );
}
