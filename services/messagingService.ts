/**
 * Firestore service for student-admin and peer-to-peer real-time messaging.
 *
 * Collection structure:
 *   conversations/{conversationId}
 *     - [admin] studentId, adminId, studentName, adminName
 *     - [peer] type: "peer", participants: [uidA, uidB], participantNames: { [uid]: name }
 *     - lastMessage, lastMessageAt, unreadBy[]
 *
 *   conversations/{conversationId}/messages/{messageId}
 *     - senderId, text, createdAt, isAdmin, deleted
 *     - [peer] senderRole: "student" | "admin", moderationStatus: "safe" | "flagged" | "blocked"
 */

import { db } from "@/constants/firebase";
import type {
  Conversation,
  Message,
  StudentSearchResult,
} from "@/types/messaging";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  setDoc,
  where,
} from "firebase/firestore";

/**
 * Builds a deterministic conversation ID from two UIDs.
 */
function buildConversationId(uidA: string, uidB: string): string {
  return [uidA, uidB].sort().join("_");
}

/**
 * Fetches or creates a conversation between a student and an admin.
 */
export async function getOrCreateConversation(
  studentUid: string,
  adminUid: string,
  studentName: string,
  adminName: string,
): Promise<string> {
  const conversationId = buildConversationId(studentUid, adminUid);
  const conversationRef = doc(db, "conversations", conversationId);
  const snap = await getDoc(conversationRef);

  if (!snap.exists()) {
    await setDoc(conversationRef, {
      studentId: studentUid,
      adminId: adminUid,
      studentName,
      adminName,
      participants: [studentUid, adminUid],
      lastMessage: "",
      lastMessageAt: Date.now(),
      unreadBy: [],
    });
  } else if (!snap.data().participants) {
    // Migrate old conversations that lack the participants field
    await setDoc(
      conversationRef,
      { participants: [studentUid, adminUid] },
      { merge: true },
    );
  }

  return conversationId;
}

/**
 * Sends a message in a conversation.
 * Returns the message ID for optimistic UI tracking.
 */
export async function sendMessage(
  conversationId: string,
  text: string,
  senderUid: string,
  isAdmin: boolean,
  moderationStatus?: "safe" | "flagged" | "blocked",
): Promise<string> {
  const messagesRef = collection(
    db,
    "conversations",
    conversationId,
    "messages",
  );
  const conversationRef = doc(db, "conversations", conversationId);

  const messageId = `${senderUid}_${Date.now()}`;

  await runTransaction(db, async (transaction) => {
    const messageRef = doc(messagesRef, messageId);
    transaction.set(messageRef, {
      senderId: senderUid,
      text: text.trim(),
      createdAt: Date.now(),
      isAdmin,
      deleted: false,
      moderationStatus: moderationStatus || "safe",
    });

    transaction.update(conversationRef, {
      lastMessage: text.trim(),
      lastMessageAt: Date.now(),
      unreadBy: [],
    });
  });

  return messageId;
}

/**
 * Soft-deletes a message (sets deleted: true, preserves conversation history).
 * Then recalculates the conversation's lastMessage from remaining visible messages.
 */
export async function deleteMessage(
  conversationId: string,
  messageId: string,
): Promise<void> {
  const messageRef = doc(
    db,
    "conversations",
    conversationId,
    "messages",
    messageId,
  );

  await setDoc(messageRef, { deleted: true }, { merge: true });

  // Recalculate lastMessage from the most recent non-deleted message
  await updateLastMessage(conversationId);
}

/**
 * Recalculates a conversation's lastMessage from its most recent visible message.
 */
export async function updateLastMessage(conversationId: string): Promise<void> {
  const messagesRef = collection(
    db,
    "conversations",
    conversationId,
    "messages",
  );
  const q = query(messagesRef, orderBy("createdAt", "asc"));
  const snapshot = await getDocs(q);

  const conversationRef = doc(db, "conversations", conversationId);

  // Find the last non-deleted message
  let lastMsg = "";
  let lastMsgAt = Date.now();
  for (const d of snapshot.docs) {
    const data = d.data();
    if (!data.deleted) {
      lastMsg = data.text;
      lastMsgAt = data.createdAt;
    }
  }

  await setDoc(
    conversationRef,
    { lastMessage: lastMsg, lastMessageAt: lastMsgAt },
    { merge: true },
  );
}

/**
 * Permanently deletes a message document from Firestore.
 * Used by admin for moderation or cleanup of deleted messages.
 */
export async function permanentlyDeleteMessage(
  conversationId: string,
  messageId: string,
): Promise<void> {
  const messageRef = doc(
    db,
    "conversations",
    conversationId,
    "messages",
    messageId,
  );
  await deleteDoc(messageRef);
  await updateLastMessage(conversationId);
}

