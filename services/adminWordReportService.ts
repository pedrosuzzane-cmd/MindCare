import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Alert, Platform } from "react-native";
import type { ReportData } from "./reportingService";

export interface NarrativeReportSection {
  title: string;
  paragraphs: string[];
}

export interface NarrativeReportData {
  report: ReportData;
  preparedBy: string;
  narrativeSections: NarrativeReportSection[];
}

const DEFAULT_FILENAME =
  "University_of_the_Cordilleras_Narrative_Report.html";

function esc(value: string | number): string {
  return String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c] || c,
  );
}

function htmlTable(
  headers: string[],
  rows: (string | number)[][],
): string {
  const head = headers.map((h) => `<th>${esc(h)}</th>`).join("");
  const body = rows
    .map(
      (r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`,
    )
    .join("");
  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

function num(n: number): string {
  return n.toLocaleString("en-US");
}

function arrow(direction: "up" | "down" | "stable"): string {
  if (direction === "up") return "↑ increased";
  if (direction === "down") return "↓ decreased";
  return "→ remained relatively stable";
}

/**
 * Builds the narrative analysis sections entirely from the validated
 * `report` object. No number here is invented — every figure originates from
 * ReportData. No claim of statistical significance is made unless a test was
 * actually performed (the report deliberately uses "highest observed" wording).
 */
export function buildNarrativeSections(report: ReportData): NarrativeReportSection[] {
  const o = report.overview;
  const cd = report.concernDistribution;
  const ar = report.attentionRequired;
  const totalConcerned = cd.low + cd.medium + cd.high;
  const pct = (n: number) =>
    totalConcerned > 0 ? Math.round((n / totalConcerned) * 100) : 0;

  const trendFor = (label: string) =>
    report.trendComparison.find((t) => t.label === label);

  /**
   * Builds an evidence-based comparison sentence from the current vs previous
   * period delta. When the previous baseline was zero the comparison is shown
   * as "not directly comparable" — never an invented percentage.
   */
  const comparisonSentence = (label: string): string | null => {
    const t = trendFor(label);
    if (!t) return null;
    if (!t.comparable) {
      return `Compared with the previous period (zero baseline), the ${label.toLowerCase()} count for this period (${num(
        t.current,
      )}) could not be expressed as a percentage change.`;
    }
    const dir =
      t.direction === "up"
        ? "increased"
        : t.direction === "down"
          ? "decreased"
          : "remained relatively stable";
    return `Compared with the previous period (${num(
      t.previous,
    )}), the ${label.toLowerCase()} count ${dir} by ${Math.abs(
      t.changePct,
    )}% (current ${num(t.current)}).`;
  };

  const sections: NarrativeReportSection[] = [];

  // Executive Summary
  const exec = [
    `During ${report.periodLabel}, MindCare recorded wellness activity from ${num(
      o.activeStudents,
    )} students across participating departments. The assessment data classified ${num(
      cd.low,
    )} students as Low Concern, ${num(cd.medium)} as Medium Concern, and ${num(
      cd.high,
    )} as High Concern. A total of ${num(
      ar.count,
    )} students therefore required administrative attention based on Medium or High concern classification.`,
    `The period includes ${num(
      o.totalAssessments,
    )} assessments, ${num(o.totalJournals)} journal entries, ${num(
      o.totalMoodEntries,
    )} mood entries, and ${num(
      o.totalSurveys,
    )} survey responses. ${num(o.assessed)} of the ${num(
      o.totalStudents,
    )} students covered completed an assessment, an assessment completion rate of ${o.completionRate}%.`,
  ];
  sections.push({ title: "Executive Summary", paragraphs: exec });

  // Concern Distribution
  if (totalConcerned > 0) {
    const concernParagraphs = [
      `Low Concern represents ${pct(cd.low)}% of assessed students (${num(
        cd.low,
      )}). Medium Concern represents ${pct(cd.medium)}% of assessed students (${num(
        cd.medium,
      )}). High Concern represents ${pct(cd.high)}% of assessed students (${num(
        cd.high,
      )}). ${num(cd.notAssessed)} active students had no assessment within the reporting period and are recorded as Not Assessed.`,
    ];
    for (const label of ["High Concern", "Medium Concern", "Low Concern"]) {
      const sentence = comparisonSentence(label);
      if (sentence) concernParagraphs.push(sentence);
    }
    sections.push({
      title: "Concern Distribution",
      paragraphs: concernParagraphs,
    });
  }
  // Attention Required
  sections.push({
    title: "Attention Required",
    paragraphs: [
      `There are ${num(ar.count)} students requiring attention, consisting of ${num(
        ar.medium,
      )} Medium Concern students and ${num(ar.high)} High Concern students. Attention Required reflects the sum of Medium and High concern classifications only; students with Low concern or no assessment are not included.`,
    ],
  });

  // Assessment Engagement
  const assessmentSectionParagraphs = [
    `${num(o.totalAssessments)} assessments were recorded during the reporting period. ${num(
      o.assessed,
    )} unique students completed at least one assessment, an assessment completion rate of ${o.completionRate}%.`,
  ];
  const assessmentTrend = comparisonSentence("Assessments");
  if (assessmentTrend) assessmentSectionParagraphs.push(assessmentTrend);
  sections.push({
    title: "Assessment Engagement",
    paragraphs: assessmentSectionParagraphs,
  });

  // Department Analysis
  const dept = report.departmentData;
  if (dept.length > 0) {
    const paragraphs: string[] = [];
    const byStudents = [...dept].sort((a, b) => b.totalStudents - a.totalStudents);
    const byAttention = [...dept].sort(
      (a, b) => b.attentionRequired - a.attentionRequired,
    );
    const deptsWithHigh = dept.filter((d) => d.totalStudents > 0);
    let highestHighDept: { code: string; pct: number } | null = null;
    for (const d of deptsWithHigh) {
      const dPct = Math.round((d.high / d.totalStudents) * 100);
      if (!highestHighDept || dPct > highestHighDept.pct) {
        highestHighDept = { code: d.code, pct: dPct };
      }
    }

    if (report.departmentFilter) {
      const d = dept[0];
      if (d) {
        const dHighPct =
          d.totalStudents > 0
            ? Math.round((d.high / d.totalStudents) * 100)
            : 0;
        paragraphs.push(
          `This report is scoped to the selected department (${d.code}). It recorded ${num(
            d.totalStudents,
          )} students with ${num(d.low)} Low, ${num(d.medium)} Medium, and ${num(
            d.high,
          )} High concern, giving an attention-required count of ${num(
            d.attentionRequired,
          )} (${dHighPct}% of the department cohort was High Concern).`,
        );
      }
    } else {
      paragraphs.push(
        `The department with the highest number of tracked students is ${byStudents[0].code} (${num(
          byStudents[0].totalStudents,
        )} students). ${byAttention[0].code} has the highest attention-required count (${num(
          byAttention[0].attentionRequired,
        )} students).`,
      );
      if (highestHighDept) {
        paragraphs.push(
          `The highest observed concentration of High Concern, as a share of a department's cohort, is ${highestHighDept.pct}% (${highestHighDept.code}).`,
        );
      }
    }
    sections.push({ title: "Department Analysis", paragraphs });
  }

  // Mood Analytics
  const moods = report.moodData;
  if (moods.totalEntries > 0) {
    const moodParagraphs = [
      `A total of ${num(
        moods.totalEntries,
      )} mood entries were logged, with an average mood score of ${moods.avgScore} on a 0–5 scale. The most common mood was "${
        moods.mostCommon ?? "n/a"
      }". ${num(moods.positive)} entries were positive, ${num(
        moods.neutral,
      )} neutral, and ${num(moods.distressed)} distressed.`,
    ];
    const moodTrend = comparisonSentence("Mood Entries");
    if (moodTrend) moodParagraphs.push(moodTrend);
    sections.push({ title: "Mood Analytics", paragraphs: moodParagraphs });
  }

  // Journal Analytics
  const journals = report.journalData;
  if (journals.totalEntries > 0) {
    const journalParagraphs = [
      `${num(journals.totalEntries)} journal entries were recorded by ${num(
        journals.activeUsers,
      )} active journal users, an average of ${journals.avgPerStudent} entries per student. ${num(
        journals.positive,
      )} entries carried a positive sentiment, ${num(
        journals.neutral,
      )} neutral, and ${num(journals.negative)} negative.`,
    ];
    const journalTrend = comparisonSentence("Journal Entries");
    if (journalTrend) journalParagraphs.push(journalTrend);
    sections.push({ title: "Journal Analytics", paragraphs: journalParagraphs });
  }

  // Survey Analytics
  const surveys = report.surveyData;
  if (surveys.totalResponses > 0) {
    const surveyParagraphs = [
      `${num(surveys.totalResponses)} survey responses were recorded, with a response rate of ${surveys.responseRate}% among tracked students. Each response represents a completed initial profile survey within the reporting period.`,
    ];
    const surveyTrend = comparisonSentence("Survey Responses");
    if (surveyTrend) surveyParagraphs.push(surveyTrend);
    sections.push({ title: "Survey Analytics", paragraphs: surveyParagraphs });
  }

  // Trends
  const trends = report.trendComparison;
  if (trends.length > 0) {
    sections.push({
      title: "Trends",
      paragraphs: trends.map((t) => {
        const change = t.comparable
          ? `${t.changePct}% (${arrow(t.direction)})`
          : "N/A (previous period baseline was zero)";
        return `${t.label}: ${num(t.current)} vs ${num(
          t.previous,
        )} — ${change}.`;
      }),
    });
  }

  // Recommendations (evidence-based only; no clinical diagnosis)
  const highT = trendFor("High Concern");
  const mediumT = trendFor("Medium Concern");
  const recommendations: string[] = [];
  const totalAssessedForRec = totalConcerned;
  const lowShare =
    totalAssessedForRec > 0 ? Math.round((cd.low / totalAssessedForRec) * 100) : 0;

  if (highT && highT.comparable && highT.direction === "up" && highT.changePct > 0) {
    recommendations.push(
      `High-concern cases increased compared with the previous reporting period (${num(
        highT.current,
      )} this period vs ${num(highT.previous)} previously). Guidance personnel should prioritize follow-up assessment and appropriate support for affected students.`,
    );
  }
  if (
    mediumT &&
    mediumT.comparable &&
    mediumT.direction === "up" &&
    mediumT.changePct > 0
  ) {
    recommendations.push(
      `Medium-concern cases increased during the reporting period (${num(
        mediumT.current,
      )} this period vs ${num(
        mediumT.previous,
      )} previously). Guidance personnel may consider proactive outreach and preventive wellness interventions.`,
    );
  }
  if (lowShare >= 50) {
    recommendations.push(
      `Most assessed students (${lowShare}%) were classified as Low Concern during the reporting period, indicating that the majority of assessed students were not classified within the higher concern categories.`,
    );
  }
  if (
    recommendations.length === 0 &&
    report.trendComparison.length > 0 &&
    (highT || mediumT)
  ) {
    recommendations.push(
      `No significant increase was observed among the higher concern categories compared with the previous reporting period. Continue routine monitoring and periodic re-assessment.`,
    );
  }
  if (recommendations.length > 0) {
    sections.push({
      title: "Recommendations",
      paragraphs: recommendations,
    });
  }

  sections.push({
    title: "Notes on Methodology",
    paragraphs: [
      `All figures in this report are derived from a single validated ReportData dataset aggregated over the reporting period (${report.periodLabel}). Concern levels use the assessment-derived classification used throughout MindCare: a student with no assessment within the period is recorded as Not Assessed rather than Low Concern. Attention Required equals Medium plus High concern only. Each student is classified by their latest assessment within the reporting period.`,
    ],
  });

  return sections;
}

