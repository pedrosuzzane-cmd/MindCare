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

import { API_URL } from "@/backend/config";
import { auth, db } from "@/constants/firebase";
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
  writeBatch,
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

export interface RecordSupportActionInput {
  studentId: string;
  action: SupportActionType;
  assignedTo: string;
  assignedToName?: string;
  followUpDate: Date | null;
  reason: string;
  /** Stable per-student UUID so a network retry is idempotent on the backend. */
  requestId: string;
}

/**
 * Records a support action through the backend, which is the authoritative
 * writer: the workflow record, student support status, audit entry, and the
 * student inbox notification are written atomically in one transaction. The
 * stable requestId prevents duplicates on retry.
 */
export async function recordSupportAction(
  input: RecordSupportActionInput,
): Promise<string> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) {
    throw new Error("Not authenticated.");
  }
  const res = await fetch(`${API_URL}/api/record-support-action`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      studentId: input.studentId,
      action: input.action,
      assignedTo: input.assignedTo || undefined,
      assignedToName: input.assignedToName ?? undefined,
      followUpDate: input.followUpDate
        ? input.followUpDate.toISOString()
        : null,
      reason: input.reason,
      requestId: input.requestId,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      typeof data?.error === "string" && data.error
        ? data.error
        : "Failed to record the support action.",
    );
  }
  return String(data.workflowId ?? input.requestId);
}

