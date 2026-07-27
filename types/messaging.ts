/**
 * Types for the student-admin and peer-to-peer real-time messaging system.
 */

export interface Message {
  id: string;
  senderId: string;
  text: string;
  createdAt: number; // Firestore timestamp as milliseconds
  isAdmin: boolean;
  deleted?: boolean; // Soft-delete: shows placeholder instead of text
  senderRole?: "student" | "admin"; // Generic role flag for peer conversations
  moderationStatus?: "safe" | "flagged" | "blocked"; // Content moderation result
}

/** Client-only fields added during optimistic send (not in Firestore). */
export interface OptimisticMessage extends Message {
  failed?: boolean; // True if Firestore write failed — shows retry button
}

export interface Conversation {
  id: string;
  studentId: string;
  adminId: string;
  studentName: string;
  adminName: string;
  lastMessage: string;
  lastMessageAt: number;
  unreadBy: string[]; // UIDs who haven't read the latest message
  type?: "admin" | "peer"; // Conversation type — defaults to "admin" for existing docs
  participants?: string[]; // [uidA, uidB] — for peer conversations
  participantNames?: Record<string, string>; // { [uid]: name } — for peer conversations
}

/** Moderation result returned by contentModeration service. */
export interface ModerationResult {
  status: "safe" | "flagged" | "blocked";
  reason?: string;
}

/** Student search result for peer messaging user discovery. */
export interface StudentSearchResult {
  uid: string;
  fullName: string;
  department?: string;
  yearLevel?: string;
  profileImage?: string;
}
