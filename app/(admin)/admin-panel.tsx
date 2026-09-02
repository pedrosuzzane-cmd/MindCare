import { API_URL, isSuperAdminEmail } from "@/backend/config";
import type {
  DeptComparisonMetric,
  ScatterPoint,
} from "@/components/admin/DepartmentCharts";
import {
  DepartmentComparisonChart,
  DepartmentCorrelationScatter,
} from "@/components/admin/DepartmentCharts";
import { MetricInfoAccordion } from "@/components/admin/MetricInfoAccordion";
import { StudentListModal } from "@/components/admin/StudentListModal";
import { db } from "@/constants/firebase";
import {
  canonicalDeptName,
  formatDepartmentName,
  getDepartmentCode,
  getDeptAbbreviation,
  mergeDepartmentBuckets,
} from "@/utils/departmentMeta";
import { useAuth } from "@/hooks/AuthContext";
import { MIN_ANALYTICS_GROUP_SIZE } from "@/utils/analyticsPrivacy";
import { getAssessmentRiskLevel } from "@/utils/concern";
import { listenForAdminDashboardData } from "@/services/adminFirestoreService";
import {
  cleanupExpiredAnnouncements,
  createAnnouncement,
  deleteAnnouncement as deleteAnnouncementService,
  formatAnnouncementDateTime,
  getDaysRemaining,
  listenForAnnouncements,
  updateAnnouncement,
} from "@/services/announcementService";
import type { Announcement, AnnouncementLink } from "@/types/announcement";
import { shadows } from "@/utils/shadows";
import { downloadWorkbook } from "@/utils/exportAnalytics";
import { exportReportWorkbook } from "@/services/adminExcelExportService";
import {
  buildNarrativeReportData,
  openNarrativeReport,
  openPdfReport,
} from "@/services/adminWordReportService";
import {
  generateReportData,
  type ReportData,
  type TrendRow,
} from "@/services/reportingService";
import {
  academicYears,
  academicYearLabel,
  academicYearFor,
  resolveAnnualPeriod,
  resolveCustomPeriod,
  resolveMonthlyPeriod,
  resolveTrimesterPeriod,
  resolveWeeklyPeriod,
  type ReportPeriodType,
  type TrimesterNumber,
} from "@/utils/academicCalendar";
import { formatReportingDay } from "@/utils/reportCore";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { createPortal } from "react-dom";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  writeBatch
} from "firebase/firestore";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type ViewStyle
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context"; // This was already correct

const DEPARTMENTS = ["CITCS", "COA", "CCJE", "CTE", "CON", "COE", "CAFA", "CHTM"];

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

function formatLastUpdated(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hr ago`;
  return date.toLocaleDateString();
}

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
  lsnCategory?: string;
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
  studentCount: number;
  journalEntries: number;
  lsnStudents: number;
  topMood: string;
  scorePct: number;
  journalPct: number;
  lsnPct: number;
  moodWellnessPct: number;
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

const YEAR_LEVEL_OPTIONS = [
  "1st Year",
  "2nd Year",
  "3rd Year",
  "4th Year",
  "5th Year",
  "Irregular",
  "LSN",
  "Graduate",
  "N/A",
];

// ─── Helper: Human-readable LSN classification label ─────────────────────────
const formatLsnCategory = (category?: string): string => {
  if (category === "additional-needs") return "Students with Additional Needs";
  if (category === "disabilities") return "Students with Disabilities";
  return "LSN";
};

// ─── Helper: Year-level filter matcher (LSN is a flag, not a year level) ─────
const matchesYearLevelFilter = (
  s: StudentSummary,
  filter: string,
): boolean => {
  if (filter === "LSN") return s.isLSN === true;
  return s.yearLevel === filter;
};

// ─── Helper: Map a student summary into a row for spreadsheet export ─────────
// ─── Descriptive text block rendered under analytics sections ────────────────
interface InsightSection {
  label: string;
  text: string;
}

function DescriptiveInsight({
  title,
  body,
  sections,
}: {
  title: string;
  body: string;
  sections?: InsightSection[];
}) {
  return (
    <View style={styles.descriptiveContainer}>
      <View style={styles.descriptiveHeader}>
        <Ionicons name="document-text-outline" size={16} color="#8A63D2" />
        <Text style={styles.insightTitle}>{title}</Text>
      </View>
      {sections && sections.length > 0 ? (
        <View style={styles.insightSections}>
          {sections.map((sec, i) => (
            <View key={i} style={styles.insightSectionBlock}>
              <Text style={styles.insightSectionLabel}>{sec.label}</Text>
              <Text style={styles.insightSectionText}>{sec.text}</Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.insightText}>{body}</Text>
      )}
    </View>
  );
}

// ─── Shared Admin Design Tokens (mapped from lightTheme) ─────────────────────
import { lightTheme } from "@/constants/theme";

const ADMIN_COLORS = {
  bg: lightTheme.background,
  surface: lightTheme.card,
  border: lightTheme.border,
  borderStrong: lightTheme.borderSoft,
  purple: lightTheme.primary,
  purpleDeep: lightTheme.primaryDeep,
  purpleSoft: lightTheme.softPurple,
  textPrimary: lightTheme.text,
  textMuted: lightTheme.secondaryText,
  textFaint: lightTheme.secondaryText,
} as const;

const TABS: {
  key: "students" | "analytics" | "reports" | "announcements";
  label: string;
}[] = [
  { key: "students", label: "Student Lookup" },
  { key: "analytics", label: "Department Analytics" },
  { key: "reports", label: "Reports" },
  { key: "announcements", label: "Announcements" },
];

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function toLocalDateInput(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// ─── Report filter dropdown ────────────────────────────────────────────────
// Open state is CONTROLLED by the parent (a single `openField` id), so opening
// one menu always closes the previously-open one. On web the menu is portaled
// into document.body: it escapes the ScrollView's overflow clipping and every
// card stacking context, is positioned with `position: fixed` against the
// trigger's viewport rect, and flips upward when there is not enough room
// below. On native it falls back to an inline absolutely-positioned menu.
interface ReportSelectOption {
  value: string;
  label: string;
}

const REPORT_MENU_MAX_HEIGHT = 300;

type ReportAnchorRef = { current: View | null };

// Align and size the menu to the trigger, keeping it inside the viewport.
function measureMenuLayout(
  anchor: View | null,
  wide: boolean,
  menuHeight: number,
): { top: number; left: number; width: number } | null {
  if (!anchor) return null;
  const el = anchor as unknown as HTMLDivElement;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  const viewW = window.innerWidth;
  const viewH = window.innerHeight;
  const width = Math.min(Math.max(r.width, wide ? 320 : r.width), 380);
  const left = Math.max(8, Math.min(r.left, viewW - width - 8));
  const spaceBelow = viewH - r.bottom;
  const spaceAbove = r.top;
  const openUp = spaceBelow < REPORT_MENU_MAX_HEIGHT + 4 && spaceAbove >= spaceBelow;
  const top =
    openUp && menuHeight > 0
      ? Math.max(8, r.top - menuHeight - 4)
      : r.bottom + 4;
  return { top, left, width };
}

// Position the portaled (web-only) menu. `position: "fixed"` and
// `overflow: "auto"` are valid web values that the RN types do not know about,
// so this passes through a cast instead of living in StyleSheet.create (a type
// error there would taint every other style in the sheet).
function portalMenuStyle(layout: { top: number; left: number; width: number }): ViewStyle {
  return {
    position: "fixed",
    top: layout.top,
    left: layout.left,
    width: layout.width,
    maxHeight: REPORT_MENU_MAX_HEIGHT,
    overflow: "auto",
  } as unknown as ViewStyle;
}

function ReportSelectOptions({
  options,
  value,
  onSelect,
  optionRefs,
}: {
  options: ReportSelectOption[];
  value: string;
  onSelect: (value: string) => void;
  optionRefs?: { current: Array<HTMLDivElement | null> };
}) {
  return (
    <>
      {options.map((o, i) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            ref={
              optionRefs
                ? (node) => {
                    optionRefs.current[i] = node as unknown as HTMLDivElement;
                  }
                : undefined
            }
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={({ pressed }) => [
              styles.reportSelectOption,
              active && styles.reportSelectOptionActive,
              pressed && styles.reportSelectOptionPressed,
            ]}
            onPress={() => onSelect(o.value)}
          >
            <Text
              style={[
                styles.reportSelectOptionText,
                active && styles.reportSelectOptionTextActive,
              ]}
              numberOfLines={1}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </>
  );
}

// Web-only: renders the menu through a document.body portal so no ancestor can
// clip it, with viewport-aware positioning, outside-click / scroll / resize
// handling, direction flip, scrolling, and keyboard navigation.
function ReportSelectMenu({
  anchorRef,
  options,
  value,
  wide,
  onSelect,
  onClose,
}: {
  anchorRef: ReportAnchorRef;
  options: ReportSelectOption[];
  value: string;
  wide: boolean;
  onSelect: (value: string) => void;
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const optionRefs = useRef<Array<HTMLDivElement | null>>([]);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  // Seeded synchronously so the menu never flashes at a wrong position.
  const [layout, setLayout] = useState<{ top: number; left: number; width: number } | null>(
    () => measureMenuLayout(anchorRef.current, wide, REPORT_MENU_MAX_HEIGHT),
  );

  // Re-anchor on scroll (capture-phase catches the RN-web ScrollView's inner
  // scrolling) and on resize, and correct after the menu's real height is known.
  useLayoutEffect(() => {
    const update = () => {
      const anchor = anchorRef.current;
      if (!anchor) return;
      const menuHeight = menuRef.current?.offsetHeight ?? REPORT_MENU_MAX_HEIGHT;
      setLayout(measureMenuLayout(anchor, wide, menuHeight));
    };
    window.addEventListener("resize", update);
    document.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      document.removeEventListener("scroll", update, true);
    };
  }, [anchorRef, wide]);

  // Close when clicking outside the menu or its trigger. The trigger itself is
  // skipped so toggling it keeps working (its own press handler closes).
  useLayoutEffect(() => {
    const onDocMouseDown = (e: MouseEvent) => {
      const anchor = anchorRef.current as unknown as HTMLElement | null;
      const menu = menuRef.current;
      const target = e.target as Node | null;
      if (menu && menu.contains(target)) return;
      if (anchor && anchor.contains(target)) return;
      onCloseRef.current();
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [anchorRef]);

  // Keyboard: Escape closes; ArrowDown/ArrowUp/Home/End navigate options;
  // Enter/Space selects the focused option. Only responds while focus is on the
  // trigger or inside the menu.
  useLayoutEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const anchor = anchorRef.current as unknown as HTMLElement | null;
      const menu = menuRef.current;
      const active = document.activeElement as HTMLElement | null;
      const optionsRefs = optionRefs.current;
      const focusInMenu = !!(menu && active && menu.contains(active));

      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onCloseRef.current();
        anchor?.focus();
        return;
      }
      if (!focusInMenu) {
        if (!anchor || active !== anchor) return;
        if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault();
          const selectedIdx = Math.max(
            0,
            options.findIndex((o) => o.value === value),
          );
          optionsRefs[selectedIdx]?.focus({ preventScroll: true });
        }
        return;
      }
      const idx = optionsRefs.indexOf(active as HTMLDivElement);
      const count = optionsRefs.length;
      if (count === 0) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        optionsRefs[(idx + 1) % count]?.focus({ preventScroll: true });
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        optionsRefs[(idx - 1 + count) % count]?.focus({ preventScroll: true });
      } else if (e.key === "Home") {
        e.preventDefault();
        optionsRefs[0]?.focus({ preventScroll: true });
      } else if (e.key === "End") {
        e.preventDefault();
        optionsRefs[count - 1]?.focus({ preventScroll: true });
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        const o = options[Math.max(0, idx)];
        if (o) {
          onSelectRef.current(o.value);
          onCloseRef.current();
          anchor?.focus();
        }
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [anchorRef, options, value]);

  // Once the real menu height is known, reposition so an upward-opening menu
  // hugs the trigger instead of floating at the assumed max height.
  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    const menu = menuRef.current;
    if (!anchor || !menu) return;
    const raf = window.requestAnimationFrame(() => {
      const height = menu.offsetHeight;
      if (height > 0 && height !== REPORT_MENU_MAX_HEIGHT) {
        setLayout(measureMenuLayout(anchor, wide, height));
      }
    });
    return () => window.cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Focus the selected option (or the first) on open, without scrolling the page.
  useLayoutEffect(() => {
    const selectedIdx = Math.max(0, options.findIndex((o) => o.value === value));
    optionRefs.current[selectedIdx]?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!layout) return null;

  return createPortal(
    <View
      ref={(node) => {
        menuRef.current = node as unknown as HTMLDivElement;
      }}
      style={[styles.reportSelectMenuBase, portalMenuStyle(layout)]}
    >
      <ReportSelectOptions
        options={options}
        value={value}
        optionRefs={optionRefs}
        onSelect={(v) => {
          onSelect(v);
          onClose();
        }}
      />
    </View>,
    document.body,
  );
}

function ReportSelectField({
  id,
  label,
  placeholder,
  options,
  value,
  onSelect,
  open,
  onOpenChange,
  wide = false,
}: {
  id: string;
  label: string;
  placeholder?: string;
  options: ReportSelectOption[];
  value: string;
  onSelect: (value: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  wide?: boolean;
}) {
  const triggerRef = useRef<View | null>(null);
  const selected = options.find((o) => o.value === value);
  void id;

  // While closed, allow the trigger to open via keyboard (Enter/Space/arrows).
  useEffect(() => {
    if (Platform.OS !== "web" || open) return;
    const node = triggerRef.current as unknown as HTMLElement | null;
    if (!node) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        onOpenChange(true);
      }
    };
    node.addEventListener("keydown", onKey);
    return () => node.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  return (
    <View style={[styles.reportSelectField, open && styles.reportSelectFieldOpen]}>
      <Text style={styles.reportLabel}>{label}</Text>
      <Pressable
        ref={triggerRef}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${label}: ${selected ? selected.label : "No selection"}`}
        style={({ pressed }) => [
          styles.reportSelectTrigger,
          open && styles.reportSelectTriggerOpen,
          pressed && styles.reportSelectTriggerPressed,
        ]}
        onPress={() => onOpenChange(!open)}
      >
        <Text
          style={[
            styles.reportSelectTriggerText,
            !selected && styles.reportSelectTriggerPlaceholder,
          ]}
          numberOfLines={1}
        >
          {selected ? selected.label : (placeholder ?? "Select…")}
        </Text>
        <Ionicons
          name={open ? "chevron-up" : "chevron-down"}
          size={16}
          color="#5B21B6"
        />
      </Pressable>
      {open && Platform.OS === "web" ? (
        <ReportSelectMenu
          anchorRef={triggerRef}
          options={options}
          value={value}
          wide={wide}
          onSelect={onSelect}
          onClose={() => onOpenChange(false)}
        />
      ) : open ? (
        <View style={[styles.reportSelectMenuBase, styles.reportSelectMenuInline]}>
          <ReportSelectOptions
            options={options}
            value={value}
            onSelect={(v) => {
              onSelect(v);
              onOpenChange(false);
            }}
          />
        </View>
      ) : null}
    </View>
  );
}

// ─── Active-filter summary chips for the report preview ───────────────────────
function buildAppliedFilterChips(
  periodType: ReportPeriodType,
  month: number,
  trimester: TrimesterNumber,
  year: number,
  weekStart: Date,
  customStart: Date,
  customEnd: Date,
  departmentCode: string,
  departments: { code: string; name: string }[],
): string[] {
  let periodParts: string[];
  switch (periodType) {
    case "weekly":
      periodParts = ["Weekly", resolveWeeklyPeriod(weekStart).label];
      break;
    case "monthly":
      periodParts = ["Monthly", `${MONTH_NAMES[month]} ${year}`];
      break;
    case "trimester":
      periodParts = [
        "Trimester",
        `${trimester === 1 ? "1st" : trimester === 2 ? "2nd" : "3rd"} Trimester`,
      ];
      break;
    case "annual":
      periodParts = ["Annual"];
      break;
    case "custom":
      periodParts = [
        "Custom",
        `${toLocalDateInput(customStart)} – ${toLocalDateInput(customEnd)}`,
      ];
      break;
    default:
      periodParts = [periodType];
  }
  const deptPart =
    departmentCode === "all"
      ? "All Departments"
      : departments.find((d) => d.code === departmentCode)?.code ??
        departmentCode;
  return [...periodParts, academicYearLabel(year), deptPart];
}

// ─── Dynamic preview title derived from the ACTIVE FILTERS ────────────────────
function reportPreviewTitle(
  reportData: ReportData,
): string {
  const start = reportData.dateRange.startDate;
  const startLabel = formatReportingDay(start, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const deptSuffix = reportData.departmentFilter
    ? ` — ${reportData.departmentFilter.code}`
    : "";
  const ay = reportData.academicYearLabel;
  switch (reportData.periodType) {
    case "weekly":
      return `${startLabel} Weekly Wellness Report${deptSuffix}`;
    case "monthly":
      return `${formatReportingDay(start, { month: "long", year: "numeric" })} Wellness Report${deptSuffix}`;
    case "trimester":
      return `${reportData.trimesterLabel ?? "Trimester"} ${ay} Wellness Report${deptSuffix}`;
    case "annual":
      return `Academic Year ${ay} Wellness Report${deptSuffix}`;
    case "custom":
      return `${startLabel} – ${formatReportingDay(
        new Date(reportData.dateRange.endDate.getTime() - 1),
        { month: "long", day: "numeric", year: "numeric" },
      )} Wellness Report${deptSuffix}`;
    default:
      return `${reportData.periodLabel} Wellness Report${deptSuffix}`;
  }
}

// ─── Change badge for the previous-period comparison ──────────────────────────
function comparisonChangeLabel(row: TrendRow): {
  text: string;
  tone: string;
} {
  if (row.previous === 0 && row.current === 0) {
    return { text: "—", tone: "muted" };
  }
  if (row.previous === 0) {
    return { text: `+${row.current} (New)`, tone: "up" };
  }
  const diff = row.current - row.previous;
  if (diff === 0) return { text: "no change", tone: "muted" };
  return {
    text: `${diff > 0 ? "+" : ""}${diff} (${Math.abs(row.changePct)}%)`,
    tone: diff > 0 ? "up" : "down",
  };
}

// ─── Pressable state that also exposes web hover/focus states ───────────────
type WebPressableState = {
  pressed: boolean;
  hovered?: boolean;
};

// ─── Accessible header icon with hover/focus tooltip ─────────────────────────
function HeaderIconButton({
  label,
  icon,
  color = ADMIN_COLORS.purpleDeep,
  variant = "neutral",
  badge,
  accessibilityLabel,
  alignRight = false,
  onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color?: string;
  variant?: "neutral" | "alert" | "messages";
  badge?: ReactNode;
  accessibilityLabel?: string;
  alignRight?: boolean;
  onPress: () => void;
}) {
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [interacting, setInteracting] = useState(false);
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearShowTimer = () => {
    if (showTimer.current) {
      clearTimeout(showTimer.current);
      showTimer.current = null;
    }
  };

  const showTooltip = () => {
    clearShowTimer();
    showTimer.current = setTimeout(() => setTooltipVisible(true), 250);
  };

  const hideTooltip = () => {
    clearShowTimer();
    setTooltipVisible(false);
  };

  return (
    <View style={styles.tooltipAnchor}>
      <Pressable
        onPress={onPress}
        onHoverIn={() => {
          setInteracting(true);
          showTooltip();
        }}
        onHoverOut={() => {
          setInteracting(false);
          hideTooltip();
        }}
        onFocus={() => {
          setInteracting(true);
          showTooltip();
        }}
        onBlur={() => {
          setInteracting(false);
          hideTooltip();
        }}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel || label}
        style={({ pressed }) => [
          variant === "alert"
            ? styles.headerIconButtonAlert
            : variant === "messages"
              ? styles.headerIconButtonMessages
              : styles.headerIconButton,
          interacting && styles.headerIconButtonHover,
          pressed && styles.headerIconButtonPressed,
        ]}
      >
        <Ionicons name={icon} size={20} color={color} />
        {badge}
      </Pressable>
      {tooltipVisible && (
        <View
          style={[styles.tooltip, alignRight && styles.tooltipRight]}
          pointerEvents="none"
        >
          <View
            style={[styles.tooltipArrow, alignRight && styles.tooltipArrowRight]}
          />
          <Text style={styles.tooltipText}>{label}</Text>
        </View>
      )}
    </View>
  );
}

