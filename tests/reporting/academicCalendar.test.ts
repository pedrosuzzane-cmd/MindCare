import { test } from "node:test";
import assert from "node:assert/strict";
import { buildReportingInstant, reportingDateParts } from "../../utils/reportCore";
import {
  academicYearLabel,
  academicYearFor,
  getTrimester,
  previousPeriodOf,
  resolveAnnualPeriod,
  resolveCustomPeriod,
  resolveMonthlyPeriod,
  resolveTrimesterPeriod,
  resolveWeeklyPeriod,
  trimesterLabel,
  type TrimesterNumber,
} from "../../utils/academicCalendar";

// --- Monthly ---------------------------------------------------------------

test("resolveMonthlyPeriod covers the exact calendar month (exclusive end)", () => {
  const aug = resolveMonthlyPeriod(2026, 7);
  assert.equal(reportingDateParts(aug.startDate).month, 7);
  assert.equal(reportingDateParts(aug.startDate).day, 1);
  assert.equal(reportingDateParts(aug.endDate).month, 8);
  assert.equal(reportingDateParts(aug.endDate).day, 1);
  assert.equal(aug.label, "August 2026");
  assert.equal(aug.periodType, "monthly");
});

test("resolveMonthlyPeriod December wraps to January next year", () => {
  const dec = resolveMonthlyPeriod(2026, 11);
  assert.equal(reportingDateParts(dec.startDate).year, 2026);
  assert.equal(reportingDateParts(dec.startDate).month, 11);
  assert.equal(reportingDateParts(dec.endDate).year, 2027);
  assert.equal(reportingDateParts(dec.endDate).month, 0);
});

// --- Trimester -------------------------------------------------------------

test("trimester ranges map exactly to the UC academic calendar", () => {
  // T1 Sep 1 .. Jan 1
  const t1 = resolveTrimesterPeriod({ trimester: 1, academicYear: 2025 });
  assert.equal(t1.label, "1st Trimester AY 2025–2026");
  assert.ok(reportingDateParts(t1.startDate).month === 8 && reportingDateParts(t1.startDate).day === 1);
  assert.ok(reportingDateParts(t1.endDate).month === 0 && reportingDateParts(t1.endDate).day === 1);

  // T2 Jan 1 .. May 1
  const t2 = resolveTrimesterPeriod({ trimester: 2, academicYear: 2025 });
  assert.ok(reportingDateParts(t2.startDate).month === 0 && reportingDateParts(t2.startDate).day === 1);
  assert.ok(reportingDateParts(t2.endDate).month === 4 && reportingDateParts(t2.endDate).day === 1);

  // T3 May 1 .. Sep 1
  const t3 = resolveTrimesterPeriod({ trimester: 3, academicYear: 2025 });
  assert.ok(reportingDateParts(t3.startDate).month === 4 && reportingDateParts(t3.startDate).day === 1);
  assert.ok(reportingDateParts(t3.endDate).month === 8 && reportingDateParts(t3.endDate).day === 1);
  assert.equal(getTrimester(t3.startDate), 3);
});

test("trimester boundary starts in the correct calendar year", () => {
  const t3 = resolveTrimesterPeriod({ trimester: 3, academicYear: 2025 });
  assert.ok(reportingDateParts(t3.startDate).year === 2026); // May 2026
  assert.equal(trimesterLabel(3), "3rd Trimester");
});

// --- Annual ----------------------------------------------------------------

test("resolveAnnualPeriod is the academic year Sep 1 .. Sep 1", () => {
  const ay = resolveAnnualPeriod(2025);
  assert.equal(ay.label, "Academic Year 2025–2026");
  assert.ok(reportingDateParts(ay.startDate).month === 8 && reportingDateParts(ay.startDate).day === 1);
  assert.ok(reportingDateParts(ay.endDate).month === 8 && reportingDateParts(ay.endDate).day === 1);
  assert.equal(reportingDateParts(ay.endDate).year, 2026);
  assert.equal(academicYearLabel(2025), "2025–2026");
});

// --- Weekly ----------------------------------------------------------------

