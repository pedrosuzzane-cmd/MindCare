import { JournalEntry } from "@/services/journalService";
import { ConstellationStar, StarPosition, StarType } from "@/types/constellation";
import { getEntryDateIso } from "@/utils/constellationMonthUtils";
import { getCategory, getCategoryLabel, getMood } from "@/utils/journalOptions";

/**
 * Journal → Star projection. Everything here is DETERMINISTIC: a journal
 * always maps to the same position, color and shape, so the sky never shuffles
 * between renders. Stars are derived on the fly from the existing journals —
 * no separate constellation storage exists.
 */

/* ── Deterministic hashing ────────────────────────────────────────────── */

export const hashSeed = (id: string): number => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

/* ── Date normalization ───────────────────────────────────────────────── */

/**
 * Convert an ISO timestamp into the student's LOCAL calendar day (YYYY-MM-DD).
 * Two entries on the same day (08:32 vs 15:15) therefore share one date even
 * though their raw timestamps differ.
 */
export const normalizeJournalDate = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "unknown";
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
};

/** Render a normalized date as "August 8, 2026" in the local calendar. */
export const formatJournalDate = (date: string): string => {
  if (!date || date === "unknown") return "";
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) return "";
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
};

const timeLabelFor = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
};

/* ── Star appearance ──────────────────────────────────────────────────── */

export interface StarTypeConfig {
  glyph: string;
  /** Rendered font size in px. */
  sizePx: number;
  /** Base opacity used by the sky (glow layered on top). */
  opacity: number;
  glow: boolean;
}

export const STAR_TYPE_CONFIG: Record<StarType, StarTypeConfig> = {
  dot: { glyph: "·", sizePx: 7, opacity: 0.7, glow: false },
  sparkle: { glyph: "✧", sizePx: 10, opacity: 0.75, glow: false },
  fourPoint: { glyph: "✦", sizePx: 13, opacity: 0.85, glow: false },
  fivePoint: { glyph: "★", sizePx: 16, opacity: 0.9, glow: false },
  cross: { glyph: "✵", sizePx: 12, opacity: 0.8, glow: false },
  glow: { glyph: "🌟", sizePx: 22, opacity: 1, glow: true },
};

/** Ordinary variants; milestone journals use the special `glow` type. */
const STAR_VARIANTS: StarType[] = [
  "dot",
  "sparkle",
  "fourPoint",
  "fivePoint",
  "cross",
];

/** Journal ordinals that earn a visually distinct milestone star. */
export const MILESTONE_ORDINALS = [1, 5, 10, 20, 30, 50];

export const isMilestoneJournal = (ordinal: number): boolean =>
  MILESTONE_ORDINALS.includes(ordinal);

/** Deterministic star shape: milestone journals glow, the rest hash by id. */
export const starTypeFor = (journalId: string, ordinal: number): StarType => {
  if (isMilestoneJournal(ordinal)) return "glow";
  return STAR_VARIANTS[hashSeed(journalId) % STAR_VARIANTS.length];
};

/**
 * Celestial accent color per journal category. Kept deliberately soft so the
 * sky stays in MindCare's purple identity instead of turning arcade-bright.
 */
export const STAR_CATEGORY_COLORS: Record<string, string> = {
  personal: "#A78BFA",
  academic: "#60A5FA",
  wellness: "#86EFAC",
  emotions: "#F9A8D4",
  social: "#F9A8D4",
  family: "#FDBA74",
  goals: "#67E8F9",
  growth: "#86EFAC",
  gratitude: "#FDE68A",
  work: "#FDBA74",
  financial: "#67E8F9",
  spiritual: "#C4B5FD",
  life_events: "#67E8F9",
  other: "#E9E9EE",
};

export interface StarAppearance {
  color: string;
  glowColor: string;
}

export const getStarAppearance = (category?: string): StarAppearance => {
  const color = category
    ? STAR_CATEGORY_COLORS[category]
    : STAR_CATEGORY_COLORS.other;
  return { color, glowColor: color };
};

/* ── Deterministic positions ──────────────────────────────────────────── */

/**
 * A journal id hashes onto a stable, organically scattered spot in the sky.
 * Positions are a pure function of the journal id — no Math.random anywhere —
 * so a star never moves between renders, month switches or app reloads.
 * Stars written today keep their exact spot when revisited months later.
 */
export const positionFor = (journalId: string): StarPosition => {
  const marginX = 0.08;
  const marginY = 0.1;
  return {
    x: marginX + hashUnit(journalId, "x") * (1 - marginX * 2),
    y: marginY + hashUnit(journalId, "y") * (1 - marginY * 2),
  };
};

/** High-entropy 0–1 unit value derived from a salted id hash. */
const hashUnit = (value: string, salt: string): number =>
  ((hashSeed(`${value}:${salt}`) >>> 16) & 0xffff) / 0xffff;

