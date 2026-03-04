// =============================================================================
// Daily Challenge Edge Function
// =============================================================================
// This is the SOURCE OF TRUTH for color generation.
// The client-side code in src/utils/dailyChallenge.ts is only an offline fallback.
//
// After updating color generation logic here, you MUST deploy:
//   supabase functions deploy get-daily-challenge
//
// The ColorTester (?colors) calls this API - changes won't appear until deployed.
// =============================================================================

import { serve } from 'std/http/server.ts';
import { createClient } from '@supabase/supabase-js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// =============================================================================
// COLOR GENERATION CONFIG - Edit these to change color behavior
// =============================================================================

const COLOR_CONFIG = {
  // Color space: 'oklch' (perceptually uniform) or 'hsl' (legacy)
  colorSpace: 'oklch' as 'oklch' | 'hsl',

  // Exclude muddy hues (browns in 30-50° HSL range, allows yellows 50-60°)
  excludeMuddyHues: true,

  // OKLCH ranges (0-1 scale)
  oklch: {
    lightness: { min: 0.4, max: 0.9 },    // Full range, not too dark
    chroma: { min: 0.07, max: 0.5 },      // Color intensity
  },

  // HSL ranges (legacy fallback)
  hsl: {
    saturation: { min: 50, max: 90 },
    lightness: { min: 40, max: 90 },
  },

  // Minimum contrast ratio (WCAG). 2.5 allows more colorful pairs than 3.0
  minContrastRatio: 2.5,
};

// =============================================================================
// Daily Word Data
// =============================================================================

// Pre-shuffled order array (365 indices for each day of the year)
const WORDS_ORDER = [129,287,332,123,25,208,347,43,156,234,138,2,169,198,292,204,169,113,120,352,19,55,280,179,158,239,329,156,316,359,195,300,82,284,345,185,232,251,324,291,152,282,211,20,305,280,191,170,84,222,297,174,11,41,59,319,259,39,335,96,310,60,81,163,222,63,168,33,150,126,169,17,320,297,46,294,351,54,216,361,48,44,272,331,115,233,260,263,176,56,350,109,337,285,119,289,32,222,203,57,54,22,144,65,69,316,73,251,131,12,172,232,133,281,141,66,219,263,355,40,134,347,92,121,300,92,110,175,121,65,307,213,223,58,343,360,304,18,216,156,188,335,41,237,18,352,346,62,353,121,116,2,338,243,169,200,109,184,120,151,23,192,181,23,199,306,200,329,219,59,44,281,19,169,258,162,322,267,144,183,321,318,129,331,139,328,290,33,358,6,44,258,350,241,285,260,81,296,223,35,9,148,155,332,321,204,314,19,95,330,356,17,39,16,30,286,68,6,23,253,118,210,144,90,315,199,294,142,126,321,236,133,240,70,333,271,339,317,347,349,267,36,53,308,345,88,287,65,256,324,215,193,94,329,341,188,1,278,239,264,280,303,40,48,198,188,167,302,25,94,248,288,230,148,223,103,291,251,11,295,79,221,336,224,23,288,152,82,251,3,44,328,169,123,32,266,175,9,166,22,343,57,117,153,85,309,25,55,296,168,282,212,269,284,344,224,210,323,60,162,326,317,162,315,45,230,160,300,216,232,216,270,271,139,129,159,53,76,312,270,209,246,204,163,22,118,103,319,337,305,122,269,8,36,233,143,205,99,318,43,257,297,131,13,242];

