import ClockTimePicker from "@/components/ClockTimePicker";
import { useCustomReminders } from "@/hooks/useCustomReminders";
import { requestNotificationPermissions } from "@/services/notificationService";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function fmtTime(h: number, m: number, p: string) {
  return `${h}:${String(m).padStart(2, "0")} ${p}`;
}

export default function RemindersScreen() {
  const { reminders, loading, add, toggle, remove, update } =
    useCustomReminders();

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [time, setTime] = useState<{
    hour: number;
    minute: number;
    period: "AM" | "PM";
  }>({ hour: 9, minute: 0, period: "AM" });
  const [repeatDays, setRepeatDays] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  useEffect(() => {
    requestNotificationPermissions().catch(() => {});
  }, []);

  const resetForm = () => {
    setTitle("");
    setMessage("");
    setTime({ hour: 9, minute: 0, period: "AM" });
    setRepeatDays([]);
    setShowForm(false);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert("Required", "Please enter a reminder title.");
      return;
    }
    setSaving(true);
    try {
      await add({
        title: title.trim(),
        message: message.trim(),
        hour: time.hour,
        minute: time.minute,
        period: time.period,
        enabled: true,
        repeatDays,
      });
      resetForm();
    } catch {
      Alert.alert("Error", "Failed to save reminder.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (id: string) => {
    await toggle(id);
  };

  const handleDelete = (id: string, reminderTitle: string) => {
    Alert.alert(
      "Delete Reminder",
      `Delete "${reminderTitle}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => remove(id),
        },
      ],
    );
  };

  const toggleRepeatDay = (day: number) => {
    setRepeatDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={s.container}>
        <ActivityIndicator style={{ marginTop: 60 }} color="#8A63D2" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container}>
      {/* ── Header ── */}
      <LinearGradient
        colors={["#8A63D2", "#7C5AC8"]}
        style={s.headerGradient}
      >
        <View style={s.header}>
          <Pressable
            style={s.backBtn}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color="white" />
          </Pressable>
          <Text style={s.headerTitle}>Reminders</Text>
          <Pressable
            style={s.addBtn}
            onPress={() => {
              requestNotificationPermissions();
              setShowForm(!showForm);
            }}
          >
            <Ionicons
              name={showForm ? "close" : "add"}
              size={24}
              color="white"
            />
          </Pressable>
        </View>
        <Text style={s.subtitle}>
          Set local daily reminders that notify you on this device
        </Text>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={s.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Add Form ── */}
        {showForm && (
          <View style={s.formCard}>
            <Text style={s.formTitle}>New Reminder</Text>

            {/* Title */}
            <Text style={s.label}>Title</Text>
            <TextInput
              style={s.input}
              value={title}
              onChangeText={setTitle}
              placeholder="e.g., Take medication"
              placeholderTextColor="#999"
              maxLength={100}
            />

            {/* Message */}
            <Text style={s.label}>Message (optional)</Text>
            <TextInput
              style={s.input}
              value={message}
              onChangeText={setMessage}
              placeholder="e.g., Drink water and stretch"
              placeholderTextColor="#999"
              maxLength={200}
            />

            {/* Time Picker */}
            <Text style={s.label}>Time</Text>
            <Pressable
              style={s.timeField}
              onPress={() => setShowTimePicker(true)}
            >
              <Ionicons name="alarm-outline" size={18} color="#8A63D2" />
              <Text style={s.timeFieldText}>
                {fmtTime(time.hour, time.minute, time.period)}
              </Text>
              <Ionicons name="chevron-forward" size={16} color="#C4B5D0" />
            </Pressable>
            <ClockTimePicker
              visible={showTimePicker}
              val={time}
              onChange={setTime}
              onDismiss={() => setShowTimePicker(false)}
            />

            {/* Repeat Days */}
            <Text style={s.label}>Repeat</Text>
            <View style={s.dayRow}>
              {WEEKDAYS.map((day, idx) => {
                const selected = repeatDays.includes(idx);
                return (
                  <Pressable
                    key={idx}
                    style={[s.dayPill, selected && s.dayPillSelected]}
                    onPress={() => toggleRepeatDay(idx)}
                  >
                    <Text
                      style={[
                        s.dayPillText,
                        selected && s.dayPillTextSelected,
                      ]}
                    >
                      {day}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={s.hint}>
              {repeatDays.length === 0
                ? "Repeats every day"
                : `Repeats ${repeatDays.length} day${repeatDays.length > 1 ? "s" : ""} per week`}
            </Text>

            {/* Save */}
            <Pressable
              style={[s.saveBtn, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Text style={s.saveBtnText}>Save Reminder</Text>
              )}
            </Pressable>
          </View>
        )}

        {/* ── Reminder List ── */}
        {reminders.length === 0 && !showForm ? (
          <View style={s.emptyState}>
            <Ionicons
              name="notifications-off-outline"
              size={48}
              color="#C4B5D0"
            />
            <Text style={s.emptyTitle}>No reminders yet</Text>
            <Text style={s.emptyDesc}>
              Tap + to create your first daily reminder
            </Text>
          </View>
        ) : (
          reminders.map((r) => (
            <View key={r.id} style={s.reminderCard}>
              <View style={s.reminderTop}>
                <View
                  style={[
                    s.timePill,
                    r.enabled ? s.timePillActive : s.timePillInactive,
                  ]}
                >
                  <Ionicons
                    name="alarm-outline"
                    size={16}
                    color={r.enabled ? "white" : "#999"}
                  />
                  <Text
                    style={[
                      s.timePillText,
                      r.enabled ? s.timePillTextActive : s.timePillTextInactive,
                    ]}
                  >
                    {fmtTime(r.hour, r.minute, r.period)}
                  </Text>
                </View>
                <Switch
                  trackColor={{ false: "#E0E0E0", true: "#8A63D2" }}
                  thumbColor="#FFFFFF"
                  ios_backgroundColor="#E0E0E0"
                  onValueChange={() => handleToggle(r.id)}
                  value={r.enabled}
                />
              </View>
              <Text style={s.reminderTitle} numberOfLines={1}>
                {r.title}
              </Text>
              {r.message ? (
                <Text style={s.reminderMessage} numberOfLines={2}>
                  {r.message}
                </Text>
              ) : null}
              <View style={s.reminderBottom}>
                <Text style={s.repeatLabel}>
                  {r.repeatDays.length === 0
                    ? "Every day"
                    : r.repeatDays.map((d) => WEEKDAYS[d]).join(", ")}
                </Text>
                <Pressable
                  style={s.deleteBtn}
                  onPress={() => handleDelete(r.id, r.title)}
                >
                  <Ionicons
                    name="trash-outline"
                    size={18}
                    color="#EF4444"
                  />
                </Pressable>
              </View>
            </View>
          ))
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F4F2F8" },
  headerGradient: { paddingBottom: 20 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    color: "white",
    fontSize: 20,
    fontWeight: "700",
  },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  subtitle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.85)",
    textAlign: "center",
    paddingHorizontal: 20,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },

  /* ── Form ── */
  formCard: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    // @ts-ignore
    boxShadow: "0px 4px 16px rgba(138, 99, 210, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(156, 126, 235, 0.06)",
  },
  formTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1E1B4B",
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: "#7C6B93",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 14,
    marginBottom: 6,
  },
  input: {
    backgroundColor: "#FAF8FF",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E9D5FF",
    fontSize: 15,
    color: "#1E1B4B",
  },
  timeField: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FAF8FF",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E9D5FF",
    gap: 8,
  },
  timeFieldText: {
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
    color: "#1E1B4B",
    fontVariant: ["tabular-nums"],
  },
  dayRow: {
    flexDirection: "row",
    gap: 6,
    flexWrap: "wrap",
  },
  dayPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#F3EAFF",
  },
  dayPillSelected: {
    backgroundColor: "#8A63D2",
  },
  dayPillText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#8A63D2",
  },
  dayPillTextSelected: {
    color: "white",
  },
  hint: {
    fontSize: 12,
    color: "#999",
    marginTop: 6,
  },
  saveBtn: {
    marginTop: 20,
    backgroundColor: "#8A63D2",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    // @ts-ignore
    boxShadow: "0px 4px 12px rgba(138, 99, 210, 0.3)",
  },
  saveBtnText: {
    color: "white",
    fontSize: 15,
    fontWeight: "700",
  },

  /* ── Empty State ── */
  emptyState: {
    alignItems: "center",
    paddingTop: 80,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#7C6B93",
  },
  emptyDesc: {
    fontSize: 14,
    color: "#999",
    textAlign: "center",
  },

  /* ── Reminder Cards ── */
  reminderCard: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    // @ts-ignore
    boxShadow: "0px 2px 10px rgba(138, 99, 210, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(156, 126, 235, 0.05)",
  },
  reminderTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  timePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  timePillActive: {
    backgroundColor: "#8A63D2",
  },
  timePillInactive: {
    backgroundColor: "#F1F5F9",
  },
  timePillText: {
    fontSize: 14,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  timePillTextActive: {
    color: "white",
  },
  timePillTextInactive: {
    color: "#999",
  },
  reminderTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1E1B4B",
  },
  reminderMessage: {
    fontSize: 13,
    color: "#888",
    marginTop: 4,
  },
  reminderBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(156, 126, 235, 0.06)",
  },
  repeatLabel: {
    fontSize: 12,
    color: "#999",
    fontWeight: "600",
  },
  deleteBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#FEF2F2",
    justifyContent: "center",
    alignItems: "center",
  },
});
