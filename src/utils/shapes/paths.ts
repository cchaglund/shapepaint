// Path/bezier generators for curved and mixed straight/curved shapes

// Generate semicircle path (fills full width and height)
export function getSemicirclePath(width: number, height: number): string {
  return `M 0,${height} A ${width / 2},${height} 0 0 1 ${width},${height} L 0,${height} Z`;
}

// Generate quarter circle path
export function getQuarterCirclePath(size: number): string {
  return `M 0,0 L ${size},0 A ${size},${size} 0 0 1 0,${size} L 0,0 Z`;
}

// Generate blade/leaf path (curved asymmetric shape)
export function getBladePath(width: number, height: number): string {
  // Blade/leaf shape - elliptical with pointed ends, filling bounding box
  // Control points at edges make the curves bulge to touch the left/right edges
  return `M ${width / 2},0 Q ${width},${height * 0.25} ${width},${height / 2} Q ${width},${height * 0.75} ${width / 2},${height} Q 0,${height * 0.75} 0,${height / 2} Q 0,${height * 0.25} ${width / 2},0 Z`;
}

// Generate lens (vesica piscis) path
export function getLensPath(width: number, height: number): string {
  // Lens shape - curves go through top/bottom center points
  // Use two arcs per side to ensure the shape touches y=0 and y=height at center
  return `M 0,${height / 2} Q ${width * 0.25},0 ${width / 2},0 Q ${width * 0.75},0 ${width},${height / 2} Q ${width * 0.75},${height} ${width / 2},${height} Q ${width * 0.25},${height} 0,${height / 2} Z`;
}

// Generate arch path
export function getArchPath(size: number): string {
  // Arch normalized to fill bounding box (y range 0-1 instead of 0.4-1)
  const archWidth = size * 0.3;
  const innerWidth = size - archWidth * 2;
  const innerRadius = innerWidth / 2;
  const outerRadius = size / 2;
  // Scale y coordinates: newY = (oldY - 0.4) / 0.6
  return `M 0,${size} L 0,0 A ${outerRadius},${outerRadius * 0.6} 0 0 1 ${size},0 L ${size},${size} L ${size - archWidth},${size} L ${size - archWidth},${size * 0.25} A ${innerRadius},${innerRadius * 0.6} 0 0 0 ${archWidth},${size * 0.25} L ${archWidth},${size} Z`;
}

// Outer-only outline for arch (no inner cutout stroke)
export function getArchOutlinePath(size: number): string {
  const outerRadius = size / 2;
  return `M 0,${size} L 0,0 A ${outerRadius},${outerRadius * 0.6} 0 0 1 ${size},0 L ${size},${size} Z`;
}

// Generate teardrop/drop path (smooth curve using cubic bezier)
export function getDropPath(width: number, height: number): string {
  // Drop/leaf shape - pointed ends with curves touching left/right edges
  return `M ${width / 2},0 Q ${width},${height * 0.25} ${width},${height / 2} Q ${width},${height * 0.75} ${width / 2},${height} Q 0,${height * 0.75} 0,${height / 2} Q 0,${height * 0.25} ${width / 2},0 Z`;
}

// Generate fan - spread-out curved shape
export function getFanPath(size: number): string {
  // Original went from x: 0.1 to 1.0, y: 0 to 1.0
  // Normalize to fill 0-size: scale x by 1/0.9, offset by -0.1/0.9
  return `M 0,${size} Q 0,${size * 0.444} ${size * 0.444},${size * 0.111} L ${size},0 Q ${size * 0.556},${size * 0.444} ${size * 0.889},${size} Z`;
}

// Generate hook - curved hook shape
export function getHookPath(size: number): string {
  // Original x range: 0.3 to 1.0 (width 0.7), normalize to 0-1
  // Transform: newX = (oldX - 0.3) / 0.7
  return `M 0,0 L ${size * 0.286},0 Q ${size},0 ${size},${size * 0.4} Q ${size},${size * 0.7} ${size * 0.429},${size * 0.7} L ${size * 0.429},${size} L 0,${size} L 0,${size * 0.5} Q 0,${size * 0.2} ${size * 0.429},${size * 0.2} Q ${size * 0.643},${size * 0.2} ${size * 0.643},${size * 0.4} Q ${size * 0.643},${size * 0.5} ${size * 0.429},${size * 0.5} L 0,${size * 0.5} Z`;
}

// Outer-only outline for hook (no inner hole stroke)
export function getHookOutlinePath(size: number): string {
  return `M 0,0 L ${size * 0.286},0 Q ${size},0 ${size},${size * 0.4} Q ${size},${size * 0.7} ${size * 0.429},${size * 0.7} L ${size * 0.429},${size} L 0,${size} L 0,${size * 0.5} Z`;
}

// Generate wave - flowing wave shape
export function getWavePath(width: number, height: number): string {
  // Wave shape - top edge passes through y=0 at 25%, bottom edge passes through y=height at 75%
  // Split curves to go through the actual edge points
  return `M 0,${height * 0.4} Q ${width * 0.125},0 ${width * 0.25},0 Q ${width * 0.375},0 ${width * 0.5},${height * 0.4} Q ${width * 0.625},${height * 0.8} ${width * 0.75},${height * 0.4} Q ${width * 0.875},0 ${width},${height * 0.4} L ${width},${height * 0.6} Q ${width * 0.875},${height} ${width * 0.75},${height} Q ${width * 0.625},${height} ${width * 0.5},${height * 0.6} Q ${width * 0.375},${height * 0.2} ${width * 0.25},${height * 0.6} Q ${width * 0.125},${height} 0,${height * 0.6} Z`;
}

