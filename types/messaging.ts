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
  /** Marks system-generated support notification messages (e.g. recorded support actions). */
  kind?: "support_action";
  /** Human-readable support status title shown for support-action messages. */
  supportTitle?: string;
  /** Workflow record ID the message was generated from. */
  relatedWorkflowId?: string;
}

/** Client-only fields added during optimistic send (not in Firestore). */
export interface OptimisticMessage extends Message {
  failed?: boolean; // True if Firestore write failed — shows retry button
}

export interface Conversation {
  id: string;
  studentId?: string;
  adminId?: string;
  studentName?: string;
  adminName?: string;
  lastMessage: string;
  lastMessageAt: number;
  unreadBy: string[]; // UIDs who haven't read the latest message
  type?: "admin" | "peer"; // Conversation type — defaults to "admin" for existing docs
  participants?: string[]; // [uidA, uidB] — for peer conversations
  participantNames?: Record<string, string>; // { [uid]: name } — for peer conversations
  pinnedBy?: string[]; // UIDs who pinned this conversation (presentation only)
  hiddenBy?: string[]; // UIDs who hid/deleted this conversation for themselves
  createdAt?: number; // Conversation creation timestamp (ms)
}

/** A user-reported conversation for moderation. */
export interface ConversationReport {
  id: string;
  conversationId: string;
  reporterUid: string;
  reportedUid: string;
  type: "peer" | "admin";
  reason: string;
  status: "pending" | "reviewed" | "dismissed";
  createdAt: number;
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
