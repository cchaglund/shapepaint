// =============================================================================
// Shape Similarity Groups — single source of truth
// =============================================================================
// Used by the edge function to prevent similar shapes from appearing together
// in a daily challenge, and by the ShapeExplorer to visualize the groups.
//
// A shape CAN appear in multiple groups (e.g. crescent is in both "curved
// segments" and "curved pointed"). Two shapes are considered "too similar" if
// they share ANY group.
// =============================================================================

export interface ShapeSimilarityGroup {
  name: string;
  shapes: string[];
}

export const SHAPE_SIMILARITY_GROUPS: ShapeSimilarityGroup[] = [
  { name: 'Curved Segments', shapes: ['quarterCircle', 'semicircle', 'crescent', 'circle'] },
  { name: 'Triangular', shapes: ['triangle', 'rightTriangle', 'fang'] },
  { name: 'Curved Pointed', shapes: ['crescent', 'fin', 'claw', 'circle'] },
  { name: 'Concave/Convex', shapes: ['scoop', 'ridge'] },
  { name: 'Rectangular', shapes: ['square', 'parallelogram', 'trapezoid'] },
  { name: 'Oval', shapes: ['ellipse', 'bean', 'lens'] },
  { name: 'Regular Polygons', shapes: ['pentagon', 'hexagon', 'heptagon', 'kite', 'square'] },
];

/** Returns true if two shapes belong to any shared similarity group. */
export function areShapesTooSimilar(shape1: string, shape2: string): boolean {
  return SHAPE_SIMILARITY_GROUPS.some(
    (group) => group.shapes.includes(shape1) && group.shapes.includes(shape2)
  );
}
