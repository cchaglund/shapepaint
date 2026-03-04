export type ShapeType =
  | 'circle'
  | 'square'
  | 'triangle'
  | 'pentagon'
  | 'hexagon'
  | 'star'
  // Sophisticated shapes
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
  // Irregular abstract shapes
  | 'shard'
  | 'wedge'
  | 'fan'
  | 'hook'
  | 'wave'
  | 'crescent'
  | 'pill'
  | 'splinter'
  | 'chunk'
  // New mixed straight/curved shapes
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

export interface Shape {
  id: string;
  type: ShapeType;
  name: string;
  x: number;
  y: number;
  size: number;
  rotation: number;
  colorIndex: number; // Index into the daily colors array
  zIndex: number;
  flipX?: boolean; // Flip horizontally (mirror left/right)
  flipY?: boolean; // Flip vertically (mirror up/down)
  groupId?: string; // Optional group membership
  visible?: boolean; // Layer visibility (undefined = visible)
}

export interface ShapeGroup {
  id: string;
  name: string;
  isCollapsed: boolean;
  zIndex: number; // For ordering groups in the layer panel
  visible?: boolean; // Group visibility (undefined = visible)
}

export interface ChallengeShapeData {
  type: ShapeType;
  name: string;
  svg: string; // Normalized SVG path (viewBox 0 0 100 100)
}

export interface DailyChallenge {
  date: string; // YYYY-MM-DD format
  colors: string[];
  shapes: [ChallengeShapeData, ChallengeShapeData];
  word: string; // Daily word for creative inspiration
}

export interface CanvasState {
  shapes: Shape[];
  groups: ShapeGroup[];
  backgroundColorIndex: number | null; // null means transparent/white
  selectedShapeIds: Set<string>; // Set of selected shape IDs for multi-select
}

export interface ViewportState {
  zoom: number; // 1 = 100%, 0.5 = 50%, 2 = 200%
  panX: number; // Pan offset in SVG coordinates
  panY: number;
}

export interface AppState {
  challenge: DailyChallenge;
  canvas: CanvasState;
}

// Ranking types
export interface DailyRanking {
  id: string;
  challenge_date: string;
  submission_id: string;
  user_id: string;
  elo_score: number;
  final_rank: number | null;
  vote_count: number;
}

export interface RankingEntry {
  rank: number;
  submission_id: string;
  user_id: string;
  nickname: string;
  elo_score: number;
  vote_count: number;
  shapes: Shape[];
  groups?: ShapeGroup[];
  background_color_index: number | null;
}

export interface VotingStatus {
  vote_count: number;
  entered_ranking: boolean;
  seen_winner_announcement: boolean;
}

export interface VotingPair {
  submissionA: {
    id: string;
    user_id: string;
    shapes: Shape[];
    groups?: ShapeGroup[];
    background_color_index: number | null;
  };
  submissionB: {
    id: string;
    user_id: string;
    shapes: Shape[];
    groups?: ShapeGroup[];
    background_color_index: number | null;
  };
}
