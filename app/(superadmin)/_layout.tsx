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

export default function SuperAdminLayout() {
  return (
    <>
      <ForceLightMode />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="admin-management" />
      </Stack>
    </>
  );
}
