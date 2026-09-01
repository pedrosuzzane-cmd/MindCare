import { db } from "@/constants/firebase";
import { collection, getDocs } from "firebase/firestore";
import { riskFromScore } from "@/utils/assessmentTrend";
import {
  getDepartmentCode,
  canonicalDeptName,
} from "@/utils/departmentMeta";
import { getStudentConcernLevel, type ConcernLevel } from "@/utils/concern";
import { moodWellnessScore, moodBucket } from "@/utils/moodScoring";
import {
  academicYearLabel,
  academicYearFor,
  previousPeriodOf,
  type ReportPeriodInfo,
  type ReportPeriodType,
} from "@/utils/academicCalendar";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type NotAssessedConcern = null;

export interface ReportStudent {
  uid: string;
  name: string;
  schoolId: string;
  yearLevel: string;
  departmentCode: string;
  isLSN: boolean;
  concernLevel: ConcernLevel | NotAssessedConcern;
  latestTotalScore?: number;
  latestAssessmentDate?: Date;
  assessmentsCount: number;
  journalCount: number;
  moodEntries: number;
  moodScoreAvg: number;
  surveyCount: number;
}

export interface ConcernDistribution {
  low: number;
  medium: number;
  high: number;
  notAssessed: number;
}

export interface AttentionRequiredInfo {
  count: number;
  medium: number;
  high: number;
}

export interface DepartmentReportRow {
  code: string;
  name: string;
  totalStudents: number;
  low: number;
  medium: number;
  high: number;
  attentionRequired: number;
  assessmentCount: number;
  moodEntries: number;
  journalEntries: number;
  surveyResponses: number;
}

export interface AssessmentReportRow {
  type: string;
  count: number;
  avgScore: number;
  low: number;
  medium: number;
  high: number;
}

export interface MoodDistributionRow {
  mood: string;
  count: number;
}

export interface MoodReport {
  totalEntries: number;
  avgScore: number;
  mostCommon?: string;
  distribution: MoodDistributionRow[];
  positive: number;
  neutral: number;
  distressed: number;
}

export interface JournalReport {
  totalEntries: number;
  activeUsers: number;
  avgPerStudent: number;
  positive: number;
  neutral: number;
  negative: number;
}

export interface SurveyQuestionSummary {
  question: string;
  responses: number;
}

export interface SurveyReport {
  totalResponses: number;
  activeStudents: number;
  responseRate: number;
  questionSummaries: SurveyQuestionSummary[];
}

export interface TrendRow {
  label: string;
  current: number;
  previous: number;
  changePct: number; // ((current - previous) / previous) * 100, or 0 when not comparable
  direction: "up" | "down" | "stable";
  /**
   * True when the previous period had a non-zero baseline, so `changePct` is
   * meaningful. When false, `previous` was 0 and the delta must be shown as
   * "N/A" (never Infinity% / NaN%).
   */
  comparable: boolean;
}

export interface OverviewInfo {
  totalStudents: number;
  trackedStudents: number;
  activeStudents: number;
  lowConcern: number;
  mediumConcern: number;
  highConcern: number;
  attentionRequired: number;
  assessed: number;
  completionRate: number;
  totalAssessments: number;
  totalJournals: number;
  totalMoodEntries: number;
  totalSurveys: number;
}

export interface ReportData {
  period: ReportPeriodInfo;
  periodType: ReportPeriodType;
  academicYearLabel: string;
  trimesterLabel: string | null;
  departmentFilter: { code: string; name: string } | null;
  generatedAt: Date;
  institutionName: string;
  reportTitle: string;
  periodLabel: string;
  preparedBy: string;
  overview: OverviewInfo;
  concernDistribution: ConcernDistribution;
  attentionRequired: AttentionRequiredInfo;
  departmentData: DepartmentReportRow[];
  assessmentData: AssessmentReportRow[];
  moodData: MoodReport;
  journalData: JournalReport;
  surveyData: SurveyReport;
  studentLookup: ReportStudent[];
  trendComparison: TrendRow[];
  validation: {
    lowPlusMediumPlusHigh: number;
    attentionMatches: boolean;
    deptTotalMatches: boolean;
  };
}

