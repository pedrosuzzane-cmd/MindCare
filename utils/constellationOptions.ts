import { StarType, StarSize, StarBrightness, StarPosition } from "@/types/constellation";

/**
 * Controlled star system. Every star appearance is driven by a config here
 * instead of being hard-coded in the screen, so the sky stays consistent.
 */

export interface StarTypeConfig {
  glyph: string;
  /** Rendered font size in px. */
  sizePx: number;
  /** Base opacity used by the sky (brightness is layered on top). */
  opacity: number;
  glow: boolean;
  /** Warm golden tint reserved for special stars. */
  gold?: boolean;
  /** Renders as a small group of tiny stars instead of a single glyph. */
  cluster?: boolean;
}

export const STAR_TYPE_CONFIG: Record<StarType, StarTypeConfig> = {
  tiny: { glyph: "·", sizePx: 5, opacity: 0.5, glow: false },
  sparkle: { glyph: "✧", sizePx: 9, opacity: 0.6, glow: false },
  fourPoint: { glyph: "✦", sizePx: 12, opacity: 0.8, glow: false },
  fivePoint: { glyph: "★", sizePx: 15, opacity: 0.9, glow: false },
  bright: { glyph: "🌟", sizePx: 18, opacity: 1, glow: true },
  special: { glyph: "🌟", sizePx: 26, opacity: 1, glow: true, gold: true },
  cluster: { glyph: "·", sizePx: 7, opacity: 0.6, glow: false, cluster: true },
};

export const STAR_COLORS = {
  white: "#FFFFFF",
  lavender: "#E9DFFF",
  paleViolet: "#CBB8F5",
  lightPurple: "#B79FE8",
  gold: "#FFD98A",
};

/**
 * Celestial accent color per journal category. Kept deliberately soft so the
 * sky stays in MindCare's dark purple identity instead of turning arcade-bright.
 */
export const STAR_CATEGORY_COLORS: Record<string, string> = {
  personal: "#A78BFA",
  academic: "#60A5FA",
  wellness: "#86EFAC",
  emotions: "#F9A8D4",
  social: "#F9A8D4",
  family: "#FDBA74",
  goals: "#818CF8",
  growth: "#86EFAC",
  gratitude: "#FDE68A",
  work: "#FDBA74",
  financial: "#67E8F9",
  spiritual: "#C4B5FD",
  life_events: "#67E8F9",
  other: "#67E8F9",
};

/** Resolve a category id to its celestial accent, if known. */
export const starCategoryColor = (category?: string): string | undefined =>
  category ? STAR_CATEGORY_COLORS[category] : undefined;

export const STAR_BRIGHTNESS_OPACITY: Record<StarBrightness, number> = {
  dim: 0.35,
  soft: 0.6,
  bright: 0.85,
  veryBright: 1,
  special: 1,
};

export const STAR_SIZE_LABEL: Record<StarType, StarSize> = {
  tiny: "tiny",
  sparkle: "small",
  fourPoint: "medium",
  fivePoint: "large",
  bright: "large",
  special: "special",
  cluster: "tiny",
};

/**
 * Deterministic brightness per type so brightness never fights the glyph.
 * Special stars keep the "special" brightness for the glow effect.
 */
export const STAR_BRIGHTNESS: Record<StarType, StarBrightness> = {
  tiny: "dim",
  sparkle: "soft",
  fourPoint: "bright",
  fivePoint: "veryBright",
  bright: "veryBright",
  special: "special",
  cluster: "soft",
};

/**
 * Predefined normalized positions spread across the sky. Using a fixed,
 * balanced set (rather than pure randomness) keeps stars from overlapping,
 * leaving the screen, or clustering into an unbalanced layout.
 */
const buildPositions = (): StarPosition[] => {
  const positions: StarPosition[] = [];
  const rows = 8;
  const cols = 9;
  for (let r = 0; r < rows; r++) {
    const offset = r % 2 === 0 ? 0 : (1 / cols) * 0.5;
    for (let c = 0; c < cols; c++) {
      positions.push({
        x: offset + c / cols,
        y: 0.1 + (r / rows) * 0.8,
      });
    }
  }
  return positions;
};

export const STAR_POSITIONS: StarPosition[] = buildPositions();

/**
 * Journal stars cycle through a controlled distribution so consecutive stars
 * never look identical: small 35%, normal 35%, bright 15%, sparkle 10%,
 * special 5%. The cycle is index-driven so every journal maps to a stable type.
 */
const JOURNAL_TYPE_CYCLE: StarType[] = [
  // small (35%)
  "tiny", "tiny", "tiny", "tiny", "tiny", "tiny", "tiny",
  // normal (35%) — mix of four-point and five-point
  "fourPoint", "fivePoint", "fourPoint", "fourPoint", "fivePoint", "fourPoint", "fivePoint",
  // bright (15%)
  "bright", "bright", "bright",
  // sparkle (10%)
  "sparkle", "sparkle",
  // special (5%)
  "special",
];

