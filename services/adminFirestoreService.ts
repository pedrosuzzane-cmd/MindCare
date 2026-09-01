import { db } from "@/constants/firebase";
import { collection, getDocs, onSnapshot, query, orderBy } from "firebase/firestore";
import { ASSESSMENT_INTERVAL_DAYS, bucketAssessments, riskFromScore } from "@/utils/assessmentTrend";
import { getDepartmentCode } from "@/utils/departmentMeta";
import {
  DEFAULT_LIFECYCLE_STATUS,
  DEFAULT_SUPPORT_STATUS,
  type LifecycleStatus,
  type SupportStatus,
} from "@/services/studentTypes";

// --- TYPE DEFINITIONS ---
type RiskLevel = "low" | "normal" | "high";

function toDateOrNull(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "object" && value !== null && "toDate" in value) {
    return (value as { toDate: () => Date }).toDate();
  }
  if (typeof value === "number") return new Date(value);
  return null;
}

export interface AssessmentRecord {
  id: string;
  uid: string;
  riskLevel: RiskLevel;
  totalScore: number;
  createdAt: Date;
  department: string;
  age: string;
  gender: string;
  yearLevel: string;
}

export interface AnalyticsSummary {
  label: string;
  total: number;
  low: number;
  normal: number;
  high: number;
  scoreSum: number;
}

export type AnalyticsCategory = "department" | "age" | "gender" | "yearLevel";

export interface StudentSummary {
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
  // Student lifecycle & support metadata (administrative, non-clinical)
  email?: string;
  status?: LifecycleStatus;
  supportStatus?: SupportStatus;
  supportAssignedTo?: string | null;
  supportAssignedName?: string | null;
  followUpDate?: Date | null;
  supportUpdatedAt?: Date | null;
  updatedAt?: Date | null;
}

export interface AdminDashboardData {
  studentSummaries: StudentSummary[];
  analyticsData: Record<AnalyticsCategory, AnalyticsSummary[]>;
}

/**
 * Sets up a real-time listener for all data required for the admin dashboard.
 * This function is the single source of truth for admin data, satisfying FR-2, FR-3, FR-12, and FR-13.
 *
 * @param onDataUpdate A callback function that receives the processed data whenever it changes.
 * @returns An unsubscribe function to clean up the listener.
 */
