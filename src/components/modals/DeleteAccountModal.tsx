import { useState } from 'react';
import { Modal } from '../shared/Modal';
import { Button } from '../shared/Button';

interface DeleteAccountModalProps {
  nickname: string;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

export function DeleteAccountModal({ nickname, onConfirm, onCancel }: DeleteAccountModalProps) {
  const [confirmText, setConfirmText] = useState('');
  const [status, setStatus] = useState<'idle' | 'deleting' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const isMatch = confirmText === nickname;

  const handleDelete = async () => {
    if (!isMatch) return;
    setStatus('deleting');
    setErrorMsg('');
    try {
      await onConfirm();
    } catch {
      setStatus('error');
      setErrorMsg('Something went wrong. Please try again.');
    }
  };

  return (
    <Modal
      onClose={onCancel}
      size="max-w-100"
      className="text-center"
      closeOnEscape
      closeOnBackdropClick
      zIndex="z-1000"
      ariaLabelledBy="delete-account-title"
      dataTestId="delete-account-modal"
    >
      <h3
        id="delete-account-title"
        className="m-0 mb-2 text-xl font-semibold text-(--color-danger)"
      >
        Delete Account
      </h3>
      <p className="m-0 mb-4 text-sm text-(--color-text-secondary)">
        This will permanently delete your account, all your artwork, likes, and social connections. This cannot be undone.
      </p>
      <p className="m-0 mb-3 text-sm text-(--color-text-secondary)">
        Type <strong className="text-(--color-text-primary)">{nickname}</strong> to confirm:
      </p>
      <input
        type="text"
        value={confirmText}
        onChange={e => setConfirmText(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') handleDelete(); }}
        placeholder={nickname}
        className="w-full px-3 py-2 mb-4 text-sm bg-(--color-bg-secondary) border border-(--color-border) rounded-(--radius-sm) text-(--color-text-primary) placeholder:text-(--color-text-tertiary) focus:outline-none focus:ring-1 focus:ring-(--color-danger) text-center"
        disabled={status === 'deleting'}
        autoFocus
      />
      {status === 'error' && (
        <p className="m-0 mb-3 text-xs text-(--color-danger)">{errorMsg}</p>
      )}
      <div className="flex flex-col items-center gap-3">
        <Button
          variant="danger"
          size="md"
          fullWidth
          onClick={handleDelete}
          disabled={!isMatch || status === 'deleting'}
        >
          {status === 'deleting' ? 'Deleting...' : 'Permanently Delete Account'}
        </Button>
        <Button variant="link" onClick={onCancel} disabled={status === 'deleting'}>
          Cancel
        </Button>
      </div>
    </Modal>
  );
}
