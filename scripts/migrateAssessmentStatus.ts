import { db } from "@/constants/firebase";
import {
    collection,
    doc,
    getDocs,
    limit,
    orderBy,
    query,
    updateDoc,
} from "firebase/firestore";

/**
 * This script backfills the `assessmentCompleted` status for all users.
 *
 * It iterates through each user and checks their `selfAssessments` subcollection.
 * - If assessments exist, it marks `assessmentCompleted: true` and adds summary
 *   data from the latest assessment to the user's root document.
 * - If no assessments exist, it marks `assessmentCompleted: false`.
 *
 * This makes querying for assessment status much more efficient.
 *
 * To run this script:
 * `npx ts-node -r tsconfig-paths/register ./scripts/migrateAssessmentStatus.ts`
 */
async function migrateAssessmentStatus() {
  console.log("Starting user assessment status migration...");
  const usersSnapshot = await getDocs(collection(db, "users"));
  let migratedCount = 0;
  let updatedCount = 0;

  for (const userDoc of usersSnapshot.docs) {
    const userId = userDoc.id;
    const assessmentsRef = collection(db, "users", userId, "selfAssessments");
    const latestAssessmentQuery = query(
      assessmentsRef,
      orderBy("createdAt", "desc"),
      limit(1),
    );

    const assessmentSnapshot = await getDocs(latestAssessmentQuery);

    const userDocRef = doc(db, "users", userId);

    if (assessmentSnapshot.empty) {
      // User has no assessments, mark as not completed
      await updateDoc(userDocRef, { assessmentCompleted: false });
      console.log(`Marked ${userId} as not completed.`);
      migratedCount++;
    } else {
      // User has at least one assessment, update with latest data
      const latestAssessment = assessmentSnapshot.docs[0].data();
      await updateDoc(userDocRef, {
        assessmentCompleted: true,
        lastAssessmentDate: latestAssessment.createdAt.toDate(),
        assessmentScore: latestAssessment.totalScore,
        assessmentCategory: latestAssessment.riskLevel,
      });
      console.log(`Updated ${userId} with latest assessment data.`);
      updatedCount++;
    }
  }

  console.log("\nMigration complete.");
  console.log(`- Marked ${migratedCount} user(s) as pending assessment.`);
  console.log(
    `- Updated ${updatedCount} user(s) with existing assessment data.`,
  );
}

migrateAssessmentStatus().catch(console.error);
