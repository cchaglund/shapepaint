import type { DailyChallenge } from '../../types';
import { Modal } from '../shared/Modal';
import { Button } from '../shared/Button';
import { ShapeIcon } from '../shared/ShapeIcon';

interface WelcomeModalProps {
  onDismiss: () => void;
  challenge?: DailyChallenge | null;
}

export function WelcomeModal({ onDismiss, challenge }: WelcomeModalProps) {
  return (
    <Modal onClose={onDismiss} ariaLabelledBy="welcome-title" dataTestId="welcome-modal">
      <h2
        id="welcome-title"
        className="text-xl font-semibold text-(--color-text-primary) mb-5 text-center"
      >
        Welcome to 3 Colors 2 Shapes!
      </h2>

      {challenge && (
        <div className="flex flex-col items-center gap-3 mt-11 mb-6">
          <div className="flex items-center gap-3">
            {challenge.colors.map((color, i) => (
              <div
                key={i}
                className="w-6 h-6 rounded-(--radius-pill) border border-(--color-border)"
                style={{ backgroundColor: color }}
              />
            ))}
            <div className="w-px h-5 bg-(--color-border) mx-1" />
            <ShapeIcon type={challenge.shapes[0].type} size={22} fill="var(--color-text-tertiary)" stroke="var(--color-border)" strokeWidth={1.5} />
            <ShapeIcon type={challenge.shapes[1].type} size={22} fill="var(--color-text-tertiary)" stroke="var(--color-border)" strokeWidth={1.5} />
          </div>
        </div>
      )}

      <div className="flex items-center gap-4">
        <p className="text-md text-(--color-text-secondary) text-center">
          Each day brings a new <strong>creative challenge</strong> — make art using today's 3 colors and 2 shapes!
        </p>
      </div>

      <div className='border border-(--color-border) my-10 w-[70%] mx-auto'></div>

      <div className="flex items-center gap-6 mb-6">
        <p className="text-2xl">
          🧠
        </p>

        <p className="text-base text-(--color-text-secondary) italic">
          Challenge your creativity — have fun expressing yourself in a simple and playful way
        </p>
      </div>

      <div className="flex items-center gap-6 mb-6">
        <p className="text-2xl">
          🌎
        </p>

        <p className="text-base text-(--color-text-secondary) italic">
          Compete daily — Submit your art and join the community in voting for their favorites (optional, no pressure!)
        </p>
      </div>

      <div className="flex items-center gap-6 mb-6">
        <p className="text-2xl">
          🥳
        </p>

        <p className="text-base text-(--color-text-secondary) italic">
          Follow your friends — See what your friends are creating and show them some love
        </p>
      </div>

      <div className="flex items-center gap-6 mb-6">
        <p className="text-2xl">
          🖼️
        </p>

        <p className="text-base text-(--color-text-secondary) italic">
          Collect your creations — Your daily art is saved in your profile, so you can look back on your creative journey over time
        </p>
      </div>

      <div className="flex justify-center mt-6">
        <Button variant="primary" size="md" onClick={onDismiss}>
          Start creating
        </Button>
      </div>
    </Modal>
  );
}