// Word list (indexed by WORDS_ORDER)
const WORDS_LIST = ["society","stillness","loose","life","rest","faint","right","formula","sick","poetic","wholesome","operation","power","long","reliable","exercise","compulsory","mold","form","hazy","command","spaceship","bent","physique","wakeful","credit","hard","complete","compulsion","motion","cloudy","question","beginning","stalemate","grade","one","submission","cognition","passive","breakdown","eternity","sensible","frozen","blow","hand","royalty","darkness","stifle","sympathy","clock","confusion","flavour","share","sympathy","anatomy","sour","disarray","elevator","alight","easy","renewable","closure","food","motivation","dimension","shadowy","microchip","dreary","run","extract","commotion","grim","nutshell","bedtime","cryptic","wise","airy","cosmos","hush","smother","watchful","scene","respectful","call","temporal","phase","sky","voice","drama","turbulence","extinct","start","bill","healthy","march","disorder","formal","ablaze","sanity","affection","detachment","debate","taste","identity","reshaping","density","violence","relief","midpoint","storage","hypocrite","importance","fairness","feathery","lift","resort","melancholy","arena","goal","frenzy","content","generation","class","way","rate","richness","counteract","randomness","quietly","timeline","solid","luminance","road","impasse","implosion","stealth","ignite","slick","circuit","scope","terrible","stasis","forcibly","rule","force","astro","deep","build","stagnance","juncture","stark","optimism","sad","plan","creepy","murmur","robust","enforce","structure","proportion","fibre","duration","careful","redaction","roundness","idle","read","disruption","jamming","substance","efficient","arcane","evil","vista","digest","interval","fashion","fair","seat","stir","wisdom","heart","minutes","gridlock","deafening","perfect","morph","tank","whisper","bid","motorcycle","present","temper","unnatural","dependable","trend","supply","period","valuable","soft","conduct","arch","blind","motionless","history","gesture","showtime","jazz","box","fuel","remnant","emptiness","outer","overview","dim","steady","illuminate","bring","within","newsletter","script","zip","electrical","side","skin","sturdy","frame","posture","dismount","relax","air","self","speak","collection","shuttle","lifetime","isolation","noise","touch","shift","help","mood","spooky","volume","point","chatter","walk","secrecy","oil","geometry","tissue","footprint","portrait","special","equation","potential","fear","limit","happy","value","age","clean","concrete","gravity","evening","courage","nutrition","gap","electric","sand","film","digit","void","fabric","brief","masses","serial","silent","window","wedge","magnetism","hammer","health","carpet","freeze","after","shady","earth","travel","clear","person","land","perfection","epoch","plane","existence","week","disorder","crisis","status","wilderness","segment","floor","fiasco","curvature","sense","channels","region","pull","prepare","flimsy","logic","muscle","moody","tongue","connection","might","zone","surface","fold","wild","expression","mix","spark","world","gag","project","stamina","clip","sink","weather","dominance","turn","shock","grain","tough","contour","fall","concealed","priority","hook","satellite","round","storm","forge","discussion","second","powerful","serenity","figure","height","madness","time","soul","cloud","distance","momentum","excitement","blur","perception","drive","squeeze","shut","blurry","friendly","swing"];

/**
 * Get the daily word for a given date.
 * Uses day of year to index into the shuffled order array.
 */
function getWordForDate(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00Z');
  const startOfYear = new Date(date.getUTCFullYear(), 0, 0);
  const diff = date.getTime() - startOfYear.getTime();
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24)); // 1-365
  const orderIndex = (dayOfYear - 1) % WORDS_ORDER.length;
  return WORDS_LIST[WORDS_ORDER[orderIndex]];
}

// =============================================================================
// Types
// =============================================================================

type ShapeType =
  | 'circle'
  | 'square'
  | 'triangle'
  | 'pentagon'
  | 'hexagon'
  | 'star'
  | 'rightTriangle'
  | 'isoscelesTriangle'
  | 'diamond'
  | 'trapezoid'
  | 'parallelogram'
  | 'kite'
  | 'heptagon'
  | 'cross'
  | 'arrow'
  | 'semicircle'
  | 'quarterCircle'
  | 'ellipse'
  | 'blade'
  | 'lens'
  | 'arch'
  | 'drop'
  | 'shard'
  | 'wedge'
  | 'fan'
  | 'hook'
  | 'wave'
  | 'crescent'
  | 'pill'
  | 'splinter'
  | 'chunk'
  | 'fang'
  | 'claw'
  | 'fin'
  | 'keyhole'
  | 'slant'
  | 'notch'
  | 'spike'
  | 'bulge'
  | 'scoop'
  | 'ridge';

interface ShapeData {
  type: ShapeType;
  name: string;
  svg: string;
}

interface DailyChallenge {
  date: string;
  colors: string[];
  shapes: [ShapeData, ShapeData];
  word: string;
}

interface ChallengeRow {
  id: string;
  challenge_date: string;
  color_1: string;
  color_2: string;
  color_3: string | null;
  shape_1: string;
  shape_2: string;
  shape_1_svg: string | null;
  shape_2_svg: string | null;
  shape_1_name: string | null;
  shape_2_name: string | null;
  word: string;
  created_at: string;
}

// =============================================================================
// Shape Data
// =============================================================================

