import { useMindCareTheme } from "@/contexts/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

interface PasswordStrengthProps {
  password: string;
  confirm: string;
}

export default function PasswordStrength({
  password,
  confirm,
}: PasswordStrengthProps) {
  const { theme } = useMindCareTheme();
  const checks = [
    { label: "12 characters", met: password.length >= 12 },
    { label: "Uppercase letter (A-Z)", met: /[A-Z]/.test(password) },
    { label: "Lowercase letter (a-z)", met: /[a-z]/.test(password) },
    { label: "Number (0-9)", met: /[0-9]/.test(password) },
    {
      label: "Special character (!@#$%^&*)",
      met: /[^A-Za-z0-9]/.test(password),
    },
    {
      label: "Passwords match",
      met: confirm.length > 0 && password === confirm,
    },
  ];

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.card, borderColor: theme.border },
      ]}
    >
      <Text style={[styles.title, { color: theme.text }]}>Requirements</Text>
      {checks.map((check) => (
        <View key={check.label} style={styles.row}>
          <Ionicons
            name={check.met ? "checkmark-circle" : "ellipse-outline"}
            size={16}
            color={check.met ? "#22C55E" : "#CBD5E1"}
          />
          <Text
            style={[
              styles.label,
              { color: theme.secondaryText },
              check.met && [styles.labelMet, { color: theme.text }],
            ]}
          >
            {check.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    marginBottom: 24,
  },
  title: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
  },
  labelMet: {
    fontWeight: "600",
  },
});
