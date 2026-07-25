import { auth } from "@/constants/firebase";
import { useNetwork } from "@/contexts/NetworkContext";
import {
  JournalEntry,
  journalService,
  SyncStatus,
} from "@/services/journalService";
import { syncService } from "@/services/syncService";
import { onAuthStateChanged, User } from "firebase/auth";
import { useCallback, useEffect, useRef, useState } from "react";

export function useJournal() {
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
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

  // Initial load of local entries
  useEffect(() => {
    loadLocalEntries();
  }, [loadLocalEntries]);

  // Define triggerSync before any useEffect that references it
  const triggerSync = useCallback(async () => {
    if (isConnected && user && !isSyncing.current) {
      isSyncing.current = true;
      setSyncing(true);
      try {
        await syncService.syncJournals(user.uid);
        await loadLocalEntries();
      } catch (error) {
        console.error("Sync failed:", error);
      } finally {
        setSyncing(false);
        isSyncing.current = false;
      }
    }
  }, [isConnected, user, loadLocalEntries]);

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
    // Optimistically update the UI
    setEntries((prev) =>
      [newEntry, ...prev].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    );
    triggerSync(); // Attempt to sync immediately after adding
    return newEntry;
  };

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
    addJournalEntry,
    getJournalEntry,
    getMoodEmoji,
    getSyncStatusLabel,
    manualSync: triggerSync,
  };
}
