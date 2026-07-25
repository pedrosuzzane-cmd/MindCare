import { useAuth } from "@/hooks/AuthContext";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Href, Redirect, router } from "expo-router";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { handleSignOut } from "@/services/authService";

const FEATURES = [
  {
    title: "Daily Reminders",
    description: "Set helpful reminders for your day",
    icon: "notifications",
    color: "#2196F3",
    route: "/daily-reminders",
  },
  {
    title: "Daily Journal",
    description: "Reflect on your thoughts and feelings",
    icon: "book",
    color: "#4CAF50",
    route: "/daily-journal",
  },
  {
    title: "Self-Assessment",
    description: "Check in with your mental wellness",
    icon: "clipboard",
    color: "#9C27B0",
    route: "/self-assessment-menu",
  },
  {
    title: "Achievements",
    description: "Celebrate your healthy habits",
    icon: "trophy",
    color: "#FF9800",
    route: "/achievements",
  },
  {
    title: "Wellness Suggestions",
    description: "AI-powered tips based on your journal",
    icon: "bulb",
    color: "#00BCD4",
    route: "/journal-suggestions",
  },
  {
    title: "Hotline Access",
    description: "Connect with support when you need it",
    icon: "call",
    color: "#E91E63",
    route: "/support-hotlines",
  },
] as const;

export default function DashboardScreen() {
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const { user, role } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  // Automatically adjust columns based on screen width
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;
  const numColumns = isDesktop ? 3 : 2;
  const CARD_GAP = 16;
  const CONTAINER_PADDING = 48; // 24px padding on each side
  const CARD_WIDTH = Math.floor(
    (width - CONTAINER_PADDING - CARD_GAP * (numColumns - 1)) / numColumns,
  );

  // Safety check: If an admin somehow lands here, redirect them.
  if (role === "admin") {
    return <Redirect href="/admin-panel" />;
  }

  if (!user) {
    return <Redirect href="/auth/login" />;
  }

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    return "Good Evening";
  };

  const doSignOut = async () => {
    setSigningOut(true);
    try {
      await handleSignOut(router);
      console.log("Sign out successful");
    } catch (err) {
      console.error("Logout error", err);
      setSigningOut(false);
    }
  };

  const handleLogoutPress = () => {
    setShowLogoutConfirm(true);
  };

  function FeatureCard({ feature }: { feature: (typeof FEATURES)[number] }) {
    const scaleAnim = useRef(new Animated.Value(1)).current;

    const handlePressIn = () =>
      Animated.spring(scaleAnim, {
        toValue: 0.96,
        useNativeDriver: Platform.OS !== "web",
      }).start();
    const handlePressOut = () =>
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: Platform.OS !== "web",
      }).start();

    return (
      <Animated.View
        style={[{ transform: [{ scale: scaleAnim }], width: CARD_WIDTH }]}
      >
        <Pressable
          style={styles.card}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          onPress={() => router.push(feature.route as Href)}
        >
          <View style={[styles.cardIcon, { backgroundColor: feature.color }]}>
            <Ionicons name={feature.icon} size={24} color="white" />
          </View>
          <Text style={styles.cardTitle}>{feature.title}</Text>
          <Text style={styles.cardDescription}>{feature.description}</Text>
        </Pressable>
      </Animated.View>
    );
  }

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
            <Text style={styles.greeting}>
              {getGreeting()}, {user?.displayName?.split(" ")[0] || "there"}!
            </Text>
            <Text style={styles.subtitle}>
              How are you feeling today? Remember, taking care of your mental
              health is important.
            </Text>
          </View>

          {/* Feature Cards */}
          <View style={styles.cardsContainer}>
            {FEATURES.map((feature) => (
              <FeatureCard key={feature.route} feature={feature} />
            ))}
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
    alignItems: "flex-start",
    paddingTop: 20,
    paddingBottom: 30,
  },
  logoContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  logoIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "white",
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
    fontWeight: "700",
    color: "white",
  },
  chatButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  greetingSection: {
    marginBottom: 30,
  },
  greeting: {
    fontSize: 32,
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
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 16,
    marginBottom: 30,
  },
  card: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 16,
    boxShadow: "0px 4px 8px rgba(0,0,0,0.1)",
    elevation: 6,
    gap: 12,
  },
  cardIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "flex-start",
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  cardDescription: {
    fontSize: 13,
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