// Generate crescent - moon crescent shape
export function getCrescentPath(width: number, height: number): string {
  // Crescent moon shape filling bounding box
  // Outer curve passes through x=0 at middle, inner curve creates the crescent hollow
  // Split into segments so outer curve actually touches the left edge
  return `M ${width},0 Q ${width * 0.3},0 0,${height * 0.5} Q ${width * 0.3},${height} ${width},${height} Q ${width * 0.5},${height * 0.5} ${width},0 Z`;
}

// Generate pill - rounded rectangle (horizontal, fills bounding box)
export function getPillPath(width: number, height: number): string {
  // Horizontal pill shape with rounded ends, filling the full dimensions
  const r = height / 2;
  return `M ${r},0 L ${width - r},0 A ${r},${r} 0 0 1 ${width - r},${height} L ${r},${height} A ${r},${r} 0 0 1 ${r},0 Z`;
}

// Generate fang - pointed shape with curved back
export function getFangPath(width: number, height: number): string {
  // Fang shape filling full bounding box
  return `M 0,0 L ${width},0 L ${width * 0.5},${height} Q 0,${height * 0.5} 0,0 Z`;
}

// Generate claw - curved talon/hook shape
export function getClawPath(width: number, height: number): string {
  // Claw shape: curved talon pointing up-right, thick base at bottom-left
  // Outer edge curves from bottom-left up to pointed tip at top-right
  // Inner edge creates the hook/claw thickness
  return `M 0,${height} L 0,${height * 0.7} Q 0,${height * 0.3} ${width * 0.3},${height * 0.15} Q ${width * 0.6},0 ${width},0 L ${width * 0.7},${height * 0.2} Q ${width * 0.4},${height * 0.25} ${width * 0.25},${height * 0.5} Q ${width * 0.15},${height * 0.7} ${width * 0.4},${height} Z`;
}

// Generate fin - angular with one curved edge
export function getFinPath(size: number): string {
  // Fin shape normalized to fill bounding box
  return `M 0,${size} L ${size * 0.35},${size * 0.7} L ${size * 0.25},${size * 0.2} L ${size},0 Q ${size},${size * 0.5} ${size * 0.85},${size} Z`;
}

// Generate keyhole - sharp point with curved sides
export function getKeyholePath(size: number): string {
  // Original x range: 0.1 to 0.9 (width 0.8), normalize to 0-1
  // Transform: newX = (oldX - 0.1) / 0.8
  return `M ${size * 0.5},0 Q ${size * 0.875},${size * 0.3} ${size * 0.75},${size * 0.6} L ${size},${size} L 0,${size} L ${size * 0.25},${size * 0.6} Q ${size * 0.125},${size * 0.3} ${size * 0.5},0 Z`;
}

// Generate slant - parallelogram with one curved side
export function getSlantPath(size: number): string {
  return `M ${size * 0.3},0 L ${size},0 L ${size * 0.7},${size} L 0,${size} Q ${size * 0.1},${size * 0.5} ${size * 0.3},0 Z`;
}

// Generate notch - angular shape with curved indent
export function getNotchPath(size: number): string {
  // Original y range: 0 to 0.6, normalize to fill full height
  // Transform: newY = oldY / 0.6
  return `M 0,0 L ${size},0 L ${size},${size} Q ${size * 0.5},${size * 0.667} 0,${size} L 0,0 Z`;
}

// Generate spike - tall narrow with curved base
export function getSpikePath(width: number, height: number): string {
  // Spike/teardrop shape - pointed top, rounded bottom filling bounding box
  return `M ${width / 2},0 L ${width},${height * 0.55} Q ${width},${height} ${width / 2},${height} Q 0,${height} 0,${height * 0.55} L ${width / 2},0 Z`;
}

// Generate bulge - angular corners with curved middle
export function getBulgePath(size: number): string {
  return `M ${size * 0.2},0 L ${size * 0.8},0 L ${size},${size * 0.3} Q ${size * 0.9},${size * 0.7} ${size * 0.7},${size} L ${size * 0.3},${size} Q ${size * 0.1},${size * 0.7} 0,${size * 0.3} L ${size * 0.2},0 Z`;
}

// Generate scoop - angular top with curved bottom
export function getScoopPath(width: number, height: number): string {
  // Scoop shape - flat angular top, curved bottom passing through y=height at center
  // Split the bottom curve so it actually touches y=height
  return `M 0,${height * 0.1} L ${width * 0.3},0 L ${width * 0.7},0 L ${width},${height * 0.1} L ${width},${height * 0.3} Q ${width * 0.75},${height} ${width / 2},${height} Q ${width * 0.25},${height} 0,${height * 0.3} L 0,${height * 0.1} Z`;
}

// Generate ridge - zigzag top with curved bottom
export function getRidgePath(width: number, height: number): string {
  // Ridge shape filling bounding box
  return `M 0,${height * 0.333} L ${width * 0.25},0 L ${width * 0.5},${height * 0.222} L ${width * 0.75},0 L ${width},${height * 0.333} Q ${width * 0.8},${height} ${width * 0.5},${height} Q ${width * 0.2},${height} 0,${height * 0.333} Z`;
}
