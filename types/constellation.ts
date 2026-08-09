/**
 * Constellation Weaver data model.
 *
 * A star is the smallest unit of the student's personal night sky. Every
 * qualifying journal creates exactly one star (idempotent by journalId).
 * Stars only store minimal, non-content metadata — the journal content itself
 * stays in its existing journal document and is referenced by journalId.
 */

export type StarType =
  | "tiny"
  | "sparkle"
  | "fourPoint"
  | "fivePoint"
  | "bright"
  | "special"
  | "cluster";

export type StarBrightness = "dim" | "soft" | "bright" | "veryBright" | "special";

export type StarSize = "tiny" | "small" | "medium" | "large" | "special";

export type StarSource = "journal" | "gratitude" | "achievement" | "milestone";

export type ConstellationSyncStatus = "synced" | "pending" | "syncing" | "failed";

/** Normalized (0–1) position inside the sky container. */
export interface StarPosition {
  x: number;
  y: number;
}

export interface ConstellationStar {
  /** Stable star id. Derived from the journal id so writes are idempotent. */
  id: string;
  studentId: string;
  /** The journal that created this star. */
  journalId: string;
  /** Journal category id — drives the star's celestial accent color. */
  category?: string;
  /** True while the newly created star should play its one-time entrance. */
  highlight?: boolean;
  type: StarType;
  size: StarSize;
  brightness: StarBrightness;
  position: StarPosition;
  source: StarSource;
  /** Which constellation group this star belongs to. */
  constellationId: string;
  /** Set when the star was earned from an achievement unlock. */
  achievementId?: string;
  /** Set when the star was earned from a journal-count milestone. */
  milestoneCount?: number;
  createdAt: string; // ISO 8601
  syncStatus: ConstellationSyncStatus;
}
