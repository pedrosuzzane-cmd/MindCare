import { useEffect, useRef } from "react";
import { StyleSheet, TextInput, View } from "react-native";

interface OTPInputProps {
  length?: number;
  value: string;
  onChangeText: (text: string) => void;
  onComplete?: (code: string) => void;
  disabled?: boolean;
  error?: string | null;
}

export default function OTPInput({
  length = 6,
  value,
  onChangeText,
  onComplete,
  disabled = false,
  error = null,
}: OTPInputProps) {
  const refs = useRef<(TextInput | null)[]>([]);
  const prevLen = useRef(0);

  // Auto-submit only when the code transitions to a full length,
  // so editing a complete code does not re-submit on every keystroke.
  useEffect(() => {
    if (value.length === length && prevLen.current < length) {
      onComplete?.(value);
    }
    prevLen.current = value.length;
  }, [value, length]);

  const handleChange = (text: string, index: number) => {
    const clean = text.replace(/[^0-9]/g, "");
    if (clean.length > 1) {
      // Pasted value — fill all boxes at once.
      const next = clean.slice(0, length);
      onChangeText(next);
      refs.current[Math.min(next.length, length - 1)]?.focus();
      return;
    }
    const chars = value.split("");
    chars[index] = clean;
    const next = chars.join("");
    onChangeText(next);
    if (clean && index < length - 1) {
      refs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === "Backspace" && !value[index] && index > 0) {
      refs.current[index - 1]?.focus();
    }
  };

  return (
    <View style={styles.container}>
      {Array.from({ length }).map((_, i) => (
        <TextInput
          key={i}
          ref={(ref) => {
            refs.current[i] = ref;
          }}
          style={[
            styles.box,
            value.length === i && styles.boxActive,
            error ? styles.boxError : null,
          ]}
          value={value[i] || ""}
          onChangeText={(t) => handleChange(t, i)}
          onKeyPress={(e) => handleKeyPress(e, i)}
          keyboardType="number-pad"
          editable={!disabled}
          selectTextOnFocus
          accessibilityLabel={`Digit ${i + 1} of ${length}`}
          accessibilityRole="text"
          aria-label={`Digit ${i + 1}`}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  box: {
    flex: 1,
    aspectRatio: 0.82,
    maxWidth: 56,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    borderRadius: 14,
    fontSize: 24,
    fontWeight: "700",
    color: "#1F2937",
    textAlign: "center",
  },
  boxActive: {
    borderColor: "#7C3AED",
  },
  boxError: {
    borderColor: "#EF4444",
  },
});
