import { db } from "@/constants/firebase";
import { collection, getDocs, onSnapshot } from "firebase/firestore";

// --- TYPE DEFINITIONS ---
type RiskLevel = "low" | "normal" | "high";

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
            department: userData.department || "Unspecified",
            assessmentsCount: assessmentSnap.size,
            journalCount: journalSnap.size,
            latestJournalMood,
            moodCounts,
            isLSN: userData.isLSN || false,
          };

          let latestAssessment: AssessmentRecord | undefined;
          assessmentSnap.docs.forEach((aDoc) => {
            const aData = aDoc.data();
            const createdAt = aData.createdAt?.toDate
              ? aData.createdAt.toDate()
              : new Date();

            const assessmentRecord: AssessmentRecord = {
              id: aDoc.id,
              uid,
              riskLevel: (aData.riskLevel as RiskLevel) || "low",
              totalScore: aData.totalScore || 0,
              createdAt,
              department: userData.department || "Unspecified",
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

        const processedData = processAnalytics(allAssessments);

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
