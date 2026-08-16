import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
    ActivityIndicator,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { useMindCareTheme } from "@/contexts/ThemeContext";
import type { MindCareTheme } from "@/constants/theme";
import { shadows } from "@/utils/shadows";

interface ConfirmationModalProps {
  visible: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
}

export default function ConfirmationModal({
  visible,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
  loading = false,
  icon = "save-outline",
  iconColor,
}: ConfirmationModalProps) {
  const { theme } = useMindCareTheme();
  const styles = createStyles(theme);
  const resolvedIconColor = iconColor ?? theme.primary;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <Ionicons name={icon} size={32} color={resolvedIconColor} />
          <Text style={styles.modalTitle}>{title}</Text>
          <Text style={styles.modalMessage}>{message}</Text>
          <View style={styles.modalActions}>
            <Pressable
              style={[styles.modalButton, styles.modalCancelButton]}
              onPress={onCancel}
              disabled={loading}
            >
              <Text style={styles.modalCancelText}>{cancelText}</Text>
            </Pressable>
            <Pressable
              style={[
                styles.modalButton,
                styles.modalConfirmButton,
                { backgroundColor: resolvedIconColor },
                loading && { opacity: 0.7 },
              ]}
              onPress={onConfirm}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={theme.onPrimary} size="small" />
              ) : (
                <Text style={styles.modalConfirmText}>{confirmText}</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (theme: MindCareTheme) =>
  StyleSheet.create({
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.45)",
      justifyContent: "center",
      alignItems: "center",
      padding: 24,
    },
    modalContainer: {
      backgroundColor: theme.card,
      borderRadius: 20,
      padding: 24,
      width: "100%",
      maxWidth: 360,
      alignItems: "center",
      ...(shadows.custom(4, 12, 0.2, 8, "#000") as any),
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.text,
      marginTop: 12,
      marginBottom: 8,
      textAlign: "center",
    },
    modalMessage: {
      fontSize: 14,
      color: theme.secondaryText,
      textAlign: "center",
      lineHeight: 20,
      marginBottom: 24,
    },
    modalActions: {
      flexDirection: "row",
      gap: 12,
      width: "100%",
    },
    modalButton: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    modalCancelButton: {
      backgroundColor: theme.inputBg,
      borderWidth: 1,
      borderColor: theme.border,
    },
    modalConfirmButton: {
      // backgroundColor is set dynamically
    },
    modalCancelText: {
      fontWeight: "700",
      color: theme.secondaryText,
      fontSize: 14,
    },
    modalConfirmText: {
      fontWeight: "700",
      color: theme.onPrimary,
      fontSize: 14,
    },
  });
