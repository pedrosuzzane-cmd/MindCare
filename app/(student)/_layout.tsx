import { Stack } from "expo-router";
import { View, StyleSheet } from "react-native";
import { SidePanelProvider } from "@/contexts/SidePanelContext";
import SidePanel from "@/components/SidePanel";

export default function StudentLayout() {
  return (
    <SidePanelProvider>
      <View style={styles.root}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="achievements" />
          <Stack.Screen name="ai-helper" />
          <Stack.Screen name="assessment-complete" />
          <Stack.Screen name="daily-journal" />
          <Stack.Screen name="daily-reminders" />
          <Stack.Screen name="journal-detail" />
          <Stack.Screen name="journal-saved" />
          <Stack.Screen name="journal-suggestions" />
          <Stack.Screen name="messages" />
          <Stack.Screen name="mood-calendar" />
          <Stack.Screen name="new-journal-entry" />
          <Stack.Screen name="peer-messages" />
          <Stack.Screen name="reminders" />
          <Stack.Screen name="self-assessment-menu" />
          <Stack.Screen name="self-assessment" />
          <Stack.Screen name="support-hotlines" />
        </Stack>
        <SidePanel />
      </View>
    </SidePanelProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
