import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useRef } from "react";
import {
  Animated,
  Dimensions,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useAuth } from "@/hooks/AuthContext";
import { useSidePanel } from "@/contexts/SidePanelContext";
import { handleSignOut } from "@/services/authService";

const PANEL_WIDTH = Math.min(Dimensions.get("window").width * 0.75, 300);

interface MenuEntry {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
}

const MENU_ITEMS: MenuEntry[] = [
  { label: "Profile", icon: "person-circle-outline", route: "/profile" },
  { label: "Achievements", icon: "trophy-outline", route: "/achievements" },
  { label: "Daily Journal", icon: "book-outline", route: "/daily-journal" },
  { label: "Mood Calendar", icon: "calendar-outline", route: "/mood-calendar" },
  { label: "Daily Reminders", icon: "notifications-outline", route: "/daily-reminders" },
  { label: "Self-Assessment", icon: "clipboard-outline", route: "/self-assessment-menu" },
  { label: "Support Hotlines", icon: "call-outline", route: "/support-hotlines" },
  { label: "AI Helper", icon: "bulb-outline", route: "/ai-helper" },
  { label: "Wellness Suggestions", icon: "sparkles-outline", route: "/journal-suggestions" },
];

export default function SidePanel() {
  const { isOpen, close } = useSidePanel();
  const { user } = useAuth();
  const slideAnim = useRef(new Animated.Value(-PANEL_WIDTH)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isOpen) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: Platform.OS !== "web",
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: Platform.OS !== "web",
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -PANEL_WIDTH,
          duration: 200,
          useNativeDriver: Platform.OS !== "web",
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: Platform.OS !== "web",
        }),
      ]).start();
    }
  }, [isOpen]);

  const navigate = (route: string) => {
    close();
    router.push(route as any);
  };

  const doSignOut = async () => {
    close();
    try {
      await handleSignOut(router);
    } catch (err) {
      console.error("Logout error", err);
    }
  };

  const initials = user?.displayName
    ? user.displayName
        .split(" ")
        .map((s) => s.charAt(0))
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  return (
    <>
      {isOpen && (
        <Pressable style={styles.overlay} onPress={close}>
          <Animated.View style={[styles.overlayBg, { opacity: fadeAnim }]} />
        </Pressable>
      )}
      <Animated.View
        style={[
          styles.panel,
          { transform: [{ translateX: slideAnim }] },
        ]}
        pointerEvents={isOpen ? "auto" : "none"}
      >
        <SafeAreaView style={styles.panelSafe}>
          <View style={styles.profileSection}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
            <Text style={styles.userName} numberOfLines={1}>
              {user?.displayName || "User"}
            </Text>
            <Text style={styles.userEmail} numberOfLines={1}>
              {user?.email || ""}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.menuSection}>
            {MENU_ITEMS.map((item) => (
              <Pressable
                key={item.route}
                style={styles.menuItem}
                onPress={() => navigate(item.route)}
              >
                <Ionicons name={item.icon} size={22} color="#4B5563" />
                <Text style={styles.menuLabel}>{item.label}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.divider} />

          <Pressable style={styles.signOutItem} onPress={doSignOut}>
            <Ionicons name="log-out-outline" size={22} color="#EF4444" />
            <Text style={styles.signOutLabel}>Sign Out</Text>
          </Pressable>
        </SafeAreaView>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
  },
  overlayBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  panel: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    width: PANEL_WIDTH,
    backgroundColor: "white",
    zIndex: 1000,
    elevation: 20,
  },
  panelSafe: {
    flex: 1,
    paddingTop: Platform.OS === "android" ? 40 : 0,
  },
  profileSection: {
    alignItems: "center",
    paddingVertical: 30,
    paddingHorizontal: 20,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#8A63D2",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  avatarText: {
    color: "white",
    fontSize: 22,
    fontWeight: "700",
  },
  userName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1E1B4B",
    textAlign: "center",
  },
  userEmail: {
    fontSize: 13,
    color: "#9CA3AF",
    textAlign: "center",
    marginTop: 4,
  },
  divider: {
    height: 1,
    backgroundColor: "#F3F0FF",
    marginHorizontal: 20,
  },
  menuSection: {
    flex: 1,
    paddingVertical: 12,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 24,
    gap: 14,
  },
  menuLabel: {
    fontSize: 15,
    color: "#4B5563",
    fontWeight: "500",
  },
  signOutItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 24,
    gap: 14,
  },
  signOutLabel: {
    fontSize: 15,
    color: "#EF4444",
    fontWeight: "600",
  },
});
