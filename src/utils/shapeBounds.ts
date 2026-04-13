import type { Shape } from '../types';
import { getShapeDimensions, getShapeSVGData } from './shapes';

interface AABB {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

type Pt = { x: number; y: number };

/** Parse an SVG points string ("x,y x,y …") into an array of {x,y}. */
function parsePoints(s: string): Pt[] {
  return s.split(/\s+/).map((pair) => {
    const [x, y] = pair.split(',').map(Number);
    return { x, y };
  });
}

// ── Curve sampling helpers ─────────────────────────────────────────

/** Sample n+1 evenly-spaced points along a quadratic Bézier (p0 → cp → p2). */
function sampleQuadratic(p0: Pt, cp: Pt, p2: Pt, n: number): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, mt = 1 - t;
    pts.push({
      x: mt * mt * p0.x + 2 * mt * t * cp.x + t * t * p2.x,
      y: mt * mt * p0.y + 2 * mt * t * cp.y + t * t * p2.y,
    });
  }
  return pts;
}

/** Sample n+1 evenly-spaced points along a cubic Bézier (p0 → p1 → p2 → p3). */
function sampleCubic(p0: Pt, p1: Pt, p2: Pt, p3: Pt, n: number): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, mt = 1 - t;
    pts.push({
      x: mt * mt * mt * p0.x + 3 * mt * mt * t * p1.x + 3 * mt * t * t * p2.x + t * t * t * p3.x,
      y: mt * mt * mt * p0.y + 3 * mt * mt * t * p1.y + 3 * mt * t * t * p2.y + t * t * t * p3.y,
    });
  }
  return pts;
}

/** Signed angle (radians) from vector (ux,uy) to (vx,vy). */
function vectorAngle(ux: number, uy: number, vx: number, vy: number): number {
  const dot = ux * vx + uy * vy;
  const len = Math.sqrt(ux * ux + uy * uy) * Math.sqrt(vx * vx + vy * vy);
  let a = Math.acos(Math.max(-1, Math.min(1, dot / len)));
  if (ux * vy - uy * vx < 0) a = -a;
  return a;
}

/**
 * Sample n+1 points along an SVG elliptical arc.
 * Converts endpoint parameterisation (SVG spec §F.6.5–6.6) to centre
 * parameterisation, then evaluates at evenly-spaced angles.
 */
function sampleArc(
  x1: number, y1: number,
  rxIn: number, ryIn: number,
  xRotDeg: number, largeArc: number, sweep: number,
  x2: number, y2: number,
  n: number,
): Pt[] {
  let rx = Math.abs(rxIn), ry = Math.abs(ryIn);
  if (rx === 0 || ry === 0) return [{ x: x2, y: y2 }];

  const phi = (xRotDeg * Math.PI) / 180;
  const cosPhi = Math.cos(phi), sinPhi = Math.sin(phi);

  const dx = (x1 - x2) / 2, dy = (y1 - y2) / 2;
  const x1p = cosPhi * dx + sinPhi * dy;
  const y1p = -sinPhi * dx + cosPhi * dy;

  const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lambda > 1) { const s = Math.sqrt(lambda); rx *= s; ry *= s; }

  const rxSq = rx * rx, rySq = ry * ry;
  let sq = Math.max(0,
    (rxSq * rySq - rxSq * y1p * y1p - rySq * x1p * x1p) /
    (rxSq * y1p * y1p + rySq * x1p * x1p));
  sq = Math.sqrt(sq) * (largeArc === sweep ? -1 : 1);

  const cxp = sq * rx * y1p / ry;
  const cyp = -sq * ry * x1p / rx;
  const cx = cosPhi * cxp - sinPhi * cyp + (x1 + x2) / 2;
  const cy = sinPhi * cxp + cosPhi * cyp + (y1 + y2) / 2;

  const theta1 = vectorAngle(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let dTheta = vectorAngle(
    (x1p - cxp) / rx, (y1p - cyp) / ry,
    (-x1p - cxp) / rx, (-y1p - cyp) / ry,
  );
  if (sweep === 0 && dTheta > 0) dTheta -= 2 * Math.PI;
  if (sweep === 1 && dTheta < 0) dTheta += 2 * Math.PI;

  const pts: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const a = theta1 + dTheta * (i / n);
    const ex = rx * Math.cos(a), ey = ry * Math.sin(a);
    pts.push({ x: cosPhi * ex - sinPhi * ey + cx, y: sinPhi * ex + cosPhi * ey + cy });
  }
  return pts;
}

