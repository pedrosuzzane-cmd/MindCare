import { HapticTab } from "@/components/haptic-tab";
import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import React from "react";
import { Platform, StyleSheet, Text, View } from "react-native";

const ACTIVE = "#7C4DCC";
const INACTIVE = "#9CA3AF";
const PILL_BG = "rgba(124, 77, 204, 0.10)";

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
  return (
    <View style={[styles.pill, focused && styles.pillActive]}>
      <Ionicons name={name} size={size} color={color} />
    </View>
  );
}

function TabLabel({ label, focused }: { label: string; focused: boolean }) {
  return (
    <Text
      style={[
        styles.label,
        { color: focused ? ACTIVE : INACTIVE },
        focused && styles.labelActive,
      ]}
    >
      {label}
    </Text>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: ACTIVE,
        tabBarInactiveTintColor: INACTIVE,
        tabBarStyle: {
          backgroundColor: "white",
          borderTopColor: "#F3F0FF",
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
  pillActive: {
    backgroundColor: PILL_BG,
  },
  label: {
    fontSize: 11,
    fontWeight: "600",
  },
  labelActive: {
    fontWeight: "700",
  },
});
