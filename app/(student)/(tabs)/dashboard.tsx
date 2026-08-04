import { useAuth } from "@/hooks/AuthContext";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Href, Redirect, router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSidePanel } from "@/contexts/SidePanelContext";
import GeminiChat from "@/components/GeminiChat";

const FEATURES = [
  {
    title: "Daily Reminders",
    description: "Set helpful reminders for your day",
    icon: "notifications",
    color: "#8A63D2",
    route: "/daily-reminders",
  },
  {
    title: "Daily Journal",
    description: "Reflect on your thoughts and feelings",
    icon: "book",
    color: "#8A63D2",
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
    color: "#9C7EEB",
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
  const { user, role } = useAuth();
  const { toggle: toggleSidePanel } = useSidePanel();

  // Automatically adjust columns based on screen width
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;
  const numColumns = isDesktop ? 3 : 2;

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
        style={[{ transform: [{ scale: scaleAnim }], flex: 1 }]}
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
        colors={["#9C7EEB", "#8A63D2", "#7C5AC8"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
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
                <Image
                  source={require("@/assets/images/applogo.png")}
                  style={styles.logoIconImage}
                  resizeMode="contain"
                />
              </View>
              <Text style={styles.logoText}>MindCare</Text>
            </View>
            <View style={styles.rightButtons}>
              <Pressable
                style={styles.profileButton}
                onPress={toggleSidePanel}
              >
                <Ionicons name="menu" size={26} color="white" />
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
            {Array.from({ length: Math.ceil(FEATURES.length / numColumns) }).map(
              (_, rowIdx) => {
                const rowFeatures = FEATURES.slice(
                  rowIdx * numColumns,
                  rowIdx * numColumns + numColumns,
                );
                return (
                  <View key={rowIdx} style={styles.cardRow}>
                    {rowFeatures.map((feature) => (
                      <FeatureCard key={feature.route} feature={feature} />
                    ))}
                  </View>
                );
              },
            )}
          </View>

          {/* Inspirational Quote */}
          <View style={styles.quoteContainer}>
            <Text style={styles.quote}>
              &quot;Your mental health is a priority. Your happiness is
              essential. Your self-care is a necessity.&quot;
            </Text>
          </View>
        </ScrollView>

        {/* Floating AI Chat Bubble */}
        <GeminiChat />
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
    overflow: "hidden",
  },
  logoIconImage: {
    width: 22,
    height: 22,
  },
  logoText: {
    fontSize: 18,
    fontWeight: "700",
    color: "white",
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
    gap: 16,
    marginBottom: 30,
  },
  cardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 16,
  },
  card: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 18,
    // @ts-ignore — web-only shadow property
    boxShadow: "0px 4px 16px rgba(138, 99, 210, 0.10)",
    elevation: 4,
    gap: 12,
    borderWidth: 1,
    borderColor: "rgba(156, 126, 235, 0.08)",
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
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.18)",
  },
  quote: {
    fontSize: 16,
    color: "white",
    textAlign: "center",
    fontStyle: "italic",
    lineHeight: 24,
  },
  chatButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
});