export interface GenerateReportParams {
  periodType: ReportPeriodType;
  startDate: Date;
  endDate: Date; // exclusive
  periodLabel: string;
  departmentCode?: string;
}

// ---------------------------------------------------------------------------
// Internal raw types
// ---------------------------------------------------------------------------

interface RawStudent {
  uid: string;
  name: string;
  schoolId: string;
  yearLevel: string;
  department: string;
  isLSN: boolean;
}

interface RawAssessment {
  uid: string;
  totalScore: number;
  riskLevel?: string;
  createdAt: Date;
}

interface RawJournal {
  uid: string;
  mood?: string;
  sentiment?: "positive" | "neutral" | "negative";
  createdAt: Date;
}

function toDate(value: unknown): Date {
  if (!value) return new Date(0);
  if (value instanceof Date) return value;
  if (typeof value === "object" && value !== null && "toDate" in value) {
    return (value as { toDate: () => Date }).toDate();
  }
  if (typeof value === "number") return new Date(value);
  return new Date(0);
}

const DEPT_FULL_NAMES: Record<string, string> = {
  CITCS: "College of Information Technology and Computer Science",
  COA: "College of Accountancy",
  CBA: "College of Business Administration",
  CCJE: "College of Criminal Justice Education",
  COE: "College of Engineering",
  CAFA: "College of Architecture and Fine Arts",
  CAS: "College of Arts and Sciences",
  CTE: "College of Teacher Education",
  CHTM: "College of Hospitality and Tourism Management",
  CON: "College of Nursing",
};

function deptName(code: string): string {
  return DEPT_FULL_NAMES[code] ?? canonicalDeptName(code, code);
}

// ---------------------------------------------------------------------------
// Firestore fetch
// ---------------------------------------------------------------------------

/**
 * Fetches the raw, DATED records required for a report in a single pass.
 * Only records whose `createdAt` falls within [startDate, endDate) are kept.
 */
async function fetchRawDataset(
  startDate: Date,
  endDate: Date,
  departmentCode?: string,
  limit?: number,
): Promise<{
  students: RawStudent[];
  assessments: RawAssessment[];
  journals: RawJournal[];
  surveyCounts: Map<string, number>;
}> {
  const usersSnap = await getDocs(collection(db, "users"));
  const studentDocs = usersSnap.docs.filter((d) => {
    if (d.data().role === "admin") return false;
    if (departmentCode) {
      return getDepartmentCode(d.data().department) === departmentCode;
    }
    return true;
  });

  // Pagination cap to avoid unbounded downloads; the caller decides the limit.
  const docs = limit ? studentDocs.slice(0, limit) : studentDocs;

  const surveyCounts = new Map<string, number>();

  const perStudent = await Promise.all(
    docs.map(async (doc) => {
      const data = doc.data();
      const uid = doc.id;

      const [assessmentSnap, journalSnap, surveySnap] = await Promise.all([
        getDocs(collection(db, "users", uid, "selfAssessments")),
        getDocs(collection(db, "users", uid, "journalEntries")),
        getDocs(collection(db, "users", uid, "initialProfileSurveys")),
      ]);

      const assessments: RawAssessment[] = [];
      for (const aDoc of assessmentSnap.docs) {
        const a = aDoc.data();
        const createdAt = toDate(a.createdAt);
        if (createdAt.getTime() < startDate.getTime()) continue;
        if (createdAt.getTime() >= endDate.getTime()) continue;
        const totalScore = Number(a.totalScore) || 0;
        assessments.push({
          uid,
          totalScore,
          riskLevel: typeof a.riskLevel === "string" ? a.riskLevel : undefined,
          createdAt,
        });
      }

      const journals: RawJournal[] = [];
      for (const jDoc of journalSnap.docs) {
        const j = jDoc.data();
        const createdAt = toDate(j.createdAt);
        if (createdAt.getTime() < startDate.getTime()) continue;
        if (createdAt.getTime() >= endDate.getTime()) continue;
        journals.push({
          uid,
          mood: typeof j.mood === "string" ? j.mood : undefined,
          sentiment: j.reflectionLocal?.sentiment,
          createdAt,
        });
      }

      let surveyCount = 0;
      for (const sDoc of surveySnap.docs) {
        const s = sDoc.data();
        const createdAt = toDate(s.createdAt);
        if (createdAt.getTime() < startDate.getTime()) continue;
        if (createdAt.getTime() >= endDate.getTime()) continue;
        surveyCount += 1;
      }
      if (surveyCount > 0) surveyCounts.set(uid, surveyCount);

      return {
        student: {
          uid,
          name: data.fullName || "Unknown Student",
          schoolId: data.schoolId || "N/A",
          yearLevel: data.yearLevel || "N/A",
          department: data.department || "Unspecified",
          isLSN: !!data.isLSN,
        },
        assessments,
        journals,
      };
    }),
  );

  const students = perStudent.map((p) => p.student);
  const assessments = perStudent.flatMap((p) => p.assessments);
  const journals = perStudent.flatMap((p) => p.journals);

  return { students, assessments, journals, surveyCounts };
}