// ─── Chart Data ──────────────────────────────────────────────────────────────
interface DonutSlice {
  label: string;
  value: number;
  count: number;
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
  const { width: screenWidth } = useWindowDimensions();
  const isWide = screenWidth >= 900;
  const responsivePadding = Math.min(Math.max(screenWidth * 0.03, 24), 64);

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
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<
    "students" | "analytics" | "reports" | "announcements"
  >("students");
  const [removingStudent, setRemovingStudent] = useState<string | null>(null);
  const [confirmRemoveUid, setConfirmRemoveUid] = useState<string | null>(null);
  const [confirmRemoveName, setConfirmRemoveName] = useState<string>("");
  const [removalStatus, setRemovalStatus] = useState<string>("");
  const [reportPeriodType, setReportPeriodType] =
    useState<ReportPeriodType>("monthly");
  const [reportYear, setReportYear] = useState<number>(
    academicYearFor(new Date()),
  );
  const [reportMonth, setReportMonth] = useState<number>(
    new Date().getMonth(),
  );
  const [reportWeekStart, setReportWeekStart] = useState<Date>(
    (() => {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      return d;
    })(),
  );
  const [reportTrimester, setReportTrimester] = useState<TrimesterNumber>(1);
  const [reportDepartment, setReportDepartment] = useState<string>("all");
  const [reportDepartments, setReportDepartments] = useState<
    { code: string; name: string }[]
  >([]);
  const [reportCustomStart, setReportCustomStart] = useState<Date>(
    (() => {
      const d = new Date();
      d.setDate(1);
      d.setHours(0, 0, 0, 0);
      return d;
    })(),
  );
  const [reportCustomEnd, setReportCustomEnd] = useState<Date>(
    (() => {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      return d;
    })(),
  );
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [reportGenerating, setReportGenerating] = useState(false);
  const [reportStatus, setReportStatus] = useState<string | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportEmpty, setReportEmpty] = useState(false);
  const [reportExportOpen, setReportExportOpen] = useState(false);
  // Single-source dropdown state: only one filter menu can be open at a time.
  // Values: "period" | "academicYear" | "month" | "trimester" | "department".
  const [reportFilterOpen, setReportFilterOpen] = useState<string | null>(null);
  const [reportAppliedChips, setReportAppliedChips] = useState<string[] | null>(null);
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
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [pendingResetCount, setPendingResetCount] = useState(0);
  const [isSignOutConfirmVisible, setSignOutConfirmVisible] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  // Announcements
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementDescription, setAnnouncementDescription] = useState("");
  const [announcementLinks, setAnnouncementLinks] = useState<
    AnnouncementLink[]
  >([]);
  const [creatingAnnouncement, setCreatingAnnouncement] = useState(false);
  const [announcementError, setAnnouncementError] = useState<string | null>(
    null,
  );
  const [deleteAnnounceId, setDeleteAnnounceId] = useState<string | null>(null);
  const [editingAnnouncementId, setEditingAnnouncementId] = useState<
    string | null
  >(null);
  const [announcementDepartments, setAnnouncementDepartments] = useState<
    string[]
  >(["ALL"]);

  const toggleDepartment = (code: string) => {
    setAnnouncementDepartments((prev) => {
      if (code === "ALL") return ["ALL"];
      const withoutAll = prev.filter((d) => d !== "ALL");
      if (withoutAll.includes(code)) {
        const next = withoutAll.filter((d) => d !== code);
        return next.length === 0 ? ["ALL"] : next;
      }
      return [...withoutAll, code];
    });
  };

  // Load the distinct departments present in the database for the report filter.
  useEffect(() => {
    let cancelled = false;
    getDocs(collection(db, "users"))
      .then((snap) => {
        if (cancelled) return;
        const map = new Map<string, string>();
        for (const d of snap.docs) {
          const dept = d.data().department;
          if (typeof dept !== "string" || !dept.trim()) continue;
          const code = getDepartmentCode(dept);
          if (code === "UNSPECIFIED" || code === "N/A") continue;
          if (!map.has(code)) map.set(code, code);
        }
        const list = Array.from(map.keys())
          .map((code) => ({
            code,
            name: canonicalDeptName(code, code),
          }))
          .sort((a, b) => a.name.localeCompare(b.name));
        setReportDepartments(list);
      })
      .catch((err) => console.error("Failed to load departments:", err));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!user) return;

    const unsubData = listenForAdminDashboardData(
      (data) => {
        setStudentSummaries(data.studentSummaries);
        setAnalyticsData(data.analyticsData);
        setLastUpdated(new Date());
        setError(null);
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setError("Unable to load admin dashboard.");
        setLoading(false);
      },
    );

    getDoc(doc(db, "admins", user.uid))
      .then((snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (data.college) setAdminCollege(data.college);
        }
      })
      .catch(() => {});

    user
      .getIdTokenResult()
      .then((idTokenResult) => {
        setIsSuperAdmin(
          idTokenResult.claims.superAdmin === true ||
            isSuperAdminEmail(user.email),
        );
      })
      .catch(() => {});

    return () => {
      unsubData();
    };
  }, [user]);

  useEffect(() => {
    if (!isSuperAdmin || !user) {
      setPendingResetCount(0);
      return;
    }
    let cancelled = false;
    const fetchPending = async () => {
      try {
        const token = await user.getIdToken();
        const response = await fetch(
          `${API_URL}/api/superadmin/password-reset-requests`,
          {
            method: "GET",
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        const data = await response.json();
        if (cancelled || !response.ok) return;
        const count = (data.requests || []).filter(
          (r: { status?: string }) => r.status === "pending",
        ).length;
        setPendingResetCount(count);
      } catch {
        // Background badge update — fail silently.
      }
    };
    fetchPending();
    const interval = setInterval(fetchPending, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isSuperAdmin, user]);

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

  const scrollRef = useRef<ScrollView>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const scrollYRef = useRef(0);

  // Always start at the top when the dashboard opens so navigation never
  // leaves the reader halfway down the page.
  useEffect(() => {
    const t = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    }, 60);
    return () => clearTimeout(t);
  }, []);

  // Consolidated state for student list modals
  const [studentListModal, setStudentListModal] = useState<{
    visible: boolean;
    title: string;
  } | null>(null);
  const [journalModal, setJournalModal] = useState<{
    visible: boolean;
    title: string;
  } | null>(null);
  const [metricsGuideVisible, setMetricsGuideVisible] = useState(false);

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
    const atRisk = studentSummaries.filter(
      (s) => s.latestRiskLevel === "high",
    ).length;
    const moderate = studentSummaries.filter(
      (s) => s.latestRiskLevel === "normal",
    ).length;
    const healthy = studentSummaries.filter(
      (s) => s.latestRiskLevel === "low",
    ).length;
    const totalLSN = studentSummaries.filter((s) => s.isLSN).length;

    const pctChange = (current: number, baseline: number) =>
      baseline > 0
        ? Math.round(((current - baseline) / baseline) * 100)
        : current > 0
          ? 100
          : 0;

    const baselineAtRisk = Math.round(atRisk * 0.9) || 1;
    const baselineModerate = Math.round(moderate * 0.9) || 1;
    const baselineHealthy = Math.round(healthy * 0.9) || 1;
    const baselineLSN = Math.round(totalLSN * 0.9) || 1;

    return [
      {
        riskLabel: "Elevated Concern Indicators",
        count: atRisk,
        percentageChange: pctChange(atRisk, baselineAtRisk),
        baselineCount: baselineAtRisk,
        color: "#DC2626",
        bgColor: "#FEE2E2",
        icon: "warning",
      },
      {
        riskLabel: "Moderate Concern Indicators",
        count: moderate,
        percentageChange: pctChange(moderate, baselineModerate),
        baselineCount: baselineModerate,
        color: "#D97706",
        bgColor: "#FEF3C7",
        icon: "alert-circle",
      },
      {
        riskLabel: "Lower Concern Indicators",
        count: healthy,
        percentageChange: pctChange(healthy, baselineHealthy),
        baselineCount: baselineHealthy,
        color: "#16A34A",
        bgColor: "#DCFCE7",
        icon: "shield-checkmark",
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

  // ─── Year Level Filter State ──────────────────────────────────────────────
  const [yearLevelFilter, setYearLevelFilter] = useState<string>("All");

  const yearLevelOptions = useMemo(() => ["All", ...YEAR_LEVEL_OPTIONS], []);

  // ─── Computed Department Table Rows ────────────────────────────────────────
  const departmentRows = useMemo((): DepartmentRowData[] => {
    const filtered =
      yearLevelFilter === "All"
        ? studentSummaries
        : studentSummaries.filter((s) =>
            matchesYearLevelFilter(s, yearLevelFilter),
          );

    const deptMap = new Map<
      string,
      {
        name: string;
        total: number;
        low: number;
        normal: number;
        high: number;
        scoreSum: number;
      }
    >();
    for (const s of filtered) {
      const code = getDepartmentCode(s.department);
      if (!deptMap.has(code)) {
        deptMap.set(code, {
          name: canonicalDeptName(code, s.department),
          total: 0,
          low: 0,
          normal: 0,
          high: 0,
          scoreSum: 0,
        });
      }
      const entry = deptMap.get(code)!;
      entry.total++;
      if (s.latestRiskLevel === "low") entry.low++;
      else if (s.latestRiskLevel === "high") entry.high++;
      else if (s.latestRiskLevel === "normal") entry.normal++;
      if (s.latestTotalScore != null) entry.scoreSum += s.latestTotalScore;
    }

    return Array.from(deptMap.values())
      .map(({ name, ...d }) => ({
        name,
        totalStudents: d.total,
        lowCount: d.low,
        lowPct: d.total ? Math.round((d.low / d.total) * 100) : 0,
        normalCount: d.normal,
        normalPct: d.total ? Math.round((d.normal / d.total) * 100) : 0,
        highCount: d.high,
        highPct: d.total ? Math.round((d.high / d.total) * 100) : 0,
      }))
      .sort((a, b) => b.totalStudents - a.totalStudents);
  }, [yearLevelFilter, studentSummaries]);

  // ─── Count of students shown under the active year-level filter ────────────
  const filteredStudentCount = useMemo(() => {
    return yearLevelFilter === "All"
      ? studentSummaries.length
      : studentSummaries.filter((s) => matchesYearLevelFilter(s, yearLevelFilter))
          .length;
  }, [yearLevelFilter, studentSummaries]);

  // ─── Assessed students (at least one assessment) across the tracked set ────
  const assessedStudentCount = useMemo(
    () => studentSummaries.filter((s) => s.assessmentsCount > 0).length,
    [studentSummaries],
  );

  // ─── Computed Chart Data ───────────────────────────────────────────────────
  const donutData = useMemo((): DonutSlice[] => {
    const totalLow = studentSummaries.filter(
      (s) => s.latestRiskLevel === "low",
    ).length;
    const totalNormal = studentSummaries.filter(
      (s) => s.latestRiskLevel === "normal",
    ).length;
    const totalHigh = studentSummaries.filter(
      (s) => s.latestRiskLevel === "high",
    ).length;
    const total = totalLow + totalNormal + totalHigh || 1;
    return [
      {
        label: "Lower Concern",
        value: Math.round((totalLow / total) * 100),
        count: totalLow,
        color: "#22C55E",
      },
      {
        label: "Moderate Concern",
        value: Math.round((totalNormal / total) * 100),
        count: totalNormal,
        color: "#F59E0B",
      },
      {
        label: "Elevated Concern",
        value: Math.round((totalHigh / total) * 100),
        count: totalHigh,
        color: "#EF4444",
      },
    ];
  }, [studentSummaries]);

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
    const deptBuckets = mergeDepartmentBuckets(analyticsData.department);
    const deptStudentsFor = (label: string) =>
      studentSummaries.filter((s) => getDepartmentCode(s.department) === getDepartmentCode(label));
    const maxJournal = Math.max(
      ...deptBuckets.map((d) => {
        return deptStudentsFor(d.label).reduce((sum, s) => sum + s.journalCount, 0);
      }),
      1,
    );
    const maxLsn = Math.max(
      ...deptBuckets.map(
        (d) => deptStudentsFor(d.label).filter((s) => s.isLSN).length,
      ),
      1,
    );

    return deptBuckets.map((d) => {
      const deptStudents = deptStudentsFor(d.label);
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
        Object.entries(mergedMoods).sort(([, a], [, b]) => b - a)[0]?.[0] ||
        "N/A";

      const positiveMoods = ["happy", "calm", "relaxed", "good"];
      const distressedMoods = [
        "stressed",
        "burnout",
        "very-upset",
        "exhausted",
        "overwhelmed",
        "mad",
        "fearful",
        "flushed",
      ];
      let wellSum = 0;
      let moodTotal = 0;
      Object.entries(mergedMoods).forEach(([mood, count]) => {
        const m = mood.toLowerCase();
        if (positiveMoods.includes(m)) wellSum += count;
        else if (distressedMoods.includes(m)) wellSum -= count;
        moodTotal += count;
      });
      const moodWellnessPct =
        moodTotal > 0 ? Math.round(((wellSum / moodTotal + 1) / 2) * 100) : 50;

      return {
        deptName: d.label,
        deptAbbr: getDepartmentCode(d.label),
        avgScore: d.total > 0 ? +(d.scoreSum / d.total).toFixed(1) : 0,
        studentCount: deptStudents.length,
        journalEntries,
        lsnStudents,
        topMood,
        scorePct:
          d.total > 0 ? Math.min((d.scoreSum / d.total / 80) * 100, 100) : 0,
        journalPct: Math.min((journalEntries / maxJournal) * 100, 100),
        lsnPct: Math.min((lsnStudents / maxLsn) * 100, 100),
        moodWellnessPct,
      };
    });
  }, [analyticsData, studentSummaries]);

  // ─── Computed Comparison Insight Data ──────────────────────────────────────
  const comparisonInsightData = useMemo((): ComparisonInsightData[] | null => {
    if (perDepartmentKpiData.length === 0) return null;
    const sorted = [...perDepartmentKpiData];
    const byScore = [...sorted].sort((a, b) => b.avgScore - a.avgScore);
    const byTotal = mergeDepartmentBuckets(analyticsData.department).sort(
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
        deptName: getDepartmentCode(byTotal[0].label),
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

  // ─── Computed Data for Department Comparison Charts ────────────────────
  const deptComparisonChartData = useMemo((): DeptComparisonMetric[] => {
    return mergeDepartmentBuckets(analyticsData.department).map((d) => {
      const deptStudents = studentSummaries.filter(
        (s) => getDepartmentCode(s.department) === getDepartmentCode(d.label),
      );
      const journalCount = deptStudents.reduce(
        (sum, s) => sum + s.journalCount,
        0,
      );
      const lsnCount = deptStudents.filter((s) => s.isLSN).length;
      const assessedCount = deptStudents.filter(
        (s) => s.assessmentsCount > 0,
      ).length;
      const participationRate =
        deptStudents.length > 0 ? assessedCount / deptStudents.length : 0;
      return {
        deptAbbr: getDepartmentCode(d.label),
        deptName: d.label,
        avgScore: d.total > 0 ? +(d.scoreSum / d.total).toFixed(1) : 0,
        journalCount,
        lsnCount,
        assessmentCount: d.total,
        participationRate,
        trackedStudents: deptStudents.length,
        assessedStudents: assessedCount,
      };
    });
  }, [analyticsData, studentSummaries]);

  // ─── Computed Data for Scatter Plot ────────────────────────────────────
  const scatterPlotData = useMemo((): ScatterPoint[] => {
    return studentSummaries
      .filter((s) => s.assessmentsCount > 0 || s.journalCount > 0)
      .map((s) => ({
        studentId: s.uid,
        department: getDepartmentCode(s.department),
        journalCount: s.journalCount,
        avgScore: s.latestTotalScore ?? 0,
        riskLevel: getAssessmentRiskLevel(s) ?? "low",
      }));
  }, [studentSummaries]);

  // ─── Computed Descriptive Analysis Texts ─────────────────────────────────
  const descriptiveInsights = useMemo(() => {
    const totalStudents = studentSummaries.length;
    const assessed = studentSummaries.filter(
      (s) => s.assessmentsCount > 0,
    ).length;
    const completionRate = totalStudents
      ? Math.round((assessed / totalStudents) * 100)
      : 0;
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

    const lowCount = studentSummaries.filter(
      (s) => s.latestRiskLevel === "low",
    ).length;
    const normalCount = studentSummaries.filter(
      (s) => s.latestRiskLevel === "normal",
    ).length;
    const highCount = studentSummaries.filter(
      (s) => s.latestRiskLevel === "high",
    ).length;
    const lowPct = totalStudents ? Math.round((lowCount / totalStudents) * 100) : 0;
    const normalPct = totalStudents
      ? Math.round((normalCount / totalStudents) * 100)
      : 0;
    const highPct = totalStudents ? Math.round((highCount / totalStudents) * 100) : 0;

    const topByStudents = departmentRows[0] ?? null;
    const topHighDept = [...departmentRows].sort(
      (a, b) => b.highCount - a.highCount,
    )[0] ?? null;
    const topHighPct =
      topHighDept && topHighDept.totalStudents > 0
        ? Math.round((topHighDept.highCount / topHighDept.totalStudents) * 100)
        : 0;

    const byAvg = [...perDepartmentKpiData].sort(
      (a, b) => b.avgScore - a.avgScore,
    );
    const bestDept = byAvg[0] ?? null;
    const worstDept = byAvg[byAvg.length - 1] ?? null;
    const byWellness = [...perDepartmentKpiData].sort(
      (a, b) => b.moodWellnessPct - a.moodWellnessPct,
    );
    const moodDept = byWellness[0] ?? null;
    const byJournal = [...perDepartmentKpiData].sort(
      (a, b) => b.journalEntries - a.journalEntries,
    );
    const byLsn = [...perDepartmentKpiData].sort(
      (a, b) => b.lsnStudents - a.lsnStudents,
    );

    const corrPoints = scatterPlotData;
    let corrR = 0;
    if (corrPoints.length >= 2) {
      const n = corrPoints.length;
      const mx = corrPoints.reduce((sum, p) => sum + p.journalCount, 0) / n;
      const my = corrPoints.reduce((sum, p) => sum + p.avgScore, 0) / n;
      let num = 0;
      let dx = 0;
      let dy = 0;
      corrPoints.forEach((p) => {
        const x = p.journalCount - mx;
        const y = p.avgScore - my;
        num += x * y;
        dx += x * x;
        dy += y * y;
      });
      corrR = dx > 0 && dy > 0 ? num / Math.sqrt(dx * dy) : 0;
    }
    const corrStrength =
      Math.abs(corrR) < 0.3
        ? "weak"
        : Math.abs(corrR) < 0.6
          ? "moderate"
          : "strong";
    const corrDirection = corrR >= 0 ? "positive" : "negative";
    const highConcernScatter = scatterPlotData.filter(
      (p) => p.riskLevel === "high",
    ).length;

    const byDeptAssess = [...deptComparisonChartData].sort(
      (a, b) => b.assessmentCount - a.assessmentCount,
    );
    const byDeptParticipation = [...deptComparisonChartData].sort(
      (a, b) => b.participationRate - a.participationRate,
    );
    const byDeptJournal = [...deptComparisonChartData].sort(
      (a, b) => b.journalCount - a.journalCount,
    );
    const byDeptLsn = [...deptComparisonChartData].sort(
      (a, b) => b.lsnCount - a.lsnCount,
    );
    const byDeptScore = [...deptComparisonChartData].sort(
      (a, b) => b.avgScore - a.avgScore,
    );

    const fmtDept = (raw: string) => formatDepartmentName(raw);
    const smallCorrSample =
      corrPoints.length > 0 && corrPoints.length < 30;

    return {
      overall: {
        body: `Out of ${totalStudents} tracked students, ${assessed} (${completionRate}%) have completed at least one well-being assessment, averaging a wellness score of ${avgScore} out of 80. Students have written ${totalJournals} journal entries in total, reflecting measurable engagement with self-reflection tools.`,
        sections: [
          {
            label: "Key Finding",
            text: `${assessed} of ${totalStudents} tracked students (${completionRate}%) have completed at least one well-being assessment, averaging a wellness score of ${avgScore} out of 80.`,
          },
          {
            label: "What This Means",
            text: `A growing assessment base gives the guidance office a more complete view of student wellness across the university. Journal activity (${totalJournals} entries) shows students are also engaging with self-reflection tools.`,
          },
          {
            label: "Recommended Attention",
            text: "Continue inviting students who have not yet completed an assessment to participate so the university picture becomes more complete over time.",
          },
        ],
      },
      risk: {
        body: `Concern distribution places ${lowCount} students (${lowPct}%) in the lower concern range, ${normalCount} (${normalPct}%) in the moderate concern range, and ${highCount} (${highPct}%) in the elevated concern range. The ${highCount} students with elevated concern indicators should be considered for guidance-office follow-up according to the institutional safeguarding and student-support protocol.`,
        sections: [
          {
            label: "Key Finding",
            text: `Of ${totalStudents} tracked students, ${lowCount} (${lowPct}%) show lower concern indicators, ${normalCount} (${normalPct}%) moderate, and ${highCount} (${highPct}%) elevated.`,
          },
          {
            label: "What This Means",
            text: "A majority in the lower-to-moderate range reflects a stable overall baseline. The elevated band represents the primary focus for follow-up rather than a university-wide concern.",
          },
          {
            label: "Recommended Attention",
            text: `Review the ${highCount} students with elevated concern indicators and follow the safeguarding and student-support protocol for appropriate follow-up.`,
          },
        ],
      },
      participation: {
        body: topByStudents
          ? `${departmentRows.length} departments are represented. ${getDeptAbbreviation(topByStudents.name)} holds the largest cohort with ${topByStudents.totalStudents} tracked students. ${
              topHighDept && topHighDept.highCount > 0
                ? `${getDeptAbbreviation(topHighDept.name)} reports the most students with elevated concern indicators (${topHighDept.highCount}, ${topHighPct}% of its cohort) and may benefit from proactive student-support outreach.`
                : "No elevated concern indicators are currently flagged at the department level, suggesting an encouraging overall baseline."
            }`
          : "No department data is available yet. Data will appear once students complete their profiles and assessments.",
        sections: topByStudents
          ? [
              {
                label: "Key Finding",
                text: `${departmentRows.length} departments are represented. ${fmtDept(topByStudents.name)} holds the largest cohort with ${topByStudents.totalStudents} tracked students.`,
              },
              {
                label: "What This Means",
                text:
                  topHighDept && topHighDept.highCount > 0
                    ? `${fmtDept(topHighDept.name)} reports the most students with elevated concern indicators (${topHighDept.highCount}, ${topHighPct}% of its cohort), which may reflect different cohort sizes or support needs.`
                    : "No elevated concern indicators are currently flagged at the department level, suggesting an encouraging overall baseline.",
              },
              {
                label: "Recommended Attention",
                text:
                  topHighDept && topHighDept.highCount > 0
                    ? "Consider proactive student-support outreach for departments with the highest share of elevated concern indicators."
                    : "Maintain routine monitoring and continue encouraging assessment participation across departments.",
              },
            ]
          : [],
      },
      insights: {
        body:
          bestDept && worstDept
            ? `Department insights show ${bestDept.deptAbbr} leading with an average wellness score of ${bestDept.avgScore}, while ${worstDept.deptAbbr} trails at ${worstDept.avgScore}. ${
                moodDept && moodDept.topMood !== "N/A"
                  ? `The most frequently reported mood is "${moodDept.topMood}" in ${moodDept.deptAbbr}, indicating a ${moodDept.moodWellnessPct}% mood-wellness index for that department.`
                  : "Mood data is still building as students log journal entries."
              }`
            : "Department insight data will appear once assessments and journals are recorded.",
        sections:
          bestDept && worstDept
            ? [
                {
                  label: "Key Finding",
                  text: `${fmtDept(bestDept.deptName)} leads with an average wellness score of ${bestDept.avgScore}, while ${fmtDept(worstDept.deptName)} posts ${worstDept.avgScore}.`,
                },
                {
                  label: "What This Means",
                  text:
                    moodDept && moodDept.topMood !== "N/A"
                      ? `The most frequently reported mood is "${moodDept.topMood}" in ${fmtDept(moodDept.deptName)}, reflecting a ${moodDept.moodWellnessPct}% mood-wellness index for that department.`
                      : "Mood data is still building as students log journal entries.",
                },
                {
                  label: "Recommended Attention",
                  text: "Use department-level averages to target wellness resources where average scores are lowest.",
                },
              ]
            : [],
      },
      deptInsights: {
        body:
          bestDept && worstDept
            ? `Across ${perDepartmentKpiData.length} departments, ${bestDept.deptAbbr} leads with the highest average wellness score (${bestDept.avgScore}), while ${worstDept.deptAbbr} posts the lowest (${worstDept.avgScore}). ${byJournal[0].deptAbbr} is the most journal-active with ${byJournal[0].journalEntries} entries, and ${byLsn[0].deptAbbr} supports the most learners with special needs (${byLsn[0].lsnStudents}). ${
                moodDept && moodDept.topMood !== "N/A"
                  ? `The most positive mood climate is reported in ${moodDept.deptAbbr} with a ${moodDept.moodWellnessPct}% mood-wellness index, where "${moodDept.topMood}" is the dominant mood.`
                  : "Mood data is still building as students log journal entries."
              } These profiles help the guidance office tailor interventions per college.`
            : "Department insight data will appear once assessments and journals are recorded.",
        sections:
          bestDept && worstDept
            ? [
                {
                  label: "Key Finding",
                  text: `Across ${perDepartmentKpiData.length} departments, ${fmtDept(bestDept.deptName)} has the highest average wellness score (${bestDept.avgScore}) and ${fmtDept(worstDept.deptName)} the lowest (${worstDept.avgScore}).`,
                },
                {
                  label: "What This Means",
                  text: `${fmtDept(byJournal[0].deptName)} is the most journal-active (${byJournal[0].journalEntries} entries) and ${fmtDept(byLsn[0].deptName)} supports the most learners with special needs (${byLsn[0].lsnStudents}).${
                    moodDept && moodDept.topMood !== "N/A"
                      ? ` The most positive mood climate is reported in ${fmtDept(moodDept.deptName)} with a ${moodDept.moodWellnessPct}% mood-wellness index, where "${moodDept.topMood}" is the dominant mood.`
                      : " Mood data is still building as students log journal entries."
                  }`,
                },
                {
                  label: "Recommended Attention",
                  text: "These profiles help the guidance office tailor interventions per college.",
                },
              ]
            : [],
      },
      correlation: {
        body:
          scatterPlotData.length < 2
            ? "At least two students with assessment or journal activity are required to surface a score-vs-journal correlation pattern."
            : `Across ${scatterPlotData.length} students with assessment or journal activity, journal frequency shows a ${corrStrength} ${corrDirection} statistical association with wellness scores (Pearson r = ${corrR.toFixed(2)}). ${highConcernScatter} students record elevated concern indicators (51+) and warrant guidance-office follow-up regardless of the overall trend. Correlation describes an aggregate association and does not establish causation — no individual student is characterized by it.${
                smallCorrSample
                  ? " Because the sample is small, interpret this pattern cautiously."
                  : ""
              }`,
        sections:
          scatterPlotData.length < 2
            ? [
                {
                  label: "Key Finding",
                  text: "At least two students with assessment or journal activity are required to surface a score-vs-journal correlation pattern.",
                },
              ]
            : [
                {
                  label: "Key Finding",
                  text: `Across ${scatterPlotData.length} students, journal frequency shows a ${corrStrength} ${corrDirection} statistical association with wellness scores (Pearson r = ${corrR.toFixed(2)}).`,
                },
                {
                  label: "What This Means",
                  text: "This describes an aggregate pattern across the university, not a rule for any individual student. Correlation does not establish causation.",
                },
                {
                  label: "Recommended Attention",
                  text: `${highConcernScatter} students record elevated concern indicators (51+) and warrant guidance-office follow-up regardless of the overall trend.${
                    smallCorrSample
                      ? ` With only ${corrPoints.length} students, interpret this pattern cautiously.`
                      : ""
                  }`,
                },
              ],
      },
      multiMetric: {
        body:
          deptComparisonChartData.length === 0
            ? "Multi-metric comparison data will appear once multiple departments have recorded activity."
            : `The multi-metric profile shows ${byDeptAssess[0].deptAbbr} leading assessment volume (${byDeptAssess[0].assessmentCount}), while ${byDeptParticipation[0].deptAbbr} holds the highest participation rate (${Math.round(byDeptParticipation[0].participationRate * 100)}%). ${byDeptJournal[0].deptAbbr} leads journal activity (${byDeptJournal[0].journalCount} entries), ${byDeptLsn[0].deptAbbr} supports the most learners with special needs (${byDeptLsn[0].lsnCount}), and ${byDeptScore[0].deptAbbr} records the highest average wellness score (${byDeptScore[0].avgScore}). Departments with high activity but lower average scores may indicate engagement without proportionate wellness gains — a useful flag for program review.`,
        sections:
          deptComparisonChartData.length === 0
            ? [
                {
                  label: "Key Finding",
                  text: "Multi-metric comparison data will appear once multiple departments have recorded activity.",
                },
              ]
            : [
                {
                  label: "Key Finding",
                  text: `${fmtDept(byDeptAssess[0].deptName)} leads assessment volume (${byDeptAssess[0].assessmentCount}) and ${fmtDept(byDeptParticipation[0].deptName)} has the highest participation rate (${Math.round(byDeptParticipation[0].participationRate * 100)}%).`,
                },
                {
                  label: "What This Means",
                  text: `${fmtDept(byDeptJournal[0].deptName)} leads journal activity (${byDeptJournal[0].journalCount} entries), ${fmtDept(byDeptLsn[0].deptName)} supports the most learners with special needs (${byDeptLsn[0].lsnCount}), and ${fmtDept(byDeptScore[0].deptName)} records the highest average wellness score (${byDeptScore[0].avgScore}). Departments with high activity but lower average scores may indicate engagement without proportionate wellness gains.`,
                },
                {
                  label: "Recommended Attention",
                  text: "Use these differences to inform program-level review and where support resources may be allocated.",
                },
              ],
      },
      comparison: {
        body: comparisonInsightData
          ? `${comparisonInsightData[0].deptName} leads with the highest average wellness score (${comparisonInsightData[0].value}), while ${comparisonInsightData[1].deptName} posts the lowest (${comparisonInsightData[1].value}). ${comparisonInsightData[2].deptName} is the most assessment-active, and ${comparisonInsightData[3].deptName} supports the most learners with special needs (${comparisonInsightData[3].value}).`
          : "Comparison data will appear once multiple departments have recorded assessments.",
        sections: comparisonInsightData
          ? [
              {
                label: "Key Finding",
                text: `${fmtDept(comparisonInsightData[0].deptName)} leads with the highest average wellness score (${comparisonInsightData[0].value}), while ${fmtDept(comparisonInsightData[1].deptName)} posts the lowest (${comparisonInsightData[1].value}).`,
              },
              {
                label: "What This Means",
                text: `${fmtDept(comparisonInsightData[2].deptName)} is the most assessment-active and ${fmtDept(comparisonInsightData[3].deptName)} supports the most learners with special needs (${comparisonInsightData[3].value}). Comparing departments side by side highlights where support resources may be needed most.`,
              },
              {
                label: "Recommended Attention",
                text: "Review the lowest-scoring departments for additional support while sustaining engagement in the most active ones.",
              },
            ]
          : [],
      },
      visual: {
        donut: `Across assessed students, ${donutData[0]?.value ?? 0}% fall in the lower concern band, ${donutData[1]?.value ?? 0}% in the moderate concern band, and ${donutData[2]?.value ?? 0}% in the elevated concern band. The dominant moderate band points to a need for proactive wellness programs rather than crisis-only responses.`,
        radial: `${completionRate}% of tracked students have completed a well-being assessment. The remaining ${100 - completionRate}% have not yet participated and represent the primary target for outreach and engagement campaigns.`,
        engagement: `${assessed} of ${totalStudents} students have signed in and completed an assessment. Encouraging regular journaling and repeat assessments will help build a complete wellness picture over time.`,
      },
    };
  }, [
    studentSummaries,
    analyticsData,
    departmentRows,
    perDepartmentKpiData,
    comparisonInsightData,
    deptComparisonChartData,
    scatterPlotData,
    donutData,
  ]);

  // --- Reporting: one generation, Narrative + Excel from the same ReportData --
  const handleGenerateReport = async () => {
    if (reportGenerating) return;

    if (reportPeriodType === "custom") {
      const start = new Date(reportCustomStart);
      start.setHours(0, 0, 0, 0);
      const end = new Date(reportCustomEnd);
      end.setHours(0, 0, 0, 0);
      if (start.getTime() > end.getTime()) {
        setReportError(
          "Invalid date range. The start date must be on or before the end date.",
        );
        return;
      }
    }

    setReportGenerating(true);
    setReportError(null);
    setReportEmpty(false);
    setReportStatus("Updating report...");
    try {
      let period;
      if (reportPeriodType === "weekly") {
        period = resolveWeeklyPeriod(reportWeekStart);
      } else if (reportPeriodType === "monthly") {
        period = resolveMonthlyPeriod(reportYear, reportMonth);
      } else if (reportPeriodType === "trimester") {
        period = resolveTrimesterPeriod({
          trimester: reportTrimester,
          academicYear: reportYear,
        });
      } else if (reportPeriodType === "annual") {
        period = resolveAnnualPeriod(reportYear);
      } else {
        const start = new Date(reportCustomStart);
        start.setHours(0, 0, 0, 0);
        const end = new Date(reportCustomEnd);
        end.setHours(0, 0, 0, 0);
        end.setDate(end.getDate() + 1); // exclusive upper bound
        period = resolveCustomPeriod({ startDate: start, endDate: end });
      }
      setReportStatus("Analyzing student data...");
      const data = await generateReportData({
        periodType: period.type,
        startDate: period.startDate,
        endDate: period.endDate,
        periodLabel: period.label,
        departmentCode:
          reportDepartment === "all" ? undefined : reportDepartment,
      });
if (data.overview.totalStudents === 0) {
        // Distinguish a genuinely empty period (no qualifying records) from a
        // failure: both clear the dataset, but the UI renders a dedicated
        // empty state instead of misleading zeros or an error.
        setReportData(null);
        setReportEmpty(true);
        setReportAppliedChips(
          buildAppliedFilterChips(
            reportPeriodType,
            reportMonth,
            reportTrimester,
            reportYear,
            reportWeekStart,
            reportCustomStart,
            reportCustomEnd,
            reportDepartment,
            reportDepartments,
          ),
        );
        setReportStatus(null);
        return;
      }
      // Keep the previous dataset untouched while this one loads; it is swapped
      // only on success so stale metrics never appear as the new filter set.
      setReportData(data);
      setReportAppliedChips(
        buildAppliedFilterChips(
          reportPeriodType,
          reportMonth,
          reportTrimester,
          reportYear,
          reportWeekStart,
          reportCustomStart,
          reportCustomEnd,
          reportDepartment,
          reportDepartments,
        ),
      );
      setReportStatus(null);
    } catch (err) {
      console.error("Report generation failed:", err);
      setReportData(null);
      setReportAppliedChips(null);
      setReportError("Unable to generate report. Please try again.");
      setReportStatus(null);
    } finally {
      setReportGenerating(false);
    }
  };

  // Restores the default report filters and regenerates the preview without
  // touching any unrelated application state.
  const handleResetReport = () => {
    setReportPeriodType("monthly");
    setReportYear(academicYearFor(new Date()));
    setReportMonth(new Date().getMonth());
    const week = new Date();
    week.setHours(0, 0, 0, 0);
    setReportWeekStart(week);
    setReportTrimester(1);
    setReportDepartment("all");
    const start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    setReportCustomStart(start);
    const end = new Date();
    end.setHours(0, 0, 0, 0);
    setReportCustomEnd(end);
    setReportExportOpen(false);
    handleGenerateReport();
  };

  const handleExportReportExcel = async () => {
    if (!reportData) return;
    try {
      const wb = exportReportWorkbook(reportData);
      await downloadWorkbook(wb, "MindCare_Administrative_Report.xlsx");
    } catch (err) {
      console.error("Excel export failed:", err);
      Alert.alert(
        "Export Failed",
        "Unable to generate the Excel workbook. Please try again.",
      );
    }
  };

  const handleExportReportNarrative = async () => {
    if (!reportData) return;
    try {
      const narrative = buildNarrativeReportData(reportData);
      await openNarrativeReport(
        narrative,
        "MindCare_Administrative_Narrative_Report.html",
      );
    } catch (err) {
      console.error("Narrative report export failed:", err);
      Alert.alert(
        "Export Failed",
        "Unable to generate the narrative report. Please try again.",
      );
    }
  };

  const handleExportReportPdf = async () => {
    if (!reportData) return;
    try {
      await openPdfReport(reportData);
    } catch (err) {
      console.error("PDF report export failed:", err);
      Alert.alert(
        "Export Failed",
        "Unable to generate the PDF report. Please try again.",
      );
    }
  };


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
      const res = await fetch(`${API_URL}/api/superadmin/create-admin`, {
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

      const contentType = res.headers.get("content-type") || "";
      const result = contentType.includes("application/json")
        ? await res.json().catch(() => ({}))
        : {};

      if (!res.ok) {
        const message =
          typeof result?.error === "string" && result.error
            ? result.error
            : `Create Admin API returned HTTP ${res.status}. Verify the deployed backend route.`;
        throw new Error(message);
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
    const title = kpi.riskLabel;

    return (
      <Pressable
        key={index}
        style={({ pressed }) => [
          styles.kpiCard,
          isWide && styles.kpiCardWide,
          pressed && { transform: [{ scale: 0.98 }], opacity: 0.95 },
        ]}
        onPress={() => {
          setStudentListModal({ visible: true, title });
        }}
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
        <Text style={styles.kpiBaseline}>
          Baseline (prior period, est.): ({kpi.baselineCount})
        </Text>
      </Pressable>
    );
  };

  const renderSummaryKpiCard = (kpi: SummaryKpiData, index: number) => {
    return (
      <Pressable
        key={index}
        style={({ pressed }) => [
          styles.summaryKpiCard,
          isWide && styles.summaryKpiCardWide,
          pressed && { transform: [{ scale: 0.98 }], opacity: 0.95 },
        ]}
        onPress={() => {
          if (kpi.label === "Journal Entries") {
            setJournalModal({ visible: true, title: kpi.label });
          } else {
            setStudentListModal({ visible: true, title: kpi.label });
          }
        }}
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
    const moodColor =
      kpi.moodWellnessPct >= 60
        ? "#22C55E"
        : kpi.moodWellnessPct >= 40
          ? "#F59E0B"
          : "#EF4444";
    const scoreColor =
      kpi.scorePct <= 40
        ? "#22C55E"
        : kpi.scorePct <= 62
          ? "#F59E0B"
          : "#EF4444";

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
        <Text style={styles.deptKpiCardFull} numberOfLines={1}>
          {kpi.deptName}
        </Text>
        <View style={styles.deptKpiSampleRow}>
          <Text style={styles.deptKpiSampleText}>
            n = {kpi.studentCount}
            {kpi.studentCount < MIN_ANALYTICS_GROUP_SIZE
              ? " · small sample"
              : ""}
          </Text>
        </View>
        {kpi.studentCount < MIN_ANALYTICS_GROUP_SIZE && (
          <Text style={styles.deptKpiCaution}>
            Small sample — interpret with caution.
          </Text>
        )}
        <View style={styles.deptKpiMetricsGrid}>
          <View style={styles.deptKpiMetricSpark}>
            <View style={styles.sparklineRow}>
              <Text style={styles.deptKpiMetricLabel}>Avg Score</Text>
              <Text style={[styles.sparklineValue, { color: scoreColor }]}>
                {kpi.avgScore}
              </Text>
            </View>
            <View style={styles.sparklineTrack}>
              <View
                style={[
                  styles.sparklineFill,
                  { width: `${kpi.scorePct}%`, backgroundColor: scoreColor },
                ]}
              />
            </View>
          </View>
          <View style={styles.deptKpiMetricSpark}>
            <View style={styles.sparklineRow}>
              <Text style={styles.deptKpiMetricLabel}>Journals</Text>
              <Text style={[styles.sparklineValue, { color: "#7C3AED" }]}>
                {kpi.journalEntries}
              </Text>
            </View>
            <View style={styles.sparklineTrack}>
              <View
                style={[
                  styles.sparklineFill,
                  { width: `${kpi.journalPct}%`, backgroundColor: "#7C3AED" },
                ]}
              />
            </View>
          </View>
          <View style={styles.deptKpiMetricSpark}>
            <View style={styles.sparklineRow}>
              <Text style={styles.deptKpiMetricLabel}>LSN</Text>
              <Text style={[styles.sparklineValue, { color: "#9333EA" }]}>
                {kpi.lsnStudents}
              </Text>
            </View>
            <View style={styles.sparklineTrack}>
              <View
                style={[
                  styles.sparklineFill,
                  { width: `${kpi.lsnPct}%`, backgroundColor: "#9333EA" },
                ]}
              />
            </View>
          </View>
          <View style={styles.deptKpiMetricSpark}>
            <View style={styles.sparklineRow}>
              <Text style={styles.deptKpiMetricLabel}>Wellness</Text>
              <Text style={[styles.sparklineValue, { color: moodColor }]}>
                {kpi.moodWellnessPct}%
              </Text>
            </View>
            <View style={styles.sparklineTrack}>
              <View
                style={[
                  styles.sparklineFill,
                  {
                    width: `${kpi.moodWellnessPct}%`,
                    backgroundColor: moodColor,
                  },
                ]}
              />
            </View>
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

  /** Department bar graph row - grouped bars (low/moderate/high) with percentage on top */
  const renderDepartmentRow = (
    row: DepartmentRowData,
    totalAllDepts: number,
    maxLow: number,
    maxNormal: number,
    maxHigh: number,
    deptCount: number,
  ) => {
    const deptAbbr = getDeptAbbreviation(row.name);
    const shareOfTotal =
      totalAllDepts > 0
        ? Math.round((row.totalStudents / totalAllDepts) * 100)
        : 0;
    const groupWidth = Math.max(72, Math.min(100, Math.floor(640 / deptCount)));
    const barWidth = Math.max(12, Math.min(22, (groupWidth - 16) / 3));
    const barMaxHeight = 120;

    return (
      <Pressable
        key={row.name}
        style={({ pressed }) => [
          styles.barColumn,
          { width: groupWidth },
          pressed && { transform: [{ scale: 0.96 }], opacity: 0.9 },
        ]}
        onPress={() => setStudentListModal({ visible: true, title: row.name })}
      >
        {/* Percentage label on top */}
        <Text style={styles.barPctTop}>{shareOfTotal}%</Text>

        {/* Grouped bars */}
        <View style={styles.groupedBarRow}>
          <View style={styles.groupedBarCol}>
            <View
              style={[
                styles.groupedBar,
                {
                  height: Math.max(4, (row.lowCount / maxLow) * barMaxHeight),
                  width: barWidth,
                  backgroundColor: "#22C55E",
                },
              ]}
            />
            <Text style={styles.groupedBarVal}>{row.lowCount}</Text>
          </View>
          <View style={styles.groupedBarCol}>
            <View
              style={[
                styles.groupedBar,
                {
                  height: Math.max(
                    4,
                    (row.normalCount / maxNormal) * barMaxHeight,
                  ),
                  width: barWidth,
                  backgroundColor: "#F59E0B",
                },
              ]}
            />
            <Text style={styles.groupedBarVal}>{row.normalCount}</Text>
          </View>
          <View style={styles.groupedBarCol}>
            <View
              style={[
                styles.groupedBar,
                {
                  height: Math.max(4, (row.highCount / maxHigh) * barMaxHeight),
                  width: barWidth,
                  backgroundColor: "#EF4444",
                },
              ]}
            />
            <Text style={styles.groupedBarVal}>{row.highCount}</Text>
          </View>
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
      <View style={[styles.bottomWidget, isWide && styles.bottomWidgetWide]}>
        <Text style={styles.bottomWidgetTitle}>
          Overall Concern Distribution
        </Text>
        <View style={styles.donutContainer}>
          {/* Arc-based donut ring */}
          <View style={styles.donutRingWrap}>
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
                <Text style={styles.donutLegendText} numberOfLines={1}>
                  {slice.label}
                </Text>
                <Text style={styles.donutLegendValue}>
                  {slice.count} · {slice.value}%
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
        <Text style={styles.widgetInsightText}>
          {descriptiveInsights.visual.donut}
        </Text>
      </View>
    );
  };

  const renderRadialProgress = (pct: number) => {
    const clampedPct = Math.min(Math.max(pct, 0), 100);
    const notCompletedPct = 100 - clampedPct;
    const completedAngle = (clampedPct / 100) * 360;

    return (
      <Pressable
        style={[styles.bottomWidget, isWide && styles.bottomWidgetWide]}
        onPress={() =>
          setStudentListModal({
            visible: true,
            title: "Survey Assessment Status",
          })
        }
      >
        <Text style={styles.bottomWidgetTitle}>Survey Assessment Status</Text>
        <View style={styles.radialContainer}>
          <View style={styles.radialRingWrap}>
            <View style={styles.radialRing}>
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
          </View>
          <View style={styles.radialLegend}>
            <View style={styles.radialLegendItem}>
              <View
                style={[styles.radialLegendDot, { backgroundColor: "#7C3AED" }]}
              />
              <Text style={styles.radialLegendText} numberOfLines={1}>
                Took assessment
              </Text>
              <Text style={styles.radialLegendValue}>{clampedPct}%</Text>
            </View>
            <View style={styles.radialLegendItem}>
              <View
                style={[styles.radialLegendDot, { backgroundColor: "#EF4444" }]}
              />
              <Text style={styles.radialLegendText} numberOfLines={1}>
                Did not take
              </Text>
              <Text style={styles.radialLegendValue}>{notCompletedPct}%</Text>
            </View>
          </View>
          <View style={styles.radialCountsRow}>
            <Text style={styles.radialCountsText}>
              {assessedStudentCount} assessed · {studentSummaries.length} tracked ·{" "}
              {Math.max(studentSummaries.length - assessedStudentCount, 0)}{" "}
              not yet assessed
            </Text>
          </View>
        </View>
        <Text style={styles.widgetInsightText}>
          {descriptiveInsights.visual.radial}
        </Text>
      </Pressable>
    );
  };

  const renderComparativeChart = (metrics: EngagementMetric[]) => {
    return (
      <View style={[styles.bottomWidget, isWide && styles.bottomWidgetWide]}>
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
        <Text style={styles.widgetInsightText}>
          {descriptiveInsights.visual.engagement}
        </Text>
      </View>
    );
  };

  function getFilterFnForTitle(title: string): (s: StudentSummary) => boolean {
    const lowerTitle = title.toLowerCase();

    if (lowerTitle.includes("lower concern") || lowerTitle.includes("low concern")) {
      if (lowerTitle.includes("students") || lowerTitle.includes("indicators"))
        return (s) => s.latestRiskLevel === "low";
      const dept = title.split(" - ")[0];
      return (s) => s.department === dept && s.latestRiskLevel === "low";
    }
    if (
      lowerTitle.includes("medium concern") ||
      lowerTitle.includes("moderate concern")
    ) {
      if (lowerTitle.includes("students") || lowerTitle.includes("indicators"))
        return (s) => s.latestRiskLevel === "normal";
      const dept = title.split(" - ")[0];
      return (s) => s.department === dept && s.latestRiskLevel === "normal";
    }
    if (lowerTitle.includes("elevated concern") || lowerTitle.includes("high concern")) {
      if (lowerTitle.includes("students") || lowerTitle.includes("indicators"))
        return (s) => s.latestRiskLevel === "high";
      const dept = title.split(" - ")[0];
      return (s) => s.department === dept && s.latestRiskLevel === "high";
    }
    if (
      lowerTitle.includes("special needs (lsn)") ||
      lowerTitle.includes("lsn students")
    ) {
      return (s) => s.isLSN === true;
    }
    if (lowerTitle.includes("at-risk students")) {
      return (s) => s.latestRiskLevel === "high";
    }
    if (lowerTitle.includes("moderate students")) {
      return (s) => s.latestRiskLevel === "normal";
    }
    if (lowerTitle.includes("healthy students")) {
      return (s) => s.latestRiskLevel === "low";
    }
    if (lowerTitle.includes("% at risk")) {
      return (s) => s.latestRiskLevel === "high";
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

    const deptCode = getDepartmentCode(title);
    return (s) =>
      s.department === title || getDepartmentCode(s.department) === deptCode;
  }

  return (
    <SafeAreaView style={[styles.container, isWide && styles.containerWide]}>
      <View style={[styles.mainLayout, isWide && styles.mainLayoutWide]}>
        <View
          style={[
            styles.header,
            isWide && { paddingHorizontal: responsivePadding },
          ]}
        >
          <Text style={styles.headerTitle}>
            {adminCollege
              ? `${adminCollege} Analytics Overview`
              : "Analytics Overview"}
          </Text>
          <View style={styles.headerActions}>
            {isSuperAdmin && (
              <HeaderIconButton
                label="Security / Admin Management"
                icon="shield-checkmark-outline"
                onPress={() =>
                  router.push("/(superadmin)/admin-management")
                }
                badge={
                  pendingResetCount > 0 ? (
                    <View style={styles.notificationBadge}>
                      <Text style={styles.notificationBadgeText}>
                        {pendingResetCount > 99 ? "99+" : pendingResetCount}
                      </Text>
                    </View>
                  ) : undefined
                }
              />
            )}
            <HeaderIconButton
              label="Student Management"
              icon="people-outline"
              onPress={() => router.push("/(admin)/student-management")}
            />
            <HeaderIconButton
              label="Messages / Inbox"
              icon="chatbubble-ellipses-outline"
              variant="messages"
              color={ADMIN_COLORS.purple}
              alignRight
              onPress={() => router.push("/(admin)/messages")}
            />
            <HeaderIconButton
              label="My Profile"
              icon="person-circle-outline"
              alignRight
              onPress={() => router.push("/profile")}
            />
            <HeaderIconButton
              label="Sign Out"
              icon="log-out-outline"
              color="#DC2626"
              alignRight
              onPress={() => {
                setSignOutError(null);
                setSignOutConfirmVisible(true);
              }}
            />
          </View>
        </View>

        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[
            styles.content,
            isWide && { padding: responsivePadding, paddingBottom: 40 },
          ]}
          showsVerticalScrollIndicator={true}
          onScroll={(e) => {
            const offsetY = e.nativeEvent.contentOffset.y;
            scrollYRef.current = offsetY;
            console.log("Scroll Y:", offsetY);
            setShowScrollTop(offsetY > 300);
          }}
          scrollEventThrottle={50}
        >
          <View style={styles.tabBar}>
            {TABS.map((tab) => {
              const active = activeTab === tab.key;
              return (
                <Pressable
                  key={tab.key}
                  style={({
                    pressed,
                    hovered,
                  }: WebPressableState) => [
                    styles.tabButton,
                    active && styles.tabButtonActive,
                    !active && (hovered || pressed) && styles.tabButtonHover,
                  ]}
                  onPress={() => setActiveTab(tab.key)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                >
                  <Text
                    style={[
                      styles.tabLabel,
                      active && styles.tabLabelActive,
                    ]}
                  >
                    {tab.label}
                  </Text>
                </Pressable>
              );
            })}
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
                      <View style={styles.lookupTitleBlock}>
                        <Text style={styles.sectionTitle}>Student Lookup</Text>
                        <Text style={styles.sectionSubtitle}>
                          Search students
                        </Text>
                      </View>
                      <Pressable
                        style={({
                          pressed,
                          hovered,
                        }: WebPressableState) => [
                          styles.createAdminButton,
                          hovered && styles.createAdminButtonHover,
                          pressed && styles.createAdminButtonPressed,
                        ]}
                        onPress={() => setCreateAdminModalVisible(true)}
                        accessibilityRole="button"
                        accessibilityLabel="Create admin account"
                      >
                        <Ionicons name="person-add" size={16} color="white" />
                        <Text style={styles.createAdminButtonText}>
                          Create Admin
                        </Text>
                      </Pressable>
                    </View>
                    <View style={styles.searchWrap}>
                      <Ionicons name="search" size={18} color="#94A3B8" />
                      <TextInput
                        style={styles.searchInput}
                        placeholder="Search by name, ID, year, or department..."
                        placeholderTextColor="#94A3B8"
                        value={searchTerm}
                        onChangeText={handleSearchChange}
                      />
                      {searchTerm.length > 0 && (
                        <Pressable
                          style={styles.searchClear}
                          onPress={() => handleSearchChange("")}
                          accessibilityRole="button"
                          accessibilityLabel="Clear search"
                        >
                          <Ionicons
                            name="close-circle"
                            size={18}
                            color="#94A3B8"
                          />
                        </Pressable>
                      )}
                    </View>
                  </View>

                  <Text style={styles.resultsLabel}>Students</Text>
                  {paginatedStudents.length === 0 ? (
                    <View style={styles.stateCard}>
                      <Text style={styles.stateText}>
                        No students match your search.
                      </Text>
                    </View>
                  ) : (
                    <View style={isWide && styles.studentGrid}>
                      {paginatedStudents.map((student) => {
                        const moods = Object.entries(student.moodCounts)
                          .sort(([, a], [, b]) => b - a)
                          .map(([mood, count]) => `${mood} (${count})`)
                          .slice(0, 3)
                          .join(", ");

                        const risk = student.latestRiskLevel;

                        return (
                          <Pressable
                            key={student.uid}
                            style={({ hovered }: WebPressableState) => [
                              styles.studentCard,
                              isWide && styles.studentCardWide,
                              hovered && styles.studentCardHover,
                            ]}
                            onPress={() =>
                              router.push({
                                pathname: "./student-detail",
                                params: { uid: student.uid },
                              })
                            }
                          >
                            <View style={styles.studentHeader}>
                              <View style={styles.studentIdentityBlock}>
                                <View style={styles.studentNameRow}>
                                  <Text style={styles.studentName}>
                                    {student.name}
                                  </Text>
                                  <Ionicons
                                    name="chevron-forward"
                                    size={14}
                                    color={ADMIN_COLORS.purple}
                                  />
                                </View>
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
                                  <Ionicons
                                    name="accessibility"
                                    size={12}
                                    color={ADMIN_COLORS.purple}
                                  />
                                  <Text style={styles.lsnBadgeText}>LSN</Text>
                                </View>
                                <Text style={styles.lsnTypeText} numberOfLines={1}>
                                  {student.specialNeedsType ||
                                    formatLsnCategory(student.lsnCategory)}
                                </Text>
                                {student.lsnDocument?.secureUrl ? (
                                  <View style={styles.lsnDocIndicator}>
                                    <Ionicons
                                      name="document-attach"
                                      size={11}
                                      color={ADMIN_COLORS.purple}
                                    />
                                    <Text style={styles.lsnDocText}>
                                      Doc attached
                                    </Text>
                                  </View>
                                ) : null}
                              </View>
                            )}
                            <View style={styles.studentStatsGrid}>
                              <View style={styles.statCell}>
                                <Text style={styles.statLabel}>
                                  Assessments
                                </Text>
                                <Text style={styles.statValue}>
                                  {student.assessmentsCount}
                                </Text>
                              </View>
                              <View style={styles.statCell}>
                                <Text style={styles.statLabel}>Journals</Text>
                                <Text style={styles.statValue}>
                                  {student.journalCount}
                                </Text>
                              </View>
                              <View style={styles.statDivider} />
                              <View style={styles.statCell}>
                                <Text style={styles.statLabel}>
                                  Latest Concern
                                </Text>
                                {risk ? (
                                  <View
                                    style={[
                                      styles.riskBadge,
                                      risk === "low"
                                        ? styles.riskBadgeLow
                                        : risk === "high"
                                          ? styles.riskBadgeHigh
                                          : styles.riskBadgeModerate,
                                    ]}
                                  >
                                    <View
                                      style={[
                                        styles.riskDot,
                                        risk === "low"
                                          ? styles.riskDotLow
                                          : risk === "high"
                                            ? styles.riskDotHigh
                                            : styles.riskDotModerate,
                                      ]}
                                    />
                                    <Text
                                      style={[
                                        styles.riskBadgeText,
                                        risk === "low"
                                          ? styles.riskLow
                                          : risk === "high"
                                            ? styles.riskHigh
                                            : styles.riskModerate,
                                      ]}
                                    >
                                      {risk === "low"
                                        ? "Low"
                                        : risk === "high"
                                          ? "High"
                                          : "Moderate"}
                                    </Text>
                                  </View>
                                ) : (
                                  <Text style={styles.statValue}>N/A</Text>
                                )}
                              </View>
                              <View style={styles.statCell}>
                                <Text style={styles.statLabel}>
                                  Latest Score
                                </Text>
                                <Text style={styles.statValueHighlight}>
                                  {student.latestTotalScore ?? "N/A"}
                                </Text>
                              </View>
                              <View style={styles.statDivider} />
                              <View style={styles.statCell}>
                                <Text style={styles.statLabel}>
                                  Last Assessment
                                </Text>
                                <Text style={styles.statValue}>
                                  {student.latestAssessmentDate
                                    ? student.latestAssessmentDate.toLocaleDateString()
                                    : "N/A"}
                                </Text>
                              </View>
                              <View style={styles.statCell}>
                                <Text style={styles.statLabel}>
                                  Recent Mood
                                </Text>
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
                              style={({
                                pressed,
                                hovered,
                              }: WebPressableState) => [
                                styles.removeButton,
                                (hovered || pressed) &&
                                  styles.removeButtonHover,
                              ]}
                              onPress={() => {
                                setConfirmRemoveUid(student.uid);
                                setConfirmRemoveName(student.name);
                              }}
                              accessibilityRole="button"
                              accessibilityLabel={`Remove ${student.name}`}
                            >
                              <Ionicons
                                name="trash-outline"
                                size={16}
                                color="#DC2626"
                              />
                              <Text style={styles.removeButtonText}>
                                Remove Student
                              </Text>
                            </Pressable>
                          </Pressable>
                        );
                      })}
                    </View>
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
                      <Text style={styles.sectionTitle}>
                        {editingAnnouncementId
                          ? "Edit Announcement"
                          : "Create Announcement"}
                      </Text>
                      {editingAnnouncementId && (
                        <Pressable
                          style={styles.editAnnouncementBtn}
                          onPress={() => {
                            setEditingAnnouncementId(null);
                            setAnnouncementTitle("");
                            setAnnouncementDescription("");
                            setAnnouncementLinks([]);
                            setAnnouncementDepartments(["ALL"]);
                            setAnnouncementError(null);
                          }}
                        >
                          <Ionicons
                            name="close-circle"
                            size={18}
                            color="#EF4444"
                          />
                          <Text style={styles.editAnnouncementBtnText}>
                            Cancel
                          </Text>
                        </Pressable>
                      )}
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
                        style={[
                          styles.formInput,
                          { minHeight: 80, textAlignVertical: "top" as const },
                        ]}
                        placeholder="Write your announcement here..."
                        placeholderTextColor="#94A3B8"
                        value={announcementDescription}
                        onChangeText={setAnnouncementDescription}
                        multiline
                        numberOfLines={4}
                      />
                    </View>
                    <View style={styles.formGroup}>
                      <Text style={styles.formLabel}>Target Departments</Text>
                      <View style={styles.deptChipRow}>
                        <Pressable
                          style={[
                            styles.deptChip,
                            announcementDepartments.includes("ALL") &&
                              styles.deptChipActive,
                          ]}
                          onPress={() => toggleDepartment("ALL")}
                        >
                          <Text
                            style={[
                              styles.deptChipText,
                              announcementDepartments.includes("ALL") &&
                                styles.deptChipTextActive,
                            ]}
                          >
                            All Departments
                          </Text>
                        </Pressable>
                        {DEPARTMENTS.map((code) => (
                          <Pressable
                            key={code}
                            style={[
                              styles.deptChip,
                              announcementDepartments.includes(code) &&
                                styles.deptChipActive,
                            ]}
                            onPress={() => toggleDepartment(code)}
                          >
                            <Text
                              style={[
                                styles.deptChipText,
                                announcementDepartments.includes(code) &&
                                  styles.deptChipTextActive,
                              ]}
                            >
                              {code}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
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
                            onPress={() =>
                              setAnnouncementLinks(
                                announcementLinks.filter((_, i) => i !== idx),
                              )
                            }
                          >
                            <Ionicons
                              name="close-circle"
                              size={22}
                              color="#EF4444"
                            />
                          </Pressable>
                        </View>
                      ))}
                      <Pressable
                        style={styles.addLinkBtn}
                        onPress={() =>
                          setAnnouncementLinks([
                            ...announcementLinks,
                            { title: "", url: "" },
                          ])
                        }
                      >
                        <Ionicons
                          name="add-circle-outline"
                          size={18}
                          color="#8A63D2"
                        />
                        <Text style={styles.addLinkText}>Add Link</Text>
                      </Pressable>
                    </View>
                    {announcementError && (
                      <Text style={styles.errorText}>{announcementError}</Text>
                    )}
                    <Pressable
                      style={[
                        styles.postButton,
                        creatingAnnouncement && { opacity: 0.7 },
                      ]}
                      onPress={async () => {
                        if (
                          !announcementTitle.trim() ||
                          !announcementDescription.trim()
                        ) {
                          setAnnouncementError(
                            "Title and description are required.",
                          );
                          return;
                        }
                        const validLinks = announcementLinks.filter(
                          (l) => l.title.trim() && l.url.trim(),
                        );
                        setCreatingAnnouncement(true);
                        setAnnouncementError(null);
                        try {
                          const adminDoc = await getDoc(
                            doc(db, "admins", user!.uid),
                          );
                          const adminData = adminDoc.data();
                          const targetDepartments =
                            announcementDepartments.includes("ALL")
                              ? ["ALL"]
                              : announcementDepartments;
                          if (editingAnnouncementId) {
                            await updateAnnouncement(editingAnnouncementId, {
                              title: announcementTitle.trim(),
                              description: announcementDescription.trim(),
                              links: validLinks,
                              authorName:
                                user!.displayName ||
                                adminData?.displayName ||
                                "Admin",
                              authorPosition: adminData?.position || undefined,
                              authorPhotoUrl:
                                adminData?.profileImage || undefined,
                              targetDepartments,
                            });
                          } else {
                            await createAnnouncement({
                              title: announcementTitle.trim(),
                              description: announcementDescription.trim(),
                              links: validLinks,
                              authorName:
                                user!.displayName ||
                                adminData?.displayName ||
                                "Admin",
                              adminId: user!.uid,
                              authorPosition: adminData?.position || undefined,
                              authorPhotoUrl:
                                adminData?.profileImage || undefined,
                              targetDepartments,
                            });
                          }
                          setAnnouncementTitle("");
                          setAnnouncementDescription("");
                          setAnnouncementLinks([]);
                          setAnnouncementDepartments(["ALL"]);
                          setEditingAnnouncementId(null);
                          Alert.alert(
                            "Success",
                            editingAnnouncementId
                              ? "Announcement updated."
                              : "Announcement posted.",
                          );
                        } catch (err) {
                          setAnnouncementError(
                            err instanceof Error
                              ? err.message
                              : "Failed to post.",
                          );
                        } finally {
                          setCreatingAnnouncement(false);
                        }
                      }}
                      disabled={creatingAnnouncement}
                    >
                      {creatingAnnouncement ? (
                        <ActivityIndicator color="white" />
                      ) : (
                        <Text style={styles.postButtonText}>
                          {editingAnnouncementId
                            ? "Update Announcement"
                            : "Post Announcement"}
                        </Text>
                      )}
                    </Pressable>
                  </View>

                  <Text style={styles.sectionHeader}>All Announcements</Text>
                  {announcements.length === 0 ? (
                    <View style={styles.stateCard}>
                      <Ionicons
                        name="megaphone-outline"
                        size={40}
                        color="#D1D5DB"
                      />
                      <Text style={styles.stateText}>
                        No announcements yet.
                      </Text>
                    </View>
                  ) : (
                    announcements.map((a) => (
                      <View key={a.id} style={styles.announcementCard}>
                        <View style={styles.announcementCardHeader}>
                          <Ionicons
                            name="megaphone"
                            size={18}
                            color="#8A63D2"
                          />
                          <Text style={styles.announcementCardTitle}>
                            {a.title}
                          </Text>
                        </View>
                        <Text style={styles.announcementCardBody}>
                          {a.description}
                        </Text>
                        {a.links.length > 0 && (
                          <View style={styles.announcementLinksWrap}>
                            {a.links.map((link, idx) => (
                              <Text
                                key={idx}
                                style={styles.announcementLinkItem}
                              >
                                {link.title}: {link.url}
                              </Text>
                            ))}
                          </View>
                        )}
                        {!a.targetDepartments.includes("ALL") && (
                          <View style={styles.announcementDeptRow}>
                            {a.targetDepartments.map((dept) => (
                              <View key={dept} style={styles.expiryBadge}>
                                <Ionicons
                                  name="people-outline"
                                  size={12}
                                  color="#8A63D2"
                                />
                                <Text style={styles.expiryText}>{dept}</Text>
                              </View>
                            ))}
                          </View>
                        )}
                        <View style={styles.announcementCardFooter}>
                          <View style={styles.announcementAuthorRow}>
                            {a.authorPhotoUrl ? (
                              <Image
                                source={{ uri: a.authorPhotoUrl }}
                                style={styles.announcementAuthorAvatar}
                              />
                            ) : (
                              <View
                                style={
                                  styles.announcementAuthorAvatarPlaceholder
                                }
                              >
                                <Text
                                  style={styles.announcementAuthorAvatarText}
                                >
                                  {(a.authorName || "A")
                                    .charAt(0)
                                    .toUpperCase()}
                                </Text>
                              </View>
                            )}
                            <View style={{ flex: 1 }}>
                              <Text style={styles.announcementCardMeta}>
                                {a.authorName}
                                {a.authorPosition
                                  ? `, ${a.authorPosition}`
                                  : ""}
                              </Text>
                              <Text style={styles.announcementCardDate}>
                                {formatAnnouncementDateTime(a.createdAt)}
                              </Text>
                            </View>
                          </View>
                          <View style={styles.expiryBadge}>
                            <Ionicons
                              name="time-outline"
                              size={12}
                              color="#8A63D2"
                            />
                            <Text style={styles.expiryText}>
                              {getDaysRemaining(a.expiresAt)}d left
                            </Text>
                          </View>
                          <Pressable
                            style={styles.editAnnouncementBtn}
                            onPress={() => {
                              setEditingAnnouncementId(a.id);
                              setAnnouncementTitle(a.title);
                              setAnnouncementDescription(a.description);
                              setAnnouncementLinks(
                                a.links.map((l) => ({ ...l })),
                              );
                              setAnnouncementDepartments([
                                ...a.targetDepartments,
                              ]);
                              setAnnouncementError(null);
                            }}
                          >
                            <Ionicons
                              name="pencil-outline"
                              size={16}
                              color="#8A63D2"
                            />
                          </Pressable>
                          <Pressable
                            style={styles.deleteAnnouncementBtn}
                            onPress={() => setDeleteAnnounceId(a.id)}
                          >
                            <Ionicons
                              name="trash-outline"
                              size={16}
                              color="#EF4444"
                            />
                          </Pressable>
                        </View>
                      </View>
                    ))
                  )}
                </>
              ) : activeTab === "reports" ? (
                <>
                  <View style={styles.lookupCard}>
                    <View style={styles.lookupHeader}>
                      <Text style={styles.sectionTitle}>Report Filters</Text>
                      <Ionicons
                        name="options-outline"
                        size={18}
                        color={ADMIN_COLORS.purple}
                      />
                    </View>

                    <View style={styles.reportFiltersGrid}>
                      <ReportSelectField
                        id="period"
                        label="Period"
                        options={([
                          "weekly",
                          "monthly",
                          "trimester",
                          "annual",
                          "custom",
                        ] as ReportPeriodType[]).map((t) => ({
                          value: t,
                          label:
                            t === "weekly"
                              ? "Weekly"
                              : t === "monthly"
                                ? "Monthly"
                                : t === "trimester"
                                  ? "By Trimester"
                                  : t === "annual"
                                    ? "Annual"
                                    : "Custom",
                        }))}
                        value={reportPeriodType}
                        onSelect={(v) => setReportPeriodType(v as ReportPeriodType)}
                        open={reportFilterOpen === "period"}
                        onOpenChange={(o) =>
                          setReportFilterOpen(o ? "period" : null)
                        }
                      />
                      <ReportSelectField
                        id="academicYear"
                        label="Academic Year"
                        placeholder="Select academic year…"
                        options={academicYears().map((y) => ({
                          value: String(y),
                          label: academicYearLabel(y),
                        }))}
                        value={String(reportYear)}
                        onSelect={(v) => setReportYear(Number(v))}
                        open={reportFilterOpen === "academicYear"}
                        onOpenChange={(o) =>
                          setReportFilterOpen(o ? "academicYear" : null)
                        }
                      />
                      {reportPeriodType === "monthly" ? (
                        <ReportSelectField
                          id="month"
                          label="Month"
                          options={MONTH_NAMES.map((m, idx) => ({
                            value: String(idx),
                            label: m,
                          }))}
                          value={String(reportMonth)}
                          onSelect={(v) => setReportMonth(Number(v))}
                          open={reportFilterOpen === "month"}
                          onOpenChange={(o) =>
                            setReportFilterOpen(o ? "month" : null)
                          }
                        />
                      ) : null}
                      {reportPeriodType === "trimester" ? (
                        <ReportSelectField
                          id="trimester"
                          label="Trimester"
                          options={([1, 2, 3] as TrimesterNumber[]).map((s) => ({
                            value: String(s),
                            label:
                              s === 1
                                ? "1st Trimester"
                                : s === 2
                                  ? "2nd Trimester"
                                  : "3rd Trimester",
                          }))}
                          value={String(reportTrimester)}
                          onSelect={(v) =>
                            setReportTrimester(Number(v) as TrimesterNumber)
                          }
                          open={reportFilterOpen === "trimester"}
                          onOpenChange={(o) =>
                            setReportFilterOpen(o ? "trimester" : null)
                          }
                        />
                      ) : null}
                      <ReportSelectField
                        id="department"
                        label="Department / College"
                        options={[
                          { value: "all", label: "All Departments" },
                          ...reportDepartments.map((d) => ({
                            value: d.code,
                            label: `${d.code} — ${d.name}`,
                          })),
                        ]}
                        value={reportDepartment}
                        onSelect={(v) => setReportDepartment(v)}
                        open={reportFilterOpen === "department"}
                        onOpenChange={(o) =>
                          setReportFilterOpen(o ? "department" : null)
                        }
                        wide
                      />
                    </View>

                    {reportPeriodType === "weekly" && (
                      <View style={styles.reportField}>
                        <Text style={styles.reportLabel}>Week</Text>
                        <Text style={styles.reportValue}>
                          {resolveWeeklyPeriod(reportWeekStart).label}
                        </Text>
                        <View style={styles.reportWeekNav}>
                          <Pressable
                            style={styles.reportWeekBtn}
                            onPress={() =>
                              setReportWeekStart((d) => {
                                const next = new Date(d);
                                next.setDate(next.getDate() - 7);
                                return next;
                              })
                            }
                          >
                            <Ionicons name="chevron-back" size={16} color="#5B21B6" />
                            <Text style={styles.reportWeekBtnText}>Prev Week</Text>
                          </Pressable>
                          <Pressable
                            style={styles.reportWeekBtn}
                            onPress={() =>
                              setReportWeekStart((d) => {
                                const next = new Date(d);
                                next.setDate(next.getDate() + 7);
                                return next;
                              })
                            }
                          >
                            <Text style={styles.reportWeekBtnText}>Next Week</Text>
                            <Ionicons name="chevron-forward" size={16} color="#5B21B6" />
                          </Pressable>
                        </View>
                      </View>
                    )}

                    {reportPeriodType === "custom" && (
                      <View style={styles.reportField}>
                        <Text style={styles.reportLabel}>Custom Date Range</Text>
                        <Text style={styles.reportDateHint}>
                          Start date must be on or before the end date.
                        </Text>
                        <View style={styles.reportDateRow}>
                          <View style={styles.reportDateField}>
                            <Text style={styles.reportDateFieldLabel}>
                              Start Date
                            </Text>
                            <TextInput
                              style={styles.reportDateInput}
                              value={toLocalDateInput(reportCustomStart)}
                              onChangeText={(text) => {
                                const d = new Date(text + "T00:00:00");
                                if (!Number.isNaN(d.getTime())) {
                                  setReportCustomStart(d);
                                }
                              }}
                              placeholder="YYYY-MM-DD"
                            />
                          </View>
                          <View style={styles.reportDateField}>
                            <Text style={styles.reportDateFieldLabel}>
                              End Date
                            </Text>
                            <TextInput
                              style={styles.reportDateInput}
                              value={toLocalDateInput(reportCustomEnd)}
                              onChangeText={(text) => {
                                const d = new Date(text + "T00:00:00");
                                if (!Number.isNaN(d.getTime())) {
                                  setReportCustomEnd(d);
                                }
                              }}
                              placeholder="YYYY-MM-DD"
                            />
                          </View>
                        </View>
                      </View>
                    )}

                    <View style={styles.reportActionsRow}>
                      <Pressable
                        style={({ pressed }) => [
                          styles.generateReportBtn,
                          reportGenerating && { opacity: 0.6 },
                          pressed && { opacity: 0.85 },
                        ]}
                        disabled={reportGenerating}
                        onPress={handleGenerateReport}
                      >
                        <Ionicons name="filter-outline" size={18} color="#FFFFFF" />
                        <Text style={styles.generateReportBtnText}>
                          {reportGenerating ? "Updating..." : "Apply Filters"}
                        </Text>
                      </Pressable>
                      <Pressable
                        style={({ pressed }) => [
                          styles.resetReportBtn,
                          reportGenerating && { opacity: 0.6 },
                          pressed && { opacity: 0.85 },
                        ]}
                        disabled={reportGenerating}
                        onPress={handleResetReport}
                      >
                        <Ionicons name="refresh-outline" size={18} color="#7C3AED" />
                        <Text style={styles.resetReportBtnText}>Reset Filters</Text>
                      </Pressable>
                    </View>

                    {reportStatus ? (
                      <Text style={styles.reportStatus}>{reportStatus}</Text>
                    ) : null}

                    {reportAppliedChips && reportAppliedChips.length > 0 ? (
                      <View style={styles.activeFiltersRow}>
                        <Text style={styles.activeFiltersLabel}>
                          Active filters:
                        </Text>
                        <View style={styles.activeFiltersWrap}>
                          {reportAppliedChips.map((c) => (
                            <View key={c} style={styles.activeFilterChip}>
                              <Text style={styles.activeFilterChipText}>
                                {c}
                              </Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    ) : null}
                  </View>

{reportData && (
                    <View style={[styles.lookupCard, { marginTop: 16 }]}>
                      <View style={styles.lookupHeader}>
                        <Text style={styles.sectionTitle}>
                          {reportPreviewTitle(reportData)}
                        </Text>
                        {reportGenerating ? (
                          <View style={styles.previewPendingBadge}>
                            <Ionicons
                              name="hourglass-outline"
                              size={13}
                              color="#5B21B6"
                            />
                            <Text style={styles.previewPendingText}>
                              Updating…
                            </Text>
                          </View>
                        ) : null}
                      </View>
                      {reportGenerating ? (
                        <Text style={styles.reportUpdatingNote}>
                          Updating report… Loading latest data for the selected
                          filters.
                        </Text>
                      ) : null}

                      {/* ─── REPORT SCOPE (auditable) ─────────────────────── */}
                      <View
                        style={[
                          styles.reportScopeBox,
                          reportGenerating && styles.reportStale,
                        ]}
                      >
                        <Text style={styles.reportScopeTitle}>REPORT SCOPE</Text>
                        {(() => {
                          const dq = reportData.dataQuality;
                          const scopeRows: [string, string][] = [
                            [
                              "Period",
                              `${reportData.periodType === "weekly"
                                ? "Weekly"
                                : reportData.periodType === "monthly"
                                  ? "Monthly"
                                  : reportData.periodType === "trimester"
                                    ? "Trimester"
                                    : reportData.periodType === "annual"
                                      ? "Annual"
                                      : "Custom"}`,
                            ],
                            [
                              "Reporting Period",
                              `${formatReportingDay(reportData.dateRange.startDate)} – ${formatReportingDay(
                                new Date(reportData.dateRange.endDate.getTime() - 1),
                              )}`,
                            ],
                            [
                              "Academic Year",
                              reportData.academicYearLabel,
                            ],
                            [
                              "Academic Trimester",
                              reportData.periodType === "monthly" ||
                              reportData.periodType === "weekly"
                                ? `${reportData.trimesterLabel ?? "—"} (derived from selected month/week)`
                                : (reportData.trimesterLabel ?? "—"),
                            ],
                            [
                              "Department",
                              reportData.departmentFilter?.name ??
                                "All Departments",
                            ],
                            [
                              "Population",
                              `${reportData.overview.totalStudents} students`,
                            ],
                            [
                              "Active Students",
                              `${reportData.overview.activeStudents} students`,
                            ],
                          ];
                          return (
                            <View>
                              {scopeRows.map(([k, v]) => (
                                <View key={k} style={styles.reportScopeRow}>
                                  <Text style={styles.reportScopeKey}>{k}</Text>
                                  <Text style={styles.reportScopeValue}>{v}</Text>
                                </View>
                              ))}
                              {dq.missingDate > 0 ||
                              dq.missingDepartment > 0 ||
                              dq.missingStudentId > 0 ? (
                                <View style={styles.reportQualityNotice}>
                                  <Ionicons
                                    name="information-circle-outline"
                                    size={14}
                                    color="#92400E"
                                  />
                                  <Text style={styles.reportQualityText}>
                                    Data-quality notice:{" "}
                                    {[
                                      dq.missingDate > 0 &&
                                        `${dq.missingDate} record(s) missing a valid event date`,
                                      dq.missingDepartment > 0 &&
                                        `${dq.missingDepartment} record(s) missing a department`,
                                      dq.missingStudentId > 0 &&
                                        `${dq.missingStudentId} record(s) missing a student reference`,
                                    ]
                                      .filter(Boolean)
                                      .join("; ")}{" "}
                                    were excluded from this report.
                                  </Text>
                                </View>
                              ) : null}
                            </View>
                          );
                        })()}
                      </View>

                      {/* ─── KPI GRID (7 cards) ─────────────────────────── */}
                      <View
                        style={[
                          styles.reportPreviewGrid,
                          reportGenerating && styles.reportStale,
                        ]}
                      >
                        {(
                          [
                            { label: "Total Students", value: reportData.overview.totalStudents, icon: "people-outline" },
                            { label: "Active Students", value: reportData.overview.activeStudents, icon: "pulse-outline" },
                            { label: "Students Assessed", value: reportData.overview.assessed, icon: "clipboard-outline" },
                            { label: "Low Concern", value: reportData.concernDistribution.low, icon: "leaf-outline" },
                            { label: "Medium Concern", value: reportData.concernDistribution.medium, icon: "warning-outline" },
                            { label: "High Concern", value: reportData.concernDistribution.high, icon: "alert-circle-outline" },
                            { label: "Attention Required", value: reportData.attentionRequired.count, icon: "flag-outline" },
                          ] as {
                            label: string;
                            value: number;
                            icon: keyof typeof Ionicons.glyphMap;
                          }[]
                        ).map((card) => (
                          <View
                            key={card.label}
                            style={styles.reportPreviewItem}
                          >
                            <Ionicons
                              name={card.icon}
                              size={16}
                              color="#7C3AED"
                            />
                            <Text style={styles.reportPreviewValue}>
                              {card.value}
                            </Text>
                            <Text style={styles.reportPreviewLabel}>
                              {card.label}
                            </Text>
                          </View>
                        ))}
                      </View>

                      {/* ─── CONCERN DISTRIBUTION (compact cards) ───────── */}
                      <Text style={styles.reportSubsectionTitle}>
                        Concern Distribution
                      </Text>
                      {reportData.overview.assessed > 0 ? (
                        <View
                          style={[
                            styles.concernCards,
                            reportGenerating && styles.reportStale,
                          ]}
                        >
                          {(
                            [
                              { label: "High Concern", count: reportData.concernDistribution.high, color: "#DC2626" },
                              { label: "Medium Concern", count: reportData.concernDistribution.medium, color: "#EAB308" },
                              { label: "Low Concern", count: reportData.concernDistribution.low, color: "#16A34A" },
                            ] as {
                              label: string;
                              count: number;
                              color: string;
                            }[]
                          ).map(({ label, count, color }) => {
                            const assessed = reportData.overview.assessed;
                            const pct =
                              assessed > 0
                                ? Math.round((count / assessed) * 100)
                                : 0;
                            return (
                              <View key={label} style={styles.concernCard}>
                                <View
                                  style={[
                                    styles.concernCardDot,
                                    { backgroundColor: color },
                                  ]}
                                />
                                <Text style={styles.concernCardLabel}>
                                  {label}
                                </Text>
                                <Text style={styles.concernCardValue}>
                                  {count}
                                </Text>
                                <Text style={styles.concernCardPct}>
                                  {pct}% of assessed
                                </Text>
                              </View>
                            );
                          })}
                        </View>
                      ) : (
                        <View style={styles.reportEmptyInline}>
                          <Ionicons
                            name="document-outline"
                            size={20}
                            color="#9CA3AF"
                          />
                          <Text style={styles.reportEmptyInlineText}>
                            No assessment data available for this reporting
                            period.
                          </Text>
                        </View>
                      )}

                      {/* ─── ACTIVITY IN PERIOD ─────────────────────────── */}
                      <Text style={styles.reportSubsectionTitle}>
                        Activity in Period
                      </Text>
                      <View
                        style={[
                          styles.activityRows,
                          reportGenerating && styles.reportStale,
                        ]}
                      >
                        {(
                          [
                            { label: "Assessments (records)", value: reportData.overview.totalAssessments },
                            { label: "Mood Entries", value: reportData.overview.totalMoodEntries },
                            { label: "Journal Entries", value: reportData.overview.totalJournals },
                            { label: "Survey Responses", value: reportData.overview.totalSurveys },
                          ] as { label: string; value: number }[]
                        ).map((row) => (
                          <View key={row.label} style={styles.activityRow}>
                            <Ionicons
                              name="disc-outline"
                              size={14}
                              color="#8B5CF6"
                              style={styles.activityRowIcon}
                            />
                            <Text style={styles.activityRowLabel}>
                              {row.label}
                            </Text>
                            <Text style={styles.activityRowValue}>
                              {row.value}
                            </Text>
                          </View>
                        ))}
                      </View>

                      {/* ─── COMPARISON vs PREVIOUS PERIOD ─────────────── */}
                      {reportData.trendComparison.length > 0 ? (
                        <>
                          <Text style={styles.reportSubsectionTitle}>
                            Comparison vs Previous Period
                          </Text>
                          <Text style={styles.reportSubsectionCaption}>
                            {reportData.previousPeriod?.label ??
                              "Previous period"}
                          </Text>
                          <View
                            style={[
                              styles.comparisonTable,
                              reportGenerating && styles.reportStale,
                            ]}
                          >
                            <View style={styles.comparisonHeader}>
                              <Text style={styles.comparisonHeaderMetric}>
                                Metric
                              </Text>
                              <Text style={styles.comparisonHeaderValue}>
                                Current
                              </Text>
                              <Text style={styles.comparisonHeaderValue}>
                                Previous
                              </Text>
                              <Text style={styles.comparisonHeaderChange}>
                                Change
                              </Text>
                            </View>
                            {reportData.trendComparison.map((t) => {
                              const change = comparisonChangeLabel(t);
                              return (
                                <View
                                  key={t.label}
                                  style={styles.comparisonRow}
                                >
                                  <Text style={styles.comparisonMetric}>
                                    {t.label}
                                  </Text>
                                  <Text style={styles.comparisonValue}>
                                    {t.current}
                                  </Text>
                                  <Text style={styles.comparisonPrev}>
                                    {t.previous}
                                  </Text>
                                  <Text
                                    style={[
                                      styles.comparisonChange,
                                      change.tone === "up" && {
                                        color: "#DC2626",
                                      },
                                      change.tone === "down" && {
                                        color: "#16A34A",
                                      },
                                      change.tone === "muted" && {
                                        color: "#9CA3AF",
                                      },
                                    ]}
                                  >
                                    {change.text}
                                  </Text>
                                </View>
                              );
                            })}
                          </View>
                        </>
                      ) : null}

                      {/* ─── EXPORT DROPDOWN ───────────────────────────── */}
                      <View style={styles.exportActionsRow}>
                        <Pressable
                          style={({ pressed }) => [
                            styles.exportButton,
                            pressed && { opacity: 0.85 },
                          ]}
                          onPress={() => setReportExportOpen((o) => !o)}
                        >
                          <Ionicons
                            name="download-outline"
                            size={18}
                            color="#FFFFFF"
                          />
                          <Text style={styles.exportButtonText}>
                            Export Report
                          </Text>
                          <Ionicons
                            name={reportExportOpen ? "chevron-up" : "chevron-down"}
                            size={16}
                            color="#FFFFFF"
                          />
                        </Pressable>
                        {reportExportOpen ? (
                          <View style={styles.exportMenu}>
                            <Pressable
                              style={styles.exportMenuItem}
                              onPress={() => {
                                setReportExportOpen(false);
                                handleExportReportExcel();
                              }}
                            >
                              <Ionicons
                                name="grid-outline"
                                size={16}
                                color="#5B21B6"
                              />
                              <Text style={styles.exportMenuItemText}>
                                Excel Workbook (.xlsx)
                              </Text>
                            </Pressable>
                            <Pressable
                              style={styles.exportMenuItem}
                              onPress={() => {
                                setReportExportOpen(false);
                                handleExportReportNarrative();
                              }}
                            >
                              <Ionicons
                                name="document-text-outline"
                                size={16}
                                color="#5B21B6"
                              />
                              <Text style={styles.exportMenuItemText}>
                                Narrative Report (.html)
                              </Text>
                            </Pressable>
                            <Pressable
                              style={styles.exportMenuItem}
                              onPress={() => {
                                setReportExportOpen(false);
                                handleExportReportPdf();
                              }}
                            >
                              <Ionicons
                                name="print-outline"
                                size={16}
                                color="#5B21B6"
                              />
                              <Text style={styles.exportMenuItemText}>
                                PDF (.pdf)
                              </Text>
                            </Pressable>
                          </View>
                        ) : null}
                      </View>
                    </View>
                  )}

                  {/* ─── EMPTY STATE (no records in filters) ─────────── */}
                  {reportEmpty ? (
                    <View style={[styles.lookupCard, { marginTop: 16 }]}>
                      <View style={styles.reportStateBox}>
                        <Ionicons
                          name="document-outline"
                          size={28}
                          color="#9CA3AF"
                        />
                        <Text style={styles.reportStateTitle}>
                          No report data available
                        </Text>
                        <Text style={styles.reportStateText}>
                          No qualifying records were found for the selected
                          reporting period and department.
                        </Text>
                        <Text style={styles.reportStateHint}>
                          Try a different reporting period or department.
                        </Text>
                      </View>
                    </View>
                  ) : null}

                  {/* ─── ERROR STATE ───────────────────────────────────── */}
                  {reportError ? (
                    <View style={[styles.lookupCard, { marginTop: 16 }]}>
                      <View style={styles.reportStateBox}>
                        <Ionicons
                          name="alert-circle-outline"
                          size={28}
                          color="#DC2626"
                        />
                        <Text style={styles.reportStateTitle}>
                          Unable to generate report
                        </Text>
                        <Text style={styles.reportStateText}>
                          {reportError}
                        </Text>
                      </View>
                    </View>
                  ) : null}
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
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Open MindCare Analytics Guide"
                        style={({ pressed }) => [
                          styles.heroGuideBtn,
                          pressed && { opacity: 0.8, transform: [{ scale: 0.95 }] },
                        ]}
                        onPress={() => setMetricsGuideVisible(true)}
                      >
                        <Ionicons
                          name="help-circle-outline"
                          size={22}
                          color="#FFFFFF"
                        />
                        <Text style={styles.heroGuideBtnText}>Guide</Text>
                      </Pressable>
                    </View>
                    <Text style={styles.analyticsHeroTitle}>
                      University of the Cordilleras Analytics
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

                  {/* ─── SECTION: Advanced Analytics Navigation ──────────── */}
                  <Text style={styles.sectionHeader}>Advanced Analytics</Text>
                  <View style={[styles.analyticsNavRow, isWide && { gap: 20 }]}>
                    <Pressable
                      style={({ pressed }) => [
                        styles.analyticsNavCard,
                        pressed && {
                          transform: [{ scale: 0.97 }],
                          opacity: 0.9,
                        },
                      ]}
                      onPress={() =>
                        router.push("/(admin)/analytics/stress-heatmap")
                      }
                    >
                      <View
                        style={[
                          styles.analyticsNavIcon,
                          { backgroundColor: "#FEE2E2" },
                        ]}
                      >
                        <Ionicons name="grid" size={22} color="#DC2626" />
                      </View>
                      <Text style={styles.analyticsNavTitle}>
                        Stress Heatmap
                      </Text>
                      <Text style={styles.analyticsNavDesc}>
                        Color-coded intensity grid across days and hours
                      </Text>
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [
                        styles.analyticsNavCard,
                        pressed && {
                          transform: [{ scale: 0.97 }],
                          opacity: 0.9,
                        },
                      ]}
                      onPress={() =>
                        router.push("/(admin)/analytics/mood-analytics")
                      }
                    >
                      <View
                        style={[
                          styles.analyticsNavIcon,
                          { backgroundColor: "#DCFCE7" },
                        ]}
                      >
                        <Ionicons name="pie-chart" size={22} color="#16A34A" />
                      </View>
                      <Text style={styles.analyticsNavTitle}>
                        Mood & Assessment
                      </Text>
                      <Text style={styles.analyticsNavDesc}>
                        Donut gauges and stacked mood distribution bars
                      </Text>
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [
                        styles.analyticsNavCard,
                        pressed && {
                          transform: [{ scale: 0.97 }],
                          opacity: 0.9,
                        },
                      ]}
                      onPress={() =>
                        router.push("/(admin)/analytics/risk-variance")
                      }
                    >
                      <View
                        style={[
                          styles.analyticsNavIcon,
                          { backgroundColor: "#FEF3C7" },
                        ]}
                      >
                        <Ionicons
                          name="trending-up"
                          size={22}
                          color="#D97706"
                        />
                      </View>
                      <Text style={styles.analyticsNavTitle}>
                        Wellness Variance
                      </Text>
                      <Text style={styles.analyticsNavDesc}>
                        Box & whisker charts with outlier detection
                      </Text>
                    </Pressable>
                  </View>

                  {/* ─── SECTION 1: Overall Summary KPIs ──────────────────── */}
                  <Text style={styles.sectionHeader}>Overall Summary</Text>
                  <View style={[styles.kpiRow, isWide && styles.kpiRowWide]}>
                    {summaryKpiData.map((kpi, i) =>
                      renderSummaryKpiCard(kpi, i),
                    )}
                  </View>
                  <DescriptiveInsight
                    title="Descriptive Analysis Summary"
                    body={descriptiveInsights.overall.body}
                    sections={descriptiveInsights.overall.sections}
                  />
                  <MetricInfoAccordion
                    lines={[
                      {
                        label: "Completion Rate",
                        text: "Students who completed at least one assessment ÷ total tracked students × 100.",
                      },
                      {
                        label: "Average Wellness Score",
                        text: "Sum of the latest assessment scores ÷ number of assessed students. Scores come from the in-app 20-item self-assessment (raw total 0–80). This is a custom indicator, not a standardized clinical scale.",
                      },
                    ]}
                  />

                  {studentSummaries.length > 0 && (
                    <View style={styles.dataCoverageCard}>
                      <View style={styles.dataCoverageHeader}>
                        <Ionicons
                          name="shield-checkmark-outline"
                          size={16}
                          color="#8A63D2"
                        />
                        <Text style={styles.dataCoverageTitle}>
                          Data Coverage
                        </Text>
                      </View>
                      <View style={styles.dataCoverageRow}>
                        <View style={styles.dataCoverageStat}>
                          <Text style={styles.dataCoverageValue}>
                            {studentSummaries.length}
                          </Text>
                          <Text style={styles.dataCoverageLabel}>
                            Tracked students
                          </Text>
                        </View>
                        <View style={styles.dataCoverageStat}>
                          <Text style={styles.dataCoverageValue}>
                            {assessedStudentCount}
                          </Text>
                          <Text style={styles.dataCoverageLabel}>Assessed</Text>
                        </View>
                        <View style={styles.dataCoverageStat}>
                          <Text style={styles.dataCoverageValue}>
                            {surveyCompletionPct}%
                          </Text>
                          <Text style={styles.dataCoverageLabel}>
                            Assessment coverage
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.dataCoverageMeta}>
                        Last updated:{" "}
                        {lastUpdated
                          ? formatLastUpdated(lastUpdated)
                          : "—"}
                      </Text>
                      {surveyCompletionPct < 50 ? (
                        <Text style={styles.dataCoverageWarn}>
                          Interpretation is limited because only{" "}
                          {surveyCompletionPct}% of tracked students have
                          completed the assessment.
                        </Text>
                      ) : surveyCompletionPct < 100 ? (
                        <Text style={styles.dataCoverageNote}>
                          The remaining{" "}
                          {Math.max(
                            studentSummaries.length - assessedStudentCount,
                            0,
                          )}{" "}
                          students are the primary target for assessment
                          outreach.
                        </Text>
                      ) : null}
                    </View>
                  )}

                  {/* ─── SECTION 2: Risk Trend KPIs ──────────────────────── */}
                  <Text style={styles.sectionHeader}>
                    Wellness & Concern Trend Indicators
                  </Text>
                  <View style={[styles.kpiRow, isWide && styles.kpiRowWide]}>
                    {riskTrendKpiData.map((kpi, i) => renderKpiCard(kpi, i))}
                  </View>
                  <DescriptiveInsight
                    title="Concern Distribution Summary"
                    body={descriptiveInsights.risk.body}
                    sections={descriptiveInsights.risk.sections}
                  />
                  <MetricInfoAccordion
                    lines={[
                      {
                        label: "Concern Bands",
                        text: "Lower (0–20): expected range, routine monitoring. Moderate (21–50): some concern indicators, may benefit from wellness resources. Elevated (51–80): review per the safeguarding and student-support protocol.",
                      },
                      {
                        label: "Baseline",
                        text: "Baselines are estimates of the prior period used to show direction of change (e.g., +12%). Treat trend percentages as directional guidance, not exact measurements.",
                      },
                      {
                        label: "Note",
                        text: "Concern levels are workflow indicators based on the latest assessment score. They are not clinical diagnoses.",
                      },
                    ]}
                  />

                  {/* ─── SECTION 3: Assessment Participation by Department ── */}
                  <View style={styles.sectionHeaderRow}>
                    <Text style={styles.sectionHeader}>
                      Assessment Participation by Department
                    </Text>
                    <View style={styles.yearLevelFilterRow}>
                      <Ionicons
                        name="funnel-outline"
                        size={14}
                        color="#8A63D2"
                      />
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={styles.yearLevelScroll}
                      >
                        {yearLevelOptions.map((level) => (
                          <Pressable
                            key={level}
                            style={[
                              styles.yearLevelChip,
                              yearLevelFilter === level &&
                                styles.yearLevelChipActive,
                            ]}
                            onPress={() => setYearLevelFilter(level)}
                          >
                            <Text
                              style={[
                                styles.yearLevelChipText,
                                yearLevelFilter === level &&
                                  styles.yearLevelChipTextActive,
                              ]}
                            >
                              {level}
                            </Text>
                          </Pressable>
                        ))}
                      </ScrollView>
                    </View>
                  </View>
                  <View style={styles.filterFeedbackRow}>
                    <View style={styles.filterFeedbackLeft}>
                      <Ionicons
                        name="people-outline"
                        size={14}
                        color="#8A63D2"
                      />
                      <Text style={styles.filterFeedbackText}>
                        Showing {filteredStudentCount} of {studentSummaries.length}{" "}
                        students
                        {yearLevelFilter !== "All"
                          ? ` (filtered by ${yearLevelFilter})`
                          : ""}
                      </Text>
                    </View>
                    {yearLevelFilter !== "All" && (
                      <View style={styles.filterFeedbackRight}>
                        <View style={styles.activeFilterPill}>
                          <Text style={styles.activeFilterPillText}>
                            1 filter active
                          </Text>
                        </View>
                        <Pressable
                          style={({ pressed }) => [
                            styles.clearFilterBtn,
                            pressed && { opacity: 0.7 },
                          ]}
                          onPress={() => setYearLevelFilter("All")}
                        >
                          <Ionicons
                            name="close-circle"
                            size={14}
                            color="#8A63D2"
                          />
                          <Text style={styles.clearFilterText}>
                            Clear Filters
                          </Text>
                        </Pressable>
                      </View>
                    )}
                  </View>
                  <View
                    style={[
                      styles.assessmentParticipationRow,
                      isWide && styles.assessmentParticipationRowWide,
                    ]}
                  >
                    <View
                      style={[
                        styles.barChartContainer,
                        isWide && { flex: 1, marginBottom: 0 },
                      ]}
                    >
                      {/* Legend */}
                      <View style={styles.barLegend}>
                        <View style={styles.barLegendItem}>
                          <View
                            style={[
                              styles.barLegendDot,
                              { backgroundColor: "#22C55E" },
                            ]}
                          />
                          <Text style={styles.barLegendText}>Lower</Text>
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
                          <Text style={styles.barLegendText}>Elevated</Text>
                        </View>
                      </View>

                      {departmentRows.length === 0 ? (
                        <View style={styles.stateCard}>
                          <Ionicons
                            name={
                              yearLevelFilter !== "All"
                                ? "filter-outline"
                                : "bar-chart-outline"
                            }
                            size={26}
                            color="#A78BFA"
                          />
                          <Text style={styles.stateText}>
                            {yearLevelFilter !== "All"
                              ? "No students match the current filters."
                              : "No department data is available yet. Data will appear once students complete their profiles and assessments."}
                          </Text>
                          {yearLevelFilter !== "All" && (
                            <Text style={styles.stateHintText}>
                              Try removing one or more filters.
                            </Text>
                          )}
                        </View>
                      ) : (
                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={true}
                          style={styles.barChartScrollRow}
                          contentContainerStyle={{
                            flexGrow: 1,
                            justifyContent: "center",
                          }}
                        >
                          <View style={styles.barChartRow}>
                            {(() => {
                              const totalAllDepts = departmentRows.reduce(
                                (sum, r) => sum + r.totalStudents,
                                0,
                              );
                              const maxLow = Math.max(
                                ...departmentRows.map((r) => r.lowCount),
                                1,
                              );
                              const maxNormal = Math.max(
                                ...departmentRows.map((r) => r.normalCount),
                                1,
                              );
                              const maxHigh = Math.max(
                                ...departmentRows.map((r) => r.highCount),
                                1,
                              );
                              const deptCount = departmentRows.length;
                              return departmentRows.map((row) =>
                                renderDepartmentRow(
                                  row,
                                  totalAllDepts,
                                  maxLow,
                                  maxNormal,
                                  maxHigh,
                                  deptCount,
                                ),
                              );
                            })()}
                          </View>
                        </ScrollView>
                      )}
                    </View>

                    {/* Risk Threshold Legend */}
                    <View
                      style={[
                        styles.thresholdCard,
                        isWide && {
                          marginBottom: 0,
                          width: 280,
                          flexShrink: 0,
                        },
                      ]}
                    >
                      <View style={styles.thresholdHeader}>
                        <Ionicons
                          name="information-circle-outline"
                          size={18}
                          color="#8A63D2"
                        />
                        <Text style={styles.thresholdTitle}>
                          How Concern Levels Are Determined
                        </Text>
                      </View>
                      <Text style={styles.thresholdDescription}>
                        Each student's concern indicator is calculated from the
                        raw total of their latest in-app 20-item assessment
                        (0–80; higher score = more concern indicators):
                      </Text>
                      <View style={styles.thresholdBlock}>
                        <View style={styles.thresholdBlockHeader}>
                          <View
                            style={[
                              styles.thresholdDot,
                              { backgroundColor: "#22C55E" },
                            ]}
                          />
                          <Text style={styles.thresholdLabel}>Lower (0–20)</Text>
                        </View>
                        <Text style={styles.thresholdDetail}>
                          Indicators within the expected range, routine monitoring
                        </Text>
                      </View>
                      <View style={styles.thresholdBlock}>
                        <View style={styles.thresholdBlockHeader}>
                          <View
                            style={[
                              styles.thresholdDot,
                              { backgroundColor: "#F59E0B" },
                            ]}
                          />
                          <Text style={styles.thresholdLabel}>
                            Moderate (21–50)
                          </Text>
                        </View>
                        <Text style={styles.thresholdDetail}>
                          Some concern indicators, may benefit from wellness resources
                        </Text>
                      </View>
                      <View style={styles.thresholdBlock}>
                        <View style={styles.thresholdBlockHeader}>
                          <View
                            style={[
                              styles.thresholdDot,
                              { backgroundColor: "#EF4444" },
                            ]}
                          />
                          <Text style={styles.thresholdLabel}>
                            Elevated (51–80)
                          </Text>
                        </View>
                        <Text style={styles.thresholdDetail}>
                          Elevated concern indicators, review per safeguarding protocol
                        </Text>
                      </View>
                    </View>
                  </View>

                  <DescriptiveInsight
                    title="Participation by Department"
                    body={descriptiveInsights.participation.body}
                    sections={descriptiveInsights.participation.sections}
                  />

                  <MetricInfoAccordion
                    lines={[
                      {
                        label: "Participation Rate",
                        text: "Number of students in the department who completed at least one assessment ÷ total tracked students × 100.",
                      },
                      {
                        label: "Cohort Sizes",
                        text: "Bars show the share of the department's cohort that falls in each concern band (Lower / Moderate / Elevated), based on each student's latest assessment.",
                      },
                      {
                        label: "Filters",
                        text: "The year-level filter above applies to this section. \"Showing X of Y students\" reflects the currently selected filter.",
                      },
                    ]}
                  />

                  {/* ─── SECTION 4: Department Insights ──────────────────── */}
                  {perDepartmentKpiData.length > 0 && (
                    <>
                      <Text style={styles.sectionHeader}>
                        Department Insights
                      </Text>
                      {/* Existing KPI cards */}
                      <View style={styles.deptKpiSection}>
                        <View style={styles.deptKpiGrid}>
                          {perDepartmentKpiData.map((kpi, i) =>
                            renderPerDepartmentKpiCard(kpi, i),
                          )}
                        </View>
                      </View>
                      <DescriptiveInsight
                        title="Department Insights Analysis"
                        body={descriptiveInsights.deptInsights.body}
                        sections={descriptiveInsights.deptInsights.sections}
                      />
                      <MetricInfoAccordion
                        lines={[
                          {
                            label: "Average Wellness Score",
                            text: "Sum of the department's latest assessment scores ÷ number of assessed students. Scores come from the in-app 20-item self-assessment (raw total 0–80).",
                          },
                          {
                            label: "Wellness Index",
                            text: "Share of mood entries that lean positive versus distressed. It reflects journal moods only, not assessment scores.",
                          },
                        ]}
                      />
                      {/* Scatter plot – correlation analysis */}
                      {scatterPlotData.length > 1 && (
                        <View
                          style={[
                            styles.insightsEnlargedCard,
                            { marginTop: 16 },
                          ]}
                        >
                          <View style={styles.insightsEnlargedHeader}>
                            <Ionicons
                              name="analytics"
                              size={18}
                              color="#8A63D2"
                            />
                            <Text style={styles.insightsEnlargedTitle}>
                              Score vs Journal Frequency Correlation
                            </Text>
                          </View>
                          <Text style={styles.insightsEnlargedSubtitle}>
                            Each student plotted by latest concern indicator (Y)
                            and journal activity (X). Students with elevated
                            concern indicators appear in the upper region.
                            Correlation does not establish causation.
                          </Text>
                          <View style={styles.chartContainer}>
                            <DepartmentCorrelationScatter
                              points={scatterPlotData}
                            />
                          </View>
                        </View>
                      )}
                      {scatterPlotData.length > 1 && (
                        <DescriptiveInsight
                          title="Correlation Analysis"
                          body={descriptiveInsights.correlation.body}
                          sections={descriptiveInsights.correlation.sections}
                        />
                      )}
                    </>
                  )}

                  {perDepartmentKpiData.length === 0 && (
                    <DescriptiveInsight
                      title="Department Insights Analysis"
                      body={descriptiveInsights.deptInsights.body}
                      sections={descriptiveInsights.deptInsights.sections}
                    />
                  )}

                  {/* ─── SECTION 5: Department Comparison ────────────────── */}
                  {comparisonInsightData && (
                    <>
                      <Text style={styles.sectionHeader}>
                        Department Comparison
                      </Text>
                      {/* Existing comparison insight cards */}
                      <View style={styles.comparisonInsightRow}>
                        {comparisonInsightData.map((insight, i) =>
                          renderComparisonInsightCard(insight, i),
                        )}
                      </View>
                      <DescriptiveInsight
                        title="Department Comparison Summary"
                        body={descriptiveInsights.comparison.body}
                        sections={descriptiveInsights.comparison.sections}
                      />
                      <MetricInfoAccordion
                        lines={[
                          {
                            label: "Participation Rate",
                            text: "Students in the department who completed at least one assessment ÷ total tracked students in that department × 100.",
                          },
                        ]}
                      />
                      {/* Grouped bar chart */}
                      {deptComparisonChartData.length > 1 && (
                        <View style={styles.insightsEnlargedCard}>
                          <View style={styles.insightsEnlargedHeader}>
                            <Ionicons
                              name="bar-chart"
                              size={18}
                              color="#8A63D2"
                            />
                            <Text style={styles.insightsEnlargedTitle}>
                              Multi-Metric Department Comparison
                            </Text>
                          </View>
                          <View style={styles.chartContainer}>
                            <DepartmentComparisonChart
                              data={deptComparisonChartData}
                            />
                          </View>
                        </View>
                      )}
                      {deptComparisonChartData.length > 1 && (
                        <DescriptiveInsight
                          title="Multi-Metric Comparison Analysis"
                          body={descriptiveInsights.multiMetric.body}
                          sections={descriptiveInsights.multiMetric.sections}
                        />
                      )}
                    </>
                  )}

                  {!comparisonInsightData && (
                    <DescriptiveInsight
                      title="Department Comparison Summary"
                      body={descriptiveInsights.comparison.body}
                      sections={descriptiveInsights.comparison.sections}
                    />
                  )}

                  {/* ─── SECTION 6: Visual Insights ──────────────────────── */}
                  <Text style={styles.sectionHeader}>Visual Insights</Text>
                  <View
                    style={[styles.chartsRow, isWide && styles.chartsRowWide]}
                  >
                    {renderDonutChart(donutData)}
                    {renderRadialProgress(surveyCompletionPct)}
                    {renderComparativeChart(engagementData)}
                  </View>
                </>
              )}
            </>
          )}
        </ScrollView>

        <Pressable
          style={[
            styles.scrollToTopBtn,
            {
              opacity: showScrollTop ? 1 : 0,
              pointerEvents: showScrollTop ? "auto" : "none",
            },
          ]}
          onPress={() => {
            scrollRef.current?.scrollTo({ y: 0, animated: true });
            setShowScrollTop(false);
          }}
        >
          <Ionicons name="arrow-up" size={22} color="white" />
        </Pressable>

        {studentListModal && (
          <StudentListModal
            visible={studentListModal.visible}
            title={studentListModal.title}
            students={modalStudents}
            onClose={() => setStudentListModal(null)}
          />
        )}
        {journalModal?.visible && (
          <StudentListModal
            visible={journalModal.visible}
            title={journalModal.title}
            students={studentSummaries.filter((s) => s.journalCount > 0)}
            onClose={() => setJournalModal(null)}
            journalMode
          />
        )}

        {/* ─── MindCare Analytics Guide Modal ───────────────────────────── */}
        <Modal
          visible={metricsGuideVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setMetricsGuideVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>MindCare Analytics Guide</Text>
                <Pressable
                  style={styles.modalCloseButton}
                  onPress={() => setMetricsGuideVisible(false)}
                >
                  <Ionicons name="close" size={24} color="#0F172A" />
                </Pressable>
              </View>
              <ScrollView
                style={styles.modalScroll}
                contentContainerStyle={styles.modalScrollContent}
              >
                <View style={styles.guideSection}>
                  <Text style={styles.guideSectionTitle}>
                    A. Participation & Engagement
                  </Text>
                  <Text style={styles.guideSectionBody}>
                    Participation rate = students who completed at least one
                    assessment ÷ total tracked students × 100. Journal activity
                    counts how often students use the journal tool. These
                    metrics measure engagement, not performance.
                  </Text>
                </View>
                <View style={styles.guideSection}>
                  <Text style={styles.guideSectionTitle}>B. Wellness Score</Text>
                  <Text style={styles.guideSectionBody}>
                    The assessment score is the raw total of a student's latest
                    in-app 20-item self-assessment (each item 0–4, reverse-scored
                    where applicable), ranging 0–80. It is a custom wellness
                    indicator — not a standardized clinical scale. A higher score
                    signals more concern indicators and triggers review. Average
                    wellness score = sum of latest scores ÷ number of students
                    with an assessment.
                  </Text>
                </View>
                <View style={styles.guideSection}>
                  <Text style={styles.guideSectionTitle}>C. Concern Levels</Text>
                  <View style={styles.guideTermRow}>
                    <Text style={styles.guideTerm}>Lower Concern (0–20)</Text>
                    <Text style={styles.guideTermDesc}>
                      Indicators within the expected range; routine monitoring.
                    </Text>
                  </View>
                  <View style={styles.guideTermRow}>
                    <Text style={styles.guideTerm}>Moderate Concern (21–50)</Text>
                    <Text style={styles.guideTermDesc}>
                      Some concern indicators; may benefit from wellness
                      resources.
                    </Text>
                  </View>
                  <View style={styles.guideTermRow}>
                    <Text style={styles.guideTerm}>Elevated Concern (51–80)</Text>
                    <Text style={styles.guideTermDesc}>
                      Elevated concern indicators; review per the safeguarding
                      and student-support protocol.
                    </Text>
                  </View>
                  <Text style={styles.guideSectionBody}>
                    Concern levels are workflow indicators based on assessment
                    scores. They are not clinical diagnoses.
                  </Text>
                </View>
                <View style={styles.guideSection}>
                  <Text style={styles.guideSectionTitle}>D. Journal Activity</Text>
                  <Text style={styles.guideSectionBody}>
                    The correlation plot compares journal frequency (X) with
                    wellness scores (Y). Correlation describes an aggregate
                    association — it does not prove that journaling causes a
                    change in scores, and it never characterizes an individual
                    student.
                  </Text>
                </View>
                <View style={styles.guideSection}>
                  <Text style={styles.guideSectionTitle}>
                    E. Department Comparison
                  </Text>
                  <Text style={styles.guideSectionBody}>
                    Departments are grouped by their official code (e.g., CCJE).
                    The grouped bar chart compares raw counts: average score,
                    journals, LSN students, and assessments. Participation rate
                    = students assessed ÷ students tracked in the department.
                  </Text>
                </View>
                <View style={styles.guideSection}>
                  <Text style={styles.guideSectionTitle}>
                    F. Statistical Interpretation
                  </Text>
                  <Text style={styles.guideSectionBody}>
                    Pearson's r measures the strength and direction of a linear
                    relationship between two variables (ranges −1 to +1; |r|
                    under 0.3 is weak, 0.3–0.6 moderate, above 0.6 strong).
                    Trend percentages compare the current value with an
                    estimated prior-period baseline and are directional
                    guidance only. Results are aggregate, anonymized summaries
                    for program review — they never diagnose or single out any
                    student.
                  </Text>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>

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
                      if (raw.length > 4)
                        formatted =
                          raw.slice(0, 2) +
                          "-" +
                          raw.slice(2, 6) +
                          "-" +
                          raw.slice(6);
                      else if (raw.length > 2)
                        formatted = raw.slice(0, 2) + "-" + raw.slice(2);
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
                    value={
                      newAdminCollege ? newAdminCollege : newAdminCollegeSearch
                    }
                    editable={!newAdminCollege}
                    onChangeText={(text) => setNewAdminCollegeSearch(text)}
                    autoCapitalize="words"
                  />
                  {!newAdminCollege && !!newAdminCollegeSearch && (
                    <View style={styles.dropdownContainer}>
                      {COLLEGES.filter((c) =>
                        c
                          .toLowerCase()
                          .includes(newAdminCollegeSearch.toLowerCase()),
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
                      <Text style={styles.selectedTagText}>
                        {newAdminCollege}
                      </Text>
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
                Are you sure you want to delete this announcement? This action
                cannot be undone.
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
  container: { flex: 1, backgroundColor: ADMIN_COLORS.bg },
  mainLayout: {
    flex: 1,
    backgroundColor: ADMIN_COLORS.bg,
    position: "relative",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: 18,
    paddingBottom: 18,
    backgroundColor: ADMIN_COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: ADMIN_COLORS.border,
    zIndex: 20,
  },
  headerTitle: {
    color: "#2D1B69",
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerIconButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#F7F5FC",
    borderWidth: 1,
    borderColor: ADMIN_COLORS.border,
    alignItems: "center",
    justifyContent: "center",
    // @ts-ignore - web only
    transition: "background-color 0.18s ease, border-color 0.18s ease",
  },
  headerIconButtonAlert: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
    // @ts-ignore - web only
    transition: "background-color 0.18s ease, border-color 0.18s ease",
  },
  headerIconButtonMessages: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: ADMIN_COLORS.purpleSoft,
    borderWidth: 1,
    borderColor: ADMIN_COLORS.borderStrong,
    alignItems: "center",
    justifyContent: "center",
    // @ts-ignore - web only
    transition: "background-color 0.18s ease, border-color 0.18s ease",
  },
  headerIconButtonHover: {
    backgroundColor: "#EFE7FB",
    borderColor: ADMIN_COLORS.borderStrong,
  },
  headerIconButtonPressed: {
    backgroundColor: "#E6DCF7",
    transform: [{ scale: 0.94 }],
  },
  tooltipAnchor: {
    position: "relative",
  },
  tooltip: {
    position: "absolute",
    top: "100%",
    left: "50%",
    marginTop: 10,
    transform: [{ translateX: -100 }],
    backgroundColor: "#3B3054",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    width: 200,
    alignItems: "center",
    // @ts-ignore - web only
    boxShadow: "0px 6px 18px rgba(20, 10, 40, 0.25)",
    elevation: 6,
    zIndex: 1000,
  },
  tooltipRight: {
    left: "auto",
    right: 0,
    transform: [{ translateX: 0 }],
  },
  tooltipArrow: {
    position: "absolute",
    top: -5,
    left: "50%",
    marginLeft: -5,
    width: 10,
    height: 10,
    backgroundColor: "#3B3054",
    transform: [{ rotate: "45deg" }],
  },
  tooltipArrowRight: {
    left: "auto",
    right: 14,
    marginLeft: 0,
  },
  tooltipText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },
  notificationBadge: {
    position: "absolute",
    top: 1,
    right: 1,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: "#EF4444",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
  },
  notificationBadgeText: {
    color: "white",
    fontSize: 9,
    fontWeight: "800",
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
  heroGuideBtn: {
    marginLeft: "auto",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
  },
  heroGuideBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
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
    backgroundColor: ADMIN_COLORS.purpleSoft,
    borderRadius: 14,
    padding: 4,
    marginBottom: 24,
    gap: 4,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    // @ts-ignore - web only
    transition: "background-color 0.18s ease, box-shadow 0.18s ease",
  },
  tabButtonActive: {
    backgroundColor: ADMIN_COLORS.purple,
    // @ts-ignore - web only
    boxShadow: "0px 2px 8px rgba(124, 77, 204, 0.28)",
    elevation: 2,
  },
  tabButtonHover: {
    backgroundColor: "#EDE4F9",
  },
  tabLabel: {
    color: "#5B5878",
    fontWeight: "700",
    fontSize: 13,
  },
  tabLabelActive: {
    color: "#FFFFFF",
    fontWeight: "800",
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
  stateHintText: {
    marginTop: 6,
    color: "#8B5CF6",
    fontSize: 13,
    fontWeight: "600",
  },
  sectionHeader: {
    color: "#2D1B69",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 16,
    marginTop: 14,
    letterSpacing: 0.2,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 14,
    marginTop: 12,
  },
  yearLevelFilterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  yearLevelScroll: { flex: 1 },
  yearLevelChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#F3EEFF",
    marginRight: 6,
  },
  yearLevelChipActive: {
    backgroundColor: "#8A63D2",
  },
  yearLevelChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6D5BBF",
  },
  yearLevelChipTextActive: {
    color: "white",
  },
  // ─── Filter feedback (active filters + clear) ────────────────────────────
  filterFeedbackRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
    paddingHorizontal: 2,
  },
  filterFeedbackLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  filterFeedbackText: {
    fontSize: 12,
    color: "#6D5BBF",
    fontWeight: "600",
  },
  filterFeedbackRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  activeFilterPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    backgroundColor: "#EDE9FE",
  },
  activeFilterPillText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#6D28D9",
  },
  clearFilterBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  clearFilterText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#8A63D2",
  },
  deptChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#F3EEFF",
    marginRight: 6,
  },
  deptChipActive: {
    backgroundColor: "#8A63D2",
  },
  deptChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6D5BBF",
  },
  deptChipTextActive: {
    color: "white",
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
    borderColor: "#EDE9FE", // @ts-ignore - web only
    boxShadow: "0px 8px 22px rgba(109, 40, 217, 0.06)",
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
  // ─── Risk Threshold Legend ──────────────────────────────────────────────
  thresholdCard: {
    backgroundColor: "white",
    borderRadius: 18,
    padding: 20,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: "rgba(138, 99, 210, 0.1)",
  },
  thresholdHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  thresholdTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1E1B4B",
  },
  thresholdDescription: {
    fontSize: 13,
    color: "#64748B",
    lineHeight: 20,
    marginBottom: 14,
  },
  thresholdBlock: {
    marginBottom: 14,
    paddingLeft: 4,
  },
  thresholdBlockHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 2,
  },
  thresholdDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  thresholdLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1E1B4B",
  },
  thresholdDetail: {
    fontSize: 13,
    color: "#64748B",
    paddingLeft: 20,
    lineHeight: 18,
  },
  // ─── Advanced Analytics Navigation ──────────────────────────────────────
  analyticsNavRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 24,
  },
  analyticsNavCard: {
    flex: 1,
    minWidth: 200,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: "#EDE9FE",
    boxShadow: "0px 8px 22px rgba(109, 40, 217, 0.06)",
    gap: 8,
  },
  analyticsNavIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  analyticsNavTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1E1B4B",
  },
  analyticsNavDesc: {
    fontSize: 12,
    color: "#64748B",
    lineHeight: 17,
  },
  // ─── Summary KPI Cards ─────────────────────────────────────────────────
  summaryKpiCard: {
    width: "48%",
    minWidth: "47%",
    borderRadius: 20,
    padding: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#EDE9FE",
    // @ts-ignore
    boxShadow: "0px 8px 22px rgba(109, 40, 217, 0.06)",
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
    borderColor: "#EDE9FE",
    // @ts-ignore
    boxShadow: "0px 8px 22px rgba(109, 40, 217, 0.05)",
  },
  deptKpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
  },
  deptKpiCard: {
    flexGrow: 1,
    flexBasis: "46%",
    minWidth: 220,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: "#EDE9FE",
    gap: 10,
  },
  deptKpiCardTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#581C87",
  },
  deptKpiCardFull: {
    fontSize: 11,
    color: "#8A63D2",
    fontWeight: "600",
    marginTop: 2,
    marginBottom: 4,
  },
  deptKpiSampleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  deptKpiSampleText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#94A3B8",
  },
  deptKpiCaution: {
    fontSize: 10,
    color: "#B45309",
    backgroundColor: "#FEF3C7",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    overflow: "hidden",
  },
  deptKpiMetricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  deptKpiMetric: {
    flexGrow: 1,
    flexBasis: "46%",
    minWidth: 0,
  },
  deptKpiMetricLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#94A3B8",
    textTransform: "uppercase",
  },
  deptKpiMetricValue: {
    fontSize: 18,
    fontWeight: "800",
  },
  deptKpiMetricSpark: {
    flexGrow: 1,
    flexBasis: "46%",
    minWidth: 0,
    gap: 4,
  },
  sparklineRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sparklineValue: {
    fontSize: 16,
    fontWeight: "800",
  },
  sparklineTrack: {
    height: 4,
    backgroundColor: "#F3EAFF",
    borderRadius: 2,
    overflow: "hidden",
  },
  sparklineFill: {
    height: "100%",
    borderRadius: 2,
  },
  // ─── Comparison Insight Cards ───────────────────────────────────────────
  comparisonInsightRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
    marginBottom: 24,
  },
  comparisonInsightCard: {
    flexGrow: 1,
    flexBasis: "46%",
    minWidth: 200,
    borderRadius: 20,
    padding: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#EDE9FE",
    // @ts-ignore
    boxShadow: "0px 8px 22px rgba(109, 40, 217, 0.06)",
    gap: 6,
  },
  comparisonInsightHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  comparisonInsightIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  comparisonInsightLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#94A3B8",
    textTransform: "uppercase",
    flex: 1,
  },
  comparisonInsightDept: {
    fontSize: 17,
    fontWeight: "800",
    color: "#3B0764",
  },
  comparisonInsightValue: {
    fontSize: 14,
    fontWeight: "700",
  },
  // ─── Department Bar Chart Styles ───────────────────────────────────────
  barChartContainer: {
    backgroundColor: "#FDFBFF",
    borderRadius: 20,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#EDE9FE",
    // @ts-ignore
    boxShadow: "0px 8px 22px rgba(109, 40, 217, 0.05)",
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
    fontSize: 13,
    fontWeight: "700",
    color: "#6B21A8",
  },
  barChartScrollRow: {
    marginBottom: 4,
  },
  barChartRow: {
    flexDirection: "row",
    gap: 14,
    alignItems: "flex-end",
    minHeight: 220,
    paddingHorizontal: 8,
    paddingBottom: 4,
  },
  barColumn: {
    alignItems: "center",
    gap: 6,
  },
  barPctTop: {
    fontSize: 14,
    fontWeight: "800",
    color: "#581C87",
  },
  barTrack: {
    width: 48,
    height: 180,
    backgroundColor: "#F3EAFF",
    borderRadius: 10,
    flexDirection: "column",
    justifyContent: "flex-end",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#EDE9FE",
  },
  barFill: {
    width: "100%",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.4)",
  },
  barDeptLabel: {
    fontSize: 13,
    fontWeight: "800",
    color: "#581C87",
    textAlign: "center",
    marginTop: 4,
  },
  barCountLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#8B5CF6",
    textAlign: "center",
  },
  chartsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
    marginBottom: 24,
  },

  // ─── Export Report Controls ────────────────────────────────────────────
  exportActionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 20,
    marginTop: -8,
    position: "relative",
    zIndex: 40,
  },
  exportButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#7C3AED",
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 12,
    // @ts-ignore - web only
    boxShadow: "0px 6px 16px rgba(124, 58, 237, 0.3)",
    elevation: 3,
  },
  exportButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  exportButtonSecondary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#F3EEFF",
    borderWidth: 1,
    borderColor: "#D8C7F5",
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  exportButtonSecondaryText: {
    color: "#7C3AED",
    fontSize: 14,
    fontWeight: "700",
  },

  // ─── Reports ────────────────────────────────────────────────────────────
  reportPeriodRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  reportPeriodChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#D8C7F5",
    backgroundColor: "#F7F4FE",
  },
  reportPeriodChipActive: {
    backgroundColor: "#7C3AED",
    borderColor: "#7C3AED",
  },
  reportPeriodChipText: {
    color: "#5B21B6",
    fontSize: 13,
    fontWeight: "700",
  },
  reportPeriodChipTextActive: {
    color: "#FFFFFF",
  },
  reportField: {
    marginBottom: 16,
  },
  reportLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6B7280",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 8,
  },
  reportValue: {
    fontSize: 15,
    fontWeight: "700",
    color: "#5B21B6",
    marginBottom: 8,
  },
  reportDateHint: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 8,
  },
  reportDateRow: {
    flexDirection: "row",
    gap: 12,
    flexWrap: "wrap",
  },
  reportDateField: {
    flex: 1,
    minWidth: 150,
  },
  reportDateFieldLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6B7280",
    marginBottom: 6,
  },
  reportDateInput: {
    borderWidth: 1,
    borderColor: "#D8C7F5",
    borderRadius: 10,
    backgroundColor: "#F7F4FE",
    color: "#5B21B6",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  reportWeekNav: {
    flexDirection: "row",
    gap: 8,
  },
  reportWeekBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#D8C7F5",
    backgroundColor: "#F7F4FE",
  },
  reportWeekBtnText: {
    color: "#5B21B6",
    fontSize: 12,
    fontWeight: "700",
  },
  reportPickerRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  reportOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#D8C7F5",
    backgroundColor: "#F7F4FE",
  },
  reportOptionText: {
    color: "#5B21B6",
    fontSize: 12,
    fontWeight: "600",
  },
  generateReportBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#7C3AED",
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 4,
  },
  generateReportBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  reportStatus: {
    marginTop: 12,
    color: "#6B7280",
    fontSize: 14,
    fontStyle: "italic",
    textAlign: "center",
  },
  reportError: {
    marginTop: 12,
    color: "#DC2626",
    fontSize: 14,
    textAlign: "center",
  },
  reportFiltersGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 16,
  },
  reportSelectField: {
    flexGrow: 1,
    flexBasis: 220,
    minWidth: 200,
    position: "relative",
  },
  reportSelectFieldOpen: {
    zIndex: 40,
  },
  reportSelectTrigger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    minHeight: 44,
    borderWidth: 1,
    borderColor: "#D8C7F5",
    borderRadius: 10,
    backgroundColor: "#F7F4FE",
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  reportSelectTriggerOpen: {
    borderColor: "#7C3AED",
    backgroundColor: "#F3EDFF",
  },
  reportSelectTriggerPressed: {
    opacity: 0.85,
  },
  reportSelectTriggerText: {
    color: "#5B21B6",
    fontSize: 14,
    fontWeight: "700",
    flexShrink: 1,
  },
  reportSelectTriggerPlaceholder: {
    color: "#9CA3AF",
    fontWeight: "600",
  },
  reportSelectMenuBase: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#D8C7F5",
    backgroundColor: "#FFFFFF",
    shadowColor: "#000000",
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
    paddingVertical: 4,
    maxHeight: REPORT_MENU_MAX_HEIGHT,
  },
  reportSelectMenuInline: {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    marginTop: 4,
    zIndex: 50,
    overflow: "scroll",
  },
  reportSelectOption: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 6,
  },
  reportSelectOptionActive: {
    backgroundColor: "#F3EDFF",
  },
  reportSelectOptionPressed: {
    backgroundColor: "#EDE4FF",
  },
  reportSelectOptionText: {
    color: "#374151",
    fontSize: 13,
    fontWeight: "600",
  },
  reportSelectOptionTextActive: {
    color: "#5B21B6",
    fontWeight: "800",
  },
  reportActionsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  resetReportBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#D8C7F5",
    backgroundColor: "#FFFFFF",
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  resetReportBtnText: {
    color: "#7C3AED",
    fontSize: 15,
    fontWeight: "800",
  },
  activeFiltersRow: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    flexWrap: "wrap",
  },
  activeFiltersLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: "#6B7280",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    paddingTop: 4,
  },
  activeFiltersWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    flex: 1,
  },
  activeFilterChip: {
    backgroundColor: "#F3EDFF",
    borderWidth: 1,
    borderColor: "#D8C7F5",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  activeFilterChipText: {
    color: "#5B21B6",
    fontSize: 12,
    fontWeight: "700",
  },
  previewPendingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F3EDFF",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  previewPendingText: {
    color: "#5B21B6",
    fontSize: 12,
    fontWeight: "800",
  },
  reportUpdatingNote: {
    marginBottom: 12,
    color: "#7C3AED",
    fontSize: 13,
    fontStyle: "italic",
  },
  reportStale: {
    opacity: 0.55,
  },
  concernCards: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 8,
  },
  concernCard: {
    flexGrow: 1,
    flexBasis: 180,
    minWidth: 160,
    borderWidth: 1,
    borderColor: "#D8C7F5",
    borderRadius: 14,
    backgroundColor: "#FAF8FF",
    padding: 14,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
  },
  concernCardDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  concernCardLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    color: "#374151",
  },
  concernCardValue: {
    fontSize: 22,
    fontWeight: "900",
    color: "#1F2937",
  },
  concernCardPct: {
    flexBasis: "100%",
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
  },
  reportEmptyInline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  reportEmptyInlineText: {
    color: "#6B7280",
    fontSize: 13,
    fontWeight: "600",
  },
  activityRows: {
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 8,
  },
  activityRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F2F4",
  },
  activityRowIcon: {
    width: 22,
  },
  activityRowLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
  },
  activityRowValue: {
    fontSize: 15,
    fontWeight: "800",
    color: "#5B21B6",
  },
  reportSubsectionCaption: {
    fontSize: 12,
    fontWeight: "600",
    color: "#9C9EB0",
    marginBottom: 10,
    marginTop: -8,
  },
  comparisonHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#F3EDFF",
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  comparisonHeaderMetric: {
    flex: 1.6,
    fontSize: 11,
    fontWeight: "800",
    color: "#5B21B6",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  comparisonHeaderValue: {
    flex: 0.8,
    fontSize: 11,
    fontWeight: "800",
    color: "#5B21B6",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    textAlign: "right",
  },
  comparisonHeaderChange: {
    flex: 1,
    fontSize: 11,
    fontWeight: "800",
    color: "#5B21B6",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    textAlign: "right",
  },
  comparisonChange: {
    flex: 1,
    fontSize: 13,
    fontWeight: "800",
    textAlign: "right",
  },
  exportMenu: {
    position: "absolute",
    zIndex: 50,
    top: "100%",
    left: 0,
    marginTop: 6,
    minWidth: 240,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D8C7F5",
    backgroundColor: "#FFFFFF",
    shadowColor: "#000000",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
    paddingVertical: 6,
  },
  exportMenuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  exportMenuItemText: {
    color: "#374151",
    fontSize: 14,
    fontWeight: "700",
  },
  reportStateBox: {
    alignItems: "center",
    gap: 8,
    paddingVertical: 28,
    paddingHorizontal: 24,
  },
  reportStateTitle: {
    fontSize: 17,
    fontWeight: "900",
    color: "#1F2937",
    textAlign: "center",
  },
  reportStateText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6B7280",
    textAlign: "center",
  },
  reportStateHint: {
    fontSize: 12,
    fontWeight: "600",
    color: "#9CA3AF",
    textAlign: "center",
  },
  reportPreviewGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 16,
  },
  reportScopeBox: {
    backgroundColor: "#F5F3FF",
    borderWidth: 1,
    borderColor: "#DDD6FE",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  reportScopeTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: "#6D28D9",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  reportScopeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 6,
  },
  reportScopeKey: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6B7280",
    flexShrink: 0,
  },
  reportScopeValue: {
    flex: 1,
    fontSize: 12,
    fontWeight: "700",
    color: "#1f2937",
    textAlign: "right",
  },
  reportQualityNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#FDE68A",
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
  },
  reportQualityText: {
    flex: 1,
    fontSize: 11,
    color: "#92400E",
    lineHeight: 15,
  },
  reportPreviewItem: {
    flex: 1,
    minWidth: 120,
    backgroundColor: "#FBF7FF",
    borderWidth: 1,
    borderColor: "#EDE9FE",
    borderRadius: 12,
    padding: 12,
  },
  reportPreviewValue: {
    fontSize: 20,
    fontWeight: "800",
    color: "#5B21B6",
  },
  reportPreviewLabel: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 2,
  },
  reportSubsectionTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#5B21B6",
    marginTop: 18,
    marginBottom: 10,
  },
  concernBars: {
    marginBottom: 4,
  },
  concernBarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginVertical: 5,
  },
  concernBarLabel: {
    width: 64,
    fontSize: 12,
    fontWeight: "700",
    color: "#1f2937",
  },
  concernBarTrack: {
    flex: 1,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#F3F4F6",
    overflow: "hidden",
  },
  concernBarFill: {
    height: "100%",
    borderRadius: 7,
  },
  concernBarValue: {
    width: 44,
    fontSize: 12,
    fontWeight: "700",
    color: "#1f2937",
    textAlign: "right",
  },
  comparisonTable: {
    borderWidth: 1,
    borderColor: "#E9D5FF",
    borderRadius: 12,
    overflow: "hidden",
  },
  comparisonRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F0EAFE",
  },
  comparisonMetric: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1f2937",
    flex: 1,
  },
  comparisonValue: {
    fontSize: 14,
    fontWeight: "800",
    color: "#5B21B6",
    textAlign: "right",
  },
  comparisonDelta: {
    fontSize: 12,
    fontWeight: "700",
  },
  comparisonPrev: {
    fontSize: 11,
    color: "#6B7280",
    marginLeft: 10,
  },

  // ─── Descriptive Analysis Blocks ───────────────────────────────────────
  descriptiveContainer: {
    backgroundColor: "#FBF7FF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#EDE9FE",
    borderLeftWidth: 4,
    borderLeftColor: "#8A63D2",
    padding: 16,
    marginBottom: 24,
  },
  descriptiveHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  insightTitle: {
    color: "#4C1D95",
    fontSize: 14,
    fontWeight: "800",
  },
  insightText: {
    color: "#4B5563",
    fontSize: 13,
    lineHeight: 21,
  },
  // ─── Structured insight sections (Key Finding / What This Means / …) ─────
  insightSections: {
    marginTop: 10,
    gap: 10,
  },
  insightSectionBlock: {
    backgroundColor: "#F8F7FC",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderLeftWidth: 3,
    borderLeftColor: "#8A63D2",
  },
  insightSectionLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#8A63D2",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  insightSectionText: {
    color: "#334155",
    fontSize: 13,
    lineHeight: 20,
  },
  widgetInsightText: {
    color: "#4B5563",
    fontSize: 12.5,
    lineHeight: 19,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F1E8FD",
  },

  // ─── Enlarged Insights / Comparison Cards ────────────────────────────
  insightsEnlargedCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#EDE9FE",
    // @ts-ignore
    boxShadow: "0px 8px 22px rgba(109, 40, 217, 0.06)",
    elevation: 4,
  },
  insightsEnlargedHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  insightsEnlargedTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#2D1B69",
  },
  insightsEnlargedSubtitle: {
    fontSize: 12,
    color: "#94A3B8",
    lineHeight: 18,
    marginBottom: 16,
  },
  chartContainer: {
    minHeight: 200,
  },
  bottomWidget: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    width: "48%",
    flex: 1,
    minWidth: 220,
    borderWidth: 1,
    borderColor: "#EDE9FE",
    boxShadow: "0px 8px 22px rgba(109, 40, 217, 0.06)",
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
    gap: 12,
  },
  donutRingWrap: {
    alignItems: "center",
    justifyContent: "center",
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
    gap: 10,
    minWidth: 120,
  },
  donutLegendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 2,
  },
  donutDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    flexShrink: 0,
  },
  donutLegendText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B21A8",
    flex: 1,
  },
  donutLegendValue: {
    fontSize: 13,
    fontWeight: "800",
    color: "#2D1B69",
    minWidth: 40,
    textAlign: "right",
  },
  radialContainer: {
    alignItems: "center",
    gap: 14,
  },
  radialRingWrap: {
    alignItems: "center",
    justifyContent: "center",
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
  radialLegend: {
    flexDirection: "column",
    gap: 8,
    width: "100%",
  },
  radialLegendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "#FDFBFF",
    borderRadius: 8,
  },
  radialLegendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  radialLegendText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#6B21A8",
    flex: 1,
  },
  radialLegendValue: {
    fontSize: 12,
    fontWeight: "800",
    color: "#2D1B69",
    minWidth: 36,
    textAlign: "right",
  },
  radialCountsRow: {
    marginTop: 10,
    alignItems: "center",
  },
  radialCountsText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#8A63D2",
  },
  dataCoverageCard: {
    backgroundColor: "#FAF5FF",
    borderWidth: 1,
    borderColor: "#E9D5FF",
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  dataCoverageHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dataCoverageTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#581C87",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  dataCoverageRow: {
    flexDirection: "row",
    gap: 12,
  },
  dataCoverageStat: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#EDE9FE",
    paddingVertical: 10,
    alignItems: "center",
    gap: 2,
  },
  dataCoverageValue: {
    fontSize: 18,
    fontWeight: "800",
    color: "#2D1B69",
  },
  dataCoverageLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: "#8A63D2",
    textTransform: "uppercase",
  },
  dataCoverageMeta: {
    fontSize: 10,
    color: "#94A3B8",
    fontWeight: "600",
  },
  dataCoverageWarn: {
    fontSize: 11,
    lineHeight: 16,
    color: "#B45309",
    backgroundColor: "#FEF3C7",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    overflow: "hidden",
  },
  dataCoverageNote: {
    fontSize: 11,
    lineHeight: 16,
    color: "#6B21A8",
    backgroundColor: "#F3E8FF",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    overflow: "hidden",
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
    backgroundColor: ADMIN_COLORS.surface,
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: ADMIN_COLORS.border, // @ts-ignore - web only
    boxShadow: "0px 2px 12px rgba(124, 77, 204, 0.05)",
    elevation: 1,
  },
  lookupHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  lookupTitleBlock: {
    flexDirection: "column",
    gap: 2,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1E1B4B",
  },
  sectionSubtitle: {
    fontSize: 13,
    color: "#6B7280",
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#FAF8FF",
    borderRadius: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: ADMIN_COLORS.border,
    // @ts-ignore - web only
    transition: "border-color 0.18s ease, background-color 0.18s ease",
  },
  searchInput: {
    flex: 1,
    paddingVertical: 13,
    color: "#1E1B4B",
    fontSize: 14,
  },
  searchClear: {
    padding: 4,
  },
  resultsLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#94A3B8",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 12,
  },
  createAdminButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: ADMIN_COLORS.purple,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    // @ts-ignore - web only
    boxShadow: "0px 3px 10px rgba(124, 77, 204, 0.25)",
    elevation: 2,
    // @ts-ignore - web only
    transition: "background-color 0.18s ease, box-shadow 0.18s ease",
  },
  createAdminButtonHover: {
    backgroundColor: ADMIN_COLORS.purpleDeep,
    // @ts-ignore - web only
    boxShadow: "0px 5px 14px rgba(124, 77, 204, 0.32)",
  },
  createAdminButtonPressed: {
    backgroundColor: ADMIN_COLORS.purpleDeep,
    transform: [{ scale: 0.97 }],
  },
  createAdminButtonText: {
    color: "white",
    fontWeight: "700",
    fontSize: 13,
  },
  studentCard: {
    backgroundColor: ADMIN_COLORS.surface,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: ADMIN_COLORS.border, // @ts-ignore - web only
    boxShadow: "0px 2px 12px rgba(124, 77, 204, 0.05)",
    elevation: 1,
    // @ts-ignore - web only
    transition:
      "box-shadow 0.18s ease, transform 0.18s ease, border-color 0.18s ease",
  },
  studentCardHover: {
    // @ts-ignore - web only
    boxShadow: "0px 10px 28px rgba(124, 77, 204, 0.12)",
    elevation: 4,
    borderColor: ADMIN_COLORS.borderStrong,
    transform: [{ translateY: -2 }],
  },
  studentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 14,
  },
  studentIdentityBlock: {
    flex: 1,
    paddingRight: 12,
  },
  studentInfoBlock: {
    alignItems: "flex-end",
    maxWidth: "45%",
  },
  studentName: { fontSize: 17, fontWeight: "800", color: "#2D1B69" },
  studentNameRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  studentId: {
    fontSize: 14,
    fontWeight: "800",
    color: ADMIN_COLORS.purple,
    textAlign: "right",
  },
  studentCourse: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
    marginTop: 2,
    textAlign: "right",
  },
  studentMeta: { fontSize: 12.5, color: "#6B7280", marginTop: 3 },
  lsnBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: ADMIN_COLORS.border,
  },
  lsnBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: ADMIN_COLORS.purpleSoft,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: ADMIN_COLORS.borderStrong,
    flexShrink: 1,
  },
  lsnBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: ADMIN_COLORS.purple,
  },
  lsnTypeText: {
    fontSize: 12,
    color: "#6B7280",
    flex: 1,
  },
  lsnDocIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  lsnDocText: {
    fontSize: 11,
    color: ADMIN_COLORS.purple,
    fontWeight: "600",
  },
  studentStatsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 6,
  },
  statCell: {
    width: "50%",
    paddingVertical: 10,
    paddingRight: 8,
  },
  statDivider: {
    width: "100%",
    height: StyleSheet.hairlineWidth,
    backgroundColor: ADMIN_COLORS.border,
  },
  statLabel: {
    fontSize: 11,
    color: "#94A3B8",
    marginBottom: 5,
    textTransform: "uppercase",
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  statValue: { fontSize: 16, fontWeight: "800", color: "#1E1B4B" },
  statValueHighlight: { fontSize: 16, fontWeight: "800", color: ADMIN_COLORS.purple },
  moodSummary: { color: "#64748B", fontSize: 13, marginTop: 8 },
  riskBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  riskBadgeLow: { backgroundColor: "#ECFDF5" },
  riskBadgeModerate: { backgroundColor: "#FFFBEB" },
  riskBadgeHigh: { backgroundColor: "#FEF2F2" },
  riskDot: { width: 8, height: 8, borderRadius: 4 },
  riskDotLow: { backgroundColor: "#10B981" },
  riskDotModerate: { backgroundColor: "#F59E0B" },
  riskDotHigh: { backgroundColor: "#EF4444" },
  riskBadgeText: { fontSize: 12, fontWeight: "700" },
  riskLow: { color: "#047857", fontWeight: "800" },
  riskModerate: { color: "#B45309", fontWeight: "800" },
  riskHigh: { color: "#DC2626", fontWeight: "800" },
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
  // ─── MindCare Analytics Guide modal ──────────────────────────────────────
  guideSection: {
    marginBottom: 22,
  },
  guideSectionTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#4C1D95",
    marginBottom: 6,
  },
  guideSectionBody: {
    fontSize: 13,
    lineHeight: 20,
    color: "#4B5563",
    marginTop: 6,
  },
  guideTermRow: {
    marginBottom: 8,
    backgroundColor: "#F8F7FC",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  guideTerm: {
    fontSize: 12.5,
    fontWeight: "800",
    color: "#581C87",
    marginBottom: 2,
  },
  guideTermDesc: {
    fontSize: 12.5,
    lineHeight: 18,
    color: "#4B5563",
  },
  removeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FEE2E2",
    backgroundColor: "#FEF2F2",
    gap: 6,
    // @ts-ignore - web only
    transition: "background-color 0.18s ease",
  },
  removeButtonHover: {
    backgroundColor: "#FEE2E2",
  },
  removeButtonText: {
    color: "#DC2626",
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
    borderColor: "#EDE9FE",
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
    backgroundColor: ADMIN_COLORS.surface,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: ADMIN_COLORS.border,
    // @ts-ignore - web only
    boxShadow: "0px 2px 12px rgba(124, 77, 204, 0.05)",
  },
  announcementCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  announcementCardTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
    flex: 1,
  },
  announcementCardBody: {
    fontSize: 14,
    color: "#475569",
    lineHeight: 22,
    marginBottom: 12,
  },
  announcementLinksWrap: { gap: 4, marginBottom: 12 },
  announcementLinkItem: { fontSize: 12, color: "#8A63D2", fontWeight: "600" },
  announcementCardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: ADMIN_COLORS.border,
    paddingTop: 12,
  },
  announcementAuthorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  announcementAuthorAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  announcementAuthorAvatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#8A63D2",
    justifyContent: "center",
    alignItems: "center",
  },
  announcementAuthorAvatarText: {
    color: "white",
    fontSize: 14,
    fontWeight: "700",
  },
  announcementCardMeta: {
    fontSize: 12,
    color: "#94A3B8",
    fontWeight: "600",
    flex: 1,
  },
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
  deleteAnnouncementBtn: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: "#FEF2F2",
  },
  editAnnouncementBtn: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: "#F3EEFF",
  },
  editAnnouncementBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#EF4444",
    marginLeft: 4,
  },
  deptChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  announcementDeptRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginBottom: 12,
  },
  dropdownContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    maxHeight: 240,
    marginTop: 4,
    ...(shadows.custom(2, 8, 0.1, 5, "#000") as any),
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
  selectedTagText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
  },

  // ─── Wide screen (desktop) overrides ──────────────────────────
  containerWide: {
    backgroundColor: "#F3F1F9",
  },
  mainLayoutWide: {
    backgroundColor: ADMIN_COLORS.bg,
  },
  kpiRowWide: { gap: 20 },
  kpiCardWide: {
    width: "23%",
    minWidth: 200,
  },
  summaryKpiCardWide: {
    width: "23%",
    minWidth: 200,
  },
  studentGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
  },
  studentCardWide: {
    width: "48%",
    minWidth: 300,
  },
  barChartContainerWide: {
    paddingHorizontal: 32,
  },
  chartsRowWide: {
    flexDirection: "row",
    flexWrap: "nowrap",
    gap: 24,
  },
  bottomWidgetWide: {
    width: "32%",
    minWidth: 280,
  },
  scrollToTopBtn: {
    position: "absolute",
    bottom: 24,
    right: 24,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#8A63D2",
    justifyContent: "center",
    alignItems: "center",
    ...(shadows.custom(4, 6, 0.3, 10, "#000") as any),
    zIndex: 999,
    overflow: "visible",
  },
  assessmentParticipationRow: {
    flexDirection: "column",
    gap: 16,
    marginBottom: 24,
  },
  assessmentParticipationRowWide: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  groupedBarRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 3,
  },
  groupedBarCol: {
    alignItems: "center",
    gap: 2,
  },
  groupedBar: {
    borderRadius: 4,
  },
  groupedBarVal: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748B",
  },
});

