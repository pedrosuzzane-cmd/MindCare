import { test } from "node:test";
import assert from "node:assert/strict";
import { buildReportingInstant, reportingDateParts } from "../../utils/reportCore";
import {
  academicYearLabel,
  academicYearFor,
  getTrimester,
  getAcademicYearDateRange,
  getMonthlyDateRange,
  getTrimesterDateRange,
  normalizeAcademicYear,
  previousPeriodOf,
  resolveAcademicPeriod,
  resolveAnnualPeriod,
  resolveCustomPeriod,
  resolveMonthlyPeriod,
  resolveReportDateRange,
  resolveTrimesterPeriod,
  resolveWeeklyPeriod,
  trimesterLabel,
  type TrimesterNumber,
} from "../../utils/academicCalendar";

/** Reporting-timezone (y, m[1-12], d) of an instant — for exact range asserts. */
function ymd(d: Date): { y: number; m: number; d: number } {
  const p = reportingDateParts(d);
  return { y: p.year, m: p.month + 1, d: p.day };
}

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

// ─── Authoritative resolution: (Academic Year, Month) → date range ────────

const AY = "2025–2026";

function assertRange(
  range: { startDate: Date; endDate: Date },
  expectStart: [number, number, number],
  expectEnd: [number, number, number],
) {
  assert.deepEqual(
    (() => { const p = ymd(range.startDate); return [p.y, p.m, p.d]; })(),
    expectStart,
  );
  assert.deepEqual(
    (() => { const p = ymd(range.endDate); return [p.y, p.m, p.d]; })(),
    expectEnd,
  );
}

test("getMonthlyDateRange maps every month of AY 2025–2026 to its CALENDAR year (the core fix)", () => {
  // Sep–Dec of AY 2025-2026 live in calendar year 2025.
  assertRange(getMonthlyDateRange(AY, 8), [2025, 9, 1], [2025, 10, 1]); // September
  assertRange(getMonthlyDateRange(AY, 11), [2025, 12, 1], [2026, 1, 1]); // December
  // Jan–Aug of AY 2025-2026 live in calendar year 2026 — never 2025.
  assertRange(getMonthlyDateRange(AY, 0), [2026, 1, 1], [2026, 2, 1]); // January
  assertRange(getMonthlyDateRange(AY, 3), [2026, 4, 1], [2026, 5, 1]); // April
  assertRange(getMonthlyDateRange(AY, 4), [2026, 5, 1], [2026, 6, 1]); // May
  assertRange(getMonthlyDateRange(AY, 5), [2026, 6, 1], [2026, 7, 1]); // June
  assertRange(getMonthlyDateRange(AY, 6), [2026, 7, 1], [2026, 8, 1]); // July
  assertRange(getMonthlyDateRange(AY, 7), [2026, 8, 1], [2026, 9, 1]); // August
});

test("monthly trimester classification follows the UC calendar", () => {
  assert.equal(getMonthlyDateRange(AY, 8).label, "September 2025");
  assert.equal(getMonthlyDateRange(AY, 5).label, "June 2026");
  assert.equal(getTrimester(getMonthlyDateRange(AY, 8).startDate), 1); // Sep
  assert.equal(getTrimester(getMonthlyDateRange(AY, 11).startDate), 1); // Dec
  assert.equal(getTrimester(getMonthlyDateRange(AY, 0).startDate), 2); // Jan
  assert.equal(getTrimester(getMonthlyDateRange(AY, 3).startDate), 2); // Apr
  assert.equal(getTrimester(getMonthlyDateRange(AY, 4).startDate), 3); // May
  assert.equal(getTrimester(getMonthlyDateRange(AY, 7).startDate), 3); // Aug
});

test("getTrimesterDateRange maps the three trimesters of AY 2025–2026", () => {
  assertRange(getTrimesterDateRange(AY, 1), [2025, 9, 1], [2026, 1, 1]); // 1st=Sep..Dec
  assertRange(getTrimesterDateRange(AY, 2), [2026, 1, 1], [2026, 5, 1]); // 2nd=Jan..Apr
  assertRange(getTrimesterDateRange(AY, 3), [2026, 5, 1], [2026, 9, 1]); // 3rd=May..Aug
});

test("getTrimesterDateRange 2nd Trimester is January–April", () => {
  assertRange(getTrimesterDateRange(AY, 2), [2026, 1, 1], [2026, 5, 1]);
});

