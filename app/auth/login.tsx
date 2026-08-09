import { auth } from "@/constants/firebase";
import { API_URL } from "@/backend/config";
import { useAuth } from "@/hooks/AuthContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

const REMEMBER_EMAIL_KEY = "@MindCare:remembered_email";

const COLORS = {
  background: "#0F0D15",
  card: "#1E1B2E",
  input: "#1E1B2E",
  border: "rgba(167, 139, 250, 0.22)",
  primary: "#6D28D9",
  primarySoft: "#A78BFA",
  text: "#FFFFFF",
  muted: "#9CA3AF",
  placeholder: "#6E6A84",
  error: "#F87171",
  onPrimary: "#FFFFFF",
};

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const { user, role, loading: authLoading } = useAuth();

  useEffect(() => {
    AsyncStorage.getItem(REMEMBER_EMAIL_KEY).then((saved) => {
      if (saved) setEmail(saved);
    });
  }, []);

  useEffect(() => {
    if (authLoading || !user) return;
    if (role === "admin" || role === "superAdmin") {
      router.replace("/admin-panel");
    } else {
      // Default to student dashboard (works offline when role can't be fetched)
      router.replace("/(student)/(tabs)/dashboard");
    }
  }, [user, role, authLoading]);

  if (authLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primarySoft} />
      </View>
    );
  }

  const logLoginEvent = async () => {
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) return;
      await fetch(`${API_URL}/api/security/log`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ type: "login", details: { platform: Platform.OS } }),
      });
    } catch (err) {
      console.warn("Failed to log login event:", err);
    }
  };

  const handleLogin = async () => {
    setEmailError("");
    setPasswordError("");
    setError("");

    let hasError = false;
    if (!email.trim()) {
      setEmailError("Email is required.");
      hasError = true;
    }
    if (!password.trim()) {
      setPasswordError("Password is required.");
      hasError = true;
    }
    if (hasError) return;

    setSubmitting(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      if (rememberMe) {
        await AsyncStorage.setItem(REMEMBER_EMAIL_KEY, email.trim());
      } else {
        await AsyncStorage.removeItem(REMEMBER_EMAIL_KEY);
      }
      logLoginEvent();
    } catch (err: any) {
      const code = err?.code || "";
      let message = "Login failed. Please try again.";
      if (
        code === "auth/invalid-credential" ||
        code === "auth/user-not-found" ||
        code === "auth/wrong-password"
      ) {
        message = "Invalid email or password. Please check your credentials and try again.";
      } else if (code === "auth/user-disabled") {
        message = "This account has been disabled. Please contact support.";
      } else if (code === "auth/too-many-requests") {
        message = "Too many failed attempts. Please try again later.";
      } else if (code === "auth/network-request-failed") {
        message = "Network error. Please check your connection.";
      }
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        bounces={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.content}>
          {/* Brand */}
          <View style={styles.brandRow}>
            <View style={styles.brandIcon}>
              <Image
                source={require("@/assets/images/appicon_circle.png")}
                style={styles.brandLogoImage}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.brandName}>MindCare</Text>
          </View>

          <Text style={styles.welcomeTitle}>Welcome Back 🌱</Text>
          <Text style={styles.welcomeSubtitle}>
            Sign in to continue your wellness journey.
          </Text>

          {/* Email / Username input */}
          <View
            style={[styles.inputContainer, emailError ? styles.inputError : null]}
          >
            <Ionicons name="person-outline" size={20} color={COLORS.primarySoft} />
            <TextInput
              style={styles.input}
              placeholder="Username or Email"
              placeholderTextColor={COLORS.placeholder}
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (emailError) setEmailError("");
                if (error) setError("");
              }}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />
          </View>
          {emailError ? <Text style={styles.fieldError}>{emailError}</Text> : null}

          {/* Password input */}
          <View
            style={[styles.inputContainer, passwordError ? styles.inputError : null]}
          >
            <Ionicons name="lock-closed-outline" size={20} color={COLORS.primarySoft} />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor={COLORS.placeholder}
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                if (passwordError) setPasswordError("");
                if (error) setError("");
              }}
              secureTextEntry={!showPassword}
              autoComplete="password"
            />
            <Pressable
              style={styles.eyeIcon}
              onPress={() => setShowPassword((visible) => !visible)}
              accessibilityRole="button"
              accessibilityLabel={showPassword ? "Hide password" : "Show password"}
              hitSlop={8}
            >
              <Ionicons
                name={showPassword ? "eye-outline" : "eye-off-outline"}
                size={20}
                color={COLORS.primarySoft}
              />
            </Pressable>
          </View>
          {passwordError ? <Text style={styles.fieldError}>{passwordError}</Text> : null}

          {/* Remember my email */}
          <View style={styles.rememberRow}>
            <Pressable
              style={styles.rememberToggle}
              onPress={() => setRememberMe((v) => !v)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: rememberMe }}
              hitSlop={6}
            >
              <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                {rememberMe && (
                  <Ionicons name="checkmark" size={14} color={COLORS.onPrimary} />
                )}
              </View>
              <Text style={styles.rememberText}>Remember my email</Text>
            </Pressable>
          </View>

          {error ? <Text style={styles.formError}>{error}</Text> : null}

          {/* Login button */}
          <Pressable
            style={({ pressed }) => [
              styles.loginButton,
              pressed && styles.loginButtonPressed,
              submitting && styles.loginButtonDisabled,
            ]}
            onPress={handleLogin}
            disabled={submitting}
            android_ripple={{ borderless: false, color: "rgba(255,255,255,0.2)" }}
            accessibilityRole="button"
            accessibilityState={{ disabled: submitting }}
          >
            {submitting ? (
              <ActivityIndicator color={COLORS.onPrimary} />
            ) : (
              <Text style={styles.loginButtonText}>LOGIN</Text>
            )}
          </Pressable>

          {/* Forgot password */}
          <Pressable
            style={styles.forgotButton}
            onPress={() => router.push("/auth/forgot-password")}
            accessibilityRole="button"
            accessibilityLabel="Forgot password"
            hitSlop={8}
          >
            <Text style={styles.forgotText}>Forgot Password?</Text>
          </Pressable>

          {/* Registration link */}
          <View style={styles.footerContainer}>
            <Text style={styles.footerText}>Don&apos;t have an account? </Text>
            <Pressable
              onPress={() => router.push("/auth/register")}
              accessibilityRole="link"
              hitSlop={6}
            >
              <Text style={styles.signupText}>Sign Up</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.background,
  },
  scrollContent: { flexGrow: 1 },
  content: {
    width: "100%",
    maxWidth: 400,
    alignSelf: "center",
    paddingHorizontal: 24,
    paddingTop: 72,
    paddingBottom: 48,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  brandIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
  },
  brandLogoImage: {
    width: 30,
    height: 30,
  },
  brandName: { color: COLORS.text, fontSize: 20, fontWeight: "800" },
  welcomeTitle: {
    color: COLORS.text,
    fontSize: 26,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 26,
  },
  welcomeSubtitle: {
    color: COLORS.muted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    marginTop: 8,
    marginBottom: 28,
  },
  inputContainer: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 18,
    borderRadius: 28,
    marginBottom: 16,
    backgroundColor: COLORS.input,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  inputError: { borderColor: COLORS.error },
  input: { flex: 1, color: COLORS.text, fontSize: 15, fontWeight: "600" },
  eyeIcon: { padding: 4 },
  fieldError: {
    color: COLORS.error,
    fontSize: 12,
    fontWeight: "600",
    marginTop: -8,
    marginBottom: 12,
    paddingLeft: 16,
  },
  rememberRow: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  rememberToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 6,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: "#6B5B8A",
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxChecked: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  rememberText: { color: COLORS.muted, fontSize: 13, fontWeight: "600" },
  formError: {
    color: COLORS.error,
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 4,
    marginBottom: 8,
  },
  loginButton: {
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
    // @ts-ignore — web-only shadow property
    boxShadow: "0px 8px 20px rgba(109, 40, 217, 0.35)",
  },
  loginButtonPressed: { opacity: 0.88 },
  loginButtonDisabled: { opacity: 0.65 },
  loginButtonText: {
    color: COLORS.onPrimary,
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 1,
  },
  forgotButton: { alignItems: "center", paddingVertical: 14, marginTop: 6 },
  forgotText: { color: COLORS.primarySoft, fontSize: 14, fontWeight: "600" },
  footerContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 2,
    flexWrap: "wrap",
  },
  footerText: { color: COLORS.muted, fontSize: 14, fontWeight: "500" },
  signupText: { color: COLORS.primarySoft, fontSize: 14, fontWeight: "800" },
});
