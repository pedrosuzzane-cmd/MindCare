export const ASSESSMENT_INTERVAL_DAYS = 30;
export const ASSESSMENT_INTERVAL_LABEL = "Monthly";

export interface TrendAssessment {
  createdAt: Date;
  totalScore: number;
  riskLevel?: string;
  uid?: string;
}

export interface AssessmentBucket {
  label: string;
  startDate: Date;
  endDate: Date;
  scores: number[];
  riskLevels: string[];
  avgScore: number;
  count: number;
  isLatest: boolean;
}

export function bucketAssessments<T extends TrendAssessment>(
  assessments: T[],
  intervalDays: number = ASSESSMENT_INTERVAL_DAYS,
): AssessmentBucket[] {
  if (assessments.length === 0) return [];

  const sorted = [...assessments].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  );

  const buckets: AssessmentBucket[] = [];
  const bucketStart = new Date(sorted[0].createdAt);
  bucketStart.setHours(0, 0, 0, 0);
  const bucketEnd = new Date(bucketStart);
  bucketEnd.setDate(bucketEnd.getDate() + intervalDays - 1);

  let current: AssessmentBucket | null = null;

  for (const a of sorted) {
    while (a.createdAt > bucketEnd) {
      if (current) buckets.push(current);
      bucketStart.setDate(bucketStart.getDate() + intervalDays);
      bucketEnd.setDate(bucketEnd.getDate() + intervalDays);
      current = null;
    }
    if (!current) {
      current = {
        label: bucketStart.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        startDate: new Date(bucketStart),
        endDate: new Date(bucketEnd),
        scores: [],
        riskLevels: [],
        avgScore: 0,
        count: 0,
        isLatest: false,
      };
    }
    current.scores.push(a.totalScore);
    current.riskLevels.push(a.riskLevel || "low");
  }
  if (current) buckets.push(current);

  buckets.forEach((b, idx) => {
    b.avgScore = Math.round(
      b.scores.reduce((sum, s) => sum + s, 0) / b.scores.length,
    );
    b.isLatest = idx === buckets.length - 1;
  });

  return buckets;
}

export function riskFromScore(score: number): "low" | "normal" | "high" {
  if (score >= 51) return "high";
  if (score >= 21) return "normal";
  return "low";
}
