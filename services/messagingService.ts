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
  where
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
  onError?: (error: Error) => void,
): () => void {
  const messagesRef = collection(
    db,
    "conversations",
    conversationId,
    "messages",
  );
  const q = query(messagesRef, orderBy("createdAt", "asc"));

  return onSnapshot(
    q,
    (snapshot) => {
      const messages: Message[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Message, "id">),
      }));
      callback(messages);
    },
    onError || ((err) => console.warn("Snapshot error:", err)),
  );
}

/**
 * Real-time listener for all conversations where the given user is a participant.
 */
export function listenForConversations(
  userId: string,
  role: "student" | "admin",
  callback: (conversations: Conversation[]) => void,
  onError?: (error: Error) => void,
): () => void {
  const conversationsRef = collection(db, "conversations");
  const q = query(
    conversationsRef,
    where("participants", "array-contains", userId),
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const conversations: Conversation[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Conversation, "id">),
      }));
      conversations.sort((a, b) => b.lastMessageAt - a.lastMessageAt);
      callback(conversations);
    },
    onError || ((err) => console.warn("Snapshot error:", err)),
  );
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
  } else if (!snap.data().participants) {
    // Migrate old conversations that lack the participants field
    await setDoc(
      conversationRef,
      { participants: [uidA, uidB] },
      { merge: true },
    );
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
  onError?: (error: Error) => void,
): () => void {
  const conversationsRef = collection(db, "conversations");
  const q = query(
    conversationsRef,
    where("type", "==", "peer"),
    where("participants", "array-contains", userId),
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const conversations: Conversation[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Conversation, "id">),
      }));
      conversations.sort((a, b) => b.lastMessageAt - a.lastMessageAt);
      callback(conversations);
    },
    onError || ((err) => console.warn("Snapshot error:", err)),
  );
}

/**
 * Real-time listener for ALL peer-to-peer conversations.
 * Used by admins for moderation — sees every peer chat, not just ones they participate in.
 */
export function listenForAllPeerConversations(
  callback: (conversations: Conversation[]) => void,
  onError?: (error: Error) => void,
): () => void {
  const conversationsRef = collection(db, "conversations");
  const q = query(conversationsRef, where("type", "==", "peer"));

  return onSnapshot(
    q,
    (snapshot) => {
      const conversations: Conversation[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Conversation, "id">),
      }));
      conversations.sort((a, b) => b.lastMessageAt - a.lastMessageAt);
      callback(conversations);
    },
    onError || ((err) => console.warn("Snapshot error:", err)),
  );
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
 * Searches for users (students and/or admins) by name or department.
 * Fetches all documents from the relevant collection(s) and filters
 * client-side with case-insensitive substring matching.
 * @param searchIn - "all" searches both collections, "users" only students, "admins" only admins.
 * Returns an empty array if the query is empty or on failure.
 */
export async function searchUsers(
  currentUserId: string,
  role: "student" | "admin",
  queryText: string,
  searchIn: "all" | "users" | "admins" = "all",
): Promise<StudentSearchResult[]> {
  const searchText = queryText.toLowerCase().trim();
  if (!searchText) {
    return [];
  }

  try {
    const results: StudentSearchResult[] = [];

    if (searchIn === "all" || searchIn === "users") {
      const userDocs = await getDocs(collection(db, "users"));
      for (const d of userDocs.docs) {
        if (d.id === currentUserId) continue;
        const data = d.data();
        const name = (data.fullName || data.displayName || "").toLowerCase();
        const dept = (data.department || "").toLowerCase();
        if (name.includes(searchText) || dept.includes(searchText)) {
          results.push({
            uid: d.id,
            fullName: data.fullName || data.displayName || "Student",
            department: data.department || undefined,
            yearLevel: data.yearLevel || undefined,
          });
        }
      }
    }

    if (searchIn === "all" || searchIn === "admins") {
      const adminDocs = await getDocs(collection(db, "admins"));
      for (const d of adminDocs.docs) {
        if (d.id === currentUserId) continue;
        const data = d.data();
        const name = (data.fullName || data.displayName || "").toLowerCase();
        const dept = (data.position || data.department || "").toLowerCase();
        if (name.includes(searchText) || dept.includes(searchText)) {
          results.push({
            uid: d.id,
            fullName: data.fullName || data.displayName || "Admin",
            department: data.position || data.department || "Administrator",
          });
        }
      }
    }

    return results.sort((a, b) => a.fullName.localeCompare(b.fullName));
  } catch (error) {
    console.error("searchUsers error:", error);
    return [];
  }
}

/**
 * Fetches all users from a Firestore collection (users or admins).
 * Used by the tabbed directory to render the full user list without requiring a search query.
 * Filters out the currently logged-in user.
 */
export async function fetchAllUsers(
  currentUserId: string,
  collectionName: "users" | "admins",
): Promise<StudentSearchResult[]> {
  try {
    const snapshot = await getDocs(collection(db, collectionName));
    const results: StudentSearchResult[] = [];
    for (const d of snapshot.docs) {
      if (d.id === currentUserId) continue;
      const data = d.data();
      results.push({
        uid: d.id,
        fullName:
          data.fullName ||
          data.displayName ||
          (collectionName === "admins" ? "Admin" : "Student"),
        department: data.department || data.position || undefined,
        yearLevel: data.yearLevel || undefined,
        profileImage: data.profileImage || undefined,
      });
    }
    return results.sort((a, b) => a.fullName.localeCompare(b.fullName));
  } catch (error) {
    console.error("fetchAllUsers error:", error);
    return [];
  }
}