export function buildNarrativeReportData(
  report: ReportData,
  preparedBy: string = "Office of Guidance and Counselling",
): NarrativeReportData {
  return {
    report,
    preparedBy,
    narrativeSections: buildNarrativeSections(report),
  };
}

export function generateWordNarrativeReport(
  data: NarrativeReportData,
): string {
  const r = data.report;
  const o = r.overview;
  const cd = r.concernDistribution;
  const ar = r.attentionRequired;

  const deptRows = r.departmentData.map((d) => [
    d.code,
    d.totalStudents,
    d.low,
    d.medium,
    d.high,
    d.attentionRequired,
    d.assessmentCount,
  ]);

  const sectionHtml = data.narrativeSections
    .map(
      (section) => `
      <section class="report-section">
        <h2>${esc(section.title)}</h2>
        ${section.paragraphs
          .map((p) => `<p>${esc(p)}</p>`)
          .join("")}
      </section>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${esc(r.reportTitle)}</title>
<style>
  @page { size: A4; margin: 22mm 18mm; }
  * { box-sizing: border-box; }
  body {
    font-family: Georgia, "Times New Roman", serif;
    color: #1e1b2e;
    font-size: 12pt;
    line-height: 1.55;
    margin: 0;
    padding: 0 6mm;
  }
  .institutional-header {
    text-align: center;
    border-bottom: 4px double #7C3AED;
    padding-bottom: 12px;
    margin-bottom: 22px;
  }
  .institutional-header .university {
    font-size: 20pt;
    font-weight: 700;
    letter-spacing: 1px;
    color: #5B21B6;
    text-transform: uppercase;
    margin: 0;
  }
  .institutional-header .report-title {
    font-size: 13pt;
    font-weight: 600;
    color: #1e1b2e;
    margin: 6px 0 0;
    text-transform: uppercase;
  }
  .institutional-header .report-meta {
    font-size: 10pt;
    color: #555;
    margin-top: 8px;
  }
  h1, h2 { color: #5B21B6; }
  h2 {
    font-size: 13pt;
    border-left: 4px solid #7C3AED;
    padding-left: 8px;
    margin: 26px 0 10px;
  }
  p { margin: 0 0 10px; text-align: justify; }
  table {
    width: 100%;
    border-collapse: collapse;
    font-family: Helvetica, Arial, sans-serif;
    font-size: 9.5pt;
    margin: 8px 0 14px;
  }
  th {
    background: #5B21B6;
    color: #fff;
    text-align: left;
    padding: 6px 8px;
    font-weight: 600;
  }
  td {
    border-bottom: 1px solid #ddd;
    padding: 5px 8px;
  }
  tr:nth-child(even) td { background: #F7F4FE; }
  .kpi-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin: 12px 0 16px;
  }
  .kpi-card {
    flex: 1 1 150px;
    border: 1px solid #E9D5FF;
    border-top: 4px solid #7C3AED;
    border-radius: 8px;
    padding: 10px 12px;
    background: #FBF7FF;
  }
  .kpi-card .kpi-value {
    font-size: 16pt;
    font-weight: 700;
    color: #5B21B6;
  }
  .kpi-card .kpi-label {
    font-size: 9pt;
    color: #555;
    text-transform: uppercase;
    letter-spacing: 0.4px;
  }
  .signature {
    margin-top: 34px;
    font-size: 10.5pt;
  }
  .signature .name { font-weight: 700; }
  .footer-note {
    margin-top: 30px;
    padding-top: 10px;
    border-top: 1px solid #ddd;
    font-size: 8.5pt;
    color: #888;
    font-style: italic;
    text-align: center;
  }
  @media print {
    body { padding: 0; }
  }
</style>
</head>
<body>
  <div class="institutional-header">
    <p class="university">${esc(r.institutionName)}</p>
    <p class="report-title">${esc(r.reportTitle)}</p>
    <p class="report-meta">
      Reporting Period: ${esc(r.periodLabel)} &nbsp;|&nbsp;
      Generated: ${esc(r.generatedAt.toLocaleString())} &nbsp;|&nbsp;
      Prepared By: ${esc(data.preparedBy)}
    </p>
  </div>

  <h2>Executive Summary</h2>
  <div class="kpi-grid">
    <div class="kpi-card">
      <div class="kpi-value">${esc(o.totalStudents)}</div>
      <div class="kpi-label">Total Students</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-value">${esc(o.totalAssessments)}</div>
      <div class="kpi-label">Assessments</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-value">${esc(cd.low)}</div>
      <div class="kpi-label">Low Concern</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-value">${esc(cd.medium)}</div>
      <div class="kpi-label">Medium Concern</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-value">${esc(cd.high)}</div>
      <div class="kpi-label">High Concern</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-value">${esc(ar.count)}</div>
      <div class="kpi-label">Attention Required</div>
    </div>
  </div>

  ${sectionHtml}

  <h2>Department Summary</h2>
  ${htmlTable(
    [
      "Department",
      "Students",
      "Low",
      "Medium",
      "High",
      "Attention Required",
      "Assessments",
    ],
    deptRows,
  )}

  <div class="signature">
    <p>
      Submitted for institutional review and guidance-office action planning.<br />
      <span class="name">${esc(data.preparedBy)}</span><br />
      ${esc(r.institutionName)}
    </p>
  </div>

  <div class="footer-note">
    This document contains confidential student wellness analytics. It is intended
    solely for authorized administrators of ${esc(r.institutionName)} and should
    not be distributed without proper institutional authorization.
  </div>

  <script>
    window.addEventListener("load", function () {
      setTimeout(function () {
        window.focus();
        window.print();
      }, 400);
    });
  </script>
</body>
</html>`;
}

export async function openNarrativeReport(
  data: NarrativeReportData,
  filename: string = DEFAULT_FILENAME,
): Promise<void> {
  const html = generateWordNarrativeReport(data);

  if (Platform.OS === "web") {
    const win = window.open("", "_blank");
    if (!win) {
      Alert.alert(
        "Popup Blocked",
        "Please allow popups to open the narrative report, then use your browser's print dialog to save as PDF.",
      );
      return;
    }
    win.document.open();
    win.document.write(html);
    win.document.close();
    return;
  }

  const uri = `${FileSystem.cacheDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(uri, html, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: "text/html",
      dialogTitle: "Share Narrative Report",
    });
  } else {
    Alert.alert("Report Ready", `Narrative report saved to ${uri}`);
  }
}

// ---------------------------------------------------------------------------
// PDF Export (dedicated print-optimized document)
// ---------------------------------------------------------------------------

const PDF_FILENAME = "MindCare_Administrative_Wellness_Report.html";

function pdfBar(label: string, level: "low" | "medium" | "high", value: number): string {
  const colors = { low: "#16A34A", medium: "#EAB308", high: "#DC2626" };
  return `
    <div class="bar-row">
      <span class="bar-label">${label}</span>
      <div class="bar-track">
        <div class="bar-fill" style="width:${value}%;background:${colors[level]}"></div>
      </div>
      <span class="bar-value">${num(value)}</span>
    </div>`;
}

export function generatePdfReportHtml(report: ReportData): string {
  const o = report.overview;
  const cd = report.concernDistribution;
  const ar = report.attentionRequired;
  const totalConcerned = cd.low + cd.medium + cd.high;
  const pct = (n: number) =>
    totalConcerned > 0 ? Math.round((n / totalConcerned) * 100) : 0;

  const deptRows = report.departmentData.map((d) => [
    d.code,
    d.totalStudents,
    d.low,
    d.medium,
    d.high,
    d.attentionRequired,
  ]);

  const comparisonRows = report.trendComparison.map((t) => [
    t.label,
    t.current,
    t.previous,
    t.comparable ? `${Math.abs(t.changePct)}% (${arrow(t.direction)})` : "N/A",
  ]);

  const narrative = buildNarrativeSections(report);
  const sectionHtml = narrative
    .map(
      (s) => `
      <section class="report-section">
        <h2>${esc(s.title)}</h2>
        ${s.paragraphs.map((p) => `<p>${esc(p)}</p>`).join("")}
      </section>`,
    )
    .join("");

  const meta = [
    ["Academic Year", report.academicYearLabel],
    ["Reporting Period", report.periodLabel],
    ["Trimester", report.trimesterLabel ?? "—"],
    ["Department", report.departmentFilter?.name ?? "All Departments"],
    ["Generated On", report.generatedAt.toLocaleString()],
  ]
    .map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`)
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>MindCare — Administrative Wellness Report</title>
<style>
  @page { size: A4; margin: 18mm 16mm; }
  * { box-sizing: border-box; }
  body {
    font-family: Georgia, "Times New Roman", serif;
    color: #1e1b2e;
    font-size: 11pt;
    line-height: 1.5;
    margin: 0;
  }
  .institutional-header {
    text-align: center;
    border-bottom: 4px double #7C3AED;
    padding-bottom: 12px;
    margin-bottom: 20px;
  }
  .institutional-header .mindcare {
    font-size: 22pt;
    font-weight: 700;
    color: #5B21B6;
    letter-spacing: 1px;
    text-transform: uppercase;
    margin: 0;
  }
  .institutional-header .report-title {
    font-size: 14pt;
    font-weight: 600;
    margin: 6px 0 0;
    text-transform: uppercase;
  }
  h1, h2 { color: #5B21B6; }
  h2 {
    font-size: 12.5pt;
    border-left: 4px solid #7C3AED;
    padding-left: 8px;
    margin: 24px 0 10px;
  }
  p { margin: 0 0 9px; text-align: justify; }
  table {
    width: 100%;
    border-collapse: collapse;
    font-family: Helvetica, Arial, sans-serif;
    font-size: 9.5pt;
    margin: 8px 0 14px;
  }
  th { background: #5B21B6; color: #fff; text-align: left; padding: 5px 8px; font-weight: 600; }
  td { border-bottom: 1px solid #ddd; padding: 5px 8px; }
  tr:nth-child(even) td { background: #F7F4FE; }
  .kpi-grid { display: flex; flex-wrap: wrap; gap: 12px; margin: 12px 0 16px; }
  .kpi-card {
    flex: 1 1 130px;
    border: 1px solid #E9D5FF;
    border-top: 4px solid #7C3AED;
    border-radius: 8px;
    padding: 9px 12px;
    background: #FBF7FF;
  }
  .kpi-card .kpi-value { font-size: 15pt; font-weight: 700; color: #5B21B6; }
  .kpi-card .kpi-label { font-size: 8.5pt; color: #555; text-transform: uppercase; letter-spacing: 0.3px; }
  .bar-row { display: flex; align-items: center; gap: 10px; margin: 6px 0; }
  .bar-label { width: 90px; font-weight: 600; }
  .bar-track { flex: 1; background: #F3F4F6; height: 14px; border-radius: 7px; overflow: hidden; }
  .bar-fill { height: 100%; }
  .bar-value { width: 50px; text-align: right; font-weight: 600; }
  .signature { margin-top: 34px; font-size: 10.5pt; }
  .signature .name { font-weight: 700; }
  .footer-note {
    margin-top: 28px; padding-top: 10px; border-top: 1px solid #ddd;
    font-size: 8.5pt; color: #888; font-style: italic; text-align: center;
  }
</style>
</head>
<body>
  <div class="institutional-header">
    <p class="mindcare">MindCare</p>
    <p class="report-title">Administrative Wellness Report</p>
    <p style="margin-top:8px;"></p>
  </div>

  <table>${meta}</table>

  <h2>Executive Summary</h2>
  <div class="kpi-grid">
    <div class="kpi-card"><div class="kpi-value">${esc(o.totalStudents)}</div><div class="kpi-label">Total Students</div></div>
    <div class="kpi-card"><div class="kpi-value">${esc(o.totalAssessments)}</div><div class="kpi-label">Assessments</div></div>
    <div class="kpi-card"><div class="kpi-value">${esc(cd.high)}</div><div class="kpi-label">High Concern</div></div>
    <div class="kpi-card"><div class="kpi-value">${esc(cd.medium)}</div><div class="kpi-label">Medium Concern</div></div>
    <div class="kpi-card"><div class="kpi-value">${esc(cd.low)}</div><div class="kpi-label">Low Concern</div></div>
    <div class="kpi-card"><div class="kpi-value">${esc(ar.count)}</div><div class="kpi-label">Attention Required</div></div>
  </div>

  <h2>Concern Distribution</h2>
  <div style="max-width:460px;margin:12px 0 16px;">
    ${pdfBar("High", "high", pct(cd.high))}
    ${pdfBar("Medium", "medium", pct(cd.medium))}
    ${pdfBar("Low", "low", pct(cd.low))}
  </div>

  ${sectionHtml}

  <h2>Comparative Period Analytics</h2>
  ${comparisonRows.length > 0 ? htmlTable(["Metric", "Current", "Previous", "Change"], comparisonRows) : "<p>No previous-period comparison is available.</p>"}

  <h2>Department Summary</h2>
  ${htmlTable(
    ["Department", "Students", "Low", "Medium", "High", "Attention Required"],
    deptRows,
  )}

  <div class="signature">
    <p>
      Submitted for institutional review and guidance-office action planning.<br />
      <span class="name">${esc(report.preparedBy)}</span><br />
      ${esc(report.institutionName)}
    </p>
  </div>

  <div class="footer-note">
    This document contains confidential student wellness analytics. It is intended solely for
    authorized administrators of ${esc(report.institutionName)} and should not be distributed
    without proper institutional authorization.
  </div>

  <script>
    window.addEventListener("load", function () {
      setTimeout(function () { window.focus(); window.print(); }, 400);
    });
  </script>
</body>
</html>`;
}

export async function openPdfReport(
  report: ReportData,
  filename: string = PDF_FILENAME,
): Promise<void> {
  const html = generatePdfReportHtml(report);

  if (Platform.OS === "web") {
    const win = window.open("", "_blank");
    if (!win) {
      Alert.alert(
        "Popup Blocked",
        "Please allow popups to open the report, then use your browser's print dialog to save as PDF.",
      );
      return;
    }
    win.document.open();
    win.document.write(html);
    win.document.close();
    return;
  }

  const uri = `${FileSystem.cacheDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(uri, html, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: "text/html",
      dialogTitle: "Open Administrative Report",
    });
  } else {
    Alert.alert("Report Ready", `Administrative report saved to ${uri}`);
  }
}