test("resolveWeeklyPeriod is Monday-aligned with an exclusive end", () => {
  // 2026-08-05T12:00Z = Aug 5, 2026 20:00 +08 (Wednesday)
  const week = resolveWeeklyPeriod(new Date("2026-08-05T12:00:00.000Z"));
  assert.equal(reportingDateParts(week.startDate).day, 3); // Mon Aug 3
  assert.equal(reportingDateParts(week.endDate).day, 10); // Mon Aug 10 (exclusive)
});

// --- Custom ----------------------------------------------------------------

test("resolveCustomPeriod interprets picker fields in reporting tz, end exclusive", () => {
  const cal = (y: number, m: number, d: number) => new Date(y, m, d);
  const p = resolveCustomPeriod({ startDate: cal(2026, 7, 1), endDate: cal(2026, 7, 15) });
  assert.equal(reportingDateParts(p.startDate).month, 7);
  assert.equal(reportingDateParts(p.startDate).day, 1);
  assert.equal(reportingDateParts(p.endDate).month, 7);
  assert.equal(reportingDateParts(p.endDate).day, 16); // Aug 16 exclusive
  assert.equal(p.periodType, "custom");
});

// --- Academic year helpers -------------------------------------------------

test("academicYearFor assigns August to the previous AY, September to the new AY", () => {
  assert.equal(academicYearFor(buildReportingInstant(2026, 7, 1)), 2025); // Aug 1 2026 -> AY 2025-2026
  assert.equal(academicYearFor(buildReportingInstant(2026, 8, 1)), 2026); // Sep 1 2026 -> AY 2026-2027
  assert.equal(academicYearFor(buildReportingInstant(2026, 3, 1)), 2025); // Apr 1 2026
});

test("getTrimester classifies months by the UC calendar", () => {
  assert.equal(getTrimester(buildReportingInstant(2026, 8, 15)), 1); // Sep
  assert.equal(getTrimester(buildReportingInstant(2026, 11, 15)), 1); // Dec
  assert.equal(getTrimester(buildReportingInstant(2026, 0, 15)), 2); // Jan
  assert.equal(getTrimester(buildReportingInstant(2026, 3, 15)), 2); // Apr
  assert.equal(getTrimester(buildReportingInstant(2026, 4, 15)), 3); // May
  assert.equal(getTrimester(buildReportingInstant(2026, 7, 15)), 3); // Aug
});

// --- Previous period -------------------------------------------------------

test("previousPeriodOf retraces monthly, trimester, annual, weekly", () => {
  const monthly = resolveMonthlyPeriod(2026, 7);
  const prevMonth = previousPeriodOf(monthly)!;
  assert.equal(prevMonth.label, "July 2026");

  const t1 = resolveTrimesterPeriod({ trimester: 1, academicYear: 2025 });
  const prevT3 = previousPeriodOf(t1)!;
  assert.equal(prevT3.label, "3rd Trimester AY 2024–2025");

  const t3 = resolveTrimesterPeriod({ trimester: 3, academicYear: 2025 });
  const prevT2 = previousPeriodOf(t3)!;
  assert.equal(prevT2.label, "2nd Trimester AY 2025–2026");

  const ay = resolveAnnualPeriod(2025);
  assert.equal(previousPeriodOf(ay)!.label, "Academic Year 2024–2025");

  const weekly = resolveWeeklyPeriod(new Date("2026-08-05T12:00:00.000Z"));
  const prevWeek = previousPeriodOf(weekly)!;
  assert.equal(reportingDateParts(prevWeek.startDate).day, 27); // Mon Jul 27
});

test("previousPeriodOf custom window is equal length and back-to-back", () => {
  const cal = (y: number, m: number, d: number) => new Date(y, m, d);
  const p = resolveCustomPeriod({ startDate: cal(2026, 7, 1), endDate: cal(2026, 7, 15) });
  const prev = previousPeriodOf(p)!;
  const len = p.endDate.getTime() - p.startDate.getTime();
  assert.equal(prev.endDate.getTime(), p.startDate.getTime());
  assert.equal(prev.endDate.getTime() - prev.startDate.getTime(), len);
});

test("trimester label formatting", () => {
  const t: TrimesterNumber = 2;
  assert.equal(trimesterLabel(t), "2nd Trimester");
});