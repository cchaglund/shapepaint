import type { Shape } from '../../types';
import { getShapeSVGData } from '../../utils/shapes';
import { getShapeAABB } from '../../utils/shapeBounds';

interface TransformHandlesProps {
  shape: Shape;
  zoom?: number;
  onMoveStart: (e: React.MouseEvent | React.TouchEvent) => void;
  onResizeStart: (e: React.MouseEvent | React.TouchEvent, corner: string) => void;
  onRotateStart: (e: React.MouseEvent | React.TouchEvent) => void;
  onHandleHover?: (handleId: string | null) => void;
}

interface MultiSelectTransformLayerProps {
  shapes: Shape[];
  bounds: { x: number; y: number; width: number; height: number };
  zoom?: number;
  showIndividualOutlines?: boolean;
  showBoundingRect?: boolean;
  showOutline?: boolean;
  hoveredHandleId?: string | null;
}

interface MultiSelectInteractionLayerProps {
  bounds: { x: number; y: number; width: number; height: number };
  zoom?: number;
  onMoveStart: (e: React.MouseEvent | React.TouchEvent) => void;
  onResizeStart: (e: React.MouseEvent | React.TouchEvent, corner: string) => void;
  onRotateStart: (e: React.MouseEvent | React.TouchEvent) => void;
  onHandleHover?: (handleId: string | null) => void;
}

// Base sizes at 100% zoom
const BASE_HANDLE_SIZE = 10;
const BASE_ROTATION_ZONE_PAD = 12;
const BASE_STROKE_WIDTH = 1;
const BASE_DASH_STROKE_WIDTH = 2;

/** 4 corner resize handles */
function getResizeHandles(width: number, height: number) {
  return [
    { id: 'nw', x: 0, y: 0 },
    { id: 'ne', x: width, y: 0 },
    { id: 'se', x: width, y: height },
    { id: 'sw', x: 0, y: height },
  ];
}

