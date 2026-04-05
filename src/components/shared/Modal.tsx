import { useEffect, useRef, useCallback, type ReactNode } from 'react';

interface ModalProps {
  onClose: () => void;
  children: ReactNode;
  /** Tailwind max-w class for the content box. Default: "max-w-lg" */
  size?: string;
  /** Additional classes on the content box */
  className?: string;
  /** Close when pressing Escape. Default: false */
  closeOnEscape?: boolean;
  /** Close when clicking the backdrop. Default: false */
  closeOnBackdropClick?: boolean;
  /** aria-labelledby id for accessibility */
  ariaLabelledBy?: string;
  /** z-index class. Default: "z-50" */
  zIndex?: string;
  /** data-testid for the modal root element */
  dataTestId?: string;
}

export function Modal({
  onClose,
  children,
  size = 'max-w-lg',
  className = '',
  closeOnEscape = false,
  closeOnBackdropClick = false,
  ariaLabelledBy,
  zIndex = 'z-50',
  dataTestId,
}: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  // Escape key and focus trap
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && closeOnEscape) {
        onClose();
      }

      // Trap focus within the modal
      if (e.key === 'Tab' && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, closeOnEscape]);

  // Focus the modal container on mount (not the first interactive child,
  // which would show an unwanted focus ring on links/buttons)
  useEffect(() => {
    modalRef.current?.focus();
  }, []);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (closeOnBackdropClick && e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose, closeOnBackdropClick]
  );

  return (
    <div
      className={`fixed inset-0 bg-(--color-modal-overlay) flex items-center justify-center ${zIndex}`}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby={ariaLabelledBy}
      data-testid={dataTestId}
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        className={`p-4 md:p-6 w-full ${size} mx-4 max-h-[90dvh] overflow-y-auto outline-none bg-(--color-modal-bg) border-[length:var(--border-width,2px)] border-solid border-(--color-border) rounded-(--radius-lg) shadow-(--shadow-modal) ${className}`}
      >
        {children}
      </div>
    </div>
  );
}
