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
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import ChatBubble from "@/components/chat/ChatBubble";
import ChatInput from "@/components/chat/ChatInput";
import SuggestedQuestions from "@/components/chat/SuggestedQuestions";
import TypingIndicator from "@/components/chat/TypingIndicator";
import { useChat } from "@/hooks/useChat";
import { useNetwork } from "@/contexts/NetworkContext";
import { useMindCareTheme } from "@/contexts/ThemeContext";
import type { MindCareTheme } from "@/constants/theme";

export default function AiChatScreen() {
  const { isConnected } = useNetwork();
  const { theme } = useMindCareTheme();
  const styles = createStyles(theme);
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
        colors={theme.headerGradient}
        style={styles.headerGradient}
      >
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={handleBack}>
            <Ionicons name="arrow-back" size={24} color={theme.onPrimary} />
          </Pressable>
          <View style={styles.headerCenter}>
            <View style={styles.headerIconWrap}>
              <Image
                source={require("@/assets/images/mindyai.png")}
                style={styles.headerIconImage}
              />
            </View>
            <View>
              <Text style={styles.headerTitle}>Mindy</Text>
              <Text style={styles.headerSubtitle}>
                {isConnected ? "AI Wellness Companion" : "Offline"}
              </Text>
            </View>
          </View>
          <Pressable style={styles.clearButton} onPress={clearChat}>
            <Ionicons name="refresh-outline" size={22} color={theme.onPrimary} />
          </Pressable>
        </View>
      </LinearGradient>

      {/* Error Banner */}
      {error && (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle" size={18} color={theme.status.error} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Offline Banner */}
      {!isConnected && !error && (
        <View style={styles.offlineBanner}>
          <Ionicons name="cloud-offline-outline" size={14} color={theme.status.warning} />
          <Text style={styles.offlineBannerText}>
            No internet. Messages won&apos;t send.
          </Text>
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

const createStyles = (theme: MindCareTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
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
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    headerIconWrap: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: "rgba(255,255,255,0.2)",
      justifyContent: "center",
      alignItems: "center",
      overflow: "hidden",
    },
    headerIconImage: {
      width: 34,
      height: 34,
      borderRadius: 17,
    },
    headerTitle: {
      fontSize: 17,
      fontWeight: "700",
      color: theme.onPrimary,
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
      backgroundColor: `${theme.status.error}1A`,
      paddingHorizontal: 16,
      paddingVertical: 10,
      gap: 8,
    },
    errorText: {
      fontSize: 13,
      color: theme.status.error,
      flex: 1,
    },
    offlineBanner: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: `${theme.status.warning}1A`,
      paddingHorizontal: 16,
      paddingVertical: 8,
      gap: 6,
    },
    offlineBannerText: {
      fontSize: 12,
      color: theme.status.warning,
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