import { auth } from "@/constants/firebase";
import { API_URL } from "@/backend/config";
import { useAuth } from "@/hooks/AuthContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useEffect, useMemo, useState } from "react";
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
  useWindowDimensions,
  View,
} from "react-native";
import { useMindCareTheme } from "@/contexts/ThemeContext";
import type { MindCareTheme } from "@/constants/theme";

const REMEMBER_EMAIL_KEY = "@MindCare:remembered_email";

type Breakpoint = "mobile" | "tablet" | "desktop";

const createStyles = (breakpoint: Breakpoint, theme: MindCareTheme) => {
  const desktop = breakpoint === "desktop";
  const tablet = breakpoint === "tablet";
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    loadingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: theme.background,
    },
    scrollContent: {
      flexGrow: 1,
      justifyContent: desktop ? "center" : "flex-start",
    },
    content: {
      width: "100%",
      maxWidth: desktop ? 500 : tablet ? 480 : 400,
      alignSelf: "center",
      paddingHorizontal: desktop ? 48 : 24,
      paddingTop: desktop ? 48 : tablet ? 64 : 72,
      paddingBottom: desktop ? 48 : 48,
      ...(desktop && {
        backgroundColor: theme.card,
        borderRadius: 28,
        borderWidth: 1,
        borderColor: theme.border,
        shadowColor: theme.primary,
        shadowOffset: { width: 0, height: 14 },
        shadowOpacity: 0.12,
        shadowRadius: 40,
        elevation: 8,
        // @ts-ignore
        boxShadow: `0px 16px 48px ${theme.shadow}`,
      }),
    },
    brandRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: tablet ? 12 : 10,
    },
    brandIcon: {
      width: desktop ? 52 : tablet ? 44 : 38,
      height: desktop ? 52 : tablet ? 44 : 38,
      borderRadius: desktop ? 16 : tablet ? 14 : 12,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: theme.softPurple,
      overflow: "hidden",
    },
    brandLogoImage: {
      width: desktop ? 40 : tablet ? 34 : 30,
      height: desktop ? 40 : tablet ? 34 : 30,
    },
    brandName: {
      color: theme.text,
      fontSize: desktop ? 24 : tablet ? 22 : 20,
      fontWeight: "800",
    },
    welcomeTitle: {
      color: theme.text,
      fontSize: desktop ? 26 : tablet ? 28 : 26,
      fontWeight: "800",
      textAlign: "center",
      marginTop: desktop ? 24 : tablet ? 28 : 26,
    },
    welcomeSubtitle: {
      color: theme.secondaryText,
      fontSize: desktop ? 15 : 14,
      lineHeight: 21,
      textAlign: "center",
      marginTop: 8,
      marginBottom: desktop ? 36 : tablet ? 32 : 28,
    },
    inputContainer: {
      height: desktop ? 56 : tablet ? 58 : 56,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 18,
      borderRadius: desktop ? 16 : tablet ? 29 : 28,
      marginBottom: desktop ? 18 : tablet ? 18 : 16,
      backgroundColor: theme.inputBg,
      borderWidth: 1,
      borderColor: theme.border,
    },
    inputError: { borderColor: theme.status.error },
    input: { flex: 1, color: theme.text, fontSize: desktop ? 16 : 15, fontWeight: "600" },
    eyeIcon: { padding: 4 },
    fieldError: {
      color: theme.status.error,
      fontSize: 12,
      fontWeight: "600",
      marginTop: -10,
      marginBottom: tablet || desktop ? 14 : 12,
      paddingLeft: 16,
    },
    rememberRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: tablet || desktop ? 8 : 4,
    },
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
      borderColor: theme.primary,
      justifyContent: "center",
      alignItems: "center",
    },
    checkboxChecked: { backgroundColor: theme.primary, borderColor: theme.primary },
    rememberText: { color: theme.secondaryText, fontSize: 13, fontWeight: "600" },
    formError: {
      color: theme.status.error,
      fontSize: 12,
      fontWeight: "600",
      textAlign: "center",
      marginTop: 6,
      marginBottom: 8,
    },
    loginButton: {
      height: desktop ? 56 : tablet ? 58 : 56,
      borderRadius: desktop ? 18 : tablet ? 29 : 28,
      backgroundColor: theme.primary,
      alignItems: "center",
      justifyContent: "center",
      marginTop: desktop ? 20 : tablet ? 18 : 14,
      shadowColor: theme.primary,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.4,
      shadowRadius: 12,
      elevation: 6,
      // @ts-ignore
      boxShadow: desktop
        ? `0px 10px 24px ${theme.shadow}`
        : `0px 8px 20px ${theme.shadow}`,
    },
    loginButtonPressed: { opacity: 0.88 },
    loginButtonDisabled: { opacity: 0.65 },
    loginButtonText: {
      color: theme.onPrimary,
      fontSize: desktop ? 16 : 15,
      fontWeight: "800",
      letterSpacing: 1,
    },
    forgotButton: {
      alignItems: "center",
      paddingVertical: desktop ? 16 : 14,
      marginTop: desktop ? 10 : 6,
    },
    forgotText: { color: theme.primary, fontSize: desktop ? 15 : 14, fontWeight: "600" },
    footerContainer: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      marginTop: tablet || desktop ? 14 : 2,
      flexWrap: "wrap",
    },
    footerText: { color: theme.secondaryText, fontSize: desktop ? 15 : 14, fontWeight: "500" },
    signupText: { color: theme.primary, fontSize: desktop ? 15 : 14, fontWeight: "800" },
  });
};

export default function LoginScreen() {
  const { theme } = useMindCareTheme();
  const { width } = useWindowDimensions();
  const breakpoint: Breakpoint =
    width >= 1280 ? "desktop" : width >= 768 ? "tablet" : "mobile";
  const styles = useMemo(
    () => createStyles(breakpoint, theme),
    [breakpoint, theme],
  );

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
        <ActivityIndicator size="large" color={theme.primary} />
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
                source={require("@/assets/images/android-icon-foreground.png")}
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
            <Ionicons name="person-outline" size={20} color={theme.primary} />
            <TextInput
              style={styles.input}
              placeholder="Username or Email"
              placeholderTextColor={theme.secondaryText}
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
            <Ionicons name="lock-closed-outline" size={20} color={theme.primary} />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor={theme.secondaryText}
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
                color={theme.primary}
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
                  <Ionicons name="checkmark" size={14} color={theme.onPrimary} />
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
              <ActivityIndicator color={theme.onPrimary} />
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
