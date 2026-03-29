// Path/bezier generators for curved and mixed straight/curved shapes

// Generate semicircle path (fills full width and height)
export function getSemicirclePath(width: number, height: number): string {
  return `M 0,${height} A ${width / 2},${height} 0 0 1 ${width},${height} L 0,${height} Z`;
}

// Generate quarter circle path
export function getQuarterCirclePath(size: number): string {
  return `M 0,0 L ${size},0 A ${size},${size} 0 0 1 0,${size} L 0,0 Z`;
}

// Generate lens (vesica piscis) path
export function getLensPath(width: number, height: number): string {
  // Lens shape - curves go through top/bottom center points
  return `M 0,${height / 2} Q ${width * 0.25},0 ${width / 2},0 Q ${width * 0.75},0 ${width},${height / 2} Q ${width * 0.75},${height} ${width / 2},${height} Q ${width * 0.25},${height} 0,${height / 2} Z`;
}

// Generate arch path
export function getArchPath(size: number): string {
  const archWidth = size * 0.3;
  const innerWidth = size - archWidth * 2;
  const innerRadius = innerWidth / 2;
  const outerRadius = size / 2;
  const arcRy = outerRadius * 0.6; // y-radius of outer arc
  // Outer walls start at arcRy so the arc peak reaches y=0 (fits in bounding box)
  return `M 0,${size} L 0,${arcRy} A ${outerRadius},${arcRy} 0 0 1 ${size},${arcRy} L ${size},${size} L ${size - archWidth},${size} L ${size - archWidth},${size * 0.45} A ${innerRadius},${innerRadius * 0.45} 0 0 0 ${archWidth},${size * 0.45} L ${archWidth},${size} Z`;
}

// Outer-only outline for arch (no inner cutout stroke)
export function getArchOutlinePath(size: number): string {
  const outerRadius = size / 2;
  const arcRy = outerRadius * 0.6;
  return `M 0,${size} L 0,${arcRy} A ${outerRadius},${arcRy} 0 0 1 ${size},${arcRy} L ${size},${size} Z`;
}

// Generate wave - spread-out curved shape
export function getWavePath(size: number): string {
  // Original went from x: 0.1 to 1.0, y: 0 to 1.0
  // Normalize to fill 0-size: scale x by 1/0.9, offset by -0.1/0.9
  return `M 0,${size} Q 0,${size * 0.444} ${size * 0.444},${size * 0.111} L ${size},0 Q ${size * 0.556},${size * 0.444} ${size * 0.889},${size} Z`;
}

// Generate hook - curved hook shape (solid, no inner hole)
export function getHookPath(size: number): string {
  return `M 0,0 L ${size * 0.286},0 Q ${size},0 ${size},${size * 0.4} Q ${size},${size * 0.7} ${size * 0.429},${size * 0.7} L ${size * 0.429},${size} L 0,${size} Z`;
}

// Claw — fixed Figma export (native viewBox: 275×287)
export const CLAW_PATH = 'M137.07 0C212.278 0.000261999 273.348 60.5318 274.22 135.533H274.229V137.16C274.229 144.858 274.264 152.333 274.229 159.554V286.699H203.504V189.021C203.092 186.191 202.859 183.303 202.859 180.354C202.859 113.666 155.49 59.6055 97.0576 59.6055C53.6176 59.6056 16.2937 89.4845 0 132.217C2.60217 58.7551 62.9738 0 137.07 0Z';
export const CLAW_NATIVE_VIEWBOX = { width: 275, height: 287 };

// Crescent — fixed Figma export (native viewBox: 257×370)
export const CRESCENT_PATH = 'M193.271 0C215.472 0 236.799 3.58478 256.655 10.1787C181.048 35.2868 126.77 104.055 126.77 184.958C126.77 265.861 181.048 334.628 256.655 359.736C236.799 366.33 215.472 369.916 193.271 369.916C86.5301 369.916 0 287.107 0 184.958C0 82.8086 86.5301 0.000126303 193.271 0Z';
export const CRESCENT_NATIVE_VIEWBOX = { width: 257, height: 370 };

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

