import { API_URL } from "@/backend/config";
import AuthHeader from "@/components/auth/AuthHeader";
import CountdownTimer from "@/components/auth/CountdownTimer";
import { resetFlow } from "@/utils/resetFlow";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const OTP_TOTAL_SECONDS = 5 * 60;

export default function CheckEmailScreen() {
  const insets = useSafeAreaInsets();
  const email = resetFlow.getEmail();
  const [expiresAt, setExpiresAt] = useState(
    () => Date.now() + OTP_TOTAL_SECONDS * 1000,
  );
  const [cooldown, setCooldown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cooldownTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!email) router.replace("/auth/forgot-password");
  }, [email]);

  useEffect(() => {
    return () => {
      if (cooldownTimer.current) clearInterval(cooldownTimer.current);
    };
  }, []);

  const startCooldown = () => {
    setCooldown(60);
    if (cooldownTimer.current) clearInterval(cooldownTimer.current);
    cooldownTimer.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          if (cooldownTimer.current) clearInterval(cooldownTimer.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleResend = async () => {
    if (cooldown > 0 || !email) return;
    setError(null);
    setLoading(true);
    try {
      const response = await fetch(
        `${API_URL}/api/auth/forgot-password/request`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        },
      );
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Unable to resend the code.");
        return;
      }
      setExpiresAt(Date.now() + OTP_TOTAL_SECONDS * 1000);
      startCooldown();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenEmailApp = () => {
    Linking.openURL("https://mail.google.com/").catch(() => {});
  };

  const handleChangeEmail = () => {
    resetFlow.clear();
    router.replace("/auth/forgot-password");
  };

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
      <LinearGradient
        colors={["#E8E0F5", "#F4F2F8", "#E8E0F5"]}
        style={styles.gradient}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <AuthHeader
            onBack={() => router.back()}
            icon="mail-outline"
            title="Check your email"
            subtitle={
              email
                ? `We've sent a verification code to\n${email}`
                : "We've sent a verification code to your email."
            }
          />

          <View style={styles.body}>
            <CountdownTimer
              expiresAt={expiresAt}
              totalSeconds={OTP_TOTAL_SECONDS}
              prefix="The code expires in"
            />

            <Pressable
              style={styles.emailButton}
              onPress={handleOpenEmailApp}
              accessibilityRole="button"
              accessibilityLabel="Open email app"
            >
              <LinearGradient
                colors={["#9C7EEB", "#8A63D2", "#7C5AC8"]}
                style={styles.emailButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Ionicons name="open-outline" size={20} color="white" />
                <Text style={styles.emailButtonText}>Open Email App</Text>
              </LinearGradient>
            </Pressable>

            <Pressable
              onPress={() => router.push("/auth/otp-verification")}
              accessibilityRole="button"
              accessibilityLabel="Enter verification code"
            >
              <Text style={styles.enterCodeLink}>Enter the code</Text>
            </Pressable>

            <View style={styles.resendSection}>
              <Text style={styles.resendHint}>Didn't receive it?</Text>
              <Pressable
                onPress={handleResend}
                disabled={cooldown > 0 || loading}
                accessibilityRole="button"
                accessibilityLabel={
                  cooldown > 0
                    ? `Resend in ${cooldown} seconds`
                    : "Resend code"
                }
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#7C3AED" />
                ) : (
                  <Text
                    style={[
                      styles.resendText,
                      cooldown > 0 && styles.resendTextDisabled,
                    ]}
                  >
                    {cooldown > 0
                      ? `Resend in ${cooldown} seconds`
                      : "Resend code"}
                  </Text>
                )}
              </Pressable>
            </View>

            {error ? (
              <Text style={styles.errorText} accessibilityRole="alert">
                {error}
              </Text>
            ) : null}

            <Pressable
              onPress={handleChangeEmail}
              accessibilityRole="button"
              accessibilityLabel="Change email"
            >
              <Text style={styles.changeEmailLink}>Change Email</Text>
            </Pressable>
          </View>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F4F2F8",
  },
  gradient: {
    flex: 1,
    paddingHorizontal: 24,
  },
  scroll: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  body: {
    flex: 1,
    marginTop: 24,
  },
  emailButton: {
    borderRadius: 25,
    overflow: "hidden",
    marginTop: 20,
    // @ts-ignore - web only
    boxShadow: "0px 10px 24px rgba(124, 58, 237, 0.25)",
    elevation: 6,
  },
  emailButtonGradient: {
    height: 56,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  emailButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "700",
  },
  enterCodeLink: {
    color: "#7C3AED",
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 22,
    paddingVertical: 8,
  },
  resendSection: {
    alignItems: "center",
    marginTop: 28,
  },
  resendHint: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 8,
  },
  resendText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#7C3AED",
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  resendTextDisabled: {
    color: "#9CA3AF",
  },
  errorText: {
    color: "#EF4444",
    textAlign: "center",
    fontSize: 14,
    fontWeight: "500",
    marginTop: 16,
  },
  changeEmailLink: {
    color: "#6B7280",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 20,
    paddingVertical: 8,
  },
});
