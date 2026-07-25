import { API_URL } from "@/backend/config";
import { StudentListModal } from "@/components/admin/StudentListModal";
import { db } from "@/constants/firebase";
import { useAuth } from "@/hooks/AuthContext";
import { listenForAdminDashboardData } from "@/services/adminFirestoreService";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import {
    collection,
    deleteDoc,
    doc,
    getDocs,
    writeBatch,
} from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context"; // This was already correct

type RiskLevel = "low" | "normal" | "high";

interface AnalyticsSummary {
  label: string;
  total: number;
  low: number;
  normal: number;
  high: number;
  scoreSum: number;
}

type AnalyticsCategory = "department" | "age" | "gender" | "yearLevel";

interface StudentSummary {
  uid: string;
  name: string;
  schoolId: string;
  yearLevel: string;
  department: string;
  latestAssessmentDate?: Date;
  latestTotalScore?: number;
  latestRiskLevel?: RiskLevel;
  assessmentsCount: number;
  journalCount: number;
  latestJournalMood?: string;
  moodCounts: Record<string, number>;
  isLSN?: boolean;
}

// ─── KPI Card Data ───────────────────────────────────────────────────────────
interface KpiCardData {
  riskLabel: string;
  count: number;
  percentageChange: number;
  baselineCount: number;
  color: string;
  bgColor: string;
  icon: keyof typeof Ionicons.glyphMap;
}

// ─── Department Table Row ────────────────────────────────────────────────────
interface DepartmentRowData {
  name: string;
  totalStudents: number;
  lowCount: number;
  lowPct: number;
  normalCount: number;
  normalPct: number;
  highCount: number;
  highPct: number;
}

// ─── Helper: Extract abbreviation from department name ───────────────────────
const getDeptAbbreviation = (fullName: string): string => {
  const match = fullName.match(/\(([^)]+)\)/);
  return match ? match[1] : fullName;
};

// ─── Chart Data ──────────────────────────────────────────────────────────────
interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

interface EngagementMetric {
  label: string;
  value: number;
  maxValue: number;
  color: string;
}

