import { ThemeProvider as NavigationThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { navThemes } from "@/constants/theme";
import { NetworkProvider } from "@/contexts/NetworkContext";
import { ThemeProvider, useMindCareTheme } from "@/contexts/ThemeContext";
import { AuthProvider } from "@/hooks/AuthContext";
import { useColorScheme } from "@/hooks/use-color-scheme";
import "@/hooks/useReminderNotifications";

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const initialMode = colorScheme === "dark" ? "dark" : "light";

  return (
    <SafeAreaProvider>
      <ThemeProvider initialMode={initialMode}>
        <InnerRoot />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function InnerRoot() {
  const { mode, theme } = useMindCareTheme();

  return (
    <NavigationThemeProvider value={navThemes[mode]}>
      <AuthProvider>
        <NetworkProvider>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: {
                backgroundColor: theme.background,
              },
            }}
          >
            <Stack.Screen
              name="initial-profile-survey"
              options={{ headerShown: false }}
            />
            <Stack.Screen name="auth" options={{ headerShown: false }} />
            <Stack.Screen name="profile" options={{ headerShown: false }} />
            <Stack.Screen
              name="security-log"
              options={{ headerShown: false }}
            />
            <Stack.Screen name="(student)" options={{ headerShown: false }} />
            <Stack.Screen name="(admin)" options={{ headerShown: false }} />
            <Stack.Screen
              name="(superadmin)"
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="modal"
              options={{ presentation: "modal", title: "Modal" }}
            />
          </Stack>
          <StatusBar
            style={mode === "dark" ? "light" : "dark"}
            backgroundColor={theme.background}
            translucent={false}
            animated
          />
        </NetworkProvider>
      </AuthProvider>
    </NavigationThemeProvider>
  );
}
