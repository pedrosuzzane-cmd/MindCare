import * as XLSX from "xlsx";

export type ExportRiskLevel = "low" | "normal" | "high";

export interface UniversityStudentRecord {
  uid: string;
  name: string;
  schoolId: string;
  department: string;
  yearLevel: string;
  isLSN?: boolean;
  lsnCategory?: string;
  latestTotalScore?: number;
  latestRiskLevel?: ExportRiskLevel;
  assessmentsCount: number;
  journalCount: number;
}

export interface UniversityRiskTrendRow {
  label: string;
  count: number;
  baseline: number;
  changePct: number;
}

export interface UniversityMoodSlice {
  mood: string;
  count: number;
}

export interface UniversityDeptMetric {
  deptAbbr: string;
  deptName: string;
  avgScore: number;
  assessmentCount: number;
  journalCount: number;
  lsnCount: number;
  participationRate: number;
  lowCount: number;
  normalCount: number;
  highCount: number;
}

export interface UniversityDeptComparison {
  indicator: string;
  department: string;
  value: string;
}

export interface UniversityRiskVarianceRow {
  department: string;
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  count: number;
}

export interface UniversityCorrelationMetric {
  metric: string;
  value: string;
}

export interface UniversityExportData {
  institutionName: string;
  reportTitle: string;
  reportPeriod: string;
  generatedAt: string;
  totalStudents: number;
  studentsAssessed: number;
  completionRate: number;
  avgWellnessScore: number;
  totalJournalEntries: number;
  riskTrends: UniversityRiskTrendRow[];
  stressMetrics: { metric: string; value: string }[];
  moodDistribution: UniversityMoodSlice[];
  assessmentDistribution: { category: string; count: number }[];
  riskVariance: UniversityRiskVarianceRow[];
  departmentMetrics: UniversityDeptMetric[];
  departmentComparison: UniversityDeptComparison[];
  correlationMetrics: UniversityCorrelationMetric[];
  students: UniversityStudentRecord[];
}

const RISK_LABEL: Record<ExportRiskLevel, string> = {
  low: "Lower Concern",
  normal: "Moderate Concern",
  high: "Elevated Concern",
};

const LSN_LABEL: Record<string, string> = {
  "additional-needs": "Students with Additional Needs",
  disabilities: "Students with Disabilities",
};

const DEFAULT_FILENAME = "University_of_the_Cordilleras_Analytics_Report.xlsx";

function lsnLabel(s: UniversityStudentRecord): string {
  if (s.lsnCategory) return LSN_LABEL[s.lsnCategory] || "LSN";
  return s.isLSN ? "LSN" : "None";
}

function riskLabel(level?: ExportRiskLevel): string {
  return level ? RISK_LABEL[level] : "Not Assessed";
}

function studentToSheetRow(
  s: UniversityStudentRecord,
): Record<string, string | number> {
  return {
    "Student ID": s.schoolId || "—",
    Name: s.name,
    Department: s.department,
    "Year Level": s.yearLevel,
    "LSN Category": lsnLabel(s),
    "Concern Level": riskLabel(s.latestRiskLevel),
    Score: s.latestTotalScore ?? "",
  };
}

function autoWidth(ws: XLSX.WorkSheet) {
  const ref = ws["!ref"];
  if (!ref) return;
  const range = XLSX.utils.decode_range(ref);
  const widths: number[] = [];
  for (let c = range.s.c; c <= range.e.c; c++) {
    let max = 10;
    for (let r = range.s.r; r <= range.e.r; r++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      if (cell && cell.v != null) {
        max = Math.max(max, String(cell.v).length + 2);
      }
    }
    widths[c] = Math.min(max, 60);
  }
  ws["!cols"] = widths.map((wch) => ({ wch }));
}

