import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

interface CountdownTimerProps {
  expiresAt: number;
  totalSeconds: number;
  prefix?: string;
  onExpire?: () => void;
}

export default function CountdownTimer({
  expiresAt,
  totalSeconds,
  prefix = "Expires in",
  onExpire,
}: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState(
    Math.max(0, Math.floor((expiresAt - Date.now()) / 1000)),
  );
  const [progress, setProgress] = useState(1);

  useEffect(() => {
    const tick = () => {
      const remaining = Math.max(
        0,
        Math.floor((expiresAt - Date.now()) / 1000),
      );
      setTimeLeft(remaining);
      setProgress(
        Math.max(0, Math.min(1, remaining / Math.max(1, totalSeconds))),
      );
      if (remaining <= 0) {
        clearInterval(interval);
        onExpire?.();
      }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [expiresAt, totalSeconds]);

  const urgent = timeLeft <= 60;
  const format = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(
      2,
      "0",
    )}`;

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Ionicons
          name="time-outline"
          size={16}
          color={urgent ? "#EF4444" : "#7C3AED"}
        />
        <Text
          style={[styles.text, urgent && styles.textUrgent]}
          accessibilityLabel={`${prefix} ${format(timeLeft)}`}
        >
          {prefix}: {format(timeLeft)}
        </Text>
      </View>
      <View style={styles.track} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View
          style={[
            styles.fill,
            { width: `${progress * 100}%` },
            urgent ? styles.fillUrgent : null,
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  text: {
    fontSize: 14,
    fontWeight: "600",
    color: "#7C3AED",
  },
  textUrgent: {
    color: "#EF4444",
  },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "#F1F0F6",
    marginTop: 8,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 3,
    backgroundColor: "#7C3AED",
  },
  fillUrgent: {
    backgroundColor: "#EF4444",
  },
});