export function listenForAdminDashboardData(
  onDataUpdate: (data: AdminDashboardData) => void,
  onError: (error: Error) => void,
) {
  const usersQuery = collection(db, "users");

  const unsubscribe = onSnapshot(
    usersQuery,
    async (usersSnapshot) => {
      try {
        const studentDocs = usersSnapshot.docs.filter(
          (doc) => doc.data().role !== "admin",
        );

        if (studentDocs.length === 0) {
          onDataUpdate({
            studentSummaries: [],
            analyticsData: {
              department: [],
              age: [],
              gender: [],
              yearLevel: [],
            },
          });
          return;
        }

        const subcollectionPromises = studentDocs.map((doc) =>
          Promise.all([
            getDocs(collection(db, "users", doc.id, "selfAssessments")),
            getDocs(collection(db, "users", doc.id, "journalEntries")),
          ]),
        );

        const subcollectionResults = await Promise.all(subcollectionPromises);

        const studentStats = new Map<string, StudentSummary>();
        const allAssessments: AssessmentRecord[] = [];

        studentDocs.forEach((userDoc, index) => {
          const uid = userDoc.id;
          const userData = userDoc.data();
          const [assessmentSnap, journalSnap] = subcollectionResults[index];

          const moodCounts: Record<string, number> = {};
          let latestJournalMood: string | undefined;
          journalSnap.docs.forEach((jDoc) => {
            const jData = jDoc.data();
            const mood = jData.mood || "Unknown";
            moodCounts[mood] = (moodCounts[mood] || 0) + 1;
            if (!latestJournalMood) latestJournalMood = mood;
          });

          const studentSummary: StudentSummary = {
            uid,
            name: userData.fullName || "Unknown Student",
            schoolId: userData.schoolId || "N/A",
            yearLevel: userData.yearLevel || "N/A",
            department: getDepartmentCode(userData.department || "Unspecified"),
            assessmentsCount: assessmentSnap.size,
            journalCount: journalSnap.size,
            latestJournalMood,
            moodCounts,
            isLSN: userData.isLSN || false,
            specialNeedsType: userData.specialNeedsType || "",
            lsnCategory: userData.lsnCategory || "",
            lsnDocument: userData.lsnDocument || null,
            profileImage: userData.profileImage || undefined,
            email: userData.email || undefined,
            status: (userData.status as LifecycleStatus) || DEFAULT_LIFECYCLE_STATUS,
            supportStatus:
              (userData.supportStatus as SupportStatus) || DEFAULT_SUPPORT_STATUS,
            supportAssignedTo: userData.supportAssignedTo ?? null,
            supportAssignedName: userData.supportAssignedName ?? null,
            followUpDate: toDateOrNull(userData.followUpDate),
            supportUpdatedAt: toDateOrNull(userData.supportUpdatedAt),
            updatedAt: toDateOrNull(userData.updatedAt),
          };

          let latestAssessment: AssessmentRecord | undefined;
          assessmentSnap.docs.forEach((aDoc) => {
            const aData = aDoc.data();
            const createdAt = aData.createdAt?.toDate
              ? aData.createdAt.toDate()
              : new Date();

            const assessmentScore = aData.totalScore || 0;
            const storedRisk = (aData.riskLevel as RiskLevel) as RiskLevel | undefined;
            const assessmentRecord: AssessmentRecord = {
              id: aDoc.id,
              uid,
              riskLevel:
                typeof storedRisk === "string" &&
                (storedRisk === "low" ||
                  storedRisk === "normal" ||
                  storedRisk === "high")
                  ? storedRisk
                  : riskFromScore(assessmentScore),
              totalScore: assessmentScore,
              createdAt,
              department: getDepartmentCode(userData.department || "Unspecified"),
              age: userData.age || "Unspecified",
              gender: userData.genderIdentity || "Unspecified",
              yearLevel: userData.yearLevel || "Unspecified",
            };

            allAssessments.push(assessmentRecord);

            if (
              !latestAssessment ||
              createdAt.getTime() > latestAssessment.createdAt.getTime()
            ) {
              latestAssessment = assessmentRecord;
            }
          });

          if (latestAssessment) {
            studentSummary.latestAssessmentDate = latestAssessment.createdAt;
            studentSummary.latestTotalScore = latestAssessment.totalScore;
            studentSummary.latestRiskLevel = latestAssessment.riskLevel;
          }

          studentStats.set(uid, studentSummary);
        });

        const processedData = processAnalytics(
          reduceToIntervalAssessments(allAssessments),
        );

        onDataUpdate({
          studentSummaries: Array.from(studentStats.values()),
          analyticsData: processedData,
        });
      } catch (err) {
        console.error("Error processing snapshot:", err);
        onError(
          err instanceof Error ? err : new Error("Data processing failed"),
        );
      }
    },
    (err) => {
      console.error("Firestore listener error:", err);
      onError(err);
    },
  );

  return unsubscribe;
}

/**
 * Reduces assessment records into one representative record per student per
 * assessment interval (monthly by default). This keeps the department and
 * category analytics consistent with the student detail "Assessment Trend"
 * chart, which shows a single monthly bucket per student, and prevents
 * duplicate submissions within the same interval from inflating totals.
 */
