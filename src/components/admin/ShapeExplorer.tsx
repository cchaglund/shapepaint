import type { ShapeType } from '../../types';
import { getShapeSVGData, SHAPE_NAMES } from '../../utils/shapes';
import { Link } from '../shared/Link';

const SHAPE_TYPES = Object.keys(SHAPE_NAMES) as ShapeType[];
const SAMPLE_SIZE = 100;

interface ShapePreviewProps {
  type: ShapeType;
  size: number;
}

function ShapePreview({ type, size }: ShapePreviewProps) {
  const { element, props, viewBox } = getShapeSVGData(type, size);

  // Scale to fit within size while preserving aspect ratio
  const scale = Math.min(size / viewBox.width, size / viewBox.height);
  const displayWidth = viewBox.width * scale;
  const displayHeight = viewBox.height * scale;

  return (
    <svg
      width={displayWidth}
      height={displayHeight}
      viewBox={`0 0 ${viewBox.width} ${viewBox.height}`}
    >
      {element === 'ellipse' && <ellipse {...props} fill="#000" />}
      {element === 'rect' && <rect {...props} fill="#000" />}
      {element === 'polygon' && <polygon {...props} fill="#000" />}
      {element === 'path' && <path {...props} fill="#000" />}
    </svg>
  );
}

export function ShapeExplorer() {
  return (
    <div className="min-h-screen p-8 bg-(--color-bg-primary)">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold mb-2 text-(--color-text-primary)">
            Shape Explorer
          </h1>
          <p className="text-sm text-(--color-text-secondary)">
            Developer tool showing all available shape types. Access via{' '}
            <code className="px-2 py-1 rounded text-xs bg-(--color-bg-tertiary)">
              ?explorer
            </code>{' '}
            URL parameter or{' '}
            <code className="px-2 py-1 rounded text-xs bg-(--color-bg-tertiary)">
              VITE_SHAPE_EXPLORER=true
            </code>{' '}
            environment variable.
          </p>
        </header>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
          {SHAPE_TYPES.map((type) => (
            <div
              key={type}
              className="p-6 rounded-lg border bg-(--color-bg-secondary) border-(--color-border)"
            >
              <div className="flex flex-col items-center gap-4">
                <h2 className="text-lg font-semibold text-(--color-text-primary)">
                  {SHAPE_NAMES[type]}
                </h2>

                <div className="p-3 rounded bg-(--color-bg-tertiary)">
                  <ShapePreview type={type} size={SAMPLE_SIZE} />
                </div>

                <div className="text-center">
                  <code className="text-xs px-2 py-1 rounded bg-(--color-bg-tertiary) text-(--color-text-secondary)">
                    type: '{type}'
                  </code>
                </div>
              </div>
            </div>
          ))}
        </div>

        <footer className="mt-8 pt-6 border-t text-center text-sm border-(--color-border) text-(--color-text-tertiary)">
          <p>
            Total shapes available: <strong>{SHAPE_TYPES.length}</strong>
          </p>
          <p className="mt-2">
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