const SUPPORT_STATUS_FROM_ACTION: Record<SupportActionType, SupportStatus> = {
  send_wellness_checkin: "contact_initiated",
  guidance_consultation: "support_offered",
  schedule_follow_up: "follow_up_scheduled",
  provide_resources: "support_offered",
  monitor_only: "monitor",
  contact_recommended: "outreach_recommended",
  resolved: "resolved",
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

/** Complete an open workflow (e.g. follow-up finished) and resolve the student. */
export async function completeSupportWorkflow(
  workflowId: string,
  context: ActionContext = {},
  student?: { uid: string; name: string },
): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(db, "supportWorkflows", workflowId), {
    status: "completed",
    closedAt: serverTimestamp(),
    closedBy: context.actor?.uid ?? null,
    updatedAt: serverTimestamp(),
  });
  if (student) {
    batch.update(doc(db, "users", student.uid), {
      supportStatus: "resolved",
      followUpDate: null,
      supportAssignedTo: null,
      supportAssignedName: null,
      supportUpdatedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
  await batch.commit();
  await writeAudit({
    actor: context.actor,
    action: "support_workflow_completed",
    targetStudentId: student?.uid,
    targetStudentName: student?.name,
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
  assessed: "All" | "assessed" | "not_assessed";
  isLSNOnly: boolean;
  activity: string;
  assessmentFrom: Date | null;
  assessmentTo: Date | null;
}

export function applyStudentFilters(
  entries: StudentManagementEntry[],
  filters: StudentFilters,
): StudentManagementEntry[] {
  const q = filters.search.trim().toLowerCase();
  const activityCutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const from = filters.assessmentFrom?.getTime() ?? null;
  const to = filters.assessmentTo
    ? new Date(filters.assessmentTo).setHours(23, 59, 59, 999)
    : null;

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
    if (filters.assessed === "assessed" && s.assessmentsCount === 0) return false;
    if (filters.assessed === "not_assessed" && s.assessmentsCount > 0) return false;
    if (filters.isLSNOnly && !s.isLSN) return false;

    const assessmentTs = s.latestAssessmentDate?.getTime() ?? 0;
    if (from !== null && (assessmentTs === 0 || assessmentTs < from)) return false;
    if (to !== null && (assessmentTs === 0 || assessmentTs > to)) return false;

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
  return buildTriageQueue(entries).filter(
    (i) => i.priority === "high" || i.priority === "medium"
  ).length;
}

// ─── Priority-based triage queue ────────────────────────────────────────────

/**
 * A deterministic, support-indicator-based triage queue. Priorities describe
 * administrative attention levels only — they are NOT clinical diagnoses.
 * Each student appears exactly once, ordered by a transparent priority score.
 */
export type TriagePriority = "high" | "medium" | "monitor";

export interface TriageItem {
  student: StudentManagementEntry;
  priority: TriagePriority;
  priorityLabel: string;
  /** Assessment-derived statement about the latest recorded assessment. */
  riskStatement: string;
  /** Human-readable support-indicator reasons (no diagnoses). */
  reasons: string[];
  score: number;
  daysSinceAssessment: number | null;
}

export const TRIAGE_PRIORITY_LABELS: Record<TriagePriority, string> = {
  high: "High Priority",
  medium: "Medium Priority",
  monitor: "Monitor",
};

export function buildTriageQueue(entries: StudentManagementEntry[]): TriageItem[] {
  const items: TriageItem[] = [];
  const now = Date.now();
  const todayStart = startOfToday();
  const todayEnd = todayStart + DAY - 1;

  for (const s of entries) {
    const status = s.status ?? DEFAULT_LIFECYCLE_STATUS;
    if (status === "archived" || status === "inactive" || status === "graduated" || status === "on_leave") continue;

    const support = s.supportStatus ?? DEFAULT_SUPPORT_STATUS;
    const activeSupport = ACTIVE_SUPPORT_STATUSES.includes(support);
    const followUp = s.followUpDate ? s.followUpDate.getTime() : null;
    const risk = s.latestRiskLevel;

    const reasons: string[] = [];
    let score = 0;

    // 1. High/elevated assessment concern.
    if (risk === "high") {
      score += 40;
      reasons.push("High assessment concern");
    } else if (risk === "normal") {
      score += 12;
    }

    // 2. Follow-up timing.
    if (followUp !== null && activeSupport && followUp < now) {
      score += 35;
      reasons.push(`Follow-up overdue (${s.followUpDate?.toLocaleDateString()})`);
    } else if (followUp !== null && followUp >= todayStart && followUp <= todayEnd) {
      score += 20;
      reasons.push("Follow-up due today");
    }

    // 3. Outreach already recommended by a prior review.
    if (support === "outreach_recommended") {
      score += 30;
      reasons.push("Outreach recommended");
    }

    // 4. No previous support action despite concerning indicators.
    if (support === DEFAULT_SUPPORT_STATUS && (risk === "high" || risk === "normal")) {
      score += 15;
      if (!reasons.includes("No support action recorded")) {
        reasons.push("No support action recorded");
      }
    }

    // 5. Long time since last assessment.
    const daysSinceAssessment = s.latestAssessmentDate
      ? Math.floor((now - s.latestAssessmentDate.getTime()) / DAY)
      : null;
    if (s.assessmentsCount === 0) {
      score += 10;
      reasons.push("No assessment recorded yet");
    } else if (daysSinceAssessment !== null && daysSinceAssessment > 90) {
      score += 10;
      reasons.push(`No assessment in ${daysSinceAssessment} days`);
    }

    // 6. Low engagement.
    if (
      s.assessmentsCount === 0 &&
      s.journalCount === 0 &&
      (!s.lastActivity || s.lastActivity.getTime() < now - 60 * DAY)
    ) {
      score += 5;
      reasons.push("Low engagement");
    }

    if (reasons.length === 0) {
      reasons.push("No urgent support indicators");
    }

    const priority: TriagePriority = score >= 50 ? "high" : score >= 20 ? "medium" : "monitor";

    const riskStatement =
      risk === "high"
        ? "High assessment concern"
        : risk === "normal"
          ? "Moderate assessment concern"
          : s.latestAssessmentDate
            ? "No concern indicators"
            : "No assessment recorded yet";

    items.push({
      student: s,
      priority,
      priorityLabel: TRIAGE_PRIORITY_LABELS[priority],
      riskStatement,
      reasons,
      score,
      daysSinceAssessment,
    });
  }

  const priorityRank: Record<TriagePriority, number> = { high: 0, medium: 1, monitor: 2 };
  const riskRank = (r?: StudentSummary["latestRiskLevel"]) =>
    r === "high" ? 0 : r === "normal" ? 1 : 2;

  items.sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;
    const pr = priorityRank[a.priority] - priorityRank[b.priority];
    if (pr !== 0) return pr;
    const rr = riskRank(a.student.latestRiskLevel) - riskRank(b.student.latestRiskLevel);
    if (rr !== 0) return rr;
    return a.student.name.localeCompare(b.student.name);
  });

  return items;
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
