import { auth } from "@/constants/firebase";
import { type Router } from "expo-router";
import { signOut, User } from "firebase/auth";

/**
 * Checks if the user has admin custom claims and redirects to the admin panel if so.
 * In Firebase, admin roles are typically managed via custom claims on the user's ID token.
 *
 * @param user The authenticated Firebase user object.
 * @param router The Expo Router instance for navigation.
 */
export const checkAdminStatusAndRedirect = async (
  user: User,
  router: Router,
  forceRefresh: boolean = false,
) => {
  try {
    const idTokenResult = await user.getIdTokenResult(forceRefresh);
    // If the 'admin' custom claim is true, redirect to the admin panel.
    if (idTokenResult.claims.admin) {
      router.replace("/admin-panel");
    }
  } catch (error) {
    console.error("Error checking admin status:", error);
    // If the check fails, let the user proceed to the regular dashboard.
  }
};

/**
 * Signs the current user out and redirects them to the login screen.
 * @param router The Expo Router instance for navigation.
 */
export const handleSignOut = async (router: Router) => {
  await signOut(auth);
  router.replace("/auth/login");
};
