import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef } from "react";
import { Animated, Platform, StyleSheet, Text, View } from "react-native";
import { shadows } from "@/utils/shadows";

interface ToastProps {
  visible: boolean;
  message: string;
  type?: "success" | "error" | "info" | "warning";
  duration?: number;
  onDismiss: () => void;
}

const TOAST_CONFIG = {
  success: {
    icon: "checkmark-circle" as keyof typeof Ionicons.glyphMap,
    color: "#8A63D2",
  },
  error: {
    icon: "alert-circle" as keyof typeof Ionicons.glyphMap,
    color: "#D32F2F",
  },
  info: {
    icon: "information-circle" as keyof typeof Ionicons.glyphMap,
    color: "#9C7EEB",
  },
  warning: {
    icon: "warning" as keyof typeof Ionicons.glyphMap,
    color: "#FFC107",
  },
};

export default function Toast({
  visible,
  message,
  type = "info",
  duration = 3000,
  onDismiss,
}: ToastProps) {
  const animValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.timing(animValue, {
        toValue: 1,
        duration: 300,
        useNativeDriver: Platform.OS !== "web",
      }).start();

      const timer = setTimeout(() => {
        Animated.timing(animValue, {
          toValue: 0,
          duration: 300,
          useNativeDriver: Platform.OS !== "web",
        }).start(onDismiss);
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [visible, duration, onDismiss, animValue]);

  if (!visible) {
    return null;
  }

  const config = TOAST_CONFIG[type];

  const animatedStyle = {
    opacity: animValue,
    transform: [
      {
        translateY: animValue.interpolate({
          inputRange: [0, 1],
          outputRange: [100, 0],
        }),
      },
    ],
  };

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <View style={[styles.toast, { backgroundColor: config.color }]}>
        <Ionicons name={config.icon} size={20} color="white" />
        <Text style={styles.message}>{message}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 40,
    left: 20,
    right: 20,
    alignItems: "center",
    zIndex: 9999,
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 30,
    ...(shadows.custom(4, 8, 0.2, 10, "#000") as any),
  },
  message: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 10,
  },
});
