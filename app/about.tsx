import { Ionicons } from "@expo/vector-icons";
import * as Application from "expo-application";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React from "react";
import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { shadows } from "@/utils/shadows";

export default function AboutScreen() {
  const appVersion = Application.nativeApplicationVersion || "1.0.0";
  const buildVersion = Application.nativeBuildVersion || "1";

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={["#F0F8FF", "#E8F4FD"]} style={styles.gradient}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#666" />
          </Pressable>
          <Text style={styles.headerTitle}>About MindCare</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <LinearGradient
              colors={["#4DD0E1", "#00BCD4"]}
              style={styles.iconGradient}
            >
              <Text style={styles.heartIcon}>♥</Text>
            </LinearGradient>
          </View>

          <Text style={styles.appName}>MindCare</Text>
          <Text style={styles.versionText}>
            Version {appVersion} (Build {buildVersion})
          </Text>

          <Text style={styles.description}>
            MindCare is a personal mental wellness companion designed to support
            students on their academic and personal journeys.
          </Text>

          <Text style={styles.copyright}>
            © {new Date().getFullYear()} MindCare Team. All Rights Reserved.
          </Text>
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  iconContainer: {
    marginBottom: 24,
  },
  iconGradient: {
    width: 100,
    height: 100,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    ...(shadows.custom(4, 8, 0.3, 8, "#00BCD4") as any),
  },
  heartIcon: {
    fontSize: 40,
    color: "white",
  },
  appName: {
    fontSize: 28,
    fontWeight: "700",
    color: "#2196F3",
    marginBottom: 8,
  },
  versionText: {
    fontSize: 14,
    color: "#999",
    marginBottom: 24,
  },
  description: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 40,
  },
  copyright: {
    fontSize: 12,
    color: "#AAA",
    position: "absolute",
    bottom: 40,
  },
});
