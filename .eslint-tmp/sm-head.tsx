import { API_URL, isSuperAdminEmail } from "@/backend/config";
import MultiSelectModal from "@/components/MultiSelectModal";
import { auth, db } from "@/constants/firebase";
import { useAuth } from "@/hooks/AuthContext";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
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
import { doc, getDoc } from "firebase/firestore";
import {
  applyStudentFilters,
  buildAttentionItems,
  completeSupportWorkflow,
  countAttentionStudents,
  createSupportWorkflow,
  fetchAdminDirectory,
  fetchStudentAuditLogs,
  listenForStudentManagementData,
  permanentlyDeleteStudent,
  updateStudentDepartment,
  updateStudentStatus,
  updateStudentYearLevel,
  type ActionContext,
  type StudentAuditEntry,
  type StudentManagementEntry,
  type SupportWorkflow,
} from "@/services/studentManagementService";
import {
  ACTIVE_SUPPORT_STATUSES,
  LIFECYCLE_COLORS,
  LIFECYCLE_LABELS,
  LIFECYCLE_STATUSES,
  SUPPORT_ACTION_LABELS,
  SUPPORT_ACTIONS,
  SUPPORT_COLORS,
  SUPPORT_LABELS,
  SUPPORT_STATUSES,
  type LifecycleStatus,
  type SupportActionType,
  type SupportStatus,
} from "@/services/studentTypes";

type RiskLevel = "low" | "normal" | "high";

const RISK_LABELS: Record<RiskLevel, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
};

const RISK_COLORS: Record<RiskLevel, string> = {
  low: "#16A34A",
  normal: "#D97706",
  high: "#DB2777",
};

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
  if (!d) return "ΓÇö";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(d?: Date | null): string {
  if (!d) return "ΓÇö";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }) +
    " " +
    d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
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

// ΓöÇΓöÇΓöÇ Small UI pieces ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

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

