import { shadows } from "@/utils/shadows";
import { useJournal } from "@/hooks/useJournal";
import { useNetwork } from "@/contexts/NetworkContext";
import { useMindCareTheme } from "@/contexts/ThemeContext";
import { CATEGORIES, MOODS, getCategory, getMood } from "@/utils/journalOptions";
import { generateLocalReflection, detectRisk } from "@/utils/journalReflection";
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
  FadeOutUp,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

const THOUGHT_LIMIT = 3000;
const TITLE_LIMIT = 200;
const CUSTOM_CATEGORY_LIMIT = 40;
const GOAL_WORDS = 50;
const DRAFT_INTERVAL_MS = 30_000;

export default function NewJournalEntryScreen() {
  const params = useLocalSearchParams<{ date?: string; entryId?: string }>();
  const { addJournalEntry, updateJournalEntry, getJournalEntry, entries, manualSync } =
    useJournal();
  const { isConnected } = useNetwork();
  const { theme } = useMindCareTheme();
  const [entryDate, setEntryDate] = useState<Date>(new Date());
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [customCategory, setCustomCategory] = useState<string>("");
  const [entryTitle, setEntryTitle] = useState<string>("");
  const [selectedMood, setSelectedMood] = useState<string>("");
  const [thoughts, setThoughts] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const [isMoodExpanded, setIsMoodExpanded] = useState(false);
  const chevronRotation = useSharedValue(0);
  const [isCategoryExpanded, setIsCategoryExpanded] = useState(false);
  const categoryChevronRotation = useSharedValue(0);
  const [customCategoryError, setCustomCategoryError] = useState(false);

  const editEntryId = params.entryId;
  const isEditing = !!editEntryId;

  const draftRef = useRef({
    title: "",
    thoughts: "",
    mood: "",
    category: "",
    customCategory: "",
  });
  draftRef.current = {
    title: entryTitle,
    thoughts,
    mood: selectedMood,
    category: selectedCategory,
    customCategory,
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
        setCustomCategory(entry.customCategory || "");
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
      if (
        draft.title ||
        draft.thoughts ||
        draft.mood ||
        draft.category ||
        draft.customCategory
      ) {
        setEntryTitle(draft.title || "");
        setThoughts(draft.thoughts || "");
        setSelectedMood(draft.mood || "");
        setSelectedCategory(draft.category || "");
        setCustomCategory(draft.customCategory || "");
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
      if (
        d.mood ||
        d.category ||
        d.customCategory ||
        d.title.trim() ||
        d.thoughts.trim()
      ) {
        journalDraftStorage.saveDraft({
          title: d.title,
          thoughts: d.thoughts,
          mood: d.mood,
          category: d.category,
          customCategory: d.customCategory,
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

    if (selectedCategory === "other" && !customCategory.trim()) {
      setCustomCategoryError(true);
      return;
    }

    setSaving(true);
    try {
      const sanitize = (s: string, max: number) => s.trim().slice(0, max);
      const now = new Date().toISOString();
      const risk = detectRisk(thoughts);

      // High-risk entries are always saved, but a casual wellness reflection
      // is intentionally NOT generated for them — the saved screen routes the
      // student toward crisis support instead.
      const isHighRiskEntry = risk.riskLevel === "high";
      const localReflection = isHighRiskEntry
        ? null
        : generateLocalReflection({
            mood: selectedMood,
            category: selectedCategory,
            title: entryTitle,
            thoughts,
            history: entries.filter((e) => e.id !== editEntryId),
          });
      const data = {
        category: selectedCategory,
        customCategory:
          selectedCategory === "other"
            ? sanitize(customCategory, CUSTOM_CATEGORY_LIMIT)
            : undefined,
        mood: selectedMood,
        title: sanitize(entryTitle, TITLE_LIMIT),
        thoughts: sanitize(thoughts, THOUGHT_LIMIT),
        reflection: localReflection
          ? [
              localReflection.sections.summary,
              localReflection.sections.positive,
              localReflection.sections.suggestion,
              localReflection.sections.encouragement,
            ]
              .filter(Boolean)
              .join(" ")
          : "",
        reflectionLocal: localReflection ? localReflection.sections : undefined,
        reflectionStatus: localReflection ? ("local" as const) : undefined,
        reflectionSource: localReflection ? ("local" as const) : undefined,
        generatedAt: localReflection ? now : undefined,
        wellnessTips: localReflection ? localReflection.wellnessTips : undefined,
        riskLevel: risk.riskLevel,
        riskScore: risk.riskScore,
        riskDetected: risk.riskDetected,
        riskKeywords: risk.riskKeywords,
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
        manualSync();
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
    selectedCategory &&
      selectedMood &&
      entryTitle.trim() &&
      thoughts.trim(),
  );

  const selectedMoodOption = getMood(selectedMood);
  const selectedCategoryOption = getCategory(selectedCategory);

  const toggleMoodExpanded = () => {
    const next = !isMoodExpanded;
    setIsMoodExpanded(next);
    chevronRotation.value = withTiming(next ? 180 : 0, { duration: 200 });
  };

  const handleSelectMood = (moodId: string) => {
    setSelectedMood(moodId);
    setIsMoodExpanded(false);
    chevronRotation.value = withTiming(0, { duration: 200 });
  };

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${chevronRotation.value}deg` }],
  }));

  const toggleCategoryExpanded = () => {
    const next = !isCategoryExpanded;
    setIsCategoryExpanded(next);
    categoryChevronRotation.value = withTiming(next ? 180 : 0, {
      duration: 200,
    });
  };

  const handleSelectCategory = (categoryId: string) => {
    setSelectedCategory(categoryId);
    setCustomCategoryError(false);
    if (categoryId !== "other") {
      setCustomCategory("");
    }
    setIsCategoryExpanded(false);
    categoryChevronRotation.value = withTiming(0, { duration: 200 });
  };

  const categoryChevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${categoryChevronRotation.value}deg` }],
  }));

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
            <View style={{ width: 40 }} />
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

          {/* Mood Selection (collapsible) */}
          <Animated.View
            entering={FadeIn.duration(350)}
            layout={LinearTransition.duration(200)}
          >
            <View
              style={[
                styles.moodCard,
                { backgroundColor: theme.card, borderColor: theme.border },
              ]}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: isMoodExpanded }}
                accessibilityLabel={
                  isMoodExpanded
                    ? "Today's mood, expanded. Double tap to collapse."
                    : `Today's mood${
                        selectedMoodOption
                          ? `, ${selectedMoodOption.label}`
                          : ""
                      }. Double tap to expand.`
                }
                onPress={toggleMoodExpanded}
                style={styles.moodHeader}
                hitSlop={8}
              >
                <View style={styles.moodHeaderLeft}>
                  <Text style={styles.moodHeaderIcon}>💭</Text>
                  <Text style={[styles.moodHeaderTitle, { color: theme.text }]}>
                    Today's mood
                  </Text>
                </View>
                <View style={styles.moodHeaderRight}>
                  {selectedMoodOption ? (
                    <>
                      <Text style={styles.moodHeaderEmoji}>
                        {selectedMoodOption.emoji}
                      </Text>
                      <Text
                        style={[styles.moodHeaderValue, { color: theme.primary }]}
                      >
                        {selectedMoodOption.label}
                      </Text>
                    </>
                  ) : (
                    <Text
                      style={[
                        styles.moodHeaderPlaceholder,
                        { color: theme.secondaryText },
                      ]}
                    >
                      Choose your mood
                    </Text>
                  )}
                  <Animated.View style={chevronStyle}>
                    <Ionicons
                      name="chevron-down"
                      size={20}
                      color={theme.primary}
                    />
                  </Animated.View>
                </View>
              </Pressable>

              {isMoodExpanded && (
                <Animated.View
                  entering={FadeInDown.duration(180)}
                  exiting={FadeOutUp.duration(150)}
                >
                  <View style={styles.moodBody}>
                    <Text
                      style={[styles.moodHint, { color: theme.secondaryText }]}
                    >
                      Pick the mood that matches how you feel right now.
                    </Text>
                    <View style={styles.moodGrid}>
                      {MOODS.map((mood) => {
                        const isSelected = selectedMood === mood.id;
                        return (
                          <Pressable
                            key={mood.id}
                            style={styles.moodItem}
                            onPress={() => handleSelectMood(mood.id)}
                          >
                            <View
                              style={[
                                styles.moodCircle,
                                { backgroundColor: theme.inputBg },
                                isSelected && [
                                  styles.moodCircleSelected,
                                  {
                                    backgroundColor: theme.primary,
                                    borderColor: theme.primaryDeep,
                                  },
                                ],
                              ]}
                            >
                              <Text style={styles.moodEmoji}>{mood.emoji}</Text>
                            </View>
                            <Text
                              style={[
                                styles.moodLabel,
                                { color: theme.secondaryText },
                                isSelected && [
                                  styles.moodLabelSelected,
                                  { color: theme.primary },
                                ],
                              ]}
                            >
                              {mood.label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                    {selectedMoodOption && (
                      <View
                        style={[
                          styles.selectedMoodRow,
                          { borderTopColor: theme.border },
                        ]}
                      >
                        <Text
                          style={[
                            styles.selectedMoodLabel,
                            { color: theme.secondaryText },
                          ]}
                        >
                          Current mood:{" "}
                        </Text>
                        <Text
                          style={[
                            styles.selectedMoodValue,
                            { color: theme.primary },
                          ]}
                        >
                          {selectedMoodOption.emoji} {selectedMoodOption.label}
                        </Text>
                      </View>
                    )}
                  </View>
                </Animated.View>
              )}
            </View>
          </Animated.View>

          {/* Category Selection (collapsible) */}
          <Animated.View
            entering={FadeInDown.delay(80).duration(350)}
            layout={LinearTransition.duration(200)}
          >
            <View
              style={[
                styles.categoryCard,
                { backgroundColor: theme.card, borderColor: theme.border },
              ]}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: isCategoryExpanded }}
                accessibilityLabel={
                  isCategoryExpanded
                    ? "Journal category selector, expanded. Double tap to collapse."
                    : `Journal category${
                        selectedCategoryOption
                          ? `, ${
                              selectedCategoryOption.id === "other" &&
                              customCategory.trim()
                                ? customCategory.trim()
                                : selectedCategoryOption.name
                            }`
                          : ""
                      }. Double tap to expand.`
                }
                onPress={toggleCategoryExpanded}
                style={styles.categoryHeader}
                hitSlop={8}
              >
                <View style={styles.categoryHeaderLeft}>
                  <Text style={styles.categoryHeaderIcon}>🏷️</Text>
                  <Text
                    style={[styles.categoryHeaderTitle, { color: theme.text }]}
                  >
                    Category
                  </Text>
                </View>
                <View style={styles.categoryHeaderRight}>
                  {selectedCategoryOption ? (
                    <>
                      <Text style={styles.categoryHeaderEmoji}>
                        {selectedCategoryOption.emoji}
                      </Text>
                      <Text
                        style={[
                          styles.categoryHeaderValue,
                          { color: theme.primary },
                        ]}
                        numberOfLines={1}
                      >
                        {selectedCategoryOption.id === "other" &&
                        customCategory.trim()
                          ? customCategory.trim()
                          : selectedCategoryOption.name}
                      </Text>
                    </>
                  ) : (
                    <Text
                      style={[
                        styles.categoryHeaderPlaceholder,
                        { color: theme.secondaryText },
                      ]}
                    >
                      Choose
                    </Text>
                  )}
                  <Animated.View style={categoryChevronStyle}>
                    <Ionicons
                      name="chevron-down"
                      size={20}
                      color={theme.primary}
                    />
                  </Animated.View>
                </View>
              </Pressable>

              {isCategoryExpanded && (
                <Animated.View
                  entering={FadeInDown.duration(180)}
                  exiting={FadeOutUp.duration(150)}
                >
                  <View style={styles.categoryBody}>
                    <Text
                      style={[
                        styles.categoryHint,
                        { color: theme.secondaryText },
                      ]}
                    >
                      Choose the area of your life this entry is about.
                    </Text>
                    <View style={styles.categoryGrid}>
                      {CATEGORIES.map((category) => {
                        const isSelected = selectedCategory === category.id;
                        return (
                          <Pressable
                            key={category.id}
                            onPress={() => handleSelectCategory(category.id)}
                            accessibilityRole="button"
                            accessibilityState={{ selected: isSelected }}
                            accessibilityLabel={
                              category.id === "other"
                                ? "Other category. Enter a custom category."
                                : `${category.name} category`
                            }
                            style={[
                              styles.categoryChip,
                              {
                                backgroundColor: theme.inputBg,
                                borderColor: theme.border,
                              },
                              isSelected && {
                                backgroundColor: theme.softPurple,
                                borderColor: theme.primary,
                              },
                            ]}
                          >
                            <Text style={styles.categoryChipEmoji}>
                              {category.emoji}
                            </Text>
                            <Text
                              style={[
                                styles.categoryChipText,
                                { color: theme.text },
                                isSelected && [
                                  styles.categoryChipTextSelected,
                                  { color: theme.primary },
                                ],
                              ]}
                              numberOfLines={1}
                            >
                              {category.name}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                </Animated.View>
              )}

              {selectedCategory === "other" && (
                <View
                  style={[
                    styles.customCategoryRow,
                    { borderTopColor: theme.border },
                  ]}
                >
                  <Text
                    style={[
                      styles.customCategoryLabel,
                      { color: theme.secondaryText },
                    ]}
                  >
                    ✏️ Name your category
                  </Text>
                  <TextInput
                    style={[
                      styles.customCategoryInput,
                      {
                        backgroundColor: theme.inputBg,
                        color: theme.text,
                        borderColor: customCategoryError
                          ? "#EF4444"
                          : "transparent",
                      },
                    ]}
                    placeholder="e.g. Travel, Hobbies..."
                    placeholderTextColor={theme.secondaryText}
                    value={customCategory}
                    onChangeText={(text) => {
                      setCustomCategory(text);
                      if (text.trim()) setCustomCategoryError(false);
                    }}
                    maxLength={CUSTOM_CATEGORY_LIMIT}
                    accessibilityLabel="Custom category"
                    accessibilityHint="Enter a name for your custom category"
                  />
                  {customCategoryError && (
                    <Text style={styles.customCategoryError}>
                      Please enter a category.
                    </Text>
                  )}
                </View>
              )}
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
    paddingBottom: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 8,
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
    paddingBottom: 8,
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
    paddingTop: 14,
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
    borderRadius: 20,
    overflow: "hidden",
    ...(shadows.sm("#000") as any),
    borderWidth: 1,
    borderColor: "rgba(156, 126, 235, 0.06)",
  },
  moodHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  moodHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  moodHeaderIcon: {
    fontSize: 18,
  },
  moodHeaderTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#2D2640",
  },
  moodHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 1,
  },
  moodHeaderEmoji: {
    fontSize: 18,
  },
  moodHeaderValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#8A63D2",
    flexShrink: 1,
  },
  moodHeaderPlaceholder: {
    fontSize: 14,
    fontWeight: "500",
    color: "#8B7FA8",
  },
  moodBody: {
    paddingHorizontal: 12,
    paddingBottom: 16,
  },
  moodHint: {
    fontSize: 12,
    color: "#8B7FA8",
    marginTop: 6,
    marginBottom: 12,
    paddingHorizontal: 4,
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
  // Category picker
  categoryCard: {
    backgroundColor: "white",
    borderRadius: 20,
    overflow: "hidden",
    ...(shadows.sm("#000") as any),
    borderWidth: 1,
    borderColor: "rgba(156, 126, 235, 0.06)",
    marginBottom: 24,
  },
  categoryHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  categoryHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  categoryHeaderIcon: {
    fontSize: 18,
  },
  categoryHeaderTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#2D2640",
  },
  categoryHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 1,
  },
  categoryHeaderEmoji: {
    fontSize: 18,
  },
  categoryHeaderValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#8A63D2",
    flexShrink: 1,
  },
  categoryHeaderPlaceholder: {
    fontSize: 14,
    fontWeight: "500",
    color: "#8B7FA8",
  },
  categoryBody: {
    paddingHorizontal: 12,
    paddingBottom: 16,
  },
  categoryHint: {
    fontSize: 12,
    color: "#8B7FA8",
    marginTop: 6,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 10,
  },
  categoryChip: {
    width: "47%",
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: "#F7F4FC",
  },
  categoryChipEmoji: {
    fontSize: 20,
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: "600",
    flexShrink: 1,
  },
  categoryChipTextSelected: {
    fontWeight: "700",
  },
  customCategoryRow: {
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  customCategoryLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#8B7FA8",
  },
  customCategoryInput: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: "500",
    borderWidth: 1,
  },
  customCategoryError: {
    fontSize: 12,
    fontWeight: "600",
    color: "#EF4444",
    paddingHorizontal: 2,
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
