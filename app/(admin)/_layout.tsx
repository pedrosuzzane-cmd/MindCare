import { Stack } from "expo-router";
import { useEffect } from "react";
import { useMindCareTheme } from "@/contexts/ThemeContext";

function ForceLightMode() {
  const { mode, setMode } = useMindCareTheme();
  useEffect(() => {
    if (mode !== "light") {
      setMode("light");
    }
  }, []);
  return null;
}

export default function AdminLayout() {
  return (
    <>
      <ForceLightMode />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="admin-panel" />
        <Stack.Screen name="messages" />
        <Stack.Screen name="student-detail" />
        <Stack.Screen name="student-journals" />
        <Stack.Screen name="student-management" />
        <Stack.Screen name="analytics/stress-heatmap" />
        <Stack.Screen name="analytics/mood-analytics" />
        <Stack.Screen name="analytics/risk-variance" />
        <Stack.Screen name="safeguarding" />
      </Stack>
    </>
  );
}
