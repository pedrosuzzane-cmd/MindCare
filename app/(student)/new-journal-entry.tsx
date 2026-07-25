import { useJournal } from "@/hooks/useJournal";
import { analyzeJournal } from "@/services/geminiService";
import { journalService } from "@/services/journalService";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

interface Category {
  id: string;
  name: string;
  color: string;
}

export default function NewJournalEntryScreen() {
  const params = useLocalSearchParams<{ date?: string }>();
  const { addJournalEntry } = useJournal();
  const [entryDate, setEntryDate] = useState<Date>(new Date());
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [entryTitle, setEntryTitle] = useState<string>("");

  const [selectedMood, setSelectedMood] = useState<string>("");

  const moods = [
    { id: "happy", emoji: "😄", label: "Happy" },
    { id: "calm", emoji: "😊", label: "Calm" },
    { id: "relaxed", emoji: "😌", label: "Relaxed" },
    { id: "good", emoji: "🙂", label: "Good" },
    { id: "neutral", emoji: "😐", label: "Neutral" },
    { id: "worried", emoji: "😟", label: "Worried" },
    { id: "sad", emoji: "😞", label: "Sad" },
    { id: "overwhelmed", emoji: "😣", label: "Overwhelmed" },
    { id: "exhausted", emoji: "😫", label: "Exhausted" },
    { id: "stressed", emoji: "😓", label: "Stressed" },
    { id: "burnout", emoji: "😤", label: "Burnout" },
    { id: "very-upset", emoji: "😢", label: "Very Upset" },
  ];

  const [thoughts, setThoughts] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (params.date) {
      const parsed = new Date(params.date);
      if (!Number.isNaN(parsed.getTime())) {
        setEntryDate(parsed);
      }
    }
  }, [params.date]);

  const categories: Category[] = [
    { id: "personal", name: "Personal", color: "#2196F3" },
    { id: "academic", name: "Academic", color: "#4CAF50" },
    { id: "wellness", name: "Wellness", color: "#9C27B0" },
    { id: "social", name: "Social", color: "#E91E63" },
    { id: "goals", name: "Goals", color: "#FF9800" },
    { id: "gratitude", name: "Gratitude", color: "#00BCD4" },
    { id: "work", name: "Work", color: "#FF5722" },
    { id: "spiritual", name: "Spiritual", color: "#7B1FA2" },
  ];

  const handleBack = () => {
    router.back();
  };

  const formatDate = (date: Date) =>
    date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  const handleSaveEntry = async () => {
    if (!entryTitle.trim()) {
      Alert.alert(
        "Missing Title",
        "Please provide a title for your journal entry.",
      );
      return;
    }

    if (!selectedMood) {
      Alert.alert("Missing Mood", "Please select your current mood.");
      return;
    }

    if (!selectedCategory) {
      Alert.alert(
        "Missing Category",
        "Please select a category for your entry.",
      );
      return;
    }

    setSaving(true);
    try {
      const sanitize = (s: string, max = 2000) => s.trim().slice(0, max);
      const data = {
        category: selectedCategory,
        mood: selectedMood,
        title: sanitize(entryTitle, 200),
        thoughts: sanitize(thoughts, 2000),
        entryDate: entryDate.toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const newEntry = await addJournalEntry(data);

      // Navigate to AI Reflection Card
      router.replace({
        pathname: "/ai-reflection-card",
        params: {
          journalId: newEntry.id, // Pass the ID of the newly created local entry
          title: newEntry.title,
          thoughts: newEntry.thoughts,
          mood: selectedMood,
          category: selectedCategory,
        },
      });

      // Fire-and-forget: call Gemini to analyze the journal
      // Never blocks navigation if Gemini fails
      analyzeJournalInBackground(newEntry);
    } catch (err) {
      console.error("Error saving journal entry", err);
      Alert.alert("Error", "Unable to save entry. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  /**
   * Calls Gemini to analyze the journal entry and stores results locally.
   * Runs asynchronously in the background - never blocks or throws.
   */
  const analyzeJournalInBackground = async (
    entry: import("@/services/journalService").JournalEntry,
  ) => {
    try {
      const journalText = `Title: ${entry.title}\nMood: ${entry.mood}\nCategory: ${entry.category}\nThoughts: ${entry.thoughts}`;
      const analysis = await analyzeJournal(journalText);

      if (!analysis) {
        // Gemini failed silently - journal is already saved, no harm done
        return;
      }

      // Update the stored entry with AI analysis fields
      const updatedEntry: import("@/services/journalService").JournalEntry = {
        ...entry,
        aiEmotion: analysis.emotion,
        aiSummary: analysis.summary,
        aiEncouragement: analysis.encouragement,
        aiSuggestions: analysis.suggestions,
        aiGeneratedAt: new Date().toISOString(),
      };

      // Use journalService.updateJournalEntry instead of useJournal to avoid triggering re-renders
      const userId = updatedEntry.userId;
      await journalService.updateJournalEntry(userId, updatedEntry);
      console.log("AI analysis saved for journal:", entry.id);
    } catch (err) {
      // Silently ignore - journal was already saved successfully
      console.warn("Background AI analysis failed:", err);
    }
  };

  const handleCategorySelect = (categoryId: string) => {
    setSelectedCategory(categoryId);
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={["#4CAF50", "#00BCD4", "#2196F3"]}
        style={styles.headerGradient}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={handleBack}>
            <Ionicons name="arrow-back" size={24} color="white" />
          </Pressable>
          <Text style={styles.headerTitle}>New Entry</Text>
          <View style={styles.placeholder} />
        </View>

        {/* Subtitle */}
        <View style={styles.subtitleContainer}>
          <Text style={styles.subtitle}>
            Journal for {formatDate(entryDate)}
          </Text>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Category Selection */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Select a Category</Text>
          <View style={styles.categoryGrid}>
            {categories.map((category) => (
              <Pressable
                key={category.id}
                style={styles.categoryItem}
                onPress={() => handleCategorySelect(category.id)}
              >
                <View
                  style={[
                    styles.categoryCircle,
                    { backgroundColor: category.color },
                    selectedCategory === category.id && styles.selectedCategory,
                  ]}
                />
                <Text style={styles.categoryName}>{category.name}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Mood Selection */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>How are you feeling?</Text>
          <View style={styles.moodGrid}>
            {moods.map((mood) => (
              <Pressable
                key={mood.id}
                style={[
                  styles.moodItem,
                  selectedMood === mood.id && styles.selectedMoodItem,
                ]}
                onPress={() => setSelectedMood(mood.id)}
              >
                <Text style={styles.moodEmoji}>{mood.emoji}</Text>
                <Text style={styles.moodLabel}>{mood.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Entry Title */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Entry Title</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.titleInput}
              placeholder="Give your entry a title..."
              placeholderTextColor="#999"
              value={entryTitle}
              onChangeText={setEntryTitle}
            />
          </View>
        </View>

        {/* Your Thoughts */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Your Thoughts</Text>
            {thoughts.length > 0 && (
              <Pressable
                style={styles.clearButton}
                onPress={() => setThoughts("")}
              >
                <Ionicons name="close-circle-outline" size={16} color="#999" />
                <Text style={styles.clearButtonText}>Clear</Text>
              </Pressable>
            )}
          </View>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.thoughtsInput}
              placeholder="Write about your day, feelings, or thoughts..."
              placeholderTextColor="#999"
              value={thoughts}
              onChangeText={setThoughts}
              maxLength={2000}
              multiline
              numberOfLines={8}
              textAlignVertical="top"
            />
            <Text
              style={[
                styles.charCounter,
                thoughts.length >= 1800 && styles.charCounterWarning,
              ]}
            >{`${thoughts.length} / 2000`}</Text>
          </View>
        </View>

        {/* Save Button */}
        <View style={styles.buttonContainer}>
          <Pressable
            style={[
              styles.saveButton,
              (saving ||
                !selectedCategory ||
                !entryTitle.trim() ||
                !thoughts.trim()) &&
                styles.disabledButton,
            ]}
            onPress={handleSaveEntry}
            disabled={
              saving ||
              !selectedCategory ||
              !entryTitle.trim() ||
              !thoughts.trim()
            }
          >
            {saving ? (
              <ActivityIndicator color="white" />
            ) : (
              <LinearGradient
                colors={["#4CAF50", "#00BCD4", "#2196F3"]}
                style={styles.saveButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.saveButtonText}>Save Entry</Text>
              </LinearGradient>
            )}
          </Pressable>
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
    fontSize: 16,
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
  sectionContainer: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  categoryGrid: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 20,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-around",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  categoryItem: {
    alignItems: "center",
    marginBottom: 20,
    width: "25%",
  },
  categoryCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginBottom: 8,
  },
  selectedCategory: {
    borderWidth: 3,
    borderColor: "#333",
  },
  categoryName: {
    fontSize: 12,
    color: "#666",
    textAlign: "center",
    fontWeight: "500",
  },
  moodGrid: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  moodItem: {
    alignItems: "center",
    width: "23%",
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#F5F5F5",
    marginBottom: 8,
  },
  selectedMoodItem: {
    backgroundColor: "#2196F3",
    borderWidth: 2,
    borderColor: "#1976D2",
  },
  moodEmoji: {
    fontSize: 24,
    marginBottom: 4,
  },
  moodLabel: {
    fontSize: 11,
    color: "#666",
    textAlign: "center",
    fontWeight: "500",
  },
  inputContainer: {
    backgroundColor: "white",
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  titleInput: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    fontSize: 16,
    color: "#333",
    borderRadius: 16,
  },
  thoughtsInput: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    fontSize: 16,
    color: "#333",
    borderRadius: 16,
    minHeight: 120,
  },
  charCounter: {
    textAlign: "right",
    fontSize: 12,
    color: "#999",
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  charCounterWarning: {
    color: "#D32F2F",
    fontWeight: "600",
  },
  clearButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  clearButtonText: {
    color: "#999",
    fontSize: 13,
    fontWeight: "600",
  },
  buttonContainer: {
    marginTop: 20,
    borderRadius: 25,
    overflow: "hidden",
  },
  disabledButton: {
    opacity: 0.5,
  },
  saveButton: {
    alignItems: "center",
  },
  saveButtonGradient: {
    paddingVertical: 16,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "white",
  },
});
