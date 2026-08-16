import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useMindCareTheme } from "@/contexts/ThemeContext";
import type { MindCareTheme } from "@/constants/theme";

export function SplashScreen() {
  const { theme } = useMindCareTheme();
  const styles = createStyles(theme);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={theme.primary} />
    </View>
  );
}

const createStyles = (theme: MindCareTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: theme.background,
    },
  });