// ── SVG path → sample points ───────────────────────────────────────

const PATH_CMD_RE = /([MLHVCQAZmlhvcqaz])\s*([^MLHVCQAZmlhvcqaz]*)/g;

/** Extract representative boundary points from an SVG path `d` string. */
function samplePathPoints(d: string): Pt[] {
  const pts: Pt[] = [];
  let x = 0, y = 0, sx = 0, sy = 0;

  let m;
  PATH_CMD_RE.lastIndex = 0;
  while ((m = PATH_CMD_RE.exec(d)) !== null) {
    const cmd = m[1];
    const args = m[2].trim() ? m[2].trim().split(/[\s,]+/).map(Number) : [];

    switch (cmd) {
      case 'M':
        x = args[0]; y = args[1]; sx = x; sy = y;
        pts.push({ x, y });
        for (let i = 2; i + 1 < args.length; i += 2) { x = args[i]; y = args[i + 1]; pts.push({ x, y }); }
        break;
      case 'L':
        for (let i = 0; i + 1 < args.length; i += 2) { x = args[i]; y = args[i + 1]; pts.push({ x, y }); }
        break;
      case 'H':
        for (const v of args) { x = v; pts.push({ x, y }); }
        break;
      case 'V':
        for (const v of args) { y = v; pts.push({ x, y }); }
        break;
      case 'Q':
        for (let i = 0; i + 3 < args.length; i += 4) {
          pts.push(...sampleQuadratic({ x, y }, { x: args[i], y: args[i + 1] }, { x: args[i + 2], y: args[i + 3] }, 6));
          x = args[i + 2]; y = args[i + 3];
        }
        break;
      case 'C':
        for (let i = 0; i + 5 < args.length; i += 6) {
          pts.push(...sampleCubic({ x, y }, { x: args[i], y: args[i + 1] }, { x: args[i + 2], y: args[i + 3] }, { x: args[i + 4], y: args[i + 5] }, 8));
          x = args[i + 4]; y = args[i + 5];
        }
        break;
      case 'A':
        for (let i = 0; i + 6 < args.length; i += 7) {
          pts.push(...sampleArc(x, y, args[i], args[i + 1], args[i + 2], args[i + 3], args[i + 4], args[i + 5], args[i + 6], 12));
          x = args[i + 5]; y = args[i + 6];
        }
        break;
      case 'Z': case 'z':
        x = sx; y = sy;
        break;
    }
  }
  return pts;
}

// ── Shape geometry → local-space boundary points ───────────────────

/**
 * Return representative boundary points for a shape's actual geometry
 * (polygon vertices, ellipse perimeter, path outline) in local render space.
 * Much tighter than using bounding-rect corners for non-rectangular shapes.
 */