// ---------------------------------------------------------------------------
// Concern helpers (reuse canonical logic)
// ---------------------------------------------------------------------------

function concernForAssessments(assessments: RawAssessment[]): {
  concern: ConcernLevel | null;
  latestScore?: number;
  latestDate?: Date;
} {
  if (assessments.length === 0) {
    return { concern: null };
  }
  const latest = assessments.reduce((a, b) =>
    a.createdAt.getTime() >= b.createdAt.getTime() ? a : b,
  );
  const risk =
    latest.riskLevel === "low" ||
    latest.riskLevel === "normal" ||
    latest.riskLevel === "high"
      ? latest.riskLevel
      : riskFromScore(latest.totalScore);
  const concern = getStudentConcernLevel({
    latestRiskLevel: risk,
    latestTotalScore: latest.totalScore,
  });
  return { concern, latestScore: latest.totalScore, latestDate: latest.createdAt };
}

/** Best-effort sentiment bucket for a journal entry that has no stored sentiment. */
function sentimentFromMood(mood?: string): "positive" | "neutral" | "negative" {
  if (!mood) return "neutral";
  const m = moodBucket(mood);
  if (m === "positive") return "positive";
  if (m === "neutral") return "neutral";
  return "negative";
}

function avgStudentMood(journals: RawJournal[]): number {
  if (journals.length === 0) return 0;
  const sum = journals.reduce(
    (acc, j) => acc + moodWellnessScore(j.mood),
    0,
  );
  return +(sum / journals.length).toFixed(2);
}

// ---------------------------------------------------------------------------
// Aggregation
// ---------------------------------------------------------------------------

