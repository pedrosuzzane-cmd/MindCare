/**
 * Student Management & Support service.
 *
 * Operational layer for administrators: student lifecycle status, non-clinical
 * support workflows, follow-up scheduling, and an append-only audit trail.
 * Reuses `listenForAdminDashboardData` as the canonical student aggregation and
 * writes lifecycle/support metadata onto the existing `users/{uid}` document so
 * the rest of the system (analytics, safeguarding, messaging) keeps working.
 *
 * All writes are admin-gated by Firestore rules. No journal or AI content is
 * ever stored here — only counts, categories, dates and support metadata.
 */

import { db } from "@/constants/firebase";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import {
  listenForAdminDashboardData,
  type StudentSummary,
} from "@/services/adminFirestoreService";
import {
  ACTIVE_SUPPORT_STATUSES,
  DEFAULT_LIFECYCLE_STATUS,
  DEFAULT_SUPPORT_STATUS,
  LIFECYCLE_LABELS,
  SUPPORT_LABELS,
  type LifecycleStatus,
  type SupportActionType,
  type SupportStatus,
} from "@/services/studentTypes";

// ─── Extended student entry ─────────────────────────────────────────────────

export interface StudentManagementEntry extends StudentSummary {
  /** Highest date across assessments and journals, for activity signals. */
  lastActivity?: Date | null;
  /** True when the student has an active (non-archived) workflow. */
  hasActiveWorkflow?: boolean;
}

export interface SupportWorkflow {
  id: string;
  studentId: string;
  createdBy: string;
  createdByName?: string;
  assignedTo: string;
  assignedToName?: string;
  status: "open" | "completed" | "closed";
  actionType: SupportActionType;
  reason: string;
  note?: string;
  followUpDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
  closedAt?: Date | null;
  closedBy?: string | null;
}

export interface StudentAuditEntry {
  id: string;
  actorUid?: string;
  actorName?: string;
  action: string;
  targetStudentId?: string;
  targetStudentName?: string;
  previousValue?: string;
  newValue?: string;
  reason?: string;
  createdAt: Date;
}

// ─── Timestamp helpers ──────────────────────────────────────────────────────

function toDate(value: unknown): Date {
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  if (value && typeof value === "object" && "toDate" in value) {
    return (value as { toDate: () => Date }).toDate();
  }
  return new Date();
}

function toDateOrNull(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  if (value && typeof value === "object" && "toDate" in value) {
    return (value as { toDate: () => Date }).toDate();
  }
  return null;
}

// ─── Mappers ────────────────────────────────────────────────────────────────

function mapWorkflow(id: string, data: Record<string, unknown>): SupportWorkflow {
  return {
    id,
    studentId: String(data.studentId ?? ""),
    createdBy: String(data.createdBy ?? ""),
    createdByName: data.createdByName as string | undefined,
    assignedTo: String(data.assignedTo ?? ""),
    assignedToName: data.assignedToName as string | undefined,
    status: (data.status as SupportWorkflow["status"]) ?? "open",
    actionType: (data.actionType as SupportActionType) ?? "monitor_only",
    reason: String(data.reason ?? ""),
    note: data.note as string | undefined,
    followUpDate: toDateOrNull(data.followUpDate),
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt ?? data.createdAt),
    closedAt: toDateOrNull(data.closedAt),
    closedBy: (data.closedBy as string | null) ?? null,
  };
}

function mapAuditEntry(id: string, data: Record<string, unknown>): StudentAuditEntry {
  return {
    id,
    actorUid: data.actorUid as string | undefined,
    actorName: data.actorName as string | undefined,
    action: String(data.action ?? ""),
    targetStudentId: data.targetStudentId as string | undefined,
    targetStudentName: data.targetStudentName as string | undefined,
    previousValue: data.previousValue as string | undefined,
    newValue: data.newValue as string | undefined,
    reason: data.reason as string | undefined,
    createdAt: toDate(data.createdAt ?? data.timestamp),
  };
}

// ─── Audit writer (append-only, admin-only per Firestore rules) ─────────────

