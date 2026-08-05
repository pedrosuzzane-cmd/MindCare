import { API_URL } from "@/backend/config";
import AuthHeader from "@/components/auth/AuthHeader";
import EmailInput from "@/components/auth/EmailInput";
import { resetFlow } from "@/utils/resetFlow";
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

export default function ForgotPasswordScreen() {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const validateEmail = (val: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(val.toLowerCase());

  const handleSubmit = async () => {
    setError(null);
    setInfo(null);
    const emailClean = email.trim().toLowerCase();

    if (!validateEmail(emailClean)) {
      setError("Please enter a valid email address.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `${API_URL}/api/auth/forgot-password/request`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: emailClean }),
        },
      );
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Unable to send verification code.");
        return;
      }

      resetFlow.setEmail(emailClean);
      setInfo(
        "If an account with that email exists, a reset code has been sent.",
      );
      router.push("/auth/check-email");
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
                icon="leaf-outline"
                title="Forgot Password"
                subtitle="Enter the email associated with your MindCare account."
                reassurance="Don't worry, we'll help you regain access to your account securely."
              />

              <View style={styles.form}>
                <EmailInput
                  value={email}
                  onChangeText={setEmail}
                  error={error}
                  editable={!loading}
                  onSubmit={handleSubmit}
                />

                {info ? (
                  <Text style={styles.info} accessibilityRole="alert">
                    {info}
                  </Text>
                ) : null}

                <Pressable
                  style={[styles.button, loading && styles.buttonDisabled]}
                  onPress={handleSubmit}
                  disabled={loading}
                  accessibilityRole="button"
                  accessibilityLabel="Send verification code"
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
                      <Text style={styles.buttonText}>
                        Send Verification Code
                      </Text>
                    )}
                  </LinearGradient>
                </Pressable>

                <Text style={styles.helper}>
                  We'll send a 6-digit verification code that expires in 5
                  minutes.
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
  info: {
    color: "#059669",
    textAlign: "center",
    fontSize: 14,
    fontWeight: "500",
    marginTop: 8,
  },
});
