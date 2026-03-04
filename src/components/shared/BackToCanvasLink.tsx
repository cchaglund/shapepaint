import { Link } from './Link';

export function BackToCanvasLink() {
    return (
        <Link
            href="/"
            className="inline-flex items-center gap-1 text-base hover:underline text-(--color-text-secondary) mb-4"
        >
            <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <polyline points="15 18 9 12 15 6" />
            </svg>
            <span className="hidden md:inline">Back to canvas</span>
        </Link>
    );
};