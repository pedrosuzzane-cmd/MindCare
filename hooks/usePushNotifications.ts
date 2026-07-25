import * as Notifications from "expo-notifications";
import { useEffect, useRef, useState } from "react";

import { onAuthStateChanged } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "../constants/firebase";

export type PushTokenState = {
  status: "idle" | "requesting" | "ready" | "error";
  token?: string;
  error?: string;
};

export function usePushNotifications() {
  const [state, setState] = useState<PushTokenState>({ status: "idle" });
  const hasRunRef = useRef(false);

  useEffect(() => {
    if (hasRunRef.current) return;
    hasRunRef.current = true;

    let unsubscribeAuth: (() => void) | null = null;

    const ensureTokenForUser = async (uid: string) => {
      try {
        setState({ status: "requesting" });

        const perms = await Notifications.requestPermissionsAsync();

        // expo-notifications types vary by SDK; treat "granted" and "authorized" as success
        const status = (perms as any)?.status ?? (perms as any)?.granted;
        if (
          status !== "granted" &&
          status !== "authorized" &&
          status !== true
        ) {
          setState({
            status: "error",
            error: "Notification permission denied",
          });
          return;
        }

        const tokenData = await Notifications.getExpoPushTokenAsync();
        const token = tokenData.data;

        // Save token to Firestore (keyed by token string)
        await setDoc(doc(db, "users", uid, "deviceTokens", token), {
          token,
          createdAt: new Date().toISOString(),
          platform: tokenData.type ?? null,
          updatedAt: new Date().toISOString(),
        });

        setState({ status: "ready", token });
      } catch (e: any) {
        console.error("Push notification token setup failed", e);
        setState({
          status: "error",
          error: e?.message || "Unable to get push token",
        });
      }
    };

    unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) return;
      await ensureTokenForUser(user.uid);
    });

    return () => {
      if (typeof unsubscribeAuth === "function") unsubscribeAuth();
    };
  }, []);

  return state;
}
