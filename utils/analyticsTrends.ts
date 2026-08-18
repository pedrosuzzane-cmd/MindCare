/**
 * Analytics trend helpers for the MindCare admin dashboard.
 *
 * All trend calculations are computed dynamically from live student summaries —
 * nothing is hardcoded. Where a group is too small to protect privacy
 * (see analyticsPrivacy), values are suppressed rather than shown.
 */

import { MIN_ANALYTICS_GROUP_SIZE } from "@/utils/analyticsPrivacy";
import { getDepartmentCode } from "@/utils/departmentMeta";
import type { StudentSummary } from "@/services/adminFirestoreService";

export interface WellnessTrendPoint {
  /** ISO date label for the reporting window. */
  label: string;
  /** Average wellness score for the window, or null when suppressed. */
  averageWellness: number | null;
  /** Number of students with a score in the window, or null when suppressed. */
  sampleSize: number | null;
  /** True when the window sample is below the privacy threshold. */
  suppressed: boolean;
}

export interface ParticipationTrendPoint {
  label: string;
  /** Percentage of tracked students assessed in the window. */
  participationRate: number | null;
  sampleSize: number | null;
  suppressed: boolean;
}

export interface TrendAlert {
  kind: "up" | "down" | "flat" | "insufficient";
  title: string;
  description: string;
  delta?: number;
}

export interface RecommendedAction {
  title: string;
  description: string;
}

export interface FollowUpSummary {
  totalStudents: number;
  elevatedConcern: number;
  moderateConcern: number;
  lowerConcern: number;
  awaitingReview: number;
  inProgress: number;
  resolved: number;
}

export interface DepartmentTrendRow {
  department: string;
  studentCount: number;
  averageWellness: number | null;
  participationRate: number | null;
  journalEngagement: number | null;
  elevatedConcernCount: number | null;
  wellnessDelta: number | null;
  participationDelta: number | null;
  suppressed: boolean;
}

const RISK_LEVEL_TO_LABEL: Record<string, string> = {
  low: "lower concern",
  normal: "moderate concern",
  high: "elevated concern",
};

/** Round a value to the nearest 0.1 without trailing noise. */
function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function average(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return round1(nums.reduce((sum, n) => sum + n, 0) / nums.length);
}

/** Average of the latest wellness scores, or null when suppressed. */
export function averageWellness(students: StudentSummary[]): number | null {
  if (students.length < MIN_ANALYTICS_GROUP_SIZE) return null;
  const scores = students
    .map((s) => s.latestTotalScore)
    .filter((v): v is number => v != null);
  if (scores.length < MIN_ANALYTICS_GROUP_SIZE) return null;
  return average(scores);
}

/** Percentage of tracked students who have completed an assessment. */
export function participationRate(students: StudentSummary[]): number | null {
  if (students.length === 0) return null;
  if (students.length < MIN_ANALYTICS_GROUP_SIZE) return null;
  const assessed = students.filter((s) => s.assessmentsCount > 0).length;
  return round1((assessed / students.length) * 100);
}

/** Total journal entries across the cohort, or null when suppressed. */
export function journalEngagement(students: StudentSummary[]): number | null {
  if (students.length < MIN_ANALYTICS_GROUP_SIZE) return null;
  return students.reduce((sum, s) => sum + (s.journalCount || 0), 0);
}

/** Count of students whose latest risk level is high/elevated, or null when suppressed. */
export function elevatedConcernCount(students: StudentSummary[]): number | null {
  if (students.length < MIN_ANALYTICS_GROUP_SIZE) return null;
  return students.filter((s) => s.latestRiskLevel === "high").length;
}

/**
 * Build a wellness trend series from a list of students, bucketing their latest
 * assessment dates into `windowCount` trailing windows of `windowMs` each.
 */
