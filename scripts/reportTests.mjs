/**
 * Report-pipeline test runner (Node >= 20).
 *
 * Compiles the pure reporting modules (utils/reportCore.ts, academicCalendar.ts,
 * departmentMeta.ts) plus the tests to CommonJS in .testcache, then runs them
 * with the built-in node:test runner. No framework dependency required.
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const tscBin = resolve(root, "node_modules", "typescript", "bin", "tsc");
const tsc = spawnSync(
  process.execPath,
  [tscBin, "-p", "tsconfig.tests.json"],
  { cwd: root, stdio: "inherit" },
);
if (tsc.status !== 0) {
  process.exit(tsc.status ?? 1);
}

const runner = spawnSync(
  process.execPath,
  ["--test", resolve(root, ".testcache/tests")],
  { cwd: root, stdio: "inherit" },
);
process.exit(runner.status ?? 1);