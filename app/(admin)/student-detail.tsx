import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Linking,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

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

export default function StudentDetailScreen() {
  const { uid } = useLocalSearchParams<{ uid: string }>();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [moodCounts, setMoodCounts] = useState<Record<string, number>>({});
  const [assessments, setAssessments] = useState<AssessmentRecord[]>([]);

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

  const maxCount = Math.max(...Object.values(moodCounts), 1);
  const screenWidth = Dimensions.get("window").width;
  const barMaxWidth = screenWidth * 0.45;

  const profileFields: { key: keyof ProfileData; label: string; icon: any }[] =
    [
      { key: "fullName", label: "Full Name", icon: "person-outline" },
      { key: "email", label: "Email", icon: "mail-outline" },
      { key: "schoolId", label: "School ID", icon: "card-outline" },
      { key: "department", label: "Department", icon: "school-outline" },
      {
        key: "academicProgram",
        label: "Academic Program",
        icon: "book-outline",
      },
      { key: "yearLevel", label: "Year Level", icon: "library-outline" },
      { key: "nationality", label: "Nationality", icon: "flag-outline" },
      {
        key: "religiousAffiliation",
        label: "Religious Affiliation",
        icon: "book-outline",
      },
      {
        key: "culturalAffiliation",
        label: "Cultural Affiliation",
        icon: "globe-outline",
      },
      { key: "contactNo", label: "Contact No.", icon: "call-outline" },
      { key: "civilStatus", label: "Civil Status", icon: "people-outline" },
      { key: "citizenship", label: "Citizenship", icon: "document-outline" },
      {
        key: "genderIdentity",
        label: "Gender Identity",
        icon: "person-circle-outline",
      },
      {
        key: "provincialAddress",
        label: "Provincial Address",
        icon: "location-outline",
      },
    ];

  const handleOpenDocument = (url?: string) => {
    if (url) {
      Linking.openURL(url).catch((err) =>
        console.error("Failed to open document URL:", err),
      );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.mainLayout}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color="#0F172A" />
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
            {/* Profile Card */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.avatarCircle}>
                  <Text style={styles.avatarText}>
                    {(profile.fullName || "?").charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.nameBlock}>
                  <Text style={styles.studentName}>{profile.fullName}</Text>
                  <Text style={styles.studentIdLabel}>
                    {profile.schoolId || "N/A"}
                  </Text>
                </View>
              </View>
            </View>

            {/* Registration Information Card */}
            <View style={styles.card}>
              <View style={styles.sectionHeaderRow}>
                <Ionicons
                  name="document-text-outline"
                  size={20}
                  color="#6366F1"
                />
                <Text style={styles.sectionTitle}>
                  Registration Information
                </Text>
              </View>
              <View style={styles.divider} />
              {profileFields.map((field) => {
                const value = profile[field.key];
                const displayValue =
                  value && typeof value === "string" && value.trim()
                    ? value.trim()
                    : "—";
                return (
                  <View key={field.key} style={styles.infoRow}>
                    <View style={styles.infoLabelRow}>
                      <Ionicons
                        name={field.icon as any}
                        size={16}
                        color="#64748B"
                      />
                      <Text style={styles.infoLabel}>{field.label}</Text>
                    </View>
                    <Text style={styles.infoValue} numberOfLines={3}>
                      {displayValue}
                    </Text>
                  </View>
                );
              })}

              {/* LSN / Special Needs Attached Document Section */}
              <View style={styles.lsnSectionBlock}>
                <View style={styles.infoLabelRow}>
                  <Ionicons name="body-outline" size={16} color="#7C3AED" />
                  <Text style={styles.infoLabel}>
                    Learner with Special Needs (LSN)
                  </Text>
                </View>
                <Text style={styles.infoValue}>
                  {profile.isLSN ? "Yes" : "No"}
                </Text>
              </View>

              {profile.isLSN && (
                <>
                  <View style={styles.infoRow}>
                    <View style={styles.infoLabelRow}>
                      <Ionicons
                        name="information-circle-outline"
                        size={16}
                        color="#64748B"
                      />
                      <Text style={styles.infoLabel}>Special Need Type</Text>
                    </View>
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

            {/* Assessment 14-Day Trend Graph Card */}
            <View style={styles.card}>
              <View style={styles.sectionHeaderRow}>
                <Ionicons
                  name="trending-up-outline"
                  size={20}
                  color="#6366F1"
                />
                <Text style={styles.sectionTitle}>
                  Assessment Trend (14-Day Intervals)
                </Text>
              </View>
              <View style={styles.divider} />

              {assessments.length === 0 ? (
                <View style={styles.emptyMoodsContainer}>
                  <Ionicons
                    name="clipboard-outline"
                    size={36}
                    color="#94A3B8"
                  />
                  <Text style={styles.emptyMoodsText}>
                    No assessments taken yet.
                  </Text>
                  <Text style={styles.emptyMoodsSubtext}>
                    Assessment scores will appear once the student completes the
                    self-assessment.
                  </Text>
                </View>
              ) : (
                <>
                  {(() => {
                    const buckets: {
                      label: string;
                      scores: number[];
                      riskLevels: string[];
                    }[] = [];
                    if (assessments.length === 0) return null;

                    const firstDate = assessments[0].createdAt;
                    const lastDate =
                      assessments[assessments.length - 1].createdAt;
                    const bucketStart = new Date(firstDate);
                    const bucketEnd = new Date(bucketStart);
                    bucketEnd.setDate(bucketEnd.getDate() + 13);

                    let currentBucket: {
                      label: string;
                      scores: number[];
                      riskLevels: string[];
                    } | null = null;

                    for (const a of assessments) {
                      while (a.createdAt > bucketEnd) {
                        if (currentBucket) buckets.push(currentBucket);
                        bucketStart.setDate(bucketStart.getDate() + 14);
                        bucketEnd.setDate(bucketEnd.getDate() + 14);
                        currentBucket = null;
                      }
                      if (!currentBucket) {
                        currentBucket = {
                          label: `${bucketStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
                          scores: [],
                          riskLevels: [],
                        };
                      }
                      currentBucket.scores.push(a.totalScore);
                      currentBucket.riskLevels.push(a.riskLevel);
                    }
                    if (currentBucket) buckets.push(currentBucket);

                    return (
                      <>
                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          style={styles.assessmentScroll}
                        >
                          {buckets.map((bucket, idx) => {
                            const avgScore = Math.round(
                              bucket.scores.reduce((s, v) => s + v, 0) /
                                bucket.scores.length,
                            );
                            const barHeight = Math.max(
                              (avgScore / 80) * 120,
                              4,
                            );
                            const riskColor =
                              avgScore >= 51
                                ? "#EF4444"
                                : avgScore >= 21
                                  ? "#F59E0B"
                                  : "#22C55E";

                            return (
                              <View key={idx} style={styles.assessmentBarCol}>
                                <View style={styles.assessmentBarTrack}>
                                  <View
                                    style={[
                                      styles.assessmentBarFill,
                                      {
                                        height: barHeight,
                                        backgroundColor: riskColor,
                                      },
                                    ]}
                                  />
                                </View>
                                <Text style={styles.assessmentScoreText}>
                                  {avgScore}
                                </Text>
                                <Text style={styles.assessmentDateLabel}>
                                  {bucket.label}
                                </Text>
                                <Text
                                  style={[
                                    styles.assessmentRiskBadge,
                                    {
                                      color: riskColor,
                                      backgroundColor: riskColor + "20",
                                    },
                                  ]}
                                >
                                  {avgScore >= 51
                                    ? "HIGH"
                                    : avgScore >= 21
                                      ? "MOD"
                                      : "LOW"}
                                </Text>
                              </View>
                            );
                          })}
                        </ScrollView>

                        {/* Legend */}
                        <View style={styles.assessmentLegend}>
                          <View style={styles.legendItem}>
                            <View
                              style={[
                                styles.legendDot,
                                { backgroundColor: "#22C55E" },
                              ]}
                            />
                            <Text style={styles.legendLabel}>Low (0-20)</Text>
                          </View>
                          <View style={styles.legendItem}>
                            <View
                              style={[
                                styles.legendDot,
                                { backgroundColor: "#F59E0B" },
                              ]}
                            />
                            <Text style={styles.legendLabel}>
                              Moderate (21-50)
                            </Text>
                          </View>
                          <View style={styles.legendItem}>
                            <View
                              style={[
                                styles.legendDot,
                                { backgroundColor: "#EF4444" },
                              ]}
                            />
                            <Text style={styles.legendLabel}>High (51-80)</Text>
                          </View>
                        </View>

                        <View style={styles.totalMoodsRow}>
                          <Ionicons
                            name="clipboard-outline"
                            size={16}
                            color="#64748B"
                          />
                          <Text style={styles.totalMoodsText}>
                            {assessments.length} assessment
                            {assessments.length !== 1 ? "s" : ""} total
                          </Text>
                        </View>
                      </>
                    );
                  })()}
                </>
              )}
            </View>

            {/* Mood Bar Graph Card */}
            <View style={styles.card}>
              <View style={styles.sectionHeaderRow}>
                <Ionicons name="bar-chart-outline" size={20} color="#6366F1" />
                <Text style={styles.sectionTitle}>Mood Journal Analytics</Text>
              </View>
              <View style={styles.divider} />

              {Object.keys(moodCounts).length === 0 ? (
                <View style={styles.emptyMoodsContainer}>
                  <Ionicons name="moon-outline" size={36} color="#94A3B8" />
                  <Text style={styles.emptyMoodsText}>
                    No journal entries yet.
                  </Text>
                  <Text style={styles.emptyMoodsSubtext}>
                    Mood data will appear once the student starts journaling.
                  </Text>
                </View>
              ) : (
                <>
                  <View style={styles.barGraphContainer}>
                    {Object.entries(MOOD_LABELS).map(([moodId, label]) => {
                      const count = moodCounts[moodId] || 0;
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
                            <Text style={styles.barLabel}>{label}</Text>
                          </View>
                          <View style={styles.barTrack}>
                            <View
                              style={[
                                styles.barFill,
                                {
                                  width: barWidth,
                                  backgroundColor: color,
                                },
                              ]}
                            />
                          </View>
                          <Text style={styles.barCount}>{count}</Text>
                        </View>
                      );
                    })}
                  </View>

                  <View style={styles.totalMoodsRow}>
                    <Ionicons
                      name="journal-outline"
                      size={16}
                      color="#64748B"
                    />
                    <Text style={styles.totalMoodsText}>
                      {journalEntries.length} total journal
                      {journalEntries.length !== 1 ? " entries" : " entry"}
                    </Text>
                  </View>

                  <View style={styles.legendContainer}>
                    {Object.entries(MOOD_COLORS).map(([moodId, color]) => {
                      if (!moodCounts[moodId]) return null;
                      return (
                        <View key={moodId} style={styles.legendItem}>
                          <View
                            style={[
                              styles.legendDot,
                              { backgroundColor: color },
                            ]}
                          />
                          <Text style={styles.legendLabel}>
                            {MOOD_LABELS[moodId] || moodId}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </>
              )}
            </View>
          </ScrollView>
        )}
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
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    color: "#0F172A",
    fontSize: 18,
    fontWeight: "800",
    flex: 1,
    textAlign: "center",
    marginHorizontal: 8,
  },
  headerSpacer: { width: 38 },
  scrollContent: { padding: 24, paddingBottom: 40 },
  stateCard: {
    backgroundColor: "#FFFFFF",
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
    color: "#334155",
    fontSize: 14,
    textAlign: "center",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    // @ts-ignore - web only
    boxShadow: "0px 6px 20px rgba(0, 0, 0, 0.04)",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#6366F1",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  avatarText: {
    color: "white",
    fontSize: 24,
    fontWeight: "800",
  },
  nameBlock: {
    flex: 1,
  },
  studentName: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0F172A",
  },
  studentIdLabel: {
    fontSize: 14,
    color: "#6366F1",
    fontWeight: "700",
    marginTop: 2,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
    marginLeft: 8,
  },
  divider: {
    height: 1,
    backgroundColor: "#F1F5F9",
    marginBottom: 14,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F8FAFC",
  },
  lsnSectionBlock: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F8FAFC",
  },
  infoLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    paddingRight: 8,
  },
  infoLabel: {
    fontSize: 13,
    color: "#64748B",
    fontWeight: "600",
    marginLeft: 6,
  },
  infoValue: {
    fontSize: 13,
    color: "#0F172A",
    fontWeight: "700",
    flex: 1,
    textAlign: "right",
  },
  documentCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  docTitle: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748B",
  },
  docName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A",
  },
  viewDocButton: {
    backgroundColor: "#7C3AED",
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
    color: "#94A3B8",
  },
  emptyMoodsContainer: {
    alignItems: "center",
    paddingVertical: 24,
  },
  emptyMoodsText: {
    fontSize: 15,
    color: "#64748B",
    fontWeight: "700",
    marginTop: 8,
  },
  emptyMoodsSubtext: {
    fontSize: 12,
    color: "#94A3B8",
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
    color: "#475569",
    fontWeight: "600",
  },
  barTrack: {
    flex: 1,
    height: 22,
    backgroundColor: "#F8FAFC",
    borderRadius: 11,
    overflow: "hidden",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  barFill: {
    height: "100%",
    borderRadius: 11,
    minWidth: 8,
  },
  barCount: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0F172A",
    width: 28,
    textAlign: "right",
  },
  totalMoodsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F8FAFC",
    gap: 6,
  },
  totalMoodsText: {
    fontSize: 13,
    color: "#64748B",
    fontWeight: "600",
  },
  legendContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
    justifyContent: "center",
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendLabel: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "600",
  },
  assessmentScroll: {
    marginBottom: 8,
  },
  assessmentBarCol: {
    alignItems: "center",
    marginRight: 16,
    width: 72,
  },
  assessmentBarTrack: {
    width: 40,
    height: 130,
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    overflow: "hidden",
    justifyContent: "flex-end",
    marginBottom: 6,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  assessmentBarFill: {
    width: "100%",
    borderRadius: 12,
  },
  assessmentScoreText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
  },
  assessmentDateLabel: {
    fontSize: 10,
    color: "#64748B",
    fontWeight: "600",
    marginTop: 2,
    textAlign: "center",
  },
  assessmentRiskBadge: {
    fontSize: 9,
    fontWeight: "800",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: "hidden",
    marginTop: 2,
    textAlign: "center",
  },
  assessmentLegend: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 8,
    justifyContent: "center",
  },
});
