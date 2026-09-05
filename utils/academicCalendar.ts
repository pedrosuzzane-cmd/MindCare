/**
 * Academic-year / trimester calendar used by the reporting system.
 *
 * The University of the Cordilleras operates on a TRIMESTER academic calendar:
 *   - 1st Trimester = September .. December
 *   - 2nd Trimester = January .. April
 *   - 3rd Trimester = May .. August
 *
 * The Academic Year spans Sep 1 .. Aug 31 (the year label is the START year).
 * e.g. Academic Year 2025–2026 covers Sep 1, 2025 through Aug 31, 2026. The AY
 * therefore crosses calendar years by design — it is never treated as calendar
 * quarters.
 *
 * Every resolver returns a full `ReportDateRange` (startDate, EXCLUSIVE
 * endDate, label, periodType) whose boundaries are expressed in the explicit
 * reporting timezone (Asia/Manila) — never the browser/server timezone. The
 * official membership rule used everywhere is:
 *
 *   startDate <= eventDate < endDate
 */

import {
  addReportingDays,
  addReportingMonths,
  buildReportingInstant,
  formatReportingDay,
  reportingDateParts,
  reportingWeekStart,
  type ReportDateRange,
  type ReportPeriodType,
} from "./reportCore";

export type { ReportDateRange, ReportPeriodType };

export interface ResolvedReportPeriod extends ReportDateRange {
  /** Backwards-compatible alias kept for older consumers (same as periodType). */
  type: ReportPeriodType;
}

export type ReportPeriodInfo = ResolvedReportPeriod;

export const ACADEMIC_YEAR_START_MONTH = 8; // 0-indexed month (8 = September)

export type TrimesterNumber = 1 | 2 | 3;

export const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** Canonical calendar-month display name for a 0-indexed month. */
export function monthName(monthIndex: number): string {
  return MONTHS[((monthIndex % 12) + 12) % 12];
}

export function academicYearLabel(startYear: number): string {
  return `${startYear}–${startYear + 1}`;
}

/**
 * Builds the list of academic-year start years for the picker. Always includes
 * the CURRENT academic year (so the default selection always appears in the
 * dropdown) plus `count - 1` preceding years.
 */
export function academicYears(count: number = 4): number[] {
  const start = academicYearFor(new Date());
  const years: number[] = [];
  for (let i = 0; i < count; i++) years.push(start - i);
  return years;
}

/**
 * Resolves the academic-year start year for a given calendar date (assessed in
 * the reporting timezone). Since the AY starts in September, a date before
 * September belongs to the previous year's AY.
 */
export function academicYearFor(date: Date): number {
  const { year, month } = reportingDateParts(date);
  return month >= ACADEMIC_YEAR_START_MONTH ? year : year - 1;
}

/**
 * Trimester of a given calendar date (reporting timezone):
 *   September–December -> 1 (1st Trimester)
 *   January–April      -> 2 (2nd Trimester)
 *   May–August         -> 3 (3rd Trimester)
 *
 * This alone is period classification; the selected Academic Year (via
 * `resolveTrimesterPeriod`) supplies the concrete date range.
 */
export function getTrimester(date: Date): TrimesterNumber {
  const month = reportingDateParts(date).month + 1;
  if (month >= 9 && month <= 12) return 1;
  if (month >= 1 && month <= 4) return 2;
  return 3;
}

function startOfAy(ayStartYear: number): Date {
  return buildReportingInstant(ayStartYear, ACADEMIC_YEAR_START_MONTH, 1);
}

/** Exclusive end of the AY: Sep 1 of the following calendar year. */
function endOfAy(ayStartYear: number): Date {
  return buildReportingInstant(ayStartYear + 1, ACADEMIC_YEAR_START_MONTH, 1);
}

function formatShort(d: Date): string {
  return formatReportingDay(d, { month: "short", day: "numeric", year: "numeric" });
}