export function exportUniversityExcelReport(
  data: UniversityExportData,
  filename: string = DEFAULT_FILENAME,
): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  wb.Props = {
    Title: data.reportTitle,
    Subject: "Mental Wellness Analytics",
    Author: data.institutionName,
    CreatedDate: new Date(),
  };

  const wsSummary = XLSX.utils.json_to_sheet([
    { Metric: "Institution", Value: data.institutionName },
    { Metric: "Report Title", Value: data.reportTitle },
    { Metric: "Reporting Period", Value: data.reportPeriod },
    { Metric: "Generated On", Value: data.generatedAt },
    {},
    { Metric: "Total Students Tracked", Value: data.totalStudents },
    { Metric: "Students Assessed", Value: data.studentsAssessed },
    { Metric: "Assessment Completion Rate", Value: `${data.completionRate}%` },
    { Metric: "Average Wellness Score", Value: data.avgWellnessScore },
    { Metric: "Total Journal Entries", Value: data.totalJournalEntries },
  ]);
  autoWidth(wsSummary);
  XLSX.utils.book_append_sheet(wb, wsSummary, "Executive Summary");

  const advancedRows: (string | number)[][] = [];
  advancedRows.push(["Wellness & Concern Trend Indicators"]);
  advancedRows.push(["Category", "Count", "Baseline", "Change (%)"]);
  data.riskTrends.forEach((r) =>
    advancedRows.push([r.label, r.count, r.baseline, r.changePct]),
  );
  advancedRows.push([]);
  advancedRows.push(["Stress Heatmap Metrics"]);
  advancedRows.push(["Metric", "Value"]);
  data.stressMetrics.forEach((m) => advancedRows.push([m.metric, m.value]));
  advancedRows.push([]);
  advancedRows.push(["Mood Distribution"]);
  advancedRows.push(["Mood Category", "Count"]);
  data.moodDistribution.forEach((m) => advancedRows.push([m.mood, m.count]));
  advancedRows.push([]);
  advancedRows.push(["Assessment Distribution"]);
  advancedRows.push(["Category", "Count"]);
  data.assessmentDistribution.forEach((a) =>
    advancedRows.push([a.category, a.count]),
  );
  advancedRows.push([]);
  advancedRows.push(["Wellness Score Variance (Per Department)"]);
  advancedRows.push([
    "Department",
    "Min",
    "Q1",
    "Median",
    "Q3",
    "Max",
    "Assessed Students",
  ]);
  data.riskVariance.forEach((v) =>
    advancedRows.push([
      v.department,
      v.min,
      v.q1,
      v.median,
      v.q3,
      v.max,
      v.count,
    ]),
  );
  const wsAdvanced = XLSX.utils.aoa_to_sheet(advancedRows);
  autoWidth(wsAdvanced);
  XLSX.utils.book_append_sheet(wb, wsAdvanced, "Risk & Advanced Analytics");

  const deptRows: (string | number)[][] = [];
  deptRows.push(["Department Comparison & Insights"]);
  deptRows.push(["Indicator", "Department", "Value"]);
  data.departmentComparison.forEach((c) =>
    deptRows.push([c.indicator, c.department, c.value]),
  );
  deptRows.push([]);
  deptRows.push(["Score vs. Journal Frequency Correlation"]);
  deptRows.push(["Metric", "Value"]);
  data.correlationMetrics.forEach((c) => deptRows.push([c.metric, c.value]));
  deptRows.push([]);
  deptRows.push(["Multi-Metric Department Comparison"]);
  deptRows.push([
    "Department",
    "Avg Score",
    "Assessments",
    "Journal Entries",
    "LSN Students",
    "Participation Rate",
    "Low Concern",
    "Moderate Concern",
    "High Concern",
  ]);
  data.departmentMetrics.forEach((d) =>
    deptRows.push([
      d.deptAbbr,
      d.avgScore,
      d.assessmentCount,
      d.journalCount,
      d.lsnCount,
      `${d.participationRate}%`,
      d.lowCount,
      d.normalCount,
      d.highCount,
    ]),
  );
  const wsDept = XLSX.utils.aoa_to_sheet(deptRows);
  autoWidth(wsDept);
  XLSX.utils.book_append_sheet(wb, wsDept, "Department Comparison");

  const wsStudents = XLSX.utils.json_to_sheet(
    data.students.map(studentToSheetRow),
  );
  autoWidth(wsStudents);
  XLSX.utils.book_append_sheet(wb, wsStudents, "Student Dataset");

  return wb;
}