export function buildWellnessTrend(
  students: StudentSummary[],
  windowMs: number,
  windowCount: number,
  now: Date = new Date(),
): WellnessTrendPoint[] {
  const points: WellnessTrendPoint[] = [];
  for (let i = windowCount - 1; i >= 0; i--) {
    const windowEnd = new Date(now.getTime() - i * windowMs);
    const windowStart = new Date(windowEnd.getTime() - windowMs);
    const inWindow = students.filter((s) => {
      if (!s.latestAssessmentDate) return false;
      const t = s.latestAssessmentDate.getTime();
      return t >= windowStart.getTime() && t < windowEnd.getTime();
    });
    const scores = inWindow
      .map((s) => s.latestTotalScore)
      .filter((v): v is number => v != null);
    const suppressed = inWindow.length < MIN_ANALYTICS_GROUP_SIZE;
    points.push({
      label: windowStart.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      averageWellness: suppressed ? null : average(scores),
      sampleSize: suppressed ? null : scores.length,
      suppressed,
    });
  }
  return points;
}

/**
 * Build a participation trend series: percentage of the cohort assessed within
 * each trailing window.
 */
export function buildParticipationTrend(
  students: StudentSummary[],
  windowMs: number,
  windowCount: number,
  now: Date = new Date(),
): ParticipationTrendPoint[] {
  const points: ParticipationTrendPoint[] = [];
  for (let i = windowCount - 1; i >= 0; i--) {
    const windowEnd = new Date(now.getTime() - i * windowMs);
    const windowStart = new Date(windowEnd.getTime() - windowMs);
    const inWindow = students.filter((s) => {
      if (!s.latestAssessmentDate) return false;
      const t = s.latestAssessmentDate.getTime();
      return t >= windowStart.getTime() && t < windowEnd.getTime();
    });
    const suppressed = inWindow.length < MIN_ANALYTICS_GROUP_SIZE;
    const rate = suppressed
      ? null
      : round1((inWindow.length / Math.max(students.length, 1)) * 100);
    points.push({
      label: windowStart.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      participationRate: rate,
      sampleSize: suppressed ? null : inWindow.length,
      suppressed,
    });
  }
  return points;
}

/**
 * Summarise the latest two trend points into an alert with direction and delta.
 * Returns an "insufficient" alert when either window lacks enough data.
 */
export function deriveTrendAlert(
  series: (WellnessTrendPoint | ParticipationTrendPoint)[],
  metricLabel: string,
): TrendAlert {
  const usable = series.filter((p) => !p.suppressed);
  const last = usable[usable.length - 1];
  const previous = usable[usable.length - 2];
  if (!last || !previous) {
    return {
      kind: "insufficient",
      title: `${metricLabel} — insufficient data`,
      description:
        "Not enough assessed students yet in the latest window to compare against the prior window. Values are withheld to protect privacy.",
    };
  }
  const lastVal =
    "averageWellness" in last
      ? (last.averageWellness as number | null)
      : ("participationRate" in last
          ? (last.participationRate as number | null)
          : null);
  const prevVal =
    "averageWellness" in previous
      ? (previous.averageWellness as number | null)
      : ("participationRate" in previous
          ? (previous.participationRate as number | null)
          : null);
  if (lastVal == null || prevVal == null) {
    return {
      kind: "insufficient",
      title: `${metricLabel} — insufficient data`,
      description:
        "Not enough assessed students in the latest window to compare. Values are withheld to protect privacy.",
    };
  }
  const delta = round1(lastVal - prevVal);
  const kind: "up" | "down" | "flat" =
    delta > 0.5 ? "up" : delta < -0.5 ? "down" : "flat";
  const direction =
    kind === "up"
      ? `increased by ${delta} points since the prior window`
      : kind === "down"
        ? `decreased by ${Math.abs(delta)} points since the prior window`
        : "stayed about the same since the prior window";
  return {
    kind,
    title: `${metricLabel} — ${kind === "flat" ? "steady" : kind === "up" ? "rising" : "declining"}`,
    description: `${metricLabel} ${direction}. Based on the latest ${last.sampleSize} students in this cohort.`,
    delta,
  };
}

/** Follow-up counters derived from a cohort of students. */
export function summarizeFollowUps(students: StudentSummary[]): FollowUpSummary {
  const elevated = students.filter(
    (s) => s.latestRiskLevel === "high",
  ).length;
  const moderate = students.filter(
    (s) => s.latestRiskLevel === "normal",
  ).length;
  const lower = students.filter(
    (s) => s.latestRiskLevel === "low",
  ).length;
  return {
    totalStudents: students.length,
    elevatedConcern: elevated,
    moderateConcern: moderate,
    lowerConcern: lower,
    awaitingReview: elevated,
    inProgress: 0,
    resolved: 0,
  };
}

