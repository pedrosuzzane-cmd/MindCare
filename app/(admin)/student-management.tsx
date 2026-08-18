import { API_URL, isSuperAdminEmail } from "@/backend/config";
import { auth, db } from "@/constants/firebase";
import { useAuth } from "@/hooks/AuthContext";
import {
  applyStudentFilters,
  buildTriageQueue,
  completeSupportWorkflow,
  fetchAdminDirectory,
  fetchStudentAuditLogs,
  listenForStudentManagementData,
  permanentlyDeleteStudent,
  recordSupportAction,
  updateStudentDepartment,
  updateStudentStatus,
  updateStudentYearLevel,
  type ActionContext,
  type StudentAuditEntry,
  type StudentManagementEntry,
  type SupportWorkflow,
  type TriagePriority,
} from "@/services/studentManagementService";
import {
  ACTIVE_SUPPORT_STATUSES,
  LIFECYCLE_COLORS,
  LIFECYCLE_LABELS,
  LIFECYCLE_STATUSES,
  SUPPORT_ACTION_LABELS,
  SUPPORT_COLORS,
  SUPPORT_LABELS,
  SUPPORT_STATUSES,
  type LifecycleStatus,
  type SupportActionType,
  type SupportStatus,
} from "@/services/studentTypes";
import { FollowUpDatePickerModal } from "@/components/admin/FollowUpDatePickerModal";
import {
  FollowUpTimePickerModal,
  type TimeValue,
} from "@/components/admin/FollowUpTimePickerModal";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { LinearGradient } from "expo-linear-gradient";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { v4 as uuidv4 } from "uuid";
import { useMindCareTheme } from "@/contexts/ThemeContext";
import type { MindCareTheme } from "@/constants/theme";

type RiskLevel = "low" | "normal" | "high";

const RISK_LABELS: Record<RiskLevel, string> = {
  low: "Low",
  normal: "Moderate",
  high: "High",
};

const RISK_COLORS = (theme: MindCareTheme): Record<RiskLevel, string> => ({
  low: theme.status.success,
  normal: theme.status.warning,
  high: theme.status.error,
});

const CONCERN_LABELS: Record<RiskLevel, string> = {
  low: "Low",
  normal: "Moderate",
  high: "Elevated",
};

// Support actions grouped by purpose. Pure UI organization — the underlying
// actions and their status mapping are unchanged.
const ACTION_GROUPS: { title: string; actions: SupportActionType[] }[] = [
  {
    title: "Immediate / Communication",
    actions: ["contact_recommended", "send_wellness_checkin"],
  },
  { title: "Support", actions: ["guidance_consultation", "provide_resources"] },
  {
    title: "Follow-up / Monitoring",
    actions: ["schedule_follow_up", "monitor_only"],
  },
  { title: "Closure", actions: ["resolved", "no_action"] },
];

const SUPPORT_REASON_OPTIONS = [
  "Elevated assessment",
  "Repeated concern",
  "Student requested support",
  "Follow-up due",
  "Engagement concern",
  "Other",
];

const CONTACT_METHOD_OPTIONS = ["Email", "Phone", "In-person", "Messaging app"];

const RESOURCE_OPTIONS = [
  "Self-help articles",
  "Relaxation exercises",
  "Peer support groups",
  "Counselor referral",
  "Crisis resources",
];

const MONITOR_PERIOD_OPTIONS = [7, 30, 60];

const YEAR_OPTIONS = [
  "1st Year",
  "2nd Year",
  "3rd Year",
  "4th Year",
  "5th Year",
  "N/A",
];

const ACTIVITY_OPTIONS: { key: string; label: string }[] = [
  { key: "All", label: "All activity" },
  { key: "recent", label: "Recent (30d)" },
  { key: "no_recent", label: "No recent activity" },
  { key: "no_assessment", label: "No assessment" },
];

const PAGE_SIZE = 25;

const AUDIT_ACTION_LABELS: Record<string, string> = {
  student_status_changed: "Status changed",
  student_department_changed: "Department changed",
  student_year_changed: "Year level changed",
  support_workflow_created: "Support workflow created",
  support_status_changed: "Support status changed",
  support_workflow_completed: "Workflow completed",
  student_permanently_deleted: "Student permanently deleted",
};

function formatDate(d?: Date | null): string {
  if (!d) return "—";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(d?: Date | null): string {
  if (!d) return "—";
  return (
    d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    }) +
    " " +
    d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
  );
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

function formatTime(t: TimeValue): string {
  return `${pad2(t.hour)}:${pad2(t.minute)} ${t.period}`;
}

/** "Aug 21, 2026 · 10:30 AM" — falls back to date-only when no time is set. */
function formatFollowUp(date: Date, time: TimeValue | null): string {
  const d = date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return time ? `${d} · ${formatTime(time)}` : d;
}

/**
 * Combines the selected calendar date and time into one local Date. Built from
 * local y/m/d components (never a "YYYY-MM-DD" string, which JS may parse as
 * UTC) so the exact date is preserved, then the local time is applied.
 */
function combineDateAndTime(date: Date, time: TimeValue): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const h24 =
    time.period === "PM" && time.hour !== 12
      ? time.hour + 12
      : time.period === "AM" && time.hour === 12
        ? 0
        : time.hour;
  d.setHours(h24, time.minute, 0, 0);
  return d;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  const out = parts.map((p) => p[0]?.toUpperCase() || "").join("");
  return out || "S";
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d;
}

function addMonths(base: Date, months: number): Date {
  const d = new Date(base);
  d.setHours(12, 0, 0, 0);
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() < day) {
    d.setDate(0);
  }
  return d;
}

/** Whole days between `date` and now (0 if the date is in the future). */
function daysSince(date?: Date | null): number | null {
  if (!date) return null;
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 86400000));
}

/** True when a scheduled follow-up date has already passed. */
function isFollowUpOverdue(date?: Date | null): boolean {
  if (!date) return false;
  return date.getTime() < Date.now();
}

/**
 * Combines the structured reason tags, action-specific context, and the private
 * internal note into the single workflow `reason` string. The student inbox
 * notification is built from the action alone (see backend), so this text is
 * only ever visible to admins via the workflow record and audit log.
 */
function buildReasonSummary(opts: {
  reasons: string[];
  contactMethod: string | null;
  resources: string[];
  monitorDays: number | null;
  notes: string;
}): string {
  const parts: string[] = [];
  if (opts.reasons.length) parts.push(`Reasons: ${opts.reasons.join(", ")}`);
  if (opts.contactMethod) parts.push(`Contact method: ${opts.contactMethod}`);
  if (opts.resources.length)
    parts.push(`Resources provided: ${opts.resources.join(", ")}`);
  if (opts.monitorDays)
    parts.push(`Monitoring period: ${opts.monitorDays} days`);
  const note = opts.notes.trim();
  if (note) parts.push(`Notes: ${note}`);
  return parts.join(" | ") || "Support workflow";
}

/** Whether the minimum required fields for the selected action are satisfied. */
function canSaveWorkflow(a: {
  action: SupportActionType | null;
  followUp: Date | null;
  followUpTime: TimeValue | null;
  assignee: string;
  contactMethod: string | null;
  resources: string[];
  monitorDays: number | null;
}): boolean {
  if (!a.action) return false;
  switch (a.action) {
    case "send_wellness_checkin":
      return !!a.contactMethod;
    case "guidance_consultation":
      return !!a.assignee && (a.followUp ? !!a.followUpTime : true);
    case "schedule_follow_up":
      return !!a.followUp && !!a.followUpTime && !!a.assignee;
    case "provide_resources":
      return a.resources.length > 0;
    case "monitor_only":
      return !!a.monitorDays;
    default:
      return true;
  }
}

// ─── Small UI pieces ────────────────────────────────────────────────────────

