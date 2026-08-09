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

/** Journal stars cycle through types so five journals never look identical. */
const JOURNAL_TYPE_CYCLE: StarType[] = [
  "tiny",
  "sparkle",
  "fourPoint",
  "fivePoint",
  "tiny",
  "sparkle",
  "bright",
];

export const selectJournalStarType = (index: number): StarType =>
  JOURNAL_TYPE_CYCLE[index % JOURNAL_TYPE_CYCLE.length];

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
  { count: 5, emoji: "🌱", title: "First Constellation" },
  { count: 10, emoji: "🌿", title: "Growing Constellation" },
  { count: 20, emoji: "🌟", title: "Radiant Sky" },
  { count: 30, emoji: "🌙", title: "Night Sky Watcher" },
  { count: 50, emoji: "🌌", title: "Cosmic Weaver" },
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
