import { MindCareTheme } from "@/constants/theme";
import { JournalEntry } from "@/services/journalService";
import { getCategoryLabel, getMood } from "@/utils/journalOptions";
import { formatJournalDate } from "@/utils/constellationOptions";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

const PREVIEW_LIMIT = 140;

const truncatePreview = (text: string): string => {
  const cleaned = (text || "").replace(/\s+/g, " ").trim();
  if (cleaned.length <= PREVIEW_LIMIT) return cleaned;
  return `${cleaned.slice(0, PREVIEW_LIMIT).trimEnd()}…`;
};

const timeLabelFor = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
};

interface DailyReflectionModalProps {
  /** Normalized YYYY-MM-DD date being reflected on, or null to hide. */
  date: string | null;
  /** Every journal entry belonging to that day. */
  entries: JournalEntry[];
  theme: MindCareTheme;
  onClose: () => void;
  onViewJournal: (journalId: string) => void;
}

export function DailyReflectionModal({
  date,
  entries,
  theme,
  onClose,
  onViewJournal,
}: DailyReflectionModalProps) {
  const visible = date !== null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropTouch} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.card,
              borderColor: theme.border,
            },
          ]}
        >
          <View style={styles.grabber} />

          <View style={styles.header}>
            <Text style={[styles.eyebrow, { color: theme.primary }]}>
              ✨ Your Reflections
            </Text>
            <Text style={[styles.title, { color: theme.text }]}>
              {date ? formatJournalDate(date) : ""}
            </Text>
            <Text style={[styles.subtitle, { color: theme.secondaryText }]}>
              {entries.length}{" "}
              {entries.length === 1 ? "journal entry" : "journal entries"}
            </Text>
          </View>

          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          >
            {entries.map((entry) => {
              const mood = getMood(entry.mood);
              const categoryName = getCategoryLabel(
                entry.category,
                entry.customCategory,
              );
              return (
                <View
                  key={entry.id}
                  style={[
                    styles.card,
                    {
                      backgroundColor: theme.inputBg,
                      borderColor: theme.border,
                    },
                  ]}
                >
                  <Text style={[styles.cardTitle, { color: theme.text }]}>
                    {entry.title}
                  </Text>

                  <View style={styles.tags}>
                    <View style={[styles.tag, { backgroundColor: theme.card }]}>
                      <Text style={[styles.tagText, { color: theme.text }]}>
                        {mood?.emoji ?? "❓"} {mood?.label ?? entry.mood}
                      </Text>
                    </View>
                    <View style={[styles.tag, { backgroundColor: theme.card }]}>
                      <Text style={[styles.tagText, { color: theme.text }]}>
                        {categoryName}
                      </Text>
                    </View>
                    <Text
                      style={[styles.time, { color: theme.secondaryText }]}
                    >
                      {timeLabelFor(entry.createdAt)}
                    </Text>
                  </View>

                  {entry.thoughts ? (
                    <Text
                      style={[
                        styles.preview,
                        { color: theme.secondaryText },
                      ]}
                      numberOfLines={3}
                    >
                      {truncatePreview(entry.thoughts)}
                    </Text>
                  ) : null}

                  <Pressable
                    style={[styles.button, { backgroundColor: theme.primary }]}
                    onPress={() => onViewJournal(entry.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`View journal: ${entry.title}`}
                  >
                    <Ionicons name="book-outline" size={16} color="#FFFFFF" />
                    <Text style={styles.buttonText}>View Journal</Text>
                  </Pressable>
                </View>
              );
            })}
          </ScrollView>

          <Pressable
            onPress={onClose}
            hitSlop={8}
            style={styles.closeButton}
            accessibilityRole="button"
            accessibilityLabel="Close reflections"
          >
            <Text style={[styles.closeText, { color: theme.secondaryText }]}>
              Close
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(10, 8, 18, 0.55)",
  },
  backdropTouch: {
    flex: 1,
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
    maxHeight: "85%",
  },
  grabber: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: "rgba(138, 99, 210, 0.35)",
    alignSelf: "center",
    marginBottom: 16,
  },
  header: {
    alignItems: "center",
    marginBottom: 14,
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: "600",
  },
  list: {
    flexShrink: 1,
  },
  listContent: {
    paddingBottom: 8,
    gap: 10,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 6,
  },
  tags: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 8,
  },
  tag: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tagText: {
    fontSize: 12,
    fontWeight: "600",
  },
  time: {
    fontSize: 12,
    fontWeight: "600",
  },
  preview: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 12,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 20,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  closeButton: {
    alignSelf: "center",
    marginTop: 12,
    padding: 6,
  },
  closeText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
