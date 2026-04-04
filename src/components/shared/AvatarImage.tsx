import { useState } from 'react';

const sizes = {
  sm: { container: 'w-5 h-5 text-xs leading-none', img: 'w-5 h-5' },
  md: { container: 'w-6 h-6 text-xs leading-none', img: 'w-6 h-6' },
  lg: { container: 'w-10 h-10 text-lg shrink-0', img: 'w-10 h-10 shrink-0' },
};

interface AvatarImageProps {
  avatarUrl: string | null;
  initial: string;
  size: 'sm' | 'md' | 'lg';
}

export function AvatarImage({ avatarUrl, initial, size }: AvatarImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const { container, img } = sizes[size];

  const showImg = avatarUrl && !failed;

  return (
    <div className={`${container} rounded-(--radius-pill) bg-(--color-border-light) text-(--color-text-secondary) flex items-center justify-center font-semibold relative overflow-hidden shrink-0`}>
      {initial}
      {showImg && (
        <img
          src={avatarUrl}
          alt=""
          className={`${img} rounded-(--radius-pill) absolute inset-0 transition-opacity duration-150`}
          style={{ opacity: loaded ? 1 : 0 }}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}