export interface AuditActor {
  uid?: string;
  name?: string;
}

interface WriteAuditInput {
  actor?: AuditActor;
  action: string;
  targetStudentId?: string;
  targetStudentName?: string;
  previousValue?: string;
  newValue?: string;
  reason?: string;
}

async function writeAudit(input: WriteAuditInput): Promise<void> {
  await addDoc(collection(db, "auditLogs"), {
    actorUid: input.actor?.uid ?? null,
    actorName: input.actor?.name ?? null,
    action: input.action,
    targetStudentId: input.targetStudentId ?? null,
    targetStudentName: input.targetStudentName ?? null,
    previousValue: input.previousValue ?? null,
    newValue: input.newValue ?? null,
    reason: input.reason ?? null,
    createdAt: serverTimestamp(),
  });
}

// ─── Real-time data ─────────────────────────────────────────────────────────

export interface StudentManagementData {
  entries: StudentManagementEntry[];
  workflows: SupportWorkflow[];
}

/**
 * Reuses the canonical `listenForAdminDashboardData` aggregation and combines
 * it with a real-time listener on the support workflows collection. No second
 * student aggregation system is created.
 */
export function listenForStudentManagementData(
  onData: (data: StudentManagementData) => void,
  onError: (error: Error) => void,
): () => void {
  let latestSummaries: StudentSummary[] = [];
  let latestWorkflows: SupportWorkflow[] = [];

  const emit = () => {
    const workflowByStudent = new Map<string, SupportWorkflow[]>();
    latestWorkflows.forEach((w) => {
      const arr = workflowByStudent.get(w.studentId) ?? [];
      arr.push(w);
      workflowByStudent.set(w.studentId, arr);
    });

    const entries: StudentManagementEntry[] = latestSummaries.map((s) => {
      const dates: Date[] = [];
      if (s.latestAssessmentDate) dates.push(s.latestAssessmentDate);
      const journalDate = null; // journalDates are not aggregated; journalCount is enough
      void journalDate;
      const workflows = workflowByStudent.get(s.uid) ?? [];
      return {
        ...s,
        lastActivity:
          dates.length > 0
            ? new Date(Math.max(...dates.map((d) => d.getTime())))
            : undefined,
        hasActiveWorkflow: workflows.some((w) => w.status === "open"),
      };
    });

    onData({ entries, workflows: latestWorkflows });
  };

  const unsubSummaries = listenForAdminDashboardData(
    (data) => {
      latestSummaries = data.studentSummaries;
      emit();
    },
    onError,
  );

  const unsubWorkflows = onSnapshot(
    query(collection(db, "supportWorkflows"), orderBy("createdAt", "desc")),
    (snap) => {
      latestWorkflows = snap.docs.map((d) =>
        mapWorkflow(d.id, d.data() as Record<string, unknown>),
      );
      emit();
    },
    onError,
  );

  return () => {
    unsubSummaries();
    unsubWorkflows();
  };
}

// ─── Lifecycle & academic actions ───────────────────────────────────────────

export interface ActionContext {
  actor?: AuditActor;
  /** Optional administrative reason recorded in the audit trail. */
  reason?: string;
}

/**
 * Change a student's lifecycle status. Historical records are preserved — the
 * `users/{uid}` document and its subcollections are never deleted.
 */
export async function updateStudentStatus(
  uid: string,
  status: LifecycleStatus,
  context: ActionContext = {},
): Promise<void> {
  await updateDoc(doc(db, "users", uid), {
    status,
    updatedAt: serverTimestamp(),
  });
  await writeAudit({
    actor: context.actor,
    action: "student_status_changed",
    targetStudentId: uid,
    previousValue: undefined,
    newValue: LIFECYCLE_LABELS[status],
    reason: context.reason,
  });
}

export async function updateStudentDepartment(
  uid: string,
  value: string,
  context: ActionContext = {},
): Promise<void> {
  await updateDoc(doc(db, "users", uid), {
    department: value,
    updatedAt: serverTimestamp(),
  });
  await writeAudit({
    actor: context.actor,
    action: "student_department_changed",
    targetStudentId: uid,
    previousValue: undefined,
    newValue: value,
    reason: context.reason,
  });
}

