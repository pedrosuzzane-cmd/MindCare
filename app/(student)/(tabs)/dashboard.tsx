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
import { useMindCareTheme } from "@/contexts/ThemeContext";
import { MindCareTheme } from "@/constants/theme";
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

type CategoryId = "activity" | "mood" | "food" | "sleep";

const CATEGORIES: {
  id: CategoryId;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { id: "activity", label: "Activity", icon: "heart" },
  { id: "mood", label: "Mood", icon: "happy-outline" },
  { id: "food", label: "Food", icon: "restaurant" },
  { id: "sleep", label: "Sleep", icon: "moon" },
];

const FEATURES = [
  {
    title: "Daily Journal",
    description: "Reflect on your thoughts and feelings",
    emoji: "📔",
    color: "#8A63D2",
    route: "/daily-journal",
    categories: ["activity", "mood"] as CategoryId[],
  },
  {
    title: "Self-Assessment",
    description: "Check in with your mental wellness",
    emoji: "🌱",
    color: "#10B981",
    route: "/self-assessment-menu",
    categories: ["mood"] as CategoryId[],
  },
  {
    title: "Achievements",
    description: "Celebrate your healthy habits",
    emoji: "🏆",
    color: "#D97706",
    route: "/achievements",
    categories: ["activity", "sleep"] as CategoryId[],
  },
  {
    title: "Wellness Suggestions",
    description: "Tips based on your journal",
    emoji: "💡",
    color: "#0F766E",
    route: "/journal-suggestions",
    categories: ["mood"] as CategoryId[],
  },
  {
    title: "Daily Reminders",
    description: "Set helpful reminders for your day",
    emoji: "💧",
    color: "#7C4DCC",
    route: "/daily-reminders",
    categories: ["activity", "food", "sleep"] as CategoryId[],
  },
  {
    title: "Support",
    description: "Connect with support when you need it",
    emoji: "🤝",
    color: "#B56576",
    route: "/support-hotlines",
    categories: ["activity", "food"] as CategoryId[],
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

function CategoryTab({
  id,
  label,
  icon,
  active,
  theme,
  onPress,
}: {
  id: CategoryId;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  active: boolean;
  theme: MindCareTheme;
  onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const overlay = useRef(new Animated.Value(active ? 1 : 0)).current;
  const iconScale = useRef(new Animated.Value(1)).current;
  const iconRotate = useRef(new Animated.Value(0)).current;
  const iconFloat = useRef(new Animated.Value(0)).current;

  const rotate = iconRotate.interpolate({
    inputRange: [0, 1, 2, 3],
    outputRange: ["0deg", "-3deg", "3deg", "0deg"],
  });
  const float = iconFloat.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -2],
  });

  useEffect(() => {
    if (!active) {
      Animated.timing(overlay, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }).start();
      return;
    }

    Animated.parallel([
      Animated.timing(overlay, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.07,
          duration: 90,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 110,
          useNativeDriver: true,
        }),
      ]),
      (() => {
        if (id === "food") {
          return Animated.sequence([
            Animated.timing(iconRotate, {
              toValue: 1,
              duration: 70,
              useNativeDriver: true,
            }),
            Animated.timing(iconRotate, {
              toValue: 2,
              duration: 70,
              useNativeDriver: true,
            }),
            Animated.timing(iconRotate, {
              toValue: 3,
              duration: 70,
              useNativeDriver: true,
            }),
          ]);
        }
        if (id === "sleep") {
          return Animated.sequence([
            Animated.timing(iconFloat, {
              toValue: 1,
              duration: 120,
              useNativeDriver: true,
            }),
            Animated.timing(iconFloat, {
              toValue: 0,
              duration: 120,
              useNativeDriver: true,
            }),
          ]);
        }
        return Animated.sequence([
          Animated.timing(iconScale, {
            toValue: 1.12,
            duration: 90,
            useNativeDriver: true,
          }),
          ...(id === "mood"
            ? [
                Animated.timing(iconScale, {
                  toValue: 0.96,
                  duration: 60,
                  useNativeDriver: true,
                }),
                Animated.timing(iconScale, {
                  toValue: 1.06,
                  duration: 60,
                  useNativeDriver: true,
                }),
              ]
            : []),
          Animated.timing(iconScale, {
            toValue: 1,
            duration: 70,
            useNativeDriver: true,
          }),
        ]);
      })(),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const iconStyle = [
    id === "food" ? { transform: [{ rotate }] } : undefined,
    id === "sleep" ? { transform: [{ translateY: float }] } : undefined,
    id === "activity" || id === "mood"
      ? { transform: [{ scale: iconScale }] }
      : undefined,
  ];

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Show ${label} options`}
        accessibilityState={{ selected: active }}
        style={[
          styles.categoryPill,
          {
            backgroundColor: theme.card,
            borderColor: active ? theme.primary : theme.border,
          },
        ]}
        onPress={onPress}
      >
        <Animated.View
          style={[
            StyleSheet.absoluteFillObject,
            styles.categoryPillOverlay,
            { backgroundColor: theme.softPurple, opacity: overlay },
          ]}
        />
        <Animated.View style={iconStyle}>
          <Ionicons
            name={icon}
            size={17}
            color={active ? theme.primary : theme.secondaryText}
          />
        </Animated.View>
        <Text
          style={[
            styles.categoryPillLabel,
            {
              color: active ? theme.primary : theme.secondaryText,
              fontWeight: active ? "700" : "600",
            },
          ]}
        >
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

export default function DashboardScreen() {
  const { user, role } = useAuth();
  const { toggle: toggleSidePanel } = useSidePanel();
  const { theme } = useMindCareTheme();
  const [activeCategory, setActiveCategory] = useState<CategoryId>("activity");
  const contentOpacity = useRef(new Animated.Value(1)).current;

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

  const filteredFeatures = useMemo(
    () => FEATURES.filter((f) => f.categories.includes(activeCategory)),
    [activeCategory],
  );

  const selectCategory = (category: CategoryId) => {
    if (category === activeCategory) return;
    setActiveCategory(category);
    contentOpacity.setValue(0.5);
    Animated.timing(contentOpacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

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
        style={[{ transform: [{ scale: scaleAnim }], flex: 1, minWidth: 0 }]}
      >
        <Pressable
          style={[
            styles.card,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          onPress={() => router.push(feature.route as Href)}
        >
          <View
            style={[
              styles.cardEmoji,
              { backgroundColor: `${feature.color}1F` },
            ]}
          >
            <Text style={styles.cardEmojiText}>{feature.emoji}</Text>
          </View>
          <Text style={[styles.cardTitle, { color: theme.text }]}>
            {feature.title}
          </Text>
          <Text
            style={[styles.cardDescription, { color: theme.secondaryText }]}
          >
            {feature.description}
          </Text>
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
          {
            backgroundColor: theme.inputBg,
            borderColor: theme.borderSoft,
          },
          pressed && {
            backgroundColor: theme.softPurple,
          },
        ]}
        onPress={() => router.push("/daily-journal" as Href)}
      >
        <Text style={styles.moodChipEmoji}>{emoji}</Text>
        <Text style={[styles.moodChipText, { color: theme.text }]}>
          {label}
        </Text>
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
      <View
        style={[
          styles.microStat,
          { backgroundColor: theme.card, borderColor: theme.border },
        ]}
      >
        <View style={[styles.microIcon, { backgroundColor: `${tint}1F` }]}>
          <Ionicons name={icon} size={16} color={tint} />
        </View>
        <View style={styles.microText}>
          <Text style={[styles.microValue, { color: tint }]}>{value}</Text>
          <Text style={[styles.microLabel, { color: theme.secondaryText }]}>
            {label}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
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
                <View
                  style={[
                    styles.logoIcon,
                    { backgroundColor: theme.softPurple },
                  ]}
                >
                  <Image
                    source={require("@/assets/images/appicon_circle.png")}
                    style={styles.logoIconImage}
                    resizeMode="contain"
                  />
                </View>
                <Text style={[styles.logoText, { color: theme.primary }]}>
                  MindCare
                </Text>
              </View>
              <View style={styles.rightButtons}>
                <Pressable
                  style={({ pressed }) => [
                    styles.menuButton,
                    { backgroundColor: theme.softPurple },
                    pressed && { backgroundColor: theme.border },
                  ]}
                  onPress={toggleSidePanel}
                >
                  <Ionicons name="menu" size={24} color={theme.primary} />
                </Pressable>
              </View>
            </View>

            {/* Greeting Section */}
            <View style={styles.greetingSection}>
              <Text style={[styles.greeting, { color: theme.text }]}>
                {getGreeting()}, {user?.displayName?.split(" ")[0] || "there"}{" "}
                {getGreetingEmoji()}
              </Text>
              <Text style={[styles.subtitle, { color: theme.secondaryText }]}>
                How are you feeling today? Take a moment for yourself.
              </Text>
            </View>

            {/* Category Tabs */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryRow}
            >
              {CATEGORIES.map((category) => (
                <CategoryTab
                  key={category.id}
                  id={category.id}
                  label={category.label}
                  icon={category.icon}
                  active={activeCategory === category.id}
                  theme={theme}
                  onPress={() => selectCategory(category.id)}
                />
              ))}
            </ScrollView>

            {/* Today's Check-in */}
            <View
              style={[
                styles.checkinCard,
                { backgroundColor: theme.card, borderColor: theme.border },
              ]}
            >
              <View style={styles.checkinHeader}>
                <Text style={[styles.checkinTitle, { color: theme.text }]}>
                  Today's Check-in
                </Text>
                <Text style={styles.checkinEmoji}>😊</Text>
              </View>
              <Text
                style={[styles.checkinSubtitle, { color: theme.secondaryText }]}
              >
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
                tint={theme.accent.purple}
              />
              <MicroStat
                icon="trophy"
                value={`${totalEarned}/${totalAchievements}`}
                label="Achievements unlocked"
                tint={theme.accent.amber}
              />
              <MicroStat
                icon="notifications"
                value={String(activeReminderCount)}
                label="Active reminders"
                tint={theme.accent.teal}
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
                tint={theme.accent.rose}
              />
            </View>

            {/* Feature Cards (filtered by category) */}
            <Animated.View style={{ opacity: contentOpacity }}>
              <View style={styles.cardsContainer}>
                {Array.from({
                  length: Math.ceil(filteredFeatures.length / numColumns),
                }).map((_, rowIdx) => {
                  const rowFeatures = filteredFeatures.slice(
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
                })}
              </View>
            </Animated.View>

            {/* Wellness Message */}
            <View
              style={[
                styles.quoteContainer,
                {
                  backgroundColor: theme.softPurple,
                  borderColor: theme.borderSoft,
                },
              ]}
            >
              <View
                style={[
                  styles.quoteIcon,
                  { backgroundColor: theme.card },
                ]}
              >
                <Ionicons name="leaf" size={18} color={theme.primary} />
              </View>
              <Text style={[styles.quote, { color: theme.primaryDeep }]}>
                {dailyMessage}
              </Text>
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
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
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
    justifyContent: "center",
    alignItems: "center",
  },
  greetingSection: {
    marginBottom: 22,
  },
  greeting: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
  },
  categoryRow: {
    flexDirection: "row",
    gap: 10,
    paddingBottom: 22,
  },
  categoryPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1.5,
    overflow: "hidden",
  },
  categoryPillOverlay: {
    borderRadius: 999,
  },
  categoryPillLabel: {
    fontSize: 14,
  },
  checkinCard: {
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
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
  },
  checkinEmoji: {
    fontSize: 24,
  },
  checkinSubtitle: {
    fontSize: 14,
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
    borderRadius: 22,
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 8,
    borderWidth: 1,
  },
  moodChipEmoji: {
    fontSize: 18,
  },
  moodChipText: {
    fontSize: 14,
    fontWeight: "600",
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
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 10,
    minWidth: 0,
    borderWidth: 1,
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
  },
  microLabel: {
    fontSize: 12,
  },
  cardsContainer: {
    gap: 16,
    marginBottom: 28,
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 16,
  },
  card: {
    flex: 1,
    minWidth: 0,
    borderRadius: 22,
    padding: 20,
    // @ts-ignore — web-only shadow property
    boxShadow: "0px 2px 12px rgba(124, 77, 204, 0.06)",
    elevation: 2,
    gap: 12,
    borderWidth: 1,
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
    flexShrink: 1,
  },
  cardDescription: {
    fontSize: 14,
    lineHeight: 20,
    flexShrink: 1,
  },
  quoteContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
  },
  quoteIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 2,
  },
  quote: {
    flex: 1,
    fontSize: 15,
    lineHeight: 23,
  },
});