// Get the effective cursor for a resize handle, accounting for rotation and flip transforms
// The cursor should always point away from the center of the shape in screen space
function getEffectiveCursor(handleId: string, flipX: boolean, flipY: boolean, rotation: number): string {
  // Local handle offsets from center (before any transforms)
  const handleVectors: Record<string, { x: number; y: number }> = {
    nw: { x: -1, y: -1 },
    n: { x: 0, y: -1 },
    ne: { x: 1, y: -1 },
    e: { x: 1, y: 0 },
    se: { x: 1, y: 1 },
    s: { x: 0, y: 1 },
    sw: { x: -1, y: 1 },
    w: { x: -1, y: 0 },
  };

  const local = handleVectors[handleId] || { x: 1, y: 1 };

  // SVG transform order is right-to-left: rotate first, then flip
  // So we apply: rotation, then flip

  // Step 1: Apply rotation
  const rad = (rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const rotatedX = local.x * cos - local.y * sin;
  const rotatedY = local.x * sin + local.y * cos;

  // Step 2: Apply flip
  const screenX = rotatedX * (flipX ? -1 : 1);
  const screenY = rotatedY * (flipY ? -1 : 1);

  // Convert to angle (0 = right/east, goes clockwise)
  let angle = Math.atan2(screenY, screenX) * (180 / Math.PI);
  if (angle < 0) angle += 360;

  // Map the angle to the nearest cursor direction
  // Cursors are at 45° intervals: 0=e, 45=se, 90=s, 135=sw, 180=w, 225=nw, 270=n, 315=ne
  const cursorMap = ['e', 'se', 's', 'sw', 'w', 'nw', 'n', 'ne'];
  const index = Math.round(angle / 45) % 8;
  const cursor = cursorMap[index];

  // Convert cardinal directions to resize cursors
  // n/s use ns-resize, e/w use ew-resize, diagonals use their standard names
  if (cursor === 'n' || cursor === 's') return 'ns-resize';
  if (cursor === 'e' || cursor === 'w') return 'ew-resize';
  return `${cursor}-resize`;
}

/** Shared style for themed resize handles */
function getHandleStyle(isHovered: boolean): React.CSSProperties {
  return {
    fill: 'var(--sel-handle-fill)',
    stroke: 'var(--sel-handle-stroke)',
    rx: 'var(--sel-handle-radius)',
    ry: 'var(--sel-handle-radius)',
    transformBox: 'fill-box' as const,
    transformOrigin: 'center',
    transform: isHovered ? 'scale(1.3)' : undefined,
    transition: 'transform 0.15s ease',
  };
}


/** Generate a rotation cursor SVG rotated to a given angle (Figma-style curved arrow) */
const _cursorCache = new Map<number, string>();
const ROTATION_CURSOR_PATH = "M13.1785 16.0527C13.3737 16.248 13.6903 16.248 13.8856 16.0527L17.0676 12.8707C17.2628 12.6755 17.2628 12.3589 17.0676 12.1636C16.8723 11.9684 16.5557 11.9684 16.3604 12.1636L13.532 14.992L10.7036 12.1636C10.5083 11.9684 10.1917 11.9684 9.99649 12.1636C9.80122 12.3589 9.80122 12.6755 9.99649 12.8707L13.1785 16.0527ZM0.146446 3.32932C-0.0488161 3.52459 -0.0488161 3.84117 0.146446 4.03643L3.32843 7.21841C3.52369 7.41367 3.84027 7.41367 4.03553 7.21841C4.2308 7.02315 4.2308 6.70657 4.03553 6.51131L1.20711 3.68288L4.03553 0.854451C4.2308 0.659189 4.2308 0.342606 4.03553 0.147344C3.84027 -0.0479175 3.52369 -0.0479175 3.32843 0.147344L0.146446 3.32932ZM13.532 15.6991L14.032 15.6991C14.032 12.192 14.0328 9.6453 13.8252 7.82323C13.6186 6.01068 13.1931 4.76521 12.2064 4.01202C11.2463 3.2791 9.86525 3.10596 8.04128 3.07989C7.11347 3.06662 6.03373 3.09271 4.78995 3.12167C3.54284 3.1507 2.12262 3.18288 0.499999 3.18288L0.499999 3.68288L0.499999 4.18288C2.13539 4.18288 3.56592 4.15043 4.81322 4.1214C6.06385 4.09228 7.12218 4.06685 8.02699 4.07978C9.86828 4.10611 10.9307 4.29626 11.5996 4.80688C12.242 5.29724 12.6309 6.17558 12.8316 7.93647C13.0312 9.68784 13.032 12.1642 13.032 15.6991L13.532 15.6991Z";
function makeRotationCursor(angleDeg: number): string {
  const key = Math.round(((angleDeg % 360) + 360) % 360);
  const cached = _cursorCache.get(key);
  if (cached) return cached;
  // SVG viewBox is 18x17; center at (9, 8.5); pad to 24x24 with offset (3, 3.5)
  const svg = [
    "<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none'>",
    `<g transform='rotate(${key}, 12, 12)'>`,
    // white outline for contrast
    `<path d='${ROTATION_CURSOR_PATH}' fill='white' transform='translate(3, 3.5)' stroke='white' stroke-width='2.5' stroke-linejoin='round'/>`,
    // black foreground
    `<path d='${ROTATION_CURSOR_PATH}' fill='black' transform='translate(3, 3.5)'/>`,
    "</g>",
    "</svg>",
  ].join('');
  const cursor = `url("data:image/svg+xml,${encodeURIComponent(svg)}") 12 12, crosshair`;
  _cursorCache.set(key, cursor);
  return cursor;
}

/** Compute screen-space rotation angle for a corner's cursor */
function getRotationCursorAngle(cornerId: string, flipX: boolean, flipY: boolean, rotation: number): number {
  const vectors: Record<string, { x: number; y: number }> = {
    'rotate-ne': { x: 1, y: -1 },
    'rotate-se': { x: 1, y: 1 },
    'rotate-sw': { x: -1, y: 1 },
    'rotate-nw': { x: -1, y: -1 },
  };
  const v = vectors[cornerId] ?? { x: 1, y: -1 };
  // Apply rotation then flip (matching SVG transform order)
  const rad = (rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const rx = v.x * cos - v.y * sin;
  const ry = v.x * sin + v.y * cos;
  const sx = rx * (flipX ? -1 : 1);
  const sy = ry * (flipY ? -1 : 1);
  // Base cursor (0°) points NE (-45° in math coords), so offset +45°
  return Math.atan2(sy, sx) * (180 / Math.PI) + 45;
}

/** 4 corner rotation zones positioned diagonally outside the bounding box */
function getRotationCorners(width: number, height: number, pad: number) {
  return [
    { id: 'rotate-nw' as const, x: -pad, y: -pad },
    { id: 'rotate-ne' as const, x: width, y: -pad },
    { id: 'rotate-se' as const, x: width, y: height },
    { id: 'rotate-sw' as const, x: -pad, y: height },
  ];
}

/** Build SVG transform string matching ShapeElement's flip + rotation order */
function buildShapeTransform(shape: Shape, centerX: number, centerY: number): string {
  const scaleX = shape.flipX ? -1 : 1;
  const scaleY = shape.flipY ? -1 : 1;
  return `translate(${shape.x}, ${shape.y}) translate(${centerX}, ${centerY}) scale(${scaleX}, ${scaleY}) translate(${-centerX}, ${-centerY}) rotate(${shape.rotation}, ${centerX}, ${centerY})`;
}

// Invisible interaction layer - rendered inline with shapes for proper click ordering
export function TransformInteractionLayer({
  shape,
  zoom = 1,
  onMoveStart,
  onResizeStart,
  onRotateStart,
  onHandleHover,
}: TransformHandlesProps) {
  // Scale handle sizes inversely with zoom to maintain constant visual size
  const scale = 1 / zoom;
  const handleSize = BASE_HANDLE_SIZE * scale;
  const rotationPad = BASE_ROTATION_ZONE_PAD * scale;

  const { viewBox, dimensions } = getShapeSVGData(shape.type, shape.size);
  const renderW = dimensions?.width ?? viewBox.width;
  const renderH = dimensions?.height ?? viewBox.height;
  const resizeHandles = getResizeHandles(renderW, renderH);
  const centerX = renderW / 2;
  const centerY = renderH / 2;
  const transform = buildShapeTransform(shape, centerX, centerY);

  return (
    <g transform={transform} style={{ pointerEvents: 'all' }}>
      {/* Rotation corner zones — diagonal squares outside each corner */}
      {getRotationCorners(renderW, renderH, rotationPad).map((corner) => (
        <rect
          key={corner.id}
          x={corner.x}
          y={corner.y}
          width={rotationPad}
          height={rotationPad}
          fill="transparent"
          style={{ cursor: makeRotationCursor(getRotationCursorAngle(corner.id, shape.flipX ?? false, shape.flipY ?? false, shape.rotation)), touchAction: 'none' }}
          onMouseDown={onRotateStart}
          onTouchStart={onRotateStart}
          onMouseEnter={() => onHandleHover?.('rotate')}
          onMouseLeave={() => onHandleHover?.(null)}
        />
      ))}

      {/* Invisible fill rect for dragging */}
      <rect
        x={0}
        y={0}
        width={renderW}
        height={renderH}
        fill="transparent"
        style={{ cursor: 'move', touchAction: 'none' }}
        onMouseDown={onMoveStart}
        onTouchStart={onMoveStart}
      />

      {/* Invisible resize handles (corners only) */}
      {resizeHandles.map((handle) => (
        <rect
          key={handle.id}
          x={handle.x - handleSize / 2}
          y={handle.y - handleSize / 2}
          width={handleSize}
          height={handleSize}
          fill="transparent"
          style={{ cursor: getEffectiveCursor(handle.id, shape.flipX ?? false, shape.flipY ?? false, shape.rotation), touchAction: 'none' }}
          onMouseDown={(e) => onResizeStart(e, handle.id)}
          onTouchStart={(e) => onResizeStart(e, handle.id)}
          onMouseEnter={() => onHandleHover?.(handle.id)}
          onMouseLeave={() => onHandleHover?.(null)}
        />
      ))}
    </g>
  );
}

// Visible UI layer - rendered on top of everything
export function TransformVisualLayer({
  shape,
  zoom = 1,
  hoveredHandleId,
}: {
  shape: Shape;
  zoom?: number;
  hoveredHandleId?: string | null;
}) {
  // Scale sizes inversely with zoom
  const scale = 1 / zoom;
  const handleSize = BASE_HANDLE_SIZE * scale;
  const strokeWidth = BASE_STROKE_WIDTH * scale;
  const dashStrokeWidth = BASE_DASH_STROKE_WIDTH * scale;

  const { element, props, viewBox, outlineD, dimensions } = getShapeSVGData(shape.type, shape.size);
  const renderW = dimensions?.width ?? viewBox.width;
  const renderH = dimensions?.height ?? viewBox.height;
  const resizeHandles = getResizeHandles(renderW, renderH);
  const centerX = renderW / 2;
  const centerY = renderH / 2;
  const transform = buildShapeTransform(shape, centerX, centerY);

  // Common props for the shape outline
  const outlineProps = {
    ...props,
    ...(outlineD && { d: outlineD }),
    fill: 'none',
    stroke: 'var(--color-text-primary)',
    strokeWidth: dimensions ? dashStrokeWidth * (viewBox.width / renderW) : dashStrokeWidth,
    strokeDasharray: dimensions
      ? `${5 * scale * (viewBox.width / renderW)},${5 * scale * (viewBox.width / renderW)}`
      : `${5 * scale},${5 * scale}`,
  };

  // For fixed-viewBox shapes, wrap outline in nested <svg> for coordinate scaling
  const outlineElement = (
    <>
      {element === 'ellipse' && <ellipse {...outlineProps} />}
      {element === 'rect' && <rect {...outlineProps} />}
      {element === 'polygon' && <polygon {...outlineProps} />}
      {element === 'path' && <path {...outlineProps} />}
    </>
  );

  return (
    <g transform={transform} style={{ pointerEvents: 'none' }}>
      {/* Bounding box — solid or dashed per theme (--sel-dash) */}
      <rect
        x={0}
        y={0}
        width={renderW}
        height={renderH}
        fill="none"
        style={{ stroke: 'var(--sel-border)', strokeDasharray: 'var(--sel-dash)' }}
        strokeWidth={strokeWidth}
      />

      {/* Shape outline (dashed) — rendered after bounding box so it's visible on rect shapes */}
      {dimensions ? (
        <svg
          x={0} y={0}
          width={renderW} height={renderH}
          viewBox={`0 0 ${viewBox.width} ${viewBox.height}`}
          overflow="visible"
        >
          {outlineElement}
        </svg>
      ) : (
        outlineElement
      )}

      {/* Resize handles (corners only) */}
      {resizeHandles.map((handle) => (
        <rect
          key={handle.id}
          x={handle.x - handleSize / 2}
          y={handle.y - handleSize / 2}
          width={handleSize}
          height={handleSize}
          style={getHandleStyle(hoveredHandleId === handle.id)}
          strokeWidth={strokeWidth}
        />
      ))}

    </g>
  );
}

// Multi-select transform layer - shows bounding box for multiple shapes
export function MultiSelectTransformLayer({
  shapes,
  bounds,
  zoom = 1,
  showIndividualOutlines = true,
  showBoundingRect = true,
  showOutline = true,
  hoveredHandleId,
}: MultiSelectTransformLayerProps) {
  // Scale sizes inversely with zoom
  const scale = 1 / zoom;
  const handleSize = BASE_HANDLE_SIZE * scale;
  const strokeWidth = BASE_STROKE_WIDTH * scale;
  const dashStrokeWidth = BASE_DASH_STROKE_WIDTH * scale;

  const isSingleShape = shapes.length === 1;

  // For single shape, use the existing visual layer behavior
  if (isSingleShape) {
    const shape = shapes[0];
    const { element, props, viewBox, outlineD, dimensions } = getShapeSVGData(shape.type, shape.size);
    const renderW = dimensions?.width ?? viewBox.width;
    const renderH = dimensions?.height ?? viewBox.height;
    const resizeHandles = getResizeHandles(renderW, renderH);
    const centerX = renderW / 2;
    const centerY = renderH / 2;
    const transform = buildShapeTransform(shape, centerX, centerY);

    const outlineProps = {
      ...props,
      ...(outlineD && { d: outlineD }),
      fill: 'none',
      stroke: 'var(--color-text-primary)',
      strokeWidth: dimensions ? dashStrokeWidth * (viewBox.width / renderW) : dashStrokeWidth,
      strokeDasharray: dimensions
        ? `${5 * scale * (viewBox.width / renderW)},${5 * scale * (viewBox.width / renderW)}`
        : `${5 * scale},${5 * scale}`,
    };

    const outlineElement = (
      <>
        {element === 'ellipse' && <ellipse {...outlineProps} />}
        {element === 'rect' && <rect {...outlineProps} />}
        {element === 'polygon' && <polygon {...outlineProps} />}
        {element === 'path' && <path {...outlineProps} />}
      </>
    );

    return (
      <g transform={transform} style={{ pointerEvents: 'none' }}>
        {/* Bounding box — solid or dashed per theme (--sel-dash) */}
        {showBoundingRect && (
          <rect
            x={0}
            y={0}
            width={renderW}
            height={renderH}
            fill="none"
            style={{ stroke: 'var(--sel-border)', strokeDasharray: 'var(--sel-dash)' }}
            strokeWidth={strokeWidth}
          />
        )}

        {/* Shape outline (dashed) — rendered after bounding box so it's visible on rect shapes */}
        {showOutline && (dimensions ? (
          <svg
            x={0} y={0}
            width={renderW} height={renderH}
            viewBox={`0 0 ${viewBox.width} ${viewBox.height}`}
            overflow="visible"
          >
            {outlineElement}
          </svg>
        ) : (
          outlineElement
        ))}

        {/* Resize handles (corners only) */}
        {showBoundingRect && resizeHandles.map((handle) => (
          <rect
            key={handle.id}
            x={handle.x - handleSize / 2}
            y={handle.y - handleSize / 2}
            width={handleSize}
            height={handleSize}
            style={getHandleStyle(hoveredHandleId === handle.id)}
            strokeWidth={strokeWidth}
          />
        ))}

      </g>
    );
  }

  // For multiple shapes, show combined bounding box and individual dashed outlines
  const resizeHandles = getResizeHandles(bounds.width, bounds.height);

  return (
    <g style={{ pointerEvents: 'none' }}>
      {/* Individual shape outlines — shape-specific dashed outlines per-shape */}
      {showOutline && showIndividualOutlines &&
        shapes.map((shape) => {
          const { element, props, viewBox, outlineD, dimensions } = getShapeSVGData(shape.type, shape.size);
          const rW = dimensions?.width ?? viewBox.width;
          const rH = dimensions?.height ?? viewBox.height;
          const centerX = rW / 2;
          const centerY = rH / 2;
          const transform = buildShapeTransform(shape, centerX, centerY);

          const outlineProps = {
            ...props,
            ...(outlineD && { d: outlineD }),
            fill: 'none',
            stroke: 'var(--color-text-primary)',
            strokeWidth: dimensions ? dashStrokeWidth * (viewBox.width / rW) : dashStrokeWidth,
            strokeDasharray: dimensions
              ? `${5 * scale * (viewBox.width / rW)},${5 * scale * (viewBox.width / rW)}`
              : `${5 * scale},${5 * scale}`,
            opacity: 0.8,
          };

          const outlineEl = (
            <>
              {element === 'ellipse' && <ellipse {...outlineProps} />}
              {element === 'rect' && <rect {...outlineProps} />}
              {element === 'polygon' && <polygon {...outlineProps} />}
              {element === 'path' && <path {...outlineProps} />}
            </>
          );

          return (
            <g key={shape.id} transform={transform}>
              {dimensions ? (
                <svg
                  x={0} y={0}
                  width={rW} height={rH}
                  viewBox={`0 0 ${viewBox.width} ${viewBox.height}`}
                  overflow="visible"
                >
                  {outlineEl}
                </svg>
              ) : (
                outlineEl
              )}
            </g>
          );
        })}

      {/* Combined bounding box — solid or dashed per theme (--sel-dash) */}
      {showBoundingRect && (
        <rect
          x={bounds.x}
          y={bounds.y}
          width={bounds.width}
          height={bounds.height}
          fill="none"
          style={{ stroke: 'var(--sel-border)', strokeDasharray: 'var(--sel-dash)' }}
          strokeWidth={strokeWidth}
        />
      )}

      {/* Resize handles (corners only) */}
      {showBoundingRect && resizeHandles.map((handle) => (
        <rect
          key={handle.id}
          x={bounds.x + handle.x - handleSize / 2}
          y={bounds.y + handle.y - handleSize / 2}
          width={handleSize}
          height={handleSize}
          style={getHandleStyle(hoveredHandleId === handle.id)}
          strokeWidth={strokeWidth}
        />
      ))}

    </g>
  );
}

// Hover highlight layer - shows dashed outline for hovered shapes.
// Single shape: outline around that shape. Multiple shapes (group hover): single bounding box.
export function HoverHighlightLayer({ shapes, zoom = 1 }: { shapes: Shape[]; zoom?: number }) {
  const scale = 1 / zoom;
  const strokeWidth = 2 * scale;
  const dashLength = 6 * scale;

  if (shapes.length === 0) return null;

  // Multiple shapes (group hover): render a single bounding box
  if (shapes.length > 1) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const shape of shapes) {
      const aabb = getShapeAABB(shape);
      minX = Math.min(minX, aabb.minX);
      minY = Math.min(minY, aabb.minY);
      maxX = Math.max(maxX, aabb.maxX);
      maxY = Math.max(maxY, aabb.maxY);
    }
    return (
      <g style={{ pointerEvents: 'none' }}>
        <rect
          x={minX}
          y={minY}
          width={maxX - minX}
          height={maxY - minY}
          fill="none"
          style={{ stroke: 'var(--color-accent)' }}
          strokeWidth={strokeWidth}
          strokeDasharray={`${dashLength},${dashLength}`}
        />
      </g>
    );
  }

  // Single shape: outline around individual shape
  const shape = shapes[0];
  const { viewBox, dimensions } = getShapeSVGData(shape.type, shape.size);
  const rW = dimensions?.width ?? viewBox.width;
  const rH = dimensions?.height ?? viewBox.height;
  const centerX = rW / 2;
  const centerY = rH / 2;
  const transform = buildShapeTransform(shape, centerX, centerY);

  return (
    <g style={{ pointerEvents: 'none' }}>
      <g transform={transform}>
        <rect
          x={0}
          y={0}
          width={rW}
          height={rH}
          fill="none"
          style={{ stroke: 'var(--color-accent)' }}
          strokeWidth={strokeWidth}
          strokeDasharray={`${dashLength},${dashLength}`}
        />
      </g>
    </g>
  );
}

