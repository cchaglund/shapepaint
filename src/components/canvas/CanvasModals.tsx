
import type { RankingEntry } from '../../types';
import type { KeyMappings, KeyboardActionId, KeyBinding } from '../../constants/keyboardActions';
import { KeyboardSettingsModal } from './KeyboardSettingsModal';
import { ResetConfirmModal } from './ResetConfirmModal';
import { WinnerAnnouncementModal, CongratulatoryModal, FriendsModal } from '../modals';
import { VotingModal } from '../voting';
import { FollowsProvider } from '../../contexts/FollowsContext';

interface CanvasModalsProps {
  showResetConfirm: boolean;
  onConfirmReset: () => void;
  onCancelReset: () => void;

  showKeyboardSettings: boolean;
  keyMappings: KeyMappings;
  onUpdateBinding: (actionId: KeyboardActionId, newBinding: KeyBinding, resolveConflicts?: boolean) => Promise<{ success: boolean; conflicts?: KeyboardActionId[] }>;
  onResetAllBindings: () => Promise<void>;
  onCloseKeyboardSettings: () => void;
  keyboardSyncing: boolean;

  showWinnerAnnouncement: boolean;
  winnerLoading: boolean;
  userPlacement: RankingEntry | null;
  congratsDismissed: boolean;
  winnerDismissed: boolean;
  winnerChallengeDate: string;
  winnerTopThree: RankingEntry[];
  onPersistSeen: () => void;
  onDismissCongrats: () => void;
  onDismissWinnerAnnouncement: () => void;
  onDismissWinner: () => void;

  showVotingModal: boolean;
  votingUserId: string | undefined;
  yesterdayDate: string;
  onCloseVotingModal: () => void;
  onOptInToRanking: () => void;

  showFriendsModal: boolean;
  onCloseFriendsModal: () => void;
}

export function CanvasModals({
  showResetConfirm,
  onConfirmReset,
  onCancelReset,
  showKeyboardSettings,
  keyMappings,
  onUpdateBinding,
  onResetAllBindings,
  onCloseKeyboardSettings,
  keyboardSyncing,
  showWinnerAnnouncement,
  winnerLoading,
  userPlacement,
  congratsDismissed,
  winnerDismissed,
  winnerChallengeDate,
  winnerTopThree,
  onPersistSeen,
  onDismissCongrats,
  onDismissWinnerAnnouncement,
  onDismissWinner,
  showVotingModal,
  votingUserId,
  yesterdayDate,
  onCloseVotingModal,
  onOptInToRanking,
  showFriendsModal,
  onCloseFriendsModal,
}: CanvasModalsProps) {
  return (
    <>
      {showResetConfirm && (
        <ResetConfirmModal onConfirm={onConfirmReset} onCancel={onCancelReset} />
      )}

      {showKeyboardSettings && (
        <KeyboardSettingsModal
          mappings={keyMappings}
          onUpdateBinding={onUpdateBinding}
          onResetAll={onResetAllBindings}
          onClose={onCloseKeyboardSettings}
          syncing={keyboardSyncing}
        />
      )}

      {showWinnerAnnouncement && !winnerLoading && (
        <>
          {userPlacement && !congratsDismissed ? (
            <CongratulatoryModal
              userEntry={userPlacement}
              challengeDate={winnerChallengeDate}
              onDismiss={() => {
                onPersistSeen();
                onDismissCongrats();
              }}
            />
          ) : !winnerDismissed ? (
            <WinnerAnnouncementModal
              challengeDate={winnerChallengeDate}
              topThree={winnerTopThree}
              onDismiss={() => {
                onDismissWinnerAnnouncement();
                onDismissWinner();
              }}

            />
          ) : null}
        </>
      )}

      {showVotingModal && votingUserId && (
        <VotingModal
          userId={votingUserId}
          challengeDate={yesterdayDate}
          onComplete={onCloseVotingModal}
          onSkipVoting={onCloseVotingModal}
          onOptInToRanking={onOptInToRanking}
        />
      )}

      {showFriendsModal && (
        <FollowsProvider>
          <FriendsModal onClose={onCloseFriendsModal} />
        </FollowsProvider>
      )}
    </>
  );
}
