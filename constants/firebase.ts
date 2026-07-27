import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

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

export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;


