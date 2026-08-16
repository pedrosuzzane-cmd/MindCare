import AuthHeader from "@/components/auth/AuthHeader";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMindCareTheme } from "@/contexts/ThemeContext";
import type { MindCareTheme } from "@/constants/theme";

export default function AdminRequestSubmittedScreen() {
  const { theme } = useMindCareTheme();
  const styles = createStyles(theme);

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={theme.softGradient}
        style={styles.gradient}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <AuthHeader
            icon="mail-open-outline"
            title="Request Submitted"
            subtitle="Your request has been sent to the Super Administrator."
          />

          <View style={styles.content}>
            <View style={styles.note}>
              <Ionicons name="hourglass-outline" size={18} color={theme.primary} />
              <Text style={styles.noteText}>
                You'll receive an email once your request is approved. No code
                has been sent yet.
              </Text>
            </View>

            <Pressable
              style={styles.button}
              onPress={() => router.replace("/auth/login")}
              accessibilityRole="button"
              accessibilityLabel="Return to login"
            >
              <LinearGradient
                colors={theme.headerGradient}
                style={styles.buttonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.buttonText}>Return to Login</Text>
              </LinearGradient>
            </Pressable>

            <Text style={styles.helper}>
              Need to check the status of your request? Enter your email again
              on the request screen once your request has been approved.
            </Text>
          </View>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const createStyles = (theme: MindCareTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    gradient: {
      flex: 1,
      paddingHorizontal: 24,
    },
    scroll: {
      flexGrow: 1,
    },
    content: {
      flex: 1,
      marginTop: 32,
      paddingBottom: 40,
    },
    note: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: theme.softPurple,
      borderRadius: 14,
      paddingHorizontal: 16,
      paddingVertical: 14,
      marginBottom: 28,
    },
    noteText: {
      flex: 1,
      fontSize: 14,
      color: theme.primary,
      fontWeight: "600",
      lineHeight: 20,
    },
    button: {
      borderRadius: 25,
      overflow: "hidden",
      // @ts-ignore - web only
      boxShadow: `0px 10px 24px ${theme.shadow}`,
      elevation: 6,
    },
    buttonGradient: {
      height: 56,
      justifyContent: "center",
      alignItems: "center",
    },
    buttonText: {
      color: theme.onPrimary,
      fontSize: 16,
      fontWeight: "700",
    },
    helper: {
      fontSize: 13,
      color: theme.secondaryText,
      textAlign: "center",
      lineHeight: 19,
      marginTop: 16,
      paddingHorizontal: 8,
    },
  });
