import { Button } from './Button';

const chevronLeft = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

export function BackButton({ href, label }: { href: string; label: string }) {
  return (
    <Button as="a" variant="ghost" href={href} className="gap-1">
      {chevronLeft}
      <span className="hidden md:inline">{label}</span>
    </Button>
  );
}
