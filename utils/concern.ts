import { riskFromScore } from "@/utils/assessmentTrend";

/**
 * Single source of truth for a student's assessment-derived concern level.
 *
 * Every administrator-facing concern/risk/priority display must read from
 * these helpers so that the same student is never shown as one level in one
 * screen and a different level in another. There is deliberately only ONE
 * calculation path here (plus a fallback that reuses the existing assessment
 * thresholds) — screens must not maintain their own concern formulas.
 */

export type ConcernLevel = "LOW" | "MEDIUM" | "HIGH";

/** The app-native risk level values stored on assessment records. */
export type AssessmentRiskLevel = "low" | "normal" | "high";

/**
 * A minimal shape exposing the canonical assessment result fields. Matches the
 * fields the admin aggregation (`StudentSummary`) already carries.
 */
export interface ConcernSource {
  latestRiskLevel?: AssessmentRiskLevel | string | null;
  latestTotalScore?: number | string | null;
}

/**
 * Normalizes an arbitrary value into a canonical concern level, or `null` when
 * the value is not a recognized concern. Unknown/empty values are never
 * silently coerced to LOW / MEDIUM / HIGH.
 */
export function normalizeConcernLevel(value: unknown): ConcernLevel | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  if (normalized === "LOW") return "LOW";
  if (normalized === "MEDIUM" || normalized === "MODERATE") return "MEDIUM";
  if (normalized === "HIGH") return "HIGH";
  return null;
}

/**
 * Maps the app-native assessment risk level value to a canonical concern level.
 */
export function riskLevelToConcern(
  riskLevel: unknown,
): ConcernLevel | null {
  if (typeof riskLevel !== "string") return null;
  const n = riskLevel.trim().toLowerCase();
  if (n === "low") return "LOW";
  if (n === "normal" || n === "medium" || n === "moderate") return "MEDIUM";
  if (n === "high") return "HIGH";
  return null;
}

/**
 * Returns the student's canonical concern level from their assessment data.
 *
 * The stored assessment result (`latestRiskLevel`) is authoritative. When a
 * level is missing but a score exists, the existing assessment thresholds are
 * applied via `riskFromScore`. Returns `null` when there is no valid
 * assessment-derived concern (callers should display these as "Not Assessed" /
 * "No assessment" — never as LOW).
 */
export function getStudentConcernLevel(
  student: ConcernSource | null | undefined,
): ConcernLevel | null {
  if (!student) return null;

  if (student.latestRiskLevel != null) {
    const fromLevel = normalizeConcernLevel(
      typeof student.latestRiskLevel === "string"
        ? student.latestRiskLevel
        : riskLevelToConcern(student.latestRiskLevel) ?? undefined,
    );
    if (fromLevel) return fromLevel;
  }

  if (student.latestTotalScore != null) {
    const score = Number(student.latestTotalScore);
    if (!Number.isNaN(score) && student.latestTotalScore !== "") {
      return riskLevelToConcern(riskFromScore(score));
    }
  }

  return null;
}

/**
 * Returns the student's canonical concern level using the app-native
 * `low | normal | high` representation so existing risk-badge rendering can
 * keep its labels. Derived from the exact same source as
 * `getStudentConcernLevel` — it can never disagree with it.
 */
export function getAssessmentRiskLevel(
  student: ConcernSource | null | undefined,
): AssessmentRiskLevel | null {
  const concern = getStudentConcernLevel(student);
  if (!concern) return null;
  if (concern === "HIGH") return "high";
  if (concern === "MEDIUM") return "normal";
  return "low";
}

/** True when the student is assessed and their concern is Medium or High. */
export function requiresAttention(
  student: ConcernSource | null | undefined,
): boolean {
  const concern = getStudentConcernLevel(student);
  return concern === "MEDIUM" || concern === "HIGH";
}
