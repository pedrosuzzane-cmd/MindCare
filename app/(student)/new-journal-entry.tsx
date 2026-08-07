import { shadows } from "@/utils/shadows";
import { useJournal } from "@/hooks/useJournal";
import { useNetwork } from "@/contexts/NetworkContext";
import { CATEGORIES, MOODS, getMood } from "@/utils/journalOptions";
import { journalDraftStorage } from "@/storage/journalDraftStorage";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

const THOUGHT_LIMIT = 3000;
const TITLE_LIMIT = 200;
const GOAL_WORDS = 50;
const DRAFT_INTERVAL_MS = 30_000;

export default function NewJournalEntryScreen() {
  const params = useLocalSearchParams<{ date?: string; entryId?: string }>();
  const { addJournalEntry, updateJournalEntry, getJournalEntry } = useJournal();
  const { isConnected } = useNetwork();
  const [entryDate, setEntryDate] = useState<Date>(new Date());
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [entryTitle, setEntryTitle] = useState<string>("");
  const [selectedMood, setSelectedMood] = useState<string>("");
  const [thoughts, setThoughts] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);

  const editEntryId = params.entryId;
  const isEditing = !!editEntryId;

  const draftRef = useRef({ title: "", thoughts: "", mood: "", category: "" });
  draftRef.current = {
    title: entryTitle,
    thoughts,
    mood: selectedMood,
    category: selectedCategory,
  };

  const isFutureDate = (date: Date): boolean => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const compare = new Date(date);
    compare.setHours(0, 0, 0, 0);
    return compare.getTime() > today.getTime();
  };

  useEffect(() => {
    if (editEntryId) {
      const entry = getJournalEntry(editEntryId);
      if (entry) {
        setEntryTitle(entry.title || "");
        setThoughts(entry.thoughts || "");
        setSelectedMood(entry.mood || "");
        setSelectedCategory(entry.category || "");
        setEntryDate(new Date(entry.entryDate));
      }
    } else if (params.date) {
      const parsed = new Date(params.date);
      if (!Number.isNaN(parsed.getTime())) {
        if (isFutureDate(parsed)) {
          Alert.alert(
            "Future Date",
            "You cannot create journal entries for future dates.",
          );
          router.back();
          return;
        }
        setEntryDate(parsed);
      }
    }
  }, [params.date, editEntryId]);

  // Restore an auto-saved draft for new entries
  useEffect(() => {
    if (isEditing) return;
    let mounted = true;
    journalDraftStorage.getDraft().then((draft) => {
      if (!mounted || !draft) return;
      if (draft.title || draft.thoughts || draft.mood || draft.category) {
        setEntryTitle(draft.title || "");
        setThoughts(draft.thoughts || "");
        setSelectedMood(draft.mood || "");
        setSelectedCategory(draft.category || "");
        setDraftRestored(true);
      }
    });
    return () => {
      mounted = false;
    };
  }, [isEditing]);

  // Auto-save the draft every 30 seconds and when the app backgrounds
  useEffect(() => {
    if (isEditing) return;
    const saveDraftNow = () => {
      const d = draftRef.current;
      if (d.mood || d.category || d.title.trim() || d.thoughts.trim()) {
        journalDraftStorage.saveDraft({
          title: d.title,
          thoughts: d.thoughts,
          mood: d.mood,
          category: d.category,
          savedAt: new Date().toISOString(),
        });
      }
    };
    const interval = setInterval(saveDraftNow, DRAFT_INTERVAL_MS);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "background") saveDraftNow();
    });
    return () => {
      clearInterval(interval);
      sub.remove();
      saveDraftNow();
    };
  }, [isEditing]);

  const wordCount = useMemo(() => {
    const trimmed = thoughts.trim();
    return trimmed ? trimmed.split(/\s+/).length : 0;
  }, [thoughts]);

  const goalPct = Math.min(1, wordCount / GOAL_WORDS);

  const formatLongDate = (date: Date) =>
    date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });

  const handleBack = () => {
    router.back();
  };

  const handleSaveEntry = async () => {
    if (isFutureDate(entryDate)) {
      Alert.alert(
        "Future Date",
        "You cannot create journal entries for future dates.",
      );
      return;
    }

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
      const sanitize = (s: string, max: number) => s.trim().slice(0, max);
      const now = new Date().toISOString();
      const data = {
        category: selectedCategory,
        mood: selectedMood,
        title: sanitize(entryTitle, TITLE_LIMIT),
        thoughts: sanitize(thoughts, THOUGHT_LIMIT),
        entryDate: entryDate.toISOString(),
        createdAt: now,
        updatedAt: now,
      };

      let savedId = editEntryId;
      if (isEditing && editEntryId) {
        await updateJournalEntry({ id: editEntryId, ...data });
      } else {
        const created = await addJournalEntry(data);
        savedId = created.id;
      }

      await journalDraftStorage.clearDraft();
      router.replace({
        pathname: "/journal-saved",
        params: { id: savedId },
      });
    } catch (err) {
      console.error("Error saving journal entry", err);
      Alert.alert("Error", "Unable to save entry. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const canSave = Boolean(
    selectedCategory && selectedMood && entryTitle.trim() && thoughts.trim(),
  );

  const selectedMoodOption = getMood(selectedMood);

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <LinearGradient
          colors={["#9C7EEB", "#8A63D2", "#7C5AC8"]}
          style={styles.headerGradient}
        >
          <View style={styles.header}>
            <Pressable style={styles.backButton} onPress={handleBack}>
              <Ionicons name="arrow-back" size={24} color="white" />
            </Pressable>
            <Text style={styles.headerTitle}>
              {isEditing ? "📖 Edit Entry" : "📖 New Journal Entry"}
            </Text>
            <View style={styles.placeholder} />
          </View>
          <View style={styles.subtitleContainer}>
            <Text style={styles.subtitle}>{formatLongDate(entryDate)}</Text>
          </View>
        </LinearGradient>

        <ScrollView
          style={styles.scrollContainer}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {isConnected === false && (
            <View style={styles.offlineBanner}>
              <Ionicons name="cloud-offline-outline" size={18} color="#B45309" />
              <Text style={styles.offlineBannerText}>
                You're offline — entry will sync when connected
              </Text>
            </View>
          )}

          {draftRestored && (
            <View style={styles.draftBanner}>
              <Ionicons name="save-outline" size={18} color="#6D28D9" />
              <Text style={styles.draftBannerText}>
                Draft restored — your writing is saved automatically every 30s
              </Text>
              <Pressable
                onPress={() => {
                  journalDraftStorage.clearDraft();
                  setDraftRestored(false);
                }}
                hitSlop={8}
              >
                <Ionicons name="close" size={18} color="#6D28D9" />
              </Pressable>
            </View>
          )}

          {/* Mood Selection */}
          <Animated.View entering={FadeIn.duration(350)}>
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionTitle}>How are you feeling today?</Text>
              <Text style={styles.sectionHint}>
                Pick the mood that matches how you feel right now.
              </Text>
              <View style={styles.moodCard}>
                <View style={styles.moodGrid}>
                  {MOODS.map((mood) => {
                    const isSelected = selectedMood === mood.id;
                    return (
                      <Pressable
                        key={mood.id}
                        style={styles.moodItem}
                        onPress={() => setSelectedMood(mood.id)}
                      >
                        <View
                          style={[
                            styles.moodCircle,
                            isSelected && styles.moodCircleSelected,
                          ]}
                        >
                          <Text style={styles.moodEmoji}>{mood.emoji}</Text>
                        </View>
                        <Text
                          style={[
                            styles.moodLabel,
                            isSelected && styles.moodLabelSelected,
                          ]}
                        >
                          {mood.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                {selectedMoodOption && (
                  <View style={styles.selectedMoodRow}>
                    <Text style={styles.selectedMoodLabel}>Selected: </Text>
                    <Text style={styles.selectedMoodValue}>
                      💜 {selectedMoodOption.label}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </Animated.View>

          {/* Category Selection */}
          <Animated.View entering={FadeInDown.delay(80).duration(350)}>
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionTitle}>Category</Text>
              <Text style={styles.sectionHint}>
                Choose the area of your life this entry is about.
              </Text>
              <View style={styles.pillWrap}>
                {CATEGORIES.map((category) => {
                  const isSelected = selectedCategory === category.id;
                  return (
                    <Pressable
                      key={category.id}
                      onPress={() => setSelectedCategory(category.id)}
                      style={[
                        styles.pill,
                        { borderColor: category.color },
                        isSelected && {
                          backgroundColor: category.color,
                          borderColor: category.color,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.pillText,
                          { color: category.color },
                          isSelected && styles.pillTextSelected,
                        ]}
                      >
                        {isSelected ? "✓ " : ""}
                        {category.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </Animated.View>

          {/* Entry Title */}
          <Animated.View entering={FadeInDown.delay(160).duration(350)}>
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionTitle}>Entry Title</Text>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.titleInput}
                  placeholder="Give your entry a title..."
                  placeholderTextColor="#999"
                  value={entryTitle}
                  onChangeText={setEntryTitle}
                  maxLength={TITLE_LIMIT}
                />
              </View>
            </View>
          </Animated.View>

          {/* Your Thoughts */}
          <Animated.View entering={FadeInDown.delay(240).duration(350)}>
            <View style={styles.sectionContainer}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Tell us about your day</Text>
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
                  placeholder="Today I felt..."
                  placeholderTextColor="#999"
                  value={thoughts}
                  onChangeText={setThoughts}
                  maxLength={THOUGHT_LIMIT}
                  multiline
                  textAlignVertical="top"
                />
                <View style={styles.counterRow}>
                  <Text
                    style={[
                      styles.charCounter,
                      thoughts.length >= THOUGHT_LIMIT - 200 &&
                        styles.charCounterWarning,
                    ]}
                  >
                    Characters: {thoughts.length}/{THOUGHT_LIMIT}
                  </Text>
                  <Text style={styles.charCounter}>
                    {wordCount} {wordCount === 1 ? "word" : "words"}
                  </Text>
                </View>
                <View style={styles.goalSection}>
                  <View style={styles.goalBar}>
                    <View style={[styles.goalFill, { width: `${goalPct * 100}%` }]} />
                  </View>
                  <Text style={styles.goalText}>
                    {wordCount >= GOAL_WORDS
                      ? `Goal reached — nice writing! 🎉`
                      : `${wordCount} / ${GOAL_WORDS} words written`}
                  </Text>
                </View>
              </View>
            </View>
          </Animated.View>

          {/* Reflection Preview */}
          <Animated.View entering={FadeInDown.delay(320).duration(450)}>
            <View style={styles.previewCard}>
              <Text style={styles.previewEmoji}>🌸</Text>
              <View style={styles.previewContent}>
                <Text style={styles.previewTitle}>Reflection Preview</Text>
                <Text style={styles.previewText}>
                  Your reflection will appear after saving today's journal.
                </Text>
              </View>
            </View>
          </Animated.View>
        </ScrollView>

        {/* Sticky Save Footer */}
        <View style={styles.footer}>
          <Pressable
            onPress={handleSaveEntry}
            disabled={saving || !canSave}
            style={styles.saveButton}
          >
            <LinearGradient
              colors={
                saving || !canSave
                  ? ["#C4B5D9", "#B09FD0"]
                  : ["#9C7EEB", "#8A63D2"]
              }
              style={styles.saveButtonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              {saving ? (
                <ActivityIndicator color="white" />
              ) : (
                <View style={styles.saveButtonContent}>
                  <Ionicons
                    name={
                      isConnected === false
                        ? "cloud-upload-outline"
                        : "checkmark-circle"
                    }
                    size={20}
                    color="white"
                  />
                  <Text style={styles.saveButtonText}>
                    {isConnected === false
                      ? "Save Offline"
                      : isEditing
                        ? "Update Entry"
                        : "Save Today's Journal"}
                  </Text>
                </View>
              )}
            </LinearGradient>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F4F2F8",
  },
  flex: {
    flex: 1,
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
    fontWeight: "700",
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
    fontSize: 15,
    color: "rgba(255, 255, 255, 0.9)",
    textAlign: "center",
    fontWeight: "600",
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
  },
  offlineBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#FDE68A",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
  },
  offlineBannerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: "#92400E",
  },
  draftBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#F3E8FF",
    borderWidth: 1,
    borderColor: "#E9D5FF",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
  },
  draftBannerText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "600",
    color: "#6D28D9",
  },
  sectionContainer: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#2D2640",
    marginBottom: 4,
  },
  sectionHint: {
    fontSize: 13,
    color: "#8B7FA8",
    marginBottom: 14,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  // Mood chips
  moodCard: {
    backgroundColor: "white",
    borderRadius: 24,
    paddingVertical: 20,
    paddingHorizontal: 12,
    ...(shadows.sm("#000") as any),
    borderWidth: 1,
    borderColor: "rgba(156, 126, 235, 0.06)",
  },
  moodGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  moodItem: {
    alignItems: "center",
    width: "33.33%",
    paddingVertical: 10,
  },
  moodCircle: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: "#F5F3F8",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  moodCircleSelected: {
    backgroundColor: "#8A63D2",
    borderColor: "#6D28D9",
  },
  moodEmoji: {
    fontSize: 28,
  },
  moodLabel: {
    fontSize: 12,
    color: "#666",
    textAlign: "center",
    fontWeight: "500",
    marginTop: 6,
  },
  moodLabelSelected: {
    color: "#8A63D2",
    fontWeight: "700",
  },
  selectedMoodRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 6,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F0ECF6",
  },
  selectedMoodLabel: {
    fontSize: 13,
    color: "#8B7FA8",
  },
  selectedMoodValue: {
    fontSize: 13,
    fontWeight: "700",
    color: "#8A63D2",
  },
  // Category pills
  pillWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1.5,
    backgroundColor: "white",
  },
  pillText: {
    fontSize: 14,
    fontWeight: "600",
  },
  pillTextSelected: {
    color: "white",
  },
  // Inputs
  inputContainer: {
    backgroundColor: "white",
    borderRadius: 20,
    ...(shadows.sm("#000") as any),
    borderWidth: 1,
    borderColor: "rgba(156, 126, 235, 0.06)",
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
    minHeight: 180,
    lineHeight: 24,
  },
  counterRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  charCounter: {
    fontSize: 12,
    color: "#999",
    fontWeight: "500",
  },
  charCounterWarning: {
    color: "#D32F2F",
    fontWeight: "600",
  },
  goalSection: {
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  goalBar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "#F0ECF6",
    overflow: "hidden",
    marginBottom: 6,
  },
  goalFill: {
    height: "100%",
    borderRadius: 3,
    backgroundColor: "#8A63D2",
  },
  goalText: {
    fontSize: 12,
    color: "#8B7FA8",
    fontWeight: "500",
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
  // Reflection preview
  previewCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "#F3E8FF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E9D5FF",
    padding: 18,
    marginBottom: 8,
  },
  previewEmoji: {
    fontSize: 30,
  },
  previewContent: {
    flex: 1,
  },
  previewTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#6D28D9",
    marginBottom: 2,
  },
  previewText: {
    fontSize: 13,
    color: "#7C5AC8",
    lineHeight: 18,
  },
  // Sticky footer
  footer: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 12,
    backgroundColor: "#F4F2F8",
    borderTopWidth: 1,
    borderTopColor: "rgba(156, 126, 235, 0.12)",
  },
  saveButton: {
    borderRadius: 25,
    overflow: "hidden",
  },
  saveButtonGradient: {
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  saveButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "white",
  },
});