function buildReport(
  period: ReportPeriodInfo,
  raw: {
    students: RawStudent[];
    assessments: RawAssessment[];
    journals: RawJournal[];
    surveyCounts: Map<string, number>;
  },
  preparedBy: string,
  departmentCode?: string,
): ReportData {
  const { students, assessments, journals, surveyCounts } = raw;

  // Group by student
  const byUid = new Map<
    string,
    { student: RawStudent; assessments: RawAssessment[]; journals: RawJournal[] }
  >();
  for (const s of students) {
    byUid.set(s.uid, { student: s, assessments: [], journals: [] });
  }
  for (const a of assessments) {
    byUid.get(a.uid)?.assessments.push(a);
  }
  for (const j of journals) {
    byUid.get(j.uid)?.journals.push(j);
  }

  const reportStudents: ReportStudent[] = [];
  const deptAcc = new Map<
    string,
    {
      low: number;
      medium: number;
      high: number;
      notAssessed: number;
      assessments: number;
      journals: number;
      moods: number;
      surveys: number;
    }
  >();

  let low = 0;
  let medium = 0;
  let high = 0;
  let notAssessed = 0;
  let activeStudents = 0;
  let assessedStudents = 0;
  let totalAssessments = 0;
  let totalJournals = 0;
  let totalMoodEntries = 0;
  let totalSurveys = 0;

  const moodCounts: Record<string, number> = {};
  let positive = 0;
  let neutral = 0;
  let distressed = 0;
  let positiveJournal = 0;
  let neutralJournal = 0;
  let negativeJournal = 0;
  let journalActiveUsers = 0;
  const allMoodScores: number[] = [];

  for (const { student, assessments: sAssess, journals: sJournals } of byUid.values()) {
    const code = getDepartmentCode(student.department);
    const moodEntries = sJournals.length;
    totalJournals += sJournals.length;
    totalMoodEntries += moodEntries;

    for (const j of sJournals) {
      if (j.mood != null) {
        moodCounts[j.mood] = (moodCounts[j.mood] || 0) + 1;
        const wellness = moodWellnessScore(j.mood);
        allMoodScores.push(wellness);
      }
      const bucket = j.sentiment ? j.sentiment : sentimentFromMood(j.mood);
      if (bucket === "positive") positiveJournal += 1;
      else if (bucket === "neutral") neutralJournal += 1;
      else negativeJournal += 1;
    }
    if (sJournals.length > 0) journalActiveUsers += 1;

    const { concern, latestScore, latestDate } = concernForAssessments(sAssess);
    totalAssessments += sAssess.length;
    if (sAssess.length > 0) assessedStudents += 1;

    const surveyCount = surveyCounts.get(student.uid) ?? 0;
    totalSurveys += surveyCount;

    if (sAssess.length > 0 || sJournals.length > 0 || surveyCount > 0) {
      activeStudents += 1;
    }

    let concernLevel: ConcernLevel | NotAssessedConcern = null;
    if (concern === "LOW") {
      concernLevel = "LOW";
      low += 1;
    } else if (concern === "MEDIUM") {
      concernLevel = "MEDIUM";
      medium += 1;
    } else if (concern === "HIGH") {
      concernLevel = "HIGH";
      high += 1;
    } else {
      notAssessed += 1;
    }

    reportStudents.push({
      uid: student.uid,
      name: student.name,
      schoolId: student.schoolId,
      yearLevel: student.yearLevel,
      departmentCode: code,
      isLSN: student.isLSN,
      concernLevel,
      latestTotalScore: latestScore,
      latestAssessmentDate: latestDate,
      assessmentsCount: sAssess.length,
      journalCount: sJournals.length,
      moodEntries,
      moodScoreAvg: avgStudentMood(sJournals),
      surveyCount,
    });

    const dept = deptAcc.get(code) ?? {
      low: 0,
      medium: 0,
      high: 0,
      notAssessed: 0,
      assessments: 0,
      journals: 0,
      moods: 0,
      surveys: 0,
    };
    if (concernLevel === "LOW") dept.low += 1;
    else if (concernLevel === "MEDIUM") dept.medium += 1;
    else if (concernLevel === "HIGH") dept.high += 1;
    else dept.notAssessed += 1;
    dept.assessments += sAssess.length;
    dept.journals += sJournals.length;
    dept.moods += moodEntries;
    dept.surveys += surveyCount;
    deptAcc.set(code, dept);
  }

  // Mood bucketing
  for (const [mood, count] of Object.entries(moodCounts)) {
    const m = moodBucket(mood);
    if (m === "positive") positive += count;
    else if (m === "neutral") neutral += count;
    else distressed += count;
  }

  const distribution = Object.entries(moodCounts)
    .map(([mood, count]) => ({ mood, count }))
    .sort((a, b) => b.count - a.count);

  const departmentData: DepartmentReportRow[] = Array.from(deptAcc.entries())
    .map(([code, d]) => ({
      code,
      name: deptName(code),
      totalStudents:
        d.low + d.medium + d.high + d.notAssessed,
      low: d.low,
      medium: d.medium,
      high: d.high,
      attentionRequired: d.medium + d.high,
      assessmentCount: d.assessments,
      moodEntries: d.moods,
      journalEntries: d.journals,
      surveyResponses: d.surveys,
    }))
    .sort((a, b) => b.totalStudents - a.totalStudents);

  // Assessment analytics (single generic type)
  const assessmentScores = assessments
    .filter((a) => typeof a.totalScore === "number")
    .map((a) => a.totalScore);
  let assessmentLow = 0;
  let assessmentMedium = 0;
  let assessmentHigh = 0;
  for (const a of assessments) {
    const c = concernForAssessments([a]).concern;
    if (c === "LOW") assessmentLow += 1;
    else if (c === "MEDIUM") assessmentMedium += 1;
    else if (c === "HIGH") assessmentHigh += 1;
  }

  const assessmentData: AssessmentReportRow[] =
    totalAssessments > 0
      ? [
          {
            type: "MindCare Assessment",
            count: totalAssessments,
            avgScore:
              assessmentScores.length > 0
                ? +(assessmentScores.reduce((s, v) => s + v, 0) / assessmentScores.length).toFixed(1)
                : 0,
            low: assessmentLow,
            medium: assessmentMedium,
            high: assessmentHigh,
          },
        ]
      : [];

  // Mood report
  const moodReport: MoodReport = {
    totalEntries: totalMoodEntries,
    avgScore:
      allMoodScores.length > 0
        ? +(allMoodScores.reduce((s, v) => s + v, 0) / allMoodScores.length).toFixed(2)
        : 0,
    mostCommon: distribution[0]?.mood,
    distribution,
    positive,
    neutral,
    distressed,
  };

  // Journal report
  const journalReport: JournalReport = {
    totalEntries: totalJournals,
    activeUsers: journalActiveUsers,
    avgPerStudent:
      journalActiveUsers > 0
        ? +(totalJournals / journalActiveUsers).toFixed(2)
        : 0,
    positive: positiveJournal,
    neutral: neutralJournal,
    negative: negativeJournal,
  };

  // Survey report
  const surveyReport: SurveyReport = {
    totalResponses: totalSurveys,
    activeStudents: students.filter((s) => surveyCounts.has(s.uid)).length,
    responseRate: students.length
      ? Math.round((surveyCounts.size / students.length) * 100)
      : 0,
    questionSummaries: [],
  };

  const concernDistribution: ConcernDistribution = {
    low,
    medium,
    high,
    notAssessed,
  };

  const attentionRequired: AttentionRequiredInfo = {
    count: medium + high,
    medium,
    high,
  };

  const lowPlusMediumPlusHigh = low + medium + high;
  const deptTotalMatches =
    departmentData.reduce((s, d) => s + d.totalStudents, 0) === students.length;

  const overview: OverviewInfo = {
    totalStudents: students.length,
    trackedStudents: students.length,
    activeStudents,
    lowConcern: low,
    mediumConcern: medium,
    highConcern: high,
    attentionRequired: attentionRequired.count,
    assessed: assessedStudents,
    completionRate: students.length
      ? Math.round((assessedStudents / students.length) * 100)
      : 0,
    totalAssessments,
    totalJournals,
    totalMoodEntries,
    totalSurveys,
  };

  return {
    period,
    periodType: period.type,
    academicYearLabel: academicYearLabel(academicYearFor(period.startDate)),
    trimesterLabel:
      period.type === "trimester"
        ? period.label.split(" AY")[0]
        : null,
    departmentFilter: departmentCode
      ? { code: departmentCode, name: deptName(departmentCode) }
      : null,
    generatedAt: new Date(),
    institutionName: "University of the Cordilleras",
    reportTitle:
      "UNIVERSITY OF THE CORDILLERAS — ADMINISTRATIVE WELLNESS REPORT",
    periodLabel: period.label,
    preparedBy,
    overview,
    concernDistribution,
    attentionRequired,
    departmentData,
    assessmentData,
    moodData: moodReport,
    journalData: journalReport,
    surveyData: surveyReport,
    studentLookup: reportStudents,
    trendComparison: [],
    validation: {
      lowPlusMediumPlusHigh,
      attentionMatches: attentionRequired.count === commonAttention(concernDistribution),
      deptTotalMatches,
    },
  };
}

