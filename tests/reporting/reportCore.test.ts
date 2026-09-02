import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildReportingInstant,
  reportingDateParts,
  isEventInRange,
  toValidDate,
  resolveRecordEventDate,
  validateReportRecord,
  applyReportFilters,
} from "../../utils/reportCore";

test("buildReportingInstant anchors to Asia/Manila (UTC+8)", () => {
  const aug1 = buildReportingInstant(2026, 7, 1);
  assert.equal(aug1.getTime(), Date.UTC(2026, 7, 1) - 8 * 3600 * 1000);
  assert.equal(aug1.toISOString(), "2026-07-31T16:00:00.000Z");
});

test("buildReportingInstant overflows months correctly", () => {
  const sep1 = buildReportingInstant(2026, 0, 1);
  assert.equal(sep1.getTime(), Date.UTC(2026, 0, 1) - 8 * 3600 * 1000);
});

test("reportingDateParts reads the +08 calendar, not device tz", () => {
  const aug1Manila = buildReportingInstant(2026, 7, 1); // 2026-07-31T16:00Z
  assert.deepEqual(
    { ...reportingDateParts(aug1Manila) },
    { year: 2026, month: 7, day: 1, hour: 0, minute: 0 },
  );
});

test("toValidDate accepts Date, firestore Timestamp-like, numeric, ISO", () => {
  const iso = "2026-08-01T00:00:00.000Z";
  assert.equal(toValidDate(new Date(iso))!.getTime(), new Date(iso).getTime());
  assert.equal(
    toValidDate({ toDate: () => new Date(iso) })!.getTime(),
    new Date(iso).getTime(),
  );
  assert.equal(toValidDate(new Date(iso).getTime())!.getTime(), new Date(iso).getTime());
  assert.equal(toValidDate(0)!.getTime(), new Date(0).getTime());
});

test("toValidDate parses date-only strings as start of day in reporting tz", () => {
  const d = toValidDate("2026-08-01")!;
  assert.equal(d.toISOString(), "2026-07-31T16:00:00.000Z");
  assert.equal(reportingDateParts(d).day, 1);
});

test("toValidDate returns null for invalid values", () => {
  assert.equal(toValidDate(undefined), null);
  assert.equal(toValidDate(null), null);
  assert.equal(toValidDate(""), null);
  assert.equal(toValidDate("not-a-date"), null);
  assert.equal(
    toValidDate({ toDate: null }),
    null,
  );
  assert.equal(toValidDate(Number.NaN), null);
});

test("toValidDate never substitutes today for missing dates", () => {
  assert.equal(toValidDate(null), null);
});

test("isEventInRange enforces start <= event < end (exclusive upper bound)", () => {
  const start = buildReportingInstant(2026, 7, 1); // Aug 1 00:00 +08
  const end = buildReportingInstant(2026, 8, 1); // Sep 1 00:00 +08
  // Aug 1 00:00 +08 exactly (start, inclusive)
  assert.equal(isEventInRange(start, { startDate: start, endDate: end }), true);
  // Jul 31 23:59:59 +08 (before start, excluded)
  assert.equal(
    isEventInRange(buildReportingInstant(2026, 6, 31, 23, 59, 59), { startDate: start, endDate: end }),
    false,
  );
  // Aug 31 23:59:59 +08 (last second of August, included)
  assert.equal(
    isEventInRange(buildReportingInstant(2026, 7, 31, 23, 59, 59), { startDate: start, endDate: end }),
    true,
  );
  // Sep 1 00:00 +08 exactly (end, excluded)
  assert.equal(isEventInRange(end, { startDate: start, endDate: end }), false);
});

test("resolveRecordEventDate prefers completedAt for assessments", () => {
  const createdAt = toValidDate("2026-08-10")!;
  const completedAt = toValidDate("2026-08-11")!;
  assert.equal(
    resolveRecordEventDate("assessment", { completedAt, createdAt })!.getTime(),
    completedAt.getTime(),
  );
  assert.equal(
    resolveRecordEventDate("assessment", { createdAt })!.getTime(),
    createdAt.getTime(),
  );
});

