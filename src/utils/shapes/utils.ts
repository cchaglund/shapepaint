import type { ShapeType } from '../../types';
import {
  getPolygonPoints,
  getStarPoints,
  getRightTrianglePoints,
  getTrapezoidPoints,
  getParallelogramPoints,
  getKitePoints,
  getCrossPoints,
  getArrowPoints,
  getWedgePoints,
  getSplinterPoints,
} from './polygons';
import {
  getSemicirclePath,
  getQuarterCirclePath,
  getLensPath,
  getArchPath,
  getArchOutlinePath,
  getWavePath,
  getHookPath,
  CLAW_PATH,
  CLAW_NATIVE_VIEWBOX,
  CRESCENT_PATH,
  CRESCENT_NATIVE_VIEWBOX,
  getPillPath,
  getFangPath,
  FIN_PATH,
  FIN_NATIVE_VIEWBOX,
  getKeyholePath,
  getNotchPath,
  DROP_PATH,
  DROP_NATIVE_VIEWBOX,
  getScoopPath,
  getRidgePath,
  BEAN_PATH,
  BEAN_NATIVE_VIEWBOX,
  HOURGLASS_PATH,
  HOURGLASS_NATIVE_VIEWBOX,
} from './paths';

// Shape aspect ratios (width:height) - 1 means square
// Values > 1 mean wider than tall, < 1 mean taller than wide
export const SHAPE_ASPECT_RATIOS: Record<ShapeType, number> = {
  // Basic shapes - square
  circle: 1,
  square: 1,
  triangle: 1,
  pentagon: 1,
  hexagon: 1,
  star: 1,
  // Sophisticated shapes
  rightTriangle: 1,
  trapezoid: 1,
  parallelogram: 1,
  kite: 1,
  heptagon: 1,
  cross: 1,
  arrow: 1,
  semicircle: 2, // wider than tall
  quarterCircle: 1,
  ellipse: 1.67, // wider than tall
  lens: 1.8, // wider than tall (thicker)
  arch: 1,
  // Irregular abstract shapes
  wedge: 1,
  wave: 1,
  hook: 1,
  crescent: CRESCENT_NATIVE_VIEWBOX.width / CRESCENT_NATIVE_VIEWBOX.height, // match Figma export
  pill: 2.5, // wider than tall
  splinter: 1,
  // Mixed straight/curved shapes
  fang: 0.8, // slightly taller
  fin: FIN_NATIVE_VIEWBOX.width / FIN_NATIVE_VIEWBOX.height, // match Figma export
  keyhole: 1,
  notch: 1,
  drop: DROP_NATIVE_VIEWBOX.width / DROP_NATIVE_VIEWBOX.height, // match Figma export
  scoop: 1.2, // slightly wider
  ridge: 1.3, // slightly wider
  bean: BEAN_NATIVE_VIEWBOX.width / BEAN_NATIVE_VIEWBOX.height, // match Figma export
  hourglass: HOURGLASS_NATIVE_VIEWBOX.width / HOURGLASS_NATIVE_VIEWBOX.height, // match Figma export
  claw: CLAW_NATIVE_VIEWBOX.width / CLAW_NATIVE_VIEWBOX.height, // match Figma export
};

