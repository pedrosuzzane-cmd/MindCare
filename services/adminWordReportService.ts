import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Alert, Platform } from "react-native";
import type { UniversityExportData } from "./adminExcelExportService";

export interface NarrativeReportSection {
  title: string;
  paragraphs: string[];
}

export interface NarrativeReportData extends UniversityExportData {
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
  const head = headers
    .map((h) => `<th>${esc(h)}</th>`)
    .join("");
  const body = rows
    .map(
      (r) =>
        `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`,
    )
    .join("");
  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

export function generateWordNarrativeReport(
  data: NarrativeReportData,
): string {
  const riskRows = data.riskTrends.map((r) => [
    r.label,
    r.count,
    r.baseline,
    `${r.changePct}%`,
  ]);
  const deptRows = data.departmentMetrics.map((d) => [
    d.deptAbbr,
    d.avgScore,
    d.assessmentCount,
    d.journalCount,
    d.lsnCount,
    `${d.participationRate}%`,
  ]);
  const comparisonRows = data.departmentComparison.map((c) => [
    c.indicator,
    c.department,
    c.value,
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
<title>${esc(data.reportTitle)}</title>
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
    <p class="university">${esc(data.institutionName)}</p>
    <p class="report-title">${esc(data.reportTitle)}</p>
    <p class="report-meta">
      Reporting Period: ${esc(data.reportPeriod)} &nbsp;|&nbsp;
      Generated: ${esc(data.generatedAt)} &nbsp;|&nbsp;
      Prepared By: ${esc(data.preparedBy)}
    </p>
  </div>

  <h2>Executive Summary</h2>
  <div class="kpi-grid">
    <div class="kpi-card">
      <div class="kpi-value">${esc(data.totalStudents)}</div>
      <div class="kpi-label">Total Students Tracked</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-value">${esc(data.studentsAssessed)}</div>
      <div class="kpi-label">Students Assessed</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-value">${esc(data.completionRate)}%</div>
      <div class="kpi-label">Assessment Completion</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-value">${esc(data.avgWellnessScore)}</div>
      <div class="kpi-label">Average Wellness Score</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-value">${esc(data.totalJournalEntries)}</div>
      <div class="kpi-label">Total Journal Entries</div>
    </div>
  </div>

  ${sectionHtml}

  <h2>Wellness & Concern Trend Indicators</h2>
  ${htmlTable(["Category", "Count", "Baseline", "Change (%)"], riskRows)}

  <h2>Department Comparison &amp; Insights</h2>
  ${htmlTable(["Indicator", "Department", "Value"], comparisonRows)}

  <h2>Multi-Metric Department Comparison</h2>
  ${htmlTable(
    [
      "Department",
      "Avg Score",
      "Assessments",
      "Journal Entries",
      "LSN Students",
      "Participation",
    ],
    deptRows,
  )}

  <div class="signature">
    <p>
      Submitted for institutional review and guidance-office action planning.<br />
      <span class="name">${esc(data.preparedBy)}</span><br />
      ${esc(data.institutionName)}
    </p>
  </div>

  <div class="footer-note">
    This document contains confidential student wellness analytics. It is intended
    solely for authorized administrators of ${esc(data.institutionName)} and should
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
