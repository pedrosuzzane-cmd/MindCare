import { Platform } from "react-native";
import { initializeApp } from "firebase/app";
import {
  getAuth,
  initializeAuth,
  getReactNativePersistence,
} from "firebase/auth";
import type { Auth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import ReactNativeAsyncStorage from "@react-native-async-storage/async-storage";

const firebaseConfig = {
  apiKey: "AIzaSyBGsUOr7tdhyUYcHR1Mi4f9dMDZpdva16I",
  authDomain: "mindcare-8801e.firebaseapp.com",
  projectId: "mindcare-8801e",
  storageBucket: "mindcare-8801e.firebasestorage.app",
  messagingSenderId: "309941860248",
  appId: "1:309941860248:web:069b7f69c81fbe1a171ded",
  measurementId: "G-XXL68T1Z00",
};

const app = initializeApp(firebaseConfig);

// initializeAuth throws auth/already-initialized during HMR re-renders.
// Fall back to getAuth if the app was already initialized.
// On web, getReactNativePersistence is not available, so use getAuth directly.

let auth: Auth;
if (Platform.OS === "web") {
  auth = getAuth(app);
} else {
  try {
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(ReactNativeAsyncStorage),
    });
  } catch (e: any) {
    if (e?.code === "auth/already-initialized") {
      auth = getAuth(app);
    } else {
      throw e;
    }
  }
}

export { auth };
export const db = getFirestore(app);

export default app;


