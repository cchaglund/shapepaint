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
  const [failed, setFailed] = useState(false);
  const { container, img } = sizes[size];

  if (avatarUrl && !failed) {
    return (
      <img
        src={avatarUrl}
        alt=""
        className={`${img} rounded-(--radius-pill)`}
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <div className={`${container} rounded-(--radius-pill) bg-(--color-accent) text-(--color-accent-text) flex items-center justify-center font-semibold`}>
      {initial}
    </div>
  );
}