/** Per-department trend rows with privacy suppression and deltas. */
export function buildDepartmentTrendRows(
  students: StudentSummary[],
  windowMs: number,
  now: Date = new Date(),
): DepartmentTrendRow[] {
  const byDept = new Map<string, StudentSummary[]>();
  students.forEach((s) => {
    const dept = getDepartmentCode(s.department || "Unspecified");
    const arr = byDept.get(dept) ?? [];
    arr.push(s);
    byDept.set(dept, arr);
  });

  const rows: DepartmentTrendRow[] = [];
  byDept.forEach((group, department) => {
    const suppressed = group.length < MIN_ANALYTICS_GROUP_SIZE;
    const current = group.filter(
      (s) =>
        s.latestAssessmentDate &&
        s.latestAssessmentDate.getTime() >= now.getTime() - windowMs,
    );
    const previous = group.filter(
      (s) =>
        s.latestAssessmentDate &&
        s.latestAssessmentDate.getTime() >= now.getTime() - 2 * windowMs &&
        s.latestAssessmentDate.getTime() < now.getTime() - windowMs,
    );
    const currentScores = current
      .map((s) => s.latestTotalScore)
      .filter((v): v is number => v != null);
    const previousScores = previous
      .map((s) => s.latestTotalScore)
      .filter((v): v is number => v != null);

    const wellnessDelta =
      suppressed || currentScores.length < MIN_ANALYTICS_GROUP_SIZE
        ? null
        : average(previousScores) == null
          ? null
          : round1((average(currentScores) as number) - (average(previousScores) as number));
    const participationDelta =
      suppressed || currentScores.length < MIN_ANALYTICS_GROUP_SIZE
        ? null
        : round1(
            (current.length / Math.max(group.length, 1)) * 100 -
              (previous.length / Math.max(group.length, 1)) * 100,
          );

    rows.push({
      department,
      studentCount: group.length,
      averageWellness: suppressed ? null : average(currentScores),
      participationRate: suppressed
        ? null
        : round1((current.length / Math.max(group.length, 1)) * 100),
      journalEngagement: suppressed
        ? null
        : group.reduce((sum, s) => sum + (s.journalCount || 0), 0),
      elevatedConcernCount: suppressed
        ? null
        : group.filter((s) => s.latestRiskLevel === "high").length,
      wellnessDelta,
      participationDelta,
      suppressed,
    });
  });

  return rows.sort((a, b) => b.studentCount - a.studentCount);
}

/**
 * Recommended administrative actions derived from the computed trends. These are
 * high-level, privacy-safe suggestions for the guidance office.
 */
export function buildRecommendedActions(
  wellnessTrend: TrendAlert,
  participationTrend: TrendAlert,
  deptRows: DepartmentTrendRow[],
): RecommendedAction[] {
  const actions: RecommendedAction[] = [];

  if (participationTrend.kind === "down") {
    actions.push({
      title: "Increase assessment participation",
      description:
        "Assessment participation is declining. Consider gentle outreach and reminder prompts so more students complete their periodic well-being check-in.",
    });
  } else if (participationTrend.kind === "up") {
    actions.push({
      title: "Acknowledge rising participation",
      description:
        "Participation is improving. Continue current outreach approaches and track whether the trend holds over the next reporting window.",
    });
  }

  if (wellnessTrend.kind === "down") {
    actions.push({
      title: "Review aggregate wellness supports",
      description:
        "Average wellness scores are trending down. The guidance office may review current group support programs and student-resource promotion.",
    });
  }

  const suppressed = deptRows.filter((r) => r.suppressed);
  if (suppressed.length > 0) {
    actions.push({
      title: "Protect small-group privacy",
      description: `${suppressed.length} department group(s) are below the minimum analytics size and their statistics are withheld to prevent re-identification. No action is required — this is automatic.`,
    });
  }

  if (actions.length === 0) {
    actions.push({
      title: "Continue routine monitoring",
      description:
        "No actionable aggregate changes were detected this period. Continue routine monitoring of wellness, participation, and journal engagement.",
    });
  }

  return actions;
}

export { RISK_LEVEL_TO_LABEL };
