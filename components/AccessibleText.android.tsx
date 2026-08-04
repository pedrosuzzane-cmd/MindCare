import { Ionicons } from "@expo/vector-icons";
import * as Speech from "expo-speech";
import React from "react";
import {
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  TouchableOpacity,
  View,
} from "react-native";

interface AccessibleTextProps {
  text: string;
  style?: StyleProp<TextStyle>;
}

/**
 * Android-only component. Bundled exclusively for Android via the .android.tsx
 * extension, so expo-speech is never compiled into the web or iOS builds.
 */
export const AccessibleText: React.FC<AccessibleTextProps> = ({
  text,
  style,
}) => {
  const speakText = () => {
    try {
      Speech.stop();
      Speech.speak(text, {
        language: "en-US",
        pitch: 1.0,
        rate: 0.9,
      });
    } catch (err) {
      console.warn("TTS: speech failed to start", err);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.text, style]}>{text}</Text>
      <TouchableOpacity
        style={styles.speakerButton}
        onPress={speakText}
        accessibilityRole="button"
        accessibilityLabel="Read text aloud"
        accessibilityHint="Hear this text read aloud"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="volume-high-outline" size={20} color="#8A63D2" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginVertical: 4,
  },
  text: {
    flex: 1,
    fontSize: 15,
    color: "#333",
  },
  speakerButton: {
    padding: 6,
    marginLeft: 8,
    backgroundColor: "#F3EEFB",
    borderRadius: 16,
  },
});
