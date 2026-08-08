import { HapticTab } from "@/components/haptic-tab";
import { useMindCareTheme } from "@/contexts/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import React, { useEffect, useRef } from "react";
import { Animated, Platform, StyleSheet, Text, View } from "react-native";

function TabIcon({
  name,
  color,
  size,
  focused,
}: {
  name: keyof typeof Ionicons.glyphMap;
  color: string;
  size: number;
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
        styles.pill,
        focused && {
          backgroundColor: theme.softPurple,
        },
      ]}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <Ionicons name={name} size={focused ? size + 2 : size} color={color} />
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
        { color: focused ? theme.tabIconSelected : theme.tabIconDefault },
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
          borderTopColor: theme.tabBarBorder,
          paddingBottom: Platform.OS === "android" ? 8 : 0,
          paddingTop: 6,
          height: Platform.OS === "android" ? 68 : 54,
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Dashboard",
          tabBarButton: HapticTab,
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon name="home" color={color} size={size} focused={focused} />
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
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon
              name="megaphone"
              color={color}
              size={size}
              focused={focused}
            />
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
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon name="leaf" color={color} size={size} focused={focused} />
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
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon
              name="chatbubbles"
              color={color}
              size={size}
              focused={focused}
            />
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
  pill: {
    width: 44,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 11,
    fontWeight: "600",
  },
  labelActive: {
    fontWeight: "700",
  },
});
