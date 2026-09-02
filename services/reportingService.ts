import { db } from "@/constants/firebase";
import { collection, getDocs } from "firebase/firestore";
import { riskFromScore } from "@/utils/assessmentTrend";
import {
  canonicalDeptName,
  normalizeDepartment,
} from "@/utils/departmentMeta";
import { getStudentConcernLevel, type ConcernLevel } from "@/utils/concern";
import { moodWellnessScore, moodBucket } from "@/utils/moodScoring";
import {
  academicYearLabel,
  academicYearFor,
  getTrimester,
  previousPeriodOf,
  trimesterLabel,
  type ReportPeriodInfo,
  type ReportPeriodType,
} from "@/utils/academicCalendar";
import {
  applyReportFilters,
  resolveRecordEventDate,
  type ReportDataQuality,
  type ReportDateRange,
  type ReportRecord,
} from "@/utils/reportCore";

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

/**
 * THE authoritative report counts. Every KPI card, chart, narrative sentence,
 * Excel cell, PDF grid, and the preview MUST read these values.
 *
 *   totalStudents      = UNIQUE student UIDs in the selected population (dept)
 *   trackedStudents    = population alias (== totalStudents)
 *   activeStudents     = UNIQUE students with >=1 qualifying record in period
 *                        (assessment OR mood OR journal OR survey)
 *   assessed           = studentsAssessed: UNIQUE students with >=1 valid
 *                        assessment result in the period
 *   totalAssessments   = assessmentCount: number of assessment RECORDS (may
 *                        exceed `assessed` when a student retakes)
 *   low/medium/high    = UNIQUE students whose authoritative (latest) concern
 *                        is LOW / MEDIUM / HIGH (never raw record counts)
 *   attentionRequired  = mediumConcern + highConcern (LOW is NEVER included)
 *   completionRate     = assessed / totalStudents (%)
 *
 * validation invariants (enforced in validateReport):
 *   assessed === low + medium + high
 *   totalAssessments >= assessed
 *   activeStudents   >= assessed
 *   activeStudents   <= totalStudents
 *   attentionRequired === medium + high
 */
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
  dateRange: ReportDateRange;
  academicYearLabel: string;
  /** "Academic Trimester" contextual label: the trimester the period falls in,
   *  or the selected trimester itself for trimester reports. */
  trimesterLabel: string | null;
  departmentFilter: { code: string; name: string } | null;
  /** The exact filter combination that produced this dataset (traceability). */
  filters: {
    periodType: ReportPeriodType;
    academicYear: number | null;
    academicTrimester: 1 | 2 | 3 | null;
    departmentCode: string | null;
  };
  /** The previous equivalent reporting period, when one exists. Its dataset is
   *  built by the same builder and fed to `trendComparison` only. */
  previousPeriod: ReportDateRange | null;
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
  dataQuality: ReportDataQuality;
  validation: {
    lowPlusMediumPlusHigh: number;
    attentionMatches: boolean;
    deptTotalMatches: boolean;
    uniqueAssessedMatchesDistribution: boolean;
    recordsAtLeastUniqueStudents: boolean;
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
  department: string; // normalized code ("" when missing)
  isLSN: boolean;
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
// Fetch + central filter — THE single report query
// ---------------------------------------------------------------------------

/**
 * Resolves the report date range for the selected filters. Pure — used by the
 * report generator and by previews so the exact scope is always identical.
 */
export function resolveReportDateRange(
  params: Pick<GenerateReportParams, "periodType" | "startDate" | "endDate" | "periodLabel">,
): ReportDateRange {
  return {
    startDate: params.startDate,
    endDate: params.endDate,
    label: params.periodLabel,
    periodType: params.periodType,
  };
}

interface RawReportSource {
  students: RawStudent[];
  records: ReportRecord[];
}

/**
 * Fetches the complete set of reportable records (students + their dated
 * assessments/journals/surveys) WITHOUT applying the report filter. The single
 * date+department filter is applied afterwards by `applyReportFilters()` so
 * every record that reaches aggregation has passed through one code path.
 */
async function fetchRawReportSource(
  departmentCode?: string,
  limit?: number,
): Promise<RawReportSource> {
  const usersSnap = await getDocs(collection(db, "users"));

  const normalizedFilter = departmentCode ? normalizeDepartment(departmentCode) : null;

  const studentDocs = usersSnap.docs.filter((d) => {
    if (d.data().role === "admin") return false;
    const code = normalizeDepartment(d.data().department);
    if (normalizedFilter) return code === normalizedFilter;
    return true;
  });

  // Pagination cap to avoid unbounded downloads; the caller decides the limit.
  const docs = limit ? studentDocs.slice(0, limit) : studentDocs;

  const perStudent = await Promise.all(
    docs.map(async (doc) => {
      const data = doc.data();
      const uid = doc.id;
      const deptCode = normalizeDepartment(data.department);

      const [assessmentSnap, journalSnap, surveySnap] = await Promise.all([
        getDocs(collection(db, "users", uid, "selfAssessments")),
        getDocs(collection(db, "users", uid, "journalEntries")),
        getDocs(collection(db, "users", uid, "initialProfileSurveys")),
      ]);

      const records: ReportRecord[] = [];

      for (const aDoc of assessmentSnap.docs) {
        const a = aDoc.data();
        records.push({
          studentId: uid,
          department: deptCode,
          source: "assessment",
          eventDate: resolveRecordEventDate("assessment", a),
          totalScore: Number(a.totalScore) || 0,
          riskLevel: typeof a.riskLevel === "string" ? a.riskLevel : undefined,
        });
      }

      for (const jDoc of journalSnap.docs) {
        const j = jDoc.data();
        records.push({
          studentId: uid,
          department: deptCode,
          source: "journal",
          eventDate: resolveRecordEventDate("journal", j),
          mood: typeof j.mood === "string" ? j.mood : undefined,
          sentiment: j.reflectionLocal?.sentiment,
        });
      }

      for (const sDoc of surveySnap.docs) {
        const s = sDoc.data();
        records.push({
          studentId: uid,
          department: deptCode,
          source: "survey",
          eventDate: resolveRecordEventDate("survey", s),
        });
      }

      return {
        student: {
          uid,
          name: data.fullName || "Unknown Student",
          schoolId: data.schoolId || "N/A",
          yearLevel: data.yearLevel || "N/A",
          department: deptCode,
          isLSN: !!data.isLSN,
        },
        records,
      };
    }),
  );

  return {
    students: perStudent.map((p) => p.student),
    records: perStudent.flatMap((p) => p.records),
  };
}

// ---------------------------------------------------------------------------
// Concern helpers (reuse canonical logic)
// ---------------------------------------------------------------------------

/**
 * AUTHORITATIVE concern resolution — the ONLY concern source for the report.
 *
 * Rule (identical to Student Management / Student Details / Department and Mood
 * analytics): a student's concern is derived from their LATEST assessment
 * within the reporting period. When multiple assessments exist for one student,
 * only the most recent one (by event date) determines the concern; the count
 * of concern buckets below is UNIQUE STUDENTS, never raw assessment records.
 *
 * The latest assessment's stored riskLevel (low/normal/high) is authoritative;
 * riskFromScore is used only as the established fallback when the stored level
 * is missing. Concern values are normalized to exactly LOW | MEDIUM | HIGH via
 * getStudentConcernLevel — the same function used everywhere else in MindCare.
 * Journal sentiment, mood entries and activity volume NEVER affect concern.
 */
function concernForAssessments(assessments: ReportRecord[]): {
  concern: ConcernLevel | null;
  latestScore?: number;
  latestDate?: Date;
} {
  if (assessments.length === 0) {
    return { concern: null };
  }
  const latest = assessments.reduce((a, b) =>
    (a.eventDate as Date).getTime() >= (b.eventDate as Date).getTime() ? a : b,
  );
  const latestTotalScore = typeof latest.totalScore === "number" ? latest.totalScore : 0;
  const risk =
    latest.riskLevel === "low" ||
    latest.riskLevel === "normal" ||
    latest.riskLevel === "high"
      ? latest.riskLevel
      : riskFromScore(latestTotalScore);
  const concern = getStudentConcernLevel({
    latestRiskLevel: risk,
    latestTotalScore: latestTotalScore,
  });
  return {
    concern,
    latestScore: latestTotalScore,
    latestDate: latest.eventDate as Date,
  };
}

/** Best-effort sentiment bucket for a journal entry that has no stored sentiment. */
function sentimentFromMood(mood?: string): "positive" | "neutral" | "negative" {
  if (!mood) return "neutral";
  const m = moodBucket(mood);
  if (m === "positive") return "positive";
  if (m === "neutral") return "neutral";
  return "negative";
}

function avgStudentMood(journals: ReportRecord[]): number {
  if (journals.length === 0) return 0;
  const sum = journals.reduce(
    (acc, j) => acc + moodWellnessScore(j.mood),
    0,
  );
  return +(sum / journals.length).toFixed(2);
}

// ---------------------------------------------------------------------------
// Aggregation (consumes ONLY the filtered dataset)
// ---------------------------------------------------------------------------

function buildReport(
  period: ReportPeriodInfo,
  source: {
    students: RawStudent[];
    records: ReportRecord[];
  },
  preparedBy: string,
  departmentCode?: string,
  dataQuality?: ReportDataQuality,
): ReportData {
  const { students, records } = source;

  const assessments = records.filter((r) => r.source === "assessment");
  const journals = records.filter((r) => r.source === "journal");
  const surveys = records.filter((r) => r.source === "survey");

  // Survey response counts per student (only in-period surveys).
  const surveyCounts = new Map<string, number>();
  for (const s of surveys) {
    surveyCounts.set(s.studentId, (surveyCounts.get(s.studentId) ?? 0) + 1);
  }

  // Group by student
  const byUid = new Map<
    string,
    { student: RawStudent; assessments: ReportRecord[]; journals: ReportRecord[] }
  >();
  for (const s of students) {
    byUid.set(s.uid, { student: s, assessments: [], journals: [] });
  }
  for (const a of assessments) {
    byUid.get(a.studentId)?.assessments.push(a);
  }
  for (const j of journals) {
    byUid.get(j.studentId)?.journals.push(j);
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
    const code = normalizeDepartment(student.department) || "UNSPECIFIED";
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
    .map((a) => a.totalScore as number);
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
    dateRange: {
      startDate: period.startDate,
      endDate: period.endDate,
      label: period.label,
      periodType: period.type,
    },
    academicYearLabel: academicYearLabel(academicYearFor(period.startDate)),
    trimesterLabel:
      period.type === "trimester"
        ? period.label.split(" AY")[0]
        : period.type === "monthly" || period.type === "weekly"
          ? trimesterLabel(getTrimester(period.startDate))
          : null,
    departmentFilter: departmentCode
      ? { code: normalizeDepartment(departmentCode), name: deptName(normalizeDepartment(departmentCode)) }
      : null,
    filters: {
      periodType: period.type,
      academicYear: academicYearFor(period.startDate),
      academicTrimester:
        period.type === "trimester"
          ? getTrimester(period.startDate)
          : period.type === "monthly" || period.type === "weekly"
            ? getTrimester(period.startDate)
            : null,
      departmentCode: departmentCode ? normalizeDepartment(departmentCode) : null,
    },
    previousPeriod: null,
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
    dataQuality: dataQuality ?? emptyDataQuality(),
    validation: {
      lowPlusMediumPlusHigh,
      attentionMatches: attentionRequired.count === commonAttention(concernDistribution),
      deptTotalMatches,
      uniqueAssessedMatchesDistribution:
        assessedStudents === lowPlusMediumPlusHigh,
      recordsAtLeastUniqueStudents: totalAssessments >= assessedStudents,
    },
  };
}

function emptyDataQuality(): ReportDataQuality {
  return {
    totalRecords: 0,
    valid: 0,
    excludedOutOfRange: 0,
    excludedDepartment: 0,
    missingDate: 0,
    missingDepartment: 0,
    missingStudentId: 0,
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

/**
 * THE central report query. Everything — KPI cards, charts, narrative, Excel,
 * PDF, student lookup, department analytics, and the preview — is derived from
 * the dataset this function returns. Nothing downstream re-filters.
 *
 * Flow:
 *   filters ──▶ resolveReportDateRange(filters)
 *                  ──▶ fetchRawReportSource()            (unfiltered raw records)
 *                  ──▶ applyReportFilters(records, range, department)
 *                  ──▶ buildReport(filtered dataset)
 */
export async function generateReportData(
  params: GenerateReportParams,
  opts?: { limit?: number; preparedBy?: string },
): Promise<ReportData> {
  const preparedBy = opts?.preparedBy ?? "Office of Guidance and Counselling";
  const period: ReportPeriodInfo = {
    type: params.periodType,
    periodType: params.periodType,
    startDate: params.startDate,
    endDate: params.endDate,
    label: params.periodLabel,
  };
  const dateRange = resolveReportDateRange(params);

  const source = await fetchRawReportSource(params.departmentCode, opts?.limit);

  // THE single date + department filter. Every record in the report passed
  // through this one function.
  const filtered = applyReportFilters(
    source.records,
    dateRange,
    params.departmentCode ?? "ALL",
  );

  const report = buildReport(
    period,
    { students: source.students, records: filtered.included },
    preparedBy,
    params.departmentCode,
    filtered.dataQuality,
  );

  // Previous equivalent period — same aggregation, same department filter,
  // same central filter function. Its records stay isolated for comparison.
  const previousPeriod = previousPeriodOf(period);
  if (previousPeriod) {
    try {
      const prevSource = await fetchRawReportSource(params.departmentCode, opts?.limit);
      const prevFiltered = applyReportFilters(
        prevSource.records,
        {
          startDate: previousPeriod.startDate,
          endDate: previousPeriod.endDate,
        },
        params.departmentCode ?? "ALL",
      );
      const previousReport = buildReport(
        previousPeriod,
        { students: prevSource.students, records: prevFiltered.included },
        preparedBy,
        params.departmentCode,
        prevFiltered.dataQuality,
      );
      report.previousPeriod = {
        startDate: previousPeriod.startDate,
        endDate: previousPeriod.endDate,
        label: previousPeriod.label,
        periodType: previousPeriod.periodType,
      };
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

  const o = report.overview;
  if (o.assessed !== low + medium + high) {
    throw new Error(
      "Report data integrity error: students assessed != low + medium + high (unique-student concern distribution mismatch).",
    );
  }
  if (o.totalAssessments < o.assessed) {
    throw new Error(
      "Report data integrity error: assessment records cannot be fewer than unique assessed students.",
    );
  }
  if (o.activeStudents < o.assessed) {
    throw new Error(
      "Report data integrity error: active students cannot be fewer than assessed students.",
    );
  }
  if (o.activeStudents > o.totalStudents) {
    throw new Error(
      "Report data integrity error: active students cannot exceed total students.",
    );
  }
}