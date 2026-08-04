import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/constants/firebase";

export interface StudentProfile {
  uid: string;
  fullName?: string;
  displayName?: string;
  profileImage?: string;
  department?: string;
  yearLevel?: string;
}

/**
 * Real-time listener for a peer's profile (avatar + name).
 *
 * Chat messages store only lightweight references (senderId, timestamp) — the
 * avatar/name are resolved here from the centralized `users` collection (with a
 * fallback to `admins` for counselor chats). Because it is a live listener, a
 * student updating their profile picture reflects instantly in active chats,
 * and a deleted/renamed profile never blocks message delivery or crashes
 * rendering (the caller is expected to fall back when the profile is undefined).
 */
export function useStudentProfile(
  userId?: string | null,
): StudentProfile | undefined {
  const [profile, setProfile] = useState<StudentProfile | undefined>(undefined);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    const unsubs: Array<() => void> = [];

    const subscribe = (collectionName: "users" | "admins") => {
      unsubs.push(
        onSnapshot(
          doc(db, collectionName, userId),
          (snap) => {
            if (!active) return;
            if (snap.exists()) {
              setProfile({
                uid: userId,
                ...(snap.data() as Omit<StudentProfile, "uid">),
              });
            } else if (collectionName === "users") {
              subscribe("admins");
            } else {
              setProfile(undefined);
            }
          },
          () => {
            if (!active) return;
            if (collectionName === "users") {
              subscribe("admins");
            } else {
              setProfile(undefined);
            }
          },
        ),
      );
    };

    subscribe("users");

    return () => {
      active = false;
      unsubs.forEach((unsub) => unsub());
    };
  }, [userId]);

  return profile;
}