export const selectJournalStarType = (index: number): StarType =>
  JOURNAL_TYPE_CYCLE[index % JOURNAL_TYPE_CYCLE.length];

/**
 * Journals that earn a visually distinct special star: the very first one,
 * then every ~dozen journals (10th, 25th, 50th).
 */
export const isMilestoneJournal = (index: number): boolean =>
  index === 0 || index === 9 || index === 24 || index === 49;

/**
 * Deterministic tiny jitter derived from a string id. Gives each star a small
 * individual offset without randomness, so positions stay stable across renders.
 */
export const positionJitterFor = (seed: string): { dx: number; dy: number } => {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const dx = ((Math.abs(hash) % 100) / 100) * 0.04 - 0.02;
  const dy = ((Math.abs(hash >> 8) % 100) / 100) * 0.04 - 0.02;
  return { dx, dy };
};

export const nextStarPosition = (starCount: number, seed: string): StarPosition => {
  const base = STAR_POSITIONS[starCount % STAR_POSITIONS.length];
  const { dx, dy } = positionJitterFor(seed);
  return {
    x: Math.min(0.96, Math.max(0.04, base.x + dx)),
    y: Math.min(0.94, Math.max(0.08, base.y + dy)),
  };
};

/** Constellation group a star belongs to. */
export const CONSTELLATION_ID: Record<string, string> = {
  journal: "reflection",
  gratitude: "gratitude",
  achievement: "achievements",
  milestone: "milestones",
};

/** Journal-count milestones. Reaching one earns a bright nova in the sky. */
export interface JournalMilestone {
  count: number;
  emoji: string;
  title: string;
}

export const JOURNAL_MILESTONES: JournalMilestone[] = [
  { count: 1, emoji: "✨", title: "First Light" },
  { count: 5, emoji: "✦", title: "Little Dipper" },
  { count: 10, emoji: "♡", title: "Heart Constellation" },
  { count: 20, emoji: "📖", title: "Open Book" },
  { count: 30, emoji: "🌙", title: "Crescent Moon" },
  { count: 50, emoji: "🌠", title: "Star Path" },
  { count: 100, emoji: "🌌", title: "MindCare Galaxy" },
];

// ── Atmosphere ────────────────────────────────────────────────────────────

const hexToRgb = (hex: string): [number, number, number] => {
  const h = hex.replace("#", "");
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  const num = parseInt(full, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
};

/** Blend hexA toward hexB by weightB (0 = pure hexA, 1 = pure hexB). */
const mixColors = (hexA: string, hexB: string, weightB: number): string => {
  const [r1, g1, b1] = hexToRgb(hexA);
  const [r2, g2, b2] = hexToRgb(hexB);
  const r = Math.round(r1 * (1 - weightB) + r2 * weightB);
  const g = Math.round(g1 * (1 - weightB) + g2 * weightB);
  const b = Math.round(b1 * (1 - weightB) + b2 * weightB);
  return `rgb(${r}, ${g}, ${b})`;
};

const MOOD_SKY_BASE = {
  dark: { top: "#241C40", mid: "#1A1230", bottom: "#0F0B1E" },
  light: { top: "#4A3B78", mid: "#3B2E63", bottom: "#2A2152" },
} as const;

/**
 * Tints the night sky toward the student's latest journal mood. The mood hue
 * is strongest at the top of the sky and fades into the base night color at
 * the bottom, so the sky stays readable in both themes.
 */
export const moodSkyColors = (
  moodColor: string,
  mode: "dark" | "light",
): readonly [string, string, string] => {
  const base = MOOD_SKY_BASE[mode];
  const weight = mode === "dark" ? 0.5 : 0.42;
  return [
    mixColors(moodColor, base.top, weight),
    mixColors(moodColor, base.mid, weight + 0.12),
    base.bottom,
  ];
};

export interface SeasonInfo {
  key: "spring" | "summer" | "autumn" | "winter";
  emoji: string;
  label: string;
  colors: readonly [string, string, string];
  opacity: number;
}

/** Current Northern-hemisphere season, used as a subtle ambient overlay. */
export const currentSeason = (): SeasonInfo => {
  const month = new Date().getMonth();
  if (month >= 2 && month <= 4) {
    return {
      key: "spring",
      emoji: "🌸",
      label: "Spring",
      colors: ["#F8BBD0", "#A8D8B9", "#0F0B1E"],
      opacity: 0.16,
    };
  }
  if (month >= 5 && month <= 7) {
    return {
      key: "summer",
      emoji: "☀️",
      label: "Summer",
      colors: ["#FFE0B2", "#FFCC80", "#0F0B1E"],
      opacity: 0.14,
    };
  }
  if (month >= 8 && month <= 10) {
    return {
      key: "autumn",
      emoji: "🍂",
      label: "Autumn",
      colors: ["#FFCC80", "#D9822B", "#0F0B1E"],
      opacity: 0.16,
    };
  }
  return {
    key: "winter",
    emoji: "❄️",
    label: "Winter",
    colors: ["#B3D9FF", "#7FA8D9", "#0F0B1E"],
    opacity: 0.18,
  };
};
