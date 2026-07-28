import { db } from "@/constants/firebase";
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  getDocs,
  setDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import type {
  Announcement,
  AnnouncementLink,
  CreateAnnouncementPayload,
} from "@/types/announcement";

const EXPIRY_DAYS = 7;
const EXPIRY_MS = EXPIRY_DAYS * 24 * 60 * 60 * 1000;

function firestoreTimestampToDate(val: unknown): Date {
  if (val && typeof val === "object" && "toDate" in val) {
    return (val as { toDate: () => Date }).toDate();
  }
  if (val instanceof Date) return val;
  if (typeof val === "number") return new Date(val);
  return new Date();
}

function sanitizeLinks(raw: unknown): AnnouncementLink[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (l): l is AnnouncementLink =>
        l &&
        typeof l === "object" &&
        typeof (l as AnnouncementLink).title === "string" &&
        typeof (l as AnnouncementLink).url === "string",
    )
    .map((l) => ({ title: l.title.trim(), url: l.url.trim() }));
}

export async function createAnnouncement(
  payload: CreateAnnouncementPayload,
): Promise<string> {
  const now = Date.now();
  const docRef = await addDoc(collection(db, "announcements"), {
    title: payload.title,
    description: payload.description,
    links: payload.links,
    authorName: payload.authorName,
    adminId: payload.adminId,
    authorPosition: payload.authorPosition || null,
    createdAt: serverTimestamp(),
    expiresAt: now + EXPIRY_MS,
  });
  return docRef.id;
}

export function listenForAnnouncements(
  callback: (announcements: Announcement[]) => void,
  onError?: (error: Error) => void,
): () => void {
  const q = query(collection(db, "announcements"), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snapshot) => {
    const now = Date.now();
    const items: Announcement[] = snapshot.docs
      .map((d) => {
        const data = d.data();
        const createdAt = firestoreTimestampToDate(data.createdAt);
        const expiresAt = data.expiresAt
          ? new Date(data.expiresAt)
          : new Date(createdAt.getTime() + EXPIRY_MS);
        return {
          id: d.id,
          title: data.title || "",
          description: data.description || "",
          links: sanitizeLinks(data.links),
          createdAt,
          expiresAt,
          authorName: data.authorName || "Admin",
          adminId: data.adminId || "",
          authorPosition: data.authorPosition || undefined,
        };
      })
      .filter((a) => a.expiresAt.getTime() > now);
    callback(items);
  }, onError);
}

export async function deleteAnnouncement(announcementId: string): Promise<void> {
  const batch = writeBatch(db);
  const readsSnap = await getDocs(
    collection(db, "announcements", announcementId, "reads"),
  );
  readsSnap.docs.forEach((readDoc) => batch.delete(readDoc.ref));
  batch.delete(doc(db, "announcements", announcementId));
  await batch.commit();
}

/**
 * Deletes all expired announcements from Firestore.
 * Safe to call on admin panel load — only deletes docs past their expiresAt.
 */
export async function cleanupExpiredAnnouncements(): Promise<number> {
  const now = Date.now();
  const snap = await getDocs(collection(db, "announcements"));
  const expired = snap.docs.filter((d) => {
    const data = d.data();
    const expiresAt = data.expiresAt;
    return expiresAt && expiresAt < now;
  });

  if (expired.length === 0) return 0;

  const batch = writeBatch(db);
  for (const docSnap of expired) {
    // Delete reads subcollection first
    const readsSnap = await getDocs(
      collection(db, "announcements", docSnap.id, "reads"),
    );
    readsSnap.docs.forEach((readDoc) => batch.delete(readDoc.ref));
    batch.delete(docSnap.ref);
  }
  await batch.commit();
  return expired.length;
}

export async function markAnnouncementAsRead(
  announcementId: string,
  studentUid: string,
): Promise<void> {
  await setDoc(
    doc(db, "announcements", announcementId, "reads", studentUid),
    { uid: studentUid, readAt: serverTimestamp() },
    { merge: true },
  );
}

export async function getUnreadCount(
  studentUid: string,
  announcements: Announcement[],
): Promise<number> {
  if (announcements.length === 0) return 0;
  const checks = announcements.map(async (a) => {
    const readDoc = await getDocs(
      collection(db, "announcements", a.id, "reads"),
    );
    const hasRead = readDoc.docs.some(
      (d) => d.id === studentUid || d.data().uid === studentUid,
    );
    return hasRead ? 0 : 1;
  });
  const results = await Promise.all(checks);
  return results.reduce<number>((sum, v) => sum + v, 0);
}

/**
 * Returns days remaining until an announcement expires.
 */
export function getDaysRemaining(expiresAt: Date): number {
  const now = Date.now();
  const diff = expiresAt.getTime() - now;
  return Math.max(0, Math.ceil(diff / (24 * 60 * 60 * 1000)));
}

/**
 * Formats a date for display: "Jul 27, 2026 at 3:45 PM"
 */
export function formatAnnouncementDateTime(date: Date): string {
  const dateStr = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const timeStr = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return `${dateStr} at ${timeStr}`;
}
