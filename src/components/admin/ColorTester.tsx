import { useState, useCallback, useRef } from 'react';
import { Link } from '../shared/Link';
import { supabase } from '../../lib/supabase';

// =============================================================================
// ColorTester - Tests the PRODUCTION color generation algorithm
// =============================================================================
// This component calls the server edge function to generate colors.
// It does NOT use local/client-side color generation.
//
// If you update color generation in supabase/functions/get-daily-challenge/,
// you MUST deploy before changes appear here:
//   supabase functions deploy get-daily-challenge
// =============================================================================

interface PairwiseMetadata {
  pair: string;
  contrastRatio: number;
  hueDiff: number;
  distance: number;
}

interface TestColorResponse {
  colors: string[];
  metadata: { pairwise: PairwiseMetadata[] };
}

export function ColorTester() {
  const [colors, setColors] = useState<string[] | null>(null);
  const [metadata, setMetadata] = useState<PairwiseMetadata[] | null>(null);
  const [history, setHistory] = useState<string[][]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track "previous day" colors to test consecutive day avoidance
  const previousColorsRef = useRef<string[]>([]);

  const handleGenerate = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase.functions.invoke(
        'get-daily-challenge',
        {
          body: {
            test: true,
            previousColors: previousColorsRef.current,
          },
        }
      );

      if (fetchError) {
        throw new Error(fetchError.message || 'Failed to generate colors');
      }

      const response = data as TestColorResponse;
      setColors(response.colors);
      setMetadata(response.metadata.pairwise);
      setHistory((prev) => [response.colors, ...prev]);

      // Update "previous" colors for next generation (simulates day-to-day)
      previousColorsRef.current = [...response.colors];
    } catch (err) {
      console.error('Failed to generate colors:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleClearHistory = useCallback(() => {
    setHistory([]);
    previousColorsRef.current = [];
  }, []);

  return (
    <div className="min-h-screen p-8 flex flex-col items-center bg-(--color-bg-primary)">
      <div className="max-w-lg w-full">
        <header className="mb-8 text-center">
          <h1 className="text-3xl font-bold mb-2 text-(--color-text-primary)">Color Tester</h1>
          <p className="text-sm text-(--color-text-secondary)">
            Tests the <strong>production server</strong> color generation algorithm. Each click
            simulates a new day, avoiding colors too similar to the previous day.
          </p>
        </header>

        <div className="flex flex-col items-center gap-6">
          {/* Server Notice */}
          <div className="w-full p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
            <p className="text-xs text-amber-600 dark:text-amber-400">
              <strong>Note:</strong> This calls the deployed edge function. After updating color
              generation code, run <code className="bg-black/10 px-1 rounded">supabase functions deploy get-daily-challenge</code> for changes to appear here.
            </p>
          </div>

          {/* Production Settings Info */}
          <div className="w-full p-4 rounded-lg bg-(--color-bg-secondary)">
            <h3 className="text-sm font-semibold mb-2 text-(--color-text-primary)">
              Production Settings
            </h3>
            <ul className="text-xs text-(--color-text-tertiary) space-y-1">
              <li>Color space: OKLCH (perceptually uniform)</li>
              <li>3 colors per challenge</li>
              <li>Lightness range: 0.4 - 0.9</li>
              <li>Muddy hues excluded: 30-50° (browns)</li>
              <li>Min contrast ratio: 2.5 (≥2 of 3 pairs must pass)</li>
              <li>Min hue difference: 30° between each pair</li>
              <li>Consecutive day similarity check: enabled</li>
            </ul>
          </div>

          <div className="flex gap-4">
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="px-6 py-3 rounded-lg font-medium text-lg cursor-pointer transition-opacity bg-(--color-text-primary) text-(--color-bg-primary) hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Generating...' : 'Generate Colors'}
            </button>
            {history.length > 0 && (
              <button
                onClick={handleClearHistory}
                disabled={loading}
                className="px-4 py-3 rounded-lg font-medium text-sm cursor-pointer transition-opacity bg-(--color-bg-tertiary) text-(--color-text-secondary) hover:opacity-80 disabled:opacity-50"
              >
                Clear History
              </button>
            )}
          </div>

          {error && (
            <div className="w-full p-3 rounded-lg bg-red-500/10 border border-red-500/30">
              <p className="text-sm text-red-600 dark:text-red-400">
                <strong>Error:</strong> {error}
              </p>
            </div>
          )}

          <div className="flex items-center justify-center py-4">
            {colors ? (
              <svg width="240" height="235" viewBox="0 0 240 235">
                <circle cx="80" cy="80" r="75" fill={colors[0]} stroke="none" />
                <circle cx="160" cy="80" r="75" fill={colors[1]} stroke="none" />
                <circle cx="120" cy="158" r="75" fill={colors[2]} stroke="none" />
              </svg>
            ) : (
              <p className="text-(--color-text-tertiary)">
                Click the button to generate colors
              </p>
            )}
          </div>

          {colors && metadata && (
            <div className="w-full p-4 rounded-lg bg-(--color-bg-secondary)">
              <h3 className="text-sm font-semibold mb-3 text-(--color-text-primary)">
                Color Details
              </h3>
              <div className="space-y-2 text-sm text-(--color-text-secondary)">
                {colors.map((color, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div
                      className="w-4 h-4 rounded"
                      style={{ backgroundColor: color }}
                    />
                    <code>{color}</code>
                  </div>
                ))}
                <hr className="border-(--color-border) my-3" />
                <h4 className="text-xs font-semibold text-(--color-text-primary) mb-2">
                  Pairwise Comparisons
                </h4>
                {metadata.map((m, i) => (
                  <div key={i} className="p-2 rounded bg-(--color-bg-tertiary) space-y-1">
                    <div className="text-xs font-medium text-(--color-text-primary)">{m.pair}</div>
                    <div>
                      <strong>Contrast:</strong> {m.contrastRatio.toFixed(2)}:1
                      {m.contrastRatio >= 2.5 && (
                        <span className="ml-2 text-green-500">(passes)</span>
                      )}
                    </div>
                    <div>
                      <strong>Distance:</strong> {m.distance.toFixed(1)}
                    </div>
                    <div>
                      <strong>Hue Diff:</strong> {m.hueDiff.toFixed(0)}°
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* History Section */}
        {history.length > 1 && (
          <div className="mt-8 pt-6 border-t border-(--color-border)">
            <h2 className="text-lg font-semibold mb-4 text-(--color-text-primary)">
              History (simulated consecutive days)
            </h2>
            <p className="text-xs text-(--color-text-tertiary) mb-4">
              Each set should avoid having colors too similar to the previous set.
            </p>
            <div className="flex flex-wrap gap-4">
              {history.slice(1).map((set, index) => (
                <svg key={index} width="64" height="62" viewBox="0 0 64 62">
                  <circle cx="21" cy="21" r="19" fill={set[0]} stroke="none" />
                  <circle cx="43" cy="21" r="19" fill={set[1]} stroke="none" />
                  <circle cx="32" cy="41" r="19" fill={set[2]} stroke="none" />
                </svg>
              ))}
            </div>
          </div>
        )}

        <footer className="mt-8 pt-6 border-t text-center text-sm border-(--color-border) text-(--color-text-tertiary)">
          <p>
            <Link
              href="/"
              className="underline hover:no-underline text-(--color-text-secondary)"
            >
              Return to main app
            </Link>
          </p>
        </footer>
      </div>
    </div>
  );
}
