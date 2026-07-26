/**
 * Chat bubble component for displaying individual messages.
 * Supports user (right-aligned) and assistant (left-aligned) messages.
 */

import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import type { ChatMessage } from "@/types/chat";

interface ChatBubbleProps {
  message: ChatMessage;
}

export default function ChatBubble({ message }: ChatBubbleProps) {
  const isUser = message.role === "user";

  return (
    <View
      style={[
        styles.container,
        isUser ? styles.userContainer : styles.assistantContainer,
      ]}
    >
      {/* Avatar */}
      <View
        style={[
          styles.avatar,
          isUser ? styles.userAvatar : styles.assistantAvatar,
        ]}
      >
        {isUser ? (
          <Text style={styles.avatarText}>👤</Text>
        ) : (
          <Image source={require("@/assets/images/mindyai.png")} style={styles.assistantAvatarImage} />
        )}
      </View>

      {/* Message content */}
      <View
        style={[
          styles.bubble,
          isUser ? styles.userBubble : styles.assistantBubble,
        ]}
      >
        <Text
          style={[
            styles.messageText,
            isUser ? styles.userText : styles.assistantText,
          ]}
        >
          {message.content}
        </Text>
        <Text
          style={[
            styles.timestamp,
            isUser ? styles.userTimestamp : styles.assistantTimestamp,
          ]}
        >
          {new Date(message.timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  userContainer: {
    justifyContent: "flex-end",
  },
  assistantContainer: {
    justifyContent: "flex-start",
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 4,
  },
  userAvatar: {
    backgroundColor: "#E3F2FD",
    marginLeft: 8,
  },
  assistantAvatar: {
    backgroundColor: "#F3E5F5",
    marginRight: 8,
    overflow: "hidden",
  },
  assistantAvatarImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  avatarText: {
    fontSize: 16,
  },
  bubble: {
    maxWidth: "78%",
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  userBubble: {
    backgroundColor: "#8A63D2",
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    backgroundColor: "#F5F5F5",
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  userText: {
    color: "white",
  },
  assistantText: {
    color: "#333",
  },
  timestamp: {
    fontSize: 11,
    marginTop: 4,
  },
  userTimestamp: {
    color: "rgba(255, 255, 255, 0.7)",
    textAlign: "right",
  },
  assistantTimestamp: {
    color: "#999",
  },
});