import React from "react";
import { StyleProp, Text, TextStyle } from "react-native";

interface AccessibleTextProps {
  text: string;
  style?: StyleProp<TextStyle>;
}

/**
 * Plain-text fallback used on Web and iOS.
 * The Android build swaps this out for AccessibleText.android.tsx, which adds
 * a read-aloud speaker button backed by expo-speech. Keeping expo-speech out
 * of this shared file prevents native audio modules from entering the web bundle.
 */
export const AccessibleText: React.FC<AccessibleTextProps> = ({
  text,
  style,
}) => {
  return <Text style={style}>{text}</Text>;
};
