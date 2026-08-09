import { JournalEntry } from "@/services/journalService";

/**
 * Monthly constellation helpers. A month key is always the student's LOCAL
 * calendar month in `YYYY-MM` form (e.g. `2026-08`), so entries written in
 * August land in the August constellation regardless of timezone.
 *
 * Nothing here touches a separate database — months are derived on the fly
 * from the existing journal collection.
 */

const pad = (n: number): string => `${n}`.padStart(2, "0");

/** ISO timestamp of the calendar day the entry belongs to. */
export const getEntryDateIso = (entry: JournalEntry): string =>
  entry.entryDate || entry.createdAt;

/** Local calendar day key `YYYY-MM-DD` for an entry. */
export const getJournalDayKey = (entry: JournalEntry): string => {
  const d = new Date(getEntryDateIso(entry));
  if (Number.isNaN(d.getTime())) return "unknown";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** `YYYY-MM` month key for a Date or ISO string. */
export const getMonthKey = (dateLike: Date | string): string => {
  const date = typeof dateLike === "string" ? new Date(dateLike) : dateLike;
  if (Number.isNaN(date.getTime())) return "unknown";
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
};

export const currentMonthKey = (): string => getMonthKey(new Date());

/** "2026-08" → "August 2026". */
export const formatMonthLabel = (monthKey: string): string => {
  if (monthKey === "unknown") return "";
  const [y, m] = monthKey.split("-").map(Number);
  if (!y || !m || m < 1 || m > 12) return monthKey;
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
};

/** Just the month name: "2026-08" → "August". */
export const formatMonthName = (monthKey: string): string => {
  const label = formatMonthLabel(monthKey);
  return label.split(" ")[0] || label;
};

const shiftMonth = (monthKey: string, delta: number): string => {
  if (monthKey === "unknown") return monthKey;
  const [y, m] = monthKey.split("-").map(Number);
  if (!y || !m || m < 1 || m > 12) return monthKey;
  return getMonthKey(new Date(y, m - 1 + delta, 1));
};

export const getPreviousMonth = (monthKey: string): string =>
  shiftMonth(monthKey, -1);

export const getNextMonth = (monthKey: string): string =>
  shiftMonth(monthKey, 1);

export const isCurrentMonth = (monthKey: string): boolean =>
  monthKey === currentMonthKey();

/** Entries belonging to the given month, newest first. */
export const getMonthEntries = (
  entries: JournalEntry[],
  monthKey: string,
): JournalEntry[] =>
  entries.filter((e) => getMonthKey(getEntryDateIso(e)) === monthKey);

/** Number of unique calendar days covered by a set of entries. */
export const getUniqueJournalDays = (entries: JournalEntry[]): number =>
  new Set(entries.map(getJournalDayKey).filter((k) => k !== "unknown")).size;

/** Number of distinct moods recorded in a set of entries. */
export const getMonthMoodCount = (entries: JournalEntry[]): number =>
  new Set(entries.map((e) => e.mood).filter(Boolean)).size;

/**
 * Current streak (consecutive journal days) ending at the most recent entry
 * day of the month. Empty months report 0.
 */
export const getMonthlyStreak = (entries: JournalEntry[]): number => {
  const days = new Set(entries.map(getJournalDayKey));
  days.delete("unknown");
  if (days.size === 0) return 0;
  const latest = [...days].sort().pop()!.split("-").map(Number);
  const cursor = new Date(latest[0], latest[1] - 1, latest[2]);
  const keyOf = (d: Date): string =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  let streak = 0;
  while (days.has(keyOf(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
};

/** Default monthly goal: 20 reflections. */
export const MONTHLY_GOAL = 20;

export const getMonthlyGoal = (): number => MONTHLY_GOAL;

export interface MonthGroup {
  monthKey: string;
  label: string;
  entries: JournalEntry[];
  count: number;
  journalDays: number;
}

/**
 * Group entries into months that actually contain journal entries, newest
 * month first. Empty months are never included. Passing `excludeMonthKey`
 * drops the currently-viewed month (used for the history list).
 */
export const groupEntriesByMonth = (
  entries: JournalEntry[],
  excludeMonthKey?: string,
): MonthGroup[] => {
  const map = new Map<string, JournalEntry[]>();
  for (const e of entries) {
    const key = getMonthKey(getEntryDateIso(e));
    if (key === "unknown") continue;
    if (excludeMonthKey && key === excludeMonthKey) continue;
    const list = map.get(key);
    if (list) list.push(e);
    else map.set(key, [e]);
  }
  return [...map.entries()]
    .map(([monthKey, monthEntries]) => ({
      monthKey,
      label: formatMonthLabel(monthKey),
      entries: monthEntries,
      count: monthEntries.length,
      journalDays: getUniqueJournalDays(monthEntries),
    }))
    .sort((a, b) => b.monthKey.localeCompare(a.monthKey));
};
