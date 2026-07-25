import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import React from "react";
import { HapticTab } from "@/components/haptic-tab";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
      }}
    >
      {/* Keep only the screens that actually remain inside app/(tabs)/ */}
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Dashboard",
          tabBarButton: HapticTab,
          tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: "Explore",
          tabBarButton: HapticTab,
          tabBarIcon: ({ color, size }) => <Ionicons name="compass" size={size} color={color} />,
        }}
      />
      {/* Ensure daily-journal is REMOVED from here since it's now a root screen */}
    </Tabs>
  );
}