function Badge({
  label,
  color,
  bg,
  icon,
}: {
  label: string;
  color: string;
  bg?: string;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  const { theme } = useMindCareTheme();
  const styles = createStyles(theme);
  return (
    <View style={[styles.badge, { backgroundColor: bg ?? `${color}18` }]}>
      {icon ? <Ionicons name={icon} size={11} color={color} /> : null}
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

function KpiCard({
  label,
  value,
  icon,
  color,
  bg,
  onPress,
}: {
  label: string;
  value: number;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bg: string;
  onPress?: () => void;
}) {
  const { theme } = useMindCareTheme();
  const styles = createStyles(theme);
  return (
    <Pressable
      style={styles.kpiCard}
      onPress={onPress}
      android_ripple={{ color: "rgba(0,0,0,0.04)" }}
    >
      <View style={[styles.kpiIcon, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={16} color={color} />
      </View>
      <Text style={styles.kpiValue}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </Pressable>
  );
}

function PriorityBadge({ priority }: { priority: TriagePriority }) {
  const { theme } = useMindCareTheme();
  const config: Record<
    TriagePriority,
    { label: string; color: string; bg: string }
  > = {
    high: { label: "HIGH", color: theme.status.error, bg: "#FFE4E6" },
    medium: { label: "MEDIUM", color: theme.status.warning, bg: "#FEF3C7" },
    monitor: { label: "MONITOR", color: theme.accent.teal, bg: "#CCFBF1" },
  };
  const c = config[priority];
  return <Badge label={c.label} color={c.color} bg={c.bg} />;
}

function FilterGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const { theme } = useMindCareTheme();
  const styles = createStyles(theme);
  return (
    <View style={styles.filterGroup}>
      <Text style={styles.filterGroupTitle}>{title}</Text>
      <View style={styles.filterGroupChips}>{children}</View>
    </View>
  );
}

function FilterOptionChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { theme } = useMindCareTheme();
  const styles = createStyles(theme);
  return (
    <Pressable
      style={[styles.filterOptChip, active && styles.filterOptChipActive]}
      onPress={onPress}
    >
      <Text
        style={[
          styles.filterOptChipText,
          active && styles.filterOptChipTextActive,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// ─── Main screen ────────────────────────────────────────────────────────────

export default function StudentManagementScreen() {
  const { user, role } = useAuth();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const isWide = screenWidth >= 900;
  const { theme } = useMindCareTheme();
  const styles = createStyles(theme);

  // Deep-link default filters: apply only explicitly provided params; otherwise
  // start with no restrictive filters so the directory never shows a misleading
  // "0 students" state. Initialized once so filters are never stale after nav.
  const params = useLocalSearchParams<{
    department?: string;
    yearLevel?: string;
    status?: string;
    riskLevel?: string;
    supportStatus?: string;
    isLSN?: string;
  }>();

  const [entries, setEntries] = useState<StudentManagementEntry[]>([]);
  const [workflows, setWorkflows] = useState<SupportWorkflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [admins, setAdmins] = useState<{ uid: string; name: string }[]>([]);

  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState(params.department ?? "All");
  const [yearFilter, setYearFilter] = useState(params.yearLevel ?? "All");
  const [statusFilter, setStatusFilter] = useState(params.status ?? "All");
  const [riskFilter, setRiskFilter] = useState(params.riskLevel ?? "All");
  const [supportFilter, setSupportFilter] = useState(
    params.supportStatus ?? "All",
  );
  const [assessedFilter, setAssessedFilter] = useState<
    "All" | "assessed" | "not_assessed"
  >("All");
  const [activityFilter, setActivityFilter] = useState("All");
  const [lsnOnly, setLsnOnly] = useState(params.isLSN === "true");
  const [assessmentFrom, setAssessmentFrom] = useState<Date | null>(null);
  const [assessmentTo, setAssessmentTo] = useState<Date | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [rangePicker, setRangePicker] = useState<"from" | "to" | null>(null);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const scrollRef = useRef<ScrollView>(null);

  // Always start at the top so navigation never lands mid-list.
  useEffect(() => {
    const t = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    }, 60);
    return () => clearTimeout(t);
  }, []);

  // Edit (status / department / year) modal
  const [editModal, setEditModal] = useState<{
    kind: "status" | "department" | "year";
    targets: string[];
  } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editReason, setEditReason] = useState("");
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Confirm destructive (archive / restore / graduate / restrict)
  const [confirm, setConfirm] = useState<{
    kind: "archive" | "restore" | "graduate" | "restrict";
    targets: string[];
  } | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  // Row action menu
  const [menuUid, setMenuUid] = useState<string | null>(null);

  // Support action modal (single-step workflow)
  const [wfOpen, setWfOpen] = useState(false);
  const [wfBulk, setWfBulk] = useState(false);
  const [wfTarget, setWfTarget] = useState<string | null>(null);
  const [wfAction, setWfAction] = useState<SupportActionType | null>(null);
  const [wfReason, setWfReason] = useState("");
  const [wfReasons, setWfReasons] = useState<string[]>([]);
  const [wfContactMethod, setWfContactMethod] = useState<string | null>(null);
  const [wfResources, setWfResources] = useState<string[]>([]);
  const [wfMonitorDays, setWfMonitorDays] = useState<number | null>(null);
  const [wfAssignee, setWfAssignee] = useState("");
  const [wfFollowUp, setWfFollowUp] = useState<Date | null>(null);
  const [wfFollowUpTime, setWfFollowUpTime] = useState<TimeValue | null>(null);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [wfSaving, setWfSaving] = useState(false);
  const [wfError, setWfError] = useState<string | null>(null);
  const [showCustomDate, setShowCustomDate] = useState(false);
  const wfRequestIds = useRef<Map<string, string>>(new Map());

  // Profile / audit / delete modals
  const [profileUid, setProfileUid] = useState<string | null>(null);
  const [auditScope, setAuditScope] = useState<"all" | string>("all");
  const [auditVisible, setAuditVisible] = useState(false);
  const [auditLogs, setAuditLogs] = useState<StudentAuditEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [deleteUid, setDeleteUid] = useState<string | null>(null);
  const [deleteText, setDeleteText] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  }, []);

  const actor = useMemo<ActionContext["actor"]>(
    () => ({
      uid: user?.uid,
      name:
        admins.find((a) => a.uid === user?.uid)?.name ??
        user?.displayName ??
        "Administrator",
    }),
    [user, admins],
  );

  // Role detection
  useEffect(() => {
    if (!user) return;
    user
      .getIdTokenResult()
      .then((res) => {
        setIsSuperAdmin(
          res.claims.superAdmin === true || isSuperAdminEmail(user.email),
        );
      })
      .catch(() => {});
  }, [user]);

  // Admin directory for assignee / actor names
  useEffect(() => {
    fetchAdminDirectory()
      .then(setAdmins)
      .catch(() => {});
  }, []);

  // Real-time data. `reload` is used by pull-to-refresh and error retry so the
  // full-screen loading state is only shown when there is nothing to display.
  const reload = useCallback(() => {
    setLoading(true);
    setRefreshing(true);
    setRefreshKey((k) => k + 1);
  }, []);

  useEffect(() => {
    if (!user) return;

    const stop = listenForStudentManagementData(
      (data) => {
        setEntries(data.entries);
        setWorkflows(data.workflows);
        setError(null);
        setLoading(false);
        setRefreshing(false);
      },
      () => {
        setError("Unable to load student data.");
        setLoading(false);
        setRefreshing(false);
      },
    );
    return stop;
  }, [user, refreshKey]);

  // Reset pagination when filters change. This uses the React-recommended
  // render-time adjustment pattern instead of an effect so the current page
  // never refers to a stale filter combination.
  const [filterSignature, setFilterSignature] = useState("");
  const currentFilterSignature = JSON.stringify([
    search,
    deptFilter,
    yearFilter,
    statusFilter,
    riskFilter,
    supportFilter,
    assessedFilter,
    activityFilter,
    lsnOnly,
    assessmentFrom,
    assessmentTo,
  ]);
  if (currentFilterSignature !== filterSignature) {
    setFilterSignature(currentFilterSignature);
    setPage(1);
  }

  const departments = useMemo(() => {
    const set = new Set<string>();
    entries.forEach((e) => {
      if (e.department) set.add(e.department);
    });
    const list = Array.from(set).sort();
    return list.length ? list : ["Unspecified"];
  }, [entries]);

  const filtered = useMemo(
    () =>
      applyStudentFilters(entries, {
        search,
        department: deptFilter,
        yearLevel: yearFilter,
        status: statusFilter,
        riskLevel: riskFilter,
        supportStatus: supportFilter,
        assessed: assessedFilter,
        isLSNOnly: lsnOnly,
        activity: activityFilter,
        assessmentFrom,
        assessmentTo,
      }),
    [
      entries,
      search,
      deptFilter,
      yearFilter,
      statusFilter,
      riskFilter,
      supportFilter,
      assessedFilter,
      lsnOnly,
      activityFilter,
      assessmentFrom,
      assessmentTo,
    ],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageStudents = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page],
  );

  const attentionItems = useMemo(() => {
    return buildTriageQueue(entries).filter(
      (item) => item.priority === "high" || item.priority === "medium",
    );
  }, [entries]);

  const kpis = useMemo(() => {
    const byStatus = new Map<LifecycleStatus, number>();
    entries.forEach((e) => {
      const s = e.status ?? "active";
      byStatus.set(s, (byStatus.get(s) ?? 0) + 1);
    });
    return {
      total: entries.length,
      active: byStatus.get("active") ?? 0,
      onLeave: byStatus.get("on_leave") ?? 0,
      graduated: byStatus.get("graduated") ?? 0,
      archived: byStatus.get("archived") ?? 0,
      attention: attentionItems.length,
    };
  }, [entries, attentionItems]);

  const entryById = useCallback(
    (uid: string) => entries.find((e) => e.uid === uid),
    [entries],
  );

  // ─── Active filter summary ────────────────────────────────────────────────

  const activeFilters = useMemo(() => {
    const chips: { key: string; label: string; clear: () => void }[] = [];
    if (search.trim()) {
      chips.push({
        key: "search",
        label: `Search: ${search.trim()}`,
        clear: () => setSearch(""),
      });
    }
    if (statusFilter !== "All") {
      chips.push({
        key: "status",
        label: LIFECYCLE_LABELS[statusFilter as LifecycleStatus],
        clear: () => setStatusFilter("All"),
      });
    }
    if (deptFilter !== "All") {
      chips.push({
        key: "dept",
        label: deptFilter,
        clear: () => setDeptFilter("All"),
      });
    }
    if (yearFilter !== "All") {
      chips.push({
        key: "year",
        label: yearFilter,
        clear: () => setYearFilter("All"),
      });
    }
    if (riskFilter !== "All") {
      chips.push({
        key: "risk",
        label: `Risk: ${RISK_LABELS[riskFilter as RiskLevel]}`,
        clear: () => setRiskFilter("All"),
      });
    }
    if (supportFilter !== "All") {
      chips.push({
        key: "support",
        label: SUPPORT_LABELS[supportFilter as SupportStatus],
        clear: () => setSupportFilter("All"),
      });
    }
    if (assessedFilter !== "All") {
      chips.push({
        key: "assessed",
        label: assessedFilter === "assessed" ? "Assessed" : "Not assessed",
        clear: () => setAssessedFilter("All"),
      });
    }
    if (activityFilter !== "All") {
      chips.push({
        key: "activity",
        label:
          ACTIVITY_OPTIONS.find((a) => a.key === activityFilter)?.label ??
          activityFilter,
        clear: () => setActivityFilter("All"),
      });
    }
    if (lsnOnly) {
      chips.push({
        key: "lsn",
        label: "LSN only",
        clear: () => setLsnOnly(false),
      });
    }
    if (assessmentFrom) {
      chips.push({
        key: "from",
        label: `Assessed from ${formatDate(assessmentFrom)}`,
        clear: () => setAssessmentFrom(null),
      });
    }
    if (assessmentTo) {
      chips.push({
        key: "to",
        label: `Assessed to ${formatDate(assessmentTo)}`,
        clear: () => setAssessmentTo(null),
      });
    }
    return chips;
  }, [
    search,
    statusFilter,
    deptFilter,
    yearFilter,
    riskFilter,
    supportFilter,
    assessedFilter,
    activityFilter,
    lsnOnly,
    assessmentFrom,
    assessmentTo,
  ]);

  const clearAllFilters = useCallback(() => {
    setSearch("");
    setDeptFilter("All");
    setYearFilter("All");
    setStatusFilter("All");
    setRiskFilter("All");
    setSupportFilter("All");
    setAssessedFilter("All");
    setActivityFilter("All");
    setLsnOnly(false);
    setAssessmentFrom(null);
    setAssessmentTo(null);
  }, []);

  // ─── Selection helpers ────────────────────────────────────────────────────

  const toggleSelect = (uid: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  };

  const selectAllVisible = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      const allVisible = pageStudents.every((s) => next.has(s.uid));
      pageStudents.forEach((s) => {
        if (allVisible) next.delete(s.uid);
        else next.add(s.uid);
      });
      return next;
    });
  };

  const clearSelection = () => setSelected(new Set());

  // ─── Actions ──────────────────────────────────────────────────────────────

  const openEdit = useCallback(
    (kind: "status" | "department" | "year", targets: string[]) => {
      setEditModal({ kind, targets });
      setEditValue("");
      setEditReason("");
      setEditError(null);
    },
    [],
  );

  const applyEdit = async () => {
    if (!editModal) return;
    if (!editValue) return;
    if (editModal.kind === "status" && !editReason.trim()) {
      setEditError("Please provide a reason for the status change.");
      return;
    }
    setEditBusy(true);
    setEditError(null);
    const context: ActionContext = {
      actor,
      reason: editReason.trim() || undefined,
    };
    try {
      for (const uid of editModal.targets) {
        if (editModal.kind === "status") {
          await updateStudentStatus(uid, editValue as LifecycleStatus, context);
        } else if (editModal.kind === "department") {
          await updateStudentDepartment(uid, editValue, context);
        } else {
          await updateStudentYearLevel(uid, editValue, context);
        }
      }
      setEditModal(null);
      clearSelection();
      showToast(
        `Updated ${editModal.targets.length > 1 ? `${editModal.targets.length} students` : "student"}.`,
      );
    } catch {
      setEditError("Update failed. Please try again.");
    } finally {
      setEditBusy(false);
    }
  };

  const openConfirm = useCallback(
    (
      kind: "archive" | "restore" | "graduate" | "restrict",
      targets: string[],
    ) => {
      setConfirm({ kind, targets });
      setConfirmError(null);
    },
    [],
  );

  const runConfirm = async () => {
    if (!confirm) return;
    setConfirmBusy(true);
    setConfirmError(null);
    const context: ActionContext = { actor };
    const statusFor: Record<typeof confirm.kind, LifecycleStatus> = {
      archive: "archived",
      restore: "active",
      graduate: "graduated",
      restrict: "restricted",
    };
    try {
      for (const uid of confirm.targets) {
        await updateStudentStatus(uid, statusFor[confirm.kind], context);
      }
      setConfirm(null);
      clearSelection();
      showToast(
        confirm.kind === "archive"
          ? "Archived."
          : confirm.kind === "restore"
            ? "Restored."
            : confirm.kind === "graduate"
              ? "Marked as graduated."
              : "Login access restricted.",
      );
    } catch {
      setConfirmError("Action failed. Please try again.");
    } finally {
      setConfirmBusy(false);
    }
  };

  const openWorkflow = useCallback(
    (targets: string[], presetAction?: SupportActionType) => {
      setWfBulk(targets.length > 1);
      setWfTarget(targets[0] ?? null);
      setWfAction(presetAction ?? null);
      setWfReason("");
      setWfReasons([]);
      setWfContactMethod(null);
      setWfResources([]);
      setWfMonitorDays(null);
      setWfFollowUp(null);
      setWfFollowUpTime(null);
      setShowTimePicker(false);
      setWfError(null);
      setWfAssignee(user?.uid ?? "");
      wfRequestIds.current = new Map();
      const first = entryById(targets[0]);
      if (first) {
        const presets: string[] = [];
        if (first.latestRiskLevel === "high")
          presets.push("Elevated assessment");
        if ((first.supportStatus ?? "no_action") === "outreach_recommended")
          presets.push("Repeated concern");
        if (
          first.assessmentsCount === 0 ||
          first.latestAssessmentDate === undefined
        )
          presets.push("Engagement concern");
        if (isFollowUpOverdue(first.followUpDate)) {
          presets.push("Follow-up due");
        }
        setWfReasons(presets);
      }
      setWfOpen(true);
    },
    [user?.uid, entryById],
  );

  const saveWorkflow = async () => {
    if (!wfAction) return;
    const targets = wfBulk ? Array.from(selected) : wfTarget ? [wfTarget] : [];
    if (targets.length === 0) {
      setWfError("No student selected.");
      return;
    }
    if (wfAction === "send_wellness_checkin" && !wfContactMethod) {
      setWfError("Please select a contact method.");
      return;
    }
    if (wfAction === "guidance_consultation" && !wfAssignee) {
      setWfError("Please assign a counselor.");
      return;
    }
    if (wfAction === "schedule_follow_up" && !wfFollowUp) {
      setWfError("Please select a follow-up date.");
      return;
    }
    if (
      (wfAction === "schedule_follow_up" ||
        wfAction === "guidance_consultation") &&
      wfFollowUp &&
      !wfFollowUpTime
    ) {
      setWfError("Please select a follow-up time.");
      return;
    }
    if (wfAction === "schedule_follow_up" && !wfAssignee) {
      setWfError("Please assign a counselor for the follow-up.");
      return;
    }
    if (wfAction === "provide_resources" && wfResources.length === 0) {
      setWfError("Please select at least one resource.");
      return;
    }
    if (wfAction === "monitor_only" && !wfMonitorDays) {
      setWfError("Please select a monitoring period.");
      return;
    }
    setWfSaving(true);
    setWfError(null);
    const assigneeName =
      admins.find((a) => a.uid === wfAssignee)?.name ?? "Administrator";
    const reason = buildReasonSummary({
      reasons: wfReasons,
      contactMethod:
        wfAction === "send_wellness_checkin" ? wfContactMethod : null,
      resources: wfAction === "provide_resources" ? wfResources : [],
      monitorDays: wfAction === "monitor_only" ? wfMonitorDays : null,
      notes: wfReason,
    });
    try {
      for (const uid of targets) {
        const s = entryById(uid);
        if (!s) continue;
        let requestId = wfRequestIds.current.get(uid);
        if (!requestId) {
          requestId = uuidv4();
          wfRequestIds.current.set(uid, requestId);
        }
        const followUpAt =
          wfFollowUp && wfFollowUpTime
            ? combineDateAndTime(wfFollowUp, wfFollowUpTime)
            : wfFollowUp;
        await recordSupportAction({
          studentId: uid,
          action: wfAction,
          assignedTo: wfAssignee || user?.uid || "",
          assignedToName: wfAssignee ? assigneeName : actor?.name,
          followUpDate:
            wfAction === "schedule_follow_up" ||
            wfAction === "guidance_consultation"
              ? followUpAt
              : null,
          reason,
          requestId,
        });
      }
      setWfOpen(false);
      clearSelection();
      showToast("Support action recorded successfully.");
    } catch {
      setWfError("Unable to save the support action. Please try again.");
    } finally {
      setWfSaving(false);
    }
  };

  const openAudit = useCallback(async (scope: "all" | string) => {
    setAuditScope(scope);
    setAuditVisible(true);
    setAuditLoading(true);
    try {
      const logs = await fetchStudentAuditLogs(200);
      setAuditLogs(
        scope === "all"
          ? logs
          : logs.filter((l) => l.targetStudentId === scope),
      );
    } catch {
      setAuditLogs([]);
    } finally {
      setAuditLoading(false);
    }
  }, []);

  const openDelete = useCallback((uid: string) => {
    setDeleteUid(uid);
    setDeleteText("");
    setDeleteError(null);
  }, []);

  const runDelete = async () => {
    if (!deleteUid) return;
    const s = entryById(deleteUid);
    if (!s) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      const token = await auth.currentUser?.getIdToken();
      await permanentlyDeleteStudent(deleteUid, s.name, { actor });
      if (token) {
        try {
          await fetch(`${API_URL}/api/delete-student`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ uid: deleteUid }),
          });
        } catch {
          // Auth deletion is best-effort; the record is already removed.
        }
      }
      setDeleteUid(null);
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(deleteUid);
        return next;
      });
      showToast("Student record permanently deleted.");
    } catch {
      setDeleteError("Delete failed. Please try again.");
    } finally {
      setDeleteBusy(false);
    }
  };

  const completeWf = async (wf: SupportWorkflow) => {
    try {
      const student = entryById(wf.studentId);
      await completeSupportWorkflow(
        wf.id,
        { actor },
        student ? { uid: student.uid, name: student.name } : undefined,
      );
      showToast("Workflow marked complete.");
    } catch {
      showToast("Could not update the workflow.");
    }
  };

  // ─── Row render helpers ───────────────────────────────────────────────────

  const renderStudentCell = (s: StudentManagementEntry) => (
    <Pressable style={styles.studentCell} onPress={() => setProfileUid(s.uid)}>
      <View style={styles.avatar}>
        {s.profileImage ? (
          <Ionicons name="person" size={15} color="#8A63D2" />
        ) : (
          <Text style={styles.avatarText}>{initials(s.name)}</Text>
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.nameText} numberOfLines={1}>
          {s.name}
        </Text>
        <Text style={styles.subText} numberOfLines={1}>
          {s.schoolId} · {s.email ?? "No email"}
        </Text>
      </View>
    </Pressable>
  );

  const renderStatusBadge = (s: StudentManagementEntry) => {
    const st = s.status ?? "active";
    const color = LIFECYCLE_COLORS[st];
    return <Badge label={LIFECYCLE_LABELS[st]} color={color} />;
  };

  const renderRiskBadge = (s: StudentManagementEntry) => {
    const rl = (s.latestRiskLevel ?? "low") as RiskLevel;
    return <Badge label={RISK_LABELS[rl]} color={RISK_COLORS(theme)[rl]} />;
  };

  const renderSupportBadge = (s: StudentManagementEntry) => {
    const sp = s.supportStatus ?? "no_action";
    const active = ACTIVE_SUPPORT_STATUSES.includes(sp);
    return (
      <Badge
        label={SUPPORT_LABELS[sp]}
        color={SUPPORT_COLORS[sp]}
        icon={active ? "pulse" : undefined}
      />
    );
  };

  const renderLastActivity = (s: StudentManagementEntry) => {
    if (s.lastActivity) return formatDate(s.lastActivity);
    if (s.assessmentsCount > 0 || s.journalCount > 0) return "Recent";
    return "None";
  };

  const triageActions = (uid: string) => (
    <View style={styles.triageActions}>
      <Pressable
        style={styles.triageActionBtn}
        onPress={() => setProfileUid(uid)}
      >
        <Ionicons name="eye-outline" size={13} color="#6D28D9" />
        <Text style={styles.triageActionText}>Review</Text>
      </Pressable>
      <Pressable
        style={[styles.triageActionBtn, styles.triageActionPrimary]}
        onPress={() => openWorkflow([uid])}
      >
        <Ionicons name="add" size={13} color={theme.onPrimary} />
        <Text style={[styles.triageActionText, { color: "#FFFFFF" }]}>
          Record Support
        </Text>
      </Pressable>
    </View>
  );

  const activeMenuActions = useMemo(() => {
    if (!menuUid) return [];
    const student = entryById(menuUid);
    if (!student) return [];

    const st = student.status ?? "active";
    const actions: {
      key: string;
      label: string;
      icon: keyof typeof Ionicons.glyphMap;
      danger?: boolean;
    }[] = [
      { key: "profile", label: "View Profile", icon: "person-circle-outline" },
      {
        key: "workflow",
        label: "Create / View Workflow",
        icon: "git-network-outline",
      },
      {
        key: "status",
        label: "Change Status",
        icon: "swap-horizontal-outline",
      },
      { key: "dept", label: "Edit Department", icon: "business-outline" },
      { key: "year", label: "Edit Year Level", icon: "school-outline" },
    ];

    if (st !== "archived") {
      actions.push({
        key: "archive",
        label: "Archive",
        icon: "archive-outline",
      });
    } else {
      actions.push({
        key: "restore",
        label: "Restore to Active",
        icon: "refresh-outline",
      });
    }
    if (st !== "restricted") {
      actions.push({
        key: "restrict",
        label: "Restrict Login Access",
        icon: "lock-closed-outline",
        danger: true,
      });
    }
    if (st !== "graduated") {
      actions.push({
        key: "graduate",
        label: "Mark as Graduated",
        icon: "ribbon-outline",
      });
    }

    actions.push({
      key: "audit",
      label: "View Audit Trail",
      icon: "document-text-outline",
    });

    if (isSuperAdmin) {
      actions.push({
        key: "delete",
        label: "Permanently Delete",
        icon: "trash-outline",
        danger: true,
      });
    }

    return actions;
  }, [menuUid, isSuperAdmin, entryById]);

  const handleStudentMenuAction = useCallback(
    (actionKey: string) => {
      if (!menuUid) return;
      setMenuUid(null); // Close menu on action
      switch (actionKey) {
        case "profile":
          router.push({
            pathname: "./student-detail",
            params: { uid: menuUid },
          });
          break;
        case "workflow":
          openWorkflow([menuUid]);
          break;
        case "status":
          openEdit("status", [menuUid]);
          break;
        case "dept":
          openEdit("department", [menuUid]);
          break;
        case "year":
          openEdit("year", [menuUid]);
          break;
        case "archive":
          openConfirm("archive", [menuUid]);
          break;
        case "restore":
          openConfirm("restore", [menuUid]);
          break;
        case "restrict":
          openConfirm("restrict", [menuUid]);
          break;
        case "graduate":
          openConfirm("graduate", [menuUid]);
          break;
        case "audit":
          openAudit(menuUid);
          break;
        case "delete":
          openDelete(menuUid);
          break;
      }
    },
    [menuUid, openWorkflow, openEdit, openConfirm, openDelete, openAudit],
  ); 

  // ─── Render ───────────────────────────────────────────────────────────────

  // Route guard: only administrators may access student management data.
  if (role === "student") {
    return <Redirect href="/dashboard" />;
  }
  if (!user) {
    return <Redirect href="/auth/login" />;
  }

  if (loading && entries.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#8A63D2" />
        <Text style={styles.centerText}>Loading student directory…</Text>
      </View>
    );
  }

  const wfValid = canSaveWorkflow({
    action: wfAction,
    followUp: wfFollowUp,
    followUpTime: wfFollowUpTime,
    assignee: wfAssignee,
    contactMethod: wfContactMethod,
    resources: wfResources,
    monitorDays: wfMonitorDays,
  });
  const wfCanSave = wfValid && !wfSaving;

  /** Selects a quick follow-up date and immediately opens the time picker. */
  const pickQuickDate = (date: Date) => {
    setWfFollowUp(date);
    setShowTimePicker(true);
  };

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={theme.headerGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 10 }]}
      >
        <View style={styles.headerTop}>
          <Pressable
            style={styles.backBtn}
            onPress={() => router.back()}
            hitSlop={8}
          >
            <Ionicons name="arrow-back" size={22} color="white" />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Student Management</Text>
            <Text style={styles.headerSubtitle}>
              Directory, lifecycle status, support workflows &amp; audit trail
            </Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable
              style={styles.headerBtn}
              onPress={() => openAudit("all")}
            >
              <Ionicons
                name="document-text-outline"
                size={16}
                color="#6D28D9"
              />
              <Text style={styles.headerBtnText}>Audit Log</Text>
            </Pressable>
          </View>
        </View>
        {isSuperAdmin && (
          <View style={styles.superBanner}>
            <Ionicons name="shield-checkmark" size={14} color="#C4B5FD" />
            <Text style={styles.superBannerText}>
              Super Admin — permanent deletion is available.
            </Text>
          </View>
        )}
      </LinearGradient>

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: selected.size > 0 ? 110 : insets.bottom + 20 },
        ]}
        showsVerticalScrollIndicator={true}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={reload} />
        }
      >
        {error ? (
          <View style={styles.errorCard}>
            <Ionicons name="cloud-offline-outline" size={18} color="#B91C1C" />
            <Text style={styles.errorText}>{error}</Text>
            <Pressable style={styles.retryBtn} onPress={reload}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : null}

        {/* KPI grid */}
        <View style={styles.kpiGrid}>
          <KpiCard
            label="Total Students"
            value={kpis.total}
            icon="people-outline"
            color="#1E1B4B"
            bg="#EDE9FE"
            onPress={() => setStatusFilter("All")}
          />
          <KpiCard
            label="Active"
            value={kpis.active}
            icon="checkmark-circle-outline"
            color="#15803D"
            bg="#DCFCE7"
            onPress={() => setStatusFilter("active")}
          />
          <KpiCard
            label="On Leave"
            value={kpis.onLeave}
            icon="time-outline"
            color="#B45309"
            bg="#FEF3C7"
            onPress={() => setStatusFilter("on_leave")}
          />
          <KpiCard
            label="Graduated"
            value={kpis.graduated}
            icon="ribbon-outline"
            color="#6D28D9"
            bg="#EDE9FE"
            onPress={() => setStatusFilter("graduated")}
          />
          <KpiCard
            label="Archived"
            value={kpis.archived}
            icon="archive-outline"
            color="#475569"
            bg="#E2E8F0"
            onPress={() => setStatusFilter("archived")}
          />
          <KpiCard
            label="Attention Required"
            value={kpis.attention}
            icon="alert-circle-outline"
            color="#BE123C"
            bg="#FFE4E6"
          />
        </View>

        {/* Attention Required — vertical triage queue */}
        {attentionItems.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionTitle}>Attention Required</Text>
                <Text style={styles.sectionSubtitle}>
                  Ordered by support priority — assessment-derived indicators,
                  not diagnoses.
                </Text>
              </View>
              <Text style={styles.sectionCount}>{attentionItems.length}</Text>
            </View>
            {isWide ? (
              <View>
                <View style={styles.triageHead}>
                  <Text
                    style={[styles.triageHeadCell, styles.triageColPriority]}
                  >
                    Priority
                  </Text>
                  <Text
                    style={[styles.triageHeadCell, styles.triageColStudent]}
                  >
                    Student
                  </Text>
                  <Text style={[styles.triageHeadCell, styles.triageColRisk]}>
                    Risk
                  </Text>
                  <Text
                    style={[styles.triageHeadCell, styles.triageColSupport]}
                  >
                    Support
                  </Text>
                  <View style={styles.triageColActions} />
                </View>
                {attentionItems.slice(0, 12).map((item) => (
                  <View
                    key={item.student.uid}
                    style={[
                      styles.triageRow,
                      item.priority === "high" && styles.triageRowHigh,
                    ]}
                  >
                    <View style={styles.triageColPriority}>
                      <PriorityBadge priority={item.priority} />
                    </View>
                    <View style={styles.triageColStudent}>
                      {renderStudentCell(item.student)}
                    </View>
                    <View style={styles.triageColRisk}>
                      <Text style={styles.triageRiskText} numberOfLines={1}>
                        {item.riskStatement}
                      </Text>
                      <Text style={styles.triageMetaText} numberOfLines={1}>
                        {item.daysSinceAssessment === null
                          ? "No assessment yet"
                          : item.daysSinceAssessment === 0
                            ? "Assessed today"
                            : `Last assessed ${item.daysSinceAssessment}d ago`}
                      </Text>
                    </View>
                    <View style={styles.triageColSupport}>
                      {renderSupportBadge(item.student)}
                    </View>
                    <View style={styles.triageColActions}>
                      {triageActions(item.student.uid)}
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.cardList}>
                {attentionItems.slice(0, 12).map((item) => (
                  <View
                    key={item.student.uid}
                    style={[
                      styles.triageCard,
                      item.priority === "high" && styles.triageCardHigh,
                    ]}
                  >
                    <View style={styles.triageCardTop}>
                      <PriorityBadge priority={item.priority} />
                      <View style={{ flex: 1 }}>
                        {renderStudentCell(item.student)}
                      </View>
                    </View>
                    <Text style={styles.triageRiskText}>
                      {item.riskStatement}
                    </Text>
                    <Text style={styles.triageMetaText}>
                      {item.daysSinceAssessment === null
                        ? "No assessment yet"
                        : item.daysSinceAssessment === 0
                          ? "Assessed today"
                          : `Last assessed ${item.daysSinceAssessment}d ago`}{" "}
                      ·{" "}
                      {
                        SUPPORT_LABELS[
                          item.student.supportStatus ?? "no_action"
                        ]
                      }
                    </Text>
                    {item.reasons.map((r) => (
                      <View key={r} style={styles.triageReasonRow}>
                        <Ionicons name="ellipse" size={6} color="#8A63D2" />
                        <Text style={styles.triageReason}>{r}</Text>
                      </View>
                    ))}
                    <View style={styles.triageActions}>
                      <Pressable
                        style={styles.triageActionBtn}
                        onPress={() => setProfileUid(item.student.uid)}
                      >
                        <Ionicons
                          name="eye-outline"
                          size={13}
                          color="#6D28D9"
                        />
                        <Text style={styles.triageActionText}>Review</Text>
                      </Pressable>
                      <Pressable
                        style={styles.triageActionBtn}
                        onPress={() =>
                          openWorkflow([item.student.uid], "schedule_follow_up")
                        }
                      >
                        <Ionicons
                          name="calendar-outline"
                          size={13}
                          color="#0F766E"
                        />
                        <Text
                          style={[
                            styles.triageActionText,
                            { color: "#0F766E" },
                          ]}
                        >
                          Schedule Follow-up
                        </Text>
                      </Pressable>
                      <Pressable
                        style={[
                          styles.triageActionBtn,
                          styles.triageActionPrimary,
                        ]}
                        onPress={() => openWorkflow([item.student.uid])}
                      >
                        <Ionicons name="add" size={13} color={theme.onPrimary} />
                        <Text
                          style={[
                            styles.triageActionText,
                            { color: "#FFFFFF" },
                          ]}
                        >
                          Record Support
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Filters — always-visible controls + advanced filters */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>Student Directory</Text>
              <Text style={styles.sectionSubtitle}>
                Showing {filtered.length} of {entries.length} students
              </Text>
            </View>
          </View>

          <View style={styles.filterBar}>
            <View style={styles.searchRowCompact}>
              <Ionicons name="search" size={16} color="#9CA3AF" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search students…"
                placeholderTextColor="#9CA3AF"
                value={search}
                onChangeText={setSearch}
              />
              {search ? (
                <Pressable onPress={() => setSearch("")}>
                  <Ionicons name="close-circle" size={18} color="#9CA3AF" />
                </Pressable>
              ) : null}
            </View>
            <Pressable
              style={styles.statusSelect}
              onPress={() => setStatusMenuOpen(true)}
            >
              <Text style={styles.statusSelectText} numberOfLines={1}>
                {statusFilter === "All"
                  ? "All Statuses"
                  : LIFECYCLE_LABELS[statusFilter as LifecycleStatus]}
              </Text>
              <Ionicons name="chevron-down" size={14} color="#4B5563" />
            </Pressable>
            <Pressable
              style={[
                styles.filterBtn,
                activeFilters.length > 0 && styles.filterBtnActive,
              ]}
              onPress={() => setAdvancedOpen(true)}
            >
              <Ionicons
                name="options-outline"
                size={15}
                color={activeFilters.length > 0 ? "#FFFFFF" : "#6D28D9"}
              />
              <Text
                style={[
                  styles.filterBtnText,
                  activeFilters.length > 0 && styles.filterBtnTextActive,
                ]}
              >
                Filters
                {activeFilters.length > 0 ? ` (${activeFilters.length})` : ""}
              </Text>
            </Pressable>
            {activeFilters.length > 0 ? (
              <Pressable style={styles.clearBtn} onPress={clearAllFilters}>
                <Ionicons name="close" size={14} color="#6B7280" />
                <Text style={styles.clearBtnText}>Clear</Text>
              </Pressable>
            ) : null}
          </View>

          {activeFilters.length > 0 ? (
            <View style={styles.activeFilterWrap}>
              <Text style={styles.activeFilterLabel}>Active filters:</Text>
              <View style={styles.activeFilterChips}>
                {activeFilters.map((chip) => (
                  <Pressable
                    key={chip.key}
                    style={styles.activeFilterChip}
                    onPress={chip.clear}
                    accessibilityLabel={`Remove filter ${chip.label}`}
                  >
                    <Text style={styles.activeFilterChipText}>
                      {chip.label}
                    </Text>
                    <Ionicons name="close-circle" size={14} color="#6D28D9" />
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}
        </View>

        {/* Directory */}
        {pageStudents.length === 0 ? (
          entries.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="people-outline" size={26} color="#CBD5E1" />
              <Text style={styles.emptyTitle}>
                No students have been registered yet
              </Text>
              <Text style={styles.emptyText}>
                New student accounts will appear here once they register.
              </Text>
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <Ionicons name="file-tray-outline" size={26} color="#CBD5E1" />
              <Text style={styles.emptyTitle}>
                No students match these filters
              </Text>
              <Text style={styles.emptyText}>
                Try removing one or more filters or search for another student.
              </Text>
              {activeFilters.length > 0 ? (
                <Pressable
                  style={styles.emptyClearBtn}
                  onPress={clearAllFilters}
                >
                  <Text style={styles.emptyClearText}>Clear Filters</Text>
                </Pressable>
              ) : null}
            </View>
          )
        ) : isWide ? (
          <View style={styles.tableCard}>
            <View style={styles.tableHead}>
              <Pressable style={styles.cellCheck} onPress={selectAllVisible}>
                <Ionicons
                  name={
                    pageStudents.every((s) => selected.has(s.uid))
                      ? "checkbox"
                      : "square-outline"
                  }
                  size={18}
                  color="#8A63D2"
                />
              </Pressable>
              <Text style={[styles.cellText, styles.colStudent]}>Student</Text>
              <Text style={[styles.cellText, styles.colDept]}>Department</Text>
              <Text style={[styles.cellText, styles.colYear]}>Year</Text>
              <Text style={[styles.cellText, styles.colStatus]}>Status</Text>
              <Text style={[styles.cellText, styles.colWell]}>Wellness</Text>
              <Text style={[styles.cellText, styles.colNum]}>Assess</Text>
              <Text style={[styles.cellText, styles.colNum]}>Journals</Text>
              <Text style={[styles.cellText, styles.colSupport]}>Support</Text>
              <Text style={[styles.cellText, styles.colActivity]}>
                Last Activity
              </Text>
              <View style={styles.colActions} />
            </View>
            {pageStudents.map((s) => (
              <View
                key={s.uid}
                style={[
                  styles.tableRow,
                  selected.has(s.uid) && styles.tableRowSelected,
                ]}
              >
                <Pressable
                  style={styles.cellCheck}
                  onPress={() => toggleSelect(s.uid)}
                >
                  <Ionicons
                    name={selected.has(s.uid) ? "checkbox" : "square-outline"}
                    size={18}
                    color={selected.has(s.uid) ? "#8A63D2" : "#CBD5E1"}
                  />
                </Pressable>
                <View style={styles.colStudent}>{renderStudentCell(s)}</View>
                <Text
                  style={[styles.cellText, styles.colDept]}
                  numberOfLines={1}
                >
                  {s.department || "—"}
                </Text>
                <Text
                  style={[styles.cellText, styles.colYear]}
                  numberOfLines={1}
                >
                  {s.yearLevel || "—"}
                </Text>
                <View style={styles.colStatus}>{renderStatusBadge(s)}</View>
                <View style={styles.colWell}>{renderRiskBadge(s)}</View>
                <Text style={[styles.cellText, styles.colNum]}>
                  {s.assessmentsCount}
                </Text>
                <Text style={[styles.cellText, styles.colNum]}>
                  {s.journalCount}
                </Text>
                <View style={styles.colSupport}>{renderSupportBadge(s)}</View>
                <Text
                  style={[styles.cellText, styles.colActivity]}
                  numberOfLines={1}
                >
                  {renderLastActivity(s)}
                </Text>
                <View style={styles.colActions}>
                  <Pressable
                    style={styles.moreBtn}
                    onPress={() => setMenuUid(s.uid)}
                  >
                    <Ionicons
                      name="ellipsis-horizontal"
                      size={18}
                      color="#6B7280"
                    />
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.cardList}>
            {pageStudents.map((s) => (
              <View
                key={s.uid}
                style={[
                  styles.studentCard,
                  selected.has(s.uid) && styles.studentCardSelected,
                ]}
              >
                <View style={styles.studentCardTop}>
                  <Pressable
                    style={styles.cellCheck}
                    onPress={() => toggleSelect(s.uid)}
                  >
                    <Ionicons
                      name={selected.has(s.uid) ? "checkbox" : "square-outline"}
                      size={20}
                      color={selected.has(s.uid) ? "#8A63D2" : "#CBD5E1"}
                    />
                  </Pressable>
                  <View style={{ flex: 1 }}>{renderStudentCell(s)}</View>
                  <Pressable
                    style={styles.moreBtn}
                    onPress={() => setMenuUid(s.uid)}
                  >
                    <Ionicons
                      name="ellipsis-horizontal"
                      size={20}
                      color="#6B7280"
                    />
                  </Pressable>
                </View>
                <View style={styles.studentCardMeta}>
                  <Text style={styles.cardMetaText} numberOfLines={1}>
                    {s.department || "—"} · {s.yearLevel || "—"}
                  </Text>
                  <Text style={styles.cardMetaText}>
                    {s.assessmentsCount} assessments · {s.journalCount} journals
                  </Text>
                </View>
                <View style={styles.studentCardBadges}>
                  {renderStatusBadge(s)}
                  {renderRiskBadge(s)}
                  {renderSupportBadge(s)}
                  {s.isLSN ? <Badge label="LSN" color="#0891B2" /> : null}
                  <Text style={styles.cardActivity}>
                    Last activity: {renderLastActivity(s)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <View style={styles.pager}>
            <Pressable
              style={[styles.pagerBtn, page === 1 && styles.pagerBtnDisabled]}
              disabled={page === 1}
              onPress={() => setPage((p) => Math.max(1, p - 1))}
            >
              <Ionicons
                name="chevron-back"
                size={16}
                color={page === 1 ? "#CBD5E1" : "#4B5563"}
              />
            </Pressable>
            <Text style={styles.pagerText}>
              Page {page} of {totalPages}
            </Text>
            <Pressable
              style={[
                styles.pagerBtn,
                page === totalPages && styles.pagerBtnDisabled,
              ]}
              disabled={page === totalPages}
              onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              <Ionicons
                name="chevron-forward"
                size={16}
                color={page === totalPages ? "#CBD5E1" : "#4B5563"}
              />
            </Pressable>
          </View>
        )}
      </ScrollView>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <View style={[styles.bulkBar, { paddingBottom: insets.bottom + 10 }]}>
          <Text style={styles.bulkCount}>{selected.size} selected</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.bulkActions}
          >
            <Pressable
              style={styles.bulkBtn}
              onPress={() => openWorkflow(Array.from(selected))}
            >
              <Ionicons name="git-network-outline" size={14} color="#6D28D9" />
              <Text style={styles.bulkBtnText}>Assign Support</Text>
            </Pressable>
            <Pressable
              style={styles.bulkBtn}
              onPress={() => openEdit("status", Array.from(selected))}
            >
              <Ionicons
                name="swap-horizontal-outline"
                size={14}
                color="#6D28D9"
              />
              <Text style={styles.bulkBtnText}>Change Status</Text>
            </Pressable>
            <Pressable
              style={styles.bulkBtn}
              onPress={() => openConfirm("archive", Array.from(selected))}
            >
              <Ionicons name="archive-outline" size={14} color="#6D28D9" />
              <Text style={styles.bulkBtnText}>Archive</Text>
            </Pressable>
            <Pressable
              style={styles.bulkBtn}
              onPress={() => openConfirm("graduate", Array.from(selected))}
            >
              <Ionicons name="ribbon-outline" size={14} color="#6D28D9" />
              <Text style={styles.bulkBtnText}>Graduate</Text>
            </Pressable>
            <Pressable
              style={styles.bulkBtn}
              onPress={() => openConfirm("restrict", Array.from(selected))}
            >
              <Ionicons name="lock-closed-outline" size={14} color="#BE123C" />
              <Text style={[styles.bulkBtnText, { color: "#BE123C" }]}>
                Restrict
              </Text>
            </Pressable>
            <Pressable style={styles.bulkBtn} onPress={clearSelection}>
              <Ionicons name="close" size={14} color="#6B7280" />
              <Text style={[styles.bulkBtnText, { color: "#6B7280" }]}>
                Clear
              </Text>
            </Pressable>
          </ScrollView>
        </View>
      )}

      {/* Edit modal */}
      <Modal
        visible={editModal !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setEditModal(null)}
      >
        {editModal && (
          <View style={styles.backdrop}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => !editBusy && setEditModal(null)}
            />
            <View style={styles.sheet}>
              <Text style={styles.sheetTitle}>
                {editModal.kind === "status"
                  ? "Change Student Status"
                  : editModal.kind === "department"
                    ? "Edit Department"
                    : "Edit Year Level"}
              </Text>
              <Text style={styles.sheetSubtitle}>
                {editModal.targets.length > 1
                  ? `Applying to ${editModal.targets.length} students.`
                  : "Updating one student."}
              </Text>
              <ScrollView style={{ maxHeight: 260 }}>
                {(editModal.kind === "status"
                  ? LIFECYCLE_STATUSES
                  : editModal.kind === "department"
                    ? departments
                    : YEAR_OPTIONS
                ).map((opt) => (
                  <Pressable
                    key={opt}
                    style={[
                      styles.optionRow,
                      editValue === opt && styles.optionRowActive,
                    ]}
                    onPress={() => setEditValue(opt)}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        editValue === opt && styles.optionTextActive,
                      ]}
                    >
                      {opt}
                    </Text>
                    {editValue === opt ? (
                      <Ionicons
                        name="checkmark-circle"
                        size={18}
                        color="#6D28D9"
                      />
                    ) : null}
                  </Pressable>
                ))}
              </ScrollView>
              <TextInput
                style={styles.reasonInput}
                placeholder={
                  editModal.kind === "status"
                    ? "Reason for this status change (required)…"
                    : "Administrative reason (optional)…"
                }
                placeholderTextColor="#9CA3AF"
                multiline
                value={editReason}
                onChangeText={setEditReason}
              />
              {editError ? (
                <Text style={styles.errorText}>{editError}</Text>
              ) : null}
              <View style={styles.sheetFooter}>
                <Pressable
                  style={styles.cancelBtn}
                  onPress={() => setEditModal(null)}
                  disabled={editBusy}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.primaryBtn,
                    (!editValue || editBusy) && styles.btnDisabled,
                  ]}
                  disabled={!editValue || editBusy}
                  onPress={applyEdit}
                >
                  {editBusy ? (
                    <ActivityIndicator color={theme.onPrimary} size="small" />
                  ) : (
                    <Text style={styles.primaryBtnText}>Save</Text>
                  )}
                </Pressable>
              </View>
            </View>
          </View>
        )}
      </Modal>

      {/* Confirm destructive modal */}
      <Modal
        visible={confirm !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirm(null)}
      >
        {confirm && (
          <View style={styles.backdrop}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => !confirmBusy && setConfirm(null)}
            />
            <View style={styles.sheet}>
              <View style={[styles.warnIcon, { backgroundColor: "#FEF3C7" }]}>
                <Ionicons
                  name={
                    confirm.kind === "restrict"
                      ? "lock-closed"
                      : confirm.kind === "archive"
                        ? "archive"
                        : confirm.kind === "graduate"
                          ? "ribbon"
                          : "refresh"
                  }
                  size={22}
                  color="#B45309"
                />
              </View>
              <Text style={styles.sheetTitle}>
                {confirm.kind === "archive"
                  ? "Archive students?"
                  : confirm.kind === "restore"
                    ? "Restore students?"
                    : confirm.kind === "graduate"
                      ? "Mark as graduated?"
                      : "Restrict login access?"}
              </Text>
              <Text style={styles.sheetBody}>
                {confirm.kind === "archive"
                  ? "Archived students are removed from default views but their records are kept intact. This can be undone later."
                  : confirm.kind === "restore"
                    ? "The selected students will be set back to Active status."
                    : confirm.kind === "graduate"
                      ? "Graduated students keep their records for alumni reporting."
                      : "Restricted students can no longer sign in. Their records and history are preserved."}
                {"\n\n"}
                {confirm.targets.length > 1
                  ? `This applies to ${confirm.targets.length} students.`
                  : `This applies to ${entryById(confirm.targets[0])?.name ?? "this student"}.`}
              </Text>
              {confirmError ? (
                <Text style={styles.errorText}>{confirmError}</Text>
              ) : null}
              <View style={styles.sheetFooter}>
                <Pressable
                  style={styles.cancelBtn}
                  onPress={() => setConfirm(null)}
                  disabled={confirmBusy}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[styles.primaryBtn, confirmBusy && styles.btnDisabled]}
                  disabled={confirmBusy}
                  onPress={runConfirm}
                >
                  {confirmBusy ? (
                    <ActivityIndicator color={theme.onPrimary} size="small" />
                  ) : (
                    <Text style={styles.primaryBtnText}>
                      {confirm.kind === "archive"
                        ? "Archive"
                        : confirm.kind === "restore"
                          ? "Restore"
                          : confirm.kind === "graduate"
                            ? "Graduate"
                            : "Restrict"}
                    </Text>
                  )}
                </Pressable>
              </View>
            </View>
          </View>
        )}
      </Modal>

      {/* Primary status filter dropdown */}
      <Modal
        visible={statusMenuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setStatusMenuOpen(false)}
      >
        <View style={styles.backdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setStatusMenuOpen(false)}
          />
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Student Status</Text>
            <Text style={styles.sheetSubtitle}>
              Filter the directory by lifecycle status.
            </Text>
            <ScrollView style={{ maxHeight: 360 }}>
              {["All", ...LIFECYCLE_STATUSES].map((st) => (
                <Pressable
                  key={st}
                  style={[
                    styles.optionRow,
                    statusFilter === st && styles.optionRowActive,
                  ]}
                  onPress={() => {
                    setStatusFilter(st);
                    setStatusMenuOpen(false);
                  }}
                >
                  <Text
                    style={[
                      styles.optionText,
                      statusFilter === st && styles.optionTextActive,
                    ]}
                  >
                    {st === "All"
                      ? "All Statuses"
                      : LIFECYCLE_LABELS[st as LifecycleStatus]}
                  </Text>
                  {statusFilter === st ? (
                    <Ionicons
                      name="checkmark-circle"
                      size={18}
                      color="#6D28D9"
                    />
                  ) : null}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Advanced filters */}
      <Modal
        visible={advancedOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setAdvancedOpen(false)}
      >
        <View style={styles.backdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setAdvancedOpen(false)}
          />
          <View style={[styles.wizardSheet, { maxHeight: "88%" }]}>
            <View style={styles.wizardHead}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetTitle}>Advanced Filters</Text>
                <Text style={styles.sheetSubtitle}>
                  Combine any of these filters — all conditions apply together.
                </Text>
              </View>
              <Pressable
                onPress={() => setAdvancedOpen(false)}
                style={styles.closeBtn}
              >
                <Ionicons name="close" size={20} color="#6B7280" />
              </Pressable>
            </View>

            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={styles.advancedBody}
              keyboardShouldPersistTaps="handled"
            >
              <FilterGroup title="Department / College">
                {["All", ...departments].map((d) => (
                  <FilterOptionChip
                    key={d}
                    label={d}
                    active={deptFilter === d}
                    onPress={() => setDeptFilter(d)}
                  />
                ))}
              </FilterGroup>

              <FilterGroup title="Year Level">
                {["All", ...YEAR_OPTIONS].map((y) => (
                  <FilterOptionChip
                    key={y}
                    label={y}
                    active={yearFilter === y}
                    onPress={() => setYearFilter(y)}
                  />
                ))}
              </FilterGroup>

              <FilterGroup title="Risk Level">
                {(
                  ["All", "low", "normal", "high"] as (RiskLevel | "All")[]
                ).map((r) => (
                  <FilterOptionChip
                    key={r}
                    label={r === "All" ? "All levels" : RISK_LABELS[r]}
                    active={riskFilter === r}
                    onPress={() => setRiskFilter(r)}
                  />
                ))}
              </FilterGroup>

              <FilterGroup title="Support Status">
                {["All", ...SUPPORT_STATUSES].map((sp) => (
                  <FilterOptionChip
                    key={"sp" + sp}
                    label={
                      sp === "All"
                        ? "All statuses"
                        : SUPPORT_LABELS[sp as SupportStatus]
                    }
                    active={supportFilter === sp}
                    onPress={() => setSupportFilter(sp)}
                  />
                ))}
              </FilterGroup>

              <FilterGroup title="Assessment Status">
                <FilterOptionChip
                  label="All"
                  active={assessedFilter === "All"}
                  onPress={() => setAssessedFilter("All")}
                />
                <FilterOptionChip
                  label="Assessed"
                  active={assessedFilter === "assessed"}
                  onPress={() => setAssessedFilter("assessed")}
                />
                <FilterOptionChip
                  label="Not assessed"
                  active={assessedFilter === "not_assessed"}
                  onPress={() => setAssessedFilter("not_assessed")}
                />
              </FilterGroup>

              <FilterGroup title="Activity">
                {ACTIVITY_OPTIONS.map((a) => (
                  <FilterOptionChip
                    key={a.key}
                    label={a.label}
                    active={activityFilter === a.key}
                    onPress={() => setActivityFilter(a.key)}
                  />
                ))}
              </FilterGroup>

              <FilterGroup title="LSN / Special Needs">
                <View style={styles.lsnRow}>
                  <Switch
                    value={lsnOnly}
                    onValueChange={setLsnOnly}
                    trackColor={{ false: "#E5E7EB", true: "#8A63D2" }}
                    thumbColor={theme.onPrimary}
                  />
                  <Text style={styles.lsnText}>LSN students only</Text>
                </View>
              </FilterGroup>

              <FilterGroup title="Assessment Date Range">
                <View style={styles.rangeRow}>
                  <Pressable
                    style={styles.rangeBtn}
                    onPress={() => setRangePicker("from")}
                  >
                    <Ionicons
                      name="calendar-outline"
                      size={14}
                      color="#6D28D9"
                    />
                    <Text style={styles.rangeBtnText}>
                      {assessmentFrom ? formatDate(assessmentFrom) : "From…"}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={styles.rangeBtn}
                    onPress={() => setRangePicker("to")}
                  >
                    <Ionicons
                      name="calendar-outline"
                      size={14}
                      color="#6D28D9"
                    />
                    <Text style={styles.rangeBtnText}>
                      {assessmentTo ? formatDate(assessmentTo) : "To…"}
                    </Text>
                  </Pressable>
                </View>
                {assessmentFrom || assessmentTo ? (
                  <Pressable
                    onPress={() => {
                      setAssessmentFrom(null);
                      setAssessmentTo(null);
                    }}
                  >
                    <Text style={styles.rangeClear}>Clear date range</Text>
                  </Pressable>
                ) : null}
              </FilterGroup>
            </ScrollView>

            <View style={styles.sheetFooter}>
              <Pressable style={styles.cancelBtn} onPress={clearAllFilters}>
                <Text style={styles.cancelBtnText}>Reset All</Text>
              </Pressable>
              <Pressable
                style={styles.primaryBtn}
                onPress={() => setAdvancedOpen(false)}
              >
                <Text style={styles.primaryBtnText}>Apply Filters</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {rangePicker ? (
        <DateTimePicker
          value={
            rangePicker === "from"
              ? (assessmentFrom ?? new Date())
              : (assessmentTo ?? new Date())
          }
          mode="date"
          display="default"
          textColor="#1E1B4B"
          onChange={(event, selectedDate) => {
            if (Platform.OS === "android") {
              setRangePicker(null);
              if (event.type === "set" && selectedDate) {
                if (rangePicker === "from") setAssessmentFrom(selectedDate);
                else setAssessmentTo(selectedDate);
              }
            } else {
              if (selectedDate) {
                if (rangePicker === "from") setAssessmentFrom(selectedDate);
                else setAssessmentTo(selectedDate);
              }
            }
          }}
        />
      ) : null}

      {/* Row action menu */}
      <Modal
        visible={menuUid !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuUid(null)}
      >
        {menuUid && (
          <View style={styles.backdrop}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => setMenuUid(null)}
            />
            <View style={styles.sheet}>
              <View style={styles.menuHead}>
                <Text style={styles.sheetTitle} numberOfLines={1}>
                  {entryById(menuUid)?.name ?? "Student"}
                </Text>
                <Text style={styles.sheetSubtitle}>
                  {entryById(menuUid)?.schoolId ?? ""}
                </Text>
              </View>
              <ScrollView style={{ maxHeight: 420 }}>
                {activeMenuActions.map((a) => (
                  <Pressable
                    key={a.key}
                    style={styles.menuItem}
                    onPress={() => handleStudentMenuAction(a.key)}
                  >
                    <Ionicons
                      name={a.icon}
                      size={18}
                      color={a.danger ? "#B91C1C" : "#4B5563"}
                    />
                    <Text
                      style={[
                        styles.menuItemText,
                        a.danger && { color: "#B91C1C" },
                      ]}
                    >
                      {a.label}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          </View>
        )}
      </Modal>

      {/* Record Support Action — single streamlined modal */}
      <Modal
        visible={wfOpen}
        transparent
        animationType="slide"
        onRequestClose={() => !wfSaving && setWfOpen(false)}
      >
        <View style={styles.backdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => !wfSaving && setWfOpen(false)}
          />
          <View style={[styles.wizardSheet, { maxHeight: "88%" }]}>
            <View style={styles.wizardHead}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetTitle}>Record Support Action</Text>
                <Text style={styles.sheetSubtitle}>
                  {wfBulk
                    ? `${selected.size} students selected`
                    : (entryById(wfTarget ?? "")?.name ?? "New support action")}
                </Text>
              </View>
              <Pressable
                onPress={() => !wfSaving && setWfOpen(false)}
                style={styles.closeBtn}
              >
                <Ionicons name="close" size={20} color="#6B7280" />
              </Pressable>
            </View>

            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={styles.wizardBody}
              keyboardShouldPersistTaps="handled"
            >
              {!wfBulk && wfTarget ? (
                <StudentContext student={entryById(wfTarget)} />
              ) : (
                <View style={styles.bulkNote}>
                  <Ionicons name="people" size={15} color="#6D28D9" />
                  <Text style={styles.bulkNoteText}>
                    This action will be recorded for {selected.size} students.
                  </Text>
                </View>
              )}

              <Text style={styles.fieldLabel}>Support action</Text>
              {ACTION_GROUPS.map((group) => (
                <View key={group.title}>
                  <Text style={styles.groupHeader}>{group.title}</Text>
                  {group.actions.map((action) => {
                    const selectedAction = wfAction === action;
                    return (
                      <Pressable
                        key={action}
                        style={[
                          styles.wfActionRow,
                          selectedAction && styles.wfActionRowActive,
                        ]}
                        onPress={() => setWfAction(action)}
                      >
                        <View
                          style={[
                            styles.wfActionRadio,
                            selectedAction && styles.wfActionRadioActive,
                          ]}
                        >
                          {selectedAction ? (
                            <View style={styles.wfActionRadioDot} />
                          ) : null}
                        </View>
                        <Text
                          style={[
                            styles.wfActionLabel,
                            selectedAction && styles.wfActionLabelActive,
                          ]}
                        >
                          {SUPPORT_ACTION_LABELS[action]}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ))}

              {wfAction === "send_wellness_checkin" ? (
                <View>
                  <Text style={styles.fieldLabel}>Contact method</Text>
                  <View style={styles.assigneeRow}>
                    {CONTACT_METHOD_OPTIONS.map((m) => {
                      const active = wfContactMethod === m;
                      return (
                        <Pressable
                          key={m}
                          style={[
                            styles.assigneeChip,
                            active && styles.assigneeChipActive,
                          ]}
                          onPress={() => setWfContactMethod(active ? null : m)}
                        >
                          <Text
                            style={[
                              styles.assigneeChipText,
                              active && styles.assigneeChipTextActive,
                            ]}
                          >
                            {m}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ) : null}

              {wfAction === "guidance_consultation" ||
              wfAction === "schedule_follow_up" ? (
                <View>
                  <Text style={styles.fieldLabel}>
                    {wfAction === "schedule_follow_up"
                      ? "Follow-up date"
                      : "Follow-up date (optional)"}
                  </Text>
                  <View style={styles.quickDates}>
                    {[
                      { label: "Today", date: new Date() },
                      { label: "7 days", date: addDays(new Date(), 7) },
                      { label: "1 month", date: addMonths(new Date(), 1) },
                    ].map((q) => {
                      const same =
                        wfFollowUp !== null &&
                        wfFollowUp.toDateString() === q.date.toDateString();
                      return (
                        <Pressable
                          key={q.label}
                          style={[
                            styles.quickDateBtn,
                            same && styles.quickDateBtnActive,
                          ]}
                          onPress={() => pickQuickDate(q.date)}
                        >
                          <Text
                            style={[
                              styles.quickDateText,
                              same && styles.quickDateTextActive,
                            ]}
                          >
                            {q.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                    <Pressable
                      style={styles.quickDateBtn}
                      onPress={() => setShowCustomDate(true)}
                    >
                      <Ionicons
                        name="calendar-outline"
                        size={14}
                        color="#6D28D9"
                      />
                      <Text style={styles.quickDateText}>Custom…</Text>
                    </Pressable>
                  </View>
                  <Text style={styles.followUpValue}>
                    {wfFollowUp
                      ? formatDate(wfFollowUp)
                      : "No follow-up date selected"}
                  </Text>

                  {wfFollowUp ? (
                    <View>
                      <Text style={styles.fieldLabel}>Follow-up time</Text>
                      <Pressable
                        style={[
                          styles.timePill,
                          wfFollowUpTime && styles.timePillActive,
                        ]}
                        onPress={() => setShowTimePicker(true)}
                      >
                        <Ionicons
                          name="time-outline"
                          size={15}
                          color={wfFollowUpTime ? "#6D28D9" : "#9CA3AF"}
                        />
                        <Text
                          style={[
                            styles.timePillText,
                            wfFollowUpTime && styles.timePillTextActive,
                            !wfFollowUpTime && styles.timePillTextPlaceholder,
                          ]}
                        >
                          {wfFollowUpTime
                            ? formatTime(wfFollowUpTime)
                            : "Select time"}
                        </Text>
                      </Pressable>
                    </View>
                  ) : null}

                  <Text style={styles.fieldLabel}>Assigned counselor</Text>
                  <View style={styles.assigneeRow}>
                    {admins.length === 0 ? (
                      <Text style={styles.pickerPlaceholder}>
                        Loading administrators…
                      </Text>
                    ) : (
                      admins.map((a) => {
                        const active = wfAssignee === a.uid;
                        return (
                          <Pressable
                            key={a.uid}
                            style={[
                              styles.assigneeChip,
                              active && styles.assigneeChipActive,
                            ]}
                            onPress={() => setWfAssignee(a.uid)}
                          >
                            <Text
                              style={[
                                styles.assigneeChipText,
                                active && styles.assigneeChipTextActive,
                              ]}
                            >
                              {a.name}
                            </Text>
                          </Pressable>
                        );
                      })
                    )}
                  </View>
                </View>
              ) : null}

              {wfAction === "provide_resources" ? (
                <View>
                  <Text style={styles.fieldLabel}>Resources provided</Text>
                  <View style={styles.assigneeRow}>
                    {RESOURCE_OPTIONS.map((r) => {
                      const on = wfResources.includes(r);
                      return (
                        <Pressable
                          key={r}
                          style={[
                            styles.assigneeChip,
                            on && styles.assigneeChipActive,
                          ]}
                          onPress={() =>
                            setWfResources((prev) =>
                              on ? prev.filter((x) => x !== r) : [...prev, r],
                            )
                          }
                        >
                          <View style={styles.tagChipInner}>
                            {on ? (
                              <Ionicons
                                name="checkmark"
                                size={13}
                                color="#6D28D9"
                              />
                            ) : null}
                            <Text
                              style={[
                                styles.assigneeChipText,
                                on && styles.assigneeChipTextActive,
                              ]}
                            >
                              {r}
                            </Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ) : null}

              {wfAction === "monitor_only" ? (
                <View>
                  <Text style={styles.fieldLabel}>Monitoring period</Text>
                  <View style={styles.assigneeRow}>
                    {MONITOR_PERIOD_OPTIONS.map((d) => {
                      const active = wfMonitorDays === d;
                      return (
                        <Pressable
                          key={d}
                          style={[
                            styles.assigneeChip,
                            active && styles.assigneeChipActive,
                          ]}
                          onPress={() => setWfMonitorDays(active ? null : d)}
                        >
                          <Text
                            style={[
                              styles.assigneeChipText,
                              active && styles.assigneeChipTextActive,
                            ]}
                          >
                            {d} days
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ) : null}

              <Text style={styles.fieldLabel}>Reason</Text>
              <View style={styles.assigneeRow}>
                {SUPPORT_REASON_OPTIONS.map((r) => {
                  const on = wfReasons.includes(r);
                  return (
                    <Pressable
                      key={r}
                      style={[
                        styles.assigneeChip,
                        on && styles.assigneeChipActive,
                      ]}
                      onPress={() =>
                        setWfReasons((prev) =>
                          on ? prev.filter((x) => x !== r) : [...prev, r],
                        )
                      }
                    >
                      <View style={styles.tagChipInner}>
                        {on ? (
                          <Ionicons
                            name="checkmark"
                            size={13}
                            color="#6D28D9"
                          />
                        ) : null}
                        <Text
                          style={[
                            styles.assigneeChipText,
                            on && styles.assigneeChipTextActive,
                          ]}
                        >
                          {r}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.fieldLabel}>Internal notes</Text>
              <Text style={styles.fieldHint}>
                Private — never sent to the student. Only admins can see this.
              </Text>
              <TextInput
                style={[styles.reasonInput, styles.wfReason]}
                placeholder={
                  wfAction === "resolved"
                    ? "What was resolved?…"
                    : "Optional administrative notes…"
                }
                placeholderTextColor="#9CA3AF"
                multiline
                value={wfReason}
                onChangeText={setWfReason}
              />

              {wfAction ? (
                <View style={styles.summaryBox}>
                  <Text style={styles.summaryTitle}>Support summary</Text>
                  <View style={styles.summaryRow}>
                    <Ionicons name="flash-outline" size={14} color="#6D28D9" />
                    <Text style={styles.summaryText}>
                      {SUPPORT_ACTION_LABELS[wfAction]}
                    </Text>
                  </View>
                  {(wfAction === "guidance_consultation" ||
                    wfAction === "schedule_follow_up") &&
                  wfAssignee ? (
                    <View style={styles.summaryRow}>
                      <Ionicons
                        name="person-circle-outline"
                        size={14}
                        color="#6D28D9"
                      />
                      <Text style={styles.summaryText}>
                        Counselor:{" "}
                        {admins.find((a) => a.uid === wfAssignee)?.name ??
                          "Administrator"}
                      </Text>
                    </View>
                  ) : null}
                  {(wfAction === "guidance_consultation" ||
                    wfAction === "schedule_follow_up") &&
                  wfFollowUp ? (
                    <View style={styles.summaryRow}>
                      <Ionicons
                        name="calendar-outline"
                        size={14}
                        color="#6D28D9"
                      />
                      <Text style={styles.summaryText}>
                        Follow-up: {formatFollowUp(wfFollowUp, wfFollowUpTime)}
                      </Text>
                    </View>
                  ) : null}
                  {wfAction === "send_wellness_checkin" && wfContactMethod ? (
                    <View style={styles.summaryRow}>
                      <Ionicons name="call-outline" size={14} color="#6D28D9" />
                      <Text style={styles.summaryText}>
                        Contact method: {wfContactMethod}
                      </Text>
                    </View>
                  ) : null}
                  {wfAction === "provide_resources" &&
                  wfResources.length > 0 ? (
                    <View style={styles.summaryRow}>
                      <Ionicons name="book-outline" size={14} color="#6D28D9" />
                      <Text style={styles.summaryText}>
                        Resources: {wfResources.join(", ")}
                      </Text>
                    </View>
                  ) : null}
                  {wfAction === "monitor_only" && wfMonitorDays ? (
                    <View style={styles.summaryRow}>
                      <Ionicons
                        name="timer-outline"
                        size={14}
                        color="#6D28D9"
                      />
                      <Text style={styles.summaryText}>
                        Monitoring: {wfMonitorDays} days
                      </Text>
                    </View>
                  ) : null}
                  {wfReasons.length > 0 ? (
                    <View style={styles.summaryRow}>
                      <Ionicons name="flag-outline" size={14} color="#6D28D9" />
                      <Text style={styles.summaryText}>
                        Reasons: {wfReasons.join(", ")}
                      </Text>
                    </View>
                  ) : null}
                  {wfReason.trim() ? (
                    <View style={styles.summaryRow}>
                      <Ionicons
                        name="document-text-outline"
                        size={14}
                        color="#6D28D9"
                      />
                      <Text style={styles.summaryText}>
                        Private note recorded (not sent to student)
                      </Text>
                    </View>
                  ) : null}
                  <View style={styles.summaryNotify}>
                    <Ionicons
                      name={
                        wfAction === "no_action"
                          ? "eye-off-outline"
                          : "mail-outline"
                      }
                      size={14}
                      color="#6B7280"
                    />
                    <Text style={styles.summaryNotifyText}>
                      {wfAction === "no_action"
                        ? "Student notification: None"
                        : "Student notification: Will be sent to Inbox"}
                    </Text>
                  </View>
                </View>
              ) : null}

              {!wfBulk && wfTarget ? (
                <SupportHistory
                  workflows={workflows.filter((w) => w.studentId === wfTarget)}
                />
              ) : null}

              {wfError ? <Text style={styles.errorText}>{wfError}</Text> : null}
            </ScrollView>

            <View style={styles.sheetFooter}>
              <Pressable
                style={styles.cancelBtn}
                onPress={() => setWfOpen(false)}
                disabled={wfSaving}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.primaryBtn,
                  !wfValid && styles.primaryBtnDisabled,
                ]}
                disabled={!wfCanSave}
                onPress={saveWorkflow}
              >
                {wfSaving ? (
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <ActivityIndicator color={theme.onPrimary} size="small" />
                    <Text style={[styles.primaryBtnText, { marginLeft: 8 }]}>
                      Saving…
                    </Text>
                  </View>
                ) : (
                  <Text
                    style={[
                      styles.primaryBtnText,
                      !wfValid && styles.primaryBtnTextDisabled,
                    ]}
                  >
                    Save Support Action
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <FollowUpDatePickerModal
        key={showCustomDate ? "date-picker-open" : "date-picker-idle"}
        visible={showCustomDate}
        initialDate={wfFollowUp}
        minDate={new Date()}
        onCancel={() => setShowCustomDate(false)}
        onConfirm={(date) => {
          setWfFollowUp(date);
          setShowCustomDate(false);
          setShowTimePicker(true);
        }}
      />

      <FollowUpTimePickerModal
        key={showTimePicker ? "time-picker-open" : "time-picker-idle"}
        visible={showTimePicker}
        initialTime={wfFollowUpTime}
        onCancel={() => setShowTimePicker(false)}
        onConfirm={(time) => {
          setWfFollowUpTime(time);
          setShowTimePicker(false);
        }}
      />

      {/* Profile modal */}
      <StudentProfileModal
        uid={profileUid}
        student={profileUid ? entryById(profileUid) : undefined}
        workflows={workflows.filter((w) => w.studentId === profileUid)}
        onClose={() => setProfileUid(null)}
        onOpenAudit={(uid) => {
          setProfileUid(null);
          openAudit(uid);
        }}
        onOpenWorkflow={(uid) => {
          setProfileUid(null);
          openWorkflow([uid]);
        }}
        onChangeStatus={(uid) => {
          setProfileUid(null);
          openEdit("status", [uid]);
        }}
        onCompleteWf={completeWf}
      />

      {/* Audit modal */}
      <Modal
        visible={auditVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAuditVisible(false)}
      >
        <View style={styles.backdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setAuditVisible(false)}
          />
          <View style={[styles.wizardSheet, { maxHeight: "86%" }]}>
            <View style={styles.wizardHead}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetTitle}>Audit Trail</Text>
                <Text style={styles.sheetSubtitle}>
                  {auditScope === "all"
                    ? "All administrative changes"
                    : (entryById(auditScope)?.name ?? "Student history")}
                </Text>
              </View>
              <Pressable
                onPress={() => setAuditVisible(false)}
                style={styles.closeBtn}
              >
                <Ionicons name="close" size={20} color="#6B7280" />
              </Pressable>
            </View>
            {auditLoading ? (
              <View style={styles.auditLoading}>
                <ActivityIndicator color="#8A63D2" />
              </View>
            ) : auditLogs.length === 0 ? (
              <View style={styles.auditEmpty}>
                <Text style={styles.emptyText}>No audit entries found.</Text>
              </View>
            ) : (
              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={styles.auditList}
              >
                {auditLogs.map((log) => (
                  <View key={log.id} style={styles.auditRow}>
                    <View style={styles.auditDot} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.auditAction}>
                        {AUDIT_ACTION_LABELS[log.action] ?? log.action}
                      </Text>
                      <Text style={styles.auditMeta}>
                        {log.targetStudentName ?? "—"}
                        {log.newValue ? ` → ${log.newValue}` : ""}
                        {log.previousValue
                          ? ` (from ${log.previousValue})`
                          : ""}
                      </Text>
                      {log.reason ? (
                        <Text style={styles.auditReason}>“{log.reason}”</Text>
                      ) : null}
                      <Text style={styles.auditBy}>
                        {log.actorName ?? "Administrator"} ·{" "}
                        {formatDateTime(log.createdAt)}
                      </Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Permanent delete modal */}
      <Modal
        visible={deleteUid !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteUid(null)}
      >
        {deleteUid && (
          <View style={styles.backdrop}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => !deleteBusy && setDeleteUid(null)}
            />
            <View style={styles.sheet}>
              <View style={[styles.warnIcon, { backgroundColor: "#FEE2E2" }]}>
                <Ionicons name="trash" size={22} color="#B91C1C" />
              </View>
              <Text style={styles.sheetTitle}>Permanently delete student?</Text>
              <Text style={styles.sheetBody}>
                This permanently removes the account of{" "}
                <Text style={{ fontWeight: "800" }}>
                  {entryById(deleteUid)?.name}
                </Text>
                , including wellness history, journals and profile — and cannot
                be undone. Type{" "}
                <Text style={{ fontWeight: "800" }}>DELETE</Text> to confirm.
              </Text>
              <TextInput
                style={styles.reasonInput}
                placeholder="Type DELETE to confirm…"
                placeholderTextColor="#9CA3AF"
                autoCapitalize="characters"
                value={deleteText}
                onChangeText={setDeleteText}
              />
              {deleteError ? (
                <Text style={styles.errorText}>{deleteError}</Text>
              ) : null}
              <View style={styles.sheetFooter}>
                <Pressable
                  style={styles.cancelBtn}
                  onPress={() => setDeleteUid(null)}
                  disabled={deleteBusy}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.dangerBtn,
                    (deleteText !== "DELETE" || deleteBusy) &&
                      styles.btnDisabled,
                  ]}
                  disabled={deleteText !== "DELETE" || deleteBusy}
                  onPress={runDelete}
                >
                  {deleteBusy ? (
                    <ActivityIndicator color={theme.onPrimary} size="small" />
                  ) : (
                    <Text style={styles.primaryBtnText}>
                      Delete Permanently
                    </Text>
                  )}
                </Pressable>
              </View>
            </View>
          </View>
        )}
      </Modal>

      {/* Toast */}
      {toast ? (
        <View style={[styles.toast, { bottom: insets.bottom + 70 }]}>
          <Ionicons name="checkmark-circle" size={16} color="#16A34A" />
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      ) : null}
    </View>
  );
}

// ─── Student context (support modal) ────────────────────────────────────────

/**
 * Minimal, non-sensitive context for triage. Assessment-derived risk and
 * administrative support metadata only — no journal content is shown here.
 */
function StudentContext({ student }: { student?: StudentManagementEntry }) {
  const { theme } = useMindCareTheme();
  const styles = createStyles(theme);
  const [showConcernInfo, setShowConcernInfo] = useState(false);
  if (!student) {
    return <Text style={styles.emptyText}>No student selected.</Text>;
  }
  const risk = (student.latestRiskLevel ?? "low") as RiskLevel;
  const support = student.supportStatus ?? "no_action";
  const lastAssessed = daysSince(student.latestAssessmentDate);

  return (
    <View style={styles.studentContextCard}>
      <View style={styles.studentContextHead}>
        <View style={styles.avatarLarge}>
          <Text style={styles.avatarTextLarge}>{initials(student.name)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.reviewName} numberOfLines={1}>
            {student.name}
          </Text>
          <Text style={styles.reviewSub} numberOfLines={1}>
            {student.schoolId} · {student.department || "—"} ·{" "}
            {student.yearLevel || "—"}
          </Text>
        </View>
      </View>
      <View style={styles.contextChips}>
        <View style={styles.contextChip}>
          <Text style={styles.contextChipLabel}>Assessment</Text>
          <Text style={styles.contextChipValue}>
            {lastAssessed === null
              ? "None"
              : lastAssessed === 0
                ? "Today"
                : `${lastAssessed}d ago`}
          </Text>
        </View>
        <Pressable
          style={styles.contextChip}
          onPress={() => setShowConcernInfo((v) => !v)}
        >
          <Text style={styles.contextChipLabel}>
            Concern
            <Ionicons
              name="information-circle-outline"
              size={12}
              color="#6B7280"
            />
          </Text>
          <Text
            style={[
              styles.contextChipValue,
              { color: RISK_COLORS(theme)[risk] },
            ]}
          >
            ● {CONCERN_LABELS[risk]}
          </Text>
        </Pressable>
        <View style={styles.contextChip}>
          <Text style={styles.contextChipLabel}>Support</Text>
          <Text style={styles.contextChipValue} numberOfLines={1}>
            {SUPPORT_LABELS[support]}
          </Text>
        </View>
        <View style={styles.contextChip}>
          <Text style={styles.contextChipLabel}>Follow-up</Text>
          <Text style={styles.contextChipValue}>
            {formatDate(student.followUpDate)}
          </Text>
        </View>
      </View>
      {showConcernInfo ? (
        <Text style={styles.concernHint}>
          Assessment-derived indicator. Not a clinical diagnosis.
        </Text>
      ) : null}
    </View>
  );
}

// ─── Support history (append-only) ──────────────────────────────────────────

function SupportHistory({ workflows }: { workflows: SupportWorkflow[] }) {
  const { theme } = useMindCareTheme();
  const styles = createStyles(theme);
  if (workflows.length === 0) return null;
  const sorted = [...workflows].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );
  return (
    <View>
      <Text style={styles.fieldLabel}>Support history</Text>
      <View style={styles.supportHistoryBox}>
        {sorted.map((w) => (
          <View key={w.id} style={styles.supportHistoryRow}>
            <View style={styles.supportHistoryDot} />
            <View style={{ flex: 1 }}>
              <Text style={styles.supportHistoryTitle}>
                {SUPPORT_ACTION_LABELS[w.actionType]}
              </Text>
              <Text style={styles.supportHistoryMeta}>
                {formatDateTime(w.createdAt)} ·{" "}
                {w.status === "open"
                  ? "In progress"
                  : w.status === "completed"
                    ? "Completed"
                    : "Closed"}
                {w.followUpDate
                  ? ` · Follow-up ${formatDate(w.followUpDate)}`
                  : ""}
              </Text>
              <Text style={styles.supportHistoryMeta}>
                Recorded by: {w.createdByName ?? "Administrator"}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Student profile modal ──────────────────────────────────────────────────

function StudentProfileModal({
  uid,
  student,
  workflows,
  onClose,
  onOpenAudit,
  onOpenWorkflow,
  onChangeStatus,
  onCompleteWf,
}: {
  uid: string | null;
  student?: StudentManagementEntry;
  workflows: SupportWorkflow[];
  onClose: () => void;
  onOpenAudit: (uid: string) => void;
  onOpenWorkflow: (uid: string) => void;
  onChangeStatus: (uid: string) => void;
  onCompleteWf: (wf: SupportWorkflow) => void;
}) {
  const { theme } = useMindCareTheme();
  const styles = createStyles(theme);
  const [deptName, setDeptName] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    getDoc(doc(db, "users", uid))
      .then((snap) => {
        if (cancelled) return;
        if (snap.exists()) {
          const d = snap.data();
          const dref = d.departmentRef;
          if (
            dref &&
            typeof dref === "string" &&
            dref.startsWith("departments/")
          ) {
            getDoc(doc(db, "departments", dref.split("/")[1]))
              .then((dsnap) => {
                if (!cancelled) {
                  setDeptName(
                    dsnap.exists() ? String(dsnap.data().name ?? "") : null,
                  );
                }
              })
              .catch(() => {
                if (!cancelled) setDeptName(null);
              });
          } else if (!cancelled) {
            setDeptName(null);
          }
        }
      })
      .catch(() => {
        if (!cancelled) setDeptName(null);
      });
    return () => {
      cancelled = true;
    };
  }, [uid]);

  if (!uid || !student) return null;

  const risk = (student.latestRiskLevel ?? "low") as RiskLevel;
  const support = student.supportStatus ?? "no_action";
  const moodSummary = Object.entries(student.moodCounts || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.wizardSheet, { maxHeight: "90%" }]}>
          <LinearGradient
            colors={theme.headerGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.profileHeader}
          >
            <View style={styles.profileAvatar}>
              <Text style={styles.profileAvatarText}>
                {initials(student.name)}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.profileName}>{student.name}</Text>
              <Text style={styles.profileSub}>{student.schoolId}</Text>
              <Text style={styles.profileSub}>{student.email ?? ""}</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={theme.onPrimary} />
            </Pressable>
          </LinearGradient>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.profileBody}
          >
            <ProfileSection title="Student Overview" icon="person-outline">
              <ProfileRow
                label="Department"
                value={(deptName ?? student.department) || "—"}
              />
              <ProfileRow label="Year Level" value={student.yearLevel || "—"} />
              <ProfileRow
                label="Special Needs"
                value={
                  student.isLSN
                    ? (student.specialNeedsType ?? student.lsnCategory ?? "LSN")
                    : "No"
                }
              />
            </ProfileSection>

            <ProfileSection
              title="Status & Academic"
              icon="shield-checkmark-outline"
            >
              <View style={styles.profileBadges}>
                <Badge
                  label={LIFECYCLE_LABELS[student.status ?? "active"]}
                  color={LIFECYCLE_COLORS[student.status ?? "active"]}
                />
                <Badge
                  label={SUPPORT_LABELS[support]}
                  color={SUPPORT_COLORS[support]}
                />
              </View>
              <ProfileRow
                label="Assigned admin"
                value={
                  student.supportAssignedName ??
                  student.supportAssignedTo ??
                  "—"
                }
              />
              <ProfileRow
                label="Follow-up"
                value={formatDate(student.followUpDate)}
              />
              <ProfileRow
                label="Last updated"
                value={formatDateTime(student.updatedAt)}
              />
            </ProfileSection>

            <ProfileSection title="Wellness Indicators" icon="pulse-outline">
              <View style={styles.profileBadges}>
                <Badge
                  label={`Risk: ${RISK_LABELS[risk]}`}
                  color={RISK_COLORS(theme)[risk]}
                />
              </View>
              <ProfileRow
                label="Last assessment"
                value={
                  student.latestAssessmentDate
                    ? `${formatDate(student.latestAssessmentDate)}${student.latestTotalScore !== undefined ? ` · Score ${student.latestTotalScore}` : ""}`
                    : "None"
                }
              />
              <ProfileRow
                label="Assessments"
                value={String(student.assessmentsCount)}
              />
              <ProfileRow
                label="Journals"
                value={String(student.journalCount)}
              />
              <ProfileRow
                label="Latest mood"
                value={student.latestJournalMood ?? "—"}
              />
              {moodSummary.length > 0 ? (
                <ProfileRow
                  label="Mood mix"
                  value={moodSummary.map(([m, c]) => `${m} (${c})`).join(", ")}
                />
              ) : null}
            </ProfileSection>

            <ProfileSection
              title="Support & Follow-ups"
              icon="git-network-outline"
              action={
                <Pressable
                  style={styles.sectionActionBtn}
                  onPress={() => onOpenWorkflow(student.uid)}
                >
                  <Ionicons name="add" size={16} color="#6D28D9" />
                  <Text style={styles.sectionActionText}>New workflow</Text>
                </Pressable>
              }
            >
              {workflows.length === 0 ? (
                <Text style={styles.emptyText}>No workflows yet.</Text>
              ) : (
                workflows.map((w) => (
                  <View key={w.id} style={styles.wfCard}>
                    <View style={styles.wfCardHead}>
                      <Text style={styles.wfCardTitle}>
                        {SUPPORT_ACTION_LABELS[w.actionType]}
                      </Text>
                      <Badge
                        label={w.status}
                        color={
                          w.status === "open"
                            ? "#2563EB"
                            : w.status === "completed"
                              ? "#16A34A"
                              : "#64748B"
                        }
                      />
                    </View>
                    <Text style={styles.wfCardMeta}>
                      Assigned: {w.assignedToName ?? w.assignedTo ?? "—"} ·
                      Follow-up: {formatDate(w.followUpDate)}
                    </Text>
                    {w.reason ? (
                      <Text style={styles.wfCardNote}>{w.reason}</Text>
                    ) : null}
                    {w.status === "open" ? (
                      <Pressable
                        style={styles.wfCompleteBtn}
                        onPress={() => onCompleteWf(w)}
                      >
                        <Text style={styles.wfCompleteText}>Mark complete</Text>
                      </Pressable>
                    ) : null}
                  </View>
                ))
              )}
            </ProfileSection>

            <ProfileSection
              title="Administrative Notes"
              icon="document-text-outline"
            >
              <ProfileRow
                label="Created workflow"
                value={
                  workflows.length
                    ? formatDateTime(workflows[0]?.createdAt)
                    : "—"
                }
              />
            </ProfileSection>

            <View style={styles.profileActions}>
              <Pressable
                style={styles.outlineBtn}
                onPress={() => onChangeStatus(student.uid)}
              >
                <Ionicons
                  name="swap-horizontal-outline"
                  size={16}
                  color="#6D28D9"
                />
                <Text style={styles.outlineBtnText}>Change Status</Text>
              </Pressable>
              <Pressable
                style={styles.outlineBtn}
                onPress={() => onOpenAudit(student.uid)}
              >
                <Ionicons
                  name="document-text-outline"
                  size={16}
                  color="#6D28D9"
                />
                <Text style={styles.outlineBtnText}>View audit trail</Text>
              </Pressable>
            </View>
            <View style={styles.profileActions}>
              <Pressable
                style={styles.outlineBtn}
                onPress={() =>
                  router.push({
                    pathname: "/(admin)/student-journals",
                    params: {
                      studentId: student.uid,
                      studentName: student.name,
                    },
                  })
                }
              >
                <Ionicons name="journal-outline" size={16} color="#6D28D9" />
                <Text style={styles.outlineBtnText}>Full journal history</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function ProfileSection({
  title,
  icon,
  children,
  action,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  const { theme } = useMindCareTheme();
  const styles = createStyles(theme);
  return (
    <View style={styles.profileSection}>
      <View style={styles.profileSectionHead}>
        <Ionicons name={icon} size={16} color={theme.primary} />
        <Text style={styles.profileSectionTitle}>{title}</Text>
        {action ?? null}
      </View>
      {children}
    </View>
  );
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  const { theme } = useMindCareTheme();
  const styles = createStyles(theme);
  return (
    <View style={styles.profileRow}>
      <Text style={styles.profileRowLabel}>{label}</Text>
      <Text style={styles.profileRowValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const createStyles = (theme: MindCareTheme) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#F5F4FA",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F5F4FA",
  },
  centerText: {
    marginTop: 12,
    fontSize: 14,
    color: "#6B7280",
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    color: theme.onPrimary,
    fontSize: 22,
    fontWeight: "900",
  },
  headerSubtitle: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 13,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: "row",
    gap: 8,
  },
  headerBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: theme.card,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
  },
  headerBtnText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#6D28D9",
  },
  superBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
    backgroundColor: "rgba(255,255,255,0.14)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  superBannerText: {
    color: "#E9D5FF",
    fontSize: 12,
    fontWeight: "700",
  },
  content: {
    padding: 14,
    gap: 12,
  },
  errorCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
    borderWidth: 1,
    padding: 12,
    borderRadius: 12,
  },
  errorText: {
    flex: 1,
    color: "#B91C1C",
    fontSize: 13,
  },
  retryBtn: {
    backgroundColor: "#B91C1C",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  retryText: {
    color: theme.onPrimary,
    fontSize: 12,
    fontWeight: "800",
  },
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  kpiCard: {
    flexBasis: "30%",
    flexGrow: 1,
    backgroundColor: theme.card,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#EEECF7",
    minWidth: 100,
  },
  kpiIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  kpiValue: {
    fontSize: 20,
    fontWeight: "900",
    color: "#1E1B4B",
  },
  kpiLabel: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 2,
  },
  section: {
    backgroundColor: theme.card,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#EEECF7",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1E1B4B",
  },
  sectionSubtitle: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  sectionCount: {
    fontSize: 12,
    fontWeight: "700",
    color: "#8A63D2",
    backgroundColor: "#F3EEFB",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  // Triage queue (wide table)
  triageHead: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#FAF9FE",
    borderBottomWidth: 1,
    borderBottomColor: "#EEECF7",
  },
  triageHeadCell: {
    fontSize: 11,
    fontWeight: "700",
    color: "#6B7280",
  },
  triageColPriority: {
    width: 76,
  },
  triageColStudent: {
    flex: 1.6,
  },
  triageColRisk: {
    flex: 1.2,
  },
  triageColSupport: {
    width: 132,
  },
  triageColActions: {
    width: 206,
  },
  triageRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F2FA",
  },
  triageRowHigh: {
    backgroundColor: "#FFF5F6",
  },
  triageRiskText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1E1B4B",
  },
  triageMetaText: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  // Triage queue (compact cards)
  triageCard: {
    backgroundColor: theme.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#EEECF7",
    padding: 12,
  },
  triageCardHigh: {
    borderColor: "#FDA4AF",
    backgroundColor: "#FFF8F9",
  },
  triageCardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  triageReasonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  triageReason: {
    flex: 1,
    fontSize: 12,
    color: "#4B5563",
  },
  triageActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  triageActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderColor: "#D9CFF2",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: theme.card,
  },
  triageActionPrimary: {
    backgroundColor: "#6D28D9",
    borderColor: "#6D28D9",
  },
  triageActionText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#6D28D9",
  },
  // Always-visible filter bar
  filterBar: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  searchRowCompact: {
    flex: 1,
    minWidth: 180,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F5F4FA",
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 40,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#111827",
  },
  statusSelect: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 40,
    backgroundColor: theme.card,
    maxWidth: 150,
  },
  statusSelectText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#4B5563",
  },
  filterBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "#D9CFF2",
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 40,
    backgroundColor: "#F5F0FF",
  },
  filterBtnActive: {
    backgroundColor: "#6D28D9",
    borderColor: "#6D28D9",
  },
  filterBtnText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#6D28D9",
  },
  filterBtnTextActive: {
    color: theme.onPrimary,
  },
  clearBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    height: 40,
    borderRadius: 10,
  },
  clearBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#6B7280",
  },
  // Active filter summary chips
  activeFilterWrap: {
    marginTop: 10,
  },
  activeFilterLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6B7280",
    marginBottom: 6,
  },
  activeFilterChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  activeFilterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F5F0FF",
    borderWidth: 1,
    borderColor: "#E1D6F7",
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  activeFilterChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6D28D9",
  },
  // Empty state clear action
  emptyClearBtn: {
    marginTop: 14,
    backgroundColor: "#6D28D9",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
  emptyClearText: {
    fontSize: 13,
    fontWeight: "800",
    color: theme.onPrimary,
  },
  // Advanced filter groups (drawer/modal)
  advancedBody: {
    paddingVertical: 4,
    paddingBottom: 20,
  },
  filterGroup: {
    marginBottom: 16,
  },
  filterGroupTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#374151",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 8,
  },
  filterGroupChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  filterOptChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: theme.card,
  },
  filterOptChipActive: {
    borderColor: "#6D28D9",
    backgroundColor: "#6D28D9",
  },
  filterOptChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#4B5563",
  },
  filterOptChipTextActive: {
    color: theme.onPrimary,
  },
  lsnRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  lsnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#4B5563",
  },
  // Assessment date range
  rangeRow: {
    flexDirection: "row",
    gap: 8,
  },
  rangeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#F9FAFB",
  },
  rangeBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#111827",
  },
  rangeClear: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6D28D9",
    marginTop: 8,
  },
  tableCard: {
    backgroundColor: theme.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#EEECF7",
    overflow: "hidden",
  },
  tableHead: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#FAF9FE",
    borderBottomWidth: 1,
    borderBottomColor: "#EEECF7",
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F2FA",
  },
  tableRowSelected: {
    backgroundColor: "#F5F0FF",
  },
  cellCheck: {
    width: 30,
  },
  colStudent: {
    flex: 1.6,
  },
  colDept: {
    flex: 1,
  },
  colYear: {
    width: 70,
  },
  colStatus: {
    width: 92,
  },
  colWell: {
    width: 78,
  },
  colNum: {
    width: 52,
    textAlign: "center",
  },
  colSupport: {
    width: 128,
  },
  colActivity: {
    width: 100,
  },
  colActions: {
    width: 36,
    alignItems: "flex-end",
  },
  cellText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#4B5563",
  },
  studentCell: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#EDE9FE",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#6D28D9",
  },
  nameText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#1E1B4B",
  },
  subText: {
    fontSize: 11,
    color: "#6B7280",
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  moreBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F5F4FA",
  },
  cardList: {
    gap: 10,
  },
  studentCard: {
    backgroundColor: theme.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#EEECF7",
    padding: 12,
  },
  studentCardSelected: {
    borderColor: "#8A63D2",
    backgroundColor: "#FBF7FF",
  },
  studentCardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  studentCardMeta: {
    marginTop: 8,
    gap: 2,
  },
  cardMetaText: {
    fontSize: 12,
    color: "#6B7280",
  },
  studentCardBadges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 10,
    alignItems: "center",
  },
  cardActivity: {
    fontSize: 11,
    color: "#9CA3AF",
    marginLeft: "auto",
  },
  emptyCard: {
    alignItems: "center",
    paddingVertical: 40,
    backgroundColor: theme.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#EEECF7",
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1E1B4B",
    marginTop: 8,
  },
  emptyText: {
    fontSize: 13,
    color: "#9CA3AF",
    marginTop: 4,
    textAlign: "center",
  },
  pager: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
  },
  pagerBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: theme.card,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#EEECF7",
  },
  pagerBtnDisabled: {
    opacity: 0.5,
  },
  pagerText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#4B5563",
  },
  bulkBar: {
    position: "absolute",
    left: 12,
    right: 12,
    backgroundColor: theme.card,
    borderRadius: 16,
    padding: 12,
    paddingTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: "#DDD3F1",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -2 },
    elevation: 8,
  },
  bulkCount: {
    fontSize: 13,
    fontWeight: "800",
    color: "#6D28D9",
  },
  bulkActions: {
    gap: 8,
  },
  bulkBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#F5F0FF",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
  },
  bulkBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6D28D9",
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(17,24,39,0.55)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  sheet: {
    width: "100%",
    maxWidth: 440,
    backgroundColor: theme.card,
    borderRadius: 18,
    padding: 16,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1E1B4B",
  },
  sheetSubtitle: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  sheetBody: {
    fontSize: 13,
    color: "#4B5563",
    lineHeight: 19,
    marginTop: 8,
  },
  warnIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  sheetFooter: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  cancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F3F4F6",
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#4B5563",
  },
  primaryBtn: {
    flex: 2,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#6D28D9",
  },
  dangerBtn: {
    flex: 2,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#B91C1C",
  },
  btnDisabled: {
    opacity: 0.45,
  },
  primaryBtnText: {
    fontSize: 14,
    fontWeight: "800",
    color: theme.onPrimary,
  },
  primaryBtnDisabled: {
    backgroundColor: "#E6E1F2",
  },
  primaryBtnTextDisabled: {
    color: "#9A94B0",
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 10,
    marginBottom: 4,
  },
  optionRowActive: {
    backgroundColor: "#F5F0FF",
  },
  optionText: {
    fontSize: 14,
    color: "#374151",
  },
  optionTextActive: {
    color: "#6D28D9",
    fontWeight: "800",
  },
  reasonInput: {
    minHeight: 64,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    padding: 12,
    fontSize: 13,
    color: "#111827",
    textAlignVertical: "top",
    marginTop: 10,
    backgroundColor: "#F9FAFB",
  },
  menuHead: {
    marginBottom: 6,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 11,
    paddingHorizontal: 6,
    borderRadius: 8,
  },
  menuItemText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#4B5563",
  },
  wizardSheet: {
    width: "100%",
    maxWidth: 480,
    backgroundColor: theme.card,
    borderRadius: 20,
    padding: 16,
  },
  wizardHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  wizardBody: {
    paddingBottom: 8,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: "#374151",
    marginTop: 12,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  fieldHint: {
    fontSize: 11,
    color: "#9CA3AF",
    marginTop: -4,
    marginBottom: 4,
  },
  groupHeader: {
    fontSize: 11,
    fontWeight: "800",
    color: "#6B7280",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 12,
    marginBottom: 6,
  },
  pickerPlaceholder: {
    fontSize: 13,
    color: "#9CA3AF",
  },
  wfReason: {
    minHeight: 80,
  },
  quickDates: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  quickDateBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: "#F9FAFB",
  },
  quickDateBtnActive: {
    borderColor: "#6D28D9",
    backgroundColor: "#F5F0FF",
  },
  quickDateText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#4B5563",
  },
  quickDateTextActive: {
    color: "#6D28D9",
  },
  quickDateBtnCustom: {
    // This style was missing, added to fix TypeScript error.
    // It can be customized further if needed.
  },
  followUpValue: {
    fontSize: 13,
    fontWeight: "700",
    color: "#6D28D9",
    marginTop: 8,
  },
  timePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#F9FAFB",
  },
  timePillActive: {
    borderColor: "#6D28D9",
    backgroundColor: "#F5F0FF",
  },
  timePillText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#4B5563",
  },
  timePillTextActive: {
    color: "#6D28D9",
  },
  timePillTextPlaceholder: {
    color: "#9CA3AF",
  },
  assigneeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  assigneeChip: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: theme.card,
  },
  assigneeChipActive: {
    borderColor: "#6D28D9",
    backgroundColor: "#F5F0FF",
  },
  assigneeChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#4B5563",
  },
  assigneeChipTextActive: {
    color: "#6D28D9",
  },
  tagChipInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  // Bulk support note
  bulkNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F5F0FF",
    borderRadius: 10,
    padding: 12,
  },
  bulkNoteText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    color: "#6D28D9",
  },
  // Support action radio rows
  wfActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 6,
    backgroundColor: theme.card,
  },
  wfActionRowActive: {
    borderColor: "#6D28D9",
    backgroundColor: "#F5F0FF",
  },
  wfActionRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    alignItems: "center",
    justifyContent: "center",
  },
  wfActionRadioActive: {
    borderColor: "#6D28D9",
  },
  wfActionRadioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#6D28D9",
  },
  wfActionLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
  },
  wfActionLabelActive: {
    color: "#6D28D9",
    fontWeight: "800",
  },
  // Student context card (support modal)
  studentContextCard: {
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#EEECF7",
  },
  studentContextHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  avatarLarge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#6D28D9",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarTextLarge: {
    color: theme.onPrimary,
    fontSize: 15,
    fontWeight: "800",
  },
  reviewName: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1E1B4B",
  },
  reviewSub: {
    fontSize: 12,
    color: "#6B7280",
  },
  // Compact safety-context strip (support modal)
  contextChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 10,
  },
  contextChip: {
    flexGrow: 1,
    flexBasis: "45%",
    backgroundColor: theme.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#EEECF7",
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  contextChipLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#6B7280",
    textTransform: "uppercase",
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  contextChipValue: {
    fontSize: 13,
    fontWeight: "800",
    color: "#1E1B4B",
  },
  concernHint: {
    fontSize: 11,
    color: "#6B7280",
    fontStyle: "italic",
    marginTop: 8,
  },
  // Support summary (pre-save recap)
  summaryBox: {
    backgroundColor: "#F5F0FF",
    borderWidth: 1,
    borderColor: "#E9DCFC",
    borderRadius: 12,
    padding: 12,
    marginTop: 14,
  },
  summaryTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: "#6D28D9",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 5,
  },
  summaryText: {
    flex: 1,
    fontSize: 12,
    color: "#4B5563",
    lineHeight: 17,
  },
  summaryNotify: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#E9DCFC",
  },
  summaryNotifyText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "700",
    color: "#6B7280",
  },
  // Support history (append-only)
  supportHistoryBox: {
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  supportHistoryRow: {
    flexDirection: "row",
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#EEF0F4",
  },
  supportHistoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#8A63D2",
    marginTop: 6,
  },
  supportHistoryTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#1E1B4B",
  },
  supportHistoryMeta: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 1,
  },
  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  profileAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  profileAvatarText: {
    color: theme.onPrimary,
    fontSize: 16,
    fontWeight: "800",
  },
  profileName: {
    color: theme.onPrimary,
    fontSize: 17,
    fontWeight: "900",
  },
  profileSub: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 12,
  },
  profileBody: {
    padding: 14,
    paddingBottom: 28,
  },
  profileSection: {
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#EEECF7",
    borderRadius: 12,
    padding: 12,
  },
  profileSectionHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  profileSectionTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#1E1B4B",
    flex: 1,
  },
  profileBadges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 8,
  },
  profileRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 5,
  },
  profileRowLabel: {
    fontSize: 12,
    color: "#6B7280",
    width: 110,
  },
  profileRowValue: {
    flex: 1,
    fontSize: 12,
    fontWeight: "700",
    color: "#1E1B4B",
    textAlign: "right",
  },
  sectionActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F5F0FF",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  sectionActionText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#6D28D9",
  },
  wfCard: {
    borderWidth: 1,
    borderColor: "#EEECF7",
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  wfCardHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  wfCardTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#1E1B4B",
    flex: 1,
  },
  wfCardMeta: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 4,
  },
  wfCardNote: {
    fontSize: 12,
    color: "#4B5563",
    marginTop: 6,
    fontStyle: "italic",
  },
  wfCompleteBtn: {
    marginTop: 8,
    alignSelf: "flex-start",
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  wfCompleteText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#15803D",
  },
  profileActions: {
    flexDirection: "row",
    gap: 8,
  },
  outlineBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "#D9CFF2",
    borderRadius: 12,
    paddingVertical: 12,
  },
  outlineBtnText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#6D28D9",
  },
  auditLoading: {
    paddingVertical: 40,
    alignItems: "center",
  },
  auditEmpty: {
    paddingVertical: 40,
    alignItems: "center",
  },
  auditList: {
    paddingTop: 8,
  },
  auditRow: {
    flexDirection: "row",
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F2FA",
  },
  auditDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#8A63D2",
    marginTop: 6,
  },
  auditAction: {
    fontSize: 13,
    fontWeight: "800",
    color: "#1E1B4B",
  },
  auditMeta: {
    fontSize: 12,
    color: "#4B5563",
    marginTop: 2,
  },
  auditReason: {
    fontSize: 12,
    color: "#6D28D9",
    fontStyle: "italic",
    marginTop: 2,
  },
  auditBy: {
    fontSize: 11,
    color: "#9CA3AF",
    marginTop: 4,
  },
  toast: {
    position: "absolute",
    left: 24,
    right: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: theme.card,
    borderRadius: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#DCE7F3",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -2 },
    elevation: 8,
  },
  toastText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#1E1B4B",
  },
});
