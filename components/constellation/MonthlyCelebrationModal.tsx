import { formatMonthName } from "@/utils/constellationMonthUtils";
import React, { useEffect } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
} from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useMindCareTheme } from "@/contexts/ThemeContext";
import type { MindCareTheme } from "@/constants/theme";

interface MonthlyCelebrationModalProps {
  /** Label of the completed month, or null to hide. */
  monthLabel: string | null;
  onClose: () => void;
}

/**
 * One-time celebration when a monthly constellation reaches its reflection
 * goal. Entrance: card fades in while gently scaling up (opacity 0→1, scale
 * 0.92→1, ~300ms). The parent persists the completion so it never replays for
 * the same month.
 */
export function MonthlyCelebrationModal({
  monthLabel,
  onClose,
}: MonthlyCelebrationModalProps) {
  const { theme } = useMindCareTheme();
  const styles = createStyles(theme);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.92);

  useEffect(() => {
    if (!monthLabel) return;
    opacity.value = 0;
    scale.value = 0.92;
    const timing = { duration: 300, easing: Easing.out(Easing.cubic) };
    opacity.value = withTiming(1, timing);
    scale.value = withTiming(1, timing);
  }, [monthLabel, opacity, scale]);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const monthName = monthLabel ? formatMonthName(monthLabel) : "";

  return (
    <Modal
      visible={monthLabel != null}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityLabel="Dismiss celebration"
      >
        <Animated.View
          style={[styles.card, cardStyle]}
          pointerEvents="box-none"
        >
          <Text style={styles.emoji}>🌟</Text>
          <Text style={styles.eyebrow}>Month Complete</Text>
          <Text style={styles.title}>
            {monthLabel} Constellation Complete!
          </Text>
          <Text style={styles.message}>
            You filled your {monthName} sky with reflections.
          </Text>
          <Pressable
            style={styles.primaryButton}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="View my sky"
          >
            <Text style={styles.primaryButtonText}>View My Sky</Text>
          </Pressable>
          <Pressable
            style={styles.dismissButton}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Dismiss"
            hitSlop={8}
          >
            <Text style={styles.dismissText}>Keep Writing</Text>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const createStyles = (theme: MindCareTheme) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: "rgba(10, 6, 20, 0.72)",
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 28,
    },
    card: {
      width: "100%",
      maxWidth: 340,
      backgroundColor: theme.card,
      borderRadius: 24,
      paddingVertical: 32,
      paddingHorizontal: 24,
      alignItems: "center",
      borderWidth: 1,
      borderColor: theme.border,
    },
    emoji: {
      fontSize: 56,
      marginBottom: 10,
    },
    eyebrow: {
      fontSize: 12,
      fontWeight: "800",
      letterSpacing: 1.6,
      textTransform: "uppercase",
      color: theme.primary,
      marginBottom: 8,
    },
    title: {
      fontSize: 22,
      fontWeight: "800",
      color: theme.text,
      textAlign: "center",
      marginBottom: 10,
    },
    message: {
      fontSize: 14,
      lineHeight: 21,
      color: theme.secondaryText,
      textAlign: "center",
      marginBottom: 22,
    },
    primaryButton: {
      alignSelf: "stretch",
      backgroundColor: theme.primary,
      borderRadius: 25,
      paddingVertical: 14,
      alignItems: "center",
    },
    primaryButtonText: {
      color: theme.onPrimary,
      fontSize: 16,
      fontWeight: "700",
    },
    dismissButton: {
      marginTop: 14,
      paddingVertical: 4,
      paddingHorizontal: 10,
    },
    dismissText: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.secondaryText,
    },
  });
