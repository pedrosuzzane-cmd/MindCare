import { db } from "@/constants/firebase";
import {
    doc,
    getDoc,
    onSnapshot,
    serverTimestamp,
    setDoc,
    updateDoc,
} from "firebase/firestore";

/**
 * Creates a new user document in Firestore upon registration.
 * @param uid The user's unique ID from Firebase Auth.
 * @param data The initial profile data to save.
 * @param collectionName The collection to save to (defaults to "users").
 */
export async function createUserDocument(
  uid: string,
  data: Record<string, any>,
  collectionName: "users" | "admins" = "users",
): Promise<void> {
  const docRef = doc(db, collectionName, uid);
  await setDoc(docRef, {
    ...data,
    createdAt: serverTimestamp(),
  });
}

/**
 * Subscribes to real-time updates for a user's profile.
 * Supports both 'users' and 'admins' collections.
 * @param uid The user's ID.
 * @param onUpdate Callback that receives the latest profile data.
 * @param onError Callback for any errors.
 * @returns An unsubscribe function.
 */
export function subscribeToUserProfile(
  uid: string,
  onUpdate: (data: Record<string, any> | null) => void,
  onError: (error: Error) => void,
): () => void {
  // Try 'admins' collection first, then fall back to 'users'
  const adminDocRef = doc(db, "admins", uid);
  const userDocRef = doc(db, "users", uid);

  let unsubAdmin = () => {};
  let unsubUser: (() => void) | null = null;

  unsubAdmin = onSnapshot(
    adminDocRef,
    (adminSnap) => {
      if (adminSnap.exists()) {
        onUpdate(adminSnap.data());
      } else {
        // Fall back to users collection
        unsubUser = onSnapshot(
          userDocRef,
          (userSnap) => {
            onUpdate(userSnap.exists() ? userSnap.data() : null);
          },
          onError,
        );
      }
    },
    onError,
  );

  return () => {
    unsubAdmin();
    if (unsubUser) unsubUser();
  };
}

/** Updates a user's profile document with new data. Supports both 'users' and 'admins' collections. */
export async function updateUserProfile(
  uid: string,
  data: Record<string, any>,
): Promise<void> {
  // Try admins first, then users
  const adminDocRef = doc(db, "admins", uid);
  const adminSnap = await getDoc(adminDocRef);
  if (adminSnap.exists()) {
    await updateDoc(adminDocRef, data);
  } else {
    const userDocRef = doc(db, "users", uid);
    await updateDoc(userDocRef, data);
  }
}