// Invisible interaction layer for multi-select bounding box
// Note: No fill rect here - moving is handled by clicking on actual shapes
export function MultiSelectInteractionLayer({
  bounds,
  zoom = 1,
  onResizeStart,
  onRotateStart,
  onHandleHover,
}: Omit<MultiSelectInteractionLayerProps, 'onMoveStart'>) {
  // Scale sizes inversely with zoom
  const scale = 1 / zoom;
  const handleSize = BASE_HANDLE_SIZE * scale;
  const rotationPad = BASE_ROTATION_ZONE_PAD * scale;

  const resizeHandles = getResizeHandles(bounds.width, bounds.height);

  return (
    <g style={{ pointerEvents: 'all' }}>
      {/* Rotation corner zones — diagonal squares outside each corner */}
      {getRotationCorners(bounds.width, bounds.height, rotationPad).map((corner) => (
        <rect
          key={corner.id}
          x={bounds.x + corner.x}
          y={bounds.y + corner.y}
          width={rotationPad}
          height={rotationPad}
          fill="transparent"
          style={{ cursor: makeRotationCursor(getRotationCursorAngle(corner.id, false, false, 0)), touchAction: 'none' }}
          onMouseDown={onRotateStart}
          onTouchStart={onRotateStart}
          onMouseEnter={() => onHandleHover?.('rotate')}
          onMouseLeave={() => onHandleHover?.(null)}
        />
      ))}

      {/* Invisible resize handles (corners only) */}
      {resizeHandles.map((handle) => (
        <rect
          key={handle.id}
          x={bounds.x + handle.x - handleSize / 2}
          y={bounds.y + handle.y - handleSize / 2}
          width={handleSize}
          height={handleSize}
          fill="transparent"
          style={{ cursor: `${handle.id}-resize`, touchAction: 'none' }}
          onMouseDown={(e) => onResizeStart(e, handle.id)}
          onTouchStart={(e) => onResizeStart(e, handle.id)}
          onMouseEnter={() => onHandleHover?.(handle.id)}
          onMouseLeave={() => onHandleHover?.(null)}
        />
      ))}
    </g>
  );
}
