import { API_URL } from "@/backend/config";
import AuthHeader from "@/components/auth/AuthHeader";
import CountdownTimer from "@/components/auth/CountdownTimer";
import OTPInput from "@/components/auth/OTPInput";
import { resetFlow } from "@/utils/resetFlow";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMindCareTheme } from "@/contexts/ThemeContext";
import type { MindCareTheme } from "@/constants/theme";

const OTP_TOTAL_SECONDS = 5 * 60;
const MAX_ATTEMPTS = 5;

export default function OtpVerificationScreen() {
  const { theme } = useMindCareTheme();
  const styles = createStyles(theme);
  const email = resetFlow.getEmail();
  const [code, setCode] = useState("");
  const [expiresAt, setExpiresAt] = useState(
    () => Date.now() + OTP_TOTAL_SECONDS * 1000,
  );
  const [attemptsRemaining, setAttemptsRemaining] = useState(MAX_ATTEMPTS);
  const [cooldown, setCooldown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const cooldownTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const verifying = useRef(false);

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
      const response = await fetch(
        `${API_URL}/api/auth/forgot-password/verify`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, otp: codeClean }),
        },
      );
      const data = await response.json();

      if (!response.ok) {
        if (typeof data.attemptsRemaining === "number") {
          setAttemptsRemaining(data.attemptsRemaining);
        }
        setError(data.error || "Unable to verify the code.");
        setCode("");
        return;
      }

      resetFlow.setToken(data.resetToken);
      router.replace("/auth/reset-password");
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      verifying.current = false;
      setLoading(false);
    }
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
      setCode("");
      setExpiresAt(Date.now() + OTP_TOTAL_SECONDS * 1000);
      setAttemptsRemaining(MAX_ATTEMPTS);
      setExpired(false);
      startCooldown();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleChangeEmail = () => {
    resetFlow.clear();
    router.replace("/auth/forgot-password");
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={theme.softGradient}
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
            subtitle="Enter the verification code we sent to your email."
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
                color={theme.secondaryText}
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
                colors={theme.headerGradient}
                style={styles.buttonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                {loading ? (
                  <ActivityIndicator color={theme.onPrimary} />
                ) : (
                  <Text style={styles.buttonText}>Verify Code</Text>
                )}
              </LinearGradient>
            </Pressable>

            <View style={styles.resendSection}>
              <Pressable
                onPress={handleResend}
                disabled={cooldown > 0 || loading}
                accessibilityRole="button"
                accessibilityLabel={
                  cooldown > 0 ? `Resend in ${cooldown} seconds` : "Resend code"
                }
              >
                <Text
                  style={[
                    styles.resendText,
                    cooldown > 0 && styles.resendTextDisabled,
                  ]}
                >
                  {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend Code"}
                </Text>
              </Pressable>
            </View>

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

const createStyles = (theme: MindCareTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
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
      color: theme.secondaryText,
      fontWeight: "500",
    },
    errorText: {
      color: theme.status.error,
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
      boxShadow: `0px 10px 24px ${theme.shadow}`,
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
      color: theme.onPrimary,
      fontSize: 16,
      fontWeight: "700",
    },
    resendSection: {
      alignItems: "center",
      marginTop: 24,
    },
    resendText: {
      fontSize: 15,
      fontWeight: "700",
      color: theme.primary,
      paddingVertical: 8,
      paddingHorizontal: 12,
    },
    resendTextDisabled: {
      color: theme.secondaryText,
    },
    changeEmailLink: {
      color: theme.secondaryText,
      fontSize: 14,
      fontWeight: "600",
      textAlign: "center",
      marginTop: 16,
      paddingVertical: 8,
    },
  });
