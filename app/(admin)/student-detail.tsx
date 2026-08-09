import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Linking,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Svg, {
  Circle,
  G,
  Line,
  Polyline,
  Rect,
  Text as SvgText,
} from "react-native-svg";

import { auth, db } from "@/constants/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
} from "firebase/firestore";
import { changeProfileImage, uploadProfileImageFromFile } from "@/services/userService";
import { bucketAssessments } from "@/utils/assessmentTrend";

interface JournalEntry {
  id: string;
  mood: string;
  createdAt?: Date;
}

interface AssessmentRecord {
  id: string;
  totalScore: number;
  riskLevel: string;
  createdAt: Date;
}

const MOOD_COLORS: Record<string, string> = {
  happy: "#FFD700",
  calm: "#98FB98",
  relaxed: "#87CEEB",
  good: "#90EE90",
  neutral: "#D3D3D3",
  worried: "#FFA500",
  sad: "#4169E1",
  overwhelmed: "#8B0000",
  exhausted: "#708090",
  stressed: "#FF6347",
  burnout: "#800020",
  mad: "#DC2626",
  fearful: "#2563EB",
  flushed: "#F472B6",
  "very-upset": "#000080",
};

const MOOD_EMOJIS: Record<string, string> = {
  happy: "😄",
  calm: "😊",
  relaxed: "😌",
  good: "🙂",
  neutral: "😐",
  worried: "😟",
  sad: "😞",
  overwhelmed: "😣",
  exhausted: "😫",
  stressed: "😓",
  burnout: "😤",
  mad: "😡",
  fearful: "😰",
  flushed: "😅",
  "very-upset": "😢",
};

const MOOD_LABELS: Record<string, string> = {
  happy: "Happy",
  calm: "Calm",
  relaxed: "Relaxed",
  good: "Good",
  neutral: "Neutral",
  worried: "Worried",
  sad: "Sad",
  overwhelmed: "Overwhelmed",
  exhausted: "Exhausted",
  stressed: "Stressed",
  burnout: "Burnout",
  mad: "Mad",
  fearful: "Fearful",
  flushed: "Flushed",
  "very-upset": "Very Upset",
};

interface ProfileData {
  fullName: string;
  email: string;
  schoolId: string;
  department: string;
  academicProgram: string;
  yearLevel: string;
  nationality: string;
  religiousAffiliation: string;
  culturalAffiliation: string;
  contactNo: string;
  civilStatus: string;
  citizenship: string;
  genderIdentity: string;
  provincialAddress: string;
  isLSN?: boolean;
  specialNeedsType?: string;
  lsnDocument?: {
    fileName?: string;
    secureUrl?: string;
  } | null;
  [key: string]: any;
}

// ─── Student Detail Design Tokens ────────────────────────────────────────────
const DETAIL_COLORS = {
  bg: "#F7F5FC",
  surface: "#FFFFFF",
  border: "#EDE9FE",
  borderStrong: "#E6DCF7",
  purple: "#8A63D2",
  purpleDeep: "#6D48B8",
  purpleSoft: "#EEE7FA",
  text: "#1F2340",
  textMuted: "#6F748A",
  textFaint: "#A0A6B8",
} as const;

type RiskLevelType = "low" | "moderate" | "high";

const RISK_META: Record<
  RiskLevelType,
  { label: string; color: string; bg: string; dot: string }
> = {
  low: { label: "Low Concern", color: "#0E9F6E", bg: "#E7F7F0", dot: "#10B981" },
  moderate: {
    label: "Moderate Concern",
    color: "#B45309",
    bg: "#FDF3E3",
    dot: "#F59E0B",
  },
  high: { label: "High Concern", color: "#DC2626", bg: "#FDE8E8", dot: "#EF4444" },
};

const riskFromLatestScore = (score?: number): RiskLevelType | null => {
  if (score === undefined || score === null) return null;
  if (score >= 51) return "high";
  if (score >= 21) return "moderate";
  return "low";
};

const formatRelativeTime = (date?: Date): string => {
  if (!date) return "—";
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return `${months} mo ago`;
};

const formatFullDate = (date: Date): string =>
  date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

const formatShortDate = (date: Date): string =>
  date.toLocaleDateString("en-US", { month: "short", day: "numeric" });

// ─── Registration info grouped for better hierarchy ──────────────────────────
const REGISTRATION_GROUPS: {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  fields: { key: keyof ProfileData; label: string }[];
}[] = [
  {
    key: "academic",
    icon: "school-outline",
    title: "Academic Information",
    fields: [
      { key: "schoolId", label: "School ID" },
      { key: "academicProgram", label: "Program" },
      { key: "yearLevel", label: "Year Level" },
      { key: "department", label: "Department" },
    ],
  },
  {
    key: "personal",
    icon: "person-outline",
    title: "Personal Information",
    fields: [
      { key: "fullName", label: "Full Name" },
      { key: "genderIdentity", label: "Gender Identity" },
      { key: "nationality", label: "Nationality" },
      { key: "citizenship", label: "Citizenship" },
      { key: "civilStatus", label: "Civil Status" },
      { key: "culturalAffiliation", label: "Cultural Affiliation" },
      { key: "religiousAffiliation", label: "Religious Affiliation" },
    ],
  },
  {
    key: "contact",
    icon: "call-outline",
    title: "Contact Information",
    fields: [
      { key: "email", label: "Email" },
      { key: "contactNo", label: "Contact Number" },
      { key: "provincialAddress", label: "Provincial Address" },
    ],
  },
];

// ─── Accessible ⓘ tooltip (hover + keyboard focus) ───────────────────────────
function InfoTooltip({ text }: { text: string }) {
  const [visible, setVisible] = useState(false);
  const [interacting, setInteracting] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };
  const showTooltip = () => {
    clearTimer();
    timer.current = setTimeout(() => setVisible(true), 250);
  };
  const hideTooltip = () => {
    clearTimer();
    setVisible(false);
  };

  return (
    <View style={styles.tooltipAnchor}>
      <Pressable
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
        accessibilityLabel="More information"
        hitSlop={6}
        style={({ pressed }) => [
          styles.infoIcon,
          interacting && styles.infoIconHover,
          pressed && styles.infoIconPressed,
        ]}
      >
        <Ionicons name="information-circle-outline" size={18} color={DETAIL_COLORS.textFaint} />
      </Pressable>
      {visible && (
        <View style={styles.infoTooltip} pointerEvents="none">
          <Text style={styles.infoTooltipText}>{text}</Text>
        </View>
      )}
    </View>
  );
}

// ─── Reusable card with consistent section header ────────────────────────────
function SectionCard({
  icon,
  iconColor = DETAIL_COLORS.purple,
  iconBg = DETAIL_COLORS.purpleSoft,
  title,
  info,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  iconBg?: string;
  title: string;
  info?: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.sectionHeaderRow}>
        <View style={[styles.sectionIconCircle, { backgroundColor: iconBg }]}>
          <Ionicons name={icon} size={18} color={iconColor} />
        </View>
        <Text style={styles.sectionTitle}>{title}</Text>
        {info ? <InfoTooltip text={info} /> : null}
      </View>
      <View style={styles.divider} />
      {children}
    </View>
  );
}

