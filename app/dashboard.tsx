import { auth } from "@/constants/firebase";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { signOut } from "firebase/auth";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";

export default function DashboardScreen() {
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 18) return "Good Afternoon";
    return "Good Evening";
  };

  const handleFeaturePress = (feature: string) => {
    // Handle feature navigation
    if (feature === "Daily Reminders") {
      router.push("/daily-reminders");
    } else if (feature === "Daily Journal") {
      router.push("/daily-journal");
    } else if (feature === "Self-Assessment") {
      router.push("/self-assessment-menu");
    } else if (feature === "Hotline Access") {
      router.push("/support-hotlines");
    } else {
      console.log(`${feature} pressed`);
    }
  };
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const doSignOut = async () => {
    console.log("Signing out user", auth.currentUser?.uid);
    setSigningOut(true);
    try {
      await signOut(auth);
      console.log("Sign out successful");
    } catch (err) {
      console.error("Logout error", err);
    } finally {
      setSigningOut(false);
      // Redirect to login regardless of signOut result to avoid stuck UI
      router.replace("/login");
    }
  };

  const handleLogoutPress = () => {
    console.log("Logout pressed");
    setShowLogoutConfirm(true);
  };

  const [signingOut, setSigningOut] = useState(false);

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={["#2196F3", "#00BCD4", "#4CAF50"]}
        style={styles.gradient}
      >
        <ScrollView
          style={styles.scrollContainer}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <View style={styles.logoIcon}>
                <Text style={styles.heartIcon}>♥</Text>
              </View>
              <Text style={styles.logoText}>MindCare</Text>
            </View>
            <View style={styles.rightButtons}>
              <Pressable
                style={styles.profileButton}
                onPress={() => router.push("/profile")}
              >
                <Ionicons
                  name="person-circle-outline"
                  size={26}
                  color="white"
                />
              </Pressable>
              <Pressable style={styles.chatButton} onPress={handleLogoutPress}>
                <Ionicons name="log-out-outline" size={24} color="white" />
              </Pressable>
            </View>
          </View>

          {/* Greeting Section */}
          <View style={styles.greetingSection}>
            <Text style={styles.greeting}>{getGreeting()},</Text>
            <Text style={styles.subtitle}>
              How are you feeling today? Remember, taking care of your mental
              health is important.
            </Text>
          </View>

          {/* Feature Cards */}
          <View style={styles.cardsContainer}>
            {/* Daily Reminders */}
            <Pressable
              style={styles.card}
              onPress={() => handleFeaturePress("Daily Reminders")}
            >
              <View style={styles.cardContent}>
                <View style={[styles.cardIcon, { backgroundColor: "#2196F3" }]}>
                  <Ionicons name="notifications" size={24} color="white" />
                </View>
                <View style={styles.cardText}>
                  <Text style={styles.cardTitle}>Daily Reminders</Text>
                  <Text style={styles.cardDescription}>
                    Set helpful reminders for your day
                  </Text>
                </View>
              </View>
            </Pressable>

            {/* Daily Journal */}
            <Pressable
              style={styles.card}
              onPress={() => handleFeaturePress("Daily Journal")}
            >
              <View style={styles.cardContent}>
                <View style={[styles.cardIcon, { backgroundColor: "#4CAF50" }]}>
                  <Ionicons name="book" size={24} color="white" />
                </View>
                <View style={styles.cardText}>
                  <Text style={styles.cardTitle}>Daily Journal</Text>
                  <Text style={styles.cardDescription}>
                    Reflect on your thoughts and feelings
                  </Text>
                </View>
              </View>
            </Pressable>

            {/* Self-Assessment */}
            <Pressable
              style={styles.card}
              onPress={() => handleFeaturePress("Self-Assessment")}
            >
              <View style={styles.cardContent}>
                <View style={[styles.cardIcon, { backgroundColor: "#9C27B0" }]}>
                  <Ionicons name="clipboard" size={24} color="white" />
                </View>
                <View style={styles.cardText}>
                  <Text style={styles.cardTitle}>Self-Assessment</Text>
                  <Text style={styles.cardDescription}>
                    Check in with your mental wellness
                  </Text>
                </View>
              </View>
            </Pressable>

            {/* Hotline Access */}
            <Pressable
              style={styles.card}
              onPress={() => handleFeaturePress("Hotline Access")}
            >
              <View style={styles.cardContent}>
                <View style={[styles.cardIcon, { backgroundColor: "#E91E63" }]}>
                  <Ionicons name="call" size={24} color="white" />
                </View>
                <View style={styles.cardText}>
                  <Text style={styles.cardTitle}>Hotline Access</Text>
                  <Text style={styles.cardDescription}>
                    Connect with support when you need it
                  </Text>
                </View>
              </View>
            </Pressable>
          </View>

          {/* Inspirational Quote */}
          <View style={styles.quoteContainer}>
            <Text style={styles.quote}>
              &quot;Your mental health is a priority. Your happiness is
              essential. Your self-care is a necessity.&quot;
            </Text>
          </View>
          {signingOut && (
            <View style={styles.signOutOverlay} pointerEvents="auto">
              <View style={styles.signOutBox}>
                <ActivityIndicator size="large" color="#ffffff" />
                <Text style={styles.signOutText}>Signing out...</Text>
              </View>
            </View>
          )}
          {showLogoutConfirm && (
            <View style={styles.confirmOverlay} pointerEvents="auto">
              <View style={styles.confirmBox}>
                <Text style={styles.confirmTitle}>Confirm Logout</Text>
                <Text style={styles.confirmMessage}>
                  Are you sure you want to logout?
                </Text>
                <View style={styles.confirmButtons}>
                  <Pressable
                    style={[styles.confirmButton, styles.cancelButton]}
                    onPress={() => setShowLogoutConfirm(false)}
                  >
                    <Text style={styles.cancelText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.confirmButton, styles.logoutButton]}
                    onPress={() => {
                      setShowLogoutConfirm(false);
                      doSignOut();
                    }}
                  >
                    <Text style={styles.logoutText}>Logout</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          )}
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 20,
    paddingBottom: 30,
  },
  logoContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  logoIcon: {
    width: 32,
    height: 32,
    backgroundColor: "white",
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  heartIcon: {
    fontSize: 16,
    color: "#2196F3",
    fontWeight: "bold",
  },
  logoText: {
    fontSize: 18,
    fontWeight: "600",
    color: "white",
  },
  chatButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  rightButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  profileButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  greetingSection: {
    marginBottom: 30,
  },
  greeting: {
    fontSize: 28,
    fontWeight: "600",
    color: "white",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "rgba(255, 255, 255, 0.9)",
    lineHeight: 22,
  },
  cardsContainer: {
    gap: 16,
    marginBottom: 30,
  },
  card: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  cardContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  cardIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  cardText: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 14,
    color: "#666",
    lineHeight: 20,
  },
  quoteContainer: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
  },
  quote: {
    fontSize: 16,
    color: "white",
    textAlign: "center",
    fontStyle: "italic",
    lineHeight: 24,
  },
  signOutOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  signOutBox: {
    padding: 20,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    gap: 12,
  },
  signOutText: {
    color: "white",
    marginTop: 8,
    fontSize: 16,
  },
  confirmOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  confirmBox: {
    width: "86%",
    padding: 20,
    borderRadius: 12,
    backgroundColor: "white",
    alignItems: "center",
    gap: 12,
  },
  confirmTitle: { fontSize: 18, fontWeight: "600", color: "#333" },
  confirmMessage: { fontSize: 14, color: "#666", textAlign: "center" },
  confirmButtons: {
    flexDirection: "row",
    width: "100%",
    justifyContent: "space-between",
    marginTop: 8,
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    marginHorizontal: 6,
  },
  cancelButton: { backgroundColor: "#F0F0F0" },
  logoutButton: { backgroundColor: "#E53935" },
  cancelText: { color: "#333", fontWeight: "600" },
  logoutText: { color: "white", fontWeight: "600" },
});
