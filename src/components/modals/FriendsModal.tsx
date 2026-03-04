import { useState, useCallback } from 'react';
import { navigate } from '../../lib/router';
import { useAuth } from '../../hooks/auth/useAuth';
import { useFollows } from '../../hooks/social/useFollows';
import { Modal } from '../shared/Modal';
import { CloseButton } from '../shared/CloseButton';
import { FriendsModalTabs, type FriendsTab } from './FriendsModalTabs';
import { FriendsList } from './FriendsList';
import { UserSearchBar } from './UserSearchBar';

interface FriendsModalProps {
  onClose: () => void;
}

export function FriendsModal({ onClose }: FriendsModalProps) {
  const { user } = useAuth();
  const { following, followers, followingCount, followersCount, loading } = useFollows();
  const [activeTab, setActiveTab] = useState<FriendsTab>('following');

  const handleNavigateToProfile = useCallback((userId: string) => {
    onClose();
    navigate(`?view=profile&user=${userId}`);
  }, [onClose]);

  // Not logged in state
  if (!user) {
    return (
      <Modal onClose={onClose} ariaLabelledBy="friends-modal-title" dataTestId="friends-modal">
        <div className="flex items-center justify-between mb-4">
          <h2
            id="friends-modal-title"
            className="text-xl font-semibold text-(--color-text-primary)"
          >
            Friends
          </h2>
          <CloseButton onClick={onClose} label="Close modal" />
        </div>
        <p className="text-sm text-(--color-text-secondary) text-center py-8">
          Please sign in to manage friends
        </p>
      </Modal>
    );
  }

  return (
    <Modal
      onClose={onClose}
      ariaLabelledBy="friends-modal-title"
      dataTestId="friends-modal"
      className="p-0! max-h-[80vh] flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-(--color-border)">
        <h2
          id="friends-modal-title"
          className="text-xl font-semibold text-(--color-text-primary)"
        >
          Friends
        </h2>
        <CloseButton onClick={onClose} label="Close modal" />
      </div>

      {/* Tabs */}
      <FriendsModalTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        followingCount={followingCount}
        followersCount={followersCount}
        loading={loading}
      />

      {/* Search bar */}
      <div className="px-4 pt-4">
        <UserSearchBar onNavigateToProfile={handleNavigateToProfile} />
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto p-4">
        <FriendsList
          users={activeTab === 'following' ? following : followers}
          listType={activeTab}
          loading={loading}
          onNavigateToProfile={handleNavigateToProfile}
        />
      </div>
    </Modal>
  );
}