export function resolveWeeklyPeriod(weekStart: Date): ResolvedReportPeriod {
  const start = reportingWeekStart(weekStart);
  const end = addReportingDays(start, 7);
  return {
    type: "weekly",
    periodType: "weekly",
    startDate: start,
    endDate: end,
    label: `${formatShort(start)} – ${formatShort(addReportingDays(end, -1))}`,
  };
}

/** Explicit (year, monthIndex) selection -> e.g. (2026, 7) = August 2026. */
export function resolveMonthlyPeriod(
  year: number,
  monthIndex: number,
): ResolvedReportPeriod {
  const start = buildReportingInstant(year, monthIndex, 1);
  const end = addReportingMonths(start, 1);
  return {
    type: "monthly",
    periodType: "monthly",
    startDate: start,
    endDate: end,
    label: `${MONTHS[monthIndex]} ${year}`,
  };
}

export interface TrimesterSelection {
  trimester: TrimesterNumber;
  academicYear: number;
}

function trimesterStart(sel: TrimesterSelection): Date {
  const ay = sel.academicYear;
  if (sel.trimester === 1) return buildReportingInstant(ay, 8, 1); // Sep 1
  if (sel.trimester === 2) return buildReportingInstant(ay + 1, 0, 1); // Jan 1
  return buildReportingInstant(ay + 1, 4, 1); // May 1
}

function trimesterEnd(sel: TrimesterSelection): Date {
  if (sel.trimester === 1) return buildReportingInstant(sel.academicYear + 1, 0, 1); // Jan 1 (exclusive)
  if (sel.trimester === 2) return buildReportingInstant(sel.academicYear + 1, 4, 1); // May 1 (exclusive)
  return endOfAy(sel.academicYear); // Sep 1 (exclusive)
}

export function trimesterLabel(trimester: TrimesterNumber): string {
  return `${ordinal(trimester)} Trimester`;
}

function ordinal(n: number): string {
  if (n === 1) return "1st";
  if (n === 2) return "2nd";
  return "3rd";
}

export function resolveTrimesterPeriod(
  sel: TrimesterSelection,
): ResolvedReportPeriod {
  return {
    type: "trimester",
    periodType: "trimester",
    startDate: trimesterStart(sel),
    endDate: trimesterEnd(sel),
    label: `${trimesterLabel(sel.trimester)} AY ${academicYearLabel(
      sel.academicYear,
    )}`,
  };
}

/**
 * Annual report = the AY (September start) unless a calendar year is
 * explicitly requested. Academic Year 2025–2026 = Sep 1, 2025 .. Sep 1, 2026.
 */
export function resolveAnnualPeriod(academicYear: number): ResolvedReportPeriod {
  return {
    type: "annual",
    periodType: "annual",
    startDate: startOfAy(academicYear),
    endDate: endOfAy(academicYear),
    label: `Academic Year ${academicYearLabel(academicYear)}`,
  };
}

export interface CustomRangeSelection {
  startDate: Date;
  endDate: Date; // exclusive
}

/**
 * Custom range: the passed dates' calendar fields (year/month/day, taken from
 * the picker) are interpreted as calendar days in the REPORTING timezone, so
 * the range is stable on any device timezone.
 */
export function resolveCustomPeriod(
  sel: CustomRangeSelection,
): ResolvedReportPeriod {
  const start = new Date(sel.startDate.getFullYear(), sel.startDate.getMonth(), sel.startDate.getDate());
  const end = new Date(sel.endDate.getFullYear(), sel.endDate.getMonth(), sel.endDate.getDate());
  const startInstant = buildReportingInstant(
    start.getFullYear(),
    start.getMonth(),
    start.getDate(),
  );
  const endInstant = buildReportingInstant(
    end.getFullYear(),
    end.getMonth(),
    end.getDate() + 1, // exclusive upper bound
  );
  return {
    type: "custom",
    periodType: "custom",
    startDate: startInstant,
    endDate: endInstant,
    label: `Custom Range: ${formatShort(startInstant)} – ${formatShort(
      endInstant,
    )}`,
  };
}

