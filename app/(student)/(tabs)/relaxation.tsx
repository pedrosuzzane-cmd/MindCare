import { BreathingGame } from "@/components/BreathingGame";
import { useAuth } from "@/hooks/AuthContext";
import { Redirect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { StyleSheet } from "react-native";

export default function RelaxationScreen() {
  const { user, role } = useAuth();

  // Safety check: If an admin somehow lands here, redirect them.
  if (role === "admin") {
    return <Redirect href="/admin-panel" />;
  }

  if (!user) {
    return <Redirect href="/auth/login" />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <BreathingGame />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0F0D15",
  },
});