// ── Conversation support actions (pinning, hide, block, report) ─────────────

/**
 * Toggles whether a user has pinned a conversation.
 * Pure presentation state stored on the conversation doc; does not affect chat flow.
 */
export async function togglePinConversation(
  conversationId: string,
  uid: string,
): Promise<void> {
  const conversationRef = doc(db, "conversations", conversationId);
  const snap = await getDoc(conversationRef);
  if (!snap.exists()) return;
  const data = snap.data();
  const pinnedBy: string[] = data.pinnedBy || [];
  const next = pinnedBy.includes(uid)
    ? pinnedBy.filter((u: string) => u !== uid)
    : [...pinnedBy, uid];
  await setDoc(conversationRef, { pinnedBy: next }, { merge: true });
}

/**
 * Marks a conversation as hidden for a specific user.
 * The conversation still exists for the other participant; it just disappears
 * from this user's inbox (soft-delete).
 */
export async function hideConversation(
  conversationId: string,
  uid: string,
): Promise<void> {
  const conversationRef = doc(db, "conversations", conversationId);
  const snap = await getDoc(conversationRef);
  if (!snap.exists()) return;
  const data = snap.data();
  const hiddenBy: string[] = data.hiddenBy || [];
  if (!hiddenBy.includes(uid)) {
    await setDoc(
      conversationRef,
      { hiddenBy: [...hiddenBy, uid] },
      { merge: true },
    );
  }
}

/**
 * Records a user report for a conversation.
 * Stores in the top-level "reports" collection for admin moderation.
 */
export async function reportConversation(input: {
  conversationId: string;
  reporterUid: string;
  reportedUid: string;
  type: "peer" | "admin";
  reason: string;
}): Promise<string> {
  const reportRef = doc(collection(db, "reports"));
  await setDoc(reportRef, {
    conversationId: input.conversationId,
    reporterUid: input.reporterUid,
    reportedUid: input.reportedUid,
    type: input.type,
    reason: input.reason,
    status: "pending",
    createdAt: Date.now(),
  });
  return reportRef.id;
}

/**
 * Blocks a user by adding their UID to the blocker's `blockedUsers` list.
 * The blocker's inbox will filter out conversations with blocked users.
 */
export async function blockUser(
  blockerUid: string,
  blockedUid: string,
): Promise<void> {
  const userRef = doc(db, "users", blockerUid);
  const snap = await getDoc(userRef);
  const data = snap.exists() ? snap.data() : {};
  const blocked: string[] = data.blockedUsers || [];
  if (!blocked.includes(blockedUid)) {
    await setDoc(userRef, { blockedUsers: [...blocked, blockedUid] }, { merge: true });
  }
}

/**
 * Returns the list of UIDs blocked by the given user.
 */
export async function getBlockedUsers(uid: string): Promise<string[]> {
  try {
    const snap = await getDoc(doc(db, "users", uid));
    return snap.exists() ? snap.data().blockedUsers || [] : [];
  } catch {
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

// ── Typing Indicator ─────────────────────────────────────────────────────────

/**
 * Updates the typing status for a user in a conversation.
 * Sets typingBy[uid] = timestamp when typing, removes when stopped.
 */
export async function setTyping(
  conversationId: string,
  uid: string,
  isTyping: boolean,
): Promise<void> {
  try {
    const conversationRef = doc(db, "conversations", conversationId);
    if (isTyping) {
      await setDoc(
        conversationRef,
        { [`typingBy.${uid}`]: Date.now() },
        { merge: true },
      );
    } else {
      // Remove the field by setting it to delete sentinel
      // Firestore doesn't support field deletion via setDoc, so we use runTransaction
      const snap = await getDoc(conversationRef);
      if (snap.exists()) {
        const data = snap.data();
        const typingBy = { ...(data.typingBy || {}) };
        delete typingBy[uid];
        await setDoc(conversationRef, { typingBy }, { merge: false });
      }
    }
  } catch (err) {
    console.error("setTyping error:", err);
  }
}

/**
 * Real-time listener for the other user's typing status in a conversation.
 * Returns a cleanup function. Calls callback with true when the other person is typing.
 */
export function listenForTyping(
  conversationId: string,
  currentUid: string,
  callback: (isOtherTyping: boolean) => void,
  onError?: (error: Error) => void,
): () => void {
  const conversationRef = doc(db, "conversations", conversationId);
  return onSnapshot(
    conversationRef,
    (snap) => {
      if (!snap.exists()) {
        callback(false);
        return;
      }
      const data = snap.data();
      const typingBy = data.typingBy || {};
      const now = Date.now();
      // Consider someone "typing" if their timestamp is within the last 5 seconds
      const isOtherTyping = Object.entries(typingBy).some(
        ([uid, timestamp]) =>
          uid !== currentUid && now - (timestamp as number) < 5000,
      );
      callback(isOtherTyping);
    },
    onError || ((err) => console.warn("Snapshot error:", err)),
  );
}

/**
 * Auto-clear typing status after inactivity.
 * Call this with a debounced version of setTyping.
 */
let typingTimeout: ReturnType<typeof setTimeout> | null = null;

export function startTyping(conversationId: string, uid: string): void {
  setTyping(conversationId, uid, true);

  if (typingTimeout) clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    setTyping(conversationId, uid, false);
  }, 3000);
}

export function stopTyping(conversationId: string, uid: string): void {
  if (typingTimeout) clearTimeout(typingTimeout);
  setTyping(conversationId, uid, false);
}
