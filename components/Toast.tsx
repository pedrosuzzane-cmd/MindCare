import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";

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
    color: "#4CAF50",
  },
  error: {
    icon: "alert-circle" as keyof typeof Ionicons.glyphMap,
    color: "#D32F2F",
  },
  info: {
    icon: "information-circle" as keyof typeof Ionicons.glyphMap,
    color: "#2196F3",
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
        useNativeDriver: true,
      }).start();

      const timer = setTimeout(() => {
        Animated.timing(animValue, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
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
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 10,
  },
  message: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 10,
  },
});
