import { db } from "@/constants/firebase";
import {
    collection,
    doc,
    getDocs,
    Timestamp,
    writeBatch,
} from "firebase/firestore";
import { JournalEntry, journalService } from "./journalService";

const syncJournals = async (userId: string): Promise<void> => {
  console.log("Starting journal sync...");
  let localEntries = await journalService.getJournalEntries(userId);

  // 1. Upload pending entries to Firestore
  const entriesToUpload = localEntries.filter(
    (entry) => entry.syncStatus === "pending",
  );

  if (entriesToUpload.length > 0) {
    console.log(`Uploading ${entriesToUpload.length} pending entries...`);
    const batch = writeBatch(db);

    for (const entry of entriesToUpload) {
      // Mark as 'syncing' locally
      entry.syncStatus = "syncing";
      await journalService.updateJournalEntry(userId, entry);

      const { id, userId: localUserId, syncStatus, ...firestoreData } = entry;
      const docRef = doc(
        collection(db, "users", userId, "journalEntries"),
        entry.firestoreId || entry.id, // Use firestoreId if it exists (for updates)
      );

      batch.set(docRef, {
        ...firestoreData,
        // Convert date strings back to Timestamps for Firestore
        createdAt: Timestamp.fromDate(new Date(entry.createdAt)),
        updatedAt: Timestamp.fromDate(new Date(entry.updatedAt)), // Use client timestamp for consistent conflict resolution
        entryDate: Timestamp.fromDate(new Date(entry.entryDate)),
      });
    }

    try {
      await batch.commit();
      // On successful upload, mark entries as 'synced'
      for (const entry of entriesToUpload) {
        entry.syncStatus = "synced";
        // Use the local ID as the firestoreId if it wasn't an update
        if (!entry.firestoreId) {
          entry.firestoreId = entry.id;
        }
        await journalService.updateJournalEntry(userId, entry);
      }
      console.log("Upload successful.");
    } catch (error) {
      console.error("Firestore batch write failed:", error);
      // On failure, mark entries as 'failed'
      for (const entry of entriesToUpload) {
        entry.syncStatus = "failed";
        await journalService.updateJournalEntry(userId, entry);
      }
      throw error; // Propagate error to be caught by the hook
    }
  }

  // 2. Download new/updated entries from Firestore
  console.log("Checking for new entries from server...");
  const remoteEntriesQuery = collection(db, "users", userId, "journalEntries");
  const remoteSnapshot = await getDocs(remoteEntriesQuery);
  localEntries = await journalService.getJournalEntries(userId); // Re-fetch local entries

  const localEntriesMap = new Map(
    localEntries.map((e) => [e.firestoreId || e.id, e]),
  );
  const entriesToUpdateLocally: JournalEntry[] = [];

  for (const remoteDoc of remoteSnapshot.docs) {
    const remoteEntryData = remoteDoc.data() as any;
    const remoteUpdatedAt = (remoteEntryData.updatedAt as Timestamp)?.toDate();
    if (!remoteUpdatedAt) continue; // Skip entries without a valid update timestamp

    const localEntry = localEntriesMap.get(remoteDoc.id);

    if (!localEntry) {
      // This entry exists on the server but not locally, so add it.
      const newLocalEntry: JournalEntry = {
        id: remoteDoc.id, // Use Firestore ID as local ID
        firestoreId: remoteDoc.id,
        userId,
        title: remoteEntryData.title || "Untitled",
        thoughts: remoteEntryData.thoughts || "",
        mood: remoteEntryData.mood || "neutral",
        category: remoteEntryData.category || "general",
        createdAt: (remoteEntryData.createdAt as Timestamp)
          .toDate()
          .toISOString(),
        updatedAt: remoteUpdatedAt.toISOString(),
        entryDate: (remoteEntryData.entryDate as Timestamp)
          .toDate()
          .toISOString(),
        syncStatus: "synced",
      };
      entriesToUpdateLocally.push(newLocalEntry);
    } else {
      // Entry exists locally, check for conflict.
      const localUpdatedAt = new Date(localEntry.updatedAt);

      // If remote is newer and local is not pending sync, update local.
      if (
        remoteUpdatedAt > localUpdatedAt &&
        localEntry.syncStatus !== "pending"
      ) {
        localEntry.title = remoteEntryData.title;
        localEntry.thoughts = remoteEntryData.thoughts;
        localEntry.mood = remoteEntryData.mood;
        localEntry.category = remoteEntryData.category;
        localEntry.updatedAt = remoteUpdatedAt.toISOString();
        localEntry.syncStatus = "synced";
        entriesToUpdateLocally.push(localEntry);
      }
    }
  }

  if (entriesToUpdateLocally.length > 0) {
    console.log(
      `Downloading ${entriesToUpdateLocally.length} new/updated entries...`,
    );
    for (const entry of entriesToUpdateLocally) {
      await journalService.updateJournalEntry(userId, entry);
    }
  }
  console.log("Sync finished.");
};

export const syncService = {
  syncJournals,
};
