import { FriendRow } from './FriendRow';
import { LoadingSpinner } from '../shared/LoadingSpinner';
import type { FollowUser } from '../../contexts/FollowsContext';

export type FriendsListType = 'following' | 'followers';

interface FriendsListProps {
  users: FollowUser[];
  listType: FriendsListType;
  loading?: boolean;
  onNavigateToProfile?: (userId: string) => void;
}

const emptyStateMessages: Record<FriendsListType, string> = {
  following: "You're not following anyone yet. Search for artists above.",
  followers: "No followers yet. Create art and others will find you!",
};

export function FriendsList({
  users,
  listType,
  loading = false,
  onNavigateToProfile,
}: FriendsListProps) {
  if (loading) {
    return <LoadingSpinner size="sm" inline />;
  }

  if (users.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-(--color-text-secondary)">
        {emptyStateMessages[listType]}
      </div>
    );
  }

  return (
    <div className="divide-y divide-(--color-border)">
      {users.map((user) => (
        <FriendRow
          key={user.id}
          userId={user.id}
          nickname={user.nickname}
          avatarUrl={user.avatar_url}
          onNavigateToProfile={onNavigateToProfile}
        />
      ))}
    </div>
  );
}
