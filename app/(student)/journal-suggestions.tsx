import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useJournal } from "@/hooks/useJournal";
import { generateJournalSuggestions } from "@/services/geminiService";

interface Suggestion {
  title: string;
  description: string;
  icon: string;
}

export default function JournalSuggestionsScreen() {
  const { entries: journalEntries, loading: entriesLoading } = useJournal();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleBack = () => {
    router.back();
  };

  const generateSuggestionsWithAI = useCallback(
    async (entries: typeof journalEntries) => {
      if (entries.length === 0) {
        Alert.alert(
          "No Entries",
          "Please create some journal entries first to get suggestions.",
        );
        return;
      }

      setAnalyzing(true);
      setError(null);

      try {
        // Prepare journal summary for AI analysis from local cache
        const recentEntries = entries.slice(0, 10); // Last 10 entries
        const journalSummary = recentEntries
          .map(
            (e) =>
              `[${new Date(e.entryDate).toLocaleDateString()}] Mood: ${e.mood}\nTitle: ${e.title}\nThoughts: ${e.thoughts.substring(0, 200)}...`,
          )
          .join("\n\n");

        // Count mood frequencies
        const moodCounts: Record<string, number> = {};
        recentEntries.forEach((e) => {
          moodCounts[e.mood] = (moodCounts[e.mood] || 0) + 1;
        });

        const dominantMood = Object.entries(moodCounts).sort(
          ([, a], [, b]) => b - a,
        )[0]?.[0];

        // Call Gemini directly via geminiService instead of backend proxy
        const result = await generateJournalSuggestions(
          journalSummary,
          dominantMood || "neutral",
        );

        if (result && result.suggestions.length > 0) {
          setSuggestions(result.suggestions);
        } else {
          setError("Unable to generate AI suggestions right now. Please try again later.");
          setSuggestions(getDefaultSuggestions());
        }
      } catch (err: any) {
        console.error("Error generating suggestions:", err);
        setError("Unable to generate AI suggestions right now. Please try again later.");
        // Fallback suggestions
        setSuggestions(getDefaultSuggestions());
      } finally {
        setAnalyzing(false);
      }
    },
    [],
  );

  const getDefaultSuggestions = (): Suggestion[] => {
    return [
      {
        title: "Daily Mindfulness",
        description:
          "Start each day with 5 minutes of meditation or breathing exercises to center yourself.",
        icon: "🧘",
      },
      {
        title: "Physical Activity",
        description:
          "Engage in 30 minutes of exercise (walking, yoga, sports) to boost mood and reduce stress.",
        icon: "🏃",
      },
      {
        title: "Sleep Hygiene",
        description:
          "Maintain a consistent sleep schedule and avoid screens 1 hour before bedtime.",
        icon: "😴",
      },
      {
        title: "Social Connection",
        description:
          "Spend quality time with friends or family. Social support is crucial for wellness.",
        icon: "👥",
      },
      {
        title: "Gratitude Practice",
        description:
          "Write down 3 things you're grateful for each day to build a positive mindset.",
        icon: "🙏",
      },
    ];
  };

  // Auto-generate suggestions when entries load (only once)
  useEffect(() => {
    if (
      !entriesLoading &&
      journalEntries.length > 0 &&
      suggestions.length === 0 &&
      !analyzing
    ) {
      generateSuggestionsWithAI(journalEntries);
    }
  }, [
    entriesLoading,
    journalEntries,
    suggestions.length,
    analyzing,
    generateSuggestionsWithAI,
  ]);

  if (entriesLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#8A63D2" />
          <Text style={styles.loadingText}>Loading your entries...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (analyzing) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#8A63D2" />
          <Text style={styles.loadingText}>
            Analyzing your journal with AI...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={["#E8E0F5", "#F4F2F8", "#E8E0F5"]}
        style={styles.gradient}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={handleBack}>
            <Ionicons name="arrow-back" size={24} color="#666" />
          </Pressable>
          <Text style={styles.headerTitle}>Journal Insights</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView
          style={styles.scrollContainer}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Intro */}
          <View style={styles.introContainer}>
            <Text style={styles.introTitle}>Personalized for You</Text>
            <Text style={styles.introText}>
              Based on your recent journal entries and mood patterns, here are
              our AI-powered recommendations to support your wellness journey.
            </Text>
          </View>

          {/* Error Message */}
          {error && (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={20} color="#D32F2F" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Suggestions List */}
          <View style={styles.suggestionsContainer}>
            {suggestions.map((suggestion, idx) => (
              <View key={idx} style={styles.suggestionCard}>
                <View style={styles.suggestionIcon}>
                  <Text style={styles.iconText}>{suggestion.icon}</Text>
                </View>
                <View style={styles.suggestionContent}>
                  <Text style={styles.suggestionTitle}>{suggestion.title}</Text>
                  <Text style={styles.suggestionDescription}>
                    {suggestion.description}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          {/* Stats */}
          <View style={styles.statsContainer}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Total Entries</Text>
              <Text style={styles.statValue}>{journalEntries.length}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>This Month</Text>
              <Text style={styles.statValue}>
                {
                  journalEntries.filter((e) => {
                    const now = new Date();
                    const entryDate = new Date(e.entryDate);
                    return (
                      entryDate.getMonth() === now.getMonth() &&
                      entryDate.getFullYear() === now.getFullYear()
                    );
                  }).length
                }
              </Text>
            </View>
          </View>

          {/* Regenerate Button */}
          <Pressable
            style={styles.regenerateButton}
            onPress={() => generateSuggestionsWithAI(journalEntries)}
            disabled={analyzing}
          >
            <LinearGradient
              colors={["#9C7EEB", "#8A63D2"]}
              style={styles.regenerateBtnGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Ionicons name="refresh" size={20} color="white" />
              <Text style={styles.regenerateButtonText}>
                Generate New Suggestions
              </Text>
            </LinearGradient>
          </Pressable>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    fontSize: 16,
    color: "#666",
    marginTop: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
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
    color: "#8A63D2",
  },
  placeholder: {
    width: 40,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  introContainer: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    boxShadow: "0px 2px 4px rgba(0,0,0,0.1)",
    elevation: 3,
  },
  introTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#8A63D2",
    marginBottom: 8,
  },
  introText: {
    fontSize: 14,
    color: "#666",
    lineHeight: 20,
  },
  errorContainer: {
    flexDirection: "row",
    backgroundColor: "#FFE0E0",
    borderRadius: 12,
    padding: 12,
    marginBottom: 24,
    alignItems: "center",
  },
  errorText: {
    fontSize: 14,
    color: "#D32F2F",
    marginLeft: 8,
    flex: 1,
  },
  suggestionsContainer: {
    marginBottom: 24,
  },
  suggestionCard: {
    flexDirection: "row",
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    boxShadow: "0px 1px 2px rgba(0,0,0,0.1)",
    elevation: 2,
  },
  suggestionIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#F0F8FF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  iconText: {
    fontSize: 24,
  },
  suggestionContent: {
    flex: 1,
  },
  suggestionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  suggestionDescription: {
    fontSize: 13,
    color: "#666",
    lineHeight: 18,
  },
  statsContainer: {
    flexDirection: "row",
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    marginRight: 8,
    alignItems: "center",
    boxShadow: "0px 1px 2px rgba(0,0,0,0.1)",
    elevation: 2,
  },
  statLabel: {
    fontSize: 12,
    color: "#999",
    marginBottom: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "600",
    color: "#8A63D2",
  },
  regenerateButton: {
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 40,
  },
  regenerateBtnGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
  },
  regenerateButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
});
