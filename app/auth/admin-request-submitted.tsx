import AuthHeader from "@/components/auth/AuthHeader";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function AdminRequestSubmittedScreen() {
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
          <AuthHeader
            icon="mail-open-outline"
            title="Request Submitted"
            subtitle="Your request has been sent to the Super Administrator."
          />

          <View style={styles.content}>
            <View style={styles.note}>
              <Ionicons name="hourglass-outline" size={18} color="#8A63D2" />
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
                colors={["#9C7EEB", "#8A63D2", "#7C5AC8"]}
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
    marginTop: 32,
    paddingBottom: 40,
  },
  note: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#F3F0FF",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 28,
  },
  noteText: {
    flex: 1,
    fontSize: 14,
    color: "#5B21B6",
    fontWeight: "600",
    lineHeight: 20,
  },
  button: {
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
  helper: {
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 19,
    marginTop: 16,
    paddingHorizontal: 8,
  },
});
