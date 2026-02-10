import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";

import { auth, db } from "@/constants/firebase";
import { doc, getDoc } from "firebase/firestore";

// Hide the default native/header provided by the navigation stack
export const options = {
  headerShown: false,
};

export default function JournalDetailScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const id = params.id;
  const [loading, setLoading] = useState(true);
  const [entry, setEntry] = useState<any | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const user = auth.currentUser;
        if (!user || !id) {
          router.replace("/login");
          return;
        }

        const d = await getDoc(
          doc(db, "users", user.uid, "journalEntries", id),
        );
        if (!mounted) return;
        if (d.exists()) {
          const data = d.data() as any;
          const createdAt = data.createdAt;
          const date =
            createdAt && typeof (createdAt as any).toDate === "function"
              ? (createdAt as any).toDate()
              : createdAt
                ? new Date(createdAt)
                : new Date();

          setEntry({
            id: d.id,
            title: data.title || "Untitled",
            thoughts: data.thoughts || data.content || "",
            date,
            mood: data.mood || "",
            tags: data.tags || [],
            category: data.category || "",
            color: data.color || "#2196F3",
          });
        }
      } catch (err) {
        console.error("Error loading journal detail", err);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [id]);

  const handleBack = () => router.back();

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  if (!entry) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={{ color: "#666" }}>Entry not found.</Text>
          <Pressable onPress={() => router.replace("/daily-journal")}>
            <Text style={{ color: "#2196F3", marginTop: 12 }}>
              Back to Journal
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={["#4CAF50", "#2E7D32"]} style={styles.header}>
        <View style={styles.headerRow}>
          <Pressable onPress={handleBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="white" />
          </Pressable>
          <Text style={styles.headerTitle}>Journal Entry</Text>
          <View style={{ width: 40 }} />
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ padding: 20 }}
      >
        <View style={[styles.card, { backgroundColor: "white" }]}>
          <Text style={styles.title}>{entry.title}</Text>
          <Text style={styles.date}>{entry.date?.toLocaleString()}</Text>
          {entry.category ? (
            <View style={styles.categoryRow}>
              <Text style={styles.categoryText}>{entry.category}</Text>
            </View>
          ) : null}
          <View style={styles.tagsRow}>
            {entry.tags?.map((t: string, i: number) => (
              <View key={i} style={styles.tag}>
                <Text style={styles.tagText}>{t}</Text>
              </View>
            ))}
          </View>
          <View style={{ height: 12 }} />
          <Text style={styles.body}>{entry.thoughts}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F5F5" },
  header: { paddingVertical: 18, paddingHorizontal: 16 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: { color: "white", fontSize: 18, fontWeight: "600" },
  content: { flex: 1 },
  card: { borderRadius: 12, padding: 16, elevation: 2 },
  title: { fontSize: 20, fontWeight: "700", color: "#333" },
  date: { fontSize: 12, color: "#999", marginTop: 6 },
  tagsRow: { flexDirection: "row", gap: 8, marginTop: 8 },
  tag: {
    backgroundColor: "#E3F2FD",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  tagText: { color: "#2196F3", fontSize: 12, fontWeight: "600" },
  body: { marginTop: 12, fontSize: 16, color: "#444", lineHeight: 22 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  categoryRow: { marginTop: 8 },
  categoryText: {
    alignSelf: "flex-start",
    backgroundColor: "#FFF3E0",
    color: "#FB8C00",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    fontWeight: "600",
  },
});
