import { auth } from "@/constants/firebase";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { signInWithEmailAndPassword } from "firebase/auth";
import React, { useState } from "react";
import {
    ActivityIndicator,
    Alert,
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

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Error", "Please enter both email and password.");
      return;
    }

    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      // Auth listener or layout handles redirection
    } catch (error: any) {
      Alert.alert("Login Failed", error.message || "Invalid credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} bounces={false}>
        {/* Top Gradient Header with Logo */}
        <LinearGradient
          colors={["#00C6FF", "#0072FF", "#5B247A"]}
          style={styles.headerGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.logoContainer}>
            <Image
              source={require("@/app/assets/images/logoicon.png")}
              style={styles.logoImage}
              resizeMode="contain"
            />
            {/* Brand title removed since logo contains it */}
          </View>
        </LinearGradient>

        {/* White Content Container with Curve/Overlap effect */}
        <View style={styles.formCard}>
          <Text style={styles.welcomeTitle}>Welcome back !</Text>
          <Text style={styles.welcomeSubtitle}>Please sign in to continue</Text>

          {/* Email / Username Input */}
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Email or Username"
              placeholderTextColor="#94A3B8"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          {/* Password Input */}
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="#94A3B8"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
            />
            <Pressable
              style={styles.eyeIcon}
              onPress={() => setShowPassword(!showPassword)}
            >
              <Ionicons
                name={showPassword ? "eye-outline" : "eye-off-outline"}
                size={20}
                color="#94A3B8"
              />
            </Pressable>
          </View>

          {/* Forgot Password */}
          <Pressable
            style={styles.forgotContainer}
            onPress={() => alert("Password reset feature coming soon!")}
          >
            <Text style={styles.forgotText}>Forgot password?</Text>
          </Pressable>

          {/* Primary Login Button */}
          <Pressable
            style={styles.loginButton}
            onPress={handleLogin}
            disabled={loading}
          >
            <LinearGradient
              colors={["#0072FF", "#5B247A"]}
              style={styles.gradientButton}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.loginButtonText}>Login</Text>
              )}
            </LinearGradient>
          </Pressable>

          {/* Register Redirect */}
          <View style={styles.footerContainer}>
            <Text style={styles.footerText}>New user? </Text>
            <Pressable onPress={() => router.push("/register")}>
              <Text style={styles.signupText}>Sign Up</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0072FF",
  },
  scrollContent: {
    flexGrow: 1,
  },
  headerGradient: {
    height: 260,
    paddingTop: 40, // Moves content higher toward the top status bar
    alignItems: "center",
    justifyContent: "flex-start", // Aligns logo towards the top instead of center
  },
  logoContainer: {
    alignItems: "center",
    marginTop: 20,
  },
  logoImage: {
    width: 100,
    height: 100,
  },
  formCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    marginTop: -40,
    paddingHorizontal: 30,
    paddingTop: 40,
    paddingBottom: 40,
    // @ts-ignore - web only
    boxShadow: "0px -10px 30px rgba(0, 0, 0, 0.05)",
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: "900",
    color: "#0F172A",
    marginBottom: 6,
  },
  welcomeSubtitle: {
    fontSize: 14,
    color: "#64748B",
    marginBottom: 32,
    fontWeight: "600",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 16,
    paddingHorizontal: 18,
    height: 56,
  },
  input: {
    flex: 1,
    color: "#0F172A",
    fontSize: 15,
    fontWeight: "600",
  },
  eyeIcon: {
    padding: 4,
  },
  forgotContainer: {
    alignItems: "flex-end",
    marginBottom: 32,
  },
  forgotText: {
    color: "#0072FF",
    fontSize: 13,
    fontWeight: "700",
  },
  loginButton: {
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 24,
    // @ts-ignore - web only
    boxShadow: "0px 8px 20px rgba(0, 114, 255, 0.3)",
  },
  gradientButton: {
    height: 56,
    justifyContent: "center",
    alignItems: "center",
  },
  loginButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  footerContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  footerText: {
    color: "#64748B",
    fontSize: 14,
    fontWeight: "600",
  },
  signupText: {
    color: "#0072FF",
    fontSize: 14,
    fontWeight: "800",
  },
});
