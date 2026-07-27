import { auth } from "@/constants/firebase";
import { useAuth } from "@/hooks/AuthContext";
import { useColorScheme } from "@/hooks/use-color-scheme";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";

const REMEMBER_EMAIL_KEY = "@MindCare:remembered_email";

export default function LoginScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const styles = createStyles(isDark);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const { user, role, loading: authLoading } = useAuth();

  useEffect(() => {
    AsyncStorage.getItem(REMEMBER_EMAIL_KEY).then((saved) => {
      if (saved) setEmail(saved);
    });
  }, []);

  useEffect(() => {
    if (authLoading || !user) return;
    if (role === "admin") {
      router.replace("/admin-panel");
    } else if (role === "student") {
      router.replace("/(student)/(tabs)/dashboard");
    }
  }, [user, role, authLoading]);

  if (authLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: isDark ? "#10091F" : "#F5F3FF" }}>
        <ActivityIndicator size="large" color="#7C3AED" />
      </View>
    );
  }

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Missing details", "Enter both your email and password.");
      return;
    }

    setSubmitting(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      if (rememberMe) {
        await AsyncStorage.setItem(REMEMBER_EMAIL_KEY, email.trim());
      } else {
        await AsyncStorage.removeItem(REMEMBER_EMAIL_KEY);
      }
    } catch (error: any) {
      Alert.alert("Login failed", error.message || "Invalid credentials.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} bounces={false} keyboardShouldPersistTaps="handled">
        <LinearGradient
          colors={
            isDark
              ? ["#170B31", "#2E1065", "#581C87"]
              : ["#F5F3FF", "#EDE9FE", "#DDD6FE"]
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.orbLarge} />
          <View style={styles.orbSmall} />
          <View style={styles.brandRow}>
            <View style={styles.brandIcon}>
              <Image
                source={require("@/assets/images/logoicon.png")}
                style={styles.brandLogoImage}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.brandName}>MindCare</Text>
          </View>

          <View style={styles.heroCopy}>
            <Text style={styles.heroEyebrow}>YOUR WELLNESS SPACE</Text>
            <Text style={styles.heroTitle}>Feel supported,{"\n"}every day.</Text>
            <Text style={styles.heroDescription}>
              A quiet place to reflect, check in, and care for your well-being.
            </Text>
          </View>

          <View style={styles.heroIllustration}>
            <View style={styles.illustrationCircle}>
              <Ionicons name="sparkles" size={38} color={isDark ? "#F5F3FF" : "#6D28D9"} />
            </View>
            <View style={[styles.floatingDot, styles.dotOne]} />
            <View style={[styles.floatingDot, styles.dotTwo]} />
            <View style={[styles.floatingDot, styles.dotThree]} />
          </View>
        </LinearGradient>

        <View style={styles.formCard}>
          <View style={styles.dragHandle} />
          <Text style={styles.welcomeTitle}>Welcome back</Text>
          <Text style={styles.welcomeSubtitle}>
            Sign in to continue your wellness journey.
          </Text>

          <Text style={styles.fieldLabel}>Email address</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="mail-outline" size={20} color={styles.icon.color} />
            <TextInput
              style={styles.input}
              placeholder="you@example.com"
              placeholderTextColor={styles.placeholder.color}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />
          </View>

          <View style={styles.labelRow}>
            <Text style={styles.fieldLabel}>Password</Text>
            <Pressable onPress={() => router.push("/auth/forgot-password")}>
              <Text style={styles.forgotText}>Forgot password?</Text>
            </Pressable>
          </View>
          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed-outline" size={20} color={styles.icon.color} />
            <TextInput
              style={styles.input}
              placeholder="Enter your password"
              placeholderTextColor={styles.placeholder.color}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoComplete="password"
            />
            <Pressable
              style={styles.eyeIcon}
              onPress={() => setShowPassword((visible) => !visible)}
              accessibilityLabel={showPassword ? "Hide password" : "Show password"}
            >
              <Ionicons
                name={showPassword ? "eye-outline" : "eye-off-outline"}
                size={20}
                color={styles.icon.color}
              />
            </Pressable>
          </View>

          <View style={styles.rememberRow}>
            <Pressable
              style={styles.rememberToggle}
              onPress={() => setRememberMe((v) => !v)}
              accessibilityRole="togglebutton"
              accessibilityState={{ checked: rememberMe }}
            >
              <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                {rememberMe && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
              </View>
              <Text style={styles.rememberText}>Remember my email</Text>
            </Pressable>
          </View>

          <Pressable
            style={[styles.loginButton, submitting && styles.loginButtonDisabled]}
            onPress={handleLogin}
            disabled={submitting}
          >
            <LinearGradient
              colors={isDark ? ["#A78BFA", "#7C3AED"] : ["#7C3AED", "#5B21B6"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.gradientButton}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.loginButtonText}>Sign in</Text>
                  <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                </>
              )}
            </LinearGradient>
          </Pressable>

          <View style={styles.footerContainer}>
            <Text style={styles.footerText}>New to MindCare? </Text>
            <Pressable onPress={() => router.push("/auth/register")}>
              <Text style={styles.signupText}>Create an account</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (isDark: boolean) => {
  const colors = isDark
    ? {
        background: "#10091F",
        card: "#1E1238",
        text: "#FAF5FF",
        muted: "#C4B5D9",
        input: "#2B1B4A",
        border: "#4C3571",
        icon: "#C4B5FD",
        placeholder: "#9B8BB8",
        heroText: "#FFFFFF",
        heroMuted: "#DDD6FE",
      }
    : {
        background: "#F5F3FF",
        card: "#FFFFFF",
        text: "#24113F",
        muted: "#756485",
        input: "#FAF9FF",
        border: "#E9D5FF",
        icon: "#7C3AED",
        placeholder: "#A79AB8",
        heroText: "#3B0764",
        heroMuted: "#6B4B82",
      };

  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scrollContent: { flexGrow: 1 },
    hero: {
      minHeight: 326,
      paddingHorizontal: 28,
      paddingTop: 58,
      paddingBottom: 60,
      overflow: "hidden",
    },
    orbLarge: {
      position: "absolute",
      width: 240,
      height: 240,
      borderRadius: 120,
      backgroundColor: isDark ? "rgba(196,181,253,0.13)" : "rgba(124,58,237,0.11)",
      right: -80,
      top: -72,
    },
    orbSmall: {
      position: "absolute",
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.55)",
      left: -48,
      bottom: -45,
    },
    brandRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9 },
    brandIcon: {
      width: 36,
      height: 36,
      borderRadius: 12,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: "#FFFFFF",
      overflow: "hidden",
    },
    brandLogoImage: {
      width: 28,
      height: 28,
    },
    brandName: { color: colors.heroText, fontSize: 19, fontWeight: "800" },
    heroCopy: { marginTop: 28, maxWidth: 260, alignSelf: "center", alignItems: "center" },
    heroEyebrow: { color: colors.heroMuted, fontSize: 10, fontWeight: "800", letterSpacing: 1.25, textAlign: "center" },
    heroTitle: { color: colors.heroText, fontSize: 31, fontWeight: "900", lineHeight: 37, marginTop: 9, textAlign: "center" },
    heroDescription: { color: colors.heroMuted, fontSize: 13, lineHeight: 20, marginTop: 10, textAlign: "center" },
    heroIllustration: { position: "absolute", right: 31, bottom: 31, width: 86, height: 86, justifyContent: "center", alignItems: "center" },
    illustrationCircle: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: isDark ? "rgba(255,255,255,0.13)" : "rgba(255,255,255,0.65)",
      borderWidth: 1,
      borderColor: isDark ? "rgba(255,255,255,0.18)" : "rgba(124,58,237,0.16)",
      justifyContent: "center",
      alignItems: "center",
    },
    floatingDot: { position: "absolute", borderRadius: 99, backgroundColor: isDark ? "#DDD6FE" : "#7C3AED" },
    dotOne: { width: 8, height: 8, top: 4, right: 5 },
    dotTwo: { width: 5, height: 5, left: 5, bottom: 20 },
    dotThree: { width: 6, height: 6, right: 0, bottom: 3 },
    formCard: {
      flex: 1,
      marginTop: -28,
      paddingHorizontal: 28,
      paddingTop: 18,
      paddingBottom: 42,
      borderTopLeftRadius: 30,
      borderTopRightRadius: 30,
      backgroundColor: colors.card,
      // @ts-ignore - web only
      boxShadow: isDark ? "0px -8px 30px rgba(0,0,0,0.28)" : "0px -8px 28px rgba(76,29,149,0.10)",
      elevation: 8,
    },
    dragHandle: { alignSelf: "center", width: 42, height: 4, borderRadius: 3, backgroundColor: isDark ? "#5B4774" : "#DDD6FE", marginBottom: 22 },
    welcomeTitle: { color: colors.text, fontSize: 25, fontWeight: "900", textAlign: "center" },
    welcomeSubtitle: { color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 5, marginBottom: 27, textAlign: "center" },
    fieldLabel: { color: colors.text, fontSize: 13, fontWeight: "800", marginBottom: 8 },
    labelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 2 },
    inputContainer: {
      height: 56,
      flexDirection: "row",
      alignItems: "center",
      gap: 11,
      paddingHorizontal: 15,
      borderRadius: 15,
      marginBottom: 19,
      backgroundColor: colors.input,
      borderWidth: 1,
      borderColor: colors.border,
    },
    input: { flex: 1, color: colors.text, fontSize: 15, fontWeight: "600" },
    icon: { color: colors.icon },
    placeholder: { color: colors.placeholder },
    eyeIcon: { padding: 4 },
    forgotText: { color: isDark ? "#C4B5FD" : "#6D28D9", fontSize: 12, fontWeight: "800", marginBottom: 8 },
    rememberRow: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
    rememberToggle: { flexDirection: "row", alignItems: "center", gap: 10 },
    checkbox: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: isDark ? "#6B5B8A" : "#C4B5D9",
      justifyContent: "center",
      alignItems: "center",
    },
    checkboxChecked: {
      backgroundColor: isDark ? "#7C3AED" : "#6D28D9",
      borderColor: isDark ? "#7C3AED" : "#6D28D9",
    },
    rememberText: { color: colors.muted, fontSize: 13, fontWeight: "600" },
    // @ts-ignore - web only
    loginButton: { borderRadius: 16, overflow: "hidden", marginTop: 7, boxShadow: "0px 10px 20px rgba(109,40,217,0.25)", elevation: 5 },
    loginButtonDisabled: { opacity: 0.7 },
    gradientButton: { height: 57, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9 },
    loginButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
    footerContainer: { flexDirection: "row", justifyContent: "center", alignItems: "center", marginTop: 24 },
    footerText: { color: colors.muted, fontSize: 13, fontWeight: "600" },
    signupText: { color: isDark ? "#C4B5FD" : "#6D28D9", fontSize: 13, fontWeight: "800" },
  });
};
