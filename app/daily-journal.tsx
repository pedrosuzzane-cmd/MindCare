import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
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
import { onAuthStateChanged } from "firebase/auth";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";

interface JournalEntry {
  id: string;
  title: string;
  thoughts: string;
  date: Date;
  mood: string;
  tags: string[];
  color: string;
}

export default function DailyJournalScreen() {
  // This will be populated from Firebase
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const handleBack = () => {
    router.replace("/dashboard");
  };

  const handleAddEntry = () => {
    // Navigate to add journal entry screen
    router.push("/new-journal-entry");
  };

  const handleEditEntry = (entryId: string) => {
    // Navigate to edit journal entry screen
    // TODO: navigate to edit screen
  };

  const getInitials = (title: string) => {
    return title
      .split(" ")
      .map((word) => word.charAt(0))
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  useEffect(() => {
    let unsubSnapshot: (() => void) | null = null;
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setJournalEntries([]);
        setLoading(false);
        router.replace("/login");
        return;
      }

      const q = query(
        collection(db, "users", user.uid, "journalEntries"),
        orderBy("createdAt", "desc"),
      );

      unsubSnapshot = onSnapshot(q, (snap) => {
        const entries = snap.docs.map((d) => {
          const data = d.data() as any;
          const createdAt = data.createdAt;
          const date =
            createdAt && typeof (createdAt as any).toDate === "function"
              ? (createdAt as any).toDate()
              : createdAt
                ? new Date(createdAt)
                : new Date();

          return {
            id: d.id,
            title: data.title || "Untitled",
            thoughts: data.thoughts || data.content || "",
            date,
            mood: data.mood || "",
            tags: data.tags || [],
            color: data.color || "#2196F3",
          } as JournalEntry;
        });

        setJournalEntries(entries);
        setLoading(false);
      });
    });

    return () => {
      try {
        unsubAuth();
      } catch (e) {
        /* ignore */
      }
      if (unsubSnapshot) unsubSnapshot();
    };
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  const getPreviewText = (content: string, maxLength: number = 80) => {
    if (!content) return "";
    if (content.length <= maxLength) return content;
    return content.slice(0, maxLength) + "...";
  };

  const renderJournalEntry = (entry: JournalEntry) => (
    <View key={entry.id} style={styles.entryCard}>
      <View style={styles.entryHeader}>
        <View style={styles.entryLeft}>
          <View style={[styles.entryIcon, { backgroundColor: entry.color }]}>
            <Text style={styles.entryIconText}>{getInitials(entry.title)}</Text>
          </View>
          <View style={styles.entryInfo}>
            <View style={styles.entryTopRow}>
              <Text style={styles.entryDate}>{formatDate(entry.date)}</Text>
              {entry.tags.map((tag, index) => (
                <View key={index} style={styles.tag}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.entryTitle}>{entry.title}</Text>
            <Text style={styles.entryPreview}>
              {getPreviewText(entry.thoughts)}
            </Text>
          </View>
        </View>
        <Pressable
          style={styles.editButton}
          onPress={() => handleEditEntry(entry.id)}
        >
          <Ionicons name="pencil" size={20} color="#666" />
        </Pressable>
      </View>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}>
        <Ionicons name="journal" size={48} color="#ccc" />
      </View>
      <Text style={styles.emptyTitle}>No Journal Entries Yet</Text>
      <Text style={styles.emptySubtitle}>
        Start reflecting on your thoughts and feelings by adding your first
        journal entry.
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={["#4CAF50", "#2E7D32"]}
        style={styles.headerGradient}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={handleBack}>
            <Ionicons name="arrow-back" size={24} color="white" />
          </Pressable>
          <Text style={styles.headerTitle}>Daily Journal</Text>
          <View style={styles.placeholder} />
        </View>

        {/* Subtitle */}
        <View style={styles.subtitleContainer}>
          <Text style={styles.subtitle}>
            Reflect on your thoughts and feelings
          </Text>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Add Journal Entry Button */}
        <Pressable style={styles.addButton} onPress={handleAddEntry}>
          <LinearGradient
            colors={["#4CAF50", "#2196F3"]}
            style={styles.addButtonGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Ionicons name="add" size={24} color="white" />
            <Text style={styles.addButtonText}>Add Journal Entry</Text>
          </LinearGradient>
        </Pressable>

        {/* Journal Entries */}
        <View style={styles.entriesContainer}>
          {journalEntries.length > 0
            ? journalEntries.map(renderJournalEntry)
            : renderEmptyState()}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F5F5",
  },
  headerGradient: {
    paddingBottom: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "white",
  },
  placeholder: {
    width: 40,
  },
  subtitleContainer: {
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.9)",
    textAlign: "center",
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  addButton: {
    marginBottom: 24,
  },
  addButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 25,
    gap: 8,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "white",
  },
  entriesContainer: {
    gap: 16,
  },
  entryCard: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  entryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  entryLeft: {
    flexDirection: "row",
    flex: 1,
  },
  entryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  entryIconText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "white",
  },
  entryInfo: {
    flex: 1,
  },
  entryTopRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 8,
  },
  entryDate: {
    fontSize: 12,
    color: "#999",
  },
  tag: {
    backgroundColor: "#E3F2FD",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  tagText: {
    fontSize: 10,
    color: "#2196F3",
    fontWeight: "500",
  },
  entryTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 6,
  },
  entryPreview: {
    fontSize: 14,
    color: "#666",
    lineHeight: 20,
  },
  editButton: {
    width: 32,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#F5F5F5",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    lineHeight: 20,
  },
});
