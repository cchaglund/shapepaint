import { useState } from 'react';
import type { Shape, ShapeType } from '../../types';
import { getShapeSVGData, SHAPE_NAMES } from '../../utils/shapes';
import { MultiSelectTransformLayer } from '../canvas/TransformHandles';
import { Link } from '../shared/Link';
import { SHAPE_SIMILARITY_GROUPS } from '../../../supabase/functions/_shared/shapeSimilarityGroups';

const SHAPE_TYPES = Object.keys(SHAPE_NAMES) as ShapeType[];
const SAMPLE_SIZE = 100;
const GROUP_PREVIEW_SIZE = 64;

function makeShape(type: ShapeType, size: number): Shape {
  return {
    id: `explorer-${type}`,
    type,
    name: type,
    x: 0,
    y: 0,
    size,
    rotation: 0,
    colorIndex: 0,
    zIndex: 0,
  };
}

interface ShapePreviewProps {
  type: ShapeType;
  size: number;
  showBoundingRect?: boolean;
  showOutline?: boolean;
}

function ShapePreview({ type, size, showBoundingRect = false, showOutline = false }: ShapePreviewProps) {
  const data = getShapeSVGData(type, size);
  if (!data) return null;
  const { element, props, viewBox, dimensions } = data;

  // Scale to fit within size while preserving aspect ratio
  const scale = Math.min(size / viewBox.width, size / viewBox.height);
  const displayWidth = viewBox.width * scale;
  const displayHeight = viewBox.height * scale;

  const showOverlay = showBoundingRect || showOutline;
  // MultiSelectTransformLayer works in render-dimension space (dimensions ?? viewBox)
  const renderW = dimensions?.width ?? viewBox.width;
  const renderH = dimensions?.height ?? viewBox.height;

  return (
    <svg
      width={displayWidth}
      height={displayHeight}
      viewBox={`0 0 ${viewBox.width} ${viewBox.height}`}
      overflow={showOverlay ? 'visible' : undefined}
    >
      {element === 'ellipse' && <ellipse {...props} fill="#000" />}
      {element === 'rect' && <rect {...props} fill="#000" />}
      {element === 'polygon' && <polygon {...props} fill="#000" />}
      {element === 'path' && <path {...props} fill="#000" />}
      {showOverlay && (
        // Bridge from viewBox coords to render-dimension coords that the transform layer expects
        <svg
          x={0} y={0}
          width={viewBox.width} height={viewBox.height}
          viewBox={`0 0 ${renderW} ${renderH}`}
          overflow="visible"
        >
          <MultiSelectTransformLayer
            shapes={[makeShape(type, size)]}
            bounds={{ x: 0, y: 0, width: renderW, height: renderH }}
            showBoundingRect={showBoundingRect}
            showOutline={showOutline}
          />
        </svg>
      )}
    </svg>
  );
}

// Filter similarity groups to only include shapes that exist in the frontend
const validGroups = SHAPE_SIMILARITY_GROUPS.map((group) => ({
  ...group,
  shapes: group.shapes.filter((s) => SHAPE_TYPES.includes(s as ShapeType)),
})).filter((group) => group.shapes.length >= 2);

export function ShapeExplorer() {
  const [showBoundingRect, setShowBoundingRect] = useState(false);
  const [showOutline, setShowOutline] = useState(false);

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
          <div className="flex gap-6 mt-4">
            <label className="flex items-center gap-2 text-sm text-(--color-text-primary) cursor-pointer">
              <input
                type="checkbox"
                checked={showBoundingRect}
                onChange={(e) => setShowBoundingRect(e.target.checked)}
              />
              Bounding rect
            </label>
            <label className="flex items-center gap-2 text-sm text-(--color-text-primary) cursor-pointer">
              <input
                type="checkbox"
                checked={showOutline}
                onChange={(e) => setShowOutline(e.target.checked)}
              />
              Shape outline
            </label>
          </div>
        </header>

        {/* Similarity Groups */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold mb-1 text-(--color-text-primary)">
            Similarity Groups
          </h2>
          <p className="text-sm mb-4 text-(--color-text-secondary)">
            Shapes within the same group will never be paired together in a daily challenge.
            These groups are shared with the edge function — this is the live production config.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {validGroups.map((group) => (
              <div
                key={group.name}
                className="p-4 rounded-lg border bg-(--color-bg-secondary) border-(--color-border)"
              >
                <h3 className="text-sm font-medium mb-3 text-(--color-text-primary)">
                  {group.name}
                </h3>
                <div className="flex flex-wrap gap-3">
                  {group.shapes.map((shapeType) => (
                    <div key={shapeType} className="flex flex-col items-center gap-1">
                      <div className="p-2 rounded bg-(--color-bg-tertiary)">
                        <ShapePreview type={shapeType as ShapeType} size={GROUP_PREVIEW_SIZE} />
                      </div>
                      <span className="text-xs text-(--color-text-tertiary)">
                        {SHAPE_NAMES[shapeType as ShapeType]}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* All Shapes */}
        <section>
          <h2 className="text-xl font-semibold mb-4 text-(--color-text-primary)">
            All Shapes
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            {SHAPE_TYPES.map((type) => (
              <div
                key={type}
                className="p-6 rounded-lg border bg-(--color-bg-secondary) border-(--color-border)"
              >
                <div className="flex flex-col items-center gap-4">
                  <h3 className="text-lg font-semibold text-(--color-text-primary)">
                    {SHAPE_NAMES[type]}
                  </h3>

                  <div className="p-3 rounded bg-(--color-bg-tertiary)">
                    <ShapePreview
                      type={type}
                      size={SAMPLE_SIZE}
                      showBoundingRect={showBoundingRect}
                      showOutline={showOutline}
                    />
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
        </section>

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
