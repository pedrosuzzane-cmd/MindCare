import { auth } from "@/constants/firebase";
import { useNetwork } from "@/contexts/NetworkContext";
import { ConstellationStar } from "@/types/constellation";
import { constellationService } from "@/services/constellationService";
import { constellationStorage } from "@/storage/constellationStorage";
import { onAuthStateChanged } from "firebase/auth";
import { useCallback, useEffect, useRef, useState } from "react";

export function useConstellation() {
  const [stars, setStars] = useState<ConstellationStar[]>([]);
  const [loading, setLoading] = useState(true);
  const { isConnected } = useNetwork();
  const isSyncing = useRef(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        setStars([]);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const loadStars = useCallback(async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    setLoading(true);
    try {
      const stored = await constellationStorage.getStars(uid);
      setStars(stored);
    } catch (error) {
      console.error("Failed to load constellation stars:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStars();
  }, [loadStars]);

  const sync = useCallback(async () => {
    const uid = auth.currentUser?.uid;
    if (!uid || !isConnected || isSyncing.current) return;
    isSyncing.current = true;
    try {
      await constellationService.syncConstellationStars(uid);
      await loadStars();
    } catch (error) {
      console.warn("Constellation sync failed:", error);
    } finally {
      isSyncing.current = false;
    }
  }, [isConnected, loadStars]);

  // Attempt to sync when connectivity is restored.
  useEffect(() => {
    if (isConnected === true) {
      sync();
    }
  }, [isConnected, sync]);

  const addStarForJournal = useCallback(
    async (journal: Parameters<typeof constellationService.createStarForJournal>[1]) => {
      const uid = auth.currentUser?.uid;
      if (!uid) return null;
      const star = await constellationService.createStarForJournal(uid, journal);
      if (star) {
        setStars((prev) => [...prev, star]);
      }
      return star;
    },
    [],
  );

  const addAchievementStar = useCallback(
    async (achievement: Parameters<typeof constellationService.createAchievementStar>[1]) => {
      const uid = auth.currentUser?.uid;
      if (!uid) return null;
      const star = await constellationService.createAchievementStar(uid, achievement);
      if (star) {
        setStars((prev) => [...prev, star]);
      }
      return star;
    },
    [],
  );

  const addMilestoneStar = useCallback(
    async (milestone: Parameters<typeof constellationService.createMilestoneStar>[1]) => {
      const uid = auth.currentUser?.uid;
      if (!uid) return null;
      const star = await constellationService.createMilestoneStar(uid, milestone);
      if (star) {
        setStars((prev) => [...prev, star]);
      }
      return star;
    },
    [],
  );

  return {
    stars,
    loading,
    addStarForJournal,
    addAchievementStar,
    addMilestoneStar,
    sync,
    loadStars,
  };
}