/**
 * Clamp a position into the safe band the star glyphs render within (kept in
 * sync with the star component's own clamp so collision nudges never push a
 * star off-screen).
 */
const clampPosition = (pos: StarPosition): StarPosition => ({
  x: Math.min(0.95, Math.max(0.05, pos.x)),
  y: Math.min(0.94, Math.max(0.06, pos.y)),
});

const distanceBetween = (a: StarPosition, b: StarPosition): number =>
  Math.hypot(a.x - b.x, a.y - b.y);

/**
 * Minimum separation between any two journal-star centers (~12% of the sky).
 * Large enough for comfortable taps, small enough that very active months
 * (20–40 entries) still find room.
 */
export const MIN_STAR_DISTANCE = 0.12;

/** Euclidean distance from `pos` to its closest existing star. */
export const getMinimumDistance = (
  pos: StarPosition,
  existing: readonly StarPosition[],
): number => {
  let min = Infinity;
  for (const p of existing) {
    const d = distanceBetween(pos, p);
    if (d < min) min = d;
  }
  return min;
};

/**
 * True when `pos` keeps at least `minDistance` from every existing star.
 * Only journal-star centers count — decorative backdrop dots and constellation
 * lines never participate in collision detection.
 */
export const isPositionAvailable = (
  pos: StarPosition,
  existing: readonly StarPosition[],
  minDistance: number = MIN_STAR_DISTANCE,
): boolean =>
  existing.every((p) => distanceBetween(pos, p) >= minDistance);

/**
 * Deterministic candidate spots used when a month is so crowded that the
 * search below cannot find a clear position. The spot furthest from every
 * existing star wins, so the sky degrades gracefully instead of overlapping.
 */
const FALLBACK_POSITIONS: readonly StarPosition[] = [
  { x: 0.15, y: 0.15 },
  { x: 0.5, y: 0.15 },
  { x: 0.85, y: 0.15 },
  { x: 0.2, y: 0.4 },
  { x: 0.5, y: 0.4 },
  { x: 0.8, y: 0.4 },
  { x: 0.15, y: 0.65 },
  { x: 0.5, y: 0.65 },
  { x: 0.85, y: 0.65 },
  { x: 0.25, y: 0.85 },
  { x: 0.5, y: 0.85 },
  { x: 0.75, y: 0.85 },
];

export const findFallbackPosition = (
  existing: readonly StarPosition[],
): StarPosition =>
  [...FALLBACK_POSITIONS].sort(
    (a, b) => getMinimumDistance(b, existing) - getMinimumDistance(a, existing),
  )[0];

/** Bounded collision search before the fallback kicks in. */
const MAX_SEARCH_ATTEMPTS = 100;
/** Whole-sky scan used when the area around the base spot is saturated. */
const MAX_GLOBAL_ATTEMPTS = 450;
/** Golden angle — the deterministic sunflower spiral covers space organically. */
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/**
 * Spacing tiers, relaxed only as a last resort for genuinely crowded months.
 * Active students can otherwise exhaust the space at a strict 12% — stepping
 * down to 10% then 8% keeps stars separated (never overlapping) while still
 * giving every journal its own star. The lower tiers exist purely so extreme
 * months (90+ entries) still find distinct spots instead of stacking on the
 * fixed fallback slots.
 */
const DISTANCE_TIERS: readonly number[] = [
  MIN_STAR_DISTANCE,
  0.1,
  0.08,
  0.06,
  0.05,
];

/**
 * Deterministic whole-sky scan (sunflower disk large enough to reach every
 * corner of the safe band). Explored only when the spiral around the base
 * spot is saturated, so a crowded month spreads across the entire canvas
 * instead of stacking on the fixed fallback spots.
 */
const scanWholeSky = (
  placed: readonly StarPosition[],
  minDistance: number,
): StarPosition | null => {
  const step = 0.63 / Math.sqrt(MAX_GLOBAL_ATTEMPTS);
  for (let attempt = 1; attempt <= MAX_GLOBAL_ATTEMPTS; attempt++) {
    const radius = Math.sqrt(attempt) * step;
    const angle = attempt * GOLDEN_ANGLE;
    const candidate = clampPosition({
      x: 0.5 + Math.cos(angle) * radius,
      y: 0.5 + Math.sin(angle) * radius,
    });
    if (isPositionAvailable(candidate, placed, minDistance)) return candidate;
  }
  return null;
};

/**
 * Collision-aware placement. The base spot is used unchanged whenever it is
 * free. Otherwise a deterministic sunflower spiral spirals outward from the
 * base (bounded), then scans the whole sky, relaxing the spacing one tier at
 * a time only for genuinely crowded months. A completely full month finally
 * picks the furthest free candidate spot.
 *
 * Stars are resolved in chronological order, so older journals always keep
 * their claimed spot and newer ones are nudged around them — no randomness,
 * no re-render shuffling, and existing stars never move when one is added.
 */