test("getAcademicYearDateRange is Sep 1 .. Sep 1 (exclusive) — three trimesters included", () => {
  assertRange(getAcademicYearDateRange(AY), [2025, 9, 1], [2026, 9, 1]);
});

// ─── normalizeAcademicYear ─────────────────────────────────────────────────

test("normalizeAcademicYear parses every common AY format to its start year", () => {
  assert.equal(normalizeAcademicYear("2025-2026"), 2025);
  assert.equal(normalizeAcademicYear("2025–2026"), 2025);
  assert.equal(normalizeAcademicYear("2025/2026"), 2025);
  assert.equal(normalizeAcademicYear("AY 2025-2026"), 2025);
  assert.equal(normalizeAcademicYear("Academic Year 2025-2026"), 2025);
  assert.equal(normalizeAcademicYear(2025), 2025);
  assert.equal(normalizeAcademicYear("2025"), 2025);
  assert.equal(normalizeAcademicYear(null), academicYearFor(new Date()));
});

// ─── resolveAcademicPeriod (date-only derivation) ──────────────────────────

test("resolveAcademicPeriod derives AY + trimester from the date alone", () => {
  const jun = resolveAcademicPeriod(buildReportingInstant(2026, 5, 15));
  assert.equal(jun.academicYear, 2025);
  assert.equal(jun.academicYearLabel, "2025–2026");
  assert.equal(jun.trimester, 3);
  assert.equal(jun.trimesterLabel, "3rd Trimester");
  assert.equal(jun.month, 6);
  assert.equal(jun.monthName, "June");

  const feb = resolveAcademicPeriod(buildReportingInstant(2026, 1, 15));
  assert.equal(feb.academicYear, 2025);
  assert.equal(feb.trimester, 2);

  const oct = resolveAcademicPeriod(buildReportingInstant(2025, 9, 15));
  assert.equal(oct.academicYear, 2025);
  assert.equal(oct.trimester, 1);
  assert.equal(oct.monthName, "October");
});

// ─── resolveReportDateRange — the single filter resolver ───────────────────

test("resolveReportDateRange monthly June 2026 AY 2025–2026 -> June 1–July 1 2026", () => {
  const r = resolveReportDateRange({
    periodType: "monthly",
    academicYear: 2025,
    month: 5,
  });
  assert.equal(r.startDate.getTime(), buildReportingInstant(2026, 5, 1).getTime());
  assert.equal(r.endDate.getTime(), buildReportingInstant(2026, 6, 1).getTime());
  assert.equal(r.academicYear, 2025);
  assert.equal(r.trimester, 3);
});

test("resolveReportDateRange trimester 3rd AY 2025–2026 -> May 1–Sep 1 2026", () => {
  const r = resolveReportDateRange({
    periodType: "trimester",
    academicYear: 2025,
    trimester: 3,
  });
  assert.equal(r.startDate.getTime(), buildReportingInstant(2026, 4, 1).getTime());
  assert.equal(r.endDate.getTime(), buildReportingInstant(2026, 8, 1).getTime());
  assert.equal(r.trimester, 3);
});

test("resolveReportDateRange annual -> Sep 1 2025 – Sep 1 2026", () => {
  const r = resolveReportDateRange({ periodType: "annual", academicYear: 2025 });
  assert.equal(r.startDate.getTime(), buildReportingInstant(2025, 8, 1).getTime());
  assert.equal(r.endDate.getTime(), buildReportingInstant(2026, 8, 1).getTime());
  assert.equal(r.trimester, null);
});

test("resolveReportDateRange custom end date is the LAST INCLUDED day (exclusive bound added once)", () => {
  const cal = (y: number, m: number, d: number) => new Date(y, m, d);
  const r = resolveReportDateRange({
    periodType: "custom",
    startDate: cal(2026, 5, 1),
    endDate: cal(2026, 5, 30),
  });
  // May 1 2026 .. July 1 2026 exclusive — June 30 is fully included.
  assert.equal(r.startDate.getTime(), buildReportingInstant(2026, 5, 1).getTime());
  assert.equal(r.endDate.getTime(), buildReportingInstant(2026, 6, 1).getTime());
});

test("resolveReportDateRange accepts the en-dash AY label", () => {
  const r = resolveReportDateRange({
    periodType: "monthly",
    academicYear: "2025–2026",
    month: 5,
  });
  assert.equal(r.startDate.getTime(), buildReportingInstant(2026, 5, 1).getTime());
});