const SHAPE_NAMES: Record<ShapeType, string> = {
  circle: 'Circle',
  square: 'Square',
  triangle: 'Triangle',
  pentagon: 'Pentagon',
  hexagon: 'Hexagon',
  star: 'Star',
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
  shard: 'Shard',
  wedge: 'Wedge',
  fan: 'Fan',
  hook: 'Hook',
  wave: 'Wave',
  crescent: 'Crescent',
  pill: 'Pill',
  splinter: 'Splinter',
  chunk: 'Chunk',
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

const ALL_SHAPES: ShapeType[] = Object.keys(SHAPE_NAMES) as ShapeType[];

// =============================================================================
// SVG Path Generation (normalized to 100x100 viewBox)
// =============================================================================

function getPolygonPoints(sides: number, offsetAngle: number = 0): string {
  const points: string[] = [];
  const angleStep = (2 * Math.PI) / sides;
  const radius = 50;
  const center = 50;

  for (let i = 0; i < sides; i++) {
    const angle = angleStep * i + offsetAngle - Math.PI / 2;
    const x = center + radius * Math.cos(angle);
    const y = center + radius * Math.sin(angle);
    points.push(`${x},${y}`);
  }

  return points.join(' ');
}

function polygonToPath(points: string): string {
  const coords = points.split(' ').map(p => p.split(',').map(Number));
  if (coords.length === 0) return '';
  const [first, ...rest] = coords;
  return `M ${first[0]},${first[1]} ${rest.map(([x, y]) => `L ${x},${y}`).join(' ')} Z`;
}

function getShapeSVG(type: ShapeType): string {
  const size = 100;
  const half = size / 2;

  switch (type) {
    case 'circle':
      return `M ${half},0 A ${half},${half} 0 1 1 ${half},${size} A ${half},${half} 0 1 1 ${half},0 Z`;
    case 'square':
      return `M 0,0 L ${size},0 L ${size},${size} L 0,${size} Z`;
    case 'triangle':
      return polygonToPath(getPolygonPoints(3));
    case 'pentagon':
      return polygonToPath(getPolygonPoints(5));
    case 'hexagon':
      return polygonToPath(getPolygonPoints(6));
    case 'heptagon':
      return polygonToPath(getPolygonPoints(7));
    case 'star': {
      const coords: string[] = [];
      const outerRadius = 50;
      const innerRadius = outerRadius * 0.4;
      const points = 5;
      const angleStep = Math.PI / points;
      for (let i = 0; i < points * 2; i++) {
        const radius = i % 2 === 0 ? outerRadius : innerRadius;
        const angle = angleStep * i - Math.PI / 2;
        const x = 50 + radius * Math.cos(angle);
        const y = 50 + radius * Math.sin(angle);
        coords.push(`${x},${y}`);
      }
      return polygonToPath(coords.join(' '));
    }
    case 'rightTriangle':
      return `M 0,${size} L ${size},${size} L 0,0 Z`;
    case 'isoscelesTriangle':
      return `M ${half},0 L ${size},${size} L 0,${size} Z`;
    case 'diamond':
      return `M ${half},0 L ${size},${half} L ${half},${size} L 0,${half} Z`;
    case 'trapezoid': {
      const inset = size * 0.2;
      return `M ${inset},0 L ${size - inset},0 L ${size},${size} L 0,${size} Z`;
    }
    case 'parallelogram': {
      const skew = size * 0.25;
      return `M ${skew},0 L ${size},0 L ${size - skew},${size} L 0,${size} Z`;
    }
    case 'kite': {
      const widthOffset = size * 0.35;
      const topHeight = size * 0.3;
      return `M ${half},0 L ${half + widthOffset},${topHeight} L ${half},${size} L ${half - widthOffset},${topHeight} Z`;
    }
    case 'cross': {
      const armWidth = size / 3;
      const inner1 = armWidth;
      const inner2 = armWidth * 2;
      return `M ${inner1},0 L ${inner2},0 L ${inner2},${inner1} L ${size},${inner1} L ${size},${inner2} L ${inner2},${inner2} L ${inner2},${size} L ${inner1},${size} L ${inner1},${inner2} L 0,${inner2} L 0,${inner1} L ${inner1},${inner1} Z`;
    }
    case 'arrow': {
      const shaftWidth = size * 0.35;
      const headStart = size * 0.5;
      const centerY = half;
      const halfShaft = shaftWidth / 2;
      return `M 0,${centerY - halfShaft} L ${headStart},${centerY - halfShaft} L ${headStart},0 L ${size},${centerY} L ${headStart},${size} L ${headStart},${centerY + halfShaft} L 0,${centerY + halfShaft} Z`;
    }
    case 'semicircle':
      return `M 0,${size} A ${half},${half} 0 0 1 ${size},${size} L 0,${size} Z`;
    case 'quarterCircle':
      return `M 0,0 L ${size},0 A ${size},${size} 0 0 1 0,${size} L 0,0 Z`;
    case 'ellipse':
      return `M ${half},${half - size/3} A ${half},${size/3} 0 1 1 ${half},${half + size/3} A ${half},${size/3} 0 1 1 ${half},${half - size/3} Z`;
    case 'blade': {
      const controlOffset = size * 0.5;
      return `M ${half},0 Q ${size + controlOffset * 0.5},${size * 0.35} ${half},${size} Q ${-controlOffset * 0.5},${size * 0.65} ${half},0 Z`;
    }
    case 'lens': {
      const radius = size * 0.7;
      return `M 0,${half} A ${radius},${radius} 0 0 1 ${size},${half} A ${radius},${radius} 0 0 1 0,${half} Z`;
    }
    case 'arch': {
      const archWidth = size * 0.3;
      const innerWidth = size - archWidth * 2;
      const innerRadius = innerWidth / 2;
      const outerRadius = half;
      return `M 0,${size} L 0,${size * 0.4} A ${outerRadius},${outerRadius} 0 0 1 ${size},${size * 0.4} L ${size},${size} L ${size - archWidth},${size} L ${size - archWidth},${size * 0.4 + archWidth * 0.5} A ${innerRadius},${innerRadius} 0 0 0 ${archWidth},${size * 0.4 + archWidth * 0.5} L ${archWidth},${size} Z`;
    }
    case 'drop':
      return `M ${half},0 C ${size * 0.9},${size * 0.4} ${size * 0.9},${size * 0.7} ${half},${size} C ${size * 0.1},${size * 0.7} ${size * 0.1},${size * 0.4} ${half},0 Z`;
    case 'shard':
      return polygonToPath(`${size * 0.2},0 ${size * 0.9},${size * 0.15} ${size},${size * 0.6} ${half},${size} 0,${size * 0.7} ${size * 0.1},${size * 0.3}`);
    case 'wedge':
      return polygonToPath(`${half},0 ${size},${size * 0.3} ${size * 0.8},${size} ${size * 0.2},${size} 0,${half}`);
    case 'fan':
      return `M ${size * 0.1},${size} Q ${size * 0.1},${half} ${half},${size * 0.1} L ${size},0 Q ${size * 0.6},${size * 0.4} ${size * 0.9},${size} Z`;
    case 'hook':
      return `M ${size * 0.3},0 L ${half},0 Q ${size},0 ${size},${size * 0.4} Q ${size},${size * 0.7} ${size * 0.6},${size * 0.7} L ${size * 0.6},${size} L ${size * 0.3},${size} L ${size * 0.3},${half} Q ${size * 0.3},${size * 0.2} ${size * 0.6},${size * 0.2} Q ${size * 0.75},${size * 0.2} ${size * 0.75},${size * 0.4} Q ${size * 0.75},${half} ${size * 0.6},${half} L ${size * 0.3},${half} Z`;
    case 'wave':
      return `M 0,${half} Q ${size * 0.25},${size * 0.2} ${half},${half} Q ${size * 0.75},${size * 0.8} ${size},${half} L ${size},${size * 0.8} Q ${size * 0.75},${size} ${half},${size * 0.8} Q ${size * 0.25},${size * 0.6} 0,${size * 0.8} Z`;
    case 'crescent': {
      const r = size * 0.4;
      const cy = half;
      const top = cy - r;
      const bottom = cy + r;
      const leftX = size * 0.3;
      const rightX = half;
      return `M ${half},${top} Q ${leftX - r * 0.8},${cy} ${half},${bottom} Q ${rightX + r * 0.3},${cy} ${half},${top} Z`;
    }
    case 'pill': {
      const r = size * 0.2;
      return `M ${r},0 L ${size - r},0 A ${r},${r} 0 0 1 ${size - r},${r * 2} L ${r},${r * 2} A ${r},${r} 0 0 1 ${r},0 Z`;
    }
    case 'splinter':
      return polygonToPath(`${size * 0.4},0 ${size * 0.6},0 ${size * 0.8},${size * 0.3} ${size},${size} ${size * 0.7},${size * 0.6} ${size * 0.3},${size * 0.8} 0,${size * 0.4}`);
    case 'chunk':
      return polygonToPath(`${size * 0.1},${size * 0.1} ${size * 0.6},0 ${size},${size * 0.2} ${size * 0.9},${size * 0.7} ${size * 0.6},${size} ${size * 0.2},${size * 0.9} 0,${half}`);
    case 'fang':
      return `M ${size * 0.3},0 L ${size * 0.7},0 L ${half},${size} Q ${size * 0.2},${size * 0.6} ${size * 0.3},0 Z`;
    case 'claw':
      return `M ${size * 0.2},${size} L ${half},${size} L ${size * 0.6},${size * 0.7} Q ${size * 0.9},${size * 0.3} ${half},0 Q ${size * 0.3},${size * 0.2} ${size * 0.35},${half} L ${size * 0.2},${size} Z`;
    case 'fin':
      return `M 0,${size} L ${size * 0.3},${size * 0.7} L ${size * 0.2},${size * 0.2} L ${size * 0.8},0 Q ${size},${size * 0.4} ${size * 0.7},${size} Z`;
    case 'keyhole':
      return `M ${half},0 Q ${size * 0.8},${size * 0.3} ${size * 0.7},${size * 0.6} L ${size * 0.9},${size} L ${size * 0.1},${size} L ${size * 0.3},${size * 0.6} Q ${size * 0.2},${size * 0.3} ${half},0 Z`;
    case 'slant':
      return `M ${size * 0.3},0 L ${size},0 L ${size * 0.7},${size} L 0,${size} Q ${size * 0.1},${half} ${size * 0.3},0 Z`;
    case 'notch':
      return `M 0,0 L ${size},0 L ${size},${size * 0.6} Q ${half},${size * 0.4} 0,${size * 0.6} L 0,0 Z`;
    case 'spike':
      return `M ${half},0 L ${size * 0.7},${size * 0.6} Q ${size * 0.8},${size} ${half},${size} Q ${size * 0.2},${size} ${size * 0.3},${size * 0.6} L ${half},0 Z`;
    case 'bulge':
      return `M ${size * 0.2},0 L ${size * 0.8},0 L ${size},${size * 0.3} Q ${size * 0.9},${size * 0.7} ${size * 0.7},${size} L ${size * 0.3},${size} Q ${size * 0.1},${size * 0.7} 0,${size * 0.3} L ${size * 0.2},0 Z`;
    case 'scoop':
      return `M 0,${size * 0.2} L ${size * 0.3},0 L ${size * 0.7},0 L ${size},${size * 0.2} L ${size * 0.9},${half} Q ${half},${size * 1.1} ${size * 0.1},${half} L 0,${size * 0.2} Z`;
    case 'ridge':
      return `M 0,${size * 0.4} L ${size * 0.25},${size * 0.1} L ${half},${size * 0.3} L ${size * 0.75},${size * 0.1} L ${size},${size * 0.4} Q ${size * 0.8},${size} ${half},${size} Q ${size * 0.2},${size} 0,${size * 0.4} Z`;
    default:
      return `M 0,0 L ${size},0 L ${size},${size} L 0,${size} Z`;
  }
}

function createShapeData(type: ShapeType): ShapeData {
  return {
    type,
    name: SHAPE_NAMES[type],
    svg: getShapeSVG(type),
  };
}

// =============================================================================
// OKLCH Color Space Conversion
// =============================================================================

interface OKLCH {
  l: number; // 0-1 (lightness)
  c: number; // 0-0.4 (chroma/saturation)
  h: number; // 0-360 (hue)
}

function oklchToRgb(oklch: OKLCH): { r: number; g: number; b: number } {
  const { l, c, h } = oklch;
  const hRad = (h * Math.PI) / 180;
  const a = c * Math.cos(hRad);
  const b = c * Math.sin(hRad);

  // OKLab to linear RGB
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;

  const l3 = l_ * l_ * l_;
  const m3 = m_ * m_ * m_;
  const s3 = s_ * s_ * s_;

  const rLinear = 4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
  const gLinear = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
  const bLinear = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3;

  // Linear to sRGB
  const toSrgb = (x: number) => {
    const clamped = Math.max(0, Math.min(1, x));
    return clamped <= 0.0031308
      ? clamped * 12.92
      : 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055;
  };

  return {
    r: Math.round(toSrgb(rLinear) * 255),
    g: Math.round(toSrgb(gLinear) * 255),
    b: Math.round(toSrgb(bLinear) * 255),
  };
}

function oklchToHsl(oklch: OKLCH): { h: number; s: number; l: number } {
  const rgb = oklchToRgb(oklch);
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

// =============================================================================
// sRGB Gamut Mapping for OKLCH
// =============================================================================

// Check if an OKLCH color maps to valid sRGB (no channel outside [0, 1])
function isOklchInGamut(l: number, c: number, h: number): boolean {
  const hRad = (h * Math.PI) / 180;
  const a = c * Math.cos(hRad);
  const b = c * Math.sin(hRad);

  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;

  const l3 = l_ * l_ * l_;
  const m3 = m_ * m_ * m_;
  const s3 = s_ * s_ * s_;

  const rLinear = 4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
  const gLinear = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
  const bLinear = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3;

  const eps = 0.001;
  return rLinear >= -eps && rLinear <= 1 + eps &&
         gLinear >= -eps && gLinear <= 1 + eps &&
         bLinear >= -eps && bLinear <= 1 + eps;
}

// Binary search for the maximum in-gamut chroma at a given lightness and hue
function maxChromaInGamut(l: number, h: number): number {
  let lo = 0;
  let hi = 0.5;
  for (let i = 0; i < 16; i++) {
    const mid = (lo + hi) / 2;
    if (isOklchInGamut(l, mid, h)) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return lo;
}

// =============================================================================
// Muddy Hue Exclusion
// =============================================================================

function generateSafeHue(random: () => number, excludeMuddy: boolean): number {
  if (!excludeMuddy) {
    return Math.floor(random() * 360);
  }
  // Skip the 30-50° range (muddy browns), allows yellows at 50-60°
  const hue = Math.floor(random() * 340);
  return hue >= 30 ? hue + 20 : hue;
}

// =============================================================================
// Random Generation Utilities
// =============================================================================

function seededRandom(seed: number): () => number {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function dateToSeed(dateStr: string): number {
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    const char = dateStr.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

function generateColorWithOKLCH(random: () => number, hue: number): string {
  const { oklch } = COLOR_CONFIG;
  const l = oklch.lightness.min + random() * (oklch.lightness.max - oklch.lightness.min);
  // Gamut map: cap chroma to the maximum that stays within sRGB
  const maxC = maxChromaInGamut(l, hue);
  const effectiveMax = Math.min(oklch.chroma.max, maxC);
  const effectiveMin = Math.min(oklch.chroma.min, effectiveMax);
  const c = effectiveMin + random() * (effectiveMax - effectiveMin);
  const hsl = oklchToHsl({ l, c, h: hue });
  return `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`;
}

function generateColorWithHSL(random: () => number, hue: number): string {
  const { hsl } = COLOR_CONFIG;
  const saturation = hsl.saturation.min + Math.floor(random() * (hsl.saturation.max - hsl.saturation.min));
  const lightness = hsl.lightness.min + Math.floor(random() * (hsl.lightness.max - hsl.lightness.min));
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

function parseHSL(hsl: string): { h: number; s: number; l: number } {
  const match = hsl.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
  if (!match) return { h: 0, s: 0, l: 0 };
  return {
    h: parseInt(match[1]),
    s: parseInt(match[2]),
    l: parseInt(match[3]),
  };
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  s /= 100;
  l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;

  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }

  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}

function getRelativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const sRGB = c / 255;
    return sRGB <= 0.03928 ? sRGB / 12.92 : Math.pow((sRGB + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function getContrastRatio(color1: string, color2: string): number {
  const c1 = parseHSL(color1);
  const c2 = parseHSL(color2);
  const rgb1 = hslToRgb(c1.h, c1.s, c1.l);
  const rgb2 = hslToRgb(c2.h, c2.s, c2.l);
  const l1 = getRelativeLuminance(rgb1.r, rgb1.g, rgb1.b);
  const l2 = getRelativeLuminance(rgb2.r, rgb2.g, rgb2.b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function colorDistance(color1: string, color2: string): number {
  const c1 = parseHSL(color1);
  const c2 = parseHSL(color2);

  let hueDiff = Math.abs(c1.h - c2.h);
  if (hueDiff > 180) hueDiff = 360 - hueDiff;

  return Math.sqrt(
    Math.pow(hueDiff * 2, 2) +
    Math.pow((c1.l - c2.l) * 1.5, 2) +
    Math.pow((c1.s - c2.s) * 0.5, 2)
  );
}

// Check if a color is too similar to any color in the avoid list
function isColorTooSimilar(color: string, colorsToAvoid: string[]): boolean {
  if (colorsToAvoid.length === 0) return false;

  const c = parseHSL(color);
  const minHueDiff = 40;   // Hues must differ by at least 40°
  const minLightDiff = 20; // Or lightness must differ by at least 20%

  for (const avoid of colorsToAvoid) {
    const a = parseHSL(avoid);

    // Calculate hue difference (accounting for wraparound)
    let hueDiff = Math.abs(c.h - a.h);
    if (hueDiff > 180) hueDiff = 360 - hueDiff;

    // Calculate lightness difference
    const lightDiff = Math.abs(c.l - a.l);

    // Too similar if BOTH hue AND lightness are close
    if (hueDiff < minHueDiff && lightDiff < minLightDiff) {
      return true;
    }
  }
  return false;
}

function generateDistinctColors(
  random: () => number,
  colorsToAvoid: string[] = []
): string[] {
  const { colorSpace, excludeMuddyHues, minContrastRatio } = COLOR_CONFIG;
  const minHueDiff = 30;

  const generateColor = (hue: number) =>
    colorSpace === 'oklch'
      ? generateColorWithOKLCH(random, hue)
      : generateColorWithHSL(random, hue);

  // Helper: check pairwise hue differences for 3 hues (all pairs ≥ minHueDiff)
  function huesDistinct(hues: number[]): boolean {
    for (let a = 0; a < hues.length; a++) {
      for (let b = a + 1; b < hues.length; b++) {
        let diff = Math.abs(hues[a] - hues[b]);
        if (diff > 180) diff = 360 - diff;
        if (diff < minHueDiff) return false;
      }
    }
    return true;
  }

  for (let i = 0; i < 100; i++) {
    // Generate 3 distinct hues
    const hues = [
      generateSafeHue(random, excludeMuddyHues),
      generateSafeHue(random, excludeMuddyHues),
      generateSafeHue(random, excludeMuddyHues),
    ];

    if (!huesDistinct(hues)) continue;

    const colors = hues.map(generateColor);

    // Relaxed contrast: require ≥2 of 3 pairwise contrast ratios to meet threshold
    const pairs = [
      getContrastRatio(colors[0], colors[1]),
      getContrastRatio(colors[0], colors[2]),
      getContrastRatio(colors[1], colors[2]),
    ];
    const passingPairs = pairs.filter(r => r >= minContrastRatio).length;
    if (passingPairs < 2) continue;

    // Check similarity to colors to avoid (previous days)
    if (colors.some(c => isColorTooSimilar(c, colorsToAvoid))) continue;

    return colors;
  }

  // Fallback: trichromatic hues (120° apart)
  const hue = generateSafeHue(random, excludeMuddyHues);
  return [
    generateColor(hue),
    generateColor((hue + 120) % 360),
    generateColor((hue + 240) % 360),
  ];
}

function generateShapes(random: () => number): [ShapeType, ShapeType] {
  const shuffled = [...ALL_SHAPES].sort(() => random() - 0.5);
  return [shuffled[0], shuffled[1]];
}

// =============================================================================
// Smart Randomness - Avoid repeating recent challenges
// =============================================================================

interface PreviousChallenge {
  shapes: [ShapeType, ShapeType];
  colors: string[];
}

function haveSameShapes(
  shapes1: [ShapeType, ShapeType],
  shapes2: [ShapeType, ShapeType]
): boolean {
  const set1 = new Set(shapes1);
  const set2 = new Set(shapes2);
  return shapes1.every((s) => set2.has(s)) && shapes2.every((s) => set1.has(s));
}

function areSimilarColors(color1: string, color2: string): boolean {
  return colorDistance(color1, color2) < 40;
}

function haveSimilarColors(
  colors1: string[],
  colors2: string[]
): boolean {
  // For each color in colors1, check if it has a similar match in colors2
  // If most colors match, the palettes are too similar
  let matches = 0;
  const used = new Set<number>();
  for (const c1 of colors1) {
    for (let j = 0; j < colors2.length; j++) {
      if (!used.has(j) && areSimilarColors(c1, colors2[j])) {
        matches++;
        used.add(j);
        break;
      }
    }
  }
  // Similar if most colors have a match (allow 1 different color)
  return matches >= Math.min(colors1.length, colors2.length) - 1;
}

function isTooSimilarToAny(
  candidate: { shapes: [ShapeType, ShapeType]; colors: string[] },
  previousChallenges: PreviousChallenge[]
): boolean {
  for (const prev of previousChallenges) {
    if (haveSameShapes(candidate.shapes, prev.shapes) && haveSimilarColors(candidate.colors, prev.colors)) {
      return true;
    }
  }
  // Don't repeat the same two shapes as yesterday (index 0 = most recent)
  if (previousChallenges.length > 0 && haveSameShapes(candidate.shapes, previousChallenges[0].shapes)) {
    return true;
  }
  return false;
}

function generateChallengeWithSmartRandomness(
  dateStr: string,
  previousChallenges: PreviousChallenge[]
): DailyChallenge {
  const baseSeed = dateToSeed(dateStr);
  const word = getWordForDate(dateStr);

  // Collect previous colors to avoid similar consecutive days
  const colorsToAvoid = previousChallenges.flatMap(c => c.colors);

  for (let attempt = 0; attempt < 50; attempt++) {
    const random = seededRandom(baseSeed + attempt * 1000003);
    const colors = generateDistinctColors(random, colorsToAvoid);
    const shapes = generateShapes(random);

    if (!isTooSimilarToAny({ shapes, colors }, previousChallenges)) {
      return {
        date: dateStr,
        colors,
        shapes: [createShapeData(shapes[0]), createShapeData(shapes[1])],
        word,
      };
    }
  }

  // Fallback - use first attempt
  const random = seededRandom(baseSeed);
  const colors = generateDistinctColors(random, colorsToAvoid);
  const shapes = generateShapes(random);
  return {
    date: dateStr,
    colors,
    shapes: [createShapeData(shapes[0]), createShapeData(shapes[1])],
    word,
  };
}

// =============================================================================
// Database Helpers
// =============================================================================

function getDateBefore(dateStr: string, daysBefore: number): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - daysBefore);
  return d.toISOString().split('T')[0];
}

function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

function rowToChallenge(row: ChallengeRow): DailyChallenge {
  const shape1Type = row.shape_1 as ShapeType;
  const shape2Type = row.shape_2 as ShapeType;

  return {
    date: row.challenge_date,
    colors: [row.color_1, row.color_2, row.color_3].filter(Boolean) as string[],
    shapes: [
      {
        type: shape1Type,
        name: row.shape_1_name || SHAPE_NAMES[shape1Type],
        svg: row.shape_1_svg || getShapeSVG(shape1Type),
      },
      {
        type: shape2Type,
        name: row.shape_2_name || SHAPE_NAMES[shape2Type],
        svg: row.shape_2_svg || getShapeSVG(shape2Type),
      },
    ],
    word: row.word,
  };
}

function rowToPreviousChallenge(row: ChallengeRow): PreviousChallenge {
  return {
    shapes: [row.shape_1 as ShapeType, row.shape_2 as ShapeType],
    colors: [row.color_1, row.color_2, row.color_3].filter(Boolean) as string[],
  };
}

// =============================================================================
// Main Logic
// =============================================================================

// deno-lint-ignore no-explicit-any
type SupabaseClient = ReturnType<typeof createClient<any>>;

async function fetchOrCreateChallenge(
  supabase: SupabaseClient,
  date: string
): Promise<DailyChallenge> {
  const today = getTodayDate();

  // Don't create challenges for future dates
  if (date > today) {
    throw new Error(`Cannot create challenge for future date: ${date}`);
  }

  // 1. Check if challenge already exists
  const { data: existing } = await supabase
    .from('challenges')
    .select('*')
    .eq('challenge_date', date)
    .single();

  if (existing) {
    return rowToChallenge(existing as ChallengeRow);
  }

  // 2. Fetch previous 3 days from DB (whatever exists)
  const previousDates = [1, 2, 3].map((i) => getDateBefore(date, i));
  const { data: previousRows } = await supabase
    .from('challenges')
    .select('*')
    .in('challenge_date', previousDates)
    .order('challenge_date', { ascending: false });

  const previousChallenges: PreviousChallenge[] = (previousRows || []).map(
    (row: ChallengeRow) => rowToPreviousChallenge(row)
  );

  // 3. Generate challenge avoiding similar recent ones
  const challenge = generateChallengeWithSmartRandomness(date, previousChallenges);

  // 4. Save to database
  const { error: insertError } = await supabase
    .from('challenges')
    .upsert(
      {
        challenge_date: challenge.date,
        color_1: challenge.colors[0],
        color_2: challenge.colors[1],
        color_3: challenge.colors[2] ?? null,
        shape_1: challenge.shapes[0].type,
        shape_2: challenge.shapes[1].type,
        shape_1_svg: challenge.shapes[0].svg,
        shape_2_svg: challenge.shapes[1].svg,
        shape_1_name: challenge.shapes[0].name,
        shape_2_name: challenge.shapes[1].name,
        word: challenge.word,
      },
      { onConflict: 'challenge_date', ignoreDuplicates: true }
    );

  // Race condition - fetch the winner
  if (insertError) {
    const { data: winner } = await supabase
      .from('challenges')
      .select('*')
      .eq('challenge_date', date)
      .single();

    if (winner) {
      return rowToChallenge(winner as ChallengeRow);
    }
  }

  return challenge;
}

// Read-only batch fetch - does NOT create missing challenges
// Used by Calendar to show historical data
async function fetchExistingChallenges(
  supabase: SupabaseClient,
  dates: string[]
): Promise<DailyChallenge[]> {
  if (dates.length === 0) {
    return [];
  }

  // Just fetch what exists - don't create anything
  const { data: existing } = await supabase
    .from('challenges')
    .select('*')
    .in('challenge_date', dates);

  return ((existing as ChallengeRow[]) || []).map((row) => rowToChallenge(row));
}

// =============================================================================
// Edge Function Handler
// =============================================================================

interface ChallengeRequest {
  date?: string;
  dates?: string[];
  test?: boolean;              // For ColorTester: generate random colors
  previousColors?: string[];   // For ColorTester: colors to avoid (simulates consecutive days)
}

interface TestColorResponse {
  colors: string[];
  metadata: {
    pairwise: Array<{ pair: string; contrastRatio: number; hueDiff: number; distance: number }>;
  };
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    let requestData: ChallengeRequest = {};
    if (req.method === 'POST') {
      requestData = await req.json();
    } else if (req.method === 'GET') {
      const url = new URL(req.url);
      const date = url.searchParams.get('date');
      const dates = url.searchParams.get('dates');
      const test = url.searchParams.get('test');
      if (date) requestData.date = date;
      if (dates) requestData.dates = dates.split(',');
      if (test === 'true') requestData.test = true;
    }

    // Test mode for ColorTester - generates random colors (not date-seeded)
    if (requestData.test) {
      const random = () => Math.random();
      const colorsToAvoid = requestData.previousColors || [];
      const colors = generateDistinctColors(random, colorsToAvoid);

      // Calculate pairwise metadata for display
      const pairwise: TestColorResponse['metadata']['pairwise'] = [];
      for (let a = 0; a < colors.length; a++) {
        for (let b = a + 1; b < colors.length; b++) {
          const ca = parseHSL(colors[a]);
          const cb = parseHSL(colors[b]);
          let hueDiff = Math.abs(ca.h - cb.h);
          if (hueDiff > 180) hueDiff = 360 - hueDiff;
          pairwise.push({
            pair: `${a + 1}-${b + 1}`,
            contrastRatio: getContrastRatio(colors[a], colors[b]),
            hueDiff,
            distance: colorDistance(colors[a], colors[b]),
          });
        }
      }

      const response: TestColorResponse = {
        colors,
        metadata: { pairwise },
      };

      return new Response(JSON.stringify(response), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Batch request
    if (requestData.dates && requestData.dates.length > 0) {
      for (const date of requestData.dates) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          return new Response(
            JSON.stringify({ error: `Invalid date format: ${date}` }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      const challenges = await fetchExistingChallenges(supabaseAdmin, requestData.dates);
      return new Response(JSON.stringify({ challenges }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Single date request
    const targetDate = requestData.date || getTodayDate();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
      return new Response(JSON.stringify({ error: 'Invalid date format' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const challenge = await fetchOrCreateChallenge(supabaseAdmin, targetDate);

    return new Response(JSON.stringify(challenge), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