// Fin — fixed Figma export (native viewBox: 274×244)
export const FIN_PATH = 'M186.725 0C117.159 133.857 92.5364 185.632 273.411 243.262C273.411 243.262 138.004 243.262 38.2243 243.262C-61.555 243.262 50.2871 66.8368 186.725 0Z';
export const FIN_NATIVE_VIEWBOX = { width: 274, height: 244 };

// Generate keyhole - sharp point with curved sides
export function getKeyholePath(size: number): string {
  // Original x range: 0.1 to 0.9 (width 0.8), normalize to 0-1
  // Transform: newX = (oldX - 0.1) / 0.8
  return `M ${size * 0.5},0 Q ${size * 0.875},${size * 0.3} ${size * 0.75},${size * 0.6} L ${size},${size} L 0,${size} L ${size * 0.25},${size * 0.6} Q ${size * 0.125},${size * 0.3} ${size * 0.5},0 Z`;
}

// Generate notch - angular shape with curved indent
export function getNotchPath(size: number): string {
  // Original y range: 0 to 0.6, normalize to fill full height
  // Transform: newY = oldY / 0.6
  return `M 0,0 L ${size},0 L ${size},${size} Q ${size * 0.5},${size * 0.667} 0,${size} L 0,0 Z`;
}

// Drop — fixed Figma export (native viewBox: 182×246)
export const DROP_PATH = 'M144.477 82.706C160.762 112.291 181.636 141.012 181.636 174.239C181.636 269.673 0.000408136 269.673 0 174.239C0 115.623 59.5608 50.338 90.8178 0L144.477 82.706Z';
export const DROP_NATIVE_VIEWBOX = { width: 182, height: 246 };

// Generate scoop - angular top with curved bottom
export function getScoopPath(width: number, height: number): string {
  // Scoop shape - flat angular top, curved bottom passing through y=height at center
  // Split the bottom curve so it actually touches y=height
  return `M 0,${height * 0.1} L ${width * 0.3},0 L ${width * 0.7},0 L ${width},${height * 0.1} L ${width},${height * 0.3} Q ${width * 0.75},${height} ${width / 2},${height} Q ${width * 0.25},${height} 0,${height * 0.3} L 0,${height * 0.1} Z`;
}

// Bean — fixed Figma export (native viewBox: 236×116)
export const BEAN_PATH = 'M235.312 20.9408C235.312 73.2428 182.635 115.642 117.656 115.642C52.6763 115.642 0 73.2428 0 20.9408C0 -31.3612 52.6763 30.7885 117.656 30.7885C182.635 30.7885 235.312 -31.3612 235.312 20.9408Z';
export const BEAN_NATIVE_VIEWBOX = { width: 236, height: 116 };

// Hourglass — fixed Figma export (native viewBox: 319×343)
export const HOURGLASS_PATH = 'M9.39819 28.7236C0.587619 16.8456 9.06627 0 23.8552 0H295.153C309.942 0 318.421 16.8456 309.61 28.7236L231.62 133.866C227.485 139.441 226.924 146.897 230.178 153.028L316.883 316.385C323.246 328.374 314.557 342.824 300.984 342.824H18.0245C4.45174 342.824 -4.23797 328.374 2.12529 316.385L88.8304 153.028C92.0847 146.897 91.5235 139.441 87.3882 133.866L9.39819 28.7236Z';
export const HOURGLASS_NATIVE_VIEWBOX = { width: 319, height: 343 };

// Generate ridge - zigzag top with curved bottom
export function getRidgePath(width: number, height: number): string {
  // Ridge shape filling bounding box
  return `M 0,${height * 0.333} L ${width * 0.25},0 L ${width * 0.5},${height * 0.222} L ${width * 0.75},0 L ${width},${height * 0.333} Q ${width * 0.8},${height} ${width * 0.5},${height} Q ${width * 0.2},${height} 0,${height * 0.333} Z`;
}
