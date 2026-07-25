/**
 * Hook for managing AI Wellness Chat state and interactions.
 * Conversation is kept in React state (no Firestore persistence yet).
 */

import { useCallback, useRef, useState } from "react";
import { sendMessage } from "@/services/chatService";
import type { ChatMessage } from "@/types/chat";

const WELCOME_MESSAGE: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "Hello! I'm your MindCare wellness companion. I'm here to listen, support, and help you navigate your feelings. How are you feeling today?",
  timestamp: Date.now(),
};

export function useChat() {
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
        console.error("Chat error:", err);
        setError(
          "I'm having trouble connecting right now. Please try again in a moment.",
        );
      } finally {
        setIsTyping(false);
      }
    },
    [messages, addMessage],
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