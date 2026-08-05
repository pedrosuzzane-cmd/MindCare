import { API_URL } from "@/backend/config";
import AuthHeader from "@/components/auth/AuthHeader";
import PasswordStrength from "@/components/auth/PasswordStrength";
import { resetFlow } from "@/utils/resetFlow";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useEffect, useState } from "react";
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
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const COMMON_PASSWORDS = [
  "password",
  "password123",
  "password1234",
  "123456",
  "12345678",
  "123456789",
  "1234567890",
  "qwerty",
  "qwerty123",
  "abc123",
  "letmein",
  "admin",
  "admin123",
  "welcome",
  "welcome123",
  "iloveyou",
  "monkey",
  "dragon",
  "football",
  "baseball",
  "111111",
  "000000",
  "mindcare",
  "mindcare123",
];

export default function ResetPasswordScreen() {
  const insets = useSafeAreaInsets();
  const token = resetFlow.getToken();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) router.replace("/auth/forgot-password");
  }, [token]);

  const isValid = () =>
    password.length >= 12 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[^A-Za-z0-9]/.test(password);

  const handleReset = async () => {
    setError(null);

    if (!token) {
      router.replace("/auth/forgot-password");
      return;
    }
    if (COMMON_PASSWORDS.includes(password.toLowerCase())) {
      setError("This password is too common. Please choose a stronger one.");
      return;
    }
    if (!isValid()) {
      setError(
        "Password must be at least 12 characters and include an uppercase letter, a lowercase letter, a number, and a special character.",
      );
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `${API_URL}/api/auth/forgot-password/reset`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resetToken: token, newPassword: password }),
        },
      );
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Unable to reset password.");
        return;
      }

      resetFlow.clear();
      router.replace("/auth/password-success");
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  const renderPasswordField = (
    label: string,
    value: string,
    onChangeText: (t: string) => void,
    visible: boolean,
    onToggle: () => void,
    accessibilityLabel: string,
  ) => (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputWrap}>
        <TextInput
          style={styles.input}
          placeholder={label}
          placeholderTextColor="#9CA3AF"
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={!visible}
          autoCapitalize="none"
          autoCorrect={false}
          editable={!loading}
          accessibilityLabel={accessibilityLabel}
          accessibilityRole="text"
        />
        <Pressable
          onPress={onToggle}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={
            visible ? `Hide ${label}` : `Show ${label}`
          }
        >
          <Ionicons
            name={visible ? "eye-outline" : "eye-off-outline"}
            size={20}
            color="#94A3B8"
          />
        </Pressable>
      </View>
    </View>
  );

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
                icon="lock-closed-outline"
                title="Create New Password"
                subtitle="Your new password should be strong and unique."
                reassurance="It must be at least 12 characters and is checked live as you type."
              />

              <View style={styles.body}>
                {renderPasswordField(
                  "Password",
                  password,
                  setPassword,
                  showPassword,
                  () => setShowPassword((v) => !v),
                  "New password",
                )}
                {renderPasswordField(
                  "Confirm Password",
                  confirm,
                  setConfirm,
                  showConfirm,
                  () => setShowConfirm((v) => !v),
                  "Confirm new password",
                )}

                <PasswordStrength password={password} confirm={confirm} />

                {error ? (
                  <Text style={styles.errorText} accessibilityRole="alert">
                    {error}
                  </Text>
                ) : null}

                <Pressable
                  style={[styles.button, loading && styles.buttonDisabled]}
                  onPress={handleReset}
                  disabled={loading}
                  accessibilityRole="button"
                  accessibilityLabel="Reset password"
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
                      <Text style={styles.buttonText}>Reset Password</Text>
                    )}
                  </LinearGradient>
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
  body: {
    flex: 1,
    marginTop: 24,
  },
  field: {
    marginBottom: 18,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#4B5563",
    marginBottom: 8,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    borderRadius: 14,
    paddingHorizontal: 15,
    height: 56,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: "#1F2937",
  },
  errorText: {
    color: "#EF4444",
    textAlign: "center",
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 12,
  },
  button: {
    borderRadius: 25,
    overflow: "hidden",
    marginTop: 8,
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
});
