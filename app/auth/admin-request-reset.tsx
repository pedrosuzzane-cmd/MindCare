import { API_URL } from "@/backend/config";
import AuthHeader from "@/components/auth/AuthHeader";
import EmailInput from "@/components/auth/EmailInput";
import { adminResetFlow } from "@/utils/adminResetFlow";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function AdminRequestResetScreen() {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateEmail = (val: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(val.toLowerCase());

  const handleSubmit = async () => {
    setError(null);
    const emailClean = email.trim().toLowerCase();

    if (!validateEmail(emailClean)) {
      setError("Please enter a valid email address.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `${API_URL}/api/admin/request-password-reset`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: emailClean }),
        },
      );
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Unable to send the request.");
        return;
      }

      adminResetFlow.setEmail(emailClean);
      if (data.requestId) {
        adminResetFlow.setRequestId(data.requestId);
      }
      if (data.otpExpiresAtMs) {
        adminResetFlow.setOtpExpiresAt(data.otpExpiresAtMs);
      }

      if (data.status === "approved") {
        router.replace("/auth/admin-verify-otp");
        return;
      }
      router.replace("/auth/admin-request-submitted");
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1 }}
    >
      <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
        <LinearGradient
          colors={["#E8E0F5", "#F4F2F8", "#E8E0F5"]}
          style={styles.gradient}
        >
          <TouchableWithoutFeedback
            onPress={Keyboard.dismiss}
            accessible={false}
          >
            <ScrollView
              contentContainerStyle={styles.scroll}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              <AuthHeader
                onBack={() => router.back()}
                icon="shield-outline"
                title="Forgot Administrator Password"
                subtitle="Enter your university email to request a password reset."
                reassurance="Your request will be reviewed and approved by the Super Administrator."
              />

              <View style={styles.form}>
                <EmailInput
                  value={email}
                  onChangeText={setEmail}
                  error={error}
                  editable={!loading}
                  onSubmit={handleSubmit}
                />

                <Pressable
                  style={[styles.button, loading && styles.buttonDisabled]}
                  onPress={handleSubmit}
                  disabled={loading}
                  accessibilityRole="button"
                  accessibilityLabel="Request password reset"
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
                      <Text style={styles.buttonText}>Request Password Reset</Text>
                    )}
                  </LinearGradient>
                </Pressable>

                <Text style={styles.helper}>
                  No code is sent immediately. You'll receive an email once the
                  Super Administrator approves your request.
                </Text>

                <Pressable
                  onPress={() => router.replace("/auth/login")}
                  accessibilityRole="button"
                  accessibilityLabel="Back to login"
                >
                  <Text style={styles.loginLink}>Back to Login</Text>
                </Pressable>
              </View>
            </ScrollView>
          </TouchableWithoutFeedback>
        </LinearGradient>
      </SafeAreaView>
    </KeyboardAvoidingView>
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
  form: {
    flex: 1,
    marginTop: 28,
  },
  button: {
    borderRadius: 25,
    overflow: "hidden",
    marginTop: 20,
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
  helper: {
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 19,
    marginTop: 14,
    paddingHorizontal: 8,
  },
  loginLink: {
    color: "#7C3AED",
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 28,
    paddingVertical: 8,
  },
});