test("resolveRecordEventDate picks submittedAt for surveys, createdAt for mood/journal", () => {
  const createdAt = toValidDate("2026-08-10")!;
  const submittedAt = toValidDate("2026-08-12")!;
  assert.equal(
    resolveRecordEventDate("survey", { submittedAt, createdAt })!.getTime(),
    submittedAt.getTime(),
  );
  assert.equal(
    resolveRecordEventDate("survey", { createdAt })!.getTime(),
    createdAt.getTime(),
  );
  assert.equal(
    resolveRecordEventDate("mood", { createdAt })!.getTime(),
    createdAt.getTime(),
  );
  assert.equal(
    resolveRecordEventDate("journal", { createdAt })!.getTime(),
    createdAt.getTime(),
  );
  assert.equal(resolveRecordEventDate("survey", {}), null);
});

test("validateReportRecord reports missing fields without throwing", () => {
  const ok = {
    studentId: "u1",
    department: "CON",
    source: "assessment" as const,
    eventDate: buildReportingInstant(2026, 7, 1),
  };
  assert.deepEqual(validateReportRecord(ok), { valid: true, reason: "valid" });
  const missingDate = { ...ok, eventDate: null };
  assert.deepEqual(validateReportRecord(missingDate), {
    valid: false,
    reason: "missing-date",
  });
  const missingDept = { ...ok, department: "" };
  assert.deepEqual(validateReportRecord(missingDept), {
    valid: false,
    reason: "missing-department",
  });
  const missingId = { ...ok, studentId: "" };
  assert.deepEqual(validateReportRecord(missingId), {
    valid: false,
    reason: "missing-student-id",
  });
});

test("applyReportFilters is the single date+department gate", () => {
  const range = {
    startDate: buildReportingInstant(2026, 7, 1),
    endDate: buildReportingInstant(2026, 8, 1),
    label: "August 2026",
    periodType: "monthly" as const,
  };
  const con = (eventDate: string) => ({
    studentId: "u1",
    department: "College of Nursing (CON)",
    source: "assessment" as const,
    eventDate: toValidDate(eventDate),
  });
  const records = [
    con("2026-07-31"), // out: before Aug 1 +08
    con("2026-08-01"), // in
    con("2026-08-15"), // in
    con("2026-08-31"), // in (last day inclusive)
    con("2026-09-01"), // out: exclusive upper bound
  ];
  const res = applyReportFilters(records, range, "CON");
  assert.equal(res.included.length, 3);
  assert.equal(res.dataQuality.valid, 3);
  assert.equal(res.dataQuality.excludedOutOfRange, 2);
  assert.equal(res.dataQuality.excludedDepartment, 0);
});

test("applyReportFilters normalizes departments (CN/NCN -> CON)", () => {
  const range = {
    startDate: buildReportingInstant(2026, 7, 1),
    endDate: buildReportingInstant(2026, 8, 1),
    label: "August 2026",
    periodType: "monthly" as const,
  };
  const mk = (deptRaw: string, id: string) => ({
    studentId: id,
    department: deptRaw,
    source: "assessment" as const,
    eventDate: toValidDate("2026-08-05"),
  });
  const res = applyReportFilters(
    [
      mk("CN", "cn"),
      mk("NCN", "ncn"),
      mk("College of Nursing (CON)", "con"),
      mk("CITCS", "citcs"),
    ],
    range,
    "CON",
  );
  assert.deepEqual(
    res.included.map((r) => r.studentId).sort(),
    ["cn", "con", "ncn"],
  );
});

test("applyReportFilters 'ALL' keeps every department and counts valid", () => {
  const range = {
    startDate: buildReportingInstant(2026, 7, 1),
    endDate: buildReportingInstant(2026, 8, 1),
    label: "August 2026",
    periodType: "monthly" as const,
  };
  const res = applyReportFilters(
    [
      { studentId: "a", department: "CN", source: "assessment" as const, eventDate: toValidDate("2026-08-05") },
      { studentId: "b", department: "CITCS", source: "mood" as const, eventDate: toValidDate("2026-08-06") },
    ],
    range,
    "ALL",
  );
  assert.equal(res.included.length, 2);
  assert.equal(res.dataQuality.excludedDepartment, 0);
});