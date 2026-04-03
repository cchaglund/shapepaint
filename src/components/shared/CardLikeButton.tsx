import { useCallback, useRef } from 'react';

interface CardLikeButtonProps {
  isLiked: boolean;
  likeCount: number;
  disabled?: boolean;
  size?: 'sm' | 'lg';
  onToggle: () => void;
}

export function CardLikeButton({ isLiked, likeCount, disabled, size = 'sm', onToggle }: CardLikeButtonProps) {
  const btnRef = useRef<HTMLButtonElement>(null);

  const displayCount = likeCount > 9999 ? '9999+' : likeCount;
  const hoverLabel = isLiked ? 'Unlike' : 'Like';

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    onToggle();
    createBurst(btnRef.current, size === 'lg');
  }, [disabled, onToggle, size]);

  return (
    <button
      ref={btnRef}
      onClick={handleClick}
      disabled={disabled}
      title=""
      aria-label={isLiked ? 'Unlike submission' : 'Like submission'}
      aria-pressed={isLiked}
      className={`card-like-btn ${isLiked ? 'is-liked' : ''} ${disabled ? 'is-disabled' : ''} ${size === 'lg' ? 'card-like-lg' : ''}`}
    >
      <svg
        className="card-like-heart"
        width={size === 'lg' ? 18 : 14}
        height={size === 'lg' ? 18 : 14}
        viewBox="0 0 24 24"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path
          d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
          fill={isLiked ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="2"
        />
      </svg>
      <span className="card-like-text-wrap">
        <span className="card-like-count">{displayCount}</span>
        <span className="card-like-label">{hoverLabel}</span>
      </span>
    </button>
  );
}

function createBurst(btn: HTMLButtonElement | null, large = false) {
  if (!btn) return;
  const heart = btn.querySelector('.card-like-heart');
  if (!heart) return;

  const rect = btn.getBoundingClientRect();
  const heartRect = heart.getBoundingClientRect();
  const cx = heartRect.left - rect.left + heartRect.width / 2;
  const cy = heartRect.top - rect.top + heartRect.height / 2;

  for (let i = 0; i < 6; i++) {
    const particle = document.createElement('span');
    particle.className = 'card-like-particle';
    const angle = (i / 6) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
    const dist = (large ? 15 : 12) + Math.random() * (large ? 12 : 10);
    const tx = Math.cos(angle) * dist;
    const ty = Math.sin(angle) * dist;
    particle.style.left = `${cx}px`;
    particle.style.top = `${cy}px`;
    particle.animate(
      [
        { transform: 'translate(0, 0) scale(1)', opacity: '1' },
        { transform: `translate(${tx}px, ${ty}px) scale(0)`, opacity: '0' },
      ],
      { duration: 450, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)', fill: 'forwards' }
    );
    btn.appendChild(particle);
    setTimeout(() => particle.remove(), 500);
  }
}