/**
 * Deletes an entire conversation and all its messages.
 * Admin-only action for cleaning up resolved conversations.
 */
export async function deleteConversation(
  conversationId: string,
): Promise<void> {
  // Delete all messages in the subcollection
  const messagesRef = collection(
    db,
    "conversations",
    conversationId,
    "messages",
  );
  const snapshot = await getDocs(messagesRef);
  const batchDeletes = snapshot.docs.map((d) => deleteDoc(d.ref));
  await Promise.all(batchDeletes);

  // Delete the conversation document itself
  const conversationRef = doc(db, "conversations", conversationId);
  await deleteDoc(conversationRef);
}

/**
 * Marks a conversation as read by the given user.
 */
export async function markAsRead(
  conversationId: string,
  readerUid: string,
): Promise<void> {
  const conversationRef = doc(db, "conversations", conversationId);
  const snap = await getDoc(conversationRef);
  if (snap.exists()) {
    const data = snap.data();
    const unread = (data.unreadBy || []).filter(
      (uid: string) => uid !== readerUid,
    );
    await setDoc(conversationRef, { unreadBy: unread }, { merge: true });
  }
}

/**
 * Real-time listener for messages in a conversation.
 * Returns messages ordered by createdAt ascending.
 */
export function listenForMessages(
  conversationId: string,
  callback: (messages: Message[]) => void,
): () => void {
  const messagesRef = collection(
    db,
    "conversations",
    conversationId,
    "messages",
  );
  const q = query(messagesRef, orderBy("createdAt", "asc"));

  return onSnapshot(q, (snapshot) => {
    const messages: Message[] = snapshot.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<Message, "id">),
    }));
    callback(messages);
  });
}

/**
 * Real-time listener for all conversations where the given user is a participant.
 */
export function listenForConversations(
  userId: string,
  role: "student" | "admin",
  callback: (conversations: Conversation[]) => void,
): () => void {
  const conversationsRef = collection(db, "conversations");
  const field = role === "student" ? "studentId" : "adminId";
  const q = query(conversationsRef, where(field, "==", userId));

  return onSnapshot(q, (snapshot) => {
    const conversations: Conversation[] = snapshot.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<Conversation, "id">),
    }));
    conversations.sort((a, b) => b.lastMessageAt - a.lastMessageAt);
    callback(conversations);
  });
}

/**
 * Fetches the display name for a user UID from either "users" or "admins" collection.
 */
export async function getUserDisplayName(uid: string): Promise<string> {
  let snap = await getDoc(doc(db, "users", uid));
  if (snap.exists()) {
    return snap.data().fullName || snap.data().displayName || "Student";
  }
  snap = await getDoc(doc(db, "admins", uid));
  if (snap.exists()) {
    return snap.data().fullName || snap.data().displayName || "Admin";
  }
  return "Unknown";
}

// ── Peer-to-Peer Messaging ───────────────────────────────────────────────────

/**
 * Fetches or creates a peer-to-peer conversation between two students.
 */
export async function getOrCreatePeerConversation(
  uidA: string,
  uidB: string,
  nameA: string,
  nameB: string,
): Promise<string> {
  const conversationId = buildConversationId(uidA, uidB);
  const conversationRef = doc(db, "conversations", conversationId);
  const snap = await getDoc(conversationRef);

  if (!snap.exists()) {
    await setDoc(conversationRef, {
      type: "peer",
      participants: [uidA, uidB],
      participantNames: { [uidA]: nameA, [uidB]: nameB },
      lastMessage: "",
      lastMessageAt: Date.now(),
      unreadBy: [],
    });
  }

  return conversationId;
}

/**
 * Real-time listener for peer-to-peer conversations where the given user is a participant.
 * Used by students to see their own peer chats.
 */
export function listenForPeerConversations(
  userId: string,
  callback: (conversations: Conversation[]) => void,
): () => void {
  const conversationsRef = collection(db, "conversations");
  const q = query(conversationsRef, where("type", "==", "peer"));

  return onSnapshot(q, (snapshot) => {
    const conversations: Conversation[] = snapshot.docs
      .map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Conversation, "id">),
      }))
      .filter((conv) => conv.participants?.includes(userId) || false);
    conversations.sort((a, b) => b.lastMessageAt - a.lastMessageAt);
    callback(conversations);
  });
}

/**
 * Real-time listener for ALL peer-to-peer conversations.
 * Used by admins for moderation — sees every peer chat, not just ones they participate in.
 */
