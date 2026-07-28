import { API_URL } from "@/backend/config";
import { StudentListModal } from "@/components/admin/StudentListModal";
import { db } from "@/constants/firebase";
import { useAuth } from "@/hooks/AuthContext";
import { listenForAdminDashboardData } from "@/services/adminFirestoreService";
import {
  listenForAnnouncements,
  createAnnouncement,
  deleteAnnouncement as deleteAnnouncementService,
  cleanupExpiredAnnouncements,
  formatAnnouncementDateTime,
  getDaysRemaining,
} from "@/services/announcementService";
import type { Announcement, AnnouncementLink } from "@/types/announcement";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import {
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    setDoc,
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

const COLLEGES = [
  "Saint Louis University (SLU)",
  "University of the Philippines Baguio (UPB)",
  "University of Baguio (UB)",
  "University of the Cordilleras (UC)",
  "Baguio Central University (BCU)",
  "Pines City Colleges (PCC)",
  "Baguio College of Technology (BCT)",
  "Philippine Military Academy (PMA)",
  "Easter College (EC)",
  "BSBT College",
  "Asia Pacific Theological Seminary (APTS)",
  "Data Center College of the Philippines (DCCP)",
  "STI College Baguio",
  "Benguet State University (BSU)",
  "Cordillera Career Development College (CCDC)",
  "King's College of the Philippines (KCP)",
  "Philippine Nazarene College (PNC)",
  "Philippine College of Ministry (PCM)",
  "BVS Colleges",
  "Concordia College of Benguet",
  "Star Colleges",
];

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
  specialNeedsType?: string;
  profileImage?: string;
  lsnDocument?: {
    fileName?: string;
    secureUrl?: string;
  } | null;
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

// ─── Summary KPI (top-level overview cards) ──────────────────────────────────
interface SummaryKpiData {
  label: string;
  value: string | number;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bgColor: string;
  subtitle?: string;
}

// ─── Per-Department KPI ──────────────────────────────────────────────────────
interface PerDepartmentKpi {
  deptName: string;
  deptAbbr: string;
  avgScore: number;
  journalEntries: number;
  lsnStudents: number;
  topMood: string;
}

// ─── Comparison Insight ──────────────────────────────────────────────────────
interface ComparisonInsightData {
  label: string;
  deptName: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bgColor: string;
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
  const [activeTab, setActiveTab] = useState<"students" | "analytics" | "announcements">(
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
  const [newAdminIdNo, setNewAdminIdNo] = useState("");
  const [newAdminPosition, setNewAdminPosition] = useState("");
  const [newAdminContactNo, setNewAdminContactNo] = useState("");
  const [newAdminGender, setNewAdminGender] = useState("");
  const [newAdminNationality, setNewAdminNationality] = useState("");
  const [newAdminAddress, setNewAdminAddress] = useState("");
  const [newAdminCollege, setNewAdminCollege] = useState("");
  const [newAdminCollegeSearch, setNewAdminCollegeSearch] = useState("");
  const [adminCollege, setAdminCollege] = useState("");
  const [isSignOutConfirmVisible, setSignOutConfirmVisible] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  // Announcements
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementDescription, setAnnouncementDescription] = useState("");
  const [announcementLinks, setAnnouncementLinks] = useState<AnnouncementLink[]>([]);
  const [creatingAnnouncement, setCreatingAnnouncement] = useState(false);
  const [announcementError, setAnnouncementError] = useState<string | null>(null);
  const [deleteAnnounceId, setDeleteAnnounceId] = useState<string | null>(null);

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

    getDoc(doc(db, "admins", user.uid)).then((snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.college) setAdminCollege(data.college);
      }
    }).catch(() => {});

    return () => {
      unsubData();
    };
  }, [user]);

  useEffect(() => {
    const unsub = listenForAnnouncements((data) => setAnnouncements(data));
    // Clean up expired announcements in the background
    cleanupExpiredAnnouncements().then((count) => {
      if (count > 0) console.log(`Cleaned up ${count} expired announcements`);
    });
    return () => unsub();
  }, []);

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

  // ─── Computed Risk Trend KPI Data ─────────────────────────────────────────
  const riskTrendKpiData = useMemo((): KpiCardData[] => {
    const total = studentSummaries.length || 1;
    const atRisk = studentSummaries.filter(
      (s) => s.latestRiskLevel === "normal" || s.latestRiskLevel === "high",
    ).length;
    const healthy = studentSummaries.filter(
      (s) => s.latestRiskLevel === "low",
    ).length;
    const totalLSN = studentSummaries.filter((s) => s.isLSN).length;
    const pctAtRisk = Math.round(
      (atRisk / (studentSummaries.length || 1)) * 100,
    );

    const pctChange = (current: number, baseline: number) =>
      baseline > 0
        ? Math.round(((current - baseline) / baseline) * 100)
        : current > 0
          ? 100
          : 0;

    const baselineAtRisk = Math.round(atRisk * 0.9) || 1;
    const baselineHealthy = Math.round(healthy * 0.9) || 1;
    const baselineLSN = Math.round(totalLSN * 0.9) || 1;

    return [
      {
        riskLabel: "At-Risk Students",
        count: atRisk,
        percentageChange: pctChange(atRisk, baselineAtRisk),
        baselineCount: baselineAtRisk,
        color: "#DC2626",
        bgColor: "#FEE2E2",
        icon: "warning",
      },
      {
        riskLabel: "Healthy Students",
        count: healthy,
        percentageChange: pctChange(healthy, baselineHealthy),
        baselineCount: baselineHealthy,
        color: "#16A34A",
        bgColor: "#DCFCE7",
        icon: "shield-checkmark",
      },
      {
        riskLabel: "% At Risk",
        count: pctAtRisk,
        percentageChange: 0,
        baselineCount: 0,
        color:
          pctAtRisk < 30
            ? "#16A34A"
            : pctAtRisk <= 60
              ? "#D97706"
              : "#EF4444",
        bgColor: "#F5F3FF",
        icon: "analytics",
      },
      {
        riskLabel: "LSN Students",
        count: totalLSN,
        percentageChange: pctChange(totalLSN, baselineLSN),
        baselineCount: baselineLSN,
        color: "#7C3AED",
        bgColor: "#EDE9FE",
        icon: "accessibility",
      },
    ];
  }, [studentSummaries]);

  // ─── Computed Overall Summary KPI Data ────────────────────────────────────
  const summaryKpiData = useMemo((): SummaryKpiData[] => {
    const totalStudents = studentSummaries.length;
    const studentsWithAssessments = studentSummaries.filter(
      (s) => s.assessmentsCount > 0,
    ).length;
    const totalScoreSum = analyticsData.department.reduce(
      (sum, d) => sum + d.scoreSum,
      0,
    );
    const totalAssessments = analyticsData.department.reduce(
      (sum, d) => sum + d.total,
      0,
    );
    const avgScore =
      totalAssessments > 0
        ? (totalScoreSum / totalAssessments).toFixed(1)
        : "0";
    const totalJournals = studentSummaries.reduce(
      (sum, s) => sum + s.journalCount,
      0,
    );
    const completionRate =
      totalStudents > 0
        ? Math.round((studentsWithAssessments / totalStudents) * 100)
        : 0;

    return [
      {
        label: "Students Assessed",
        value: studentsWithAssessments,
        icon: "school",
        color: "#6D28D9",
        bgColor: "#F3E8FF",
        subtitle: `of ${totalStudents} total`,
      },
      {
        label: "Avg Wellness Score",
        value: avgScore,
        icon: "heart",
        color: "#7C3AED",
        bgColor: "#EDE9FE",
        subtitle: "out of 100",
      },
      {
        label: "Journal Entries",
        value: totalJournals,
        icon: "book",
        color: "#5B21B6",
        bgColor: "#DDD6FE",
        subtitle: "total written",
      },
      {
        label: "Assessment Rate",
        value: `${completionRate}%`,
        icon: "checkmark-done-circle",
        color: "#9333EA",
        bgColor: "#FAE8FF",
        subtitle: `${studentsWithAssessments}/${totalStudents}`,
      },
    ];
  }, [studentSummaries, analyticsData]);

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

  // ─── Computed Per-Department KPI Data ──────────────────────────────────────
  const perDepartmentKpiData = useMemo((): PerDepartmentKpi[] => {
    return analyticsData.department.map((d) => {
      const deptStudents = studentSummaries.filter(
        (s) => s.department === d.label,
      );
      const journalEntries = deptStudents.reduce(
        (sum, s) => sum + s.journalCount,
        0,
      );
      const lsnStudents = deptStudents.filter((s) => s.isLSN).length;
      const mergedMoods: Record<string, number> = {};
      deptStudents.forEach((s) =>
        Object.entries(s.moodCounts).forEach(([mood, count]) => {
          mergedMoods[mood] = (mergedMoods[mood] || 0) + count;
        }),
      );
      const topMood =
        Object.entries(mergedMoods)
          .sort(([, a], [, b]) => b - a)[0]?.[0] || "N/A";
      return {
        deptName: d.label,
        deptAbbr: getDeptAbbreviation(d.label),
        avgScore: d.total > 0 ? +(d.scoreSum / d.total).toFixed(1) : 0,
        journalEntries,
        lsnStudents,
        topMood,
      };
    });
  }, [analyticsData, studentSummaries]);

  // ─── Computed Comparison Insight Data ──────────────────────────────────────
  const comparisonInsightData = useMemo((): ComparisonInsightData[] | null => {
    if (perDepartmentKpiData.length === 0) return null;
    const sorted = [...perDepartmentKpiData];
    const byScore = [...sorted].sort((a, b) => b.avgScore - a.avgScore);
    const byTotal = [...analyticsData.department].sort(
      (a, b) => b.total - a.total,
    );
    const byLsn = [...sorted].sort((a, b) => b.lsnStudents - a.lsnStudents);

    return [
      {
        label: "Highest Avg Score",
        deptName: byScore[0].deptAbbr,
        value: byScore[0].avgScore.toFixed(1),
        icon: "trophy",
        color: "#16A34A",
        bgColor: "#DCFCE7",
      },
      {
        label: "Lowest Avg Score",
        deptName: byScore[byScore.length - 1].deptAbbr,
        value: byScore[byScore.length - 1].avgScore.toFixed(1),
        icon: "alert-circle",
        color: "#EF4444",
        bgColor: "#FEE2E2",
      },
      {
        label: "Most Active",
        deptName: getDeptAbbreviation(byTotal[0].label),
        value: `${byTotal[0].total} assessments`,
        icon: "flash",
        color: "#D97706",
        bgColor: "#FEF3C7",
      },
      {
        label: "Most LSN Students",
        deptName: byLsn[0].deptAbbr,
        value: `${byLsn[0].lsnStudents} students`,
        icon: "accessibility",
        color: "#7C3AED",
        bgColor: "#EDE9FE",
      },
    ];
  }, [perDepartmentKpiData, analyticsData]);

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
          position: newAdminPosition.trim() || null,
          contactNo: newAdminContactNo.trim() || null,
          genderIdentity: newAdminGender.trim() || null,
          nationality: newAdminNationality.trim() || null,
          address: newAdminAddress.trim() || null,
          schoolId: newAdminIdNo.replace(/-/g, "").trim() || null,
          college: newAdminCollege || null,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.message || "Failed to create admin.");
      }

      const newUid = result?.newUser?.uid;

      if (newUid) {
        const { setDoc: _setDoc } = await import("firebase/firestore");
        await _setDoc(
          doc(db, "admins", newUid),
          {
            displayName: newAdminName.trim(),
            email: newAdminEmail.trim(),
            role: "admin",
            ...(newAdminIdNo.replace(/-/g, "").trim()
              ? { schoolId: newAdminIdNo.replace(/-/g, "").trim() }
              : {}),
            ...(newAdminPosition.trim()
              ? { position: newAdminPosition.trim() }
              : {}),
            ...(newAdminContactNo.trim()
              ? { contactNo: newAdminContactNo.trim() }
              : {}),
            ...(newAdminGender.trim()
              ? { genderIdentity: newAdminGender.trim() }
              : {}),
            ...(newAdminNationality.trim()
              ? { nationality: newAdminNationality.trim() }
              : {}),
            ...(newAdminAddress.trim()
              ? { address: newAdminAddress.trim() }
              : {}),
            ...(newAdminCollege
              ? { college: newAdminCollege }
              : {}),
          },
          { merge: true },
        );
      }

      Alert.alert(
        "Success",
        `Admin user ${newAdminName} created successfully.`,
      );
      setCreateAdminModalVisible(false);
      setNewAdminName("");
      setNewAdminEmail("");
      setNewAdminPassword("");
      setNewAdminIdNo("");
      setNewAdminPosition("");
      setNewAdminContactNo("");
      setNewAdminGender("");
      setNewAdminNationality("");
      setNewAdminAddress("");
      setNewAdminCollege("");
      setNewAdminCollegeSearch("");
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
    const isPercentCard = kpi.riskLabel === "% At Risk";

    return (
      <Pressable
        key={index}
        style={({ pressed }) => [
          styles.kpiCard,
          pressed && { transform: [{ scale: 0.98 }], opacity: 0.95 },
        ]}
        onPress={() => {
          if (isPercentCard) {
            setStudentListModal({ visible: true, title: "At-Risk Students" });
          } else {
            setStudentListModal({ visible: true, title });
          }
        }}
      >
        <View style={styles.kpiHeader}>
          <View
            style={[styles.kpiIconCircle, { backgroundColor: kpi.bgColor }]}
          >
            <Ionicons name={kpi.icon} size={18} color={kpi.color} />
          </View>
          {!isPercentCard && (
            <View style={styles.kpiChangeBadge}>
              <Ionicons name={arrowIcon} size={12} color={arrowColor} />
              <Text style={[styles.kpiChangeText, { color: arrowColor }]}>
                {Math.abs(kpi.percentageChange)}%
              </Text>
            </View>
          )}
          {isPercentCard && (
            <View
              style={[
                styles.kpiChangeBadge,
                { backgroundColor: `${kpi.color}18` },
              ]}
            >
              <View
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 4,
                  backgroundColor: kpi.color,
                }}
              />
            </View>
          )}
        </View>
        <Text style={styles.kpiCount}>
          {isPercentCard ? `${kpi.count}` : kpi.count}
        </Text>
        <Text style={styles.kpiLabel}>{kpi.riskLabel}</Text>
        {!isPercentCard && (
          <Text style={styles.kpiBaseline}>
            Baseline: ({kpi.baselineCount})
          </Text>
        )}
        {isPercentCard && (
          <Text style={[styles.kpiBaseline, { color: kpi.color }]}>
            {kpi.count < 30 ? "Healthy" : kpi.count <= 60 ? "Moderate" : "Critical"}
          </Text>
        )}
      </Pressable>
    );
  };

  const renderSummaryKpiCard = (kpi: SummaryKpiData, index: number) => {
    return (
      <Pressable
        key={index}
        style={({ pressed }) => [
          styles.summaryKpiCard,
          pressed && { transform: [{ scale: 0.98 }], opacity: 0.95 },
        ]}
        onPress={() =>
          setStudentListModal({ visible: true, title: kpi.label })
        }
      >
        <View style={styles.summaryKpiTopRow}>
          <View
            style={[
              styles.summaryKpiIconCircle,
              { backgroundColor: kpi.bgColor },
            ]}
          >
            <Ionicons name={kpi.icon} size={18} color={kpi.color} />
          </View>
          <Text style={[styles.summaryKpiValue, { color: kpi.color }]}>
            {kpi.value}
          </Text>
        </View>
        <Text style={styles.summaryKpiLabel}>{kpi.label}</Text>
        {kpi.subtitle && (
          <Text style={styles.summaryKpiSubtitle}>{kpi.subtitle}</Text>
        )}
      </Pressable>
    );
  };

  const renderPerDepartmentKpiCard = (kpi: PerDepartmentKpi, index: number) => {
    return (
      <Pressable
        key={index}
        style={({ pressed }) => [
          styles.deptKpiCard,
          pressed && { transform: [{ scale: 0.98 }], opacity: 0.95 },
        ]}
        onPress={() =>
          setStudentListModal({ visible: true, title: kpi.deptName })
        }
      >
        <Text style={styles.deptKpiCardTitle}>{kpi.deptAbbr}</Text>
        <View style={styles.deptKpiMetricsGrid}>
          <View style={styles.deptKpiMetric}>
            <Text style={styles.deptKpiMetricLabel}>Avg Score</Text>
            <Text style={[styles.deptKpiMetricValue, { color: "#6D28D9" }]}>
              {kpi.avgScore}
            </Text>
          </View>
          <View style={styles.deptKpiMetric}>
            <Text style={styles.deptKpiMetricLabel}>Journals</Text>
            <Text style={[styles.deptKpiMetricValue, { color: "#7C3AED" }]}>
              {kpi.journalEntries}
            </Text>
          </View>
          <View style={styles.deptKpiMetric}>
            <Text style={styles.deptKpiMetricLabel}>LSN</Text>
            <Text style={[styles.deptKpiMetricValue, { color: "#9333EA" }]}>
              {kpi.lsnStudents}
            </Text>
          </View>
          <View style={styles.deptKpiMetric}>
            <Text style={styles.deptKpiMetricLabel}>Top Mood</Text>
            <Text
              style={[styles.deptKpiMetricValue, { color: "#5B21B6", fontSize: 12 }]}
              numberOfLines={1}
            >
              {kpi.topMood}
            </Text>
          </View>
        </View>
      </Pressable>
    );
  };

  const renderComparisonInsightCard = (
    insight: ComparisonInsightData,
    index: number,
  ) => {
    return (
      <View key={index} style={styles.comparisonInsightCard}>
        <View style={styles.comparisonInsightHeader}>
          <View
            style={[
              styles.comparisonInsightIconCircle,
              { backgroundColor: insight.bgColor },
            ]}
          >
            <Ionicons name={insight.icon} size={16} color={insight.color} />
          </View>
          <Text style={styles.comparisonInsightLabel}>{insight.label}</Text>
        </View>
        <Text style={styles.comparisonInsightDept}>{insight.deptName}</Text>
        <Text style={[styles.comparisonInsightValue, { color: insight.color }]}>
          {insight.value}
        </Text>
      </View>
    );
  };

  /** Department bar graph row - vertical stacked bar with percentage on top */
  const renderDepartmentRow = (
    row: DepartmentRowData,
    totalAllDepts: number,
    maxDeptCount: number,
  ) => {
    const deptAbbr = getDeptAbbreviation(row.name);
    const shareOfTotal =
      totalAllDepts > 0
        ? Math.round((row.totalStudents / totalAllDepts) * 100)
        : 0;
    const barScale = maxDeptCount > 0 ? row.totalStudents / maxDeptCount : 0;
    const barHeight = Math.max(Math.round(barScale * 140), 12);

    return (
      <Pressable
        key={row.name}
        style={({ pressed }) => [
          styles.barColumn,
          pressed && { transform: [{ scale: 0.96 }], opacity: 0.9 },
        ]}
        onPress={() => setStudentListModal({ visible: true, title: row.name })}
      >
        {/* Percentage label on top */}
        <Text style={styles.barPctTop}>{shareOfTotal}%</Text>

        {/* Stacked vertical bar */}
        <View style={[styles.barTrack, { height: barHeight }]}>
          {row.lowPct > 0 && (
            <View
              style={[
                styles.barFill,
                {
                  height: `${row.lowPct}%`,
                  backgroundColor: "#22C55E",
                },
              ]}
            />
          )}
          {row.normalPct > 0 && (
            <View
              style={[
                styles.barFill,
                {
                  height: `${row.normalPct}%`,
                  backgroundColor: "#F59E0B",
                },
              ]}
            />
          )}
          {row.highPct > 0 && (
            <View
              style={[
                styles.barFill,
                {
                  height: `${row.highPct}%`,
                  backgroundColor: "#EF4444",
                },
              ]}
            />
          )}
        </View>

        {/* Department label below */}
        <Text style={styles.barDeptLabel} numberOfLines={1}>
          {deptAbbr}
        </Text>
        <Text style={styles.barCountLabel}>{row.totalStudents}</Text>
      </Pressable>
    );
  };

  const renderDonutChart = (slices: DonutSlice[]) => {
    const totalAssessed = studentSummaries.filter(
      (s) => s.assessmentsCount > 0,
    ).length;

    // Build arc segments using overlapping half-circle rotation
    const segments: { color: string; rotation: number }[] = [];
    let cumulativeAngle = 0;
    slices.forEach((slice) => {
      const arcAngle = (slice.value / 100) * 360;
      if (arcAngle > 0) {
        segments.push({ color: slice.color, rotation: cumulativeAngle });
        cumulativeAngle += arcAngle;
      }
    });

    return (
      <View style={styles.bottomWidget}>
        <Text style={styles.bottomWidgetTitle}>
          Overall Concern Distribution
        </Text>
        <View style={styles.donutContainer}>
          {/* Arc-based donut ring */}
          <View style={styles.donutRing}>
            {segments.map((seg, i) => (
              <View
                key={i}
                style={[
                  styles.donutArcSegment,
                  {
                    backgroundColor: seg.color,
                    transform: [{ rotate: `${seg.rotation}deg` }],
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
    const notCompletedPct = 100 - clampedPct;
    const completedAngle = (clampedPct / 100) * 360;

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
            {/* Not completed arc (red) — full circle base */}
            {notCompletedPct > 0 && (
              <View
                style={[
                  styles.radialArcSegment,
                  {
                    backgroundColor: "#EF4444",
                    transform: [{ rotate: "0deg" }],
                  },
                ]}
              />
            )}
            {/* Completed arc (purple) — rotated to start after red */}
            {clampedPct > 0 && (
              <View
                style={[
                  styles.radialArcSegment,
                  {
                    backgroundColor: "#7C3AED",
                    transform: [{ rotate: `${completedAngle}deg` }],
                  },
                ]}
              />
            )}
            <View style={styles.radialHole}>
              <Text style={styles.radialPctText}>{clampedPct}%</Text>
              <Text style={styles.radialLabelText}>Completed</Text>
            </View>
          </View>
          {/* Legend */}
          <View style={styles.radialLegend}>
            <View style={styles.radialLegendItem}>
              <View
                style={[
                  styles.radialLegendDot,
                  { backgroundColor: "#7C3AED" },
                ]}
              />
              <Text style={styles.radialLegendText}>
                Took assessment ({clampedPct}%)
              </Text>
            </View>
            <View style={styles.radialLegendItem}>
              <View
                style={[
                  styles.radialLegendDot,
                  { backgroundColor: "#EF4444" },
                ]}
              />
              <Text style={styles.radialLegendText}>
                Did not take ({notCompletedPct}%)
              </Text>
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
    if (lowerTitle.includes("special needs (lsn)") || lowerTitle.includes("lsn students")) {
      return (s) => s.isLSN === true;
    }
    if (lowerTitle.includes("at-risk students")) {
      return (s) => s.latestRiskLevel === "normal" || s.latestRiskLevel === "high";
    }
    if (lowerTitle.includes("healthy students")) {
      return (s) => s.latestRiskLevel === "low";
    }
    if (lowerTitle.includes("% at risk")) {
      return (s) => s.latestRiskLevel === "normal" || s.latestRiskLevel === "high";
    }
    if (lowerTitle.includes("students assessed")) {
      return (s) => s.assessmentsCount > 0;
    }
    if (lowerTitle.includes("journal entries")) {
      return (s) => s.journalCount > 0;
    }
    if (lowerTitle.includes("assessment rate")) {
      return (s) => s.assessmentsCount > 0;
    }
    if (lowerTitle.includes("avg wellness score")) {
      return () => true;
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
          <Text style={styles.headerTitle}>{adminCollege ? `${adminCollege} Analytics Overview` : "Analytics Overview"}</Text>
          <View style={styles.headerActions}>
            <Pressable
              style={styles.profileButton}
              onPress={() => router.push("/(admin)/messages")}
            >
              <Ionicons
                name="chatbubble-ellipses-outline"
                size={20}
                color="#0F172A"
              />
            </Pressable>
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
            <Pressable
              style={
                activeTab === "announcements"
                  ? [styles.tabButton, styles.tabButtonActive]
                  : styles.tabButton
              }
              onPress={() => setActiveTab("announcements")}
            >
              <Text
                style={
                  activeTab === "announcements"
                    ? [styles.tabLabel, styles.tabLabelActive]
                    : styles.tabLabel
                }
              >
                Announcements
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
                          {student.isLSN && (
                            <View style={styles.lsnBadgeRow}>
                              <View style={styles.lsnBadge}>
                                <Ionicons name="accessibility" size={12} color="white" />
                                <Text style={styles.lsnBadgeText}>LSN</Text>
                              </View>
                              {student.specialNeedsType ? (
                                <Text style={styles.lsnTypeText}>{student.specialNeedsType}</Text>
                              ) : null}
                              {student.lsnDocument?.secureUrl ? (
                                <View style={styles.lsnDocIndicator}>
                                  <Ionicons name="document-attach" size={11} color="#8A63D2" />
                                  <Text style={styles.lsnDocText}>Doc attached</Text>
                                </View>
                              ) : null}
                            </View>
                          )}
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
              ) : activeTab === "announcements" ? (
                <>
                  <View style={styles.lookupCard}>
                    <View style={styles.lookupHeader}>
                      <Text style={styles.sectionTitle}>Create Announcement</Text>
                    </View>
                    <View style={styles.formGroup}>
                      <Text style={styles.formLabel}>Title</Text>
                      <TextInput
                        style={styles.formInput}
                        placeholder="Announcement title"
                        placeholderTextColor="#94A3B8"
                        value={announcementTitle}
                        onChangeText={setAnnouncementTitle}
                      />
                    </View>
                    <View style={styles.formGroup}>
                      <Text style={styles.formLabel}>Description</Text>
                      <TextInput
                        style={[styles.formInput, { minHeight: 80, textAlignVertical: "top" as const }]}
                        placeholder="Write your announcement here..."
                        placeholderTextColor="#94A3B8"
                        value={announcementDescription}
                        onChangeText={setAnnouncementDescription}
                        multiline
                        numberOfLines={4}
                      />
                    </View>
                    <View style={styles.formGroup}>
                      <Text style={styles.formLabel}>Links (optional)</Text>
                      {announcementLinks.map((link, idx) => (
                        <View key={idx} style={styles.linkRow}>
                          <TextInput
                            style={[styles.formInput, { flex: 1 }]}
                            placeholder="Link title"
                            placeholderTextColor="#94A3B8"
                            value={link.title}
                            onChangeText={(v) => {
                              const updated = [...announcementLinks];
                              updated[idx] = { ...updated[idx], title: v };
                              setAnnouncementLinks(updated);
                            }}
                          />
                          <TextInput
                            style={[styles.formInput, { flex: 1 }]}
                            placeholder="https://..."
                            placeholderTextColor="#94A3B8"
                            value={link.url}
                            onChangeText={(v) => {
                              const updated = [...announcementLinks];
                              updated[idx] = { ...updated[idx], url: v };
                              setAnnouncementLinks(updated);
                            }}
                            keyboardType="url"
                            autoCapitalize="none"
                          />
                          <Pressable
                            style={styles.deleteLinkBtn}
                            onPress={() => setAnnouncementLinks(announcementLinks.filter((_, i) => i !== idx))}
                          >
                            <Ionicons name="close-circle" size={22} color="#EF4444" />
                          </Pressable>
                        </View>
                      ))}
                      <Pressable
                        style={styles.addLinkBtn}
                        onPress={() => setAnnouncementLinks([...announcementLinks, { title: "", url: "" }])}
                      >
                        <Ionicons name="add-circle-outline" size={18} color="#8A63D2" />
                        <Text style={styles.addLinkText}>Add Link</Text>
                      </Pressable>
                    </View>
                    {announcementError && (
                      <Text style={styles.errorText}>{announcementError}</Text>
                    )}
                    <Pressable
                      style={[styles.postButton, creatingAnnouncement && { opacity: 0.7 }]}
                      onPress={async () => {
                        if (!announcementTitle.trim() || !announcementDescription.trim()) {
                          setAnnouncementError("Title and description are required.");
                          return;
                        }
                        const validLinks = announcementLinks.filter(l => l.title.trim() && l.url.trim());
                        setCreatingAnnouncement(true);
                        setAnnouncementError(null);
                        try {
                          const adminDoc = await getDoc(doc(db, "admins", user!.uid));
                          const adminData = adminDoc.data();
                          await createAnnouncement({
                            title: announcementTitle.trim(),
                            description: announcementDescription.trim(),
                            links: validLinks,
                            authorName: user!.displayName || adminData?.displayName || "Admin",
                            adminId: user!.uid,
                            authorPosition: adminData?.position || undefined,
                          });
                          setAnnouncementTitle("");
                          setAnnouncementDescription("");
                          setAnnouncementLinks([]);
                          Alert.alert("Success", "Announcement posted.");
                        } catch (err) {
                          setAnnouncementError(err instanceof Error ? err.message : "Failed to post.");
                        } finally {
                          setCreatingAnnouncement(false);
                        }
                      }}
                      disabled={creatingAnnouncement}
                    >
                      {creatingAnnouncement ? (
                        <ActivityIndicator color="white" />
                      ) : (
                        <Text style={styles.postButtonText}>Post Announcement</Text>
                      )}
                    </Pressable>
                  </View>

                  <Text style={styles.sectionHeader}>All Announcements</Text>
                  {announcements.length === 0 ? (
                    <View style={styles.stateCard}>
                      <Ionicons name="megaphone-outline" size={40} color="#D1D5DB" />
                      <Text style={styles.stateText}>No announcements yet.</Text>
                    </View>
                  ) : (
                    announcements.map((a) => (
                      <View key={a.id} style={styles.announcementCard}>
                        <View style={styles.announcementCardHeader}>
                          <Ionicons name="megaphone" size={18} color="#8A63D2" />
                          <Text style={styles.announcementCardTitle}>{a.title}</Text>
                        </View>
                        <Text style={styles.announcementCardBody}>{a.description}</Text>
                        {a.links.length > 0 && (
                          <View style={styles.announcementLinksWrap}>
                            {a.links.map((link, idx) => (
                              <Text key={idx} style={styles.announcementLinkItem}>
                                {link.title}: {link.url}
                              </Text>
                            ))}
                          </View>
                        )}
                        <View style={styles.announcementCardFooter}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.announcementCardMeta}>
                              {a.authorName}{a.authorPosition ? `, ${a.authorPosition}` : ""}
                            </Text>
                            <Text style={styles.announcementCardDate}>
                              {formatAnnouncementDateTime(a.createdAt)}
                            </Text>
                          </View>
                          <View style={styles.expiryBadge}>
                            <Ionicons name="time-outline" size={12} color="#8A63D2" />
                            <Text style={styles.expiryText}>
                              {getDaysRemaining(a.expiresAt)}d left
                            </Text>
                          </View>
                          <Pressable
                            style={styles.deleteAnnouncementBtn}
                            onPress={() => setDeleteAnnounceId(a.id)}
                          >
                            <Ionicons name="trash-outline" size={16} color="#EF4444" />
                          </Pressable>
                        </View>
                      </View>
                    ))
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

                  {/* ─── SECTION 1: Overall Summary KPIs ──────────────────── */}
                  <Text style={styles.sectionHeader}>Overall Summary</Text>
                  <View style={styles.kpiRow}>
                    {summaryKpiData.map((kpi, i) =>
                      renderSummaryKpiCard(kpi, i),
                    )}
                  </View>

                  {/* ─── SECTION 2: Risk Trend KPIs ──────────────────────── */}
                  <Text style={styles.sectionHeader}>
                    Risk Trend Indicators
                  </Text>
                  <View style={styles.kpiRow}>
                    {riskTrendKpiData.map((kpi, i) => renderKpiCard(kpi, i))}
                  </View>

                  {/* ─── SECTION 3: Department Bar Chart ───────────────────── */}
                  <Text style={styles.sectionHeader}>
                    Assessment Participation by Department
                  </Text>
                  <View style={styles.barChartContainer}>
                    {/* Legend */}
                    <View style={styles.barLegend}>
                      <View style={styles.barLegendItem}>
                        <View
                          style={[
                            styles.barLegendDot,
                            { backgroundColor: "#22C55E" },
                          ]}
                        />
                        <Text style={styles.barLegendText}>Low</Text>
                      </View>
                      <View style={styles.barLegendItem}>
                        <View
                          style={[
                            styles.barLegendDot,
                            { backgroundColor: "#F59E0B" },
                          ]}
                        />
                        <Text style={styles.barLegendText}>Moderate</Text>
                      </View>
                      <View style={styles.barLegendItem}>
                        <View
                          style={[
                            styles.barLegendDot,
                            { backgroundColor: "#EF4444" },
                          ]}
                        />
                        <Text style={styles.barLegendText}>High</Text>
                      </View>
                    </View>

                    {departmentRows.length === 0 ? (
                      <View style={styles.stateCard}>
                        <Text style={styles.stateText}>
                          No department data available yet.
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.barChartRow}>
                        {(() => {
                          const totalAllDepts = departmentRows.reduce(
                            (sum, r) => sum + r.totalStudents,
                            0,
                          );
                          const maxDeptCount = Math.max(
                            ...departmentRows.map((r) => r.totalStudents),
                          );
                          return departmentRows.map((row) =>
                            renderDepartmentRow(
                              row,
                              totalAllDepts,
                              maxDeptCount,
                            ),
                          );
                        })()}
                      </View>
                    )}
                  </View>

                  {/* ─── SECTION 4: Department Insights ──────────────────── */}
                  {perDepartmentKpiData.length > 0 && (
                    <>
                      <Text style={styles.sectionHeader}>
                        Department Insights
                      </Text>
                      <View style={styles.deptKpiSection}>
                        <View style={styles.deptKpiGrid}>
                          {perDepartmentKpiData.map((kpi, i) =>
                            renderPerDepartmentKpiCard(kpi, i),
                          )}
                        </View>
                      </View>
                    </>
                  )}

                  {/* ─── SECTION 5: Department Comparison ────────────────── */}
                  {comparisonInsightData && (
                    <>
                      <Text style={styles.sectionHeader}>
                        Department Comparison
                      </Text>
                      <View style={styles.comparisonInsightRow}>
                        {comparisonInsightData.map((insight, i) =>
                          renderComparisonInsightCard(insight, i),
                        )}
                      </View>
                    </>
                  )}

                  {/* ─── SECTION 6: Visual Insights ──────────────────────── */}
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

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>ID No.</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="e.g. 23-1234-567"
                    value={newAdminIdNo}
                    onChangeText={(text) => {
                      const raw = text.replace(/-/g, "").slice(0, 9);
                      let formatted = raw;
                      if (raw.length > 4) formatted = raw.slice(0, 2) + "-" + raw.slice(2, 6) + "-" + raw.slice(6);
                      else if (raw.length > 2) formatted = raw.slice(0, 2) + "-" + raw.slice(2);
                      setNewAdminIdNo(formatted);
                    }}
                    keyboardType="number-pad"
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>College / University</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="Search college..."
                    value={newAdminCollege ? newAdminCollege : newAdminCollegeSearch}
                    editable={!newAdminCollege}
                    onChangeText={(text) => setNewAdminCollegeSearch(text)}
                    autoCapitalize="words"
                  />
                  {!newAdminCollege && !!newAdminCollegeSearch && (
                    <View style={styles.dropdownContainer}>
                      {COLLEGES.filter((c) =>
                        c.toLowerCase().includes(newAdminCollegeSearch.toLowerCase()),
                      )
                        .slice(0, 8)
                        .map((college) => (
                          <Pressable
                            key={college}
                            style={styles.dropdownOption}
                            onPress={() => {
                              setNewAdminCollege(college);
                              setNewAdminCollegeSearch("");
                            }}
                          >
                            <Text style={styles.dropdownText}>{college}</Text>
                          </Pressable>
                        ))}
                    </View>
                  )}
                  {newAdminCollege && (
                    <View style={styles.selectedTag}>
                      <Text style={styles.selectedTagText}>{newAdminCollege}</Text>
                      <Pressable onPress={() => setNewAdminCollege("")}>
                        <Ionicons name="close-circle" size={18} color="white" />
                      </Pressable>
                    </View>
                  )}
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Position</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="e.g. Guidance Counselor"
                    value={newAdminPosition}
                    onChangeText={setNewAdminPosition}
                    autoCapitalize="words"
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Contact Number</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="e.g. 09123456789"
                    value={newAdminContactNo}
                    onChangeText={setNewAdminContactNo}
                    keyboardType="phone-pad"
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Gender Identity</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="e.g. Female, Male, Non-binary"
                    value={newAdminGender}
                    onChangeText={setNewAdminGender}
                    autoCapitalize="words"
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Nationality</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="e.g. Filipino"
                    value={newAdminNationality}
                    onChangeText={setNewAdminNationality}
                    autoCapitalize="words"
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Address</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="Full address"
                    value={newAdminAddress}
                    onChangeText={setNewAdminAddress}
                    autoCapitalize="words"
                  />
                </View>

                {createAdminError && (
                  <Text style={styles.errorText}>{createAdminError}</Text>
                )}

                <Pressable
                  style={[
                    styles.confirmDeleteButton,
                    { marginTop: 16, backgroundColor: "#8A63D2" },
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

        {/* Delete Announcement Confirmation Modal */}
        <Modal
          visible={deleteAnnounceId !== null}
          animationType="fade"
          transparent={true}
          onRequestClose={() => setDeleteAnnounceId(null)}
        >
          <View style={styles.confirmOverlay}>
            <View style={styles.confirmContainer}>
              <Ionicons name="warning-outline" size={48} color="#EF4444" />
              <Text style={styles.confirmTitle}>Delete Announcement</Text>
              <Text style={styles.confirmText}>
                Are you sure you want to delete this announcement? This action cannot be undone.
              </Text>
              <View style={styles.confirmActions}>
                <Pressable
                  style={styles.confirmCancelButton}
                  onPress={() => setDeleteAnnounceId(null)}
                >
                  <Text style={styles.confirmCancelText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={styles.confirmDeleteButton}
                  onPress={async () => {
                    if (!deleteAnnounceId) return;
                    try {
                      await deleteAnnouncementService(deleteAnnounceId);
                      setDeleteAnnounceId(null);
                    } catch {
                      Alert.alert("Error", "Failed to delete announcement.");
                    }
                  }}
                >
                  <Text style={styles.confirmDeleteText}>Delete</Text>
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
  container: { flex: 1, backgroundColor: "#F4F2F8" },
  mainLayout: { flex: 1, backgroundColor: "#F4F2F8" },
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
    // @ts-ignore - web only
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
    backgroundColor: "#8A63D2",
    // @ts-ignore - web only
    boxShadow: "0px 2px 8px rgba(138, 99, 210, 0.25)",
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
  // ─── Summary KPI Cards ─────────────────────────────────────────────────
  summaryKpiCard: {
    width: "48%",
    minWidth: "47%",
    borderRadius: 20,
    padding: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E9D5FF",
    // @ts-ignore
    boxShadow: "0px 8px 22px rgba(109, 40, 217, 0.10)",
    gap: 6,
  },
  summaryKpiTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  summaryKpiIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryKpiValue: {
    fontSize: 26,
    fontWeight: "900",
  },
  summaryKpiLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6B21A8",
  },
  summaryKpiSubtitle: {
    fontSize: 11,
    color: "#8B5CF6",
    fontWeight: "600",
  },
  // ─── Per-Department KPI Section ────────────────────────────────────────
  deptKpiSection: {
    backgroundColor: "#FDFBFF",
    borderRadius: 20,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#E9D5FF",
    // @ts-ignore
    boxShadow: "0px 8px 22px rgba(109, 40, 217, 0.08)",
  },
  deptKpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  deptKpiCard: {
    flexGrow: 1,
    flexBasis: "45%",
    minWidth: 0,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#EDE9FE",
    gap: 8,
  },
  deptKpiCardTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#581C87",
  },
  deptKpiMetricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  deptKpiMetric: {
    flexGrow: 1,
    flexBasis: "45%",
    minWidth: 0,
  },
  deptKpiMetricLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#94A3B8",
    textTransform: "uppercase",
  },
  deptKpiMetricValue: {
    fontSize: 15,
    fontWeight: "800",
  },
  // ─── Comparison Insight Cards ───────────────────────────────────────────
  comparisonInsightRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
    marginBottom: 24,
  },
  comparisonInsightCard: {
    width: "48%",
    minWidth: "47%",
    borderRadius: 20,
    padding: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E9D5FF",
    // @ts-ignore
    boxShadow: "0px 8px 22px rgba(109, 40, 217, 0.10)",
    gap: 6,
  },
  comparisonInsightHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  comparisonInsightIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  comparisonInsightLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#94A3B8",
    textTransform: "uppercase",
    flex: 1,
  },
  comparisonInsightDept: {
    fontSize: 15,
    fontWeight: "800",
    color: "#3B0764",
  },
  comparisonInsightValue: {
    fontSize: 12,
    fontWeight: "700",
  },
  // ─── Department Bar Chart Styles ───────────────────────────────────────
  barChartContainer: {
    backgroundColor: "#FDFBFF",
    borderRadius: 20,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#E9D5FF",
    // @ts-ignore
    boxShadow: "0px 8px 22px rgba(109, 40, 217, 0.08)",
  },
  barLegend: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 20,
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3EAFF",
  },
  barLegendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  barLegendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  barLegendText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#6B21A8",
  },
  barChartRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 10,
    alignItems: "flex-end",
    minHeight: 200,
  },
  barColumn: {
    alignItems: "center",
    width: 64,
    gap: 4,
  },
  barPctTop: {
    fontSize: 11,
    fontWeight: "800",
    color: "#581C87",
  },
  barTrack: {
    width: 36,
    height: 140,
    backgroundColor: "#F3EAFF",
    borderRadius: 8,
    flexDirection: "column",
    justifyContent: "flex-end",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E9D5FF",
  },
  barFill: {
    width: "100%",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.4)",
  },
  barDeptLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#581C87",
    textAlign: "center",
    marginTop: 2,
  },
  barCountLabel: {
    fontSize: 9,
    fontWeight: "600",
    color: "#8B5CF6",
    textAlign: "center",
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
    width: 110,
    height: 110,
    borderRadius: 55,
    position: "relative",
    backgroundColor: "#F5F3FF",
    overflow: "hidden",
  },
  donutArcSegment: {
    position: "absolute",
    top: 0,
    left: "50%",
    width: "50%",
    height: "100%",
    marginLeft: 0,
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
    borderTopRightRadius: 999,
    borderBottomRightRadius: 999,
    transformOrigin: "left center",
  },
  donutHole: {
    position: "absolute",
    top: 18,
    left: 18,
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: "white",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
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
    position: "relative",
    backgroundColor: "#F5F3FF",
    overflow: "hidden",
  },
  radialArcSegment: {
    position: "absolute",
    top: 0,
    left: "50%",
    width: "50%",
    height: "100%",
    borderTopRightRadius: 999,
    borderBottomRightRadius: 999,
    transformOrigin: "left center",
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
    zIndex: 10,
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
  radialLegend: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 14,
  },
  radialLegendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  radialLegendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  radialLegendText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#6B21A8",
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
    borderColor: "#F3EAFF", // @ts-ignore - web only
    boxShadow: "0px 6px 20px rgba(138, 99, 210, 0.08)",
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
    backgroundColor: "#FAF8FF",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    color: "#1E1B4B",
    fontSize: 14,
    borderWidth: 1,
    borderColor: "#E9D5FF",
  },
  createAdminButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#8A63D2",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
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
    borderColor: "#F3EAFF", // @ts-ignore - web only
    boxShadow: "0px 6px 20px rgba(138, 99, 210, 0.08)",
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
    color: "#8A63D2",
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
  lsnBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#F3EAFF",
  },
  lsnBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#8A63D2",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  lsnBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "white",
  },
  lsnTypeText: {
    fontSize: 11,
    color: "#64748B",
    flex: 1,
  },
  lsnDocIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  lsnDocText: {
    fontSize: 10,
    color: "#8A63D2",
    fontWeight: "600",
  },
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
  statValueHighlight: { fontSize: 15, fontWeight: "800", color: "#8A63D2" },
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
    backgroundColor: "#FAF8FF",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    color: "#1E1B4B",
    fontSize: 14,
    borderWidth: 1,
    borderColor: "#E9D5FF",
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
  linkRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
    alignItems: "center",
  },
  deleteLinkBtn: { padding: 4 },
  addLinkBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  addLinkText: { color: "#8A63D2", fontWeight: "600", fontSize: 13 },
  postButton: {
    backgroundColor: "#8A63D2",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 12,
  },
  postButtonText: { color: "white", fontWeight: "700", fontSize: 15 },
  announcementCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#F3EAFF",
    // @ts-ignore - web only
    boxShadow: "0px 6px 20px rgba(138, 99, 210, 0.08)",
  },
  announcementCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  announcementCardTitle: { fontSize: 16, fontWeight: "800", color: "#0F172A", flex: 1 },
  announcementCardBody: { fontSize: 14, color: "#475569", lineHeight: 22, marginBottom: 12 },
  announcementLinksWrap: { gap: 4, marginBottom: 12 },
  announcementLinkItem: { fontSize: 12, color: "#8A63D2", fontWeight: "600" },
  announcementCardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#F3EAFF",
    paddingTop: 12,
  },
  announcementCardMeta: { fontSize: 12, color: "#94A3B8", fontWeight: "600", flex: 1 },
  announcementCardDate: { fontSize: 11, color: "#CBD5E1", marginTop: 2 },
  expiryBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F3EEFF",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 8,
  },
  expiryText: { fontSize: 11, fontWeight: "600", color: "#8A63D2" },
  deleteAnnouncementBtn: { padding: 8, borderRadius: 10, backgroundColor: "#FEF2F2" },
  dropdownContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    maxHeight: 240,
    marginTop: 4,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  dropdownOption: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  dropdownText: { fontSize: 14, color: "#1E293B" },
  selectedTag: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#8A63D2",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 8,
    gap: 8,
  },
  selectedTagText: { color: "#FFFFFF", fontSize: 14, fontWeight: "600", flex: 1 },
});
