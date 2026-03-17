// =============================================================================
// Daily Challenge Edge Function
// =============================================================================
// This is the SOURCE OF TRUTH for challenge generation.
//
// COLOR GENERATION (V3): Palette-based approach using 365 curated Coolors.co
// palettes. Each day maps to a palette (by day-of-year), and 3 of 5 colors
// are picked deterministically using a seeded PRNG based on day + year.
// Colors are stored as hex strings.
//
// After updating logic here, you MUST deploy:
//   supabase functions deploy get-daily-challenge
// =============================================================================

import { serve } from 'std/http/server.ts';
import { createClient } from '@supabase/supabase-js';
import { PALETTES, PALETTE_COUNT } from '../_shared/palettes.ts';
import { WORDS_ORDER, WORDS_LIST } from '../_shared/words.ts';
import { pick3WithContrast } from '../_shared/colorPicking.ts';
import { areShapesTooSimilar } from '../_shared/shapeSimilarityGroups.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
  | 'trapezoid'
  | 'parallelogram'
  | 'kite'
  | 'heptagon'
  | 'cross'
  | 'arrow'
  | 'semicircle'
  | 'quarterCircle'
  | 'ellipse'
  | 'lens'
  | 'arch'
  | 'wedge'
  | 'fan'
  | 'hook'
  | 'wave'
  | 'crescent'
  | 'pill'
  | 'splinter'
  | 'fang'
  | 'claw'
  | 'fin'
  | 'keyhole'
  | 'notch'
  | 'spike'
  | 'bulge'
  | 'scoop'
  | 'ridge';

interface ShapeData {
  type: ShapeType;
  name: string;
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
  word: string;
  harmony_rule: string | null;
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
  trapezoid: 'Trapezoid',
  parallelogram: 'Parallelogram',
  kite: 'Kite',
  heptagon: 'Heptagon',
  cross: 'Cross',
  arrow: 'Arrow',
  semicircle: 'Semicircle',
  quarterCircle: 'Quarter Circle',
  ellipse: 'Ellipse',
  lens: 'Lens',
  arch: 'Arch',
  wedge: 'Wedge',
  fan: 'Fan',
  hook: 'Hook',
  wave: 'Wave',
  crescent: 'Crescent',
  pill: 'Pill',
  splinter: 'Splinter',
  fang: 'Fang',
  claw: 'Claw',
  fin: 'Fin',
  keyhole: 'Keyhole',
  notch: 'Notch',
  spike: 'Spike',
  bulge: 'Bulge',
  scoop: 'Scoop',
  ridge: 'Ridge',
};

const ALL_SHAPES: ShapeType[] = Object.keys(SHAPE_NAMES) as ShapeType[];

function createShapeData(type: ShapeType): ShapeData {
  return {
    type,
    name: SHAPE_NAMES[type],
  };
}

// =============================================================================
// Seeded Random & Color Selection
// =============================================================================

/** Mulberry32 seeded PRNG */
function seededRandom(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
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

function getDayOfYear(dateStr: string): number {
  const date = new Date(dateStr + 'T12:00:00Z');
  const startOfYear = new Date(date.getUTCFullYear(), 0, 0);
  const diff = date.getTime() - startOfYear.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24)); // 1-365
}

function getYear(dateStr: string): number {
  return new Date(dateStr + 'T12:00:00Z').getUTCFullYear();
}

/**
 * Get 3 colors for a given date from curated palettes.
 * Day-of-year determines which palette, seed from day+year determines which 3 colors.
 * Ensures at least one pair has sufficient contrast so one color stands out.
 */
function getColorsForDate(dateStr: string): string[] {
  const dayIndex = getDayOfYear(dateStr) - 1; // 0-364
  const year = getYear(dateStr);
  const paletteIndex = ((dayIndex % PALETTE_COUNT) + PALETTE_COUNT) % PALETTE_COUNT;
  const palette = PALETTES[paletteIndex];
  const seed = dayIndex * 1000 + year;
  const random = seededRandom(seed);
  return pick3WithContrast(palette, random).colors;
}

// =============================================================================
// Shape Generation with Smart Randomness
// =============================================================================

function generateShapes(random: () => number): [ShapeType, ShapeType] {
  const shuffled = [...ALL_SHAPES].sort(() => random() - 0.5);
  return [shuffled[0], shuffled[1]];
}

interface PreviousChallenge {
  shapes: [ShapeType, ShapeType];
}

function haveSameShapes(
  shapes1: [ShapeType, ShapeType],
  shapes2: [ShapeType, ShapeType]
): boolean {
  const set1 = new Set(shapes1);
  const set2 = new Set(shapes2);
  return shapes1.every((s) => set2.has(s)) && shapes2.every((s) => set1.has(s));
}

function generateChallengeForDate(
  dateStr: string,
  previousChallenges: PreviousChallenge[]
): DailyChallenge {
  const baseSeed = dateToSeed(dateStr);
  const word = getWordForDate(dateStr);
  const colors = getColorsForDate(dateStr);

  // Try to find shapes that don't repeat yesterday's pair and aren't too similar
  for (let attempt = 0; attempt < 50; attempt++) {
    const random = seededRandom(baseSeed + attempt * 1000003);
    const shapes = generateShapes(random);

    // Don't repeat the same two shapes as yesterday
    if (previousChallenges.length > 0 && haveSameShapes(shapes, previousChallenges[0].shapes)) {
      continue;
    }

    // Don't pair shapes that are too similar (e.g. ellipse + lens, hexagon + heptagon)
    if (areShapesTooSimilar(shapes[0], shapes[1])) {
      continue;
    }

    return {
      date: dateStr,
      colors,
      shapes: [createShapeData(shapes[0]), createShapeData(shapes[1])],
      word,
    };
  }

  // Fallback
  const random = seededRandom(baseSeed);
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
        name: SHAPE_NAMES[shape1Type],
      },
      {
        type: shape2Type,
        name: SHAPE_NAMES[shape2Type],
      },
    ],
    word: row.word,
  };
}

function rowToPreviousChallenge(row: ChallengeRow): PreviousChallenge {
  return {
    shapes: [row.shape_1 as ShapeType, row.shape_2 as ShapeType],
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

  // 2. Fetch previous day from DB (to avoid shape repeats)
  const previousDates = [1].map((i) => getDateBefore(date, i));
  const { data: previousRows } = await supabase
    .from('challenges')
    .select('*')
    .in('challenge_date', previousDates)
    .order('challenge_date', { ascending: false });

  const previousChallenges: PreviousChallenge[] = (previousRows || []).map(
    (row: ChallengeRow) => rowToPreviousChallenge(row)
  );

  // 3. Generate challenge
  const challenge = generateChallengeForDate(date, previousChallenges);

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
        word: challenge.word,
        harmony_rule: null,
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
      if (date) requestData.date = date;
      if (dates) requestData.dates = dates.split(',');
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
