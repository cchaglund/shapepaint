import { navigate } from '../../lib/router';
import { FollowButton } from '../social/FollowButton';
import { AvatarImage } from '../shared/AvatarImage';

interface FriendRowProps {
  userId: string;
  nickname: string;
  avatarUrl: string | null;
  onNavigateToProfile?: (userId: string) => void;
}

export function FriendRow({ userId, nickname, avatarUrl, onNavigateToProfile }: FriendRowProps) {
  const handleNicknameClick = () => {
    if (onNavigateToProfile) {
      onNavigateToProfile(userId);
    } else {
      navigate(`?view=profile&user=${userId}`);
    }
  };

  return (
    <div data-testid="friend-row" className="flex items-center justify-between py-2 px-1">
      <button
        onClick={handleNicknameClick}
        className="flex items-center gap-2 text-sm text-(--color-text-primary) hover:text-(--color-accent) transition-colors cursor-pointer truncate max-w-50"
      >
        <AvatarImage avatarUrl={avatarUrl} initial={(nickname || 'U')[0].toUpperCase()} size="sm" />
        @{nickname}
      </button>
      <FollowButton targetUserId={userId} />
    </div>
  );
}
