import { db } from "@/constants/firebase";
import {
    collection,
    doc,
    getDocs,
    serverTimestamp,
    Timestamp,
    writeBatch,
} from "firebase/firestore";
import { JournalEntry, journalService } from "./journalService";
import { constellationService } from "./constellationService";

const syncJournals = async (userId: string): Promise<void> => {
  let localEntries = await journalService.getJournalEntries(userId);

  // 1. Upload pending entries to Firestore
  const entriesToUpload = localEntries.filter(
    (entry) => entry.syncStatus === "pending",
  );

  if (entriesToUpload.length > 0) {
    const batch = writeBatch(db);

    for (const entry of entriesToUpload) {
      entry.syncStatus = "syncing";
      await journalService.updateJournalEntry(userId, entry);

      const { id, userId: localUserId, syncStatus, ...firestoreData } = entry;
      const docRef = doc(
        collection(db, "users", userId, "journalEntries"),
        entry.firestoreId || entry.id,
      );

      batch.set(docRef, {
        ...firestoreData,
        createdAt: Timestamp.fromDate(new Date(entry.createdAt)),
        updatedAt: Timestamp.fromDate(new Date(entry.updatedAt)),
        entryDate: Timestamp.fromDate(new Date(entry.entryDate)),
      });
    }

    const userRef = doc(db, "users", userId);
    batch.update(userRef, { lastJournalSyncAt: serverTimestamp() });

    try {
      await batch.commit();
      for (const entry of entriesToUpload) {
        entry.syncStatus = "synced";
        if (!entry.firestoreId) {
          entry.firestoreId = entry.id;
        }
        await journalService.updateJournalEntry(userId, entry);
      }
    } catch (error) {
      for (const entry of entriesToUpload) {
        entry.syncStatus = "failed";
        await journalService.updateJournalEntry(userId, entry);
      }
      throw error;
    }
  }

  // 2. Download new/updated entries from Firestore (best-effort)
  try {
    const remoteEntriesQuery = collection(db, "users", userId, "journalEntries");
    const remoteSnapshot = await getDocs(remoteEntriesQuery);
    localEntries = await journalService.getJournalEntries(userId);

    const localEntriesMap = new Map(
      localEntries.map((e) => [e.firestoreId || e.id, e]),
    );
    const entriesToUpdateLocally: JournalEntry[] = [];

    for (const remoteDoc of remoteSnapshot.docs) {
      const remoteEntryData = remoteDoc.data() as any;
      const remoteUpdatedAt = (remoteEntryData.updatedAt as Timestamp)?.toDate();
      if (!remoteUpdatedAt) continue;

      const localEntry = localEntriesMap.get(remoteDoc.id);

      if (!localEntry) {
        const newLocalEntry: JournalEntry = {
          id: remoteDoc.id,
          firestoreId: remoteDoc.id,
          userId,
          title: remoteEntryData.title || "Untitled",
          thoughts: remoteEntryData.thoughts || "",
          mood: remoteEntryData.mood || "neutral",
          category: remoteEntryData.category || "general",
          customCategory: remoteEntryData.customCategory || undefined,
          reflection:
            remoteEntryData.reflection ||
            remoteEntryData.aiInsight ||
            undefined,
          reflectionLocal: remoteEntryData.reflectionLocal || undefined,
          reflectionAI: remoteEntryData.reflectionAI || undefined,
          reflectionStatus:
            remoteEntryData.reflectionStatus || remoteEntryData.reflectionSource || undefined,
          reflectionSource: remoteEntryData.reflectionSource || undefined,
          generatedAt: remoteEntryData.generatedAt || undefined,
          wellnessTips: remoteEntryData.wellnessTips || undefined,
          riskLevel: remoteEntryData.riskLevel || undefined,
          riskScore: remoteEntryData.riskScore || undefined,
          riskDetected: remoteEntryData.riskDetected || undefined,
          riskKeywords: remoteEntryData.riskKeywords || undefined,
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
        const localUpdatedAt = new Date(localEntry.updatedAt);

        if (
          remoteUpdatedAt > localUpdatedAt &&
          localEntry.syncStatus !== "pending"
        ) {
          localEntry.title = remoteEntryData.title;
          localEntry.thoughts = remoteEntryData.thoughts;
          localEntry.mood = remoteEntryData.mood;
          localEntry.category = remoteEntryData.category;
          localEntry.customCategory =
            remoteEntryData.customCategory || localEntry.customCategory;
          localEntry.reflection =
            remoteEntryData.reflection ||
            remoteEntryData.aiInsight ||
            localEntry.reflection;
          localEntry.reflectionLocal =
            remoteEntryData.reflectionLocal || localEntry.reflectionLocal;
          localEntry.reflectionAI =
            remoteEntryData.reflectionAI || localEntry.reflectionAI;
          localEntry.reflectionStatus =
            remoteEntryData.reflectionStatus ||
            remoteEntryData.reflectionSource ||
            localEntry.reflectionStatus;
          localEntry.reflectionSource =
            remoteEntryData.reflectionSource || localEntry.reflectionSource;
          localEntry.generatedAt =
            remoteEntryData.generatedAt || localEntry.generatedAt;
          localEntry.wellnessTips =
            remoteEntryData.wellnessTips || localEntry.wellnessTips;
          localEntry.riskLevel = remoteEntryData.riskLevel || localEntry.riskLevel;
          localEntry.riskScore = remoteEntryData.riskScore ?? localEntry.riskScore;
          localEntry.riskDetected =
            remoteEntryData.riskDetected ?? localEntry.riskDetected;
          localEntry.riskKeywords =
            remoteEntryData.riskKeywords || localEntry.riskKeywords;
          localEntry.updatedAt = remoteUpdatedAt.toISOString();
          localEntry.syncStatus = "synced";
          entriesToUpdateLocally.push(localEntry);
        }
      }
    }

    if (entriesToUpdateLocally.length > 0) {
      for (const entry of entriesToUpdateLocally) {
        await journalService.updateJournalEntry(userId, entry);
      }
    }
  } catch (error) {
    // Download step failed (e.g., offline drop) — upload already succeeded
    console.warn("Failed to download remote entries:", error);
  }

  // 3. Sync the student's constellation stars (additive — a star failure must
  //    never break the journal sync or the journal flow).
  try {
    await constellationService.syncConstellationStars(userId);
  } catch (error) {
    console.warn("Failed to sync constellation stars:", error);
  }
};

export const syncService = {
  syncJournals,
};
