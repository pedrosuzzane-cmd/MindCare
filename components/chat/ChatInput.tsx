/**
 * Chat input component with send button.
 */

import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useMindCareTheme } from "@/contexts/ThemeContext";
import type { MindCareTheme } from "@/constants/theme";

interface ChatInputProps {
  onSend: (text: string) => void;
  disabled: boolean;
}

export default function ChatInput({ onSend, disabled }: ChatInputProps) {
  const { theme } = useMindCareTheme();
  const styles = createStyles(theme);
  const [text, setText] = useState("");

  const handleSend = () => {
    if (text.trim() && !disabled) {
      onSend(text.trim());
      setText("");
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      <View style={styles.container}>
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.input}
            placeholder="Type a message..."
            placeholderTextColor={theme.secondaryText}
            value={text}
            onChangeText={setText}
            multiline
            maxLength={1000}
            editable={!disabled}
            returnKeyType="send"
            onSubmitEditing={handleSend}
            blurOnSubmit
          />
        </View>
        <Pressable
          style={[
            styles.sendButton,
            (!text.trim() || disabled) && styles.sendButtonDisabled,
          ]}
          onPress={handleSend}
          disabled={!text.trim() || disabled}
        >
          <Ionicons
            name="send"
            size={20}
            color={
              text.trim() && !disabled ? theme.onPrimary : theme.secondaryText
            }
          />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const createStyles = (theme: MindCareTheme) =>
  StyleSheet.create({
    container: {
      flexDirection: "row",
      alignItems: "flex-end",
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.border,
      backgroundColor: theme.card,
    },
    inputWrapper: {
      flex: 1,
      backgroundColor: theme.inputBg,
      borderRadius: 20,
      paddingHorizontal: 16,
      paddingVertical: Platform.OS === "ios" ? 10 : 8,
      marginRight: 8,
      maxHeight: 100,
    },
    input: {
      fontSize: 15,
      color: theme.text,
      maxHeight: 80,
      padding: 0,
    },
    sendButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.primary,
      justifyContent: "center",
      alignItems: "center",
    },
    sendButtonDisabled: {
      backgroundColor: theme.inputBg,
    },
  });