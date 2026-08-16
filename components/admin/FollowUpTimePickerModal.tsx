import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import type { MindCareTheme } from "@/constants/theme";
import { useMindCareTheme } from "@/contexts/ThemeContext";

export type TimeValue = {
  hour: number;
  minute: number;
  period: "AM" | "PM";
};

const HOURS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
const PERIODS: TimeValue["period"][] = ["AM", "PM"];

/** Current local time rounded down to the nearest 5 minutes. */
function defaultTime(): TimeValue {
  const now = new Date();
  const period: TimeValue["period"] = now.getHours() >= 12 ? "PM" : "AM";
  let hour = now.getHours() % 12;
  if (hour === 0) hour = 12;
  return { hour, minute: Math.floor(now.getMinutes() / 5) * 5, period };
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function formatDraft(t: TimeValue): string {
  return `${pad(t.hour)}:${pad(t.minute)} ${t.period}`;
}

interface FollowUpTimePickerModalProps {
  visible: boolean;
  /** Currently committed time used to seed the draft. */
  initialTime: TimeValue | null;
  onCancel: () => void;
  /**
   * Commits the draft. `null` means the time was cleared (no time selected).
   */
  onConfirm: (time: TimeValue | null) => void;
}

export function FollowUpTimePickerModal({
  visible,
  initialTime,
  onCancel,
  onConfirm,
}: FollowUpTimePickerModalProps) {
  const { theme } = useMindCareTheme();
  const styles = createStyles(theme);
  const [draft, setDraft] = useState<TimeValue | null>(() =>
    initialTime ? { ...initialTime } : defaultTime(),
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
        <View style={styles.card}>
          <View style={styles.head}>
            <Text style={styles.title}>Select Follow-up Time</Text>
            <Pressable style={styles.closeBtn} onPress={onCancel} hitSlop={6}>
              <Ionicons name="close" size={20} color={theme.secondaryText} />
            </Pressable>
          </View>

          {draft ? (
            <View style={styles.preview}>
              <Ionicons name="time-outline" size={18} color={theme.primary} />
              <Text style={styles.previewText}>{formatDraft(draft)}</Text>
            </View>
          ) : (
            <View style={[styles.preview, styles.previewEmpty]}>
              <Ionicons name="time-outline" size={18} color={theme.secondaryText} />
              <Text style={styles.previewEmptyText}>No time selected</Text>
            </View>
          )}

          <Text style={styles.sectionLabel}>Hour</Text>
          <View style={styles.chipGrid}>
            {HOURS.map((h) => {
              const active = draft !== null && draft.hour === h;
              return (
                <Pressable
                  key={`h${h}`}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() =>
                    setDraft((prev) =>
                      prev ? { ...prev, hour: h } : { hour: h, minute: 0, period: "AM" },
                    )
                  }
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {h}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.sectionLabel}>Minute</Text>
          <View style={styles.chipGrid}>
            {MINUTES.map((m) => {
              const active = draft !== null && draft.minute === m;
              return (
                <Pressable
                  key={`m${m}`}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() =>
                    setDraft((prev) =>
                      prev ? { ...prev, minute: m } : { hour: 12, minute: m, period: "AM" },
                    )
                  }
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {pad(m)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.sectionLabel}>Period</Text>
          <View style={styles.chipRow}>
            {PERIODS.map((p) => {
              const active = draft !== null && draft.period === p;
              return (
                <Pressable
                  key={p}
                  style={[styles.periodChip, active && styles.chipActive]}
                  onPress={() =>
                    setDraft((prev) =>
                      prev ? { ...prev, period: p } : { hour: 12, minute: 0, period: p },
                    )
                  }
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {p}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.footer}>
            <Pressable
              style={[styles.footerBtn, styles.clearBtn]}
              onPress={() => setDraft(null)}
            >
              <Text style={styles.clearBtnText}>Clear</Text>
            </Pressable>
            <Pressable style={[styles.footerBtn, styles.cancelBtn]} onPress={onCancel}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.footerBtn, styles.doneBtn]}
              onPress={() => onConfirm(draft)}
            >
              <Text style={styles.doneBtnText}>Done</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (theme: MindCareTheme) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: "rgba(17,24,39,0.55)",
      justifyContent: "center",
      alignItems: "center",
      padding: 16,
    },
    card: {
      width: "100%",
      maxWidth: 360,
      backgroundColor: theme.card,
      borderRadius: 20,
      padding: 16,
    },
    head: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    title: {
      flex: 1,
      fontSize: 16,
      fontWeight: "800",
      color: theme.text,
    },
    closeBtn: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: theme.inputBg,
      alignItems: "center",
      justifyContent: "center",
    },
    preview: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      marginTop: 14,
      paddingVertical: 12,
      borderRadius: 12,
      backgroundColor: theme.softPurple,
    },
    previewEmpty: {
      backgroundColor: theme.inputBg,
    },
    previewText: {
      fontSize: 20,
      fontWeight: "800",
      color: theme.primary,
    },
    previewEmptyText: {
      fontSize: 14,
      fontWeight: "700",
      color: theme.secondaryText,
    },
    sectionLabel: {
      fontSize: 11,
      fontWeight: "800",
      color: theme.secondaryText,
      textTransform: "uppercase",
      letterSpacing: 0.4,
      marginTop: 12,
      marginBottom: 6,
    },
    chipGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
    },
    chipRow: {
      flexDirection: "row",
      gap: 6,
    },
    chip: {
      width: 40,
      height: 34,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.inputBg,
      alignItems: "center",
      justifyContent: "center",
    },
    chipActive: {
      borderColor: theme.primary,
      backgroundColor: theme.softPurple,
    },
    chipText: {
      fontSize: 13,
      fontWeight: "700",
      color: theme.secondaryText,
    },
    chipTextActive: {
      color: theme.primary,
    },
    periodChip: {
      flex: 1,
      height: 38,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.inputBg,
      alignItems: "center",
      justifyContent: "center",
    },
    footer: {
      flexDirection: "row",
      gap: 10,
      marginTop: 16,
    },
    footerBtn: {
      height: 44,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    clearBtn: {
      flex: 1,
      backgroundColor: `${theme.status.error}1A`,
    },
    clearBtnText: {
      fontSize: 14,
      fontWeight: "700",
      color: theme.status.error,
    },
    cancelBtn: {
      flex: 1,
      backgroundColor: theme.inputBg,
    },
    cancelBtnText: {
      fontSize: 14,
      fontWeight: "700",
      color: theme.secondaryText,
    },
    doneBtn: {
      flex: 1,
      backgroundColor: theme.primary,
    },
    doneBtnText: {
      fontSize: 14,
      fontWeight: "800",
      color: theme.onPrimary,
    },
  });
