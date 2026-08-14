import { db } from "@/constants/firebase";
import { useAuth } from "@/hooks/AuthContext";
import {
  getReadStates,
  listenForAnnouncements,
  markAnnouncementAsRead,
} from "@/services/announcementService";
import type { Announcement } from "@/types/announcement";
import { doc, getDoc } from "firebase/firestore";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

interface AnnouncementsContextValue {
  announcements: Announcement[];
  readMap: Record<string, boolean>;
  unreadCount: number;
  studentDepartment: string | null;
  loading: boolean;
  markRead: (announcementId: string) => void;
}

const AnnouncementsContext = createContext<AnnouncementsContextValue | null>(
  null,
);

export function AnnouncementsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [readMap, setReadMap] = useState<Record<string, boolean>>({});
  const [studentDepartment, setStudentDepartment] = useState<string | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const checkedReadIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    const uid = user?.uid;
    if (!uid) return;
    let cancelled = false;
    getDoc(doc(db, "users", uid)).then((snap) => {
      if (cancelled) return;
      setStudentDepartment(
        snap.exists() ? snap.data().department || null : null,
      );
    });
    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  useEffect(() => {
    if (!user) return;
    const unsub = listenForAnnouncements((data) => {
      setAnnouncements(data);
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!user || announcements.length === 0) return;
    const uid = user.uid;
    const toCheck = announcements.filter(
      (a) => !checkedReadIds.current.has(a.id),
    );
    if (toCheck.length === 0) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    getReadStates(uid, toCheck)
      .then((states) => {
        if (cancelled) return;
        toCheck.forEach((a) => checkedReadIds.current.add(a.id));
        setReadMap((prev) => {
          const next = { ...prev };
          for (const [id, read] of Object.entries(states)) {
            if (!(id in next)) next[id] = read;
          }
          return next;
        });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [announcements, user]);

  const markRead = useCallback(
    (announcementId: string) => {
      if (!user) return;
      const uid = user.uid;
      setReadMap((prev) =>
        prev[announcementId] ? prev : { ...prev, [announcementId]: true },
      );
      markAnnouncementAsRead(announcementId, uid).catch((err) =>
        console.warn("markAnnouncementAsRead error:", err),
      );
    },
    [user],
  );

  const visibleAnnouncements = useMemo(
    () =>
      announcements.filter(
        (a) =>
          a.targetDepartments.includes("ALL") ||
          (studentDepartment != null &&
            a.targetDepartments.includes(studentDepartment)),
      ),
    [announcements, studentDepartment],
  );

  const unreadCount = useMemo(
    () => visibleAnnouncements.filter((a) => !readMap[a.id]).length,
    [visibleAnnouncements, readMap],
  );

  const value = useMemo(
    () => ({
      announcements: visibleAnnouncements,
      readMap,
      unreadCount,
      studentDepartment,
      loading,
      markRead,
    }),
    [
      visibleAnnouncements,
      readMap,
      unreadCount,
      studentDepartment,
      loading,
      markRead,
    ],
  );

  return (
    <AnnouncementsContext.Provider value={value}>
      {children}
    </AnnouncementsContext.Provider>
  );
}

export function useAnnouncements(): AnnouncementsContextValue {
  const ctx = useContext(AnnouncementsContext);
  if (!ctx) {
    throw new Error(
      "useAnnouncements must be used within an AnnouncementsProvider",
    );
  }
  return ctx;
}
