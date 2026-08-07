import { Stack } from "expo-router";

export default function AdminLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="admin-panel" />
      <Stack.Screen name="messages" />
      <Stack.Screen name="student-detail" />
      <Stack.Screen name="student-journals" />
      <Stack.Screen name="risk-monitor" />
      <Stack.Screen name="analytics/stress-heatmap" />
      <Stack.Screen name="analytics/mood-analytics" />
      <Stack.Screen name="analytics/risk-variance" />
    </Stack>
  );
}
