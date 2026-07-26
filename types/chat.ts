/**
 * Chat message types for Mindy.
 */

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export interface ChatState {
  messages: ChatMessage[];
  isTyping: boolean;
  error: string | null;
}