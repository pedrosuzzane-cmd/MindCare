import { JournalMilestone } from "@/utils/constellationOptions";
import React, { useEffect } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

interface MilestoneCelebrationModalProps {
  milestone: JournalMilestone | null;
  onClose: () => void;
}

/**
 * One-time celebration shown when a journal count milestone is reached.
 * Entrance: card fades in while gently scaling up (opacity 0→1, scale
 * 0.92→1, ~300ms). The parent decides when a milestone is "newly reached" and
 * persists the celebration so it never replays on later visits.
 */
export function MilestoneCelebrationModal({
  milestone,
  onClose,
}: MilestoneCelebrationModalProps) {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.92);

  useEffect(() => {
    if (!milestone) return;
    opacity.value = 0;
    scale.value = 0.92;
    const timing = { duration: 300, easing: Easing.out(Easing.cubic) };
    opacity.value = withTiming(1, timing);
    scale.value = withTiming(1, timing);
  }, [milestone?.count, opacity, scale]);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Modal
      visible={milestone != null}
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
          <Text style={styles.emoji}>{milestone?.emoji ?? "🌟"}</Text>
          <Text style={styles.eyebrow}>Congratulations!</Text>
          <Text style={styles.unlockedLabel}>You've unlocked</Text>
          <Text style={styles.title}>{milestone?.title ?? ""}</Text>
          <Text style={styles.message}>
            Your constellation is growing one reflection at a time.
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

const styles = StyleSheet.create({
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
    backgroundColor: "#1E1B2E",
    borderRadius: 24,
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(167, 139, 250, 0.35)",
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
    color: "#A78BFA",
    marginBottom: 8,
  },
  unlockedLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.7)",
    marginBottom: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: 10,
  },
  message: {
    fontSize: 14,
    lineHeight: 21,
    color: "rgba(255, 255, 255, 0.82)",
    textAlign: "center",
    marginBottom: 22,
  },
  primaryButton: {
    alignSelf: "stretch",
    backgroundColor: "#6D28D9",
    borderRadius: 25,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#FFFFFF",
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
    color: "rgba(255, 255, 255, 0.6)",
  },
});
