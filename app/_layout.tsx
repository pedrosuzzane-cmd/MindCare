import { ThemeProvider as NavigationThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";

import { navThemes } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { AuthProvider } from "@/hooks/AuthContext";
import { NetworkProvider } from "@/contexts/NetworkContext";
import { ThemeProvider, useMindCareTheme } from "@/contexts/ThemeContext";
import "@/hooks/useReminderNotifications";

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const initialMode = colorScheme === "dark" ? "dark" : "light";

  return (
    <ThemeProvider initialMode={initialMode}>
      <InnerRoot />
    </ThemeProvider>
  );
}

function InnerRoot() {
  const { mode } = useMindCareTheme();

  return (
    <NavigationThemeProvider value={navThemes[mode]}>
      <AuthProvider>
        <NetworkProvider>
          <Stack>
            <Stack.Screen
              name="initial-profile-survey"
              options={{ headerShown: false }}
            />
            <Stack.Screen name="auth" options={{ headerShown: false }} />
            <Stack.Screen name="profile" options={{ headerShown: false }} />
            <Stack.Screen name="security-log" options={{ headerShown: false }} />
            <Stack.Screen name="(student)" options={{ headerShown: false }} />
            <Stack.Screen name="(admin)" options={{ headerShown: false }} />
            <Stack.Screen name="(superadmin)" options={{ headerShown: false }} />
            <Stack.Screen
              name="modal"
              options={{ presentation: "modal", title: "Modal" }}
            />
          </Stack>
          <StatusBar style={mode === "dark" ? "light" : "dark"} />
        </NetworkProvider>
      </AuthProvider>
    </NavigationThemeProvider>
  );
}
