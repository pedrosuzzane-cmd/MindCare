import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function AdminPasswordSuccessScreen() {
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
      <LinearGradient
        colors={["#E8E0F5", "#F4F2F8", "#E8E0F5"]}
        style={styles.gradient}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <View style={styles.content}>
            <LinearGradient
              colors={["#22C55E", "#16A34A"]}
              style={styles.checkGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons name="checkmark" size={56} color="white" />
            </LinearGradient>

            <Text style={styles.title}>Password Updated</Text>
            <Text style={styles.subtitle}>
              Your password has been successfully changed.
            </Text>

            <View style={styles.securityNote}>
              <Ionicons name="shield-checkmark-outline" size={18} color="#7C3AED" />
              <Text style={styles.securityText}>
                For your security, all administrator sessions have been signed out.
              </Text>
            </View>

            <Pressable
              style={styles.button}
              onPress={() => router.replace("/auth/login")}
              accessibilityRole="button"
              accessibilityLabel="Login now"
            >
              <LinearGradient
                colors={["#9C7EEB", "#8A63D2", "#7C5AC8"]}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F4F2F8",
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
    boxShadow: "0px 12px 28px rgba(34, 197, 94, 0.35)",
    elevation: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#5B21B6",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: "#6B7280",
    textAlign: "center",
    marginTop: 10,
    lineHeight: 23,
  },
  securityNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F3F0FF",
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
    color: "#5B21B6",
    fontWeight: "600",
    lineHeight: 20,
  },
  button: {
    alignSelf: "stretch",
    borderRadius: 25,
    overflow: "hidden",
    // @ts-ignore - web only
    boxShadow: "0px 10px 24px rgba(124, 58, 237, 0.25)",
    elevation: 6,
  },
  buttonGradient: {
    height: 56,
    justifyContent: "center",
    alignItems: "center",
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "700",
  },
});
