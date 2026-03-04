import { useState } from 'react';
import { Modal } from '../shared/Modal';
import { Button } from '../shared/Button';

interface OnboardingModalProps {
  onComplete: (nickname: string) => Promise<{ success: boolean; error?: string }>;
}

export function OnboardingModal({ onComplete }: OnboardingModalProps) {
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const validateNickname = (value: string): string | null => {
    if (value.length < 1) return 'Nickname is required';
    if (value.length > 15) return 'Nickname must be 15 characters or less';
    if (!/^[a-zA-Z0-9]+$/.test(value)) return 'Only letters and numbers allowed';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validationError = validateNickname(nickname);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    setError(null);

    const result = await onComplete(nickname);
    if (!result.success) {
      setError(result.error || 'Something went wrong');
    }
    setSubmitting(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNickname(value);
    if (error) {
      setError(validateNickname(value));
    }
  };

  // onClose is a no-op — onboarding must be completed
  return (
    <Modal
      onClose={() => {}}
      size="max-w-sm"
      closeOnEscape={false}
      closeOnBackdropClick={false}
      ariaLabelledBy="onboarding-title"
      dataTestId="onboarding-modal"
    >
      <h2 id="onboarding-title" className="text-xl font-semibold text-(--color-text-primary) mb-2">
        Welcome!
      </h2>
      <p className="text-sm text-(--color-text-secondary) mb-6">
        Choose a nickname to display in the gallery. This will be visible to other users.
      </p>

      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label
            htmlFor="nickname"
            className="block text-sm font-medium text-(--color-text-primary) mb-1"
          >
            Nickname
          </label>
          <input
            id="nickname"
            type="text"
            value={nickname}
            onChange={handleChange}
            placeholder="Enter your nickname"
            maxLength={15}
            autoFocus
            className="w-full px-3 py-2 bg-(--color-bg-secondary) rounded-(--radius-md) text-sm text-(--color-text-primary) placeholder-(--color-text-tertiary) focus:outline-none focus:ring-2 focus:ring-(--color-accent) focus:border-transparent"
            style={{ border: 'var(--border-width, 2px) solid var(--color-border)' }}
          />
          <div className="flex justify-between mt-1">
            <span className="text-xs text-(--color-danger)">{error || ''}</span>
            <span className="text-xs text-(--color-text-tertiary)">
              {nickname.length}/15
            </span>
          </div>
        </div>

        <Button
          variant="primary"
          size="md"
          fullWidth
          type="submit"
          disabled={submitting || !nickname}
          className="disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? 'Saving...' : 'Continue'}
        </Button>
      </form>
    </Modal>
  );
}
