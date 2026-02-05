import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";

interface ReminderItem {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  enabled: boolean;
}

export default function DailyRemindersScreen() {
  const [reminders, setReminders] = useState<ReminderItem[]>([
    {
      id: "break-time",
      title: "Break Time",
      description: "Take regular breaks every hour",
      icon: "cafe",
      color: "#FF9800",
      enabled: true,
    },
    {
      id: "hydration",
      title: "Hydration",
      description: "Drink water every 2 hours",
      icon: "water",
      color: "#2196F3",
      enabled: true,
    },
    {
      id: "sleep-schedule",
      title: "Sleep Schedule",
      description: "Bedtime reminder at 10 PM",
      icon: "moon",
      color: "#9C27B0",
      enabled: false,
    },
    {
      id: "task-submission",
      title: "Task Submission",
      description: "Complete your assignments on time",
      icon: "checkmark-circle",
      color: "#4CAF50",
      enabled: true,
    },
  ]);

  const handleBack = () => {
    router.replace("/dashboard");
  };

  const toggleReminder = (id: string) => {
    setReminders((prev) =>
      prev.map((reminder) =>
        reminder.id === id
          ? { ...reminder, enabled: !reminder.enabled }
          : reminder,
      ),
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={["#2196F3", "#1976D2"]}
        style={styles.headerGradient}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={handleBack}>
            <Ionicons name="arrow-back" size={24} color="white" />
          </Pressable>
          <Text style={styles.headerTitle}>Daily Reminders</Text>
          <View style={styles.placeholder} />
        </View>

        {/* Subtitle */}
        <View style={styles.subtitleContainer}>
          <Text style={styles.subtitle}>
            Manage your daily wellness reminders
          </Text>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Reminder Cards */}
        <View style={styles.cardsContainer}>
          {reminders.map((reminder) => (
            <View key={reminder.id} style={styles.card}>
              <View style={styles.cardContent}>
                <View style={styles.leftSection}>
                  <View
                    style={[
                      styles.iconContainer,
                      { backgroundColor: reminder.color },
                    ]}
                  >
                    <Ionicons
                      name={reminder.icon as any}
                      size={24}
                      color="white"
                    />
                  </View>
                  <View style={styles.textContainer}>
                    <Text style={styles.reminderTitle}>{reminder.title}</Text>
                    <Text style={styles.reminderDescription}>
                      {reminder.description}
                    </Text>
                  </View>
                </View>
                <Switch
                  trackColor={{
                    false: "#E0E0E0",
                    true: reminder.enabled ? "#4CAF50" : "#E0E0E0",
                  }}
                  thumbColor={reminder.enabled ? "#FFFFFF" : "#FFFFFF"}
                  ios_backgroundColor="#E0E0E0"
                  onValueChange={() => toggleReminder(reminder.id)}
                  value={reminder.enabled}
                  style={styles.switch}
                />
              </View>
            </View>
          ))}
        </View>

        {/* Bottom Message */}
        <View style={styles.messageContainer}>
          <Text style={styles.messageText}>
            These reminders help you maintain healthy habits throughout your
            day.{"\n"}
            Enable the ones that work best for you!
          </Text>
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
  cardsContainer: {
    gap: 16,
    marginBottom: 30,
  },
  card: {
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
  cardContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  leftSection: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  textContainer: {
    flex: 1,
  },
  reminderTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  reminderDescription: {
    fontSize: 14,
    color: "#666",
    lineHeight: 20,
  },
  switch: {
    transform: [{ scaleX: 1.1 }, { scaleY: 1.1 }],
  },
  messageContainer: {
    backgroundColor: "rgba(33, 150, 243, 0.1)",
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
  },
  messageText: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    lineHeight: 20,
  },
});