export const resolvePosition = (
  base: StarPosition,
  placed: readonly StarPosition[],
): StarPosition => {
  for (const tier of DISTANCE_TIERS) {
    const baseClamped = clampPosition(base);
    if (isPositionAvailable(baseClamped, placed, tier)) return baseClamped;

    const step = tier * 0.75;
    for (let attempt = 1; attempt <= MAX_SEARCH_ATTEMPTS; attempt++) {
      const radius = Math.sqrt(attempt) * step;
      const angle = attempt * GOLDEN_ANGLE;
      const candidate = clampPosition({
        x: baseClamped.x + Math.cos(angle) * radius,
        y: baseClamped.y + Math.sin(angle) * radius,
      });
      if (isPositionAvailable(candidate, placed, tier)) return candidate;
    }

    const global = scanWholeSky(placed, tier);
    if (global) return global;
  }
  return findFallbackPosition(placed);
};

/* ── Journal → star projection ────────────────────────────────────────── */

const PREVIEW_LIMIT = 140;

const truncateText = (text: string): string => {
  const cleaned = (text || "").replace(/\s+/g, " ").trim();
  if (cleaned.length <= PREVIEW_LIMIT) return cleaned;
  return `${cleaned.slice(0, PREVIEW_LIMIT).trimEnd()}…`;
};

/**
 * Project every journal entry into a star. Pure and deterministic: the same
 * set of journals always produces the same sky. Editing or deleting a journal
 * is automatically reflected the next time this runs.
 */
export const buildConstellationStars = (
  entries: JournalEntry[],
): ConstellationStar[] => {
  const sorted = [...entries].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
  const newestId = sorted.length ? sorted[sorted.length - 1].id : undefined;

  const projected = sorted.map((entry, index) => {
    const ordinal = index + 1;
    const mood = getMood(entry.mood);
    const category = getCategory(entry.category);
    const appearance = getStarAppearance(entry.category);
    return {
      journalId: entry.id,
      title: entry.title,
      mood: entry.mood,
      moodLabel: mood?.label ?? entry.mood,
      moodEmoji: mood?.emoji ?? "❓",
      category: entry.category,
      categoryName: getCategoryLabel(entry.category, entry.customCategory),
      categoryEmoji: category?.emoji ?? "✦",
      createdAt: entry.createdAt,
      date: normalizeJournalDate(getEntryDateIso(entry)),
      timeLabel: timeLabelFor(entry.createdAt),
      ordinal,
      position: positionFor(entry.id),
      type: starTypeFor(entry.id, ordinal),
      color: appearance.color,
      glowColor: appearance.glowColor,
      isNewest: entry.id === newestId,
      isMilestone: isMilestoneJournal(ordinal),
      preview: truncateText(entry.thoughts),
    };
  });

  // Resolve overlaps deterministically: earlier (older) stars claim their spot
  // first, and later stars are nudged only when they collide with one already
  // placed. The result is stable across every render.
  const placed: StarPosition[] = [];
  return projected.map((star) => {
    const position = resolvePosition(star.position, placed);
    placed.push(position);
    if (__DEV__) {
      const minDistance = getMinimumDistance(position, placed.slice(0, -1));
      console.log(
        `[constellation] Star ${star.journalId}: (${position.x.toFixed(
          3,
        )}, ${position.y.toFixed(3)}), min distance ${
          Number.isFinite(minDistance) ? minDistance.toFixed(3) : "n/a"
        }`,
      );
    }
    return { ...star, position };
  });
};

/* ── Milestones ────────────────────────────────────────────────────────── */

export interface JournalMilestone {
  count: number;
  emoji: string;
  title: string;
}

export const JOURNAL_MILESTONES: JournalMilestone[] = [
  { count: 1, emoji: "🌟", title: "First Light" },
  { count: 5, emoji: "✨", title: "Growing Sky" },
  { count: 10, emoji: "💜", title: "Heart Constellation" },
  { count: 20, emoji: "📖", title: "Open Book" },
  { count: 30, emoji: "🌙", title: "Dreaming Moon" },
  { count: 50, emoji: "🌌", title: "MindCare Galaxy" },
];

export interface MilestoneProgress {
  next: JournalMilestone;
  reachedAll: boolean;
  remaining: number;
  progress: number;
}

export const nextMilestoneFor = (journalCount: number): MilestoneProgress => {
  const next =
    JOURNAL_MILESTONES.find((m) => journalCount < m.count) ??
    JOURNAL_MILESTONES[JOURNAL_MILESTONES.length - 1];
  const reachedAll = journalCount >= next.count;
  return {
    next,
    reachedAll,
    remaining: Math.max(0, next.count - journalCount),
    progress: Math.min(1, journalCount / next.count),
  };
};

/* ── Atmosphere ─────────────────────────────────────────────────────────── */

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
