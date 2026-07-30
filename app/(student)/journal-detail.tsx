import { useJournal } from "@/hooks/useJournal";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect } from "react";
import {
    ActivityIndicator,
    Pressable,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";

export const options = {
  headerShown: false,
};

export default function JournalDetailScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const id = params.id;
  const { getJournalEntry, loading } = useJournal();
  const entry = id ? getJournalEntry(id) : undefined;

  useEffect(() => {
    if (!id) {
      router.replace("/daily-journal");
    }
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
            <Text style={{ color: "#8A63D2", marginTop: 12 }}>
              Back to Journal
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={["#8A63D2", "#7C5AC8"]} style={styles.header}>
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
          <Text style={styles.date}>
            {new Date(entry.entryDate).toLocaleString()}
          </Text>
          {entry.category ? (
            <View style={styles.categoryRow}>
              <Text style={styles.categoryText}>{entry.category}</Text>
            </View>
          ) : null}
          <View style={{ height: 12 }} />
          <Text style={styles.body}>{entry.thoughts}</Text>
        </View>

        <Pressable
          style={styles.editButton}
          onPress={() =>
            router.push({
              pathname: "/new-journal-entry",
              params: { entryId: id },
            })
          }
        >
          <LinearGradient
            colors={["#9C7EEB", "#8A63D2"]}
            style={styles.editBtnGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Ionicons name="create-outline" size={20} color="white" />
            <Text style={styles.editButtonText}>Edit Entry</Text>
          </LinearGradient>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F4F2F8" },
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
  headerTitle: { color: "white", fontSize: 18, fontWeight: "700" },
  content: { flex: 1 },
  card: {
    borderRadius: 20,
    padding: 20,
    elevation: 3,
    // @ts-ignore — web-only shadow property
    boxShadow: "0px 4px 16px rgba(138, 99, 210, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(156, 126, 235, 0.06)",
  },
  title: { fontSize: 20, fontWeight: "700", color: "#1E1B4B" },
  date: { fontSize: 12, color: "#8B7FA8", marginTop: 6 },
  tagsRow: { flexDirection: "row", gap: 8, marginTop: 8 },
  tag: {
    backgroundColor: "#F3EAFF",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tagText: { color: "#8A63D2", fontSize: 12, fontWeight: "600" },
  body: { marginTop: 12, fontSize: 16, color: "#4B4453", lineHeight: 22 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  editButton: { borderRadius: 14, overflow: "hidden", marginTop: 20 },
  editBtnGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    gap: 8,
  },
  editButtonText: { color: "white", fontSize: 16, fontWeight: "600" },
  categoryRow: { marginTop: 8 },
  categoryText: {
    alignSelf: "flex-start",
    backgroundColor: "#FFF3E0",
    color: "#E65100",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    fontWeight: "600",
  },
});
