import { Ionicons } from "@expo/vector-icons";
import * as Updates from "expo-updates";
import { Component, ErrorInfo, ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useMindCareTheme } from "@/contexts/ThemeContext";
import type { MindCareTheme } from "@/constants/theme";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

/**
 * A component that catches JavaScript errors anywhere in its child component tree,
 * logs those errors, and displays a fallback UI.
 */
class ErrorBoundaryInner extends Component<
  Props & { theme: MindCareTheme },
  State
> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // You can also log the error to an error reporting service
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  private handleReset = async () => {
    try {
      // In production, this will fetch the latest update and reload the app.
      // In development, it might just reload the current bundle.
      await Updates.reloadAsync();
    } catch (e) {
      console.error("Failed to reload app after error:", e);
      // As a fallback, just reset the state to try re-rendering.
      this.setState({ hasError: false, error: undefined });
    }
  };

  public render() {
    if (this.state.hasError) {
      const { theme } = this.props;
      const styles = createStyles(theme);
      // You can render any custom fallback UI
      return (
        <View style={styles.container}>
          <Ionicons
            name="alert-circle-outline"
            size={48}
            color={theme.status.error}
          />
          <Text style={styles.title}>Something went wrong.</Text>
          <Text style={styles.subtitle}>
            An unexpected error occurred. Please try restarting the app.
          </Text>
          <Pressable style={styles.button} onPress={this.handleReset}>
            <Text style={styles.buttonText}>Try Again</Text>
          </Pressable>
        </View>
      );
    }

    return this.props.children;
  }
}

export function ErrorBoundary({ children }: Props) {
  const { theme } = useMindCareTheme();
  return <ErrorBoundaryInner theme={theme}>{children}</ErrorBoundaryInner>;
}

const createStyles = (theme: MindCareTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: theme.background,
      padding: 24,
    },
    title: {
      fontSize: 20,
      fontWeight: "700",
      color: theme.text,
      marginTop: 16,
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 14,
      color: theme.secondaryText,
      textAlign: "center",
      lineHeight: 20,
      marginBottom: 24,
    },
    button: {
      backgroundColor: theme.primary,
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 25,
    },
    buttonText: {
      color: theme.onPrimary,
      fontSize: 16,
      fontWeight: "600",
    },
  });