// ─── Concern level pill ───────────────────────────────────────────────────────
function RiskPill({ risk }: { risk: RiskLevelType | null }) {
  if (!risk) {
    return (
      <View style={styles.riskPill}>
        <Text style={styles.noRiskText}>No assessment yet</Text>
      </View>
    );
  }
  const meta = RISK_META[risk];
  return (
    <View style={[styles.riskPill, { backgroundColor: meta.bg }]}>
      <View style={[styles.riskPillDot, { backgroundColor: meta.dot }]} />
      <Text style={[styles.riskPillText, { color: meta.color }]}>{meta.label}</Text>
    </View>
  );
}

// ─── Compact wellness snapshot tile ──────────────────────────────────────────
function SnapshotTile({
  icon,
  iconColor = DETAIL_COLORS.purple,
  iconBg = DETAIL_COLORS.purpleSoft,
  emoji,
  value,
  label,
  sub,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  iconBg?: string;
  emoji?: string;
  value: string;
  label: string;
  sub?: string;
}) {
  return (
    <View style={styles.snapshotTile}>
      <View style={[styles.snapshotIcon, { backgroundColor: iconBg }]}>
        {emoji ? (
          <Text style={styles.snapshotEmoji}>{emoji}</Text>
        ) : icon ? (
          <Ionicons name={icon} size={20} color={iconColor} />
        ) : null}
      </View>
      <Text style={styles.snapshotValue} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.snapshotLabel} numberOfLines={1}>
        {label}
      </Text>
      {sub ? (
        <Text style={styles.snapshotSub} numberOfLines={1}>
          {sub}
        </Text>
      ) : null}
    </View>
  );
}

