import { initializeApp } from "firebase/app";
import { initializeAuth, getReactNativePersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";

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

export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});
export const db = getFirestore(app);

export default app;


