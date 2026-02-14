// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";

// Export auth and firestore for app use
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBGsUOr7tdhyUYcHR1Mi4f9dMDZpdva16I",
  authDomain: "mindcare-8801e.firebaseapp.com",
  projectId: "mindcare-8801e",
  storageBucket: "mindcare-8801e.firebasestorage.app",
  messagingSenderId: "309941860248",
  appId: "1:309941860248:web:069b7f69c81fbe1a171ded",
  measurementId: "G-XXL68T1Z00",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;