function commonAttention(dist: ConcernDistribution): number {
  return dist.medium + dist.high;
}

interface TrendMetric {
  label: string;
  currentValue: (r: ReportData) => number;
  previousValue: (r: ReportData) => number;
}

const TREND_METRICS: TrendMetric[] = [
  {
    label: "High Concern",
    currentValue: (r) => r.concernDistribution.high,
    previousValue: (r) => r.concernDistribution.high,
  },
  {
    label: "Medium Concern",
    currentValue: (r) => r.concernDistribution.medium,
    previousValue: (r) => r.concernDistribution.medium,
  },
  {
    label: "Low Concern",
    currentValue: (r) => r.concernDistribution.low,
    previousValue: (r) => r.concernDistribution.low,
  },
  {
    label: "Attention Required",
    currentValue: (r) => r.attentionRequired.count,
    previousValue: (r) => r.attentionRequired.count,
  },
  {
    label: "Assessments",
    currentValue: (r) => r.overview.totalAssessments,
    previousValue: (r) => r.overview.totalAssessments,
  },
  {
    label: "Mood Entries",
    currentValue: (r) => r.overview.totalMoodEntries,
    previousValue: (r) => r.overview.totalMoodEntries,
  },
  {
    label: "Journal Entries",
    currentValue: (r) => r.overview.totalJournals,
    previousValue: (r) => r.overview.totalJournals,
  },
  {
    label: "Survey Responses",
    currentValue: (r) => r.overview.totalSurveys,
    previousValue: (r) => r.overview.totalSurveys,
  },
];