export default function AdminPanelScreen() {
  const { user, signOut } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analyticsData, setAnalyticsData] = useState<
    Record<AnalyticsCategory, AnalyticsSummary[]>
  >({
    department: [],
    age: [],
    gender: [],
    yearLevel: [],
  });
  const [studentSummaries, setStudentSummaries] = useState<StudentSummary[]>(
    [],
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<"students" | "analytics">(
    "students",
  );
  const [removingStudent, setRemovingStudent] = useState<string | null>(null);
  const [confirmRemoveUid, setConfirmRemoveUid] = useState<string | null>(null);
  const [confirmRemoveName, setConfirmRemoveName] = useState<string>("");
  const [removalStatus, setRemovalStatus] = useState<string>("");
  const [isCreateAdminModalVisible, setCreateAdminModalVisible] =
    useState(false);
  const [newAdminName, setNewAdminName] = useState("");
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [newAdminPassword, setNewAdminPassword] = useState("");
  const [isSignOutConfirmVisible, setSignOutConfirmVisible] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  useEffect(() => {
    // Secure route: Redirect to login if user is null (not logged in)
    if (!user) {
      router.replace("/auth/login");
      return; // Stop execution here
    }

    const unsubData = listenForAdminDashboardData(
      (data) => {
        setStudentSummaries(data.studentSummaries);
        setAnalyticsData(data.analyticsData);
        setError(null);
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setError("Unable to load admin dashboard.");
        setLoading(false);
      },
    );

    return () => {
      unsubData();
    };
  }, [user]); // Re-run effect if user state changes
  const [creatingAdmin, setCreatingAdmin] = useState(false);
  const [createAdminError, setCreateAdminError] = useState<string | null>(null);

  // State for pagination
  const [currentPage, setCurrentPage] = useState(1);
  const STUDENTS_PER_PAGE = 10;

  // Consolidated state for student list modals
  const [studentListModal, setStudentListModal] = useState<{
    visible: boolean;
    title: string;
  } | null>(null);

  const allFilteredStudents = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return studentSummaries;
    return studentSummaries.filter((student) =>
      [student.name, student.schoolId, student.yearLevel, student.department]
        .join(" ")
        .toLowerCase()
        .includes(term),
    );
  }, [searchTerm, studentSummaries]);

  const paginatedStudents = useMemo(() => {
    const startIndex = (currentPage - 1) * STUDENTS_PER_PAGE;
    const endIndex = startIndex + STUDENTS_PER_PAGE;
    return allFilteredStudents.slice(startIndex, endIndex);
  }, [allFilteredStudents, currentPage]);

  const totalPages = Math.ceil(allFilteredStudents.length / STUDENTS_PER_PAGE);

  const handleSearchChange = (text: string) => {
    setSearchTerm(text);
    setCurrentPage(1); // Reset to the first page on a new search
  };

  const handleAdminSignOut = async () => {
    setIsSigningOut(true);
    setSignOutError(null);
    try {
      await signOut();
    } catch (err) {
      console.error("Admin sign out failed:", err);
      setSignOutError("Unable to sign out. Please try again.");
      setIsSigningOut(false);
    }
  };

  // This derived state will calculate the students to show in the modal
  // based on the modal's title, which is used as a filter key.
  const modalStudents = useMemo(() => {
    if (!studentListModal?.visible) return [];
    const filterFn = getFilterFnForTitle(studentListModal.title);
    return studentSummaries.filter(filterFn);
  }, [studentListModal, studentSummaries]);

  // ─── Computed KPI Data ─────────────────────────────────────────────────────
  const kpiData = useMemo((): KpiCardData[] => {
    const totalLow = studentSummaries.filter(
      (s) => s.latestRiskLevel === "low",
    ).length;
    const totalNormal = studentSummaries.filter(
      (s) => s.latestRiskLevel === "normal",
    ).length;
    const totalHigh = studentSummaries.filter(
      (s) => s.latestRiskLevel === "high",
    ).length;
    const totalLSN = studentSummaries.filter((s) => s.isLSN).length;

    // Baseline: use previous period (simulate with 90% of current for demo)
    const baselineLow = Math.round(totalLow * 0.9) || 1;
    const baselineNormal = Math.round(totalNormal * 0.9) || 1;
    const baselineHigh = Math.round(totalHigh * 0.9) || 1;
    const baselineLSN = Math.round(totalLSN * 0.9) || 1;

    const pctChange = (current: number, baseline: number) =>
      baseline > 0
        ? Math.round(((current - baseline) / baseline) * 100)
        : current > 0
          ? 100
          : 0;
    return [
      {
        riskLabel: "Low Concern",
        count: totalLow,
        percentageChange: pctChange(totalLow, baselineLow),
        baselineCount: baselineLow,
        color: "#6D28D9",
        bgColor: "#F3E8FF",
        icon: "shield-checkmark",
      },
      {
        riskLabel: "Medium Concern",
        count: totalNormal,
        percentageChange: pctChange(totalNormal, baselineNormal),
        baselineCount: baselineNormal,
        color: "#7C3AED",
        bgColor: "#EDE9FE",
        icon: "warning",
      },
      {
        riskLabel: "High Concern",
        count: totalHigh,
        percentageChange: pctChange(totalHigh, baselineHigh),
        baselineCount: baselineHigh,
        color: "#5B21B6",
        bgColor: "#DDD6FE",
        icon: "alert-circle",
      },
      {
        riskLabel: "Students with Special Needs (LSN)",
        count: totalLSN,
        percentageChange: pctChange(totalLSN, baselineLSN),
        baselineCount: baselineLSN,
        color: "#9333EA",
        bgColor: "#FAE8FF",
        icon: "medkit",
      },
    ];
  }, [studentSummaries]);

  // ─── Computed Department Table Rows ────────────────────────────────────────
  const departmentRows = useMemo((): DepartmentRowData[] => {
    return analyticsData.department.map((d) => ({
      name: d.label,
      totalStudents: d.total,
      lowCount: d.low,
      lowPct: d.total ? Math.round((d.low / d.total) * 100) : 0,
      normalCount: d.normal,
      normalPct: d.total ? Math.round((d.normal / d.total) * 100) : 0,
      highCount: d.high,
      highPct: d.total ? Math.round((d.high / d.total) * 100) : 0,
    }));
  }, [analyticsData]);

  // ─── Computed Chart Data ───────────────────────────────────────────────────
  const donutData = useMemo((): DonutSlice[] => {
    if (!analyticsData.department) return [];
    const deptData = analyticsData.department;
    const totalLow = deptData.reduce((s, d) => s + d.low, 0);
    const totalNormal = deptData.reduce((s, d) => s + d.normal, 0);
    const totalHigh = deptData.reduce((s, d) => s + d.high, 0);
    const total = totalLow + totalNormal + totalHigh || 1;
    return [
      {
        label: "Low Concern",
        value: Math.round((totalLow / total) * 100),
        color: "#22C55E",
      },
      {
        label: "Moderate Concern",
        value: Math.round((totalNormal / total) * 100),
        color: "#F59E0B",
      },
      {
        label: "High Concern",
        value: Math.round((totalHigh / total) * 100),
        color: "#EF4444",
      },
    ];
  }, [analyticsData]);

  // Deduct unassessed students from survey completion percentage
  const surveyCompletionPct = useMemo(() => {
    if (!studentSummaries || studentSummaries.length === 0) return 0;

    const totalStudents = studentSummaries.length;
    // Strictly count students who have taken at least one assessment
    const assessedCount = studentSummaries.filter(
      (s) => s.assessmentsCount > 0,
    ).length;

    return Math.round((assessedCount / totalStudents) * 100);
  }, [studentSummaries]);

  const engagementData = useMemo((): EngagementMetric[] => {
    const totalStudents = studentSummaries.length || 1;
    const totalAssessed = studentSummaries.filter(
      (s) => s.assessmentsCount > 0,
    ).length;
    const predictedSoon = Math.round(totalStudents * 0.15); // estimate
    return [
      {
        label: "Signed In / Took Assessment",
        value: totalAssessed,
        maxValue: totalStudents,
        color: "#3B82F6",
      },
      {
        label: "Took / Predicted Soon",
        value: totalAssessed + predictedSoon,
        maxValue: totalStudents + predictedSoon,
        color: "#8B5CF6",
      },
    ];
  }, [studentSummaries]);

  const handleRemoveStudent = async (uid: string) => {
    setRemovingStudent(uid);
    setRemovalStatus("Deleting Firestore data...");
    try {
      await deleteDoc(doc(db, "users", uid));

      const batch = writeBatch(db);
      const subcollections = [
        "selfAssessments",
        "journalEntries",
        "initialProfileSurveys",
      ];
      for (const subcol of subcollections) {
        const snap = await getDocs(collection(db, "users", uid, subcol));
        snap.docs.forEach((d) => batch.delete(d.ref));
      }
      await batch.commit();

      setRemovalStatus("Deleting auth account...");
      try {
        const res = await fetch(`${API_URL}/api/delete-student`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uid }),
        });
        const result = await res.json();
        if (!result.authDeleted) {
          console.warn("Auth deletion note:", result.message);
        }
      } catch (fetchErr) {
        console.warn("Backend not available, auth user not deleted:", fetchErr);
      }

      setStudentSummaries((prev) => prev.filter((s) => s.uid !== uid));
      setConfirmRemoveUid(null);
      setRemovalStatus("");
    } catch (err) {
      console.error("Error removing student:", err);
      setRemovalStatus(
        `Error: ${err instanceof Error ? err.message : "Unknown error"}`,
      );
    } finally {
      setRemovingStudent(null);
    }
  };

  const handleCreateAdmin = async () => {
    if (
      !newAdminName.trim() ||
      !newAdminEmail.trim() ||
      !newAdminPassword.trim()
    ) {
      setCreateAdminError("All fields are required.");
      return;
    }
    setCreatingAdmin(true);
    setCreateAdminError(null);
    try {
      const token = await user?.getIdToken();
      const res = await fetch(`${API_URL}/api/create-admin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          email: newAdminEmail,
          password: newAdminPassword,
          displayName: newAdminName,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.message || "Failed to create admin.");
      }

      Alert.alert(
        "Success",
        `Admin user ${newAdminName} created successfully.`,
      );
      setCreateAdminModalVisible(false);
      setNewAdminName("");
      setNewAdminEmail("");
      setNewAdminPassword("");
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "An unknown error occurred.";
      console.error("Error creating admin:", errorMessage);
      setCreateAdminError(errorMessage);
    } finally {
      setCreatingAdmin(false);
    }
  };

  // ─── Render helpers ────────────────────────────────────────────────────────

  const renderKpiCard = (kpi: KpiCardData, index: number) => {
    const isUp = kpi.percentageChange >= 0;
    const arrowIcon = isUp ? "arrow-up" : "arrow-down";
    const arrowColor = isUp ? "#16A34A" : "#DC2626";
    const title = `${kpi.riskLabel} Students`;

    return (
      <Pressable
        key={index}
        style={({ pressed }) => [
          styles.kpiCard,
          pressed && { transform: [{ scale: 0.98 }], opacity: 0.95 },
        ]}
        onPress={() => setStudentListModal({ visible: true, title })}
      >
        <View style={styles.kpiHeader}>
          <View
            style={[styles.kpiIconCircle, { backgroundColor: kpi.bgColor }]}
          >
            <Ionicons name={kpi.icon} size={18} color={kpi.color} />
          </View>
          <View style={styles.kpiChangeBadge}>
            <Ionicons name={arrowIcon} size={12} color={arrowColor} />
            <Text style={[styles.kpiChangeText, { color: arrowColor }]}>
              {Math.abs(kpi.percentageChange)}%
            </Text>
          </View>
        </View>
        <Text style={styles.kpiCount}>{kpi.count}</Text>
        <Text style={styles.kpiLabel}>{kpi.riskLabel}</Text>
        <Text style={styles.kpiBaseline}>Baseline: ({kpi.baselineCount})</Text>
      </Pressable>
    );
  };

  /** Department table row - aligned flex grid layout */
  const renderDepartmentRow = (row: DepartmentRowData) => {
    const deptAbbr = getDeptAbbreviation(row.name);

    return (
      <Pressable
        key={row.name}
        style={({ pressed }) => [
          styles.deptCardItem,
          pressed && { transform: [{ scale: 0.99 }] },
        ]}
        onPress={() => setStudentListModal({ visible: true, title: row.name })}
      >
        {/* Left Side: Department Name & Total */}
        <View style={styles.deptMainInfo}>
          <Text style={styles.deptAbbrText}>{deptAbbr}</Text>
          <Text style={styles.deptTotalText}>{row.totalStudents} Students</Text>
        </View>

        {/* Right Side: Stacked Bar & Stats */}
        <View style={styles.deptMetricsContainer}>
          {/* Stat Badges */}
          <View style={styles.deptStatsRow}>
            <View style={styles.statBadge}>
              <View
                style={[styles.statBadgeDot, { backgroundColor: "#22C55E" }]}
              />
              <Text style={[styles.statBadgeText, { color: "#16A34A" }]}>
                {row.lowCount} ({row.lowPct}%)
              </Text>
            </View>
            <View style={styles.statBadge}>
              <View
                style={[styles.statBadgeDot, { backgroundColor: "#F59E0B" }]}
              />
              <Text style={[styles.statBadgeText, { color: "#D97706" }]}>
                {row.normalCount} ({row.normalPct}%)
              </Text>
            </View>
            <View style={styles.statBadge}>
              <View
                style={[styles.statBadgeDot, { backgroundColor: "#EF4444" }]}
              />
              <Text style={[styles.statBadgeText, { color: "#DC2626" }]}>
                {row.highCount} ({row.highPct}%)
              </Text>
            </View>
          </View>

          {/* Unified Stacked Progress Bar */}
          <View style={styles.stackedBarTrack}>
            {row.lowPct > 0 && (
              <View
                style={[
                  styles.stackedBarFill,
                  { width: `${row.lowPct}%`, backgroundColor: "#22C55E" },
                ]}
              />
            )}
            {row.normalPct > 0 && (
              <View
                style={[
                  styles.stackedBarFill,
                  { width: `${row.normalPct}%`, backgroundColor: "#F59E0B" },
                ]}
              />
            )}
            {row.highPct > 0 && (
              <View
                style={[
                  styles.stackedBarFill,
                  { width: `${row.highPct}%`, backgroundColor: "#EF4444" },
                ]}
              />
            )}
          </View>
        </View>
      </Pressable>
    );
  };

  const renderDonutChart = (slices: DonutSlice[]) => {
    // Strictly count how many students actually took it for the donut hole label
    const totalAssessed = studentSummaries.filter(
      (s) => s.assessmentsCount > 0,
    ).length;

    return (
      <View style={styles.bottomWidget}>
        <Text style={styles.bottomWidgetTitle}>
          Overall Concern Distribution
        </Text>
        <View style={styles.donutContainer}>
          <View style={styles.donutRing}>
            {slices.map((slice) => (
              <View
                key={slice.label}
                style={[
                  styles.donutSegment,
                  {
                    backgroundColor: slice.color,
                    flex: slice.value,
                  },
                ]}
              />
            ))}
            <View style={styles.donutHole}>
              <Text style={styles.donutHoleValue}>{totalAssessed}</Text>
              <Text style={styles.donutHoleLabel}>Assessed</Text>
            </View>
          </View>
          <View style={styles.donutLegend}>
            {slices.map((slice) => (
              <Pressable
                key={slice.label}
                style={styles.donutLegendItem}
                onPress={() =>
                  setStudentListModal({
                    visible: true,
                    title: `${slice.label} Students`,
                  })
                }
              >
                <View
                  style={[styles.donutDot, { backgroundColor: slice.color }]}
                />
                <Text style={styles.donutLegendText}>
                  {slice.label}: {slice.value}%
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    );
  };

  const renderRadialProgress = (pct: number) => {
    const clampedPct = Math.min(Math.max(pct, 0), 100);
    return (
      <Pressable
        style={styles.bottomWidget}
        onPress={() =>
          setStudentListModal({
            visible: true,
            title: "Survey Assessment Status",
          })
        }
      >
        <Text style={styles.bottomWidgetTitle}>Survey Assessment Status</Text>
        <View style={styles.radialContainer}>
          <View style={styles.radialRing}>
            <View style={styles.radialBg} />
            <View
              style={[
                styles.radialFill,
                {
                  backgroundColor: "#7C3AED",
                  height: `${clampedPct}%`,
                },
              ]}
            />
            <View style={styles.radialHole}>
              <Text style={styles.radialPctText}>{clampedPct}%</Text>
              <Text style={styles.radialLabelText}>Completed</Text>
            </View>
          </View>
          <Text style={styles.radialFooterText}>
            Students who took assessment
          </Text>
        </View>
      </Pressable>
    );
  };

  const renderComparativeChart = (metrics: EngagementMetric[]) => {
    return (
      <View style={styles.bottomWidget}>
        <Text style={styles.bottomWidgetTitle}>Detailed Engagement Report</Text>
        <View style={styles.compChartContainer}>
          {metrics.map((metric) => {
            const barHeightPct = Math.min(
              Math.max((metric.value / metric.maxValue) * 100, 0),
              100,
            );
            return (
              <Pressable
                key={metric.label}
                style={styles.compBarColumn}
                onPress={() =>
                  setStudentListModal({ visible: true, title: metric.label })
                }
              >
                <Text style={styles.compBarValue}>{metric.value}</Text>
                <View style={styles.compBarTrackVertical}>
                  <View
                    style={[
                      styles.compBarFillVertical,
                      {
                        height: `${barHeightPct}%`,
                        backgroundColor: "#7C3AED",
                      },
                    ]}
                  />
                </View>
                <Text style={styles.compBarLabel}>
                  {metric.label === "Signed In / Took Assessment"
                    ? "Signed In\nTook Assessment"
                    : "Took\npredicted soon"}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  };

  function getFilterFnForTitle(title: string): (s: StudentSummary) => boolean {
    const lowerTitle = title.toLowerCase();

    if (lowerTitle.includes("low concern")) {
      if (lowerTitle.includes("students"))
        return (s) => s.latestRiskLevel === "low";
      const dept = title.split(" - ")[0];
      return (s) => s.department === dept && s.latestRiskLevel === "low";
    }
    if (
      lowerTitle.includes("medium concern") ||
      lowerTitle.includes("moderate concern")
    ) {
      if (lowerTitle.includes("students"))
        return (s) => s.latestRiskLevel === "normal";
      const dept = title.split(" - ")[0];
      return (s) => s.department === dept && s.latestRiskLevel === "normal";
    }
    if (lowerTitle.includes("high concern")) {
      if (lowerTitle.includes("students"))
        return (s) => s.latestRiskLevel === "high";
      const dept = title.split(" - ")[0];
      return (s) => s.department === dept && s.latestRiskLevel === "high";
    }
    if (lowerTitle.includes("special needs (lsn)")) {
      if (lowerTitle.includes("students")) return (s) => s.isLSN === true;
      const dept = title.split(" - ")[0];
      return (s) => s.department === dept && s.isLSN === true;
    }
    if (lowerTitle === "survey assessment status") {
      return () => true;
    }
    if (lowerTitle.includes("signed in") || lowerTitle.includes("took")) {
      return (s) => s.assessmentsCount > 0;
    }

    return (s) => s.department === title;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.mainLayout}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Analytics Overview</Text>
          <View style={styles.headerActions}>
            <Pressable
              style={styles.profileButton}
              onPress={() => router.push("/profile")}
            >
              <Ionicons
                name="person-circle-outline"
                size={20}
                color="#0F172A"
              />
            </Pressable>
            <Pressable
              style={styles.signOutButton}
              onPress={() => {
                setSignOutError(null);
                setSignOutConfirmVisible(true);
              }}
            >
              <Ionicons name="log-out-outline" size={20} color="#EF4444" />
            </Pressable>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.tabBar}>
            <Pressable
              style={
                activeTab === "students"
                  ? [styles.tabButton, styles.tabButtonActive]
                  : styles.tabButton
              }
              onPress={() => setActiveTab("students")}
            >
              <Text
                style={
                  activeTab === "students"
                    ? [styles.tabLabel, styles.tabLabelActive]
                    : styles.tabLabel
                }
              >
                Student Lookup
              </Text>
            </Pressable>
            <Pressable
              style={
                activeTab === "analytics"
                  ? [styles.tabButton, styles.tabButtonActive]
                  : styles.tabButton
              }
              onPress={() => setActiveTab("analytics")}
            >
              <Text
                style={
                  activeTab === "analytics"
                    ? [styles.tabLabel, styles.tabLabelActive]
                    : styles.tabLabel
                }
              >
                Department Analytics
              </Text>
            </Pressable>
          </View>

          {loading ? (
            <View style={styles.stateCard}>
              <ActivityIndicator size="large" color="#3B82F6" />
              <Text style={styles.stateText}>Loading admin dashboard...</Text>
            </View>
          ) : error ? (
            <View style={styles.stateCard}>
              <Text style={styles.stateText}>{error}</Text>
            </View>
          ) : (
            <>
              {activeTab === "students" ? (
                <>
                  <View style={styles.lookupCard}>
                    <View style={styles.lookupHeader}>
                      <Text style={styles.sectionTitle}>Student Lookup</Text>
                      <Pressable
                        style={styles.createAdminButton}
                        onPress={() => setCreateAdminModalVisible(true)}
                      >
                        <Ionicons name="person-add" size={16} color="white" />
                        <Text style={styles.createAdminButtonText}>
                          Create Admin
                        </Text>
                      </Pressable>
                    </View>
                    <TextInput
                      style={styles.searchInput}
                      placeholder="Search by name, ID, year, or department"
                      placeholderTextColor="#94A3B8"
                      value={searchTerm}
                      onChangeText={handleSearchChange}
                    />
                  </View>

                  {paginatedStudents.length === 0 ? (
                    <View style={styles.stateCard}>
                      <Text style={styles.stateText}>
                        No students match your search.
                      </Text>
                    </View>
                  ) : (
                    paginatedStudents.map((student) => {
                      const moods = Object.entries(student.moodCounts)
                        .sort(([, a], [, b]) => b - a)
                        .map(([mood, count]) => `${mood} (${count})`)
                        .slice(0, 3)
                        .join(", ");

                      return (
                        <Pressable
                          key={student.uid}
                          style={styles.studentCard}
                          onPress={() =>
                            router.push({
                              pathname: "./student-detail",
                              params: { uid: student.uid },
                            })
                          }
                        >
                          <View style={styles.studentHeader}>
                            <View style={styles.studentIdentityBlock}>
                              <Text style={styles.studentName}>
                                {student.name}
                              </Text>
                              <Text style={styles.studentMeta}>
                                {student.yearLevel}
                              </Text>
                            </View>
                            <View style={styles.studentInfoBlock}>
                              <Text style={styles.studentId}>
                                {student.schoolId}
                              </Text>
                              <Text style={styles.studentCourse}>
                                {student.department}
                              </Text>
                            </View>
                          </View>
                          <View style={styles.studentStatsRow}>
                            <View style={styles.statItem}>
                              <Text style={styles.statLabel}>Assessments</Text>
                              <Text style={styles.statValue}>
                                {student.assessmentsCount}
                              </Text>
                            </View>
                            <View style={styles.statItem}>
                              <Text style={styles.statLabel}>Journals</Text>
                              <Text style={styles.statValue}>
                                {student.journalCount}
                              </Text>
                            </View>
                          </View>
                          <View style={styles.studentStatsRow}>
                            <View style={styles.statItemWide}>
                              <Text style={styles.statLabel}>
                                Latest Concern
                              </Text>
                              <Text
                                style={[
                                  styles.statValueHighlight,
                                  student.latestRiskLevel === "low"
                                    ? styles.riskLow
                                    : student.latestRiskLevel === "high"
                                      ? styles.riskHigh
                                      : styles.riskNormal,
                                ]}
                              >
                                {student.latestRiskLevel
                                  ? student.latestRiskLevel.toUpperCase()
                                  : "N/A"}
                              </Text>
                            </View>
                            <View style={styles.statItemWide}>
                              <Text style={styles.statLabel}>Latest Score</Text>
                              <Text style={styles.statValueHighlight}>
                                {student.latestTotalScore ?? "N/A"}
                              </Text>
                            </View>
                          </View>
                          <View style={styles.studentStatsRow}>
                            <View style={styles.statItemWide}>
                              <Text style={styles.statLabel}>
                                Last Assessment
                              </Text>
                              <Text style={styles.statValue}>
                                {student.latestAssessmentDate
                                  ? student.latestAssessmentDate.toLocaleDateString()
                                  : "N/A"}
                              </Text>
                            </View>
                            <View style={styles.statItemWide}>
                              <Text style={styles.statLabel}>Recent Mood</Text>
                              <Text style={styles.statValue}>
                                {student.latestJournalMood || "None"}
                              </Text>
                            </View>
                          </View>
                          {moods ? (
                            <Text style={styles.moodSummary}>
                              Moods: {moods}
                            </Text>
                          ) : null}
                          <Pressable
                            style={styles.removeButton}
                            onPress={() => {
                              setConfirmRemoveUid(student.uid);
                              setConfirmRemoveName(student.name);
                            }}
                          >
                            <Ionicons
                              name="trash-outline"
                              size={16}
                              color="#EF4444"
                            />
                            <Text style={styles.removeButtonText}>
                              Remove Student
                            </Text>
                          </Pressable>
                        </Pressable>
                      );
                    })
                  )}
                  {totalPages > 1 && (
                    <View style={styles.paginationContainer}>
                      <Pressable
                        style={[
                          styles.paginationButton,
                          currentPage === 1 && styles.paginationButtonDisabled,
                        ]}
                        onPress={() =>
                          setCurrentPage((p) => Math.max(1, p - 1))
                        }
                        disabled={currentPage === 1}
                      >
                        <Ionicons
                          name="chevron-back"
                          size={18}
                          color={currentPage === 1 ? "#94A3B8" : "#0F172A"}
                        />
                      </Pressable>
                      <Text style={styles.paginationText}>
                        Page {currentPage} of {totalPages}
                      </Text>
                      <Pressable
                        style={[
                          styles.paginationButton,
                          currentPage === totalPages &&
                            styles.paginationButtonDisabled,
                        ]}
                        onPress={() =>
                          setCurrentPage((p) => Math.min(totalPages, p + 1))
                        }
                        disabled={currentPage === totalPages}
                      >
                        <Ionicons
                          name="chevron-forward"
                          size={18}
                          color={
                            currentPage === totalPages ? "#94A3B8" : "#0F172A"
                          }
                        />
                      </Pressable>
                    </View>
                  )}
                </>
              ) : (
                <>
                  <LinearGradient
                    colors={["#4C1D95", "#6D28D9", "#9333EA"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.analyticsHero}
                  >
                    <View style={styles.analyticsHeroTopRow}>
                      <View style={styles.analyticsHeroIcon}>
                        <Ionicons
                          name="stats-chart"
                          size={25}
                          color="#FFFFFF"
                        />
                      </View>
                      <Text style={styles.analyticsHeroEyebrow}>
                        LIVE WELLNESS OVERVIEW
                      </Text>
                    </View>
                    <Text style={styles.analyticsHeroTitle}>
                      Department Analytics
                    </Text>
                    <Text style={styles.analyticsHeroSubtitle}>
                      Monitor participation and wellness trends across the
                      university.
                    </Text>
                    <View style={styles.analyticsHeroMetrics}>
                      <View style={styles.analyticsHeroMetric}>
                        <Text style={styles.analyticsHeroMetricValue}>
                          {studentSummaries.length}
                        </Text>
                        <Text style={styles.analyticsHeroMetricLabel}>
                          Students tracked
                        </Text>
                      </View>
                      <View style={styles.analyticsHeroMetricDivider} />
                      <View style={styles.analyticsHeroMetric}>
                        <Text style={styles.analyticsHeroMetricValue}>
                          {surveyCompletionPct}%
                        </Text>
                        <Text style={styles.analyticsHeroMetricLabel}>
                          Assessment completion
                        </Text>
                      </View>
                    </View>
                  </LinearGradient>

                  {/* ─── SECTION 1: KPI Cards ───────────────────────────────── */}
                  <Text style={styles.sectionHeader}>
                    Key Performance Indicators
                  </Text>
                  <View style={styles.kpiRow}>
                    {kpiData.map((kpi, i) => renderKpiCard(kpi, i))}
                  </View>

                  {/* ─── SECTION 2: Department Table ────────────────────────── */}
                  <Text style={styles.sectionHeader}>
                    Assessment Participation by Department
                  </Text>
                  <View style={styles.deptTableCard}>
                    {departmentRows.length === 0 ? (
                      <View style={styles.stateCard}>
                        <Text style={styles.stateText}>
                          No department data available yet.
                        </Text>
                      </View>
                    ) : (
                      departmentRows.map((row) => renderDepartmentRow(row))
                    )}
                  </View>

                  {/* ─── SECTION 3: Visual Insights ─────────────────────────── */}
                  <Text style={styles.sectionHeader}>Visual Insights</Text>
                  <View style={styles.chartsRow}>
                    {renderDonutChart(donutData)}
                    {renderRadialProgress(surveyCompletionPct)}
                    {renderComparativeChart(engagementData)}
                  </View>
                </>
              )}
            </>
          )}
        </ScrollView>

        {studentListModal && (
          <StudentListModal
            visible={studentListModal.visible}
            title={studentListModal.title}
            students={modalStudents}
            onClose={() => setStudentListModal(null)}
          />
        )}

        <Modal
          visible={isCreateAdminModalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setCreateAdminModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Create New Admin</Text>
                <Pressable
                  style={styles.modalCloseButton}
                  onPress={() => setCreateAdminModalVisible(false)}
                >
                  <Ionicons name="close" size={24} color="#0F172A" />
                </Pressable>
              </View>
              <ScrollView
                style={styles.modalScroll}
                contentContainerStyle={styles.modalScrollContent}
              >
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Full Name</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="Admin's full name"
                    value={newAdminName}
                    onChangeText={setNewAdminName}
                    autoCapitalize="words"
                  />
                </View>
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Email</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="admin@example.com"
                    value={newAdminEmail}
                    onChangeText={setNewAdminEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Password</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="Create a strong password"
                    value={newAdminPassword}
                    onChangeText={setNewAdminPassword}
                    secureTextEntry
                  />
                  <Text style={styles.formHelpText}>
                    Password must be at least 6 characters.
                  </Text>
                </View>

                {createAdminError && (
                  <Text style={styles.errorText}>{createAdminError}</Text>
                )}

                <Pressable
                  style={[
                    styles.confirmDeleteButton,
                    { marginTop: 16, backgroundColor: "#3B82F6" },
                    creatingAdmin && { opacity: 0.7 },
                  ]}
                  onPress={handleCreateAdmin}
                  disabled={creatingAdmin}
                >
                  {creatingAdmin ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <Text
                      style={[
                        styles.confirmDeleteText,
                        { textTransform: "none" },
                      ]}
                    >
                      Create Admin Account
                    </Text>
                  )}
                </Pressable>
              </ScrollView>
            </View>
          </View>
        </Modal>

        <Modal
          visible={confirmRemoveUid !== null}
          animationType="fade"
          transparent={true}
          onRequestClose={() => setConfirmRemoveUid(null)}
        >
          <View style={styles.confirmOverlay}>
            <View style={styles.confirmContainer}>
              <Ionicons name="warning-outline" size={48} color="#EF4444" />
              <Text style={styles.confirmTitle}>Remove Student</Text>
              <Text style={styles.confirmText}>
                This will permanently delete {confirmRemoveName}&#39;s account,
                including all assessments, journal entries, and profile data.
                This action cannot be undone.
              </Text>

              {removalStatus ? (
                <View style={{ alignItems: "center", gap: 8 }}>
                  <ActivityIndicator size="small" color="#EF4444" />
                  <Text style={styles.removalStatusText}>{removalStatus}</Text>
                </View>
              ) : (
                <View style={styles.confirmActions}>
                  <Pressable
                    style={styles.confirmCancelButton}
                    onPress={() => {
                      setConfirmRemoveUid(null);
                      setConfirmRemoveName("");
                      setRemovalStatus("");
                    }}
                  >
                    <Text style={styles.confirmCancelText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    style={styles.confirmDeleteButton}
                    onPress={() => {
                      if (confirmRemoveUid) {
                        handleRemoveStudent(confirmRemoveUid);
                      }
                    }}
                  >
                    <Text style={styles.confirmDeleteText}>
                      {removingStudent === confirmRemoveUid
                        ? "Removing..."
                        : "Remove"}
                    </Text>
                  </Pressable>
                </View>
              )}
            </View>
          </View>
        </Modal>

        <Modal
          visible={isSignOutConfirmVisible}
          animationType="fade"
          transparent={true}
          onRequestClose={() => {
            if (!isSigningOut) setSignOutConfirmVisible(false);
          }}
        >
          <View style={styles.confirmOverlay}>
            <View style={styles.confirmContainer}>
              <Ionicons name="log-out-outline" size={48} color="#EF4444" />
              <Text style={styles.confirmTitle}>Sign Out</Text>
              <Text style={styles.confirmText}>
                Are you sure you want to sign out of the admin dashboard?
              </Text>
              {signOutError && (
                <Text style={styles.errorText}>{signOutError}</Text>
              )}
              <View style={styles.confirmActions}>
                <Pressable
                  style={styles.confirmCancelButton}
                  onPress={() => setSignOutConfirmVisible(false)}
                  disabled={isSigningOut}
                >
                  <Text style={styles.confirmCancelText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={styles.confirmDeleteButton}
                  onPress={handleAdminSignOut}
                  disabled={isSigningOut}
                >
                  {isSigningOut ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <Text style={styles.confirmDeleteText}>Sign Out</Text>
                  )}
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F4F7FE" },
  mainLayout: { flex: 1, backgroundColor: "#F4F7FE" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  headerTitle: { color: "#0F172A", fontSize: 20, fontWeight: "800" },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  profileButton: {
    padding: 8,
    borderRadius: 999,
    backgroundColor: "#F1F5F9",
  },
  signOutButton: {
    padding: 8,
    borderRadius: 999,
    backgroundColor: "#FEF2F2",
  },
  content: { padding: 24, paddingBottom: 40 },
  analyticsHero: {
    borderRadius: 24,
    padding: 22,
    marginBottom: 24,
    overflow: "hidden",
    boxShadow: "0px 12px 28px rgba(91, 33, 182, 0.28)",
    elevation: 8,
  },
  analyticsHeroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 18,
  },
  analyticsHeroIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.18)",
    justifyContent: "center",
    alignItems: "center",
  },
  analyticsHeroEyebrow: {
    color: "#EDE9FE",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.1,
  },
  analyticsHeroTitle: {
    color: "#FFFFFF",
    fontSize: 27,
    fontWeight: "900",
    letterSpacing: -0.4,
  },
  analyticsHeroSubtitle: {
    color: "#F3E8FF",
    fontSize: 14,
    lineHeight: 21,
    marginTop: 7,
    maxWidth: 470,
  },
  analyticsHeroMetrics: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 22,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.22)",
  },
  analyticsHeroMetric: { flex: 1 },
  analyticsHeroMetricDivider: {
    width: 1,
    height: 38,
    marginHorizontal: 16,
    backgroundColor: "rgba(255,255,255,0.26)",
  },
  analyticsHeroMetricValue: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "900",
  },
  analyticsHeroMetricLabel: {
    color: "#EDE9FE",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 3,
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: "#EDE9FE",
    borderRadius: 16,
    padding: 4,
    marginBottom: 24,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  tabButtonActive: {
    backgroundColor: "#6D28D9",
    // @ts-ignore - web only
    boxShadow: "0px 2px 8px rgba(0, 0, 0, 0.05)",
  },
  tabLabel: {
    color: "#64748B",
    fontWeight: "700",
    fontSize: 13,
  },
  tabLabelActive: {
    color: "#FFFFFF",
  },
  stateCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    // @ts-ignore - web only
    boxShadow: "0px 4px 20px rgba(0, 0, 0, 0.04)",
  },
  stateText: { marginTop: 12, color: "#334155", fontSize: 14 },
  sectionHeader: {
    color: "#4C1D95",
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 14,
    marginTop: 12,
    letterSpacing: 0.3,
  },
  kpiRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
    marginBottom: 24,
  },
  kpiCard: {
    width: "48%",
    borderRadius: 20,
    padding: 20,
    gap: 8,
    minWidth: "47%",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E9D5FF", // @ts-ignore - web only
    boxShadow: "0px 8px 22px rgba(109, 40, 217, 0.10)",
  },
  kpiHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  kpiIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  kpiChangeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    backgroundColor: "#F5F3FF",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  kpiChangeText: {
    fontSize: 11,
    fontWeight: "800",
  },
  kpiCount: {
    fontSize: 32,
    fontWeight: "900",
    marginTop: 4,
    color: "#3B0764",
  },
  kpiLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#6B21A8",
  },
  kpiBaseline: {
    fontSize: 11,
    color: "#8B5CF6",
    fontWeight: "600",
  },
  // ─── Modern Department List Styles ──────────────────────────────────────
  deptTableCard: {
    backgroundColor: "#FDFBFF",
    borderRadius: 20,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#E9D5FF",
    // @ts-ignore
    boxShadow: "0px 8px 22px rgba(109, 40, 217, 0.08)",
  },
  deptCardItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#EDE9FE",
    flexWrap: "wrap", // Helps it look good if the screen gets small
    gap: 16,
  },
  deptMainInfo: {
    minWidth: 120,
  },
  deptAbbrText: {
    fontSize: 16,
    fontWeight: "900",
    color: "#581C87",
  },
  deptTotalText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#8B5CF6",
    marginTop: 4,
  },
  deptMetricsContainer: {
    flex: 1,
    minWidth: 250, // Prevents it from crushing too small on web
    maxWidth: 600, // Stops the "long line" stretching on wide monitors
  },
  deptStatsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  statBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statBadgeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statBadgeText: {
    fontSize: 12,
    fontWeight: "800",
  },
  stackedBarTrack: {
    width: "100%",
    height: 10,
    backgroundColor: "#EDE9FE",
    borderRadius: 5,
    flexDirection: "row",
    overflow: "hidden",
  },
  stackedBarFill: {
    height: "100%",
    // Adds a tiny white border between colors for a polished look
    borderRightWidth: 1,
    borderRightColor: "#FFFFFF",
  },
  chartsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
    marginBottom: 24,
  },
  bottomWidget: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 18,
    width: "48%",
    flex: 1,
    minWidth: 200,
    borderWidth: 1,
    borderColor: "#E9D5FF",
    boxShadow: "0px 8px 22px rgba(109, 40, 217, 0.10)",
    elevation: 4,
  },
  bottomWidgetTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#581C87",
    marginBottom: 14,
    textAlign: "center",
  },
  donutContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  donutRing: {
    width: 100,
    height: 100,
    borderRadius: 50,
    flexDirection: "row",
    overflow: "hidden",
    position: "relative",
    backgroundColor: "#F5F3FF",
  },
  donutSegment: {
    height: "100%",
  },
  donutHole: {
    position: "absolute",
    top: 15,
    left: 15,
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "white",
    alignItems: "center",
    justifyContent: "center",
  },
  donutHoleValue: {
    fontSize: 18,
    fontWeight: "900",
    color: "#581C87",
  },
  donutHoleLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: "#8B5CF6",
    textTransform: "uppercase",
  },
  donutLegend: {
    flex: 1,
    gap: 8,
  },
  donutLegendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  donutDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  donutLegendText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B21A8",
  },
  radialContainer: {
    alignItems: "center",
    gap: 12,
  },
  radialRing: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#F5F3FF",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "flex-end",
    position: "relative",
  },
  radialBg: {
    position: "absolute",
    width: "100%",
    height: "100%",
    borderRadius: 60,
    borderWidth: 8,
    borderColor: "#E9D5FF",
  },
  radialFill: {
    width: "100%",
    borderTopLeftRadius: 60,
    borderTopRightRadius: 60,
  },
  radialHole: {
    position: "absolute",
    top: 20,
    left: 20,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "white",
    alignItems: "center",
    justifyContent: "center",
  },
  radialPctText: {
    fontSize: 20,
    fontWeight: "900",
    color: "#6D28D9",
  },
  radialLabelText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#8B5CF6",
    textTransform: "uppercase",
  },
  radialFooterText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#8B5CF6",
    textAlign: "center",
    marginTop: 4,
  },
  compChartContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "flex-end",
    gap: 8,
    flex: 1,
    minHeight: 120,
  },
  compBarColumn: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  compBarLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: "#6B21A8",
    textAlign: "center",
    lineHeight: 12,
  },
  compBarTrackVertical: {
    width: 32,
    height: 80,
    backgroundColor: "#F5F3FF",
    borderRadius: 8,
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  compBarFillVertical: {
    width: "100%",
    borderRadius: 8,
  },
  compBarValue: {
    fontSize: 12,
    fontWeight: "800",
    color: "#6D28D9",
    textAlign: "center",
  },
  lookupCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#F1F5F9", // @ts-ignore - web only
    boxShadow: "0px 6px 20px rgba(0, 0, 0, 0.04)",
  },
  lookupHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
  },
  searchInput: {
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    color: "#0F172A",
    fontSize: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  createAdminButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#3B82F6",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  createAdminButtonText: {
    color: "white",
    fontWeight: "700",
    fontSize: 13,
  },
  studentCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#F1F5F9", // @ts-ignore - web only
    boxShadow: "0px 6px 20px rgba(0, 0, 0, 0.04)",
  },
  studentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  studentIdentityBlock: {
    flex: 1,
    paddingRight: 12,
  },
  studentInfoBlock: {
    alignItems: "flex-end",
    maxWidth: "45%",
  },
  studentName: { fontSize: 16, fontWeight: "800", color: "#0F172A" },
  studentId: {
    fontSize: 13,
    fontWeight: "800",
    color: "#3B82F6",
    textAlign: "right",
  },
  studentCourse: {
    fontSize: 12,
    fontWeight: "700",
    color: "#334155",
    marginTop: 2,
    textAlign: "right",
  },
  studentMeta: { fontSize: 12, color: "#64748B", marginTop: 2 },
  studentStatsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  statItem: { width: "48%" },
  statItemWide: { width: "48%" },
  statLabel: {
    fontSize: 11,
    color: "#64748B",
    marginBottom: 4,
    textTransform: "uppercase",
    fontWeight: "700",
  },
  statValue: { fontSize: 15, fontWeight: "700", color: "#0F172A" },
  statValueHighlight: { fontSize: 15, fontWeight: "800", color: "#3B82F6" },
  moodSummary: { color: "#334155", fontSize: 13, marginTop: 6 },
  riskLow: { color: "#16A34A", fontWeight: "800" },
  riskNormal: { color: "#D97706", fontWeight: "800" },
  riskHigh: { color: "#EF4444", fontWeight: "800" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: "85%",
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
    flex: 1,
  },
  modalCloseButton: {
    padding: 8,
    borderRadius: 999,
    backgroundColor: "#F1F5F9",
  },
  modalScroll: {
    flex: 1,
  },
  modalScrollContent: {
    padding: 24,
  },
  removeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FEE2E2",
    backgroundColor: "#FEF2F2",
    gap: 6,
  },
  removeButtonText: {
    color: "#EF4444",
    fontWeight: "700",
    fontSize: 13,
  },
  confirmOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  confirmContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 24,
    width: "100%",
    maxWidth: 360,
    alignItems: "center",
    gap: 16,
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
    textAlign: "center",
  },
  confirmText: {
    fontSize: 14,
    color: "#475569",
    textAlign: "center",
    lineHeight: 20,
  },
  confirmActions: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  confirmCancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
  },
  confirmCancelText: {
    fontWeight: "700",
    color: "#334155",
    fontSize: 14,
  },
  confirmDeleteButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#EF4444",
    alignItems: "center",
  },
  confirmDeleteText: {
    fontWeight: "700",
    color: "white",
    fontSize: 14,
  },
  removalStatusText: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    marginTop: 8,
  },
  formGroup: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#334155",
    marginBottom: 8,
  },
  formInput: {
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    color: "#0F172A",
    fontSize: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  formHelpText: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 6,
  },
  errorText: {
    color: "#EF4444",
    textAlign: "center",
    marginVertical: 8,
  },
  paginationContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 20,
    gap: 12,
  },
  paginationButton: {
    backgroundColor: "#FFFFFF",
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  paginationButtonDisabled: {
    backgroundColor: "#F1F5F9",
    opacity: 0.6,
  },
  paginationText: {
    color: "#0F172A",
    fontSize: 14,
    fontWeight: "700",
    minWidth: 100,
    textAlign: "center",
  },
});
