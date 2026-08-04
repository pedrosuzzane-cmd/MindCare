import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Alert, Platform } from "react-native";
import * as XLSX from "xlsx";

export type ExportRiskLevel = "low" | "normal" | "high";

export interface ExportStudentRow {
  uid: string;
  name: string;
  schoolId: string;
  yearLevel: string;
  department: string;
  isLSN?: boolean;
  lsnCategory?: string;
  latestTotalScore?: number;
  latestRiskLevel?: ExportRiskLevel;
  assessmentsCount: number;
  journalCount: number;
}

export interface ExportSummaryRow {
  metric: string;
  value: string | number;
  detail?: string;
}

const RISK_LABEL: Record<ExportRiskLevel, string> = {
  low: "Low",
  normal: "Moderate",
  high: "High",
};

const LSN_LABEL: Record<string, string> = {
  "additional-needs": "Students with Additional Needs",
  disabilities: "Students with Disabilities",
};

function toSheetRows(students: ExportStudentRow[]): Record<string, string | number>[] {
  return students.map((s) => ({
    "Student ID": s.schoolId || "—",
    "Full Name": s.name,
    Department: s.department,
    "Year Level": s.yearLevel,
    "LSN Category": s.lsnCategory
      ? LSN_LABEL[s.lsnCategory] || "LSN"
      : s.isLSN
        ? "LSN"
        : "None",
    "Concern Level": s.latestRiskLevel
      ? RISK_LABEL[s.latestRiskLevel]
      : "Not Assessed",
    "Assessment Score": s.latestTotalScore ?? "",
    "Assessments Taken": s.assessmentsCount,
    "Journal Entries": s.journalCount,
  }));
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

export function buildAnalyticsWorkbook(
  students: ExportStudentRow[],
  summaryRows: ExportSummaryRow[],
  overallRows: ExportSummaryRow[],
): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  const studentSheet = XLSX.utils.json_to_sheet(toSheetRows(students));
  autoWidth(studentSheet);
  XLSX.utils.book_append_sheet(wb, studentSheet, "Student Analysis");

  const deptSheet = XLSX.utils.json_to_sheet(
    summaryRows.map((r) => ({ Metric: r.metric, Value: r.value })),
  );
  autoWidth(deptSheet);
  XLSX.utils.book_append_sheet(wb, deptSheet, "Department Summary");

  const overallSheet = XLSX.utils.json_to_sheet(
    overallRows.map((r) => ({
      Metric: r.metric,
      Value: r.value,
      Details: r.detail ?? "",
    })),
  );
  autoWidth(overallSheet);
  XLSX.utils.book_append_sheet(wb, overallSheet, "Overall Summary");

  return wb;
}

export async function downloadWorkbook(
  wb: XLSX.WorkBook,
  filename: string,
): Promise<void> {
  if (Platform.OS === "web") {
    XLSX.writeFile(wb, filename);
    return;
  }

  const base64 = XLSX.write(wb, { bookType: "xlsx", type: "base64" });
  const uri = `${FileSystem.cacheDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(uri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      dialogTitle: "Export Analytics Report",
    });
  } else {
    Alert.alert("Export Ready", `Report saved to ${uri}`);
  }
}

export function buildStudentCsv(students: ExportStudentRow[]): string {
  const ws = XLSX.utils.json_to_sheet(toSheetRows(students));
  return XLSX.utils.sheet_to_csv(ws);
}

export async function downloadCsv(csv: string, filename: string): Promise<void> {
  if (Platform.OS === "web") {
    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return;
  }

  const uri = `${FileSystem.cacheDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(uri, csv, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: "text/csv",
      dialogTitle: "Export Student Analysis",
    });
  } else {
    Alert.alert("Export Ready", `CSV saved to ${uri}`);
  }
}