function getShapeGeometryPoints(shape: Shape): Pt[] {
  const svgData = getShapeSVGData(shape.type, shape.size);
  const { viewBox } = svgData;
  const dimensions = 'dimensions' in svgData ? (svgData.dimensions as { width: number; height: number } | undefined) : undefined;
  let points: Pt[];

  switch (svgData.element) {
    case 'polygon':
      points = parsePoints(svgData.props.points as string);
      break;

    case 'ellipse': {
      const p = svgData.props as { cx: number; cy: number; rx: number; ry: number };
      points = [];
      for (let i = 0; i < 24; i++) {
        const a = (2 * Math.PI * i) / 24;
        points.push({ x: p.cx + p.rx * Math.cos(a), y: p.cy + p.ry * Math.sin(a) });
      }
      break;
    }

    case 'rect': {
      const p = svgData.props as { x: number; y: number; width: number; height: number };
      points = [
        { x: p.x, y: p.y }, { x: p.x + p.width, y: p.y },
        { x: p.x + p.width, y: p.y + p.height }, { x: p.x, y: p.y + p.height },
      ];
      break;
    }

    case 'path':
      points = samplePathPoints(svgData.props.d as string);
      break;

    default:
      points = [
        { x: 0, y: 0 }, { x: viewBox.width, y: 0 },
        { x: viewBox.width, y: viewBox.height }, { x: 0, y: viewBox.height },
      ];
  }

  // Scale from native viewBox to render dimensions for fixed-viewBox shapes
  if (dimensions) {
    const kx = dimensions.width / viewBox.width;
    const ky = dimensions.height / viewBox.height;
    points = points.map(p => ({ x: p.x * kx, y: p.y * ky }));
  }

  return points;
}

// ── AABB computation ───────────────────────────────────────────────

/**
 * Compute the axis-aligned bounding box of a shape's actual geometry,
 * accounting for rotation and flip. Uses real shape vertices / curve
 * samples instead of bounding-rect corners, producing tight bounds for
 * stars, arcs, polygons, and other non-rectangular shapes.
 */
export function getShapeAABB(shape: Shape): AABB {
  const points = getShapeGeometryPoints(shape);
  const dims = getShapeDimensions(shape.type, shape.size);
  const cx = dims.width / 2;
  const cy = dims.height / 2;
  const angleRad = (shape.rotation * Math.PI) / 180;
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  const flipX = shape.flipX ? -1 : 1;
  const flipY = shape.flipY ? -1 : 1;

  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;

  for (const p of points) {
    const rx = (p.x - cx) * cos - (p.y - cy) * sin;
    const ry = (p.x - cx) * sin + (p.y - cy) * cos;
    const fx = shape.x + cx + flipX * rx;
    const fy = shape.y + cy + flipY * ry;
    minX = Math.min(minX, fx);
    minY = Math.min(minY, fy);
    maxX = Math.max(maxX, fx);
    maxY = Math.max(maxY, fy);
  }

  return { minX, minY, maxX, maxY };
}

/**
 * Check if two axis-aligned bounding boxes overlap (partial or full).
 */
export function rectsIntersect(a: AABB, b: AABB): boolean {
  return a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;
}

// ── Helpers for polygon / circle vs rectangle intersection ───────────

/** Point-in-polygon via ray-casting (works for convex & concave). */
function pointInPolygon(pt: Pt, poly: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const yi = poly[i].y, yj = poly[j].y;
    if ((yi > pt.y) !== (yj > pt.y) &&
        pt.x < ((poly[j].x - poly[i].x) * (pt.y - yi)) / (yj - yi) + poly[i].x) {
      inside = !inside;
    }
  }
  return inside;
}

/** Do two line segments (p1→p2) and (p3→p4) cross? */
function segmentsIntersect(p1: Pt, p2: Pt, p3: Pt, p4: Pt): boolean {
  const d1x = p2.x - p1.x, d1y = p2.y - p1.y;
  const d2x = p4.x - p3.x, d2y = p4.y - p3.y;
  const denom = d1x * d2y - d1y * d2x;
  if (Math.abs(denom) < 1e-10) return false;
  const t = ((p3.x - p1.x) * d2y - (p3.y - p1.y) * d2x) / denom;
  const u = ((p3.x - p1.x) * d1y - (p3.y - p1.y) * d1x) / denom;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

/** Does an arbitrary polygon intersect an AABB? */
function polygonIntersectsRect(poly: Pt[], rect: AABB): boolean {
  const rc: Pt[] = [
    { x: rect.minX, y: rect.minY },
    { x: rect.maxX, y: rect.minY },
    { x: rect.maxX, y: rect.maxY },
    { x: rect.minX, y: rect.maxY },
  ];

  // 1. Any polygon vertex inside rect?
  for (const v of poly) {
    if (v.x >= rect.minX && v.x <= rect.maxX && v.y >= rect.minY && v.y <= rect.maxY) return true;
  }
  // 2. Any rect corner inside polygon?
  for (const c of rc) {
    if (pointInPolygon(c, poly)) return true;
  }
  // 3. Any edges cross?
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    for (let j = 0; j < 4; j++) {
      if (segmentsIntersect(a, b, rc[j], rc[(j + 1) % 4])) return true;
    }
  }
  return false;
}

