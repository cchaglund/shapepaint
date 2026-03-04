import type { ShapeType } from '../../types';
import {
  getPolygonPoints,
  getStarPoints,
  getRightTrianglePoints,
  getIsoscelesTrianglePoints,
  getDiamondPoints,
  getTrapezoidPoints,
  getParallelogramPoints,
  getKitePoints,
  getCrossPoints,
  getArrowPoints,
  getShardPoints,
  getWedgePoints,
  getSplinterPoints,
  getChunkPoints,
} from './polygons';
import {
  getSemicirclePath,
  getQuarterCirclePath,
  getBladePath,
  getLensPath,
  getArchPath,
  getArchOutlinePath,
  getDropPath,
  getFanPath,
  getHookPath,
  getHookOutlinePath,
  getWavePath,
  getCrescentPath,
  getPillPath,
  getFangPath,
  getClawPath,
  getFinPath,
  getKeyholePath,
  getSlantPath,
  getNotchPath,
  getSpikePath,
  getBulgePath,
  getScoopPath,
  getRidgePath,
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
  isoscelesTriangle: 1,
  diamond: 1,
  trapezoid: 1,
  parallelogram: 1,
  kite: 1,
  heptagon: 1,
  cross: 1,
  arrow: 1,
  semicircle: 2, // wider than tall
  quarterCircle: 1,
  ellipse: 1.67, // wider than tall
  blade: 0.5, // taller than wide
  lens: 1.8, // wider than tall (thicker)
  arch: 1,
  drop: 0.7, // taller than wide
  // Irregular abstract shapes
  shard: 1,
  wedge: 1,
  fan: 1,
  hook: 1,
  wave: 2, // wider than tall
  crescent: 0.8, // taller than wide (thicker)
  pill: 2.5, // wider than tall
  splinter: 1,
  chunk: 1,
  // Mixed straight/curved shapes
  fang: 0.8, // slightly taller
  claw: 0.8,
  fin: 1,
  keyhole: 1,
  slant: 1,
  notch: 1,
  spike: 0.6, // taller than wide
  bulge: 1,
  scoop: 1.2, // slightly wider
  ridge: 1.3, // slightly wider
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

    case 'isoscelesTriangle':
      return {
        element: 'polygon' as const,
        props: { points: getIsoscelesTrianglePoints(size) },
        viewBox: { width, height },
      };

    case 'diamond':
      return {
        element: 'polygon' as const,
        props: { points: getDiamondPoints(size) },
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

    case 'blade':
      return {
        element: 'path' as const,
        props: { d: getBladePath(width, height) },
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

    case 'drop':
      return {
        element: 'path' as const,
        props: { d: getDropPath(width, height) },
        viewBox: { width, height },
      };

    case 'shard':
      return {
        element: 'polygon' as const,
        props: { points: getShardPoints(size) },
        viewBox: { width, height },
      };

    case 'wedge':
      return {
        element: 'polygon' as const,
        props: { points: getWedgePoints(size) },
        viewBox: { width, height },
      };

    case 'fan':
      return {
        element: 'path' as const,
        props: { d: getFanPath(size) },
        viewBox: { width, height },
      };

    case 'hook':
      return {
        element: 'path' as const,
        props: { d: getHookPath(size) },
        viewBox: { width, height },
        outlineD: getHookOutlinePath(size),
      };

    case 'wave':
      return {
        element: 'path' as const,
        props: { d: getWavePath(width, height) },
        viewBox: { width, height },
      };

    case 'crescent':
      return {
        element: 'path' as const,
        props: { d: getCrescentPath(width, height) },
        viewBox: { width, height },
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

    case 'chunk':
      return {
        element: 'polygon' as const,
        props: { points: getChunkPoints(size) },
        viewBox: { width, height },
      };

    case 'fang':
      return {
        element: 'path' as const,
        props: { d: getFangPath(width, height) },
        viewBox: { width, height },
      };

    case 'claw':
      return {
        element: 'path' as const,
        props: { d: getClawPath(width, height) },
        viewBox: { width, height },
      };

    case 'fin':
      return {
        element: 'path' as const,
        props: { d: getFinPath(size) },
        viewBox: { width, height },
      };

    case 'keyhole':
      return {
        element: 'path' as const,
        props: { d: getKeyholePath(size) },
        viewBox: { width, height },
      };

    case 'slant':
      return {
        element: 'path' as const,
        props: { d: getSlantPath(size) },
        viewBox: { width, height },
      };

    case 'notch':
      return {
        element: 'path' as const,
        props: { d: getNotchPath(size) },
        viewBox: { width, height },
      };

    case 'spike':
      return {
        element: 'path' as const,
        props: { d: getSpikePath(width, height) },
        viewBox: { width, height },
      };

    case 'bulge':
      return {
        element: 'path' as const,
        props: { d: getBulgePath(size) },
        viewBox: { width, height },
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

// Shape display names
export const SHAPE_NAMES: Record<ShapeType, string> = {
  circle: 'Circle',
  square: 'Square',
  triangle: 'Triangle',
  pentagon: 'Pentagon',
  hexagon: 'Hexagon',
  star: 'Star',
  // Sophisticated shapes
  rightTriangle: 'Right Triangle',
  isoscelesTriangle: 'Isosceles Triangle',
  diamond: 'Diamond',
  trapezoid: 'Trapezoid',
  parallelogram: 'Parallelogram',
  kite: 'Kite',
  heptagon: 'Heptagon',
  cross: 'Cross',
  arrow: 'Arrow',
  semicircle: 'Semicircle',
  quarterCircle: 'Quarter Circle',
  ellipse: 'Ellipse',
  blade: 'Blade',
  lens: 'Lens',
  arch: 'Arch',
  drop: 'Drop',
  // Irregular abstract shapes
  shard: 'Shard',
  wedge: 'Wedge',
  fan: 'Fan',
  hook: 'Hook',
  wave: 'Wave',
  crescent: 'Crescent',
  pill: 'Pill',
  splinter: 'Splinter',
  chunk: 'Chunk',
  // Mixed straight/curved shapes
  fang: 'Fang',
  claw: 'Claw',
  fin: 'Fin',
  keyhole: 'Keyhole',
  slant: 'Slant',
  notch: 'Notch',
  spike: 'Spike',
  bulge: 'Bulge',
  scoop: 'Scoop',
  ridge: 'Ridge',
};
