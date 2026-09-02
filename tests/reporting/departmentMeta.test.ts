import { test } from "node:test";
import assert from "node:assert/strict";
import { getDepartmentCode, normalizeDepartment } from "../../utils/departmentMeta";

test("normalizeDepartment canonicalizes CON aliases", () => {
  assert.equal(normalizeDepartment("CN"), "CON");
  assert.equal(normalizeDepartment("NCN"), "CON");
  assert.equal(normalizeDepartment("College of Nursing (CON)"), "CON");
  assert.equal(normalizeDepartment("college of nursing (cn)"), "CON");
  assert.equal(normalizeDepartment("COLLEGE OF NURSING"), "CON");
});

test("normalizeDepartment extracts parenthetical code", () => {
  assert.equal(normalizeDepartment("College of Information Technology and Computer Studies (CITCS)"), "CITCS");
  assert.equal(normalizeDepartment(" College of Engineering (COE) "), "COE");
});

test("normalizeDepartment preserves known codes verbatim", () => {
  assert.equal(normalizeDepartment("BSCS"), "BSCS");
  assert.equal(normalizeDepartment("CITCS"), "CITCS");
});

test("normalizeDepartment returns empty string only for empty input", () => {
  assert.equal(normalizeDepartment(""), "");
  assert.equal(normalizeDepartment("   "), "");
  assert.equal(normalizeDepartment(null), "");
  assert.equal(normalizeDepartment(undefined), "");
});

test("getDepartmentCode routes through normalizeDepartment", () => {
  assert.equal(getDepartmentCode("College of Nursing (CON)"), "CON");
  assert.equal(getDepartmentCode("CN"), "CON");
  assert.equal(getDepartmentCode("NCN"), "CON");
  assert.equal(getDepartmentCode("unknown things"), "UNKNOWN THINGS");
});