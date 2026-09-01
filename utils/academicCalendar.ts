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
 * All period boundaries are computed here — never hardcoded into reports.
 * This is the application's single academic-year calculation.
 */

export type ReportPeriodType =
  | "weekly"
  | "monthly"
  | "trimester"
  | "annual"
  | "custom";

export interface ResolvedReportPeriod {
  type: ReportPeriodType;
  startDate: Date;
  endDate: Date; // exclusive upper bound
  label: string;
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
 * Resolves the academic-year start year for a given calendar date.
 * Since the AY starts in September, a date before September belongs to the
 * previous year's AY.
 */
export function academicYearFor(date: Date): number {
  return date.getMonth() >= ACADEMIC_YEAR_START_MONTH
    ? date.getFullYear()
    : date.getFullYear() - 1;
}

function startOfAy(ayStartYear: number): Date {
  return new Date(ayStartYear, ACADEMIC_YEAR_START_MONTH, 1, 0, 0, 0, 0);
}

/** Exclusive end of the AY: Sep 1 of the following calendar year. */
function endOfAy(ayStartYear: number): Date {
  return new Date(ayStartYear + 1, ACADEMIC_YEAR_START_MONTH, 1, 0, 0, 0, 0);
}

function prevMonday(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  const day = out.getDay(); // 0=Sun..6=Sat
  const delta = day === 0 ? 6 : day - 1;
  out.setDate(out.getDate() - delta);
  return out;
}

function formatShort(d: Date): string {
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: d.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
  });
}

export function resolveWeeklyPeriod(weekStart: Date): ResolvedReportPeriod {
  const start = prevMonday(weekStart);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return {
    type: "weekly",
    startDate: start,
    endDate: end,
    label: `${formatShort(start)} – ${formatShort(new Date(end.getTime() - 1))}`,
  };
}

export function resolveMonthlyPeriod(month: Date): ResolvedReportPeriod {
  const start = new Date(month.getFullYear(), month.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(month.getFullYear(), month.getMonth() + 1, 1, 0, 0, 0, 0);
  return {
    type: "monthly",
    startDate: start,
    endDate: end,
    label: `${MONTHS[month.getMonth()]} ${month.getFullYear()}`,
  };
}

export interface TrimesterSelection {
  trimester: TrimesterNumber;
  academicYear: number;
}

function trimesterStart(sel: TrimesterSelection): Date {
  const ay = sel.academicYear;
  if (sel.trimester === 1) return new Date(ay, 8, 1, 0, 0, 0, 0); // Sep 1
  if (sel.trimester === 2) return new Date(ay + 1, 0, 1, 0, 0, 0, 0); // Jan 1
  return new Date(ay + 1, 4, 1, 0, 0, 0, 0); // May 1
}

function trimesterEnd(sel: TrimesterSelection): Date {
  if (sel.trimester === 1) return new Date(sel.academicYear + 1, 0, 1, 0, 0, 0, 0); // Jan 1
  if (sel.trimester === 2) return new Date(sel.academicYear + 1, 4, 1, 0, 0, 0, 0); // May 1
  return endOfAy(sel.academicYear); // Sep 1
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
    startDate: trimesterStart(sel),
    endDate: trimesterEnd(sel),
    label: `${trimesterLabel(sel.trimester)} AY ${academicYearLabel(
      sel.academicYear,
    )}`,
  };
}

export function resolveAnnualPeriod(academicYear: number): ResolvedReportPeriod {
  return {
    type: "annual",
    startDate: startOfAy(academicYear),
    endDate: endOfAy(academicYear),
    label: `Academic Year ${academicYearLabel(academicYear)}`,
  };
}

export interface CustomRangeSelection {
  startDate: Date;
  endDate: Date; // exclusive
}

export function resolveCustomPeriod(
  sel: CustomRangeSelection,
): ResolvedReportPeriod {
  return {
    type: "custom",
    startDate: sel.startDate,
    endDate: sel.endDate,
    label: `Custom Range: ${formatShort(sel.startDate)} – ${formatShort(
      sel.endDate,
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
  const start = new Date(period.startDate);
  if (period.type === "weekly") {
    const prev = new Date(start);
    prev.setDate(prev.getDate() - 7);
    return resolveWeeklyPeriod(prev);
  }
  if (period.type === "monthly") {
    const prev = new Date(start.getFullYear(), start.getMonth() - 1, 1);
    return resolveMonthlyPeriod(prev);
  }
  if (period.type === "trimester") {
    // Month 8 (Sep) starts T1; month 0 (Jan) starts T2; month 4 (May) starts T3.
    const month = start.getMonth();
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
    return resolveCustomPeriod({
      startDate: new Date(start.getTime() - diff),
      endDate: new Date(start.getTime()),
    });
  }
  return null;
}
