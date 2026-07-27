import { auth } from "@/constants/firebase";
import { useNetwork } from "@/contexts/NetworkContext";
import {
  JournalEntry,
  journalService,
  SyncStatus,
} from "@/services/journalService";
import { offlineSyncQueue } from "@/services/offlineSyncQueue";
import { syncService } from "@/services/syncService";
import { onAuthStateChanged, User } from "firebase/auth";
import { useCallback, useEffect, useRef, useState } from "react";

export function useJournal() {
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const { isConnected } = useNetwork();
  const isSyncing = useRef(false);

  // Effect for handling auth changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        setEntries([]);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // Function to load local entries
  const loadLocalEntries = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const localEntries = await journalService.getJournalEntries(user.uid);
      setEntries(localEntries);
    } catch (error) {
      console.error("Failed to load local journal entries:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Refresh queue counts from AsyncStorage
  const refreshQueueCounts = useCallback(async () => {
    const [pending, failed] = await Promise.all([
      offlineSyncQueue.getQueueCount(),
      offlineSyncQueue.getFailedItems(),
    ]);
    setPendingCount(pending);
    setFailedCount(failed.length);
  }, []);

  // Initial load of local entries + queue counts
  useEffect(() => {
    loadLocalEntries();
    refreshQueueCounts();
  }, [loadLocalEntries, refreshQueueCounts]);

  // Define triggerSync before any useEffect that references it
  const triggerSync = useCallback(async () => {
    if (isConnected && user && !isSyncing.current) {
      isSyncing.current = true;
      setSyncing(true);
      try {
        // Process pending queue items
        const pendingItems = await offlineSyncQueue.getPendingItems();
        for (const item of pendingItems) {
          try {
            await syncService.syncJournals(user.uid);
            // On success, remove from queue
            await offlineSyncQueue.dequeue(item.journalId);
          } catch (err: any) {
            // On failure, increment retry count
            const canRetry = await offlineSyncQueue.incrementRetry(
              item.journalId,
              err?.message || "Sync failed",
            );
            if (!canRetry) {
              console.warn(
                `Journal ${item.journalId} exceeded max retries, marking as failed.`,
              );
              // Mark entry as failed in local storage
              const allEntries = await journalService.getJournalEntries(user.uid);
              const entry = allEntries.find((e) => e.id === item.journalId);
              if (entry) {
                entry.syncStatus = "failed";
                await journalService.updateJournalEntry(user.uid, entry);
              }
            }
          }
        }
        await loadLocalEntries();
        await refreshQueueCounts();
      } catch (error) {
        console.error("Sync failed:", error);
      } finally {
        setSyncing(false);
        isSyncing.current = false;
      }
    }
  }, [isConnected, user, loadLocalEntries, refreshQueueCounts]);

  // Effect for triggering sync on connection restore
  useEffect(() => {
    if (isConnected === true) {
      triggerSync();
    }
  }, [isConnected, triggerSync]);

  const addJournalEntry = async (
    entryData: Omit<JournalEntry, "id" | "syncStatus" | "userId">,
  ): Promise<JournalEntry> => {
    if (!user) throw new Error("User not authenticated");
    const newEntry = await journalService.addJournalEntry(user.uid, entryData);

    // Enqueue for sync
    await offlineSyncQueue.enqueue({
      journalId: newEntry.id,
      action: "create",
    });

    // Optimistically update the UI
    setEntries((prev) =>
      [newEntry, ...prev].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    );

    await refreshQueueCounts();
    triggerSync(); // Attempt to sync immediately
    return newEntry;
  };

  const retryFailedSync = useCallback(async () => {
    if (!user) return;
    // Reset retry counts for all failed items so they can be retried
    const failedItems = await offlineSyncQueue.getFailedItems();
    for (const item of failedItems) {
      await offlineSyncQueue.enqueue({
        journalId: item.journalId,
        action: item.action,
      });
    }
    await refreshQueueCounts();
    triggerSync();
  }, [user, refreshQueueCounts, triggerSync]);

  const getJournalEntry = (id: string): JournalEntry | undefined => {
    return entries.find((entry) => entry.id === id);
  };

  const getMoodEmoji = (moodId: string): string => {
    const moodMap: Record<string, string> = {
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
    return moodMap[moodId] || "❓";
  };

  const getSyncStatusLabel = (status: SyncStatus): string => {
    const statusMap: Record<SyncStatus, string> = {
      synced: "Synced",
      pending: "Saved Offline",
      syncing: "Syncing...",
      failed: "Sync Failed",
    };
    return statusMap[status];
  };

  return {
    entries,
    loading,
    syncing,
    pendingCount,
    failedCount,
    addJournalEntry,
    getJournalEntry,
    getMoodEmoji,
    getSyncStatusLabel,
    manualSync: triggerSync,
    retryFailedSync,
  };
}