/**
 * Computes the current-vs-previous delta for every trend metric. When the
 * previous period had a zero baseline, `comparable` is false and `changePct`
 * is 0 so callers show "N/A" instead of Infinity%/NaN%.
 */
function buildTrendComparison(
  current: ReportData,
  previous: ReportData,
): TrendRow[] {
  return TREND_METRICS.map((m) => {
    const cur = m.currentValue(current);
    const prev = m.previousValue(previous);
    const comparable = prev !== 0;
    const changePct = !comparable ? 0 : ((cur - prev) / prev) * 100;
    const direction: TrendRow["direction"] =
      !comparable || cur === prev
        ? "stable"
        : cur > prev
          ? "up"
          : "down";
    return {
      label: m.label,
      current: cur,
      previous: prev,
      changePct: Math.round(changePct * 10) / 10,
      direction,
      comparable,
    };
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function generateReportData(
  params: GenerateReportParams,
  opts?: { limit?: number; preparedBy?: string },
): Promise<ReportData> {
  const preparedBy = opts?.preparedBy ?? "Office of Guidance and Counselling";
  const period: ReportPeriodInfo = {
    type: params.periodType,
    startDate: params.startDate,
    endDate: params.endDate,
    label: params.periodLabel,
  };

  const raw = await fetchRawDataset(
    params.startDate,
    params.endDate,
    params.departmentCode,
    opts?.limit,
  );
  const report = buildReport(period, raw, preparedBy, params.departmentCode);

  // Previous equivalent period — same aggregation, same department filter.
  const previousPeriod = previousPeriodOf(period);
  if (previousPeriod) {
    try {
      const prevRaw = await fetchRawDataset(
        previousPeriod.startDate,
        previousPeriod.endDate,
        params.departmentCode,
        opts?.limit,
      );
      const previousReport = buildReport(
        previousPeriod,
        prevRaw,
        preparedBy,
        params.departmentCode,
      );
      report.trendComparison = buildTrendComparison(report, previousReport);
    } catch (err) {
      console.error("Previous-period comparison failed:", err);
      report.trendComparison = [];
    }
  }

  validateReport(report);
  return report;
}

/**
 * Validates report internal consistency. Throws when counts do not reconcile,
 * preventing a mismatched narrative/Excel/dashboard from ever being produced.
 */
export function validateReport(report: ReportData): void {
  const { low, medium, high } = report.concernDistribution;
  const attention = report.attentionRequired;

  if (attention.count !== attention.medium + attention.high) {
    throw new Error(
      "Report data integrity error: attention count mismatch (medium + high).",
    );
  }

  if (low + medium + high !== report.validation.lowPlusMediumPlusHigh) {
    throw new Error(
      "Report data integrity error: concern distribution does not reconcile.",
    );
  }

  if (!report.validation.deptTotalMatches) {
    throw new Error(
      "Report data integrity error: department totals do not match student-level data.",
    );
  }

  const deptSum = report.departmentData.reduce(
    (s, d) => s + d.low + d.medium + d.high,
    0,
  );
  if (deptSum !== low + medium + high) {
    throw new Error(
      "Report data integrity error: department concern counts do not reconcile.",
    );
  }

  const lookupConcerned = report.studentLookup.filter(
    (s) => s.concernLevel === "LOW" || s.concernLevel === "MEDIUM" || s.concernLevel === "HIGH",
  ).length;
  if (lookupConcerned !== low + medium + high) {
    throw new Error(
      "Report data integrity error: student lookup concern counts do not reconcile.",
    );
  }
}
