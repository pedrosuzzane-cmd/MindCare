/**
 * Hook for managing Mindy chat state and interactions.
 * Conversation is kept in React state (no Firestore persistence yet).
 * Accepts an optional isConnected flag to block sends when offline.
 */

import { useCallback, useRef, useState } from "react";
import { sendMessage } from "@/services/chatService";
import type { ChatMessage } from "@/types/chat";

const OFFLINE_ERROR =
  "Cannot access the chatbot if there is no network connection. Please check your internet and try again.";

const WELCOME_MESSAGE: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "Hello! I'm Mindy, your MindCare wellness companion. I'm here to listen, support, and help you navigate your feelings. How are you feeling today?",
  timestamp: Date.now(),
};

export function useChat(isConnected: boolean = true) {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const idCounter = useRef(1);

  const addMessage = useCallback(
    (role: "user" | "assistant", content: string) => {
      const message: ChatMessage = {
        id: `msg_${idCounter.current++}_${Date.now()}`,
        role,
        content,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, message]);
      return message;
    },
    [],
  );

  const sendUserMessage = useCallback(
    async (content: string) => {
      if (!content.trim()) return;

      setError(null);

      if (!isConnected) {
        setError(OFFLINE_ERROR);
        return;
      }

      // Add user message
      addMessage("user", content.trim());

      // Show typing indicator
      setIsTyping(true);

      try {
        // Build conversation history for context (exclude welcome message from history to save tokens)
        const history = messages
          .filter((m) => m.id !== "welcome")
          .map((m) => ({ role: m.role, content: m.content }));

        const response = await sendMessage(content.trim(), history);

        // Add assistant response
        addMessage("assistant", response.text);
      } catch (err) {
        if (__DEV__) console.error("Chat error:", err);
        setError(
          "I'm having trouble connecting right now. Please try again in a moment.",
        );
      } finally {
        setIsTyping(false);
      }
    },
    [messages, addMessage, isConnected],
  );

  const clearChat = useCallback(() => {
    setMessages([WELCOME_MESSAGE]);
    setError(null);
    setIsTyping(false);
    idCounter.current = 1;
  }, []);

  return {
    messages,
    isTyping,
    error,
    sendMessage: sendUserMessage,
    clearChat,
  };
}