export default function StudentDetailScreen() {
  const { uid } = useLocalSearchParams<{ uid: string }>();
  const [loading, setLoading] = useState(true);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [moodCounts, setMoodCounts] = useState<Record<string, number>>({});
  const [assessments, setAssessments] = useState<AssessmentRecord[]>([]);
  const [hoveredTrendIdx, setHoveredTrendIdx] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Prevent execution until uid is fully parsed from route parameters
    if (!uid) return;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/auth/login");
        return;
      }

      try {
        setLoading(true);

        // Fetch user profile
        const profileSnap = await getDoc(doc(db, "users", uid));
        if (profileSnap.exists()) {
          setProfile(profileSnap.data() as ProfileData);
        }

        // Fetch journal entries
        const entriesRef = collection(doc(db, "users", uid), "journalEntries");
        const q = query(entriesRef, orderBy("createdAt", "desc"));
        const entriesSnap = await getDocs(q);

        const entries: JournalEntry[] = [];
        const counts: Record<string, number> = {};

        for (const docSnap of entriesSnap.docs) {
          const data = docSnap.data() as Record<string, any>;
          const mood = data.mood || "unknown";
          const entry: JournalEntry = {
            id: docSnap.id,
            mood,
            createdAt: data.createdAt?.toDate?.()
              ? data.createdAt?.toDate()
              : data.createdAt
                ? new Date(data.createdAt)
                : undefined,
          };
          entries.push(entry);
          counts[mood] = (counts[mood] || 0) + 1;
        }

        setJournalEntries(entries);
        setMoodCounts(counts);

        // Fetch self-assessments
        const assessmentRef = collection(
          doc(db, "users", uid),
          "selfAssessments",
        );
        const assessmentQ = query(assessmentRef, orderBy("createdAt", "asc"));
        const assessmentSnap = await getDocs(assessmentQ);

        const records: AssessmentRecord[] = [];
        for (const docSnap of assessmentSnap.docs) {
          const data = docSnap.data() as Record<string, any>;
          const createdAt = data.createdAt?.toDate?.()
            ? data.createdAt?.toDate()
            : data.createdAt
              ? new Date(data.createdAt)
              : new Date();
          records.push({
            id: docSnap.id,
            totalScore:
              typeof data.totalScore === "number"
                ? data.totalScore
                : Number(data.totalScore) || 0,
            riskLevel: data.riskLevel || "low",
            createdAt,
          });
        }
        setAssessments(records);
      } catch (err) {
        console.error("Error loading student detail", err);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [uid]);

  const latestAssessment =
    assessments.length > 0 ? assessments[assessments.length - 1] : null;

  const maxCount = Math.max(...Object.values(moodCounts), 1);
  const screenWidth = Dimensions.get("window").width;
  const barMaxWidth = screenWidth * 0.45;
  const trendChartWidth = Math.min(340, screenWidth - 96);

  // ─── Derived presentation values (existing data only) ───────────────────
  const latestScore = latestAssessment?.totalScore;
  const latestRisk = riskFromLatestScore(latestScore);
  const prevAssessment =
    assessments.length >= 2 ? assessments[assessments.length - 2] : undefined;
  const prevScore = prevAssessment?.totalScore;
  const scoreDelta =
    latestScore !== undefined && prevScore !== undefined
      ? latestScore - prevScore
      : undefined;
  const changeLabel =
    scoreDelta === undefined
      ? "First assessment"
      : scoreDelta > 0
        ? `↑ +${scoreDelta}`
        : scoreDelta < 0
          ? `↓ ${scoreDelta}`
          : "± 0";
  const latestJournal = journalEntries.length > 0 ? journalEntries[0] : undefined;
  const latestMoodId = latestJournal?.mood;
  const latestMoodLabel = latestMoodId ? MOOD_LABELS[latestMoodId] || latestMoodId : "None";

  const journalLast30Days = journalEntries.filter((e) => {
    const d = e.createdAt;
    return d && Date.now() - d.getTime() <= 30 * 24 * 60 * 60 * 1000;
  }).length;

  const sortedMoodCounts = Object.entries(moodCounts).sort(
    ([, a], [, b]) => b - a,
  );
  const topMood = sortedMoodCounts[0];

  const lastUpdatedSource = [latestAssessment?.createdAt, latestJournal?.createdAt]
    .filter((d): d is Date => !!d)
    .sort((a, b) => b.getTime() - a.getTime())[0];
  const lastUpdatedLabel = lastUpdatedSource
    ? `${lastUpdatedSource.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })} • ${lastUpdatedSource.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      })}`
    : "No activity yet";

  const activityItems: {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    date?: Date;
  }[] = [
    {
      icon: "book-outline",
      label: "Journal entry",
      date: latestJournal?.createdAt,
    },
    {
      icon: "happy-outline",
      label: "Mood check-in",
      date: latestJournal?.createdAt,
    },
    {
      icon: "fitness-outline",
      label: "Self-assessment",
      date: latestAssessment?.createdAt,
    },
  ];

  const journeySteps = [
    {
      emoji: "🌱",
      title: "First Reflection",
      desc: "Complete your first journal",
      done: journalEntries.length > 0,
    },
    {
      emoji: "🌿",
      title: "Regular Check-ins",
      desc: "Complete 2+ assessments",
      done: assessments.length >= 2,
    },
    {
      emoji: "🌳",
      title: "Growing Consistency",
      desc: "Complete 4+ assessments",
      done: assessments.length >= 4,
    },
  ];
  const journeyDoneCount = journeySteps.filter((s) => s.done).length;

  const handleOpenDocument = (url?: string) => {
    if (url) {
      Linking.openURL(url).catch((err) =>
        console.error("Failed to open document URL:", err),
      );
    }
  };

  const renderAssessmentTrend = () => {
    if (assessments.length === 0) {
      return (
        <View style={styles.emptyMoodsContainer}>
          <Ionicons
            name="trending-up-outline"
            size={36}
            color={DETAIL_COLORS.textFaint}
          />
          <Text style={styles.emptyMoodsText}>No assessments taken yet</Text>
          <Text style={styles.emptyMoodsSubtext}>
            Scores will appear once the student completes the self-assessment.
          </Text>
        </View>
      );
    }

    const buckets = bucketAssessments(assessments);
    if (buckets.length === 0) return null;

    const scoreMax = 80;
    const chartW = trendChartWidth;
    const chartH = 170;
    const yAxisX = 34;
    const plotLeft = 42;
    const plotRight = chartW - 10;
    const plotWidth = plotRight - plotLeft;
    const chartTop = 10;
    const chartBottom = chartH - 6;

    const yFor = (score: number) =>
      chartTop +
      (1 - Math.min(Math.max(score, 0), scoreMax) / scoreMax) *
        (chartBottom - chartTop);

    const xStart = plotLeft;
    const xSpacing =
      buckets.length > 1 ? plotWidth / (buckets.length - 1) : plotWidth;

    const intervalMs = 30 * 24 * 60 * 60 * 1000;
    const pts = buckets.map((b, i) => {
      const inBucket = assessments.filter((a) => {
        const t = a.createdAt.getTime();
        return (
          t >= b.startDate.getTime() && t < b.startDate.getTime() + intervalMs
        );
      });
      const first = inBucket[0];
      const last = inBucket[inBucket.length - 1];
      const concern = riskFromLatestScore(b.avgScore) ?? "low";
      const meta = RISK_META[concern];
      return {
        x: xStart + i * xSpacing,
        y: yFor(b.avgScore),
        score: b.avgScore,
        label: b.label,
        dateLabel:
          inBucket.length === 1 && first
            ? formatFullDate(first.createdAt)
            : `${formatShortDate(first.createdAt)} – ${formatShortDate(last.createdAt)}`,
        concernLabel: meta.label,
        concernDot: meta.dot,
      };
    });
    const polyPoints = pts.map((p) => `${p.x},${p.y}`).join(" ");

    const yTicks = [0, 20, 40, 60, 80];
    const highLineY = yFor(51);
    const modLineY = yFor(21);
    const tooltipW = 220;
    const hoveredPt = hoveredTrendIdx !== null ? pts[hoveredTrendIdx] : null;
    const riskMeta = RISK_META[latestRisk ?? "low"];

    return (
      <View>
        <View style={[styles.trendChartWrap, { width: chartW }]}>
          <Svg width={chartW} height={chartH}>
            <Rect
              x={plotLeft}
              y={chartTop}
              width={plotWidth}
              height={highLineY - chartTop}
              fill="#FDE8E8"
              fillOpacity={0.5}
            />
            <Rect
              x={plotLeft}
              y={highLineY}
              width={plotWidth}
              height={modLineY - highLineY}
              fill="#FDF3E3"
              fillOpacity={0.5}
            />
            <Rect
              x={plotLeft}
              y={modLineY}
              width={plotWidth}
              height={chartBottom - modLineY}
              fill="#E7F7F0"
              fillOpacity={0.5}
            />

            {yTicks.map((t) => {
              const gy = yFor(t);
              return (
                <Line
                  key={t}
                  x1={plotLeft}
                  y1={gy}
                  x2={plotRight}
                  y2={gy}
                  stroke="#EFEBFA"
                  strokeWidth={1}
                />
              );
            })}

            <Line
              x1={yAxisX}
              y1={chartTop}
              x2={yAxisX}
              y2={chartBottom}
              stroke="#E8DFF6"
              strokeWidth={1}
            />
            {yTicks.map((t) => (
              <Line
                key={t}
                x1={yAxisX - 4}
                y1={yFor(t)}
                x2={yAxisX}
                y2={yFor(t)}
                stroke="#D9CFF0"
                strokeWidth={1}
              />
            ))}
            {yTicks.map((t) => (
              <SvgText
                key={t}
                x={yAxisX - 8}
                y={yFor(t) + 3}
                fontSize={9}
                fontWeight="600"
                fill={DETAIL_COLORS.textFaint}
                textAnchor="end"
              >
                {t}
              </SvgText>
            ))}

            <Line
              x1={plotLeft}
              y1={highLineY}
              x2={plotRight}
              y2={highLineY}
              stroke="#EF4444"
              strokeOpacity={0.3}
              strokeWidth={1}
              strokeDasharray="5 4"
            />
            <Line
              x1={plotLeft}
              y1={modLineY}
              x2={plotRight}
              y2={modLineY}
              stroke="#F59E0B"
              strokeOpacity={0.35}
              strokeWidth={1}
              strokeDasharray="5 4"
            />

            <SvgText
              x={plotRight - 6}
              y={chartTop + (highLineY - chartTop) / 2 + 3}
              fontSize={9}
              fontWeight="700"
              fill="#DC2626"
              fillOpacity={0.6}
              textAnchor="end"
            >
              High
            </SvgText>
            <SvgText
              x={plotRight - 6}
              y={highLineY + (modLineY - highLineY) / 2 + 3}
              fontSize={9}
              fontWeight="700"
              fill="#B45309"
              fillOpacity={0.6}
              textAnchor="end"
            >
              Moderate
            </SvgText>
            <SvgText
              x={plotRight - 6}
              y={modLineY + (chartBottom - modLineY) / 2 + 3}
              fontSize={9}
              fontWeight="700"
              fill="#0E9F6E"
              fillOpacity={0.65}
              textAnchor="end"
            >
              Low
            </SvgText>

            {pts.length >= 2 && (
              <Polyline
                points={polyPoints}
                fill="none"
                stroke={DETAIL_COLORS.purple}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            )}

            {pts.map((p, i) => {
              const isLatest = i === pts.length - 1;
              return (
                <G key={`pt-${i}`}>
                  <Circle
                    cx={p.x}
                    cy={p.y}
                    r={9}
                    fill={p.concernDot}
                    fillOpacity={0.15}
                  />
                  <Circle
                    cx={p.x}
                    cy={p.y}
                    r={5}
                    fill={p.concernDot}
                    stroke="#FFFFFF"
                    strokeWidth={2}
                  />
                  {isLatest && (
                    <SvgText
                      x={p.x}
                      y={Math.max(p.y - 10, 9)}
                      fontSize={10}
                      fontWeight="800"
                      fill={DETAIL_COLORS.text}
                      textAnchor="middle"
                    >
                      {p.score}
                    </SvgText>
                  )}
                </G>
              );
            })}
          </Svg>

          {pts.map((p, i) => (
            <View
              key={`hotspot-${i}`}
              style={[styles.trendPointHotspot, { left: p.x - 12, top: p.y - 12 }]}
            >
              <Pressable
                onHoverIn={() => setHoveredTrendIdx(i)}
                onHoverOut={() => setHoveredTrendIdx(null)}
                onFocus={() => setHoveredTrendIdx(i)}
                onBlur={() => setHoveredTrendIdx(null)}
                accessibilityRole="button"
                accessibilityLabel={`Assessment on ${p.dateLabel}: score ${p.score} of 80, ${p.concernLabel}`}
                style={styles.trendPointHitbox}
              />
            </View>
          ))}

          {hoveredPt && (
            <View
              pointerEvents="none"
              style={[
                styles.trendTooltip,
                {
                  left: Math.min(
                    Math.max(hoveredPt.x - tooltipW / 2, 0),
                    chartW - tooltipW,
                  ),
                  top:
                    hoveredPt.y > 80
                      ? Math.max(hoveredPt.y - 80, 4)
                      : hoveredPt.y + 18,
                },
              ]}
            >
              <Text style={styles.trendTooltipDate}>{hoveredPt.dateLabel}</Text>
              <Text style={styles.trendTooltipScore}>
                Assessment Score: {hoveredPt.score} / 80
              </Text>
              <View style={styles.trendTooltipConcernRow}>
                <View
                  style={[
                    styles.trendTooltipDot,
                    { backgroundColor: hoveredPt.concernDot },
                  ]}
                />
                <Text style={styles.trendTooltipConcern}>
                  Concern Level: {hoveredPt.concernLabel}
                </Text>
              </View>
            </View>
          )}
        </View>

        <View
          style={[
            styles.trendLabelsRow,
            { width: chartW, paddingLeft: xStart - xSpacing / 2 },
          ]}
        >
          {pts.map((p, i) => (
            <Text
              key={`xl-${i}`}
              style={[styles.trendXLabel, { width: xSpacing }]}
              numberOfLines={1}
            >
              {p.label}
            </Text>
          ))}
        </View>

        <View style={styles.trendSummary}>
          <View style={styles.trendSummaryCell}>
            <Text style={styles.trendSummaryLabel}>Current</Text>
            <Text style={styles.trendSummaryValue}>
              {latestScore !== undefined ? `${latestScore} / 80` : "—"}
            </Text>
          </View>
          <View style={styles.trendSummaryCell}>
            <Text style={styles.trendSummaryLabel}>Previous</Text>
            <Text style={styles.trendSummaryValue}>
              {prevScore !== undefined ? `${prevScore} / 80` : "—"}
            </Text>
          </View>
          <View style={styles.trendSummaryCell}>
            <Text style={styles.trendSummaryLabel}>Change</Text>
            <Text style={styles.trendSummaryValue}>{changeLabel}</Text>
          </View>
          <View style={styles.trendSummaryCell}>
            <Text style={styles.trendSummaryLabel}>Status</Text>
            <View style={styles.trendSummaryStatusRow}>
              <View
                style={[
                  styles.trendSummaryStatusDot,
                  { backgroundColor: riskMeta.dot },
                ]}
              />
              <Text
                style={[styles.trendSummaryValue, { color: riskMeta.color }]}
              >
                {riskMeta.label}
              </Text>
            </View>
          </View>
        </View>

        {assessments.length === 1 && (
          <View style={styles.trendFirstBlock}>
            <Text style={styles.trendFirstTitle}>First assessment recorded</Text>
            <Text style={styles.trendFirstSub}>
              More assessments will appear here as the student continues using
              MindCare.
            </Text>
          </View>
        )}

        <View style={styles.totalMoodsRow}>
          <Ionicons
            name="clipboard-outline"
            size={16}
            color={DETAIL_COLORS.textMuted}
          />
          <Text style={styles.totalMoodsText}>
            {assessments.length} assessment
            {assessments.length !== 1 ? "s" : ""} total
            {buckets.length > 1
              ? ` • ${buckets.length} periods`
              : ` • ${buckets[0].label}`}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.mainLayout}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color="#2D1B69" />
          </Pressable>
          <Text style={styles.headerTitle} numberOfLines={1}>
            Student Details
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        {loading ? (
          <View style={styles.stateCard}>
            <ActivityIndicator size="large" color="#6366F1" />
            <Text style={styles.stateText}>Loading student information...</Text>
          </View>
        ) : !profile ? (
          <View style={styles.stateCard}>
            <Ionicons name="alert-circle-outline" size={40} color="#EF4444" />
            <Text style={styles.stateText}>
              Unable to load student profile.
            </Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Profile Summary Card */}
            <View style={styles.profileCard}>
              <View style={styles.profileTopRow}>
                <Pressable
                  onPress={async () => {
                    if (uploadingImage) return;
                    if (Platform.OS === "web") {
                      fileInputRef.current?.click();
                    } else {
                      setUploadingImage(true);
                      const newUrl = await changeProfileImage(uid, "users");
                      if (newUrl) {
                        setProfile((prev) => prev ? { ...prev, profileImage: newUrl } : prev);
                      }
                      setUploadingImage(false);
                    }
                  }}
                  style={styles.avatarPressable}
                >
                  {Platform.OS === "web" && (
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      style={{ display: "none" }}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setUploadingImage(true);
                        const newUrl = await uploadProfileImageFromFile(file, uid, "users");
                        if (newUrl) {
                          setProfile((prev) => prev ? { ...prev, profileImage: newUrl } : prev);
                        }
                        setUploadingImage(false);
                        e.target.value = "";
                      }}
                    />
                  )}
                  <View style={styles.avatarCircle}>
                    {profile.profileImage ? (
                      <Image source={{ uri: profile.profileImage }} style={{ width: 56, height: 56, borderRadius: 28 }} />
                    ) : (
                      <Text style={styles.avatarText}>
                        {(profile.fullName || "?").charAt(0).toUpperCase()}
                      </Text>
                    )}
                    {uploadingImage && (
                      <View style={styles.avatarUploadingOverlay}>
                        <ActivityIndicator color="white" size="small" />
                      </View>
                    )}
                  </View>
                  <View style={styles.avatarCameraBadge}>
                    <Ionicons name="camera" size={12} color="white" />
                  </View>
                </Pressable>
                <View style={styles.profileInfo}>
                  <Text style={styles.profileName}>
                    {profile.fullName || "Student"}
                  </Text>
                  <Text style={styles.profileSub} numberOfLines={1}>
                    {[profile.academicProgram, profile.yearLevel]
                      .filter(Boolean)
                      .join(" • ") || "—"}
                  </Text>
                  <Text style={styles.profileDept} numberOfLines={1}>
                    {profile.department || "—"}
                  </Text>
                </View>
                <View style={styles.profileIdBox}>
                  <Text style={styles.profileIdLabel}>School ID</Text>
                  <Text style={styles.profileId} numberOfLines={1}>
                    {profile.schoolId || "—"}
                  </Text>
                </View>
              </View>

              <View style={styles.profileStatusRow}>
                <RiskPill risk={latestRisk} />
                <View style={styles.statusPill}>
                  <Ionicons
                    name="book-outline"
                    size={13}
                    color={DETAIL_COLORS.purple}
                  />
                  <Text style={styles.statusPillText}>
                    {journalEntries.length} Journal
                  </Text>
                </View>
                <View style={styles.statusPill}>
                  <Ionicons
                    name="fitness-outline"
                    size={13}
                    color={DETAIL_COLORS.purple}
                  />
                  <Text style={styles.statusPillText}>
                    {assessments.length} Assessment
                  </Text>
                </View>
              </View>

              <View style={styles.lastUpdatedRow}>
                <Ionicons
                  name="time-outline"
                  size={12}
                  color={DETAIL_COLORS.textFaint}
                />
                <Text style={styles.lastUpdatedText}>
                  Last updated: {lastUpdatedLabel}
                </Text>
              </View>
            </View>

            {/* Wellness Snapshot */}
            <View style={styles.snapshotHeadingRow}>
              <Text style={styles.snapshotEyebrow}>Wellness Snapshot</Text>
            </View>
            <View style={styles.snapshotRow}>
              <SnapshotTile
                icon="fitness-outline"
                iconColor={
                  latestRisk ? RISK_META[latestRisk].color : DETAIL_COLORS.textFaint
                }
                iconBg={latestRisk ? RISK_META[latestRisk].bg : "#F1F3F8"}
                value={latestRisk ? latestRisk.toUpperCase() : "—"}
                label="Concern"
                sub={latestScore !== undefined ? `${latestScore}/80` : undefined}
              />
              <SnapshotTile
                icon="book-outline"
                iconColor={DETAIL_COLORS.purple}
                iconBg={DETAIL_COLORS.purpleSoft}
                value={String(journalEntries.length)}
                label="Journals"
                sub={
                  journalEntries.length > 0
                    ? `${journalLast30Days} last 30 days`
                    : "No entries"
                }
              />
              <SnapshotTile
                emoji="😊"
                iconBg="#F1EFF9"
                value={latestMoodLabel}
                label="Recent Mood"
                sub={
                  latestJournal?.createdAt
                    ? formatRelativeTime(latestJournal.createdAt)
                    : "—"
                }
              />
              <SnapshotTile
                icon="stats-chart-outline"
                iconColor={DETAIL_COLORS.purple}
                iconBg={DETAIL_COLORS.purpleSoft}
                value={latestScore !== undefined ? `${latestScore}/80` : "—"}
                label="Assessment"
                sub={
                  latestRisk
                    ? latestRisk.charAt(0).toUpperCase() + latestRisk.slice(1)
                    : "Score"
                }
              />
            </View>

            {/* Registration Information Card */}
            <SectionCard
              icon="document-text-outline"
              title="Registration Information"
              info="Academic, personal, and contact information provided during registration. Demographic details are shown for reference only and are not used to assess wellness."
            >
              {REGISTRATION_GROUPS.map((group) => (
                <View key={group.key} style={styles.regGroup}>
                  <View style={styles.regGroupHeader}>
                    <View style={styles.regGroupIconCircle}>
                      <Ionicons
                        name={group.icon}
                        size={15}
                        color={DETAIL_COLORS.purple}
                      />
                    </View>
                    <Text style={styles.regGroupTitle}>{group.title}</Text>
                  </View>
                  {group.fields.map((field) => {
                    const value = profile[field.key];
                    const displayValue =
                      value && typeof value === "string" && value.trim()
                        ? value.trim()
                        : "—";
                    return (
                      <View key={field.key} style={styles.infoRow}>
                        <Text style={styles.infoLabel}>{field.label}</Text>
                        <Text style={styles.infoValue} numberOfLines={3}>
                          {displayValue}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              ))}

              {/* LSN / Special Needs */}
              <View style={styles.regGroup}>
                <View style={styles.regGroupHeader}>
                  <View style={styles.regGroupIconCircle}>
                    <Ionicons
                      name="body-outline"
                      size={15}
                      color={DETAIL_COLORS.purple}
                    />
                  </View>
                  <Text style={styles.regGroupTitle}>
                    Additional Information
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>
                    Learner with Special Needs (LSN)
                  </Text>
                  <Text style={styles.infoValue}>
                    {profile.isLSN ? "Yes" : "No"}
                  </Text>
                </View>
                {profile.isLSN && (
                  <>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Special Need Type</Text>
                      <Text style={styles.infoValue}>
                        {profile.specialNeedsType || "Not specified"}
                      </Text>
                    </View>
                    <View style={styles.documentCard}>
                      <Ionicons
                        name="document-text-outline"
                        size={24}
                        color="#7C3AED"
                      />
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={styles.docTitle}>Verification Document</Text>
                        <Text style={styles.docName} numberOfLines={1}>
                          {profile.lsnDocument?.fileName ||
                            "Attached Certificate / ID"}
                        </Text>
                      </View>
                      {profile.lsnDocument?.secureUrl ? (
                        <Pressable
                          style={styles.viewDocButton}
                          onPress={() =>
                            handleOpenDocument(profile.lsnDocument?.secureUrl)
                          }
                        >
                          <Text style={styles.viewDocText}>Open File</Text>
                        </Pressable>
                      ) : (
                        <Text style={styles.noDocText}>No file attached</Text>
                      )}
                    </View>
                  </>
                )}
              </View>
            </SectionCard>

            {/* Current Wellness Status */}
            <SectionCard
              icon="fitness-outline"
              iconColor={
                latestRisk ? RISK_META[latestRisk].color : DETAIL_COLORS.purple
              }
              iconBg={latestRisk ? RISK_META[latestRisk].bg : DETAIL_COLORS.purpleSoft}
              title="Current Wellness Status"
              info="A general classification based on the student's latest self-assessment. It is intended to support awareness and should not be treated as a clinical diagnosis."
            >
              {latestAssessment && latestRisk ? (
                <View style={styles.wellnessBody}>
                  <View style={styles.wellnessBadgeRow}>
                    <View
                      style={[
                        styles.wellnessBadge,
                        { backgroundColor: RISK_META[latestRisk].bg },
                      ]}
                    >
                      <View
                        style={[
                          styles.wellnessBadgeDot,
                          { backgroundColor: RISK_META[latestRisk].dot },
                        ]}
                      />
                      <Text
                        style={[
                          styles.wellnessBadgeText,
                          { color: RISK_META[latestRisk].color },
                        ]}
                      >
                        {latestRisk === "high"
                          ? "HIGH CONCERN"
                          : latestRisk === "moderate"
                            ? "MODERATE CONCERN"
                            : "LOW CONCERN"}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.scoreHeaderRow}>
                    <Text style={styles.scoreLabel}>Assessment Score</Text>
                    <Text style={styles.scoreValue}>
                      {latestScore} / 80
                    </Text>
                  </View>
                  <View style={styles.scoreBar}>
                    <View
                      style={[
                        styles.scoreBarFill,
                        {
                          width: `${Math.min(
                            Math.max(((latestScore || 0) / 80) * 100, 2),
                            100,
                          )}%`,
                          backgroundColor: RISK_META[latestRisk].dot,
                        },
                      ]}
                    />
                    <View
                      style={[
                        styles.scoreBarDot,
                        {
                          left: `${Math.min(
                            Math.max(((latestScore || 0) / 80) * 100, 2),
                            100,
                          )}%`,
                          backgroundColor: RISK_META[latestRisk].dot,
                        },
                      ]}
                    />
                  </View>
                  <View style={styles.scoreScaleRow}>
                    <Text style={styles.scoreScaleText}>0</Text>
                    <Text style={styles.scoreScaleText}>80</Text>
                  </View>
                  <Text style={styles.scoreMeta}>
                    Latest assessment:{" "}
                    {latestAssessment.createdAt.toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </Text>
                </View>
              ) : (
                <View style={styles.emptyMoodsContainer}>
                  <Ionicons
                    name="clipboard-outline"
                    size={36}
                    color={DETAIL_COLORS.textFaint}
                  />
                  <Text style={styles.emptyMoodsText}>No assessment yet</Text>
                  <Text style={styles.emptyMoodsSubtext}>
                    The student's wellness status will appear after their first
                    self-assessment.
                  </Text>
                </View>
              )}
            </SectionCard>

            {/* Assessment Trend */}
            <SectionCard
              icon="trending-up-outline"
              title="Assessment Trend"
              info="Average self-assessment scores over time. A single point appears until the student completes more assessments."
            >
              {renderAssessmentTrend()}
            </SectionCard>

            {/* Mood Journal Analytics */}
            <SectionCard
              icon="happy-outline"
              title="Mood Journal Analytics"
              info="Distribution of moods recorded in the student's journal entries. Only moods the student has logged are shown."
            >
              {sortedMoodCounts.length === 0 ? (
                <View style={styles.emptyMoodsContainer}>
                  <Text style={styles.emptyMoodEmoji}>😊</Text>
                  <Text style={styles.emptyMoodsText}>No mood entries yet</Text>
                  <Text style={styles.emptyMoodsSubtext}>
                    Mood analytics will appear when the student starts recording
                    their mood.
                  </Text>
                </View>
              ) : (
                <>
                  <View style={styles.barGraphContainer}>
                    {sortedMoodCounts.map(([moodId, count]) => {
                      const barWidth =
                        count > 0
                          ? Math.max((count / maxCount) * barMaxWidth, 8)
                          : 0;
                      const color = MOOD_COLORS[moodId] || "#D1D5DB";
                      return (
                        <View key={moodId} style={styles.barRow}>
                          <View style={styles.barLabelRow}>
                            <Text style={styles.moodEmojiSmall}>
                              {MOOD_EMOJIS[moodId] || "❓"}
                            </Text>
                            <Text style={styles.barLabel}>
                              {MOOD_LABELS[moodId] || moodId}
                            </Text>
                          </View>
                          <View style={styles.barTrack}>
                            <View
                              style={[
                                styles.barFill,
                                { width: barWidth, backgroundColor: color },
                              ]}
                            />
                          </View>
                          <Text style={styles.barCount}>{count}</Text>
                        </View>
                      );
                    })}
                  </View>

                  {(topMood || latestMoodId) && (
                    <View style={styles.moodChipsRow}>
                      {topMood && (
                        <View style={styles.moodChip}>
                          <Text style={styles.moodChipText}>
                            Most frequent:{" "}
                            {MOOD_EMOJIS[topMood[0]] || "😊"}{" "}
                            {MOOD_LABELS[topMood[0]] || topMood[0]}
                          </Text>
                        </View>
                      )}
                      {latestMoodId && (
                        <View style={styles.moodChip}>
                          <Text style={styles.moodChipText}>
                            Most recent: {MOOD_EMOJIS[latestMoodId] || "😊"}{" "}
                            {MOOD_LABELS[latestMoodId] || latestMoodId}
                          </Text>
                        </View>
                      )}
                    </View>
                  )}

                  <View style={styles.totalMoodsRow}>
                    <Ionicons
                      name="journal-outline"
                      size={16}
                      color={DETAIL_COLORS.textMuted}
                    />
                    <Text style={styles.totalMoodsText}>
                      {journalEntries.length} total journal
                      {journalEntries.length !== 1 ? " entries" : " entry"}
                    </Text>
                  </View>
                </>
              )}
            </SectionCard>

            {/* Wellness Journey */}
            <SectionCard
              icon="leaf-outline"
              title="Wellness Journey"
              info="A gentle look at the student's engagement with MindCare over time. This is not a score or a comparison."
            >
              <View style={styles.journeyRow}>
                {journeySteps.map((step, i) => (
                  <View key={step.title} style={styles.journeyStep}>
                    <View style={styles.journeyStepTop}>
                      <View
                        style={[
                          styles.journeyDot,
                          step.done && styles.journeyDotDone,
                        ]}
                      >
                        <Text style={styles.journeyEmoji}>{step.emoji}</Text>
                      </View>
                      {i < journeySteps.length - 1 && (
                        <View
                          style={[
                            styles.journeyConnector,
                            journeyDoneCount > i && styles.journeyConnectorDone,
                          ]}
                        />
                      )}
                    </View>
                    <Text style={styles.journeyTitle}>{step.title}</Text>
                    <Text style={styles.journeyDesc}>{step.desc}</Text>
                    <Text
                      style={[
                        styles.journeyCheck,
                        step.done && styles.journeyCheckDone,
                      ]}
                    >
                      {step.done ? "✓ Completed" : "○ In progress"}
                    </Text>
                  </View>
                ))}
              </View>
              <View style={styles.journeyNote}>
                <Ionicons name="leaf" size={14} color={DETAIL_COLORS.purple} />
                <Text style={styles.journeyNoteText}>
                  {journeyDoneCount === journeySteps.length
                    ? "You've been checking in consistently — keep it up."
                    : journeyDoneCount > 0
                      ? "Small steps add up. Keep going at your own pace."
                      : "Every wellness journey begins with a single step."}
                </Text>
              </View>
            </SectionCard>

            {/* Recent Activity */}
            <SectionCard
              icon="time-outline"
              title="Recent Activity"
              info="Most recent activity timestamps. Journal text is never shown here — only when the student engaged."
            >
              {activityItems.some((a) => a.date) ? (
                <View>
                  {activityItems.map((item) => (
                    <View key={item.label} style={styles.activityRow}>
                      <View style={styles.activityIconCircle}>
                        <Ionicons
                          name={item.icon}
                          size={16}
                          color={DETAIL_COLORS.purple}
                        />
                      </View>
                      <Text style={styles.activityLabel}>{item.label}</Text>
                      <Text style={styles.activityTime}>
                        {item.date ? formatRelativeTime(item.date) : "—"}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={styles.emptyMoodsContainer}>
                  <Ionicons
                    name="time-outline"
                    size={36}
                    color={DETAIL_COLORS.textFaint}
                  />
                  <Text style={styles.emptyMoodsText}>No activity yet</Text>
                  <Text style={styles.emptyMoodsSubtext}>
                    Activity will appear once the student journals or completes
                    an assessment.
                  </Text>
                </View>
              )}
            </SectionCard>
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: DETAIL_COLORS.bg },
  mainLayout: { flex: 1, backgroundColor: DETAIL_COLORS.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 16,
    backgroundColor: DETAIL_COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: DETAIL_COLORS.border,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: DETAIL_COLORS.purpleSoft,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    color: DETAIL_COLORS.text,
    fontSize: 18,
    fontWeight: "800",
    flex: 1,
    textAlign: "center",
    marginHorizontal: 8,
  },
  headerSpacer: { width: 38 },
  scrollContent: { padding: 24, paddingBottom: 40 },
  stateCard: {
    backgroundColor: DETAIL_COLORS.surface,
    borderRadius: 20,
    padding: 32,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 24,
    marginTop: 40,
    // @ts-ignore - web only
    boxShadow: "0px 4px 20px rgba(0, 0, 0, 0.04)",
  },
  stateText: {
    marginTop: 12,
    color: DETAIL_COLORS.textMuted,
    fontSize: 14,
    textAlign: "center",
  },
  card: {
    backgroundColor: DETAIL_COLORS.surface,
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: DETAIL_COLORS.border,
    // @ts-ignore - web only
    boxShadow: "0px 6px 20px rgba(138, 99, 210, 0.06)",
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: DETAIL_COLORS.text,
    marginLeft: 8,
  },
  divider: {
    height: 1,
    backgroundColor: DETAIL_COLORS.border,
    marginBottom: 14,
  },
  tooltipAnchor: {
    position: "relative",
    alignSelf: "flex-start",
    marginLeft: "auto",
  },
  infoIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  infoIconHover: {
    backgroundColor: DETAIL_COLORS.purpleSoft,
  },
  infoIconPressed: {
    opacity: 0.6,
  },
  infoTooltip: {
    position: "absolute",
    top: 28,
    right: 0,
    width: 250,
    backgroundColor: "#2A2547",
    borderRadius: 12,
    padding: 12,
    zIndex: 30,
    elevation: 6,
    // @ts-ignore - web only
    boxShadow: "0px 8px 24px rgba(31, 36, 64, 0.25)",
  },
  infoTooltipText: {
    color: "#FFFFFF",
    fontSize: 12,
    lineHeight: 18,
  },
  riskPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#F1F3F8",
  },
  riskPillDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  riskPillText: {
    fontSize: 12,
    fontWeight: "800",
  },
  noRiskText: {
    fontSize: 12,
    fontWeight: "700",
    color: DETAIL_COLORS.textMuted,
  },
  avatarPressable: {
    position: "relative",
    marginRight: 14,
  },
  avatarCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: DETAIL_COLORS.purple,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  avatarText: {
    color: "white",
    fontSize: 24,
    fontWeight: "800",
  },
  avatarCameraBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: DETAIL_COLORS.purple,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "white",
  },
  avatarUploadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 28,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  profileCard: {
    backgroundColor: DETAIL_COLORS.surface,
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: DETAIL_COLORS.border,
    // @ts-ignore - web only
    boxShadow: "0px 6px 20px rgba(138, 99, 210, 0.06)",
  },
  profileTopRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: "800",
    color: DETAIL_COLORS.text,
  },
  profileSub: {
    fontSize: 13,
    fontWeight: "600",
    color: DETAIL_COLORS.purple,
    marginTop: 2,
  },
  profileDept: {
    fontSize: 12,
    fontWeight: "500",
    color: DETAIL_COLORS.textMuted,
    marginTop: 2,
  },
  profileIdBox: {
    backgroundColor: DETAIL_COLORS.purpleSoft,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: "flex-end",
    marginLeft: 8,
  },
  profileIdLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: DETAIL_COLORS.purple,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  profileId: {
    fontSize: 13,
    fontWeight: "800",
    color: DETAIL_COLORS.purpleDeep,
    marginTop: 1,
    maxWidth: 120,
  },
  profileStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#F3F0FB",
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#F6F3FC",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: "700",
    color: DETAIL_COLORS.purple,
  },
  lastUpdatedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 10,
  },
  lastUpdatedText: {
    fontSize: 11,
    fontWeight: "500",
    color: DETAIL_COLORS.textFaint,
  },
  snapshotHeadingRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  snapshotEyebrow: {
    fontSize: 12,
    fontWeight: "800",
    color: DETAIL_COLORS.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  snapshotRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 20,
  },
  snapshotTile: {
    flex: 1,
    backgroundColor: DETAIL_COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: DETAIL_COLORS.border,
    padding: 12,
    // @ts-ignore - web only
    boxShadow: "0px 4px 14px rgba(138, 99, 210, 0.05)",
  },
  snapshotIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  snapshotEmoji: {
    fontSize: 18,
  },
  snapshotValue: {
    fontSize: 14,
    fontWeight: "800",
    color: DETAIL_COLORS.text,
  },
  snapshotLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: DETAIL_COLORS.textMuted,
    marginTop: 2,
  },
  snapshotSub: {
    fontSize: 10,
    fontWeight: "500",
    color: DETAIL_COLORS.textFaint,
    marginTop: 2,
  },
  regGroup: {
    marginBottom: 16,
  },
  regGroupHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  regGroupIconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: DETAIL_COLORS.purpleSoft,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  regGroupTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: DETAIL_COLORS.text,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F0FB",
  },
  infoLabel: {
    flex: 1,
    fontSize: 13,
    color: DETAIL_COLORS.textMuted,
    fontWeight: "600",
    paddingRight: 8,
  },
  infoValue: {
    fontSize: 13,
    color: DETAIL_COLORS.text,
    fontWeight: "700",
    flex: 1,
    textAlign: "right",
  },
  documentCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FAF8FE",
    borderRadius: 14,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: DETAIL_COLORS.border,
  },
  docTitle: {
    fontSize: 11,
    fontWeight: "600",
    color: DETAIL_COLORS.textMuted,
  },
  docName: {
    fontSize: 13,
    fontWeight: "700",
    color: DETAIL_COLORS.text,
  },
  viewDocButton: {
    backgroundColor: DETAIL_COLORS.purple,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  viewDocText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
  noDocText: {
    fontSize: 12,
    fontWeight: "600",
    color: DETAIL_COLORS.textFaint,
  },
  wellnessBody: {
    paddingTop: 4,
  },
  wellnessBadgeRow: {
    alignItems: "flex-start",
    marginBottom: 16,
  },
  wellnessBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: "flex-start",
  },
  wellnessBadgeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  wellnessBadgeText: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  scoreHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  scoreLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: DETAIL_COLORS.textMuted,
  },
  scoreValue: {
    fontSize: 14,
    fontWeight: "800",
    color: DETAIL_COLORS.text,
  },
  scoreBar: {
    position: "relative",
    height: 10,
    borderRadius: 5,
    backgroundColor: "#F1EDFB",
    marginTop: 4,
  },
  scoreBarFill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 5,
  },
  scoreBarDot: {
    position: "absolute",
    top: -3,
    width: 16,
    height: 16,
    borderRadius: 8,
    transform: [{ translateX: -8 }],
  },
  scoreScaleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
  },
  scoreScaleText: {
    fontSize: 10,
    fontWeight: "600",
    color: DETAIL_COLORS.textFaint,
  },
  scoreMeta: {
    fontSize: 12,
    color: DETAIL_COLORS.textMuted,
    marginTop: 12,
    fontStyle: "italic",
  },
  trendFirstTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: DETAIL_COLORS.text,
  },
  trendFirstSub: {
    fontSize: 12,
    color: DETAIL_COLORS.textMuted,
    lineHeight: 18,
    marginTop: 4,
  },
  trendFirstBlock: {
    marginTop: 14,
  },
  trendChartWrap: {
    position: "relative",
    alignSelf: "center",
    alignItems: "center",
  },
  trendLabelsRow: {
    flexDirection: "row",
    alignSelf: "center",
    marginTop: 6,
  },
  trendXLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: DETAIL_COLORS.textFaint,
    textAlign: "center",
    overflow: "hidden",
  },
  trendPointHotspot: {
    position: "absolute",
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 20,
  },
  trendPointHitbox: {
    width: 24,
    height: 24,
  },
  trendTooltip: {
    position: "absolute",
    width: 220,
    backgroundColor: "#2A2547",
    borderRadius: 12,
    padding: 10,
    zIndex: 40,
    elevation: 6,
    // @ts-ignore - web only
    boxShadow: "0px 8px 24px rgba(31, 36, 64, 0.25)",
  },
  trendTooltipDate: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
    opacity: 0.85,
  },
  trendTooltipScore: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
    marginTop: 4,
  },
  trendTooltipConcernRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 4,
  },
  trendTooltipDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  trendTooltipConcern: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "600",
    opacity: 0.9,
  },
  trendSummary: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 14,
    padding: 12,
    backgroundColor: "#FAF8FE",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: DETAIL_COLORS.border,
  },
  trendSummaryCell: {
    flexGrow: 1,
    flexBasis: "45%",
    minWidth: 110,
  },
  trendSummaryLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: DETAIL_COLORS.textFaint,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  trendSummaryValue: {
    fontSize: 14,
    fontWeight: "800",
    color: DETAIL_COLORS.text,
    marginTop: 3,
  },
  trendSummaryStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 3,
  },
  trendSummaryStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  emptyMoodEmoji: {
    fontSize: 40,
  },
  emptyMoodsContainer: {
    alignItems: "center",
    paddingVertical: 24,
  },
  emptyMoodsText: {
    fontSize: 15,
    color: DETAIL_COLORS.textMuted,
    fontWeight: "700",
    marginTop: 8,
  },
  emptyMoodsSubtext: {
    fontSize: 12,
    color: DETAIL_COLORS.textFaint,
    marginTop: 4,
    textAlign: "center",
  },
  barGraphContainer: {
    gap: 10,
  },
  barRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  barLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    width: 90,
    gap: 4,
  },
  moodEmojiSmall: {
    fontSize: 16,
  },
  barLabel: {
    fontSize: 12,
    color: DETAIL_COLORS.textMuted,
    fontWeight: "600",
  },
  barTrack: {
    flex: 1,
    height: 22,
    backgroundColor: "#F6F3FC",
    borderRadius: 11,
    overflow: "hidden",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: DETAIL_COLORS.border,
  },
  barFill: {
    height: "100%",
    borderRadius: 11,
    minWidth: 8,
  },
  barCount: {
    fontSize: 13,
    fontWeight: "800",
    color: DETAIL_COLORS.text,
    width: 28,
    textAlign: "right",
  },
  moodChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 14,
  },
  moodChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: DETAIL_COLORS.purpleSoft,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  moodChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: DETAIL_COLORS.purple,
  },
  totalMoodsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F3F0FB",
    gap: 6,
  },
  totalMoodsText: {
    fontSize: 13,
    color: DETAIL_COLORS.textMuted,
    fontWeight: "600",
  },
  journeyRow: {
    flexDirection: "row",
    gap: 12,
  },
  journeyStep: {
    flex: 1,
    alignItems: "center",
  },
  journeyStepTop: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    marginBottom: 10,
  },
  journeyDot: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F1EDFB",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: DETAIL_COLORS.border,
  },
  journeyDotDone: {
    backgroundColor: DETAIL_COLORS.purpleSoft,
    borderColor: DETAIL_COLORS.purple,
  },
  journeyEmoji: {
    fontSize: 18,
  },
  journeyConnector: {
    flex: 1,
    height: 2,
    backgroundColor: "#EFEAFA",
    marginHorizontal: 6,
  },
  journeyConnectorDone: {
    backgroundColor: DETAIL_COLORS.purple,
  },
  journeyTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: DETAIL_COLORS.text,
    textAlign: "center",
  },
  journeyDesc: {
    fontSize: 10,
    color: DETAIL_COLORS.textMuted,
    textAlign: "center",
    marginTop: 2,
    lineHeight: 13,
  },
  journeyCheck: {
    fontSize: 10,
    fontWeight: "800",
    color: DETAIL_COLORS.textFaint,
    marginTop: 6,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  journeyCheckDone: {
    color: "#0E9F6E",
  },
  journeyNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F3F0FB",
  },
  journeyNoteText: {
    flex: 1,
    fontSize: 12,
    color: DETAIL_COLORS.textMuted,
    fontWeight: "600",
  },
  activityRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F0FB",
  },
  activityIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: DETAIL_COLORS.purpleSoft,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  activityLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: DETAIL_COLORS.text,
  },
  activityTime: {
    fontSize: 12,
    fontWeight: "600",
    color: DETAIL_COLORS.textMuted,
  },
});
