import { clearOobCode, getOobCode } from "@/utils/deeplinkStore";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";

// Firebase
import { auth } from "@/constants/firebase";
import {
  confirmPasswordReset,
  sendPasswordResetEmail,
  verifyPasswordResetCode,
} from "firebase/auth";

type Step = "email" | "code" | "newPassword" | "complete";

export default function ForgotPasswordScreen() {
  const [currentStep, setCurrentStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [pastedLink, setPastedLink] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // If an oobCode was stored by the deep-link handler, use it
    const oob = getOobCode();
    if (oob) {
      setResetCode(oob);
      setCurrentStep("code");
      clearOobCode();
    }
  }, []);

  const validateEmail = (email: string) => {
    const re =
      /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@(([^<>()[\]\\.,;:\s@\"]+\.)+[^<>()[\]\\.,;:\s@\"]{2,})$/i;
    return re.test(String(email).toLowerCase());
  };

  const validatePassword = (pw: string) => {
    return pw.length >= 8 && /[A-Za-z]/.test(pw) && /[0-9]/.test(pw);
  };

  const handleBack = () => {
    if (currentStep === "email") {
      router.back();
    } else if (currentStep === "code") {
      setCurrentStep("email");
      setError(null);
    } else if (currentStep === "newPassword") {
      setCurrentStep("code");
      setError(null);
    }
  };

  const handleSendResetCode = async () => {
    setError(null);

    const emailClean = email.trim().toLowerCase();

    if (!validateEmail(emailClean)) {
      setError("Please enter a valid email address.");
      return;
    }

    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, emailClean);
      setCurrentStep("code");
      Alert.alert(
        "Success",
        "Password reset email sent! Check your email for the reset code.",
      );
    } catch (err: any) {
      console.error("Send reset code error", err);
      if (err?.code === "auth/user-not-found") {
        setError("No account found with this email address.");
      } else if (err?.code === "auth/invalid-credential") {
        setError("The email address is not valid.");
      } else {
        setError(err?.message || "Unable to send password reset email.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    setError(null);

    if (!resetCode.trim()) {
      setError("Please enter the reset code.");
      return;
    }

    setLoading(true);
    try {
      // Verify that the code is valid
      await verifyPasswordResetCode(auth, resetCode);
      setCurrentStep("newPassword");
    } catch (err: any) {
      console.error("Verify code error", err);
      if (err?.code === "auth/invalid-action-code") {
        setError("Invalid or expired reset code. Please request a new one.");
      } else if (err?.code === "auth/expired-action-code") {
        setError("Reset code has expired. Please request a new one.");
      } else {
        setError(err?.message || "Invalid reset code.");
      }
    } finally {
      setLoading(false);
    }
  };

  const extractOobCodeFromUrl = (url: string) => {
    try {
      // Try using URL API first
      const parsed = new URL(url);
      const code = parsed.searchParams.get("oobCode");
      if (code) return code;
    } catch (e) {
      // fallback to regex
      const m = url.match(/[?&]oobCode=([^&]+)/);
      if (m && m[1]) return decodeURIComponent(m[1]);
    }
    return null;
  };

  const handleUseLink = () => {
    setError(null);
    if (!pastedLink.trim()) {
      setError("Paste a reset link first.");
      return;
    }
    const code = extractOobCodeFromUrl(pastedLink.trim());
    if (!code) {
      setError("No reset code found in the pasted link.");
      return;
    }
    setResetCode(code);
    // Optionally auto-verify the code
    // We'll leave it to the user to press Verify, but autofocus could be added.
  };

  const handleResetPassword = async () => {
    setError(null);

    if (!newPassword) {
      setError("Please enter a new password.");
      return;
    }

    if (!confirmPassword) {
      setError("Please confirm your password.");
      return;
    }

    if (!validatePassword(newPassword)) {
      setError(
        "Password must be at least 8 characters and include letters and numbers.",
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await confirmPasswordReset(auth, resetCode, newPassword);
      setCurrentStep("complete");
    } catch (err: any) {
      console.error("Reset password error", err);
      if (err?.code === "auth/invalid-action-code") {
        setError("Reset code is invalid or has expired.");
      } else if (err?.code === "auth/expired-action-code") {
        setError("Reset code has expired. Please request a new one.");
      } else {
        setError(err?.message || "Unable to reset password.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLoginRedirect = () => {
    router.push("/auth/login");
  };

  const renderStepIndicator = () => {
    const steps = ["email", "code", "newPassword", "complete"];
    const currentStepIndex = steps.indexOf(currentStep);

    return (
      <View style={styles.stepIndicatorContainer}>
        {steps.map((step, index) => (
          <View key={step} style={styles.stepWrapper}>
            <View
              style={[
                styles.stepCircle,
                index <= currentStepIndex && styles.stepCircleActive,
              ]}
            >
              {index < currentStepIndex ? (
                <Ionicons name="checkmark" size={16} color="white" />
              ) : (
                <Text
                  style={[
                    styles.stepNumber,
                    index <= currentStepIndex && styles.stepNumberActive,
                  ]}
                >
                  {index + 1}
                </Text>
              )}
            </View>
            {index < steps.length - 1 && (
              <View
                style={[
                  styles.stepLine,
                  index < currentStepIndex && styles.stepLineActive,
                ]}
              />
            )}
          </View>
        ))}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1 }}
    >
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={["#E8E0F5", "#F4F2F8", "#E8E0F5"]}
        style={styles.gradient}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          bounces={false}
          showsVerticalScrollIndicator={false}
        >
        {/* Header with back button */}
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={handleBack}>
            <Ionicons name="arrow-back" size={24} color="#666" />
          </Pressable>
        </View>

        {/* Step Indicator */}
        {renderStepIndicator()}

        {/* Icon */}
        <View style={styles.iconContainer}>
          <LinearGradient
            colors={["#9C7EEB", "#8A63D2", "#7C5AC8"]}
            style={styles.iconGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Ionicons name="key-outline" size={32} color="white" />
          </LinearGradient>
        </View>

        {/* Content based on current step */}
        {currentStep === "email" && (
          <>
            <Text style={styles.title}>Reset Password</Text>
            <Text style={styles.subtitle}>
              Enter your email address to receive a password reset code
            </Text>

            <View style={styles.formContainer}>
              <View style={styles.inputContainer}>
                <View style={styles.inputHeader}>
                  <Ionicons name="mail-outline" size={20} color="#666" />
                  <Text style={styles.inputLabel}>Email Address</Text>
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="Enter your email"
                  placeholderTextColor="#999"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  editable={!loading}
                />
              </View>
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <View style={styles.buttonContainer}>
              <Pressable onPress={handleSendResetCode} disabled={loading}>
                <LinearGradient
                  colors={["#9C7EEB", "#8A63D2", "#7C5AC8"]}
                  style={[styles.button, loading && { opacity: 0.6 }]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  {loading ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <Text style={styles.buttonText}>Send Reset Code</Text>
                  )}
                </LinearGradient>
              </Pressable>
            </View>
          </>
        )}

        {currentStep === "code" && (
          <>
            <Text style={styles.title}>Enter Reset Code</Text>
            <Text style={styles.subtitle}>
              Check your email for the password reset code
            </Text>

            <View style={styles.formContainer}>
              <View style={styles.inputContainer}>
                <View style={styles.inputHeader}>
                  <Ionicons name="link-outline" size={20} color="#666" />
                  <Text style={styles.inputLabel}>
                    Paste Reset Link (optional)
                  </Text>
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="Paste the full reset URL from email"
                  placeholderTextColor="#999"
                  value={pastedLink}
                  onChangeText={setPastedLink}
                  autoCapitalize="none"
                  editable={!loading}
                />
                <Pressable onPress={handleUseLink} style={{ marginTop: 8 }}>
                  <LinearGradient
                    colors={["#9C7EEB", "#8A63D2"]}
                    style={[
                      styles.button,
                      {
                        paddingVertical: 10,
                        borderRadius: 10,
                        alignItems: "center",
                      },
                    ]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    <Text style={[styles.buttonText, { fontSize: 14 }]}>
                      Use Pasted Link
                    </Text>
                  </LinearGradient>
                </Pressable>

                <View style={{ height: 12 }} />

                <View style={styles.inputHeader}>
                  <Ionicons name="key-outline" size={20} color="#666" />
                  <Text style={styles.inputLabel}>Reset Code</Text>
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="Enter the code from your email"
                  placeholderTextColor="#999"
                  value={resetCode}
                  onChangeText={setResetCode}
                  autoCapitalize="none"
                  editable={!loading}
                />
              </View>
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <View style={styles.buttonContainer}>
              <Pressable onPress={handleVerifyCode} disabled={loading}>
                <LinearGradient
                  colors={["#9C7EEB", "#8A63D2", "#7C5AC8"]}
                  style={[styles.button, loading && { opacity: 0.6 }]}
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
            </View>
          </>
        )}

        {currentStep === "newPassword" && (
          <>
            <Text style={styles.title}>Create New Password</Text>
            <Text style={styles.subtitle}>
              Enter your new password and confirm it
            </Text>

            <View style={styles.formContainer}>
              {/* New Password Input */}
              <View style={styles.inputContainer}>
                <View style={styles.inputHeader}>
                  <Ionicons name="lock-closed-outline" size={20} color="#666" />
                  <Text style={styles.inputLabel}>New Password</Text>
                </View>
                <View style={styles.passwordInputContainer}>
                  <TextInput
                    style={styles.passwordInput}
                    placeholder="Enter new password"
                    placeholderTextColor="#999"
                    value={newPassword}
                    onChangeText={setNewPassword}
                    secureTextEntry={!showNewPassword}
                    editable={!loading}
                  />
                  <Pressable
                    onPress={() => setShowNewPassword(!showNewPassword)}
                    style={styles.eyeIconButton}
                  >
                    <Ionicons
                      name={showNewPassword ? "eye-outline" : "eye-off-outline"}
                      size={20}
                      color="#666"
                    />
                  </Pressable>
                </View>
              </View>

              {/* Confirm Password Input */}
              <View style={styles.inputContainer}>
                <View style={styles.inputHeader}>
                  <Ionicons name="lock-closed-outline" size={20} color="#666" />
                  <Text style={styles.inputLabel}>Confirm Password</Text>
                </View>
                <View style={styles.passwordInputContainer}>
                  <TextInput
                    style={styles.passwordInput}
                    placeholder="Confirm new password"
                    placeholderTextColor="#999"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showConfirmPassword}
                    editable={!loading}
                  />
                  <Pressable
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                    style={styles.eyeIconButton}
                  >
                    <Ionicons
                      name={
                        showConfirmPassword ? "eye-outline" : "eye-off-outline"
                      }
                      size={20}
                      color="#666"
                    />
                  </Pressable>
                </View>
              </View>

              {/* Password Requirements */}
              <View style={styles.requirementsBox}>
                <Text style={styles.requirementsTitle}>
                  Password Requirements:
                </Text>
                <View style={styles.requirementItem}>
                  <Ionicons
                    name={
                      newPassword.length >= 8
                        ? "checkmark-circle"
                        : "close-circle"
                    }
                    size={16}
                    color={newPassword.length >= 8 ? "#8A63D2" : "#999"}
                  />
                  <Text style={styles.requirementText}>
                    At least 8 characters
                  </Text>
                </View>
                <View style={styles.requirementItem}>
                  <Ionicons
                    name={
                      /[A-Za-z]/.test(newPassword)
                        ? "checkmark-circle"
                        : "close-circle"
                    }
                    size={16}
                    color={/[A-Za-z]/.test(newPassword) ? "#8A63D2" : "#999"}
                  />
                  <Text style={styles.requirementText}>
                    Contains letters (A-Z, a-z)
                  </Text>
                </View>
                <View style={styles.requirementItem}>
                  <Ionicons
                    name={
                      /[0-9]/.test(newPassword)
                        ? "checkmark-circle"
                        : "close-circle"
                    }
                    size={16}
                    color={/[0-9]/.test(newPassword) ? "#8A63D2" : "#999"}
                  />
                  <Text style={styles.requirementText}>
                    Contains numbers (0-9)
                  </Text>
                </View>
                <View style={styles.requirementItem}>
                  <Ionicons
                    name={
                      newPassword === confirmPassword &&
                      confirmPassword.length > 0
                        ? "checkmark-circle"
                        : "close-circle"
                    }
                    size={16}
                    color={
                      newPassword === confirmPassword &&
                      confirmPassword.length > 0
                        ? "#8A63D2"
                        : "#999"
                    }
                  />
                  <Text style={styles.requirementText}>Passwords match</Text>
                </View>
              </View>
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <View style={styles.buttonContainer}>
              <Pressable onPress={handleResetPassword} disabled={loading}>
                <LinearGradient
                  colors={["#9C7EEB", "#8A63D2", "#7C5AC8"]}
                  style={[styles.button, loading && { opacity: 0.6 }]}
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
          </>
        )}

        {currentStep === "complete" && (
          <>
            <Text style={styles.title}>Password Reset Successful!</Text>
            <Text style={styles.subtitle}>
              Your password has been successfully updated
            </Text>

            <View style={styles.successContainer}>
              <LinearGradient
                colors={["#9C7EEB", "#8A63D2", "#7C5AC8"]}
                style={styles.successIconContainer}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons
                  name="checkmark-done-circle"
                  size={48}
                  color="white"
                />
              </LinearGradient>
              <Text style={styles.successText}>
                Your password has been updated successfully. You can now log in
                with your new password.
              </Text>
            </View>

            <View style={styles.buttonContainer}>
              <Pressable onPress={handleLoginRedirect}>
                <LinearGradient
                  colors={["#9C7EEB", "#8A63D2", "#7C5AC8"]}
                  style={styles.button}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Text style={styles.buttonText}>Back to Login</Text>
                </LinearGradient>
              </Pressable>
            </View>
          </>
        )}
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
    paddingHorizontal: 24,
  },
  header: {
    paddingTop: 20,
    paddingBottom: 12,
  },
  backButton: {
    width: 44,
    height: 44,
    backgroundColor: "white",
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    boxShadow: "0px 2px 4px rgba(0,0,0,0.1)",
    elevation: 3,
  },
  stepIndicatorContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  stepWrapper: {
    alignItems: "center",
  },
  stepCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F3EAFF",
    borderWidth: 2,
    borderColor: "#E0D0FF",
    justifyContent: "center",
    alignItems: "center",
  },
  stepCircleActive: {
    backgroundColor: "#8A63D2",
    borderColor: "#7C5AC8",
  },
  stepNumber: {
    fontSize: 14,
    fontWeight: "600",
    color: "#999",
  },
  stepNumberActive: {
    color: "white",
  },
  stepLine: {
    width: 30,
    height: 2,
    backgroundColor: "#E0D0FF",
    marginHorizontal: -22,
  },
  stepLineActive: {
    backgroundColor: "#8A63D2",
  },
  iconContainer: {
    alignItems: "center",
    marginBottom: 24,
  },
  iconGradient: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#8A63D2",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginBottom: 32,
  },
  formContainer: {
    flex: 1,
  },
  inputContainer: {
    marginBottom: 24,
  },
  inputHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  inputLabel: {
    fontSize: 14,
    color: "#666",
    marginLeft: 8,
    fontWeight: "500",
  },
  input: {
    backgroundColor: "white",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 12,
    fontSize: 16,
    color: "#333",
    boxShadow: "0px 1px 2px rgba(0,0,0,0.1)",
    elevation: 2,
  },
  passwordInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    borderRadius: 12,
    boxShadow: "0px 1px 2px rgba(0,0,0,0.1)",
    elevation: 2,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    color: "#333",
  },
  eyeIconButton: {
    paddingHorizontal: 12,
    paddingVertical: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  requirementsBox: {
    backgroundColor: "white",
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    boxShadow: "0px 1px 2px rgba(0,0,0,0.1)",
    elevation: 2,
  },
  requirementsTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 12,
  },
  requirementItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  requirementText: {
    fontSize: 14,
    color: "#666",
    marginLeft: 8,
  },
  successContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginVertical: 40,
  },
  successIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  successText: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    lineHeight: 24,
  },
  buttonContainer: {
    marginBottom: 40,
  },
  button: {
    paddingVertical: 18,
    borderRadius: 25,
    alignItems: "center",
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  errorText: {
    color: "#D32F2F",
    textAlign: "center",
    marginBottom: 12,
    fontSize: 14,
    fontWeight: "500",
  },
});
