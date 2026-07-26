import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useEffect } from "react";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { auth } from "@/constants/firebase";
import { onAuthStateChanged } from "firebase/auth";

export default function AIHelperScreen() {
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
      <LinearGradient
        colors={["#E8E0F5", "#F4F2F8", "#E8E0F5"]}
        style={styles.gradient}
      >
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#666" />
          </Pressable>
        </View>

        <ScrollView
          style={styles.scrollContainer}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.introCard}>
            <Text style={styles.introTitle}>AI Support Helper</Text>
            <Text style={styles.introText}>
              Chat with our AI helper for support, coping ideas, and gentle
              guidance whenever you need a moment to talk things through.
            </Text>
          </View>

          <View style={styles.safeReminderCard}>
            <Text style={styles.safeReminderTitle}>Important Reminder</Text>
            <Text style={styles.safeReminderText}>
              These suggestions can help, but if you feel overwhelmed, it’s best
              to talk with a trusted counselor, teacher, family member, or
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
    backgroundColor: "white",
    borderRadius: 20,
    padding: 18,
    marginBottom: 18,
    shadowColor: "#8A63D2",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: "rgba(156, 126, 235, 0.06)",
  },
  introTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#333",
    marginBottom: 8,
  },
  introText: { fontSize: 14, color: "#666", lineHeight: 20 },
  safeReminderCard: {
    backgroundColor: "#F3EAFF",
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E0D0FF",
  },
  safeReminderTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#8A63D2",
    marginBottom: 8,
  },
  safeReminderText: { fontSize: 14, color: "#3B2F6B", lineHeight: 20 },
});
