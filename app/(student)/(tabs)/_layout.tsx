import { HapticTab } from "@/components/haptic-tab";
import { useMindCareTheme } from "@/contexts/ThemeContext";
import type { MindCareTheme } from "@/constants/theme";
import { useAnnouncements } from "@/contexts/AnnouncementsContext";
import { Tabs } from "expo-router";
import React, { useEffect, useRef } from "react";
import { Animated, Platform, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

function TabIcon({
  emoji,
  focused,
}: {
  emoji: string;
  focused: boolean;
}) {
  const { theme } = useMindCareTheme();
  const styles = createStyles(theme);
  const scale = useRef(new Animated.Value(focused ? 1 : 0.9)).current;
  useEffect(() => {
    Animated.spring(scale, {
      toValue: focused ? 1 : 0.9,
      speed: 24,
      bounciness: 6,
      useNativeDriver: true,
    }).start();
  }, [focused, scale]);

  return (
    <View
      style={[
        styles.iconContainer,
        focused && { backgroundColor: theme.softPurple },
      ]}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <Text
          style={[styles.emoji, { opacity: focused ? 1 : 0.6 }]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {emoji}
        </Text>
      </Animated.View>
    </View>
  );
}

function TabLabel({ label, focused }: { label: string; focused: boolean }) {
  const { theme } = useMindCareTheme();
  const styles = createStyles(theme);
  return (
    <Text
      style={[
        styles.label,
        {
          color: focused ? theme.tabIconSelected : theme.tabIconDefault,
        },
        focused && styles.labelActive,
      ]}
    >
      {label}
    </Text>
  );
}

export default function TabLayout() {
  const { theme } = useMindCareTheme();
  const styles = createStyles(theme);
  const { unreadCount } = useAnnouncements();
  const insets = useSafeAreaInsets();
  const tabBarHeight =
    Platform.OS === "ios" ? 88 : 68 + Math.max(insets.bottom, 0);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.tabIconSelected,
        tabBarInactiveTintColor: theme.tabIconDefault,
        tabBarStyle: {
          backgroundColor: theme.tabBar,
          borderTopWidth: 1,
          borderTopColor: theme.tabBarBorder,
          height: tabBarHeight,
          paddingTop: 7,
          paddingBottom: Platform.OS === "ios" ? 24 : Math.max(insets.bottom, 7),
          elevation: 8,
          shadowColor: "#6D28D9",
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: theme.mode === "dark" ? 0.15 : 0.08,
          shadowRadius: 8,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "600",
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Dashboard",
          tabBarButton: HapticTab,
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="🏠" focused={focused} />
          ),
          tabBarLabel: ({ focused }) => (
            <TabLabel label="Dashboard" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="announcements"
        options={{
          title: "Announcements",
          tabBarButton: HapticTab,
          tabBarIcon: ({ focused }) => (
            <View>
              <TabIcon emoji="📣" focused={focused} />
              {unreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </Text>
                </View>
              )}
            </View>
          ),
          tabBarLabel: ({ focused }) => (
            <TabLabel label="Announcements" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="constellation"
        options={{
          title: "Constellation",
          tabBarButton: HapticTab,
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="✨" focused={focused} />
          ),
          tabBarLabel: ({ focused }) => (
            <TabLabel label="Constellation" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: "Inbox",
          tabBarButton: HapticTab,
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="💬" focused={focused} />
          ),
          tabBarLabel: ({ focused }) => (
            <TabLabel label="Inbox" focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}

const createStyles = (theme: MindCareTheme) =>
  StyleSheet.create({
  iconContainer: {
    width: 42,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 1,
  },
  emoji: {
    fontSize: 19,
  },
  label: {
    fontSize: 10,
    fontWeight: "600",
  },
  labelActive: {
    fontWeight: "700",
  },
  badge: {
    position: "absolute",
    top: -2,
    right: -6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    backgroundColor: theme.status.error,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    color: theme.onPrimary,
    fontSize: 10,
    fontWeight: "700",
  },
});