export function listenForAllPeerConversations(
  callback: (conversations: Conversation[]) => void,
): () => void {
  const conversationsRef = collection(db, "conversations");
  const q = query(conversationsRef, where("type", "==", "peer"));

  return onSnapshot(q, (snapshot) => {
    const conversations: Conversation[] = snapshot.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<Conversation, "id">),
    }));
    conversations.sort((a, b) => b.lastMessageAt - a.lastMessageAt);
    callback(conversations);
  });
}

/**
 * Fetches the latest name for a user from Firestore.
 * Always reads from the database to ensure the name is up-to-date.
 */
export async function fetchFreshPeerName(uid: string): Promise<string> {
  // Try users collection first
  let snap = await getDoc(doc(db, "users", uid));
  if (snap.exists()) {
    return snap.data().fullName || snap.data().displayName || "Student";
  }
  // Try admins collection
  snap = await getDoc(doc(db, "admins", uid));
  if (snap.exists()) {
    return snap.data().fullName || snap.data().displayName || "Admin";
  }
  return "Unknown";
}

/**
 * Refreshes participantNames in a peer conversation by fetching latest names from DB.
 * Call this when opening a chat to ensure names are current.
 */
export async function refreshPeerConversationNames(
  conversationId: string,
  participants: string[],
): Promise<Record<string, string>> {
  const names: Record<string, string> = {};
  for (const uid of participants) {
    names[uid] = await fetchFreshPeerName(uid);
  }
  // Update the conversation document with fresh names
  const conversationRef = doc(db, "conversations", conversationId);
  await setDoc(conversationRef, { participantNames: names }, { merge: true });
  return names;
}

/**
 * Searches for users (students and/or admins) to start a conversation with.
 * Uses a 'keywords' field for prefix search.
 * @param searchIn - "all" searches both collections, "users" only students, "admins" only admins.
 * Returns an empty array on failure.
 */
export async function searchUsers(
  currentUserId: string,
  role: "student" | "admin",
  queryText: string,
  searchIn: "all" | "users" | "admins" = "all",
): Promise<StudentSearchResult[]> {
  const results: StudentSearchResult[] = [];
  const searchText = queryText.toLowerCase().trim();

  if (!searchText) {
    return [];
  }

  try {
    if (searchIn === "all" || searchIn === "users") {
      const usersRef = collection(db, "users");
      const userQuery = query(
        usersRef,
        where("keywords", "array-contains", searchText),
      );
      const userDocs = await getDocs(userQuery);

      userDocs.docs.forEach((doc) => {
        if (doc.id === currentUserId) return;
        const data = doc.data();
        results.push({
          uid: doc.id,
          fullName: data.fullName || data.displayName || "Student",
          department: data.department || undefined,
          yearLevel: data.yearLevel || undefined,
        });
      });
    }

    if (searchIn === "all" || searchIn === "admins") {
      const adminsRef = collection(db, "admins");
      const adminQuery = query(
        adminsRef,
        where("keywords", "array-contains", searchText),
      );
      const adminDocs = await getDocs(adminQuery);

      adminDocs.forEach((doc) => {
        if (doc.id === currentUserId) return;
        const data = doc.data();
        results.push({
          uid: doc.id,
          fullName: data.fullName || data.displayName || "Admin",
          department: data.position || "Administrator",
        });
      });
    }

    return results.sort((a, b) => a.fullName.localeCompare(b.fullName));
  } catch (error) {
    console.error("searchUsers error:", error);
    return [];
  }
}

/**
 * Gets the other participant's name from a peer conversation.
 * Uses participantNames from the conversation doc if available, falls back to DB lookup.
 */
export async function getPeerNameAsync(
  conversation: Conversation,
  currentUserId: string,
): Promise<string> {
  if (!conversation.participants) {
    return conversation.studentName || "Student";
  }
  const otherUid = conversation.participants.find(
    (uid) => uid !== currentUserId,
  );
  if (!otherUid) return "Student";

  // Check cached names first
  if (conversation.participantNames?.[otherUid]) {
    return conversation.participantNames[otherUid];
  }

  // Fetch fresh from DB
  return fetchFreshPeerName(otherUid);
}

/**
 * Synchronous version — uses cached participantNames only.
 * For display in lists where we already have the conversation data.
 */
export function getPeerName(
  conversation: Conversation,
  currentUserId: string,
): string {
  if (!conversation.participantNames || !conversation.participants) {
    return conversation.studentName || "Student";
  }
  const otherUid = conversation.participants.find(
    (uid) => uid !== currentUserId,
  );
  if (otherUid && conversation.participantNames[otherUid]) {
    return conversation.participantNames[otherUid];
  }
  return "Student";
}
