import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMindCareTheme } from "@/contexts/ThemeContext";
import type { MindCareTheme } from "@/constants/theme";

export default function PasswordSuccessScreen() {
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
          <View style={styles.content}>
            <LinearGradient
              colors={[theme.status.success, theme.status.success]}
              style={styles.checkGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons name="checkmark" size={56} color={theme.onPrimary} />
            </LinearGradient>

            <Text style={styles.title}>Password Updated</Text>
            <Text style={styles.subtitle}>
              Your password has been successfully changed.
            </Text>

            <View style={styles.securityNote}>
              <Ionicons
                name="shield-checkmark-outline"
                size={18}
                color={theme.primary}
              />
              <Text style={styles.securityText}>
                For your security, all devices have been signed out.
              </Text>
            </View>

            <Pressable
              style={styles.button}
              onPress={() => router.replace("/auth/login")}
              accessibilityRole="button"
              accessibilityLabel="Login now"
            >
              <LinearGradient
                colors={theme.headerGradient}
                style={styles.buttonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.buttonText}>Login Now</Text>
              </LinearGradient>
            </Pressable>
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
      justifyContent: "center",
      alignItems: "center",
      paddingBottom: 60,
    },
    checkGradient: {
      width: 116,
      height: 116,
      borderRadius: 58,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 28,
      // @ts-ignore - web only
      boxShadow: `0px 12px 28px ${theme.shadow}`,
      elevation: 8,
    },
    title: {
      fontSize: 28,
      fontWeight: "700",
      color: theme.primary,
      textAlign: "center",
    },
    subtitle: {
      fontSize: 16,
      color: theme.secondaryText,
      textAlign: "center",
      marginTop: 10,
      lineHeight: 23,
    },
    securityNote: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: theme.softPurple,
      borderRadius: 14,
      paddingHorizontal: 16,
      paddingVertical: 14,
      marginTop: 28,
      marginBottom: 40,
      maxWidth: 320,
    },
    securityText: {
      flex: 1,
      fontSize: 14,
      color: theme.primary,
      fontWeight: "600",
      lineHeight: 20,
    },
    button: {
      alignSelf: "stretch",
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
  });
