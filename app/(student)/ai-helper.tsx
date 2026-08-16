import { useMindCareTheme } from "@/contexts/ThemeContext";
import { shadows } from "@/utils/shadows";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useEffect } from "react";
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";

import { auth } from "@/constants/firebase";
import { onAuthStateChanged } from "firebase/auth";

export default function AIHelperScreen() {
  const { theme } = useMindCareTheme();
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.replace("/auth/login");
      }
    });
    return () => unsub();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={theme.softGradient} style={styles.gradient}>
        <View style={styles.header}>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          style={styles.scrollContainer}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View
            style={[
              styles.introCard,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}
          >
            <Text style={[styles.introTitle, { color: theme.text }]}>
              AI Support Helper
            </Text>
            <Text style={[styles.introText, { color: theme.secondaryText }]}>
              Chat with our AI helper for support, coping ideas, and gentle
              guidance whenever you need a moment to talk things through.
            </Text>
          </View>

          <View
            style={[
              styles.safeReminderCard,
              { backgroundColor: theme.softPurple, borderColor: theme.border },
            ]}
          >
            <Text style={[styles.safeReminderTitle, { color: theme.primary }]}>
              Important Reminder
            </Text>
            <Text
              style={[styles.safeReminderText, { color: theme.secondaryText }]}
            >
              These suggestions can help, but if you feel overwhelmed, it&apos;s
              best to talk with a trusted counselor, teacher, family member, or
              friend. Seeking human support is always a strong step.
            </Text>
          </View>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  gradient: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 14,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  scrollContainer: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 40 },
  introCard: {
    borderRadius: 20,
    padding: 18,
    marginBottom: 18,
    ...(shadows.custom(2, 8, 0.08, 3, "#8A63D2") as any),
    borderWidth: 1,
  },
  introTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
  },
  introText: { fontSize: 14, lineHeight: 20 },
  safeReminderCard: {
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
  },
  safeReminderTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 8,
  },
  safeReminderText: { fontSize: 14, lineHeight: 20 },
});
