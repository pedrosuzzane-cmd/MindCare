import { useMindCareTheme } from "@/contexts/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, StyleSheet, Text, View } from "react-native";

interface AuthHeaderProps {
  onBack?: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  reassurance?: string;
}

export default function AuthHeader({
  onBack,
  icon = "leaf-outline",
  title,
  subtitle,
  reassurance,
}: AuthHeaderProps) {
  const { theme } = useMindCareTheme();

  return (
    <View>
      {onBack ? (
        <View style={styles.navRow}>
          <Pressable
            style={[
              styles.backButton,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={8}
          >
            <Ionicons name="arrow-back" size={22} color={theme.secondaryText} />
          </Pressable>
        </View>
      ) : null}

      <View style={styles.iconWrap}>
        <LinearGradient
          colors={["#9C7EEB", "#8A63D2", "#7C5AC8"]}
          style={styles.iconGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Ionicons name={icon} size={30} color="white" />
        </LinearGradient>
      </View>

      <Text style={[styles.title, { color: theme.primary }]}>{title}</Text>
      {subtitle ? (
        <Text style={[styles.subtitle, { color: theme.secondaryText }]}>
          {subtitle}
        </Text>
      ) : null}
      {reassurance ? (
        <Text style={[styles.reassurance, { color: theme.primary }]}>
          {reassurance}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 8,
    paddingBottom: 4,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    // @ts-ignore - web only
    boxShadow: "0px 2px 4px rgba(0,0,0,0.08)",
    elevation: 3,
  },
  iconWrap: {
    alignItems: "center",
    marginTop: 28,
    marginBottom: 20,
  },
  iconGradient: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    // @ts-ignore - web only
    boxShadow: "0px 8px 24px rgba(138, 99, 210, 0.25)",
    elevation: 6,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: "center",
    lineHeight: 23,
    paddingHorizontal: 8,
  },
  reassurance: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    marginTop: 10,
    paddingHorizontal: 12,
  },
});
