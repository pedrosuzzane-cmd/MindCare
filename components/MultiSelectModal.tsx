import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useMindCareTheme } from "@/contexts/ThemeContext";
import type { MindCareTheme } from "@/constants/theme";

export interface MultiSelectItem {
  key: string;
  label: string;
  description?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  color?: string;
}

interface Props {
  visible: boolean;
  title: string;
  items: MultiSelectItem[];
  selected?: string[];
  maxSelection?: number;
  accentColor?: string;
  onConfirm: (keys: string[]) => void;
  onCancel: () => void;
}

export default function MultiSelectModal({
  visible,
  title,
  items,
  selected = [],
  maxSelection,
  accentColor,
  onConfirm,
  onCancel,
}: Props) {
  const { theme } = useMindCareTheme();
  const styles = createStyles(theme);
  const resolvedAccent = accentColor ?? theme.primary;

  const [query, setQuery] = useState("");

  const [sel, setSel] = useState<string[]>([]);

  React.useEffect(() => {
    if (visible) {
      setSel(selected);
      setQuery("");
    }
  }, [visible, JSON.stringify(selected)]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) =>
        i.label.toLowerCase().includes(q) ||
        (i.description ?? "").toLowerCase().includes(q),
    );
  }, [items, query]);

  const toggle = (key: string) => {
    setSel((prev) => {
      if (prev.includes(key)) return prev.filter((k) => k !== key);
      if (maxSelection && prev.length >= maxSelection) return prev;
      return [...prev, key];
    });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <Pressable onPress={onCancel} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={theme.secondaryText} />
            </Pressable>
          </View>

          <View style={styles.searchRow}>
            <Ionicons name="search" size={16} color={theme.secondaryText} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search..."
              placeholderTextColor={theme.secondaryText}
              value={query}
              onChangeText={setQuery}
            />
          </View>

          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          >
            {filtered.length === 0 ? (
              <Text style={styles.empty}>No options match.</Text>
            ) : (
              filtered.map((item) => {
                const checked = sel.includes(item.key);
                return (
                  <Pressable
                    key={item.key}
                    style={[styles.row, checked && { borderColor: resolvedAccent }]}
                    onPress={() => toggle(item.key)}
                  >
                    <View
                      style={[
                        styles.checkbox,
                        {
                          borderColor: checked ? resolvedAccent : theme.border,
                          backgroundColor: checked ? resolvedAccent : "transparent",
                        },
                      ]}
                    >
                      {checked && (
                        <Ionicons name="checkmark" size={14} color={theme.onPrimary} />
                      )}
                    </View>
                    {item.icon && (
                      <Ionicons
                        name={item.icon}
                        size={18}
                        color={item.color ?? resolvedAccent}
                      />
                    )}
                    <View style={styles.rowText}>
                      <Text style={styles.label}>{item.label}</Text>
                      {item.description ? (
                        <Text style={styles.desc}>{item.description}</Text>
                      ) : null}
                    </View>
                  </Pressable>
                );
              })
            )}
          </ScrollView>

          <View style={styles.footer}>
            <Pressable style={styles.cancelBtn} onPress={onCancel}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[
                styles.confirmBtn,
                { backgroundColor: resolvedAccent },
                sel.length === 0 && styles.confirmBtnDisabled,
              ]}
              disabled={sel.length === 0}
              onPress={() => onConfirm(sel)}
            >
              <Text style={styles.confirmText}>
                Confirm{sel.length > 0 ? ` (${sel.length})` : ""}
              </Text>
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
    sheet: {
      width: "100%",
      maxWidth: 460,
      maxHeight: "80%",
      backgroundColor: theme.card,
      borderRadius: 18,
      paddingBottom: 12,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 10,
    },
    title: {
      fontSize: 16,
      fontWeight: "800",
      color: theme.text,
    },
    closeBtn: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.inputBg,
    },
    searchRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginHorizontal: 16,
      marginBottom: 8,
      paddingHorizontal: 12,
      height: 40,
      borderRadius: 10,
      backgroundColor: theme.inputBg,
    },
    searchInput: {
      flex: 1,
      fontSize: 14,
      color: theme.text,
    },
    list: {
      flexGrow: 0,
    },
    listContent: {
      paddingHorizontal: 16,
      paddingBottom: 8,
    },
    empty: {
      textAlign: "center",
      color: theme.secondaryText,
      paddingVertical: 24,
      fontSize: 14,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: 8,
    },
    checkbox: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: 1.5,
      alignItems: "center",
      justifyContent: "center",
    },
    rowText: {
      flex: 1,
    },
    label: {
      fontSize: 14,
      fontWeight: "700",
      color: theme.text,
    },
    desc: {
      fontSize: 12,
      color: theme.secondaryText,
      marginTop: 2,
    },
    footer: {
      flexDirection: "row",
      gap: 10,
      paddingHorizontal: 16,
      paddingTop: 8,
    },
    cancelBtn: {
      flex: 1,
      height: 44,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.inputBg,
    },
    cancelText: {
      fontSize: 14,
      fontWeight: "700",
      color: theme.secondaryText,
    },
    confirmBtn: {
      flex: 2,
      height: 44,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    confirmBtnDisabled: {
      opacity: 0.45,
    },
    confirmText: {
      fontSize: 14,
      fontWeight: "800",
      color: theme.onPrimary,
    },
  });
