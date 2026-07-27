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
  const docRef = await addDoc(collection(db, "announcements"), {
    title: payload.title,
    description: payload.description,
    links: payload.links,
    authorName: payload.authorName,
    adminId: payload.adminId,
    authorPosition: payload.authorPosition || null,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

export function listenForAnnouncements(
  callback: (announcements: Announcement[]) => void,
): () => void {
  const q = query(collection(db, "announcements"), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snapshot) => {
    const items: Announcement[] = snapshot.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        title: data.title || "",
        description: data.description || "",
        links: sanitizeLinks(data.links),
        createdAt: firestoreTimestampToDate(data.createdAt),
        authorName: data.authorName || "Admin",
        adminId: data.adminId || "",
        authorPosition: data.authorPosition || undefined,
      };
    });
    callback(items);
  });
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