export async function updateStudentYearLevel(
  uid: string,
  value: string,
  context: ActionContext = {},
): Promise<void> {
  await updateDoc(doc(db, "users", uid), {
    yearLevel: value,
    updatedAt: serverTimestamp(),
  });
  await writeAudit({
    actor: context.actor,
    action: "student_year_changed",
    targetStudentId: uid,
    previousValue: undefined,
    newValue: value,
    reason: context.reason,
  });
}

export async function markAsGraduated(
  uid: string,
  context: ActionContext = {},
): Promise<void> {
  await updateStudentStatus(uid, "graduated", context);
}

// ─── Support workflow ───────────────────────────────────────────────────────

export interface CreateWorkflowInput {
  studentId: string;
  studentName: string;
  department?: string;
  actionType: SupportActionType;
  reason: string;
  note?: string;
  assignedTo: string;
  assignedToName?: string;
  followUpDate: Date | null;
  createdBy: string;
  createdByName?: string;
}

/**
 * Creates a support workflow and mirrors the current support status onto the
 * student document so the directory and other admin views stay in sync.
 */
export async function createSupportWorkflow(
  input: CreateWorkflowInput,
): Promise<string> {
  const ref = await addDoc(collection(db, "supportWorkflows"), {
    studentId: input.studentId,
    studentName: input.studentName,
    department: input.department ?? "Unspecified",
    createdBy: input.createdBy,
    createdByName: input.createdByName ?? null,
    assignedTo: input.assignedTo,
    assignedToName: input.assignedToName ?? null,
    actionType: input.actionType,
    reason: input.reason,
    note: input.note ?? null,
    followUpDate: input.followUpDate ? Timestamp.fromDate(input.followUpDate) : null,
    status: "open",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await updateDoc(doc(db, "users", input.studentId), {
    supportStatus: SUPPORT_STATUS_FROM_ACTION[input.actionType] ?? DEFAULT_SUPPORT_STATUS,
    supportAssignedTo: input.assignedTo || null,
    supportAssignedName: input.assignedToName || null,
    followUpDate: input.followUpDate ? Timestamp.fromDate(input.followUpDate) : null,
    supportUpdatedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await writeAudit({
    actor: { uid: input.createdBy, name: input.createdByName },
    action: "support_workflow_created",
    targetStudentId: input.studentId,
    targetStudentName: input.studentName,
    newValue: `${SUPPORT_LABELS[SUPPORT_STATUS_FROM_ACTION[input.actionType]]} — ${input.reason}`,
  });

  return ref.id;
}

const SUPPORT_STATUS_FROM_ACTION: Record<SupportActionType, SupportStatus> = {
  send_wellness_checkin: "contact_initiated",
  guidance_consultation: "support_offered",
  schedule_follow_up: "follow_up_scheduled",
  provide_resources: "support_offered",
  monitor_only: "monitor",
  no_action: "no_action",
};

/** Update the support status / follow-up on a student document and audit it. */
export async function updateStudentSupportStatus(
  uid: string,
  studentName: string,
  status: SupportStatus,
  followUpDate: Date | null,
  context: ActionContext = {},
): Promise<void> {
  await updateDoc(doc(db, "users", uid), {
    supportStatus: status,
    followUpDate: followUpDate ? Timestamp.fromDate(followUpDate) : null,
    supportUpdatedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await writeAudit({
    actor: context.actor,
    action: "support_status_changed",
    targetStudentId: uid,
    targetStudentName: studentName,
    previousValue: undefined,
    newValue: SUPPORT_LABELS[status],
  });
}

/** Complete an open workflow (e.g. follow-up finished). */
export async function completeSupportWorkflow(
  workflowId: string,
  context: ActionContext = {},
): Promise<void> {
  await updateDoc(doc(db, "supportWorkflows", workflowId), {
    status: "completed",
    closedAt: serverTimestamp(),
    closedBy: context.actor?.uid ?? null,
    updatedAt: serverTimestamp(),
  });
  await writeAudit({
    actor: context.actor,
    action: "support_workflow_completed",
    newValue: workflowId,
  });
}

// ─── Permanent deletion (Super Admin only, explicit confirmation) ──────────

/**
 * Permanently deletes a student record. Restricted to Super Admins by callers
 * and gated behind explicit confirmation + audit. Wellness history is wiped
 * only here — never by lifecycle/status actions.
 */
export async function permanentlyDeleteStudent(
  uid: string,
  studentName: string,
  context: ActionContext = {},
): Promise<void> {
  await writeAudit({
    actor: context.actor,
    action: "student_permanently_deleted",
    targetStudentId: uid,
    targetStudentName: studentName,
  });

  await deleteDoc(doc(db, "users", uid));
  for (const subcol of ["selfAssessments", "journalEntries", "initialProfileSurveys"]) {
    const snap = await getDocs(collection(db, "users", uid, subcol));
    for (const d of snap.docs) {
      await deleteDoc(d.ref);
    }
  }
}

// ─── Filtering ──────────────────────────────────────────────────────────────

export interface StudentFilters {
  search: string;
  department: string;
  yearLevel: string;
  status: string;
  riskLevel: string;
  supportStatus: string;
  isLSNOnly: boolean;
  activity: string;
}

export function applyStudentFilters(
  entries: StudentManagementEntry[],
  filters: StudentFilters,
): StudentManagementEntry[] {
  const q = filters.search.trim().toLowerCase();
  const activityCutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;

  return entries.filter((s) => {
    if (q) {
      const hay = `${s.name} ${s.schoolId} ${s.email ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (filters.department !== "All" && s.department !== filters.department) return false;
    if (filters.yearLevel !== "All" && s.yearLevel !== filters.yearLevel) return false;
    if (filters.status !== "All" && (s.status ?? DEFAULT_LIFECYCLE_STATUS) !== filters.status) return false;
    if (filters.riskLevel !== "All" && s.latestRiskLevel !== filters.riskLevel) return false;
    if (
      filters.supportStatus !== "All" &&
      (s.supportStatus ?? DEFAULT_SUPPORT_STATUS) !== filters.supportStatus
    ) {
      return false;
    }
    if (filters.isLSNOnly && !s.isLSN) return false;

    if (filters.activity === "recent") {
      const last = s.lastActivity?.getTime() ?? 0;
      if (last < activityCutoff && s.assessmentsCount === 0 && s.journalCount === 0) return false;
    } else if (filters.activity === "no_recent") {
      const last = s.lastActivity?.getTime() ?? 0;
      if (last >= activityCutoff || s.assessmentsCount > 0 || s.journalCount > 0) return false;
    } else if (filters.activity === "no_assessment") {
      if (s.assessmentsCount > 0) return false;
    }

    return true;
  });
}

// ─── Attention Required ─────────────────────────────────────────────────────

export type AttentionCategory =
  | "outreach_recommended"
  | "follow_up_due_today"
  | "follow_up_overdue"
  | "recently_elevated"
  | "no_recent_assessment"
  | "low_engagement";

export interface AttentionItem {
  student: StudentManagementEntry;
  category: AttentionCategory;
  label: string;
  reason: string;
}

const ATTENTION_LABELS: Record<AttentionCategory, string> = {
  outreach_recommended: "Outreach Recommended",
  follow_up_due_today: "Follow-up Due Today",
  follow_up_overdue: "Follow-up Overdue",
  recently_elevated: "Recently Elevated",
  no_recent_assessment: "No Recent Assessment",
  low_engagement: "Low Engagement",
};

const DAY = 24 * 60 * 60 * 1000;

function startOfToday(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function buildAttentionItems(
  entries: StudentManagementEntry[],
): AttentionItem[] {
  const items: AttentionItem[] = [];
  const today = startOfToday();

  for (const s of entries) {
    const status = s.status ?? DEFAULT_LIFECYCLE_STATUS;
    if (status === "archived" || status === "inactive") continue;

    const support = s.supportStatus ?? DEFAULT_SUPPORT_STATUS;
    const activeSupport = ACTIVE_SUPPORT_STATUSES.includes(support);
    const followUp = s.followUpDate ? s.followUpDate.getTime() : null;

    if (support === "outreach_recommended") {
      items.push({
        student: s,
        category: "outreach_recommended",
        label: ATTENTION_LABELS.outreach_recommended,
        reason: "Outreach recommended based on reviewed indicators.",
      });
    }

    if (activeSupport && followUp !== null) {
      const todayEnd = today + DAY - 1;
      if (followUp >= today && followUp <= todayEnd) {
        items.push({
          student: s,
          category: "follow_up_due_today",
          label: ATTENTION_LABELS.follow_up_due_today,
          reason: `Scheduled follow-up is due today (${s.followUpDate?.toLocaleDateString()}).`,
        });
      } else if (followUp < today) {
        items.push({
          student: s,
          category: "follow_up_overdue",
          label: ATTENTION_LABELS.follow_up_overdue,
          reason: `Scheduled follow-up was due ${s.followUpDate?.toLocaleDateString()} and is overdue.`,
        });
      }
    }

    if (
      s.latestRiskLevel === "high" &&
      s.latestAssessmentDate &&
      s.latestAssessmentDate.getTime() > Date.now() - 30 * DAY
    ) {
      items.push({
        student: s,
        category: "recently_elevated",
        label: ATTENTION_LABELS.recently_elevated,
        reason: `Elevated concern indicator recorded ${s.latestAssessmentDate.toLocaleDateString()}.`,
      });
    }

    const lastActivity = s.lastActivity?.getTime();
    if (
      s.assessmentsCount === 0 ||
      (s.latestAssessmentDate &&
        s.latestAssessmentDate.getTime() < Date.now() - 90 * DAY)
    ) {
      items.push({
        student: s,
        category: "no_recent_assessment",
        label: ATTENTION_LABELS.no_recent_assessment,
        reason:
          s.assessmentsCount === 0
            ? "No assessment recorded yet."
            : `No assessment in the last 90 days (last: ${s.latestAssessmentDate?.toLocaleDateString()}).`,
      });
    }

    if (
      s.assessmentsCount === 0 &&
      s.journalCount === 0 &&
      (!lastActivity || lastActivity < Date.now() - 60 * DAY)
    ) {
      items.push({
        student: s,
        category: "low_engagement",
        label: ATTENTION_LABELS.low_engagement,
        reason: "No assessments or journals — low engagement.",
      });
    }
  }

  return items;
}

export function countAttentionStudents(entries: StudentManagementEntry[]): number {
  return new Set(buildAttentionItems(entries).map((i) => i.student.uid)).size;
}

// ─── Audit reads ────────────────────────────────────────────────────────────

export async function fetchStudentAuditLogs(maxCount = 100): Promise<StudentAuditEntry[]> {
  const snap = await getDocs(
    query(collection(db, "auditLogs"), orderBy("createdAt", "desc")),
  );
  const logs = snap.docs
    .slice(0, maxCount)
    .map((d) => mapAuditEntry(d.id, d.data() as Record<string, unknown>));
  return logs.filter((l) => l.targetStudentId || l.action.startsWith("student_"));
}

export async function fetchSupportWorkflows(
  studentId?: string,
): Promise<SupportWorkflow[]> {
  const q = query(collection(db, "supportWorkflows"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  const workflows = snap.docs.map((d) =>
    mapWorkflow(d.id, d.data() as Record<string, unknown>),
  );
  return studentId ? workflows.filter((w) => w.studentId === studentId) : workflows;
}

// ─── Admin directory helper ─────────────────────────────────────────────────

export async function fetchAdminDirectory(): Promise<{ uid: string; name: string }[]> {
  const snap = await getDocs(collection(db, "admins"));
  return snap.docs.map((d) => ({
    uid: d.id,
    name: String(d.data().displayName ?? d.data().fullName ?? "Administrator"),
  }));
}
