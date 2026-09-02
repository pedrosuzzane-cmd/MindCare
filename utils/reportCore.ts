import { normalizeDepartment } from "./departmentMeta";

/**
 * Central reporting pipeline — the ONLY place that knows how a reportable
 * record is dated, validated, and filtered.
 *
 * Every report output (KPI cards, charts, narrative, Excel, PDF, student
 * lookup, department analytics) must consume records that passed through the
 * single `applyReportFilters()` function below. Nothing in the reporting UI may
 * re-implement its own date/department math.
 *
 * The official range rule is:
 *
 *   startDate <= eventDate < endDate
 *
 * i.e. the upper bound is EXCLUSIVE so a record can never appear in two
 * adjacent periods (e.g. August 31 23:59:59 belongs to August, September 1
 * 00:00:00 belongs to September).
 */

// ---------------------------------------------------------------------------
// Reporting timezone
// ---------------------------------------------------------------------------

/**
 * Every report boundary is expressed in the University of the Cordilleras /
 * MindCare reporting timezone: Asia/Manila (UTC+8). The Philippines has no
 * daylight saving time, so a fixed +08:00 offset is exact and requires no IANA
 * database. Boundaries are deliberately NOT derived from the browser or server
 * timezone — a record submitted at 2026-07-31T16:00:00Z must be classified as
 * August 1 00:00 (Manila), never as July 31 on a UTC device.
 */
export const REPORT_TIMEZONE_NAME = "Asia/Manila";
export const REPORT_TIMEZONE_OFFSET_MIN = 8 * 60; // UTC+8
export const REPORT_TIMEZONE_OFFSET_MS =
  REPORT_TIMEZONE_OFFSET_MIN * 60 * 1000;

/** Calendar (year/month/day/hour/minute) of a given instant in the reporting timezone. */
export function reportingDateParts(
  date: Date,
): { year: number; month: number; day: number; hour: number; minute: number } {
  const shifted = new Date(date.getTime() + REPORT_TIMEZONE_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
  };
}

/**
 * Builds the exact instant for a calendar date/time expressed in the reporting
 * timezone. E.g. buildReportingInstant(2026, 7, 1) is "August 1, 2026 00:00
 * Asia/Manila" regardless of the device timezone.
 */
export function buildReportingInstant(
  year: number,
  monthIndex: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
): Date {
  return new Date(
    Date.UTC(year, monthIndex, day, hour, minute, second, 0) -
      REPORT_TIMEZONE_OFFSET_MS,
  );
}

/** Start of the reporting-timezone calendar day that contains `date`. */
export function reportingDayStart(date: Date): Date {
  const p = reportingDateParts(date);
  return buildReportingInstant(p.year, p.month, p.day);
}

export function addReportingDays(date: Date, days: number): Date {
  const p = reportingDateParts(date);
  return buildReportingInstant(p.year, p.month, p.day + days);
}

/** Adds whole calendar months (keeping day 1 anchoring to stabilize month math). */
export function addReportingMonths(date: Date, months: number): Date {
  const p = reportingDateParts(date);
  return buildReportingInstant(p.year, p.month + months, 1);
}

/** Monday of the reporting-timezone week containing `date` (Mon=0 offset). */
export function reportingWeekStart(date: Date): Date {
  const p = reportingDateParts(date);
  const weekday = new Date(
    Date.UTC(p.year, p.month, p.day),
  ).getUTCDay(); // 0 = Sunday .. 6 = Saturday (in reporting tz)
  const delta = weekday === 0 ? 6 : weekday - 1;
  return buildReportingInstant(p.year, p.month, p.day - delta);
}

/** Formats a date as a calendar day in the reporting timezone ("August 3, 2026"). */
export function formatReportingDay(date: Date, opts?: Intl.DateTimeFormatOptions): string {
  const p = reportingDateParts(date);
  // Noon-UTC trick keeps toLocaleDateString stable on any device timezone.
  const noon = new Date(Date.UTC(p.year, p.month, p.day, 12, 0, 0));
  return noon.toLocaleDateString(
    "en-US",
    opts ?? { month: "long", day: "numeric", year: "numeric" },
  );
}

// ---------------------------------------------------------------------------
// Central record model
// ---------------------------------------------------------------------------

export type ReportRecordSource = "assessment" | "mood" | "journal" | "survey";

/**
 * The canonical reportable record. Every dated entity in the platform maps onto
 * this shape with ONE event date:
 *
 *   assessment -> completedAt (falls back to createdAt)
 *   journal    -> createdAt
 *   mood       -> createdAt (mood entries are journal rows in MindCare)
 *   survey     -> submittedAt (falls back to createdAt)
 */
export interface ReportRecord {
  studentId: string;
  /** Normalized department code ("" / null when the student has none). */
  department: string;
  source: ReportRecordSource;
  /** Resolved event date; null when the original date field is missing/invalid. */
  eventDate: Date | null;
  totalScore?: number;
  riskLevel?: string;
  mood?: string;
  sentiment?: "positive" | "neutral" | "negative";
}

/** The canonical report date-range structure every resolver must produce. */
export interface ReportDateRange {
  startDate: Date;
  endDate: Date; // EXCLUSIVE upper bound: startDate <= eventDate < endDate
  label: string;
  periodType: ReportPeriodType;
}

export type ReportPeriodType =
  | "weekly"
  | "monthly"
  | "trimester"
  | "annual"
  | "custom";

