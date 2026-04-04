import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../hooks/auth/useAuth';
import { searchProfilesByNickname } from '../../lib/api';
import { FriendRow } from './FriendRow';
import { LoadingSpinner } from '../shared/LoadingSpinner';

interface SearchResult {
  id: string;
  nickname: string;
  avatar_url: string | null;
}

interface UserSearchBarProps {
  onNavigateToProfile?: (userId: string) => void;
}

export function UserSearchBar({ onNavigateToProfile }: UserSearchBarProps) {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounce the search query (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  // Perform search when debounced query changes
  useEffect(() => {
    if (!debouncedQuery) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    const searchUsers = async () => {
      setLoading(true);
      setHasSearched(true);

      try {
        const data = await searchProfilesByNickname(debouncedQuery, user?.id);
        setResults(data);
      } catch (err) {
        console.error('Search error:', err);
        setResults([]);
      } finally {
        setLoading(false);
      }
    };

    searchUsers();
  }, [debouncedQuery, user?.id]);

  const handleClear = useCallback(() => {
    setQuery('');
    setResults([]);
    setHasSearched(false);
    inputRef.current?.focus();
  }, []);

  return (
    <div className="space-y-3">
      {/* Search input */}
      <div className="relative">
        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
          <svg
            className="w-4 h-4 text-(--color-text-secondary)"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search for artists..."
          className="w-full pl-10 pr-10 py-2 text-sm bg-(--color-bg-secondary) border border-(--color-border) rounded-(--radius-lg) text-(--color-text-primary) placeholder:text-(--color-text-secondary) focus:outline-none focus:ring-2 focus:ring-(--color-accent) focus:border-transparent"
        />
        {query && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute inset-y-0 right-3 flex items-center text-(--color-text-secondary) hover:text-(--color-text-primary) cursor-pointer"
            aria-label="Clear search"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Search results */}
      {loading && (
        <LoadingSpinner size="sm" inline />
      )}

      {!loading && hasSearched && results.length === 0 && (
        <div className="text-center py-4 text-sm text-(--color-text-secondary)">
          No users found matching '{debouncedQuery}'
        </div>
      )}

      {!loading && results.length > 0 && (
        <div className="divide-y divide-(--color-border) border border-(--color-border) rounded-(--radius-lg) overflow-hidden">
          {results.map((result) => (
            <FriendRow
              key={result.id}
              userId={result.id}
              nickname={result.nickname}
              avatarUrl={result.avatar_url}
              onNavigateToProfile={onNavigateToProfile}
            />
          ))}
        </div>
      )}
    </div>
  );
}
