import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

// Firebase
import { auth, db } from "@/constants/firebase";
import { addDoc, collection, doc, serverTimestamp } from "firebase/firestore";

interface Category {
  id: string;
  name: string;
  color: string;
}

export default function NewJournalEntryScreen() {
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [entryTitle, setEntryTitle] = useState<string>("");
  const [thoughts, setThoughts] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const categories: Category[] = [
    { id: "personal", name: "Personal", color: "#2196F3" },
    { id: "academic", name: "Academic", color: "#4CAF50" },
    { id: "wellness", name: "Wellness", color: "#9C27B0" },
    { id: "social", name: "Social", color: "#E91E63" },
    { id: "goals", name: "Goals", color: "#FF9800" },
    { id: "gratitude", name: "Gratitude", color: "#00BCD4" },
  ];

  const handleBack = () => {
    router.back();
  };

  const handleSaveEntry = () => {
    // Save to Firebase under users/{uid}/journalEntries
    (async () => {
      if (!auth.currentUser) {
        Alert.alert("Not signed in", "Please login to save entries.");
        router.push("/login");
        return;
      }

      if (!selectedCategory || !entryTitle.trim() || !thoughts.trim()) {
        Alert.alert(
          "Validation",
          "Please complete category, title, and thoughts.",
        );
        return;
      }

      setSaving(true);
      try {
        const uid = auth.currentUser.uid;
        const sanitize = (s: string, max = 2000) => s.trim().slice(0, max);
        const data = {
          category: selectedCategory,
          title: sanitize(entryTitle, 200),
          thoughts: sanitize(thoughts, 2000),
          createdAt: serverTimestamp(),
        } as Record<string, any>;

        const entriesRef = collection(doc(db, "users", uid), "journalEntries");
        await addDoc(entriesRef, data);

        Alert.alert("Saved", "Your journal entry has been saved.");
        router.replace("/daily-journal");
      } catch (err) {
        console.error("Error saving journal entry", err);
        Alert.alert("Error", "Unable to save entry. Please try again.");
      } finally {
        setSaving(false);
      }
    })();
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
          <Text style={styles.subtitle}>How are you feeling today?</Text>
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
          <Text style={styles.sectionTitle}>Your Thoughts</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.thoughtsInput}
              placeholder="Write about your day, feelings, or thoughts..."
              placeholderTextColor="#999"
              value={thoughts}
              onChangeText={setThoughts}
              multiline
              numberOfLines={8}
              textAlignVertical="top"
            />
          </View>
        </View>

        {/* Save Button */}
        <View style={styles.buttonContainer}>
          <Pressable
            style={[
              styles.saveButtonContainer,
              (!selectedCategory || !entryTitle.trim() || !thoughts.trim()) &&
                styles.disabledButton,
            ]}
            onPress={handleSaveEntry}
            disabled={
              !selectedCategory || !entryTitle.trim() || !thoughts.trim()
            }
          >
            <LinearGradient
              colors={["#4CAF50", "#00BCD4", "#2196F3"]}
              style={styles.saveButton}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={styles.saveButtonText}>Save Entry</Text>
            </LinearGradient>
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
    width: "30%",
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
  buttonContainer: {
    marginTop: 20,
  },
  saveButtonContainer: {
    borderRadius: 25,
  },
  disabledButton: {
    opacity: 0.5,
  },
  saveButton: {
    paddingVertical: 16,
    borderRadius: 25,
    alignItems: "center",
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "white",
  },
});
