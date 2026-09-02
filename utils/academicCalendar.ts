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

const MONTHS = [
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

export function academicYearLabel(startYear: number): string {
  return `${startYear}–${startYear + 1}`;
}

/** Builds the list of academic-year start years for the picker. */
export function academicYears(count: number = 4): number[] {
  const now = new Date().getFullYear();
  const start = now - 1;
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