function reduceToIntervalAssessments(
  assessments: AssessmentRecord[],
): AssessmentRecord[] {
  const byStudent = new Map<string, AssessmentRecord[]>();
  for (const a of assessments) {
    const arr = byStudent.get(a.uid) ?? [];
    arr.push(a);
    byStudent.set(a.uid, arr);
  }

  const reduced: AssessmentRecord[] = [];
  for (const records of byStudent.values()) {
    const buckets = bucketAssessments(
      records.map((r) => ({
        createdAt: r.createdAt,
        totalScore: r.totalScore,
        riskLevel: r.riskLevel,
        uid: r.uid,
      })),
      ASSESSMENT_INTERVAL_DAYS,
    );
    for (const bucket of buckets) {
      const representative = records.find(
        (r) => r.createdAt >= bucket.startDate && r.createdAt <= bucket.endDate,
      ) ?? records[0];
      reduced.push({
        id: `${representative.uid}-${bucket.startDate.getTime()}`,
        uid: representative.uid,
        riskLevel: riskFromScore(bucket.avgScore),
        totalScore: bucket.avgScore,
        createdAt: bucket.startDate,
        department: representative.department,
        age: representative.age,
        gender: representative.gender,
        yearLevel: representative.yearLevel,
      });
    }
  }
  return reduced;
}

/**
 * Helper function to compute analytics from a list of assessments.
 */
function processAnalytics(
  allAssessments: AssessmentRecord[],
): Record<AnalyticsCategory, AnalyticsSummary[]> {
  const analyticsBuckets: Record<
    AnalyticsCategory,
    Map<string, AnalyticsSummary>
  > = {
    department: new Map(),
    age: new Map(),
    gender: new Map(),
    yearLevel: new Map(),
  };

  const updateAnalyticsBucket = (
    bucket: Map<string, AnalyticsSummary>,
    label: string,
    riskLevel: RiskLevel,
    score: number,
  ) => {
    if (!label || label === "Unspecified") return; // Do not bucket unspecified data
    const summary = bucket.get(label) || {
      label,
      total: 0,
      low: 0,
      normal: 0,
      high: 0,
      scoreSum: 0,
    };
    summary.total++;
    summary.scoreSum += score;
    if (riskLevel === "low") summary.low++;
    else if (riskLevel === "high") summary.high++;
    else summary.normal++;
    bucket.set(label, summary);
  };

  for (const assessment of allAssessments) {
    updateAnalyticsBucket(
      analyticsBuckets.department,
      assessment.department,
      assessment.riskLevel,
      assessment.totalScore,
    );
    updateAnalyticsBucket(
      analyticsBuckets.age,
      assessment.age,
      assessment.riskLevel,
      assessment.totalScore,
    );
    updateAnalyticsBucket(
      analyticsBuckets.gender,
      assessment.gender,
      assessment.riskLevel,
      assessment.totalScore,
    );
    updateAnalyticsBucket(
      analyticsBuckets.yearLevel,
      assessment.yearLevel,
      assessment.riskLevel,
      assessment.totalScore,
    );
  }

  return {
    department: Array.from(analyticsBuckets.department.values()).sort(
      (a, b) => b.total - a.total,
    ),
    age: Array.from(analyticsBuckets.age.values()),
    gender: Array.from(analyticsBuckets.gender.values()),
    yearLevel: Array.from(analyticsBuckets.yearLevel.values()),
  };
}

/**
 * Fetches all journal entries for a specific student, ordered by createdAt descending.
 * Used by the admin journal detail screen.
 *
 * @param studentId - The Firestore UID of the student
 * @returns An array of journal entry documents with ids
 */
export async function fetchStudentJournals(studentId: string): Promise<JournalEntryDoc[]> {
  try {
    const entriesRef = collection(db, "users", studentId, "journalEntries");
    const q = query(entriesRef, orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as JournalEntryDoc[];
  } catch (error) {
    console.error("fetchStudentJournals error:", error);
    throw error;
  }
}

export interface JournalEntryDoc {
  id: string;
  title?: string;
  thoughts?: string;
  mood?: string;
  category?: string;
  createdAt?: { toDate: () => Date } | string | number;
  entryDate?: string;
  aiInsight?: string;
  aiEmotion?: string;
  aiSummary?: string;
  aiEncouragement?: string;
  aiSuggestions?: string[];
  syncStatus?: string;
}
