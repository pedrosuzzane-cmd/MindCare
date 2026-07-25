import { db } from "@/constants/firebase";
import { collection, doc, getDoc, getDocs, setDoc } from "firebase/firestore";
import { defaultReminderState, ReminderState } from "../hooks/reminderDefaults";

/**
 * This script migrates all users' reminder settings to the latest schema.
 * It reads each user's reminder document, merges it with the default state
 * to add any missing fields, and then writes it back.
 *
 * To run this script, you can use a tool like ts-node:
 * `npx ts-node -r tsconfig-paths/register ./scripts/migrateReminderSettings.ts`
 */
async function migrateReminderSettings() {
  console.log("Starting reminder settings migration...");
  const usersSnapshot = await getDocs(collection(db, "users"));
  const defaults = defaultReminderState();
  let migratedCount = 0;

  for (const userDoc of usersSnapshot.docs) {
    const userId = userDoc.id;
    const settingsDocRef = doc(db, "users", userId, "settings", "reminders");
    const settingsSnap = await getDoc(settingsDocRef);

    if (settingsSnap.exists()) {
      const existingData = settingsSnap.data() as Partial<ReminderState>;
      const merged = { ...defaults };

      // Deep merge each reminder type
      for (const key in defaults) {
        const k = key as keyof ReminderState;
        merged[k] = { ...defaults[k], ...(existingData[k] || {}) } as any;
      }

      await setDoc(settingsDocRef, merged, { merge: true });
      console.log(`Migrated settings for user ${userId}`);
      migratedCount++;
    }
  }

  console.log(`\nMigration completed. Migrated ${migratedCount} user(s).`);
}

migrateReminderSettings().catch(console.error);