/** Does a circle (center + radius) intersect an AABB? */
function circleIntersectsRect(center: Pt, r: number, rect: AABB): boolean {
  const closestX = Math.max(rect.minX, Math.min(center.x, rect.maxX));
  const closestY = Math.max(rect.minY, Math.min(center.y, rect.maxY));
  const dx = center.x - closestX;
  const dy = center.y - closestY;
  return dx * dx + dy * dy <= r * r;
}

// ── Public: accurate shape-vs-rect test ─────────────────────────────

/**
 * Test if a shape's *actual geometry* (polygon, circle, or OBB fallback)
 * intersects an axis-aligned rectangle.
 */
export function shapeIntersectsRect(shape: Shape, rect: AABB): boolean {
  const svgData = getShapeSVGData(shape.type, shape.size);
  const { width, height } = svgData.dimensions ?? svgData.viewBox;
  const cx = width / 2;
  const cy = height / 2;
  const angleRad = (shape.rotation * Math.PI) / 180;
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);

  /** Transform a local-space point to world/canvas coordinates. */
  const toWorld = (lx: number, ly: number): Pt => {
    const rx = (lx - cx) * cos - (ly - cy) * sin;
    const ry = (lx - cx) * sin + (ly - cy) * cos;
    return { x: shape.x + cx + rx, y: shape.y + cy + ry };
  };

  // ── Polygon shapes: use actual vertices ───────────────────────────
  if (svgData.element === 'polygon') {
    const verts = parsePoints(svgData.props.points as string).map((p) => toWorld(p.x, p.y));
    return polygonIntersectsRect(verts, rect);
  }

  // ── Circle / ellipse ──────────────────────────────────────────────
  if (svgData.element === 'ellipse') {
    const props = svgData.props as { cx: number; cy: number; rx: number; ry: number };
    // True circle: rotation-invariant, use fast circle test
    if (Math.abs(props.rx - props.ry) < 0.01) {
      const center = toWorld(props.cx, props.cy);
      return circleIntersectsRect(center, props.rx, rect);
    }
    // Ellipse: approximate as 16-gon
    const verts: Pt[] = [];
    for (let i = 0; i < 16; i++) {
      const a = (2 * Math.PI * i) / 16;
      verts.push(toWorld(props.cx + props.rx * Math.cos(a), props.cy + props.ry * Math.sin(a)));
    }
    return polygonIntersectsRect(verts, rect);
  }

  // ── Rect and path shapes: fall back to OBB (rotated bounding rect) ─
  const hw = width / 2;
  const hh = height / 2;
  const wcx = shape.x + hw;
  const wcy = shape.y + hh;
  const obb: Pt[] = [
    { x: wcx + (-hw * cos - -hh * sin), y: wcy + (-hw * sin + -hh * cos) },
    { x: wcx + (hw * cos - -hh * sin), y: wcy + (hw * sin + -hh * cos) },
    { x: wcx + (hw * cos - hh * sin), y: wcy + (hw * sin + hh * cos) },
    { x: wcx + (-hw * cos - hh * sin), y: wcy + (-hw * sin + hh * cos) },
  ];
  return polygonIntersectsRect(obb, rect);
}
