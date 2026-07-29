import ReactNativeAsyncStorage from "@react-native-async-storage/async-storage";
import { auth, db } from "@/constants/firebase";
import { router } from "expo-router";
import {
  User,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import React, {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

type UserRole = "student" | "admin" | null;

interface AuthContextType {
  user: User | null;
  role: UserRole;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshRole: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: null,
  loading: true,
  signOut: async () => {},
  refreshRole: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);

  const CACHED_ROLE_KEY = (uid: string) => `@MindCare:user_role_${uid}`;

  const fetchUserRole = async (currentUser: User): Promise<UserRole> => {
    try {
      // Check if the user is an admin first
      const adminDocRef = doc(db, "admins", currentUser.uid);
      const adminDocSnap = await getDoc(adminDocRef);

      if (adminDocSnap.exists()) {
        await ReactNativeAsyncStorage.setItem(CACHED_ROLE_KEY(currentUser.uid), "admin");
        return "admin";
      }

      // If not an admin, check if they are a student in the users collection
      const userDocRef = doc(db, "users", currentUser.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists()) {
        await ReactNativeAsyncStorage.setItem(CACHED_ROLE_KEY(currentUser.uid), "student");
        return "student";
      }

      console.warn(
        `User ${currentUser.uid} has no role assigned in Firestore.`,
      );
      return null;
    } catch (error) {
      // Offline or network error — fall back to cached role
      console.warn("Error fetching user role, using cached:", error);
      try {
        const cached = await ReactNativeAsyncStorage.getItem(CACHED_ROLE_KEY(currentUser.uid));
        if (cached === "admin" || cached === "student") return cached;
      } catch {}
      return null;
    }
  };

  const refreshRole = useCallback(async () => {
    if (auth.currentUser) {
      const currentRole = await fetchUserRole(auth.currentUser);
      setRole(currentRole);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setLoading(true);
      if (currentUser) {
        setUser(currentUser);
        const userRole = await fetchUserRole(currentUser);
        setRole(userRole);
      } else {
        setUser(null);
        setRole(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      setUser(null);
      setRole(null);
      router.replace("/auth/login");
    } catch (error) {
      console.error("Error signing out:", error);
      throw error;
    }
  };

  const value = { user, role, loading, signOut, refreshRole };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
