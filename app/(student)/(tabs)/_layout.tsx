import { HapticTab } from "@/components/haptic-tab";
import { useMindCareTheme } from "@/contexts/ThemeContext";
import { Tabs } from "expo-router";
import React, { useEffect, useRef } from "react";
import { Animated, Platform, StyleSheet, Text, View } from "react-native";

function TabIcon({
  emoji,
  focused,
}: {
  emoji: string;
  focused: boolean;
}) {
  const { theme } = useMindCareTheme();
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
          height: Platform.OS === "ios" ? 88 : 68,
          paddingTop: 7,
          paddingBottom: Platform.OS === "ios" ? 24 : 7,
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
            <TabIcon emoji="📣" focused={focused} />
          ),
          tabBarLabel: ({ focused }) => (
            <TabLabel label="Announcements" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="relaxation"
        options={{
          title: "Breathe",
          tabBarButton: HapticTab,
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="🌱" focused={focused} />
          ),
          tabBarLabel: ({ focused }) => (
            <TabLabel label="Breathe" focused={focused} />
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

const styles = StyleSheet.create({
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
});
