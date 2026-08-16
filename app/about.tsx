import { Ionicons } from "@expo/vector-icons";
import * as Application from "expo-application";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMindCareTheme } from "@/contexts/ThemeContext";
import type { MindCareTheme } from "@/constants/theme";
import { shadows } from "@/utils/shadows";

export default function AboutScreen() {
  const { theme } = useMindCareTheme();
  const styles = createStyles(theme);
  const appVersion = Application.nativeApplicationVersion || "1.0.0";
  const buildVersion = Application.nativeBuildVersion || "1";

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={theme.softGradient} style={styles.gradient}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={theme.secondaryText} />
          </Pressable>
          <Text style={styles.headerTitle}>About MindCare</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <LinearGradient
              colors={[theme.accent.teal, theme.accent.teal]}
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

const createStyles = (theme: MindCareTheme) =>
  StyleSheet.create({
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
      borderBottomColor: theme.border,
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
      color: theme.text,
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
      ...(shadows.custom(4, 8, 0.3, 8, theme.shadow) as any),
    },
    heartIcon: {
      fontSize: 40,
      color: theme.onPrimary,
    },
    appName: {
      fontSize: 28,
      fontWeight: "700",
      color: theme.primary,
      marginBottom: 8,
    },
    versionText: {
      fontSize: 14,
      color: theme.secondaryText,
      marginBottom: 24,
    },
    description: {
      fontSize: 16,
      color: theme.secondaryText,
      textAlign: "center",
      lineHeight: 24,
      marginBottom: 40,
    },
    copyright: {
      fontSize: 12,
      color: theme.secondaryText,
      position: "absolute",
      bottom: 40,
    },
  });