// Get SVG path/element data for each shape type
// Returns element type, props, and viewBox dimensions
export function getShapeSVGData(type: ShapeType, size: number) {
  const aspectRatio = SHAPE_ASPECT_RATIOS[type] || 1;
  // Size represents the larger dimension
  const width = aspectRatio >= 1 ? size : size * aspectRatio;
  const height = aspectRatio >= 1 ? size / aspectRatio : size;

  switch (type) {
    case 'circle':
      return {
        element: 'ellipse' as const,
        props: {
          cx: width / 2,
          cy: height / 2,
          rx: width / 2,
          ry: height / 2,
        },
        viewBox: { width, height },
      };

    case 'square':
      return {
        element: 'rect' as const,
        props: { x: 0, y: 0, width, height },
        viewBox: { width, height },
      };

    case 'triangle': {
      const tri = getPolygonPoints(3, size);
      return {
        element: 'polygon' as const,
        props: { points: tri.points },
        viewBox: { width: tri.width, height: tri.height },
      };
    }

    case 'pentagon': {
      const pent = getPolygonPoints(5, size);
      return {
        element: 'polygon' as const,
        props: { points: pent.points },
        viewBox: { width: pent.width, height: pent.height },
      };
    }

    case 'hexagon': {
      const hex = getPolygonPoints(6, size);
      return {
        element: 'polygon' as const,
        props: { points: hex.points },
        viewBox: { width: hex.width, height: hex.height },
      };
    }

    case 'star': {
      const star = getStarPoints(size);
      return {
        element: 'polygon' as const,
        props: { points: star.points },
        viewBox: { width: star.width, height: star.height },
      };
    }

    case 'rightTriangle':
      return {
        element: 'polygon' as const,
        props: { points: getRightTrianglePoints(size) },
        viewBox: { width, height },
      };

    case 'trapezoid':
      return {
        element: 'polygon' as const,
        props: { points: getTrapezoidPoints(size) },
        viewBox: { width, height },
      };

    case 'parallelogram':
      return {
        element: 'polygon' as const,
        props: { points: getParallelogramPoints(size) },
        viewBox: { width, height },
      };

    case 'kite':
      return {
        element: 'polygon' as const,
        props: { points: getKitePoints(size) },
        viewBox: { width, height },
      };

    case 'heptagon': {
      const hept = getPolygonPoints(7, size);
      return {
        element: 'polygon' as const,
        props: { points: hept.points },
        viewBox: { width: hept.width, height: hept.height },
      };
    }

    case 'cross':
      return {
        element: 'polygon' as const,
        props: { points: getCrossPoints(size) },
        viewBox: { width, height },
      };

    case 'arrow':
      return {
        element: 'polygon' as const,
        props: { points: getArrowPoints(size) },
        viewBox: { width, height },
      };

    case 'semicircle':
      return {
        element: 'path' as const,
        props: { d: getSemicirclePath(width, height) },
        viewBox: { width, height },
      };

    case 'quarterCircle':
      return {
        element: 'path' as const,
        props: { d: getQuarterCirclePath(size) },
        viewBox: { width, height },
      };

    case 'ellipse':
      return {
        element: 'ellipse' as const,
        props: { cx: width / 2, cy: height / 2, rx: width / 2, ry: height / 2 },
        viewBox: { width, height },
      };

    case 'lens':
      return {
        element: 'path' as const,
        props: { d: getLensPath(width, height) },
        viewBox: { width, height },
      };

    case 'arch':
      return {
        element: 'path' as const,
        props: { d: getArchPath(size) },
        viewBox: { width, height },
        outlineD: getArchOutlinePath(size),
      };

    case 'wedge':
      return {
        element: 'polygon' as const,
        props: { points: getWedgePoints(size) },
        viewBox: { width, height },
      };

    case 'wave':
      return {
        element: 'path' as const,
        props: { d: getWavePath(size) },
        viewBox: { width, height },
      };

    case 'hook':
      return {
        element: 'path' as const,
        props: { d: getHookPath(size) },
        viewBox: { width, height },
      };

    case 'crescent':
      return {
        element: 'path' as const,
        props: { d: CRESCENT_PATH },
        viewBox: CRESCENT_NATIVE_VIEWBOX,
        dimensions: { width, height },
      };

    case 'pill':
      return {
        element: 'path' as const,
        props: { d: getPillPath(width, height) },
        viewBox: { width, height },
      };

    case 'splinter':
      return {
        element: 'polygon' as const,
        props: { points: getSplinterPoints(size) },
        viewBox: { width, height },
      };

    case 'fang':
      return {
        element: 'path' as const,
        props: { d: getFangPath(width, height) },
        viewBox: { width, height },
      };

    case 'fin':
      return {
        element: 'path' as const,
        props: { d: FIN_PATH },
        viewBox: FIN_NATIVE_VIEWBOX,
        dimensions: { width, height },
      };

    case 'keyhole':
      return {
        element: 'path' as const,
        props: { d: getKeyholePath(size) },
        viewBox: { width, height },
      };

    case 'notch':
      return {
        element: 'path' as const,
        props: { d: getNotchPath(size) },
        viewBox: { width, height },
      };

    case 'drop':
      return {
        element: 'path' as const,
        props: { d: DROP_PATH },
        viewBox: DROP_NATIVE_VIEWBOX,
        dimensions: { width, height },
      };

    case 'scoop':
      return {
        element: 'path' as const,
        props: { d: getScoopPath(width, height) },
        viewBox: { width, height },
      };

    case 'ridge':
      return {
        element: 'path' as const,
        props: { d: getRidgePath(width, height) },
        viewBox: { width, height },
      };

    case 'bean':
      return {
        element: 'path' as const,
        props: { d: BEAN_PATH },
        viewBox: BEAN_NATIVE_VIEWBOX,
        dimensions: { width, height },
      };

    case 'hourglass':
      return {
        element: 'path' as const,
        props: { d: HOURGLASS_PATH },
        viewBox: HOURGLASS_NATIVE_VIEWBOX,
        dimensions: { width, height },
      };

    case 'claw':
      return {
        element: 'path' as const,
        props: { d: CLAW_PATH },
        viewBox: CLAW_NATIVE_VIEWBOX,
        dimensions: { width, height },
      };

    default:
      return {
        element: 'rect' as const,
        props: { x: 0, y: 0, width: size, height: size },
        viewBox: { width: size, height: size },
      };
  }
}

// Get actual rendered dimensions for a shape (accounting for non-square viewBoxes)
export function getShapeDimensions(type: ShapeType, size: number): { width: number; height: number } {
  // Polygon shapes compute their own viewBox dimensions via getPolygonPoints/getStarPoints
  switch (type) {
    case 'triangle':
      return pickDims(getPolygonPoints(3, size));
    case 'pentagon':
      return pickDims(getPolygonPoints(5, size));
    case 'hexagon':
      return pickDims(getPolygonPoints(6, size));
    case 'heptagon':
      return pickDims(getPolygonPoints(7, size));
    case 'star':
      return pickDims(getStarPoints(size));
    default: {
      const aspectRatio = SHAPE_ASPECT_RATIOS[type] || 1;
      const width = aspectRatio >= 1 ? size : size * aspectRatio;
      const height = aspectRatio >= 1 ? size / aspectRatio : size;
      return { width, height };
    }
  }
}

function pickDims(v: { width: number; height: number }) {
  return { width: v.width, height: v.height };
}

// Generate a unique ID
export function generateId(): string {
  return `shape-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Shape display names — re-exported from the single source of truth
export { SHAPE_NAMES } from '../../../supabase/functions/_shared/shapes';
