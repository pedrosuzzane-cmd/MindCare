import { Ionicons } from "@expo/vector-icons";
import { router, useSegments } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { auth } from "@/constants/firebase";
import { onAuthStateChanged } from "firebase/auth";

// Routes where the launcher should NOT appear (pre-auth screens).
const HIDDEN_ROUTES = new Set([
  "welcome",
  "login",
  "register",
  "forgot-password",
]);

const PANEL_WIDTH = 320;
const PANEL_HEIGHT = 420;
const FAB_SIZE = 56;
const ANIMATION_DURATION = 300;

export function ChatLauncher() {
  const segments = useSegments();
  const insets = useSafeAreaInsets();
  const [signedIn, setSignedIn] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => setSignedIn(!!user));
    return () => unsub();
  }, []);

  useEffect(() => {
    Animated.timing(scaleAnim, {
      toValue: isOpen ? 1 : 0,
      duration: ANIMATION_DURATION,
      useNativeDriver: true,
    }).start();

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  }, [isOpen, scaleAnim]);

  const topSegment = segments[0] ?? "";

  const openPanel = useCallback(() => {
    setIsOpen(true);
  }, []);

  const closePanel = useCallback(() => {
    setIsOpen(false);
  }, []);

  if (!signedIn) return null;
  if (HIDDEN_ROUTES.has(topSegment)) return null;
  const bottomInset = Platform.OS === "web" ? 20 : insets.bottom + 20;
  const rightInset = 20;

  const scale = scaleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.1, 1],
  });

  const panelOpacity = scaleAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0, 1],
  });

  return (
    <>
      {/* Floating action button */}
      <Pressable
        onPress={isOpen ? closePanel : openPanel}
        accessibilityRole="button"
        accessibilityLabel="Toggle AI helper"
        style={({ pressed }) => [
          styles.fab,
          { right: rightInset, bottom: bottomInset },
          pressed && styles.fabPressed,
        ]}
      >
        <Ionicons
          name={isOpen ? "close" : "chatbubbles"}
          size={26}
          color="white"
        />
      </Pressable>

      {/* Panel - positioned above the FAB */}
      {isOpen && (
        <Animated.View
          style={[
            styles.panel,
            {
              width: PANEL_WIDTH,
              height: PANEL_HEIGHT,
              right: rightInset,
              bottom: bottomInset + FAB_SIZE + 12,
              opacity: panelOpacity,
              transform: [{ scale }],
            },
          ]}
        >
          <Pressable
            style={styles.placeholderContainer}
            onPress={() => {
              closePanel();
              router.push("/ai-chat");
            }}
          >
            <Text style={styles.placeholderEmoji}>🤖</Text>
            <Text style={styles.placeholderTitle}>AI Wellness Chat</Text>
            <Text style={styles.placeholderSubtitle}>
              Tap to open full chat
            </Text>
            <Text style={styles.placeholderBadge}>Powered by Gemini AI</Text>
          </Pressable>
        </Animated.View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    backgroundColor: "#2196F3",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
    zIndex: 1001,
  },
  fabPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
  panel: {
    position: "absolute",
    backgroundColor: "#fff",
    borderRadius: 16,
    overflow: "hidden",
    zIndex: 1000,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 10,
  },
  placeholderContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  placeholderEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  placeholderTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#333",
    marginBottom: 8,
  },
  placeholderSubtitle: {
    fontSize: 14,
    color: "#666",
    marginBottom: 16,
  },
  placeholderBadge: {
    fontSize: 12,
    color: "#2196F3",
    fontWeight: "600",
    backgroundColor: "#E3F2FD",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: "hidden",
  },
});
