// ─── Official UC department metadata ───────────────────────────────────────
// Mirrors the department labels used across the app (see app/auth/register.tsx).
// Codes are the official abbreviation shown to admins; the full names allow
// the analytics UI to disambiguate departments that share the same code.
const DEPARTMENT_FULL_NAMES: Record<string, string> = {
  CITCS: "College of Information Technology and Computer Science (CITCS)",
  COA: "College of Accountancy (COA)",
  CBA: "College of Business Administration (CBA)",
  CCJE: "College of Criminal Justice Education (CCJE)",
  COE: "College of Engineering (COE)",
  CAFA: "College of Architecture and Fine Arts (CAFA)",
  CAS: "College of Arts and Sciences (CAS)",
  CTE: "College of Teacher Education (CTE)",
  CHTM: "College of Hospitality and Tourism Management (CHTM)",
  CON: "College of Nursing (CON)",
};

// Legacy or non-standard codes that map onto the same department.
const DEPARTMENT_CODE_ALIASES: Record<string, string> = {
  CN: "CON",
  CEA: "COE",
};

/**
 * Extracts the stable department code from a stored department string.
 * e.g. "College of Criminal Justice Education (CCJE)" -> "CCJE".
 * Falls back to the trimmed input when no parenthetical code is present.
 */
export function getDepartmentCode(fullName: string): string {
  const match = fullName.match(/\(([^)]+)\)/);
  const raw = (match ? match[1] : fullName).trim().toUpperCase();
  return DEPARTMENT_CODE_ALIASES[raw] ?? raw;
}

/** Extracts the abbreviation from a stored department string (no normalization). */
export function getDeptAbbreviation(fullName: string): string {
  const match = fullName.match(/\(([^)]+)\)/);
  return match ? match[1] : fullName;
}

/**
 * Canonical full department label for a code, falling back to the given raw
 * label when the code is unknown.
 */
export function canonicalDeptName(code: string, fallback: string): string {
  return DEPARTMENT_FULL_NAMES[code] ?? fallback;
}

/**
 * Standardized display label in "CODE — Full Name" form so admins can read the
 * official code while still recognizing the full department name.
 */
export function formatDepartmentName(input: string): string {
  const code = getDepartmentCode(input);
  const full = DEPARTMENT_FULL_NAMES[code];
  if (!full) return input;
  return `${code} — ${full.replace(/\s*\([^)]*\)\s*$/, "")}`;
}

/** Shape of the department buckets produced by admin analytics aggregation. */
export interface DepartmentBucket {
  label: string;
  total: number;
  low: number;
  normal: number;
  high: number;
  scoreSum: number;
}

/**
 * Merges department buckets that share the same stable code (grouping by the
 * parenthetical code rather than the full stored string). This prevents the
 * same department from appearing twice when students store slightly different
 * label variants. Buckets are returned sorted by total student count.
 */
export function mergeDepartmentBuckets(
  records: DepartmentBucket[],
): DepartmentBucket[] {
  const merged = new Map<string, DepartmentBucket>();
  for (const r of records) {
    const code = getDepartmentCode(r.label);
    const existing = merged.get(code);
    if (existing) {
      existing.total += r.total;
      existing.low += r.low;
      existing.normal += r.normal;
      existing.high += r.high;
      existing.scoreSum += r.scoreSum;
    } else {
      merged.set(code, {
        label: DEPARTMENT_FULL_NAMES[code] ?? r.label,
        total: r.total,
        low: r.low,
        normal: r.normal,
        high: r.high,
        scoreSum: r.scoreSum,
      });
    }
  }
  return Array.from(merged.values()).sort((a, b) => b.total - a.total);
}
