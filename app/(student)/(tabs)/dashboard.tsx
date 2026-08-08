import { useAuth } from "@/hooks/AuthContext";
import { Ionicons } from "@expo/vector-icons";
import { Href, Redirect, router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { auth, db } from "@/constants/firebase";
import { useAchievements } from "@/hooks/useAchievements";
import { useJournal } from "@/hooks/useJournal";
import { useReminderSettings } from "@/hooks/useReminderSettings";
import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
} from "firebase/firestore";

const FEATURES = [
  {
    title: "Daily Journal",
    description: "Reflect on your thoughts and feelings",
    emoji: "📔",
    color: "#8A63D2",
    route: "/daily-journal",
  },
  {
    title: "Self-Assessment",
    description: "Check in with your mental wellness",
    emoji: "🌱",
    color: "#10B981",
    route: "/self-assessment-menu",
  },
  {
    title: "Achievements",
    description: "Celebrate your healthy habits",
    emoji: "🏆",
    color: "#D97706",
    route: "/achievements",
  },
  {
    title: "Wellness Suggestions",
    description: "Tips based on your journal",
    emoji: "💡",
    color: "#0F766E",
    route: "/journal-suggestions",
  },
  {
    title: "Daily Reminders",
    description: "Set helpful reminders for your day",
    emoji: "💧",
    color: "#7C4DCC",
    route: "/daily-reminders",
  },
  {
    title: "Support",
    description: "Connect with support when you need it",
    emoji: "🤝",
    color: "#B56576",
    route: "/support-hotlines",
  },
 ] as const;

const CHECKIN_MOODS = [
  { emoji: "😄", label: "Happy" },
  { emoji: "😊", label: "Calm" },
  { emoji: "🙂", label: "Good" },
  { emoji: "😐", label: "Neutral" },
  { emoji: "😓", label: "Stressed" },
];

const WELLNESS_MESSAGES = [
  "Your mental health is a priority. Your happiness is essential. Your self-care is a necessity.",
  "Small steps every day add up to real progress.",
  "Rest is productive too — take the break you need.",
  "Be gentle with yourself; you're doing better than you think.",
  "Talking about how you feel is a sign of strength, not weakness.",
  "One breath at a time. You've got this.",
];

