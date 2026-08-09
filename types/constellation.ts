/**
 * Constellation Weaver data model.
 *
 * Stars are DERIVED from the student's existing journal entries. Nothing is
 * stored in a separate collection — a star is a pure projection of a journal,
 * so editing or deleting a journal automatically updates the constellation.
 *
 * Only lightweight metadata is projected onto a star; the journal content
 * itself stays in its existing journal document, referenced by journalId.
 */

export type StarType =
  | "dot"
  | "sparkle"
  | "fourPoint"
  | "fivePoint"
  | "cross"
  | "glow";

/** Normalized (0–1) position inside the sky container. */
export interface StarPosition {
  x: number;
  y: number;
}

/** A star projected from a single journal entry (never persisted). */
export interface ConstellationStar {
  /** The journal this star represents. */
  journalId: string;
  /** Journal title (metadata shown on selection). */
  title: string;
  /** Mood id from the journal. */
  mood: string;
  /** Mood display label. */
  moodLabel: string;
  /** Mood emoji. */
  moodEmoji: string;
  /** Journal category id — drives the star's celestial accent color. */
  category?: string;
  /** Category display name. */
  categoryName: string;
  /** Category emoji. */
  categoryEmoji: string;
  /** Original ISO timestamp (ordering + daily grouping). */
  createdAt: string;
  /** Normalized local calendar day in YYYY-MM-DD form. */
  date: string;
  /** Local clock time label, e.g. "8:32 AM". */
  timeLabel: string;
  /** 1-based position in the journaling journey (oldest = 1). */
  ordinal: number;
  /** Deterministic position derived from the journal id. */
  position: StarPosition;
  /** Deterministic visual variant derived from the journal id. */
  type: StarType;
  /** Celestial accent color from the journal category. */
  color: string;
  /** Softer halo used for the glow layers. */
  glowColor: string;
  /** True for the most recently created journal. */
  isNewest: boolean;
  /** True for milestone journals (1st, 5th, 10th, 20th, 30th, 50th…). */
  isMilestone: boolean;
  /** Short, safely truncated preview of the journal thoughts. */
  preview: string;
}
