import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";

import { useColorScheme } from "@/hooks/use-color-scheme";

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="welcome" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="register" options={{ headerShown: false }} />
        <Stack.Screen name="dashboard" options={{ headerShown: false }} />
        <Stack.Screen name="daily-reminders" options={{ headerShown: false }} />
        <Stack.Screen name="daily-journal" options={{ headerShown: false }} />
        <Stack.Screen
          name="new-journal-entry"
          options={{ headerShown: false }}
        />
        <Stack.Screen name="self-assessment" options={{ headerShown: false }} />
        <Stack.Screen
          name="self-assessment-menu"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="initial-profile-survey"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="support-hotlines"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="assessment-complete"
          options={{ headerShown: false }}
        />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="modal"
          options={{ presentation: "modal", title: "Modal" }}
        />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
