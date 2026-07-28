/**
 * Presence service — tracks online/offline status for users.
 *
 * Uses a "presence" subcollection under each user document.
 * When a user opens the app, their presence is set to online.
 * When the app is closed/backgrounded, presence is set to offline.
 *
 * Collection structure:
 *   users/{uid}/presence/status
 *     - online: boolean
 *     - lastSeen: number (timestamp ms)
 */

import { db } from "@/constants/firebase";
import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";

/**
 * Sets the user as online. Called when the app foregrounds or chat opens.
 */
export async function setUserOnline(uid: string): Promise<void> {
  try {
    const presenceRef = doc(db, "users", uid, "presence", "status");
    await setDoc(presenceRef, {
      online: true,
      lastSeen: Date.now(),
    });
  } catch (err) {
    console.error("setUserOnline error:", err);
  }
}

/**
 * Sets the user as offline. Called when the app backgrounds or closes.
 */
export async function setUserOffline(uid: string): Promise<void> {
  try {
    const presenceRef = doc(db, "users", uid, "presence", "status");
    await setDoc(presenceRef, {
      online: false,
      lastSeen: Date.now(),
    });
  } catch (err) {
    console.error("setUserOffline error:", err);
  }
}

/**
 * Real-time listener for a user's presence status.
 * Returns a cleanup function to unsubscribe.
 */
export function listenForPresence(
  uid: string,
  callback: (online: boolean, lastSeen: number) => void,
  onError?: (error: Error) => void,
): () => void {
  const presenceRef = doc(db, "users", uid, "presence", "status");
  return onSnapshot(presenceRef, (snap) => {
    if (snap.exists()) {
      const data = snap.data();
      callback(data.online ?? false, data.lastSeen ?? 0);
    } else {
      callback(false, 0);
    }
  }, onError || ((err) => console.warn("listenForPresence error:", err)));
}

/**
 * Returns a human-readable "last seen" string.
 */
export function formatLastSeen(lastSeen: number): string {
  if (!lastSeen) return "Unknown";
  const now = Date.now();
  const diff = now - lastSeen;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}
