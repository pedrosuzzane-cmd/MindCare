import { API_URL } from "@/backend/config";
import AuthHeader from "@/components/auth/AuthHeader";
import CountdownTimer from "@/components/auth/CountdownTimer";
import OTPInput from "@/components/auth/OTPInput";
import { adminResetFlow } from "@/utils/adminResetFlow";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const OTP_TOTAL_SECONDS = 5 * 60;
const MAX_ATTEMPTS = 5;

export default function AdminVerifyOtpScreen() {
  const insets = useSafeAreaInsets();
  const requestId = adminResetFlow.getRequestId();
  const savedExpiresAt = adminResetFlow.getOtpExpiresAt();
  const [code, setCode] = useState("");
  const [expiresAt, setExpiresAt] = useState<number>(() =>
    savedExpiresAt && savedExpiresAt > Date.now()
      ? savedExpiresAt
      : Date.now() + OTP_TOTAL_SECONDS * 1000,
  );
  const [attemptsRemaining, setAttemptsRemaining] = useState(MAX_ATTEMPTS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const verifying = useRef(false);

  useEffect(() => {
    if (!requestId) router.replace("/auth/admin-request-reset");
  }, [requestId]);

  const handleVerify = async (otp?: string) => {
    if (verifying.current) return;
    const codeClean = (otp || code).trim();

    if (!/^\d{6}$/.test(codeClean)) {
      setError("Enter the 6-digit code.");
      return;
    }
    if (expired) {
      setError("This code has expired. Please request a new one.");
      return;
    }

    verifying.current = true;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/api/admin/verify-reset-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, otp: codeClean }),
      });
      const data = await response.json();

      if (!response.ok) {
        if (typeof data.attemptsRemaining === "number") {
          setAttemptsRemaining(data.attemptsRemaining);
        }
        setError(data.error || "Unable to verify the code.");
        setCode("");
        return;
      }

      adminResetFlow.setResetToken(data.resetToken);
      router.replace("/auth/admin-new-password");
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      verifying.current = false;
      setLoading(false);
    }
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
          keyboardShouldPersistTaps="handled"
        >
          <AuthHeader
            onBack={() => router.back()}
            icon="keypad-outline"
            title="Verify Your Identity"
            subtitle="Enter the verification code sent to your email after approval."
          />

          <View style={styles.body}>
            <OTPInput
              value={code}
              onChangeText={setCode}
              onComplete={handleVerify}
              disabled={loading}
              error={error}
            />

            <View style={styles.statusRow}>
              <CountdownTimer
                expiresAt={expiresAt}
                totalSeconds={OTP_TOTAL_SECONDS}
                onExpire={() => setExpired(true)}
              />
            </View>

            <View style={styles.attemptsRow}>
              <Ionicons
                name="shield-checkmark-outline"
                size={16}
                color="#6B7280"
              />
              <Text style={styles.attemptsText}>
                Attempts Remaining: {attemptsRemaining}
              </Text>
            </View>

            {error ? (
              <Text style={styles.errorText} accessibilityRole="alert">
                {error}
              </Text>
            ) : null}

            <Pressable
              style={[styles.button, (loading || expired) && styles.buttonDisabled]}
              onPress={() => handleVerify()}
              disabled={loading || expired}
              accessibilityRole="button"
              accessibilityLabel="Verify code"
            >
              <LinearGradient
                colors={["#9C7EEB", "#8A63D2", "#7C5AC8"]}
                style={styles.buttonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                {loading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.buttonText}>Verify Code</Text>
                )}
              </LinearGradient>
            </Pressable>

            <Pressable
              onPress={() => router.replace("/auth/login")}
              accessibilityRole="button"
              accessibilityLabel="Back to login"
              style={styles.loginLinkWrap}
            >
              <Text style={styles.loginLink}>Back to Login</Text>
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
    marginTop: 32,
  },
  statusRow: {
    marginTop: 24,
  },
  attemptsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 6,
  },
  attemptsText: {
    fontSize: 14,
    color: "#6B7280",
    fontWeight: "500",
  },
  errorText: {
    color: "#EF4444",
    textAlign: "center",
    fontSize: 14,
    fontWeight: "500",
    marginTop: 14,
  },
  button: {
    borderRadius: 25,
    overflow: "hidden",
    marginTop: 24,
    // @ts-ignore - web only
    boxShadow: "0px 10px 24px rgba(124, 58, 237, 0.25)",
    elevation: 6,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonGradient: {
    height: 56,
    justifyContent: "center",
    alignItems: "center",
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "700",
  },
  loginLinkWrap: {
    marginTop: 28,
  },
  loginLink: {
    color: "#6B7280",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
    paddingVertical: 8,
  },
});