/** Official membership test: startDate <= eventDate < endDate. */
export function isEventInRange(
  eventDate: Date,
  range: Pick<ReportDateRange, "startDate" | "endDate">,
): boolean {
  return (
    eventDate.getTime() >= range.startDate.getTime() &&
    eventDate.getTime() < range.endDate.getTime()
  );
}

/**
 * Resolves a raw Firestore value into a Date. Accepts Firestore Timestamp
 * objects ({ toDate() }), JS Date, epoch milliseconds, numeric strings, and ISO
 * strings. DATE-ONLY strings ("2026-08-01") are interpreted as the start of
 * that calendar day in the REPORTING timezone so they never shift a day due to
 * UTC parsing. Never falls back to "today" — missing/invalid dates return null
 * and the record is excluded from date-specific reporting (see
 * `applyReportFilters`).
 */
export function toValidDate(value: unknown): Date | null {
  if (value == null) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === "object") {
    const obj = value as { toDate?: () => unknown };
    if (typeof obj.toDate === "function") {
      const d = obj.toDate();
      return d instanceof Date && !Number.isNaN(d.getTime()) ? d : null;
    }
    if ("seconds" in obj && typeof (obj as { seconds: unknown }).seconds === "number") {
      const sec = (obj as { seconds: number }).seconds;
      const ms = (obj as { milliseconds?: number }).milliseconds ?? 0;
      const d = new Date(sec * 1000 + ms);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    return null;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? new Date(value) : null;
  }
  if (typeof value === "string") {
    const v = value.trim();
    if (v === "") return null;
    const asNum = Number(v);
    if (Number.isFinite(asNum) && /^-?\d+$/.test(v)) {
      return new Date(asNum);
    }
    // Date-only string -> start of that calendar day in the reporting timezone.
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
      const [y, m, d] = v.split("-").map(Number);
      if (y >= 1970 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
        return buildReportingInstant(y, m - 1, d);
      }
      return null;
    }
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/** Event-date field precedence per record source. */
export function resolveRecordEventDate(
  source: ReportRecordSource,
  data: {
    completedAt?: unknown;
    submittedAt?: unknown;
    createdAt?: unknown;
  },
): Date | null {
  const candidates: unknown[] =
    source === "assessment"
      ? [data?.completedAt, data?.createdAt]
      : source === "survey"
        ? [data?.submittedAt, data?.createdAt]
        : [data?.createdAt];
  for (const candidate of candidates) {
    const date = toValidDate(candidate);
    if (date) return date;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export interface ReportRecordValidation {
  valid: boolean;
  reason: "valid" | "missing-student-id" | "missing-date" | "missing-department";
}

/**
 * Validates a reportable record. Records that fail are tracked in the
 * `dataQuality` summary and NEVER silently shape report numbers.
 */
export function validateReportRecord(
  record: ReportRecord,
): ReportRecordValidation {
  if (!record.studentId) return { valid: false, reason: "missing-student-id" };
  if (!record.eventDate) return { valid: false, reason: "missing-date" };
  if (!normalizeDepartment(record.department)) {
    return { valid: false, reason: "missing-department" };
  }
  return { valid: true, reason: "valid" };
}

// ---------------------------------------------------------------------------
// Central filter — the single report-data query
// ---------------------------------------------------------------------------

export interface ReportDataQuality {
  totalRecords: number;
  valid: number;
  excludedOutOfRange: number;
  excludedDepartment: number;
  missingDate: number;
  missingDepartment: number;
  missingStudentId: number;
}

export interface AppliedReportFilter {
  included: ReportRecord[];
  dataQuality: ReportDataQuality;
}

/**
 * THE single report-data query. Both the current period and the comparison
 * (previous) period go through exactly this function; KPI cards, charts,
 * narrative, Excel, PDF, student lookup and department analytics then consume
 * its `included` records — none of them re-filter.
 */
export function applyReportFilters(
  records: ReportRecord[],
  dateRange: Pick<ReportDateRange, "startDate" | "endDate">,
  selectedDepartment: string,
): AppliedReportFilter {
  const included: ReportRecord[] = [];
  const dataQuality: ReportDataQuality = {
    totalRecords: records.length,
    valid: 0,
    excludedOutOfRange: 0,
    excludedDepartment: 0,
    missingDate: 0,
    missingDepartment: 0,
    missingStudentId: 0,
  };

  const matchesDepartment =
    (department: string) =>
    (record: Pick<ReportRecord, "department">): boolean =>
      normalizeDepartment(record.department) ===
      normalizeDepartment(department);

  for (const record of records) {
    const validation = validateReportRecord(record);
    if (!validation.valid) {
      if (validation.reason === "missing-student-id") {
        dataQuality.missingStudentId += 1;
      } else if (validation.reason === "missing-date") {
        dataQuality.missingDate += 1;
      } else {
        dataQuality.missingDepartment += 1;
      }
      continue;
    }

    if (
      selectedDepartment !== "ALL" &&
      !matchesDepartment(selectedDepartment)(record)
    ) {
      dataQuality.excludedDepartment += 1;
      continue;
    }

    if (!isEventInRange(record.eventDate as Date, dateRange)) {
      dataQuality.excludedOutOfRange += 1;
      continue;
    }

    dataQuality.valid += 1;
    included.push(record);
  }

  return { included, dataQuality };
}