export default function DashboardScreen() {
  const { user, role } = useAuth();
  const { toggle: toggleSidePanel } = useSidePanel();

  const { achievements, totalEarned } = useAchievements();
  const { entries } = useJournal();
  const { reminders } = useReminderSettings();
  const [lastAssessment, setLastAssessment] = useState<Date | null>(null);

  // Automatically adjust columns based on screen width
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;
  const numColumns = isDesktop ? 3 : 2;

  // Last completed self-assessment (existing data only)
  useEffect(() => {
    let mounted = true;
    (async () => {
      const current = auth.currentUser;
      if (!current) return;
      try {
        const assessmentsRef = collection(
          doc(db, "users", current.uid),
          "selfAssessments",
        );
        const q = query(assessmentsRef, orderBy("createdAt", "desc"), limit(1));
        const snap = await getDocs(q);
        if (!snap.empty && mounted) {
          const data = snap.docs[0].data();
          const ts = data.createdAt;
          const date = ts?.toDate ? ts.toDate() : new Date(ts);
          if (date && !isNaN(date.getTime())) setLastAssessment(date);
        }
      } catch (err) {
        console.warn("Could not load last assessment date:", err);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    return "Good Evening";
  };

  const getGreetingEmoji = () => {
    const hour = new Date().getHours();
    if (hour < 17) return "☀️";
    return "🌙";
  };

  // Journal entries within the last 7 days
  const weekJournalCount = useMemo(() => {
    const now = new Date();
    const weekAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
    return entries.filter((e) => {
      const d = new Date(e.entryDate || e.createdAt);
      return d.getTime() >= weekAgo;
    }).length;
  }, [entries]);

  const activeReminderCount = useMemo(() => {
    return Object.values(reminders).filter((r) => r.enabled).length;
  }, [reminders]);

  const totalAchievements = achievements.length;

  const daysSinceAssessment = lastAssessment
    ? Math.floor(
        (new Date().getTime() - lastAssessment.getTime()) /
          (24 * 60 * 60 * 1000),
      )
    : null;

  const dailyMessage = useMemo(
    () => WELLNESS_MESSAGES[new Date().getDate() % WELLNESS_MESSAGES.length],
    [],
  );

  // Safety check: If an admin somehow lands here, redirect them.
  if (role === "admin") {
    return <Redirect href="/admin-panel" />;
  }

  if (!user) {
    return <Redirect href="/auth/login" />;
  }

  function FeatureCard({ feature }: { feature: (typeof FEATURES)[number] }) {
    const scaleAnim = useRef(new Animated.Value(1)).current;

    const handlePressIn = () =>
      Animated.spring(scaleAnim, {
        toValue: 0.97,
        useNativeDriver: Platform.OS !== "web",
        speed: 50,
        bounciness: 0,
      }).start();
    const handlePressOut = () =>
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: Platform.OS !== "web",
        speed: 50,
        bounciness: 0,
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
          <View style={[styles.cardEmoji, { backgroundColor: `${feature.color}1F` }]}>
            <Text style={styles.cardEmojiText}>{feature.emoji}</Text>
          </View>
          <Text style={styles.cardTitle}>{feature.title}</Text>
          <Text style={styles.cardDescription}>{feature.description}</Text>
        </Pressable>
      </Animated.View>
    );
  }

  function MoodChip({
    emoji,
    label,
  }: {
    emoji: string;
    label: string;
  }) {
    return (
      <Pressable
        style={({ pressed }) => [
          styles.moodChip,
          pressed && styles.moodChipPressed,
        ]}
        onPress={() => router.push("/daily-journal" as Href)}
      >
        <Text style={styles.moodChipEmoji}>{emoji}</Text>
        <Text style={styles.moodChipText}>{label}</Text>
      </Pressable>
    );
  }

  function MicroStat({
    icon,
    value,
    label,
    tint,
  }: {
    icon: keyof typeof Ionicons.glyphMap;
    value: string;
    label: string;
    tint: string;
  }) {
    return (
      <View style={styles.microStat}>
        <View style={[styles.microIcon, { backgroundColor: `${tint}1A` }]}>
          <Ionicons name={icon} size={16} color={tint} />
        </View>
        <View style={styles.microText}>
          <Text style={styles.microValue}>{value}</Text>
          <Text style={styles.microLabel}>{label}</Text>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.background}>
        <ScrollView
          style={styles.scrollContainer}
          contentContainerStyle={[
            styles.scrollContent,
            isDesktop && styles.scrollContentDesktop,
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.contentColumn, isDesktop && styles.contentColumnDesktop]}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.logoContainer}>
                <View style={styles.logoIcon}>
                  <Image
                    source={require("@/assets/images/appicon_circle.png")}
                    style={styles.logoIconImage}
                    resizeMode="contain"
                  />
                </View>
                <Text style={styles.logoText}>MindCare</Text>
              </View>
              <View style={styles.rightButtons}>
                <Pressable
                  style={({ pressed }) => [
                    styles.menuButton,
                    pressed && styles.menuButtonPressed,
                  ]}
                  onPress={toggleSidePanel}
                >
                  <Ionicons name="menu" size={24} color="#7C4DCC" />
                </Pressable>
              </View>
            </View>

            {/* Greeting Section */}
            <View style={styles.greetingSection}>
              <Text style={styles.greeting}>
                {getGreeting()}, {user?.displayName?.split(" ")[0] || "there"}{" "}
                {getGreetingEmoji()}
              </Text>
              <Text style={styles.subtitle}>
                How are you feeling today? Take a moment for yourself.
              </Text>
            </View>

            {/* Today's Check-in */}
            <View style={styles.checkinCard}>
              <View style={styles.checkinHeader}>
                <Text style={styles.checkinTitle}>Today's Check-in</Text>
                <Text style={styles.checkinEmoji}>😊</Text>
              </View>
              <Text style={styles.checkinSubtitle}>
                How are you feeling today?
              </Text>
              <View style={styles.moodRow}>
                {CHECKIN_MOODS.map((mood) => (
                  <MoodChip key={mood.label} emoji={mood.emoji} label={mood.label} />
                ))}
              </View>
            </View>

            {/* Micro Progress */}
            <View style={styles.microRow}>
              <MicroStat
                icon="book"
                value={String(weekJournalCount)}
                label="Reflections this week"
                tint="#7C4DCC"
              />
              <MicroStat
                icon="trophy"
                value={`${totalEarned}/${totalAchievements}`}
                label="Achievements unlocked"
                tint="#D97706"
              />
              <MicroStat
                icon="notifications"
                value={String(activeReminderCount)}
                label="Active reminders"
                tint="#0F766E"
              />
              <MicroStat
                icon="clipboard"
                value={
                  daysSinceAssessment === null
                    ? "—"
                    : daysSinceAssessment === 0
                      ? "Today"
                      : `${daysSinceAssessment}d ago`
                }
                label="Last check-in"
                tint="#B56576"
              />
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

            {/* Wellness Message */}
            <View style={styles.quoteContainer}>
              <View style={styles.quoteIcon}>
                <Ionicons name="leaf" size={18} color="#7C4DCC" />
              </View>
              <Text style={styles.quote}>{dailyMessage}</Text>
            </View>
          </View>
        </ScrollView>

        {/* Floating AI Chat Bubble */}
        <GeminiChat />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  background: {
    flex: 1,
    backgroundColor: "#F7F5FC",
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    alignItems: "center",
  },
  scrollContentDesktop: {
    paddingHorizontal: 32,
  },
  contentColumn: {
    width: "100%",
    maxWidth: 720,
  },
  contentColumnDesktop: {
    maxWidth: 720,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 16,
    paddingBottom: 26,
  },
  logoContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  logoIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F0EBFB",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
    overflow: "hidden",
  },
  logoIconImage: {
    width: 24,
    height: 24,
  },
  logoText: {
    fontSize: 20,
    fontWeight: "800",
    color: "#7C4DCC",
  },
  rightButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  menuButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F0EBFB",
    justifyContent: "center",
    alignItems: "center",
  },
  menuButtonPressed: {
    backgroundColor: "#E6DCF7",
  },
  greetingSection: {
    marginBottom: 22,
  },
  greeting: {
    fontSize: 28,
    fontWeight: "700",
    color: "#2D1B69",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    color: "#6B7280",
    lineHeight: 22,
  },
  checkinCard: {
    backgroundColor: "white",
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: "#EDE9FE",
    // @ts-ignore — web-only shadow property
    boxShadow: "0px 2px 12px rgba(124, 77, 204, 0.06)",
    elevation: 2,
    marginBottom: 22,
  },
  checkinHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  checkinTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1E1B4B",
  },
  checkinEmoji: {
    fontSize: 24,
  },
  checkinSubtitle: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 14,
  },
  moodRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  moodChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F7F4FC",
    borderRadius: 22,
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: "#EEE6FB",
  },
  moodChipPressed: {
    backgroundColor: "#EFE7FB",
  },
  moodChipEmoji: {
    fontSize: 18,
  },
  moodChipText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#4B5563",
  },
  microRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 26,
  },
  microStat: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 10,
    minWidth: 0,
    borderWidth: 1,
    borderColor: "#EDE9FE",
    // @ts-ignore — web-only shadow property
    boxShadow: "0px 1px 6px rgba(124, 77, 204, 0.05)",
    elevation: 1,
  },
  microIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
  },
  microText: {
    flexShrink: 1,
  },
  microValue: {
    fontSize: 15,
    fontWeight: "800",
    color: "#7C4DCC",
  },
  microLabel: {
    fontSize: 12,
    color: "#6B7280",
  },
  cardsContainer: {
    gap: 16,
    marginBottom: 28,
  },
  cardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 16,
  },
  card: {
    flex: 1,
    backgroundColor: "white",
    borderRadius: 22,
    padding: 20,
    // @ts-ignore — web-only shadow property
    boxShadow: "0px 2px 12px rgba(124, 77, 204, 0.06)",
    elevation: 2,
    gap: 12,
    borderWidth: 1,
    borderColor: "#EDE9FE",
  },
  cardEmoji: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "flex-start",
  },
  cardEmojiText: {
    fontSize: 24,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1E1B4B",
  },
  cardDescription: {
    fontSize: 14,
    color: "#6B7280",
    lineHeight: 20,
  },
  quoteContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: "#F0EBFB",
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: "#E6DCF7",
  },
  quoteIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "white",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 2,
  },
  quote: {
    flex: 1,
    fontSize: 15,
    color: "#5B3FA8",
    lineHeight: 23,
  },
});