function FilterChip({
  label,
  active,
  onPress,
  color,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  color?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active && { borderColor: color ?? "#8A63D2", backgroundColor: `${color ?? "#8A63D2"}14` }]}
    >
      <Text
        style={[
          styles.chipText,
          active && { color: color ?? "#6D28D9", fontWeight: "800" },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// ΓöÇΓöÇΓöÇ Main screen ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

export default function StudentManagementScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const isWide = screenWidth >= 900;

  const [entries, setEntries] = useState<StudentManagementEntry[]>([]);
  const [workflows, setWorkflows] = useState<SupportWorkflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [admins, setAdmins] = useState<{ uid: string; name: string }[]>([]);

  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("All");
  const [yearFilter, setYearFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("Active");
  const [riskFilter, setRiskFilter] = useState("All");
  const [supportFilter, setSupportFilter] = useState("All");
  const [activityFilter, setActivityFilter] = useState("All");
  const [lsnOnly, setLsnOnly] = useState(false);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);

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

  // Workflow wizard
  const [wfOpen, setWfOpen] = useState(false);
  const [wfBulk, setWfBulk] = useState(false);
  const [wfTarget, setWfTarget] = useState<string | null>(null);
  const [wfStep, setWfStep] = useState(1);
  const [wfAction, setWfAction] = useState<SupportActionType | null>(null);
  const [wfActionPicker, setWfActionPicker] = useState(false);
  const [wfReason, setWfReason] = useState("");
  const [wfNote, setWfNote] = useState("");
  const [wfAssignee, setWfAssignee] = useState("");
  const [wfFollowUp, setWfFollowUp] = useState<Date | null>(null);
  const [wfSaving, setWfSaving] = useState(false);
  const [wfError, setWfError] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

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

  const params = useLocalSearchParams<{
    department?: string;
    yearLevel?: string;
    status?: string;
    riskLevel?: string;
    supportStatus?: string;
    isLSN?: string;
  }>();

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

  // Deep-link default filter: Active status unless overridden
  useEffect(() => {
    if (params.status) setStatusFilter(params.status);
    else setStatusFilter("Active");
    if (params.department) setDeptFilter(params.department);
    if (params.yearLevel) setYearFilter(params.yearLevel);
    if (params.riskLevel) setRiskFilter(params.riskLevel);
    if (params.supportStatus) setSupportFilter(params.supportStatus);
    if (params.isLSN === "true") setLsnOnly(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Real-time data
  useEffect(() => {
    if (!user) return;
    setLoading(true);

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

  // Reset pagination when filters change
  useEffect(() => {
    setPage(1);
  }, [search, deptFilter, yearFilter, statusFilter, riskFilter, supportFilter, activityFilter, lsnOnly]);

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
        isLSNOnly: lsnOnly,
        activity: activityFilter,
      }),
    [entries, search, deptFilter, yearFilter, statusFilter, riskFilter, supportFilter, lsnOnly, activityFilter],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageStudents = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page],
  );

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
      attention: countAttentionStudents(entries),
    };
  }, [entries]);

  const attentionItems = useMemo(() => buildAttentionItems(entries), [entries]);

  const entryById = useCallback(
    (uid: string) => entries.find((e) => e.uid === uid),
    [entries],
  );

  // ΓöÇΓöÇΓöÇ Selection helpers ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

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

  // ΓöÇΓöÇΓöÇ Actions ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

  const openEdit = (kind: "status" | "department" | "year", targets: string[]) => {
    setEditModal({ kind, targets });
    setEditValue("");
    setEditReason("");
    setEditError(null);
  };

  const applyEdit = async () => {
    if (!editModal) return;
    if (!editValue) return;
    if (editModal.kind === "status" && !editReason.trim()) {
      setEditError("Please provide a reason for the status change.");
      return;
    }
    setEditBusy(true);
    setEditError(null);
    const context: ActionContext = { actor, reason: editReason.trim() || undefined };
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

  const openConfirm = (kind: "archive" | "restore" | "graduate" | "restrict", targets: string[]) => {
    setConfirm({ kind, targets });
    setConfirmError(null);
  };

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

  const openWorkflow = (targets: string[]) => {
    setWfBulk(targets.length > 1);
    setWfTarget(targets[0] ?? null);
    setWfStep(1);
    setWfAction(null);
    setWfNote("");
    setWfFollowUp(null);
    setWfError(null);
    setWfAssignee(user?.uid ?? "");
    const first = entryById(targets[0]);
    if (first) {
      const reasons: string[] = [];
      if (first.latestRiskLevel === "high") reasons.push("Repeated elevated concern indicators were recorded.");
      if ((first.supportStatus ?? "no_action") === "outreach_recommended") reasons.push("Outreach was recommended after a review of indicators.");
      if (first.assessmentsCount === 0 || first.latestAssessmentDate === undefined) reasons.push("No assessment has been recorded yet.");
      if (
        first.followUpDate &&
        first.followUpDate.getTime() < Date.now()
      ) {
        reasons.push("A scheduled follow-up is overdue.");
      }
      setWfReason(reasons.length ? reasons.join(" ") : "Standard check-in to review current wellbeing.");
    } else {
      setWfReason("");
    }
    setWfOpen(true);
  };

  const saveWorkflow = async () => {
    if (!wfAction) return;
    const targets = wfBulk
      ? Array.from(selected)
      : wfTarget
        ? [wfTarget]
        : [];
    if (targets.length === 0) {
      setWfError("No student selected.");
      return;
    }
    if (wfAction === "schedule_follow_up" && !wfFollowUp) {
      setWfError("Please select a follow-up date.");
      return;
    }
    setWfSaving(true);
    setWfError(null);
    const assigneeName = admins.find((a) => a.uid === wfAssignee)?.name ?? "Administrator";
    try {
      for (const uid of targets) {
        const s = entryById(uid);
        if (!s) continue;
        await createSupportWorkflow({
          studentId: uid,
          studentName: s.name,
          department: s.department,
          actionType: wfAction,
          reason: wfReason.trim() || "Support workflow",
          note: wfNote.trim() || undefined,
          assignedTo: wfAssignee || user?.uid || "",
          assignedToName: wfAssignee ? assigneeName : actor?.name,
          followUpDate: wfFollowUp,
          createdBy: user?.uid || "",
          createdByName: actor?.name,
        });
      }
      setWfOpen(false);
      clearSelection();
      showToast("Support workflow saved.");
    } catch {
      setWfError("Could not save the workflow. Please try again.");
    } finally {
      setWfSaving(false);
    }
  };

  const openAudit = async (scope: "all" | string) => {
    setAuditScope(scope);
    setAuditVisible(true);
    setAuditLoading(true);
    try {
      const logs = await fetchStudentAuditLogs(200);
      setAuditLogs(
        scope === "all" ? logs : logs.filter((l) => l.targetStudentId === scope),
      );
    } catch {
      setAuditLogs([]);
    } finally {
      setAuditLoading(false);
    }
  };

  const openDelete = (uid: string) => {
    setDeleteUid(uid);
    setDeleteText("");
    setDeleteError(null);
  };

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
      await completeSupportWorkflow(wf.id, { actor });
      showToast("Workflow marked complete.");
    } catch {
      showToast("Could not update the workflow.");
    }
  };

  // ΓöÇΓöÇΓöÇ Row render helpers ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

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
          {s.schoolId} ┬╖ {s.email ?? "No email"}
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
    return <Badge label={RISK_LABELS[rl]} color={RISK_COLORS[rl]} />;
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

  const rowMenuActions = (s?: StudentManagementEntry) => {
    if (!s) return [];
    const st = s.status ?? "active";
    const actions: { key: string; label: string; icon: keyof typeof Ionicons.glyphMap; danger?: boolean; onPress: () => void }[] = [
      { key: "profile", label: "View Profile", icon: "person-circle-outline", onPress: () => router.push({ pathname: "./student-detail", params: { uid: s.uid } }) },
      { key: "workflow", label: "Create / View Workflow", icon: "git-network-outline", onPress: () => openWorkflow([s.uid]) },
      { key: "status", label: "Change Status", icon: "swap-horizontal-outline", onPress: () => openEdit("status", [s.uid]) },
      { key: "dept", label: "Edit Department", icon: "business-outline", onPress: () => openEdit("department", [s.uid]) },
      { key: "year", label: "Edit Year Level", icon: "school-outline", onPress: () => openEdit("year", [s.uid]) },
    ];
    if (st !== "archived") {
      actions.push({ key: "archive", label: "Archive", icon: "archive-outline", onPress: () => openConfirm("archive", [s.uid]) });
    } else {
      actions.push({ key: "restore", label: "Restore to Active", icon: "refresh-outline", onPress: () => openConfirm("restore", [s.uid]) });
    }
    if (st !== "restricted") {
      actions.push({ key: "restrict", label: "Restrict Login Access", icon: "lock-closed-outline", danger: true, onPress: () => openConfirm("restrict", [s.uid]) });
    }
    if (st !== "graduated") {
      actions.push({ key: "graduate", label: "Mark as Graduated", icon: "ribbon-outline", onPress: () => openConfirm("graduate", [s.uid]) });
    }
    actions.push({ key: "audit", label: "View Audit Trail", icon: "document-text-outline", onPress: () => openAudit(s.uid) });
    if (isSuperAdmin) {
      actions.push({ key: "delete", label: "Permanently Delete", icon: "trash-outline", danger: true, onPress: () => openDelete(s.uid) });
    }
    return actions;
  };

  // ΓöÇΓöÇΓöÇ Render ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

  if (loading && entries.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#8A63D2" />
        <Text style={styles.centerText}>Loading student directoryΓÇª</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={["#312E81", "#4C1D95", "#6D28D9"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 10 }]}
      >
        <View style={styles.headerTop}>
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
              <Ionicons name="document-text-outline" size={16} color="#6D28D9" />
              <Text style={styles.headerBtnText}>Audit Log</Text>
            </Pressable>
            <Pressable style={styles.headerBtn} onPress={() => setStatusFilter("All")}>
              <Ionicons name="people-outline" size={16} color="#6D28D9" />
              <Text style={styles.headerBtnText}>All Students</Text>
            </Pressable>
          </View>
        </View>
        {isSuperAdmin && (
          <View style={styles.superBanner}>
            <Ionicons name="shield-checkmark" size={14} color="#C4B5FD" />
            <Text style={styles.superBannerText}>
              Super Admin ΓÇö permanent deletion is available.
            </Text>
          </View>
        )}
      </LinearGradient>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingBottom: selected.size > 0 ? 110 : insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              setRefreshKey((k) => k + 1);
            }}
          />
        }
      >
        {error ? (
          <View style={styles.errorCard}>
            <Ionicons name="cloud-offline-outline" size={18} color="#B91C1C" />
            <Text style={styles.errorText}>{error}</Text>
            <Pressable style={styles.retryBtn} onPress={() => setRefreshKey((k) => k + 1)}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : null}

        {/* KPI grid */}
        <View style={styles.kpiGrid}>
          <KpiCard label="Total Students" value={kpis.total} icon="people-outline" color="#1E1B4B" bg="#EDE9FE" onPress={() => setStatusFilter("All")} />
          <KpiCard label="Active" value={kpis.active} icon="checkmark-circle-outline" color="#15803D" bg="#DCFCE7" onPress={() => setStatusFilter("active")} />
          <KpiCard label="On Leave" value={kpis.onLeave} icon="time-outline" color="#B45309" bg="#FEF3C7" onPress={() => setStatusFilter("on_leave")} />
          <KpiCard label="Graduated" value={kpis.graduated} icon="ribbon-outline" color="#6D28D9" bg="#EDE9FE" onPress={() => setStatusFilter("graduated")} />
          <KpiCard label="Archived" value={kpis.archived} icon="archive-outline" color="#475569" bg="#E2E8F0" onPress={() => setStatusFilter("archived")} />
          <KpiCard label="Attention Required" value={kpis.attention} icon="alert-circle-outline" color="#BE123C" bg="#FFE4E6" />
        </View>

        {/* Attention list */}
        {attentionItems.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Attention Required</Text>
              <Text style={styles.sectionCount}>{attentionItems.length}</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.attentionRow}
            >
              {attentionItems.slice(0, 8).map((item, i) => (
                <Pressable
                  key={item.student.uid + "-" + i}
                  style={styles.attentionCard}
                  onPress={() => openWorkflow([item.student.uid])}
                >
                  <View style={styles.attentionCardHead}>
                    <View style={styles.attentionAvatar}>
                      <Text style={styles.attentionAvatarText}>
                        {initials(item.student.name)}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.attentionName} numberOfLines={1}>
                        {item.student.name}
                      </Text>
                      <Text style={styles.attentionCategory}>{item.label}</Text>
                    </View>
                  </View>
                  <Text style={styles.attentionReason} numberOfLines={3}>
                    {item.reason}
                  </Text>
                  <View style={styles.attentionFooter}>
                    {renderStatusBadge(item.student)}
                    {renderRiskBadge(item.student)}
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Filters */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Student Directory</Text>
            <Text style={styles.sectionCount}>{filtered.length} shown</Text>
          </View>

          <View style={styles.searchRow}>
            <Ionicons name="search" size={16} color="#9CA3AF" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search name, ID, or emailΓÇª"
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

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            {["All", ...LIFECYCLE_STATUSES].map((st) => (
              <FilterChip
                key={st}
                label={st === "All" ? "All Statuses" : LIFECYCLE_LABELS[st as LifecycleStatus]}
                active={statusFilter === st}
                onPress={() => setStatusFilter(st)}
                color={st === "All" ? "#8A63D2" : LIFECYCLE_COLORS[st as LifecycleStatus]}
              />
            ))}
          </ScrollView>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            {["All", ...departments].map((d) => (
              <FilterChip key={d} label={d} active={deptFilter === d} onPress={() => setDeptFilter(d)} />
            ))}
          </ScrollView>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            {["All", ...YEAR_OPTIONS].map((y) => (
              <FilterChip key={y} label={y} active={yearFilter === y} onPress={() => setYearFilter(y)} />
            ))}
            {["All", ...SUPPORT_STATUSES].map((sp) => (
              <FilterChip
                key={"sp" + sp}
                label={sp === "All" ? "Support: All" : SUPPORT_LABELS[sp as SupportStatus]}
                active={supportFilter === sp}
                onPress={() => setSupportFilter(sp)}
                color="#2563EB"
              />
            ))}
          </ScrollView>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            {["All", "low", "normal", "high"].map((r) => (
              <FilterChip
                key={r}
                label={r === "All" ? "Risk: All" : `Risk: ${RISK_LABELS[r as RiskLevel]}`}
                active={riskFilter === r}
                onPress={() => setRiskFilter(r)}
                color={r === "All" ? "#8A63D2" : RISK_COLORS[r as RiskLevel]}
              />
            ))}
            {ACTIVITY_OPTIONS.map((a) => (
              <FilterChip
                key={a.key}
                label={a.label}
                active={activityFilter === a.key}
                onPress={() => setActivityFilter(a.key)}
              />
            ))}
          </ScrollView>

          <View style={styles.lsnRow}>
            <Switch
              value={lsnOnly}
              onValueChange={setLsnOnly}
              trackColor={{ false: "#E5E7EB", true: "#8A63D2" }}
              thumbColor="#FFFFFF"
            />
            <Text style={styles.lsnText}>LSN students only</Text>
          </View>

          <Pressable
            style={styles.resetBtn}
            onPress={() => {
              setSearch("");
              setDeptFilter("All");
              setYearFilter("All");
              setStatusFilter("Active");
              setRiskFilter("All");
              setSupportFilter("All");
              setActivityFilter("All");
              setLsnOnly(false);
            }}
          >
            <Ionicons name="funnel-outline" size={14} color="#6B7280" />
            <Text style={styles.resetText}>Reset filters</Text>
          </Pressable>
        </View>

        {/* Directory */}
        {pageStudents.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="file-tray-outline" size={26} color="#CBD5E1" />
            <Text style={styles.emptyTitle}>No students found</Text>
            <Text style={styles.emptyText}>
              Try adjusting your filters or search.
            </Text>
          </View>
        ) : isWide ? (
          <View style={styles.tableCard}>
            <View style={styles.tableHead}>
              <Pressable style={styles.cellCheck} onPress={selectAllVisible}>
                <Ionicons
                  name={pageStudents.every((s) => selected.has(s.uid)) ? "checkbox" : "square-outline"}
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
              <Text style={[styles.cellText, styles.colActivity]}>Last Activity</Text>
              <View style={styles.colActions} />
            </View>
            {pageStudents.map((s) => (
              <View key={s.uid} style={[styles.tableRow, selected.has(s.uid) && styles.tableRowSelected]}>
                <Pressable style={styles.cellCheck} onPress={() => toggleSelect(s.uid)}>
                  <Ionicons
                    name={selected.has(s.uid) ? "checkbox" : "square-outline"}
                    size={18}
                    color={selected.has(s.uid) ? "#8A63D2" : "#CBD5E1"}
                  />
                </Pressable>
                <View style={styles.colStudent}>{renderStudentCell(s)}</View>
                <Text style={[styles.cellText, styles.colDept]} numberOfLines={1}>
                  {s.department || "ΓÇö"}
                </Text>
                <Text style={[styles.cellText, styles.colYear]} numberOfLines={1}>
                  {s.yearLevel || "ΓÇö"}
                </Text>
                <View style={styles.colStatus}>{renderStatusBadge(s)}</View>
                <View style={styles.colWell}>{renderRiskBadge(s)}</View>
                <Text style={[styles.cellText, styles.colNum]}>{s.assessmentsCount}</Text>
                <Text style={[styles.cellText, styles.colNum]}>{s.journalCount}</Text>
                <View style={styles.colSupport}>{renderSupportBadge(s)}</View>
                <Text style={[styles.cellText, styles.colActivity]} numberOfLines={1}>
                  {renderLastActivity(s)}
                </Text>
                <View style={styles.colActions}>
                  <Pressable style={styles.moreBtn} onPress={() => setMenuUid(s.uid)}>
                    <Ionicons name="ellipsis-horizontal" size={18} color="#6B7280" />
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.cardList}>
            {pageStudents.map((s) => (
              <View key={s.uid} style={[styles.studentCard, selected.has(s.uid) && styles.studentCardSelected]}>
                <View style={styles.studentCardTop}>
                  <Pressable style={styles.cellCheck} onPress={() => toggleSelect(s.uid)}>
                    <Ionicons
                      name={selected.has(s.uid) ? "checkbox" : "square-outline"}
                      size={20}
                      color={selected.has(s.uid) ? "#8A63D2" : "#CBD5E1"}
                    />
                  </Pressable>
                  <View style={{ flex: 1 }}>{renderStudentCell(s)}</View>
                  <Pressable style={styles.moreBtn} onPress={() => setMenuUid(s.uid)}>
                    <Ionicons name="ellipsis-horizontal" size={20} color="#6B7280" />
                  </Pressable>
                </View>
                <View style={styles.studentCardMeta}>
                  <Text style={styles.cardMetaText} numberOfLines={1}>
                    {s.department || "ΓÇö"} ┬╖ {s.yearLevel || "ΓÇö"}
                  </Text>
                  <Text style={styles.cardMetaText}>
                    {s.assessmentsCount} assessments ┬╖ {s.journalCount} journals
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
              <Ionicons name="chevron-back" size={16} color={page === 1 ? "#CBD5E1" : "#4B5563"} />
            </Pressable>
            <Text style={styles.pagerText}>
              Page {page} of {totalPages}
            </Text>
            <Pressable
              style={[styles.pagerBtn, page === totalPages && styles.pagerBtnDisabled]}
              disabled={page === totalPages}
              onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              <Ionicons name="chevron-forward" size={16} color={page === totalPages ? "#CBD5E1" : "#4B5563"} />
            </Pressable>
          </View>
        )}
      </ScrollView>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <View style={[styles.bulkBar, { paddingBottom: insets.bottom + 10 }]}>
          <Text style={styles.bulkCount}>{selected.size} selected</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.bulkActions}>
            <Pressable style={styles.bulkBtn} onPress={() => openWorkflow(Array.from(selected))}>
              <Ionicons name="git-network-outline" size={14} color="#6D28D9" />
              <Text style={styles.bulkBtnText}>Assign Support</Text>
            </Pressable>
            <Pressable style={styles.bulkBtn} onPress={() => openEdit("status", Array.from(selected))}>
              <Ionicons name="swap-horizontal-outline" size={14} color="#6D28D9" />
              <Text style={styles.bulkBtnText}>Change Status</Text>
            </Pressable>
            <Pressable style={styles.bulkBtn} onPress={() => openConfirm("archive", Array.from(selected))}>
              <Ionicons name="archive-outline" size={14} color="#6D28D9" />
              <Text style={styles.bulkBtnText}>Archive</Text>
            </Pressable>
            <Pressable style={styles.bulkBtn} onPress={() => openConfirm("graduate", Array.from(selected))}>
              <Ionicons name="ribbon-outline" size={14} color="#6D28D9" />
              <Text style={styles.bulkBtnText}>Graduate</Text>
            </Pressable>
            <Pressable style={styles.bulkBtn} onPress={() => openConfirm("restrict", Array.from(selected))}>
              <Ionicons name="lock-closed-outline" size={14} color="#BE123C" />
              <Text style={[styles.bulkBtnText, { color: "#BE123C" }]}>Restrict</Text>
            </Pressable>
            <Pressable style={styles.bulkBtn} onPress={clearSelection}>
              <Ionicons name="close" size={14} color="#6B7280" />
              <Text style={[styles.bulkBtnText, { color: "#6B7280" }]}>Clear</Text>
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
            <Pressable style={StyleSheet.absoluteFill} onPress={() => !editBusy && setEditModal(null)} />
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
                    style={[styles.optionRow, editValue === opt && styles.optionRowActive]}
                    onPress={() => setEditValue(opt)}
                  >
                    <Text style={[styles.optionText, editValue === opt && styles.optionTextActive]}>
                      {opt}
                    </Text>
                    {editValue === opt ? (
                      <Ionicons name="checkmark-circle" size={18} color="#6D28D9" />
                    ) : null}
                  </Pressable>
                ))}
              </ScrollView>
              <TextInput
                style={styles.reasonInput}
                placeholder={
                  editModal.kind === "status"
                    ? "Reason for this status change (required)ΓÇª"
                    : "Administrative reason (optional)ΓÇª"
                }
                placeholderTextColor="#9CA3AF"
                multiline
                value={editReason}
                onChangeText={setEditReason}
              />
              {editError ? <Text style={styles.errorText}>{editError}</Text> : null}
              <View style={styles.sheetFooter}>
                <Pressable style={styles.cancelBtn} onPress={() => setEditModal(null)} disabled={editBusy}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[styles.primaryBtn, (!editValue || editBusy) && styles.btnDisabled]}
                  disabled={!editValue || editBusy}
                  onPress={applyEdit}
                >
                  {editBusy ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
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
            <Pressable style={StyleSheet.absoluteFill} onPress={() => !confirmBusy && setConfirm(null)} />
            <View style={styles.sheet}>
              <View style={[styles.warnIcon, { backgroundColor: "#FEF3C7" }]}>
                <Ionicons
                  name={confirm.kind === "restrict" ? "lock-closed" : confirm.kind === "archive" ? "archive" : confirm.kind === "graduate" ? "ribbon" : "refresh"}
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
              {confirmError ? <Text style={styles.errorText}>{confirmError}</Text> : null}
              <View style={styles.sheetFooter}>
                <Pressable style={styles.cancelBtn} onPress={() => setConfirm(null)} disabled={confirmBusy}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[styles.primaryBtn, confirmBusy && styles.btnDisabled]}
                  disabled={confirmBusy}
                  onPress={runConfirm}
                >
                  {confirmBusy ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
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

      {/* Row action menu */}
      <Modal
        visible={menuUid !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuUid(null)}
      >
        {menuUid && (
          <View style={styles.backdrop}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setMenuUid(null)} />
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
                {rowMenuActions(entryById(menuUid)).map((a) => (
                  <Pressable
                    key={a.key}
                    style={styles.menuItem}
                    onPress={() => {
                      setMenuUid(null);
                      a.onPress();
                    }}
                  >
                    <Ionicons name={a.icon} size={18} color={a.danger ? "#B91C1C" : "#4B5563"} />
                    <Text style={[styles.menuItemText, a.danger && { color: "#B91C1C" }]}>
                      {a.label}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          </View>
        )}
      </Modal>

      {/* Workflow wizard */}
      <Modal
        visible={wfOpen}
        transparent
        animationType="slide"
        onRequestClose={() => !wfSaving && setWfOpen(false)}
      >
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => !wfSaving && setWfOpen(false)} />
          <View style={[styles.wizardSheet, { maxHeight: "86%" }]}>
            <View style={styles.wizardHead}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetTitle}>Support Workflow</Text>
                <Text style={styles.sheetSubtitle}>
                  {wfBulk
                    ? `${selected.size} students selected`
                    : entryById(wfTarget ?? "")?.name ?? "New workflow"}
                </Text>
              </View>
              <Pressable onPress={() => !wfSaving && setWfOpen(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color="#6B7280" />
              </Pressable>
            </View>

            {/* Step indicator */}
            <View style={styles.stepsRow}>
              {["Review", "Action", "Follow-up", "Confirm"].map((label, i) => {
                const step = i + 1;
                const done = wfStep > step;
                const active = wfStep === step;
                return (
                  <View key={label} style={styles.stepWrap}>
                    <View style={[styles.stepDot, active && styles.stepDotActive, done && styles.stepDotDone]}>
                      {done ? (
                        <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                      ) : (
                        <Text style={[styles.stepDotText, active && styles.stepDotTextActive]}>{step}</Text>
                      )}
                    </View>
                    <Text style={[styles.stepLabel, active && styles.stepLabelActive]}>{label}</Text>
                  </View>
                );
              })}
            </View>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.wizardBody} keyboardShouldPersistTaps="handled">
              {wfStep === 1 && wfTarget ? (
                <StudentReview
                  student={entryById(wfTarget)}
                  workflows={workflows.filter((w) => w.studentId === wfTarget)}
                />
              ) : null}

              {wfStep === 2 ? (
                <View>
                  <Text style={styles.fieldLabel}>Select an action</Text>
                  <Pressable style={styles.pickerField} onPress={() => setWfActionPicker(true)}>
                    {wfAction ? (
                      <Text style={styles.pickerValue}>{SUPPORT_ACTION_LABELS[wfAction]}</Text>
                    ) : (
                      <Text style={styles.pickerPlaceholder}>Choose action typeΓÇª</Text>
                    )}
                    <Ionicons name="chevron-down" size={16} color="#6B7280" />
                  </Pressable>
                  <TextInput
                    style={[styles.reasonInput, styles.wfReason]}
                    placeholder="Reason / notes for this interventionΓÇª"
                    placeholderTextColor="#9CA3AF"
                    multiline
                    value={wfReason}
                    onChangeText={setWfReason}
                  />
                </View>
              ) : null}

              {wfStep === 3 ? (
                <View>
                  <Text style={styles.fieldLabel}>Follow-up date</Text>
                  <View style={styles.quickDates}>
                    {[
                      { label: "Today", date: new Date() },
                      { label: "+1 week", date: addDays(new Date(), 7) },
                      { label: "+2 weeks", date: addDays(new Date(), 14) },
                    ].map((q) => {
                      const same =
                        wfFollowUp !== null &&
                        wfFollowUp.toDateString() === q.date.toDateString();
                      return (
                        <Pressable
                          key={q.label}
                          style={[styles.quickDateBtn, same && styles.quickDateBtnActive]}
                          onPress={() => setWfFollowUp(q.date)}
                        >
                          <Text style={[styles.quickDateText, same && styles.quickDateTextActive]}>
                            {q.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                    <Pressable style={styles.quickDateBtn} onPress={() => setShowDatePicker(true)}>
                      <Ionicons name="calendar-outline" size={14} color="#6D28D9" />
                      <Text style={styles.quickDateText}>CustomΓÇª</Text>
                    </Pressable>
                  </View>
                  <Text style={styles.followUpValue}>
                    {wfFollowUp ? formatDate(wfFollowUp) : "No follow-up date selected"}
                  </Text>

                  <Text style={styles.fieldLabel}>Assigned to</Text>
                  <View style={styles.assigneeRow}>
                    {admins.length === 0 ? (
                      <Text style={styles.pickerPlaceholder}>Loading administratorsΓÇª</Text>
                    ) : (
                      admins.map((a) => {
                        const active = wfAssignee === a.uid;
                        return (
                          <Pressable
                            key={a.uid}
                            style={[styles.assigneeChip, active && styles.assigneeChipActive]}
                            onPress={() => setWfAssignee(a.uid)}
                          >
                            <Text style={[styles.assigneeChipText, active && styles.assigneeChipTextActive]}>
                              {a.name}
                            </Text>
                          </Pressable>
                        );
                      })
                    )}
                  </View>

                  <Text style={styles.fieldLabel}>Note</Text>
                  <TextInput
                    style={styles.reasonInput}
                    placeholder="Optional note for the assigneeΓÇª"
                    placeholderTextColor="#9CA3AF"
                    multiline
                    value={wfNote}
                    onChangeText={setWfNote}
                  />
                </View>
              ) : null}

              {wfStep === 4 ? (
                <View style={styles.summaryBox}>
                  <SummaryRow
                    label="Action"
                    value={wfAction ? SUPPORT_ACTION_LABELS[wfAction] : "ΓÇö"}
                  />
                  <SummaryRow label="Follow-up" value={wfFollowUp ? formatDate(wfFollowUp) : "Not scheduled"} />
                  <SummaryRow
                    label="Assigned to"
                    value={admins.find((a) => a.uid === wfAssignee)?.name ?? "You"}
                  />
                  <SummaryRow label="Reason" value={wfReason.trim() || "ΓÇö"} last />
                  {wfBulk ? (
                    <Text style={styles.summaryBulkNote}>
                      This will create a workflow for {selected.size} students.
                    </Text>
                  ) : null}
                </View>
              ) : null}

              {wfError ? <Text style={styles.errorText}>{wfError}</Text> : null}
            </ScrollView>

            <View style={styles.sheetFooter}>
              {wfStep > 1 ? (
                <Pressable style={styles.cancelBtn} onPress={() => setWfStep((s) => s - 1)} disabled={wfSaving}>
                  <Text style={styles.cancelBtnText}>Back</Text>
                </Pressable>
              ) : (
                <Pressable style={styles.cancelBtn} onPress={() => setWfOpen(false)} disabled={wfSaving}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </Pressable>
              )}
              {wfStep < 4 ? (
                <Pressable
                  style={[styles.primaryBtn, wfStep === 2 && !wfAction && styles.btnDisabled]}
                  disabled={wfStep === 2 && !wfAction}
                  onPress={() => setWfStep((s) => s + 1)}
                >
                  <Text style={styles.primaryBtnText}>Continue</Text>
                </Pressable>
              ) : (
                <Pressable
                  style={[styles.primaryBtn, wfSaving && styles.btnDisabled]}
                  disabled={wfSaving}
                  onPress={saveWorkflow}
                >
                  {wfSaving ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.primaryBtnText}>Save Workflow</Text>
                  )}
                </Pressable>
              )}
            </View>
          </View>
        </View>

        <MultiSelectModal
          visible={wfActionPicker}
          title="Select Action"
          maxSelection={1}
          selected={wfAction ? [wfAction] : []}
          items={SUPPORT_ACTIONS.map((a) => ({
            key: a,
            label: SUPPORT_ACTION_LABELS[a],
            icon: "git-branch-outline",
          }))}
          onCancel={() => setWfActionPicker(false)}
          onConfirm={(keys) => {
            if (keys[0]) setWfAction(keys[0] as SupportActionType);
            setWfActionPicker(false);
          }}
        />

        {showDatePicker ? (
          <DateTimePicker
            value={wfFollowUp ?? new Date()}
            mode="date"
            display="default"
            textColor="#1E1B4B"
            onChange={(event, selectedDate) => {
              if (Platform.OS === "android") {
                setShowDatePicker(false);
                if (event.type === "set" && selectedDate) setWfFollowUp(selectedDate);
              } else {
                if (selectedDate) setWfFollowUp(selectedDate);
              }
            }}
          />
        ) : null}
      </Modal>

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
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setAuditVisible(false)} />
          <View style={[styles.wizardSheet, { maxHeight: "86%" }]}>
            <View style={styles.wizardHead}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetTitle}>Audit Trail</Text>
                <Text style={styles.sheetSubtitle}>
                  {auditScope === "all"
                    ? "All administrative changes"
                    : entryById(auditScope)?.name ?? "Student history"}
                </Text>
              </View>
              <Pressable onPress={() => setAuditVisible(false)} style={styles.closeBtn}>
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
              <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.auditList}>
                {auditLogs.map((log) => (
                  <View key={log.id} style={styles.auditRow}>
                    <View style={styles.auditDot} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.auditAction}>
                        {AUDIT_ACTION_LABELS[log.action] ?? log.action}
                      </Text>
                      <Text style={styles.auditMeta}>
                        {log.targetStudentName ?? "ΓÇö"}
                        {log.newValue ? ` ΓåÆ ${log.newValue}` : ""}
                        {log.previousValue ? ` (from ${log.previousValue})` : ""}
                      </Text>
                      {log.reason ? (
                        <Text style={styles.auditReason}>ΓÇ£{log.reason}ΓÇ¥</Text>
                      ) : null}
                      <Text style={styles.auditBy}>
                        {log.actorName ?? "Administrator"} ┬╖ {formatDateTime(log.createdAt)}
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
            <Pressable style={StyleSheet.absoluteFill} onPress={() => !deleteBusy && setDeleteUid(null)} />
            <View style={styles.sheet}>
              <View style={[styles.warnIcon, { backgroundColor: "#FEE2E2" }]}>
                <Ionicons name="trash" size={22} color="#B91C1C" />
              </View>
              <Text style={styles.sheetTitle}>Permanently delete student?</Text>
              <Text style={styles.sheetBody}>
                This permanently removes the account of{" "}
                <Text style={{ fontWeight: "800" }}>{entryById(deleteUid)?.name}</Text>,
                including wellness history, journals and profile ΓÇö and cannot be
                undone. Type <Text style={{ fontWeight: "800" }}>DELETE</Text> to
                confirm.
              </Text>
              <TextInput
                style={styles.reasonInput}
                placeholder="Type DELETE to confirmΓÇª"
                placeholderTextColor="#9CA3AF"
                autoCapitalize="characters"
                value={deleteText}
                onChangeText={setDeleteText}
              />
              {deleteError ? <Text style={styles.errorText}>{deleteError}</Text> : null}
              <View style={styles.sheetFooter}>
                <Pressable style={styles.cancelBtn} onPress={() => setDeleteUid(null)} disabled={deleteBusy}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[styles.dangerBtn, (deleteText !== "DELETE" || deleteBusy) && styles.btnDisabled]}
                  disabled={deleteText !== "DELETE" || deleteBusy}
                  onPress={runDelete}
                >
                  {deleteBusy ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.primaryBtnText}>Delete Permanently</Text>
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

// ΓöÇΓöÇΓöÇ Workflow review (step 1) ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

function StudentReview({
  student,
  workflows,
}: {
  student?: StudentManagementEntry;
  workflows: SupportWorkflow[];
}) {
  if (!student) {
    return <Text style={styles.emptyText}>No student selected.</Text>;
  }
  const risk = (student.latestRiskLevel ?? "low") as RiskLevel;
  const support = student.supportStatus ?? "no_action";
  const activeSupport = ACTIVE_SUPPORT_STATUSES.includes(support);
  const indicators: { label: string; tone: "red" | "amber" | "green" }[] = [];
  if (risk === "high") indicators.push({ label: "Elevated concern indicators", tone: "red" });
  if (student.assessmentsCount === 0) indicators.push({ label: "No assessment yet", tone: "amber" });
  if (
    student.latestAssessmentDate &&
    student.latestAssessmentDate.getTime() < Date.now() - 90 * 24 * 60 * 60 * 1000
  ) {
    indicators.push({ label: "No recent assessment (90d+)", tone: "amber" });
  }
  if (activeSupport && student.followUpDate && student.followUpDate.getTime() < Date.now()) {
    indicators.push({ label: "Follow-up overdue", tone: "red" });
  }
  if (
    student.assessmentsCount === 0 &&
    student.journalCount === 0 &&
    (!student.lastActivity || student.lastActivity.getTime() < Date.now() - 60 * 24 * 60 * 60 * 1000)
  ) {
    indicators.push({ label: "Low engagement", tone: "amber" });
  }
  if (indicators.length === 0) indicators.push({ label: "No urgent indicators", tone: "green" });

  return (
    <View>
      <View style={styles.reviewHead}>
        <View style={styles.avatarLarge}>
          <Text style={styles.avatarTextLarge}>{initials(student.name)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.reviewName}>{student.name}</Text>
          <Text style={styles.reviewSub}>
            {student.schoolId} ┬╖ {student.department || "ΓÇö"} ┬╖ {student.yearLevel || "ΓÇö"}
          </Text>
        </View>
      </View>

      <View style={styles.reviewGrid}>
        <View style={styles.reviewCell}>
          <Text style={styles.reviewLabel}>Status</Text>
          <Badge
            label={LIFECYCLE_LABELS[student.status ?? "active"]}
            color={LIFECYCLE_COLORS[student.status ?? "active"]}
          />
        </View>
        <View style={styles.reviewCell}>
          <Text style={styles.reviewLabel}>Wellness</Text>
          <Badge label={RISK_LABELS[risk]} color={RISK_COLORS[risk]} />
        </View>
        <View style={styles.reviewCell}>
          <Text style={styles.reviewLabel}>Assessments</Text>
          <Text style={styles.reviewValue}>{student.assessmentsCount}</Text>
        </View>
        <View style={styles.reviewCell}>
          <Text style={styles.reviewLabel}>Journals</Text>
          <Text style={styles.reviewValue}>{student.journalCount}</Text>
        </View>
      </View>

      <Text style={styles.fieldLabel}>Observed indicators</Text>
      {indicators.map((ind) => (
        <View key={ind.label} style={styles.indicatorRow}>
          <Ionicons
            name={ind.tone === "red" ? "close-circle" : ind.tone === "amber" ? "warning" : "checkmark-circle"}
            size={16}
            color={ind.tone === "red" ? "#B91C1C" : ind.tone === "amber" ? "#B45309" : "#16A34A"}
          />
          <Text style={styles.indicatorText}>{ind.label}</Text>
        </View>
      ))}

      <Text style={styles.fieldLabel}>Open workflows</Text>
      {workflows.length === 0 ? (
        <Text style={styles.emptyText}>No workflows yet.</Text>
      ) : (
        workflows.map((w) => (
          <View key={w.id} style={styles.wfRow}>
            <Text style={styles.wfRowTitle}>{SUPPORT_ACTION_LABELS[w.actionType]}</Text>
            <Text style={styles.wfRowMeta}>
              {w.status} ┬╖ {w.followUpDate ? `Follow-up ${formatDate(w.followUpDate)}` : "No follow-up"}
            </Text>
          </View>
        ))
      )}
    </View>
  );
}

function SummaryRow({
  label,
  value,
  last,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.summaryRow, last && { borderBottomWidth: 0 }]}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

// ΓöÇΓöÇΓöÇ Student profile modal ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

function StudentProfileModal({
  uid,
  student,
  workflows,
  onClose,
  onOpenAudit,
  onOpenWorkflow,
  onCompleteWf,
}: {
  uid: string | null;
  student?: StudentManagementEntry;
  workflows: SupportWorkflow[];
  onClose: () => void;
  onOpenAudit: (uid: string) => void;
  onOpenWorkflow: (uid: string) => void;
  onCompleteWf: (wf: SupportWorkflow) => void;
}) {
  const [deptName, setDeptName] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) {
      setDeptName(null);
      return;
    }
    getDoc(doc(db, "users", uid))
      .then((snap) => {
        if (snap.exists()) {
          const d = snap.data();
          const dref = d.departmentRef;
          if (dref && typeof dref === "string" && dref.startsWith("departments/")) {
            getDoc(doc(db, "departments", dref.split("/")[1]))
              .then((dsnap) => setDeptName(dsnap.exists() ? String(dsnap.data().name ?? "") : null))
              .catch(() => setDeptName(null));
          } else {
            setDeptName(null);
          }
        }
      })
      .catch(() => setDeptName(null));
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
            colors={["#312E81", "#6D28D9"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.profileHeader}
          >
            <View style={styles.profileAvatar}>
              <Text style={styles.profileAvatarText}>{initials(student.name)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.profileName}>{student.name}</Text>
              <Text style={styles.profileSub}>{student.schoolId}</Text>
              <Text style={styles.profileSub}>{student.email ?? ""}</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color="#FFFFFF" />
            </Pressable>
          </LinearGradient>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.profileBody}>
            <ProfileSection title="Student Overview" icon="person-outline">
              <ProfileRow label="Department" value={(deptName ?? student.department) || "ΓÇö"} />
              <ProfileRow label="Year Level" value={student.yearLevel || "ΓÇö"} />
              <ProfileRow
                label="Special Needs"
                value={student.isLSN ? student.specialNeedsType ?? student.lsnCategory ?? "LSN" : "No"}
              />
            </ProfileSection>

            <ProfileSection title="Status & Academic" icon="shield-checkmark-outline">
              <View style={styles.profileBadges}>
                <Badge
                  label={LIFECYCLE_LABELS[student.status ?? "active"]}
                  color={LIFECYCLE_COLORS[student.status ?? "active"]}
                />
                <Badge label={SUPPORT_LABELS[support]} color={SUPPORT_COLORS[support]} />
              </View>
              <ProfileRow
                label="Assigned admin"
                value={student.supportAssignedName ?? student.supportAssignedTo ?? "ΓÇö"}
              />
              <ProfileRow label="Follow-up" value={formatDate(student.followUpDate)} />
              <ProfileRow label="Last updated" value={formatDateTime(student.updatedAt)} />
            </ProfileSection>

            <ProfileSection title="Wellness Indicators" icon="pulse-outline">
              <View style={styles.profileBadges}>
                <Badge label={`Risk: ${RISK_LABELS[risk]}`} color={RISK_COLORS[risk]} />
              </View>
              <ProfileRow
                label="Last assessment"
                value={
                  student.latestAssessmentDate
                    ? `${formatDate(student.latestAssessmentDate)}${student.latestTotalScore !== undefined ? ` ┬╖ Score ${student.latestTotalScore}` : ""}`
                    : "None"
                }
              />
              <ProfileRow label="Assessments" value={String(student.assessmentsCount)} />
              <ProfileRow label="Journals" value={String(student.journalCount)} />
              <ProfileRow label="Latest mood" value={student.latestJournalMood ?? "ΓÇö"} />
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
                <Pressable style={styles.sectionActionBtn} onPress={() => onOpenWorkflow(student.uid)}>
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
                      <Text style={styles.wfCardTitle}>{SUPPORT_ACTION_LABELS[w.actionType]}</Text>
                      <Badge
                        label={w.status}
                        color={w.status === "open" ? "#2563EB" : w.status === "completed" ? "#16A34A" : "#64748B"}
                      />
                    </View>
                    <Text style={styles.wfCardMeta}>
                      Assigned: {w.assignedToName ?? w.assignedTo ?? "ΓÇö"} ┬╖ Follow-up: {formatDate(w.followUpDate)}
                    </Text>
                    {w.reason ? <Text style={styles.wfCardNote}>{w.reason}</Text> : null}
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

            <ProfileSection title="Administrative Notes" icon="document-text-outline">
              <ProfileRow label="Created workflow" value={workflows.length ? formatDateTime(workflows[0]?.createdAt) : "ΓÇö"} />
            </ProfileSection>

            <View style={styles.profileActions}>
              <Pressable style={styles.outlineBtn} onPress={() => onOpenAudit(student.uid)}>
                <Ionicons name="document-text-outline" size={16} color="#6D28D9" />
                <Text style={styles.outlineBtnText}>View audit trail</Text>
              </Pressable>
              <Pressable
                style={styles.outlineBtn}
                onPress={() => router.push({ pathname: "./student-detail", params: { uid: student.uid } })}
              >
                <Ionicons name="eye-outline" size={16} color="#6D28D9" />
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
  return (
    <View style={styles.profileSection}>
      <View style={styles.profileSectionHead}>
        <Ionicons name={icon} size={16} color="#6D28D9" />
        <Text style={styles.profileSectionTitle}>{title}</Text>
        {action ?? null}
      </View>
      {children}
    </View>
  );
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.profileRow}>
      <Text style={styles.profileRowLabel}>{label}</Text>
      <Text style={styles.profileRowValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

// ΓöÇΓöÇΓöÇ Styles ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

const styles = StyleSheet.create({
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
  headerTitle: {
    color: "#FFFFFF",
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
    backgroundColor: "#FFFFFF",
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
    color: "#FFFFFF",
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
    backgroundColor: "#FFFFFF",
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
    backgroundColor: "#FFFFFF",
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
  sectionCount: {
    fontSize: 12,
    fontWeight: "700",
    color: "#8A63D2",
    backgroundColor: "#F3EEFB",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  attentionRow: {
    gap: 10,
    paddingRight: 4,
  },
  attentionCard: {
    width: 240,
    backgroundColor: "#FDF6FF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#EDE0F9",
    padding: 12,
  },
  attentionCardHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  attentionAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#6D28D9",
    alignItems: "center",
    justifyContent: "center",
  },
  attentionAvatarText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
  attentionName: {
    fontSize: 13,
    fontWeight: "800",
    color: "#1E1B4B",
  },
  attentionCategory: {
    fontSize: 11,
    fontWeight: "700",
    color: "#BE123C",
  },
  attentionReason: {
    fontSize: 12,
    color: "#4B5563",
    marginTop: 8,
    lineHeight: 17,
  },
  attentionFooter: {
    flexDirection: "row",
    gap: 6,
    marginTop: 10,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F5F4FA",
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#111827",
  },
  chipRow: {
    gap: 8,
    paddingBottom: 4,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
  },
  chipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#4B5563",
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
  resetBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#F5F4FA",
  },
  resetText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6B7280",
  },
  tableCard: {
    backgroundColor: "#FFFFFF",
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
    backgroundColor: "#FFFFFF",
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
    backgroundColor: "#FFFFFF",
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
    backgroundColor: "#FFFFFF",
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
    backgroundColor: "#FFFFFF",
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
    backgroundColor: "#FFFFFF",
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
    color: "#FFFFFF",
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
    backgroundColor: "#FFFFFF",
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
  stepsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 14,
    marginBottom: 6,
  },
  stepWrap: {
    alignItems: "center",
    flex: 1,
  },
  stepDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
  },
  stepDotActive: {
    backgroundColor: "#6D28D9",
  },
  stepDotDone: {
    backgroundColor: "#16A34A",
  },
  stepDotText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#6B7280",
  },
  stepDotTextActive: {
    color: "#FFFFFF",
  },
  stepLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#9CA3AF",
    marginTop: 4,
  },
  stepLabelActive: {
    color: "#6D28D9",
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
  pickerField: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: "#F9FAFB",
  },
  pickerValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
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
  followUpValue: {
    fontSize: 13,
    fontWeight: "700",
    color: "#6D28D9",
    marginTop: 8,
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
    backgroundColor: "#FFFFFF",
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
  summaryBox: {
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 4,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#EEF0F4",
    gap: 12,
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6B7280",
    width: 70,
  },
  summaryValue: {
    flex: 1,
    fontSize: 12,
    fontWeight: "700",
    color: "#111827",
    textAlign: "right",
  },
  summaryBulkNote: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6D28D9",
    padding: 12,
  },
  reviewHead: {
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
    color: "#FFFFFF",
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
  reviewGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  reviewCell: {
    flexBasis: "45%",
    flexGrow: 1,
    backgroundColor: "#F9FAFB",
    borderRadius: 10,
    padding: 10,
  },
  reviewLabel: {
    fontSize: 11,
    color: "#6B7280",
    marginBottom: 4,
  },
  reviewValue: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1E1B4B",
  },
  indicatorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 6,
  },
  indicatorText: {
    fontSize: 13,
    color: "#374151",
  },
  wfRow: {
    borderWidth: 1,
    borderColor: "#EEECF7",
    borderRadius: 10,
    padding: 10,
    marginBottom: 6,
  },
  wfRowTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#1E1B4B",
  },
  wfRowMeta: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 2,
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
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
  profileName: {
    color: "#FFFFFF",
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
    backgroundColor: "#FFFFFF",
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
