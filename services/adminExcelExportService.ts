import * as XLSX from "xlsx";
import type { ReportData, ReportStudent } from "./reportingService";

/**
 * Generates the Excel workbook from a single validated `ReportData` object —
 * the SAME object consumed by the narrative report. There is never a second,
 * independently-computed statistics path in the workbook.
 *
 * NOTE (honest limitation): this project ships SheetJS Community Edition
 * (`xlsx@0.18.5`), which persists column widths and autofilters but NOT cell
 * styles (bold headers, fills, borders). The workbook therefore uses clear
 * title rows, a bold-looking header convention, column widths, autofilters,
 * and correct numeric/percent/date values, but cannot embed visual styling.
 */

export interface ExcelSheetSpec {
  name: string;
}

function fmtConcern(level: ReportStudent["concernLevel"]): string {
  if (level === "LOW") return "LOW";
  if (level === "MEDIUM") return "MEDIUM";
  if (level === "HIGH") return "HIGH";
  return "Not Assessed";
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

function enableFilter(ws: XLSX.WorkSheet) {
  const ref = ws["!ref"];
  if (!ref) return;
  const range = XLSX.utils.decode_range(ref);
  // Autofilter from the header row (row 1) to the last data row.
  ws["!autofilter"] = {
    ref: XLSX.utils.encode_range({
      s: { r: range.s.r, c: range.s.c },
      e: { r: range.e.r, c: range.e.c },
    }),
  };
}

function sheetFromRows(headers: string[], rows: (string | number | Date)[][]) {
  const aoa: (string | number | Date)[][] = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  autoWidth(ws);
  enableFilter(ws);
  return ws;
}

export function exportReportWorkbook(report: ReportData): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  wb.Props = {
    Title: report.reportTitle,
    Subject: "Administrative Wellness Report",
    Author: report.institutionName,
    CreatedDate: report.generatedAt,
  };

  const period = report.periodLabel;
  const o = report.overview;
  const cd = report.concernDistribution;
  const ar = report.attentionRequired;

  // Sheet 1 — Executive Summary
  const summary = sheetFromRows(
    ["Metric", "Value"],
    [
      ["Institution", report.institutionName],
      ["Report Title", report.reportTitle],
      ["Academic Year", report.academicYearLabel],
      ["Reporting Period", period],
      ["Trimester", report.trimesterLabel ?? "—"],
      ["Department / College", report.departmentFilter?.name ?? "All Departments"],
      ["Generated On", report.generatedAt.toLocaleString()],
      ["Prepared By", report.preparedBy],
      [],
      ["Total Students", o.totalStudents],
      ["Active Students", o.activeStudents],
      ["Students Assessed", o.assessed],
      ["Assessment Completion Rate", `${o.completionRate}%`],
      ["Low Concern", cd.low],
      ["Medium Concern", cd.medium],
      ["High Concern", cd.high],
      ["Attention Required (Medium + High)", ar.count],
      [],
      ["Assessments (records)", o.totalAssessments],
      ["Mood Entries", o.totalMoodEntries],
      ["Journal Entries", o.totalJournals],
      ["Survey Responses", o.totalSurveys],
    ],
  );
  XLSX.utils.book_append_sheet(wb, summary, "Executive Summary");

  // Sheet 2 — Concern Distribution
  const totalConcerned = cd.low + cd.medium + cd.high;
  const pct = (n: number) =>
    totalConcerned > 0 ? `${Math.round((n / totalConcerned) * 100)}%` : "0%";
  const concern = sheetFromRows(
    ["Concern Level", "Student Count", "Percentage"],
    [
      ["Low", cd.low, pct(cd.low)],
      ["Medium", cd.medium, pct(cd.medium)],
      ["High", cd.high, pct(cd.high)],
      ["Not Assessed", cd.notAssessed, ""],
    ],
  );
  XLSX.utils.book_append_sheet(wb, concern, "Concern Distribution");

  // Sheet 3 — Department Analytics
  const deptRows = report.departmentData.map((d) => [
    d.code,
    d.name,
    d.totalStudents,
    d.low,
    d.medium,
    d.high,
    d.attentionRequired,
    d.assessmentCount,
    d.moodEntries,
    d.journalEntries,
    d.surveyResponses,
  ]);
  const dept = sheetFromRows(
    [
      "Department",
      "Department Name",
      "Total Students",
      "Low",
      "Medium",
      "High",
      "Attention Required",
      "Assessments",
      "Mood Entries",
      "Journal Entries",
      "Survey Responses",
    ],
    deptRows,
  );
  XLSX.utils.book_append_sheet(wb, dept, "Department Analytics");

  // Sheet 4 — Student Lookup
  const lookupRows = report.studentLookup.map((s) => [
    s.schoolId || "—",
    s.name,
    s.departmentCode,
    s.yearLevel,
    fmtConcern(s.concernLevel),
    s.latestTotalScore ?? "",
    s.latestAssessmentDate
      ? s.latestAssessmentDate.toLocaleDateString()
      : "",
    s.assessmentsCount,
    s.journalCount,
    s.surveyCount,
  ]);
  const lookup = sheetFromRows(
    [
      "Student ID",
      "Student Name",
      "Department",
      "Year Level",
      "Concern Level",
      "Latest Assessment Score",
      "Assessment Date",
      "Assessments",
      "Journal Entries",
      "Surveys",
    ],
    lookupRows,
  );
  XLSX.utils.book_append_sheet(wb, lookup, "Student Lookup");

  // Sheet 5 — Assessment Analytics
  const assessmentRows = report.assessmentData.map((a) => [
    a.type,
    a.count,
    a.avgScore,
    a.low,
    a.medium,
    a.high,
  ]);
  const assessment = sheetFromRows(
    ["Assessment Type", "Completed", "Average Score", "Low", "Medium", "High"],
    assessmentRows,
  );
  XLSX.utils.book_append_sheet(wb, assessment, "Assessment Analytics");

  // Sheet 6 — Mood Analytics
  const moodRows = report.moodData.distribution.map((m) => [
    m.mood,
    m.count,
  ]);
  moodRows.push(["", ""], ["Average Mood Score (0-5)", report.moodData.avgScore]);
  moodRows.push(["Positive Entries", report.moodData.positive]);
  moodRows.push(["Neutral Entries", report.moodData.neutral]);
  moodRows.push(["Distressed Entries", report.moodData.distressed]);
  const mood = sheetFromRows(["Mood", "Count"], moodRows);
  XLSX.utils.book_append_sheet(wb, mood, "Mood Analytics");

  // Sheet 7 — Journal Analytics
  const journalRows = [
    ["Total Journal Entries", report.journalData.totalEntries],
    ["Active Journal Users", report.journalData.activeUsers],
    ["Average Entries per Student", report.journalData.avgPerStudent],
    ["Positive Entries", report.journalData.positive],
    ["Neutral Entries", report.journalData.neutral],
    ["Negative Entries", report.journalData.negative],
  ];
  const journal = sheetFromRows(["Metric", "Value"], journalRows);
  XLSX.utils.book_append_sheet(wb, journal, "Journal Analytics");

  // Sheet 8 — Survey Analytics
  const surveyRows = [
    ["Total Survey Responses", report.surveyData.totalResponses],
    ["Students with Survey Activity", report.surveyData.activeStudents],
    ["Response Rate", `${report.surveyData.responseRate}%`],
  ];
  for (const q of report.surveyData.questionSummaries) {
    surveyRows.push([`Question: ${q.question}`, q.responses]);
  }
  const survey = sheetFromRows(["Metric", "Value"], surveyRows);
  XLSX.utils.book_append_sheet(wb, survey, "Survey Analytics");

  // Sheet 9 — Comparison (current vs previous equivalent period)
  const comparisonRows = report.trendComparison.map((t) => [
    t.label,
    t.current,
    t.previous,
    t.comparable ? `${t.changePct}%` : "N/A",
    t.comparable ? t.direction : "—",
  ]);
  const comparison = sheetFromRows(
    ["Metric", "Current", "Previous", "Change %", "Direction"],
    comparisonRows,
  );
  XLSX.utils.book_append_sheet(wb, comparison, "Comparison");

  return wb;
}
