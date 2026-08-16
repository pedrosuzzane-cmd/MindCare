import { useMindCareTheme } from "@/contexts/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";

interface EmailInputProps {
  value: string;
  onChangeText: (text: string) => void;
  error?: string | null;
  editable?: boolean;
  onSubmit?: () => void;
}

export default function EmailInput({
  value,
  onChangeText,
  error,
  editable = true,
  onSubmit,
}: EmailInputProps) {
  const [focused, setFocused] = useState(false);
  const { theme } = useMindCareTheme();

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: theme.secondaryText }]}>
        Email Address
      </Text>
      <View
        style={[
          styles.inputWrap,
          {
            backgroundColor: theme.inputBg,
            borderColor: focused ? theme.primary : theme.border,
          },
          error ? styles.inputWrapError : null,
        ]}
      >
        <Ionicons name="mail-outline" size={20} color={theme.secondaryText} />
        <TextInput
          style={[styles.input, { color: theme.text }]}
          placeholder="student@uc-bcf.edu.ph"
          placeholderTextColor={theme.secondaryText}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          editable={editable}
          returnKeyType="go"
          enterKeyHint="go"
          blurOnSubmit={false}
          onSubmitEditing={onSubmit}
          accessibilityLabel="Email address"
          accessibilityRole="text"
          aria-label="Email address"
        />
      </View>
      {error ? (
        <Text style={styles.errorText} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 15,
    height: 56,
  },
  inputWrapError: {
    borderColor: "#EF4444",
  },
  input: {
    flex: 1,
    fontSize: 16,
  },
  errorText: {
    color: "#EF4444",
    fontSize: 13,
    marginTop: 6,
    fontWeight: "500",
  },
});
