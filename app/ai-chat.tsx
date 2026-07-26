/**
 * Mindy chat screen.
 * Full-screen chat interface with Mindy, the AI wellness companion.
 * Calls the Gemini API directly via the useChat hook.
 */

import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import ChatBubble from "@/components/chat/ChatBubble";
import ChatInput from "@/components/chat/ChatInput";
import SuggestedQuestions from "@/components/chat/SuggestedQuestions";
import TypingIndicator from "@/components/chat/TypingIndicator";
import { useChat } from "@/hooks/useChat";
import { useNetwork } from "@/contexts/NetworkContext";

export default function AiChatScreen() {
  const { isConnected } = useNetwork();
  const { messages, isTyping, error, sendMessage, clearChat } = useChat(isConnected ?? false);
  const flatListRef = useRef<FlatList>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages, isTyping]);

  const handleBack = useCallback(() => {
    router.back();
  }, []);

  const handleSend = useCallback(
    (text: string) => {
      sendMessage(text);
    },
    [sendMessage],
  );

  const hasUserMessages = messages.some((m) => m.role === "user");
  const showSuggestions = !hasUserMessages && !isTyping;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={["#7C4DFF", "#2196F3", "#00BCD4"]}
        style={styles.headerGradient}
      >
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={handleBack}>
            <Ionicons name="arrow-back" size={24} color="white" />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Mindy</Text>
            <Text style={styles.headerSubtitle}>AI Wellness Companion</Text>
          </View>
          <Pressable style={styles.clearButton} onPress={clearChat}>
            <Ionicons name="refresh-outline" size={22} color="white" />
          </Pressable>
        </View>
      </LinearGradient>

      {/* Error Banner */}
      {error && (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle" size={18} color="#D32F2F" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Chat Messages */}
      <KeyboardAvoidingView
        style={styles.chatContainer}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ChatBubble message={item} />}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            showSuggestions ? (
              <SuggestedQuestions
                onSelect={handleSend}
                visible={showSuggestions}
              />
            ) : null
          }
          ListFooterComponent={isTyping ? <TypingIndicator /> : null}
        />

        {/* Input */}
        <ChatInput onSend={handleSend} disabled={isTyping} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  headerGradient: {
    paddingBottom: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "white",
  },
  headerSubtitle: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.8)",
    marginTop: 2,
  },
  clearButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFE0E0",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  errorText: {
    fontSize: 13,
    color: "#D32F2F",
    flex: 1,
  },
  chatContainer: {
    flex: 1,
  },
  messagesList: {
    flexGrow: 1,
    paddingVertical: 16,
  },
});