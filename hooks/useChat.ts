/**
 * Hook for managing Mindy chat state and interactions.
 * Conversation is kept in React state (no Firestore persistence yet).
 * Accepts an optional isConnected flag to block sends when offline.
 *
 * SAFETY: Uses the same risk classifier as the journal (utils/journalReflection)
 * so Mindy NEVER treats serious safety-related content as an ordinary wellness
 * question. When high-risk language is detected, the Gemini call is bypassed
 * and a crisis-support message is returned directly.
 */

import { useCallback, useRef, useState } from "react";
import { sendMessage } from "@/services/chatService";
import type { ChatMessage } from "@/types/chat";
import { detectRisk } from "@/utils/journalReflection";
import { HIGH_RISK_SUPPORT_MESSAGE } from "@/constants/crisisSupport";

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
  const messagesRef = useRef<ChatMessage[]>([WELCOME_MESSAGE]);

  const addMessage = useCallback(
    (role: "user" | "assistant", content: string, timestamp?: number) => {
      const message: ChatMessage = {
        id: `msg_${idCounter.current++}_${Date.now()}`,
        role,
        content,
        timestamp: timestamp ?? Date.now(),
      };
      setMessages((prev) => {
        const next = [...prev, message];
        messagesRef.current = next;
        return next;
      });
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

      const trimmed = content.trim();

      // ── SAFETY-FIRST: Bypass Gemini when high-risk language is detected ──
      // The journal screen and Mindy chat share the same classifier so the
      // safety response is consistent across the app.
      const risk = detectRisk(trimmed);
      if (risk.riskLevel === "high") {
        addMessage("user", trimmed);
        addMessage("assistant", HIGH_RISK_SUPPORT_MESSAGE);
        return;
      }

      // Add user message
      addMessage("user", trimmed);

      // Show typing indicator
      setIsTyping(true);

      try {
        // Build conversation history from the ref so the hook does not
        // re-create sendMessage on every new message (stable callback).
        const history = messagesRef.current
          .filter((m) => m.id !== "welcome")
          .map((m) => ({ role: m.role, content: m.content }));

        const response = await sendMessage(trimmed, history);

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
    [isConnected, addMessage],
  );

  const clearChat = useCallback(() => {
    setMessages([WELCOME_MESSAGE]);
    messagesRef.current = [WELCOME_MESSAGE];
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