/**
 * Resolves the previous equivalent reporting period for comparison.
 *   - weekly: the week that started 7 days earlier
 *   - monthly: the previous calendar month
 *   - trimester: the immediately preceding trimester (3rd -> 2nd -> 1st ->
 *      3rd of the previous AY)
 *   - annual: the previous academic year
 *   - custom: the preceding window of equal length
 */
export function previousPeriodOf(
  period: ResolvedReportPeriod,
): ResolvedReportPeriod | null {
  const start = period.startDate;
  if (period.type === "weekly") {
    return resolveWeeklyPeriod(addReportingDays(start, -7));
  }
  if (period.type === "monthly") {
    const { year, month } = reportingDateParts(start);
    const prev =
      month === 0
        ? { year: year - 1, monthIndex: 11 }
        : { year, monthIndex: month - 1 };
    return resolveMonthlyPeriod(prev.year, prev.monthIndex);
  }
  if (period.type === "trimester") {
    const { month } = reportingDateParts(start);
    const ay = academicYearFor(start);
    if (month === 8) return resolveTrimesterPeriod({ trimester: 3, academicYear: ay - 1 });
    if (month === 0) return resolveTrimesterPeriod({ trimester: 1, academicYear: ay });
    return resolveTrimesterPeriod({ trimester: 2, academicYear: ay });
  }
  if (period.type === "annual") {
    return resolveAnnualPeriod(academicYearFor(start) - 1);
  }
  if (period.type === "custom") {
    const diff = period.endDate.getTime() - start.getTime();
    const prevStart = new Date(start.getTime() - diff);
    // ResolveCustomPeriod treats endDate as the LAST INCLUDED calendar day.
    // The previous window must therefore end the day before the current start.
    const sx = reportingDateParts(prevStart);
    const sxAfter = reportingDateParts(start);
    return resolveCustomPeriod({
      startDate: new Date(sx.year, sx.month, sx.day),
      endDate: new Date(sxAfter.year, sxAfter.month, sxAfter.day - 1),
    });
  }
  return null;
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

/** Calendar helpers for the reporting timezone (used by filters/previews). */
export function startOfMonthInReportingTz(
  year: number,
  monthIndex: number,
): Date {
  return buildReportingInstant(year, monthIndex, 1);
}

export function endOfMonthInReportingTz(
  year: number,
  monthIndex: number,
): Date {
  // Exclusive: first instant of the following month.
  return buildReportingInstant(
    monthIndex === 11 ? year + 1 : year,
    (monthIndex + 1) % 12,
    1,
  );
}

export function daysInReportingMonth(year: number, monthIndex: number): number {
  return daysInMonth(year, monthIndex);
}

// ---------------------------------------------------------------------------
// Canonical academic-year normalization & the SINGLE filter resolver
// ---------------------------------------------------------------------------
//
// The reporting UI and every period query MUST go through one of the functions
// below. There is exactly one academic-period calculation in the platform.
//
// The authoritative membership rule is ALWAYS the resolved date range:
//
//   startDate <= activityDate < endDate
//
// Academic-year / trimester / month strings are NEVER used as Firestore query
// conditions. A record's activity date alone decides which academic period it
// belongs to (see resolveAcademicPeriod). The canonical Academic Year format
// is "2025–2026" (en dash); internally everything keys on the START year.

/**
 * Parses any common Academic Year representation into its START year (the
 * canonical internal key). Accepts "2025-2026", "2025–2026", "2025/2026",
 * "AY 2025-2026", "Academic Year 2025-2026" and a bare start year (2025). Falls
 * back to the current academic year for unknown/empty input.
 */
export function normalizeAcademicYear(
  value: number | string | null | undefined,
): number {
  if (value == null) return academicYearFor(new Date());
  if (typeof value === "number") {
    return Number.isFinite(value) ? Math.trunc(value) : academicYearFor(new Date());
  }
  const cleaned = value
    .replace(/academic\s*year/gi, "")
    .replace(/\bay\b/gi, "")
    .replace(/[–—]/g, "-")
    .replace(/[^0-9-]/g, " ")
    .trim();
  const nums = cleaned.match(/\d{4}/g);
  if (nums && nums.length > 0) {
    const start = Number(nums[0]);
    return Number.isFinite(start) ? start : academicYearFor(new Date());
  }
  return academicYearFor(new Date());
}

/**
 * Academic Year 2025–2026 = September 1, 2025 .. September 1, 2026 (exclusive
 * upper bound). NEVER a calendar-year window.
 */
export function getAcademicYearDateRange(
  academicYear: number | string,
): ReportDateRange {
  const ay = normalizeAcademicYear(academicYear);
  const p = resolveAnnualPeriod(ay);
  return {
    startDate: p.startDate,
    endDate: p.endDate,
    label: p.label,
    periodType: "annual",
  };
}

/**
 * Resolves a (Academic Year, Month) selection into a calendar month range.
 *
 * Critical: AY 2025–2026 runs Sep 2025–Aug 2026, so months Jan–Aug of that AY
 * live in CALENDAR year 2026, not 2025. The calendar year is derived from the
 * academic-year boundary — never from the AY start year directly.
 *
 *   getMonthlyDateRange("2025–2026", 5)  -> June 2026: 2026-06-01 .. 2026-07-01
 *   getMonthlyDateRange("2025–2026", 8)  -> September 2025: 2025-09-01 .. 2025-10-01
 */
export function getMonthlyDateRange(
  academicYear: number | string,
  monthIndex: number,
): ReportDateRange {
  const ay = normalizeAcademicYear(academicYear);
  const calendarYear =
    monthIndex >= ACADEMIC_YEAR_START_MONTH ? ay : ay + 1;
  const p = resolveMonthlyPeriod(calendarYear, monthIndex);
  return {
    startDate: p.startDate,
    endDate: p.endDate,
    label: p.label,
    periodType: "monthly",
  };
}

/**
 * Resolves a (Academic Year, Trimester) selection into a date range.
 *
 *   1st Trimester -> Sep 1 .. Jan 1 (exclusive)
 *   2nd Trimester -> Jan 1 .. May 1 (exclusive)
 *   3rd Trimester -> May 1 .. Sep 1 (exclusive)
 */
export function getTrimesterDateRange(
  academicYear: number | string,
  trimester: TrimesterNumber,
): ReportDateRange {
  const ay = normalizeAcademicYear(academicYear);
  const p = resolveTrimesterPeriod({ trimester, academicYear: ay });
  return {
    startDate: p.startDate,
    endDate: p.endDate,
    label: p.label,
    periodType: "trimester",
  };
}

export interface ResolvedAcademicPeriod {
  /** AY start year, e.g. 2025 for AY 2025–2026. */
  academicYear: number;
  /** Canonical "2025–2026" label. */
  academicYearLabel: string;
  /** 1 | 2 | 3 — never depends on a stored metadata string. */
  trimester: TrimesterNumber;
  /** "1st Trimester" etc. */
  trimesterLabel: string;
  /** Calendar month 1–12 (calendar, not academic). */
  month: number;
  /** 0-indexed calendar month. */
  monthIndex: number;
  /** "June" etc. */
  monthName: string;
}

/**
 * Derives a date's academic period from its calendar date alone. June 15, 2026
 * => AY 2025–2026, 3rd Trimester; February 15, 2026 => AY 2025–2026, 2nd
 * Trimester; October 15, 2025 => AY 2025–2026, 1st Trimester.
 */
export function resolveAcademicPeriod(
  activityDate: Date,
): ResolvedAcademicPeriod {
  const { month } = reportingDateParts(activityDate);
  const ay = academicYearFor(activityDate);
  const trimester = getTrimester(activityDate);
  return {
    academicYear: ay,
    academicYearLabel: academicYearLabel(ay),
    trimester,
    trimesterLabel: trimesterLabel(trimester),
    month: month + 1,
    monthIndex: month,
    monthName: monthName(month),
  };
}

/** The filter selection accepted by the central period resolver. */
export interface ReportFilterSelection {
  periodType: ReportPeriodType;
  /** AY start year (number) or any normalized/display form ("2025–2026"). */
  academicYear?: number | string | null;
  /** 0-indexed calendar month (0=January .. 11=December). */
  month?: number | null;
  trimester?: TrimesterNumber | null;
  /** Custom: the FIRST INCLUDED calendar day. */
  startDate?: Date | null;
  /** Custom: the LAST INCLUDED calendar day. */
  endDate?: Date | null;
}

/** The resolved period — always derived from actual dates, never strings. */
export interface ResolvedReportFilters extends ReportDateRange {
  type: ReportPeriodType;
  academicYear: number;
  trimester: TrimesterNumber | null;
}

/**
 * THE single report filter resolver. All report queries (current period,
 * previous-period comparison, previews, exports) must use this to turn UI
 * selections into an authoritative `startDate <= eventDate < endDate` range.
 *
 *   { periodType: "monthly", academicYear: 2025, month: 5 }   // June 2026
 *     -> startDate 2026-06-01, endDate 2026-07-01, trimester 3
 *   { periodType: "trimester", academicYear: 2025, trimester: 3 }
 *     -> startDate 2026-05-01, endDate 2026-09-01, trimester 3
 *   { periodType: "annual", academicYear: 2025 }
 *     -> startDate 2025-09-01, endDate 2026-09-01
 */
export function resolveReportDateRange(
  filters: ReportFilterSelection,
): ResolvedReportFilters {
  const now = new Date();
  switch (filters.periodType) {
    case "weekly": {
      const p = resolveWeeklyPeriod(filters.startDate ?? now);
      return {
        type: p.type,
        periodType: p.periodType,
        startDate: p.startDate,
        endDate: p.endDate,
        label: p.label,
        academicYear: academicYearFor(p.startDate),
        trimester: getTrimester(p.startDate),
      };
    }
    case "monthly": {
      const ay = normalizeAcademicYear(filters.academicYear);
      const monthIndex = filters.month ?? reportingDateParts(now).month;
      const p = getMonthlyDateRange(ay, monthIndex);
      return {
        type: "monthly",
        periodType: "monthly",
        startDate: p.startDate,
        endDate: p.endDate,
        label: p.label,
        academicYear: ay,
        trimester: getTrimester(p.startDate),
      };
    }
    case "trimester": {
      const ay = normalizeAcademicYear(filters.academicYear);
      const trimester = filters.trimester ?? 1;
      const p = getTrimesterDateRange(ay, trimester);
      return {
        type: "trimester",
        periodType: "trimester",
        startDate: p.startDate,
        endDate: p.endDate,
        label: p.label,
        academicYear: ay,
        trimester,
      };
    }
    case "annual": {
      const ay = normalizeAcademicYear(filters.academicYear);
      const p = getAcademicYearDateRange(ay);
      return {
        type: "annual",
        periodType: "annual",
        startDate: p.startDate,
        endDate: p.endDate,
        label: p.label,
        academicYear: ay,
        trimester: null,
      };
    }
    case "custom": {
      const start = filters.startDate ?? now;
      const p = resolveCustomPeriod({
        startDate: start,
        endDate: filters.endDate ?? filters.startDate ?? now,
      });
      return {
        type: "custom",
        periodType: "custom",
        startDate: p.startDate,
        endDate: p.endDate,
        label: p.label,
        academicYear: academicYearFor(p.startDate),
        trimester: null,
      };
    }
  }
}