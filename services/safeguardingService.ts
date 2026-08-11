/**
 * Safeguarding & Follow-Up service.
 *
 * Provides the case model used by the guidance office to track follow-up on
 * elevated concern indicators, plus an append-only audit log. Access is
 * restricted to admins / guidance staff by Firestore rules — students can
 * never read or write these collections.
 */

import { db } from "@/constants/firebase";
import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
} from "firebase/firestore";

// ─── Types ───────────────────────────────────────────────────────────────────

export type SafeguardingStatus =
  | "PENDING_REVIEW"
  | "IN_PROGRESS"
  | "RESOURCE_RECOMMENDED"
  | "REFERRED"
  | "MONITORING"
  | "RESOLVED"
  | "CLOSED";

export interface SafeguardingHistoryEntry {
  action: string;
  note?: string;
  actorName?: string;
  timestamp: Date;
}

export interface SafeguardingCase {
  id: string;
  caseNumber: string;
  studentUid: string;
  studentName: string;
  department: string;
  /** Reason surfaced to the guidance office (metadata only, never journal text). */
  reason: string;
  status: SafeguardingStatus;
  assignedCounselor?: string;
  createdAt: Date;
  updatedAt: Date;
  history: SafeguardingHistoryEntry[];
}

export interface AuditLogEntry {
  id: string;
  actorUid?: string;
  actorName?: string;
  action: string;
  caseId?: string;
  caseNumber?: string;
  note?: string;
  createdAt: Date;
}

export interface FollowUpQueueCounts {
  pendingReview: number;
  inProgress: number;
  monitoring: number;
  resolved: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

export const SAFEGUARDING_STATUSES: SafeguardingStatus[] = [
  "PENDING_REVIEW",
  "IN_PROGRESS",
  "RESOURCE_RECOMMENDED",
  "REFERRED",
  "MONITORING",
  "RESOLVED",
  "CLOSED",
];

export const STATUS_LABELS: Record<SafeguardingStatus, string> = {
  PENDING_REVIEW: "Pending Review",
  IN_PROGRESS: "In Progress",
  RESOURCE_RECOMMENDED: "Resources Recommended",
  REFERRED: "Referred",
  MONITORING: "Monitoring",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

export const STATUS_COLORS: Record<SafeguardingStatus, string> = {
  PENDING_REVIEW: "#D97706",
  IN_PROGRESS: "#2563EB",
  RESOURCE_RECOMMENDED: "#7C3AED",
  REFERRED: "#DB2777",
  MONITORING: "#0891B2",
  RESOLVED: "#16A34A",
  CLOSED: "#64748B",
};

// ─── Timestamp helper ────────────────────────────────────────────────────────

function toDate(value: unknown): Date {
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  if (value && typeof value === "object" && "toDate" in value) {
    return (value as { toDate: () => Date }).toDate();
  }
  return new Date();
}

// ─── Mappers ────────────────────────────────────────────────────────────────

function mapCase(id: string, data: Record<string, unknown>): SafeguardingCase {
  return {
    id,
    caseNumber: String(data.caseNumber ?? id),
    studentUid: String(data.studentUid ?? ""),
    studentName: String(data.studentName ?? "Unknown student"),
    department: String(data.department ?? "Unspecified"),
    reason: String(data.reason ?? ""),
    status: (data.status as SafeguardingStatus) ?? "PENDING_REVIEW",
    assignedCounselor: data.assignedCounselor as string | undefined,
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt ?? data.createdAt),
    history: Array.isArray(data.history)
      ? data.history.map((h) => ({
          action: String((h as Record<string, unknown>).action ?? ""),
          note: (h as Record<string, unknown>).note as string | undefined,
          actorName: (h as Record<string, unknown>).actorName as string | undefined,
          timestamp: toDate((h as Record<string, unknown>).timestamp),
        }))
      : [],
  };
}

function mapAuditLog(id: string, data: Record<string, unknown>): AuditLogEntry {
  return {
    id,
    actorUid: data.actorUid as string | undefined,
    actorName: data.actorName as string | undefined,
    action: String(data.action ?? ""),
    caseId: data.caseId as string | undefined,
    caseNumber: data.caseNumber as string | undefined,
    note: data.note as string | undefined,
    createdAt: toDate(data.createdAt ?? data.timestamp),
  };
}

// ─── Reads ───────────────────────────────────────────────────────────────────

export async function fetchSafeguardingCases(): Promise<SafeguardingCase[]> {
  const snap = await getDocs(
    query(collection(db, "safeguardingCases"), orderBy("updatedAt", "desc")),
  );
  return snap.docs.map((d) => mapCase(d.id, d.data() as Record<string, unknown>));
}

export function listenForSafeguardingCases(
  onCases: (cases: SafeguardingCase[]) => void,
  onError?: (err: unknown) => void,
): () => void {
  const q = query(
    collection(db, "safeguardingCases"),
    orderBy("updatedAt", "desc"),
  );
  return onSnapshot(
    q,
    (snap) => onCases(snap.docs.map((d) => mapCase(d.id, d.data()))),
    onError,
  );
}

export async function fetchFollowUpQueueCounts(): Promise<FollowUpQueueCounts> {
  const cases = await fetchSafeguardingCases();
  return countFollowUpQueue(cases);
}

export function countFollowUpQueue(
  cases: SafeguardingCase[],
): FollowUpQueueCounts {
  const counts: FollowUpQueueCounts = {
    pendingReview: 0,
    inProgress: 0,
    monitoring: 0,
    resolved: 0,
  };
  cases.forEach((c) => {
    if (c.status === "PENDING_REVIEW") counts.pendingReview += 1;
    else if (c.status === "IN_PROGRESS" || c.status === "RESOURCE_RECOMMENDED" || c.status === "REFERRED") {
      counts.inProgress += 1;
    } else if (c.status === "MONITORING") counts.monitoring += 1;
    else if (c.status === "RESOLVED" || c.status === "CLOSED") counts.resolved += 1;
  });
  return counts;
}

export async function fetchAuditLogs(maxCount = 50): Promise<AuditLogEntry[]> {
  const snap = await getDocs(
    query(collection(db, "auditLogs"), orderBy("createdAt", "desc"), limit(maxCount)),
  );
  return snap.docs.map((d) => mapAuditLog(d.id, d.data() as Record<string, unknown>));
}

// ─── Writes ──────────────────────────────────────────────────────────────────

export interface CreateCaseInput {
  studentUid: string;
  studentName: string;
  department?: string;
  reason: string;
  actor?: { uid?: string; name?: string };
}

/** Create a safeguarding case and record an audit entry. */
export async function createSafeguardingCase(
  input: CreateCaseInput,
): Promise<string> {
  const caseNumber = `SC-${Date.now().toString(36).toUpperCase()}`;
  const historyEntry: Record<string, unknown> = {
    action: "Case created",
    note: input.reason,
    actorName: input.actor?.name,
    timestamp: serverTimestamp(),
  };
  const ref = await addDoc(collection(db, "safeguardingCases"), {
    caseNumber,
    studentUid: input.studentUid,
    studentName: input.studentName,
    department: input.department ?? "Unspecified",
    reason: input.reason,
    status: "PENDING_REVIEW",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    history: [historyEntry],
  });
  await logAuditEntry({
    actorUid: input.actor?.uid,
    actorName: input.actor?.name,
    action: "CASE_CREATED",
    caseId: ref.id,
    caseNumber,
    note: input.reason,
  });
  return ref.id;
}

/** Update a case status, append history, and audit the change. */
export async function updateSafeguardingStatus(
  caseId: string,
  status: SafeguardingStatus,
  note?: string,
  actor?: { uid?: string; name?: string },
): Promise<void> {
  const historyEntry: Record<string, unknown> = {
    action: `Status → ${STATUS_LABELS[status]}`,
    note,
    actorName: actor?.name,
    timestamp: serverTimestamp(),
  };
  await updateDoc(doc(db, "safeguardingCases", caseId), {
    status,
    updatedAt: serverTimestamp(),
    history: arrayUnion(historyEntry),
  });
  await logAuditEntry({
    actorUid: actor?.uid,
    actorName: actor?.name,
    action: "STATUS_UPDATED",
    caseId,
    note: `${STATUS_LABELS[status]}${note ? ` — ${note}` : ""}`,
  });
}

/** Append a note to a case and audit it. */
export async function addCaseNote(
  caseId: string,
  note: string,
  actor?: { uid?: string; name?: string },
): Promise<void> {
  const historyEntry: Record<string, unknown> = {
    action: "Note added",
    note,
    actorName: actor?.name,
    timestamp: serverTimestamp(),
  };
  await updateDoc(doc(db, "safeguardingCases", caseId), {
    updatedAt: serverTimestamp(),
    history: arrayUnion(historyEntry),
  });
  await logAuditEntry({
    actorUid: actor?.uid,
    actorName: actor?.name,
    action: "NOTE_ADDED",
    caseId,
    note,
  });
}

/** Append-only audit log used by the guidance office. */
export async function logAuditEntry(
  entry: Omit<AuditLogEntry, "id" | "createdAt">,
): Promise<void> {
  await addDoc(collection(db, "auditLogs"), {
    ...entry,
    createdAt: serverTimestamp(),
  });
}

// ─── Filter helpers ──────────────────────────────────────────────────────────

export function filterCasesByStatus(
  cases: SafeguardingCase[],
  status: SafeguardingStatus | "ALL",
): SafeguardingCase[] {
  if (status === "ALL") return cases;
  return cases.filter((c) => c.status === status);
}
