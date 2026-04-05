import { Button } from '../shared/Button';

interface SubmissionNavigationProps {
  adjacentDates: { prev: string | null; next: string | null };
  onNavigate: (date: string) => void;
}

export function SubmissionNavigation({ adjacentDates, onNavigate }: SubmissionNavigationProps) {
  return (
    <div className="flex items-center gap-1">
      <Button
        variant="link"
        onClick={() => adjacentDates.prev && onNavigate(adjacentDates.prev)}
        disabled={!adjacentDates.prev}
        className="disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Previous
      </Button>
      <Button
        variant="link"
        onClick={() => adjacentDates.next && onNavigate(adjacentDates.next)}
        disabled={!adjacentDates.next}
        className="disabled:opacity-30 disabled:cursor-not-allowed"
      >
        Next
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </Button>
    </div>
  );
}
