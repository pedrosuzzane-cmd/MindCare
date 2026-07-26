import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

export default function WelcomeScreen() {
  const handleLogin = () => {
    // Navigate to login screen
    router.push("/auth/login");
  };

  const handleRegister = () => {
    // Navigate to register screen
    router.push("/auth/register");
  };

  return (
    <LinearGradient
      colors={["#E8E0F5", "#F4F2F8", "#E8E0F5"]}
      style={styles.container}
    >
      {/* Heart Icon with Gradient Background */}
      <View style={styles.iconContainer}>
        <LinearGradient
          colors={["#B794F6", "#9C7EEB", "#8A63D2", "#7C5AC8"]}
          style={styles.iconGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.heartContainer}>
            <Text style={styles.heartIcon}>♥</Text>
          </View>
        </LinearGradient>
      </View>

      {/* App Title */}
      <Text style={styles.title}>MindCare</Text>

      {/* Subtitle */}
      <Text style={styles.subtitle}>
        Your personal mental wellness companion. Supporting students every step
        of the way.
      </Text>

      {/* Illustration Placeholder */}
      <View style={styles.illustrationContainer}>
        <View style={styles.illustrationPlaceholder}>
          {/* Simple nature illustration placeholder */}
          <View style={styles.plantStem} />
          <View style={styles.leaf1} />
          <View style={styles.leaf2} />
          <View style={styles.grass1} />
          <View style={styles.grass2} />
          <View style={styles.flower} />
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.buttonContainer}>
        <Pressable style={styles.loginButton} onPress={handleLogin}>
          <Text style={styles.loginButtonText}>Login</Text>
        </Pressable>

        <Pressable style={styles.registerButton} onPress={handleRegister}>
          <Text style={styles.registerButtonText}>Register</Text>
        </Pressable>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 40,
  },
  iconContainer: {
    marginBottom: 24,
  },
  iconGradient: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  heartContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  heartIcon: {
    fontSize: 32,
    color: "white",
    fontWeight: "bold",
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#8A63D2",
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 40,
    paddingHorizontal: 20,
  },
  illustrationContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 40,
  },
  illustrationPlaceholder: {
    width: 200,
    height: 200,
    backgroundColor: "#F5F5F0",
    borderRadius: 12,
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
  },
  plantStem: {
    position: "absolute",
    width: 3,
    height: 60,
    backgroundColor: "#8BC34A",
    bottom: 40,
    left: 100,
  },
  leaf1: {
    position: "absolute",
    width: 20,
    height: 12,
    backgroundColor: "#4CAF50",
    borderRadius: 10,
    bottom: 70,
    left: 85,
    transform: [{ rotate: "-30deg" }],
  },
  leaf2: {
    position: "absolute",
    width: 16,
    height: 10,
    backgroundColor: "#66BB6A",
    borderRadius: 8,
    bottom: 60,
    left: 110,
    transform: [{ rotate: "45deg" }],
  },
  grass1: {
    position: "absolute",
    width: 2,
    height: 20,
    backgroundColor: "#8BC34A",
    bottom: 20,
    left: 70,
  },
  grass2: {
    position: "absolute",
    width: 2,
    height: 25,
    backgroundColor: "#8BC34A",
    bottom: 20,
    left: 130,
  },
  flower: {
    position: "absolute",
    width: 8,
    height: 8,
    backgroundColor: "#F8BBD9",
    borderRadius: 4,
    bottom: 85,
    left: 98,
  },
  buttonContainer: {
    width: "100%",
    gap: 16,
  },
  loginButton: {
    backgroundColor: "#8A63D2",
    paddingVertical: 16,
    borderRadius: 25,
    alignItems: "center",
  },
  loginButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  registerButton: {
    backgroundColor: "white",
    paddingVertical: 16,
    borderRadius: 25,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  registerButtonText: {
    color: "#8A63D2",
    fontSize: 16,
    fontWeight: "600",
  },
});
