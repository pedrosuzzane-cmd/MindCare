import { Stack } from "expo-router";

export default function AdminLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="admin-panel" />
      <Stack.Screen name="messages" />
      <Stack.Screen name="student-detail" />
    </Stack>
  );
}
