/**
 * Student messaging screen — inbox of admin conversations + chat view.
 * Features: inbox search, find admins, optimistic send, failed message retry,
 * long-press delete, copy, emoji picker.
 */

import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Clipboard,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import EmojiPicker from "@/components/chat/EmojiPicker";

import { useAuth } from "@/hooks/AuthContext";
import {
  deleteMessage,
  getOrCreateConversation,
  listenForConversations,
  listenForMessages,
  markAsRead,
  searchUsers,
  sendMessage as sendMsg,
} from "@/services/messagingService";
import type {
  Conversation,
  Message,
  OptimisticMessage,
  StudentSearchResult,
} from "@/types/messaging";

type ViewMode = "inbox" | "chat" | "search";

export default function StudentMessagesScreen() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("inbox");
  const [activeConversation, setActiveConversation] =
    useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [optimistic, setOptimistic] = useState<OptimisticMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  // Context menu state
  const [contextVisible, setContextVisible] = useState(false);
  const [contextMsg, setContextMsg] = useState<Message | null>(null);
  const [showEmoji, setShowEmoji] = useState(false);

  // Inbox search
  const [inboxSearchQuery, setInboxSearchQuery] = useState("");

  // Admin search
  const [admins, setAdmins] = useState<StudentSearchResult[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);

  // Filtered conversations for inbox search
  const filteredConversations = inboxSearchQuery.trim()
    ? conversations.filter((c) =>
        c.adminName.toLowerCase().includes(inboxSearchQuery.toLowerCase()),
      )
    : conversations;

  // Merge Firestore messages with optimistic ones
  const allMessages: OptimisticMessage[] = [
    ...messages,
    ...optimistic.filter(
      (o) => !messages.some((m) => m.id === o.id),
    ),
  ];

  // Listen for admin conversations
  useEffect(() => {
    if (!user?.uid) return;
    const unsub = listenForConversations(user.uid, "student", (convs) => {
      setConversations(convs);
      setLoading(false);
    });
    return () => unsub();
  }, [user?.uid]);

  // Listen for messages when in chat view
  useEffect(() => {
    if (!activeConversation?.id) return;

    const unsub = listenForMessages(activeConversation.id, (msgs) => {
      setMessages(msgs);
      setLoading(false);
      markAsRead(activeConversation.id, user!.uid);
      setOptimistic((prev) =>
        prev.filter((o) => !msgs.some((m) => m.id === o.id)),
      );
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: false });
      }, 100);
    });

    return () => unsub();
  }, [activeConversation?.id, user?.uid]);

  // Debounced search for admins
  useEffect(() => {
    if (viewMode !== "search") return;

    const handler = setTimeout(async () => {
      setSearchLoading(true);
      const results = await searchUsers(user!.uid, "student", searchQuery, "admins");
      setAdmins(results);
      setSearchLoading(false);
    }, 300);

    return () => clearTimeout(handler);
  }, [searchQuery, viewMode, user]);

  const openChat = (conversation: Conversation) => {
    setActiveConversation(conversation);
    setViewMode("chat");
  };

  const openSearch = () => {
    setViewMode("search");
  };

  const startConversation = async (admin: StudentSearchResult) => {
    try {
      const studentName = user?.displayName || "Student";
      const convId = await getOrCreateConversation(
        user!.uid,
        admin.uid,
        studentName,
        admin.fullName,
      );

      const existing = conversations.find((c) => c.id === convId);
      if (existing) {
        openChat(existing);
      } else {
        const tempConv: Conversation = {
          id: convId,
          studentId: user!.uid,
          adminId: admin.uid,
          studentName,
          adminName: admin.fullName,
          lastMessage: "",
          lastMessageAt: Date.now(),
          unreadBy: [],
        };
        setActiveConversation(tempConv);
        setViewMode("chat");
      }
    } catch (err) {
      console.error("Failed to start conversation:", err);
    }
  };

  // ─── Send with optimistic UI ─────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    if (!inputText.trim() || !activeConversation || !user?.uid || sending)
      return;

    const text = inputText.trim();
    const tempId = `temp_${Date.now()}`;
    setInputText("");

    const optMsg: OptimisticMessage = {
      id: tempId,
      senderId: user.uid,
      text,
      createdAt: Date.now(),
      isAdmin: false,
      failed: false,
    };
    setOptimistic((prev) => [...prev, optMsg]);
    setSending(true);

    try {
      const realId = await sendMsg(activeConversation.id, text, user.uid, false);
      setOptimistic((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, id: realId } : m)),
      );
    } catch (err) {
      console.error("Failed to send:", err);
      setOptimistic((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, failed: true } : m)),
      );
    } finally {
      setSending(false);
    }
  }, [inputText, activeConversation, user?.uid, sending]);

  // ─── Retry a failed message ──────────────────────────────────────────────
  const handleRetry = useCallback(
    async (msg: OptimisticMessage) => {
      if (!activeConversation || !user?.uid) return;

      setOptimistic((prev) =>
        prev.map((m) => (m.id === msg.id ? { ...m, failed: false } : m)),
      );

      try {
        const realId = await sendMsg(
          activeConversation.id,
          msg.text,
          user.uid,
          false,
        );
        setOptimistic((prev) =>
          prev.map((m) => (m.id === msg.id ? { ...m, id: realId } : m)),
        );
      } catch {
        setOptimistic((prev) =>
          prev.map((m) => (m.id === msg.id ? { ...m, failed: true } : m)),
        );
      }
    },
    [activeConversation, user?.uid],
  );

  // ─── Context menu actions ────────────────────────────────────────────────
  const handleCopy = () => {
    if (contextMsg) {
      Clipboard.setString(contextMsg.deleted ? "" : contextMsg.text);
    }
    setContextVisible(false);
  };

  const handleDelete = async () => {
    if (!contextMsg || !activeConversation) return;
    setContextVisible(false);

    try {
      await deleteMessage(activeConversation.id, contextMsg.id);
    } catch (err) {
      console.error("Failed to delete:", err);
    }
  };

  const formatTime = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const date = new Date(timestamp);

    if (diff < 86400000) {
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  // ─── Inbox: Conversation row ─────────────────────────────────────────────
  const renderConversation = ({ item }: { item: Conversation }) => {
    const hasUnread = item.unreadBy?.includes(user?.uid || "");

    return (
      <Pressable
        style={styles.convRow}
        onPress={() => openChat(item)}
      >
        <View style={styles.convAvatar}>
          <Ionicons name="shield-checkmark" size={22} color="#8A63D2" />
        </View>
        <View style={styles.convInfo}>
          <View style={styles.convTop}>
            <Text
              style={[styles.convName, hasUnread && styles.convNameBold]}
              numberOfLines={1}
            >
              {item.adminName || "Guidance Counselor"}
            </Text>
            <Text style={styles.convTime}>
              {item.lastMessageAt ? formatTime(item.lastMessageAt) : ""}
            </Text>
          </View>
          <Text
            style={[styles.convLastMsg, hasUnread && styles.convLastMsgBold]}
            numberOfLines={1}
          >
            {item.lastMessage || "No messages yet"}
          </Text>
        </View>
        {hasUnread && <View style={styles.unreadDot} />}
      </Pressable>
    );
  };

  // ─── Search: Admin row ───────────────────────────────────────────────────
  const renderAdmin = ({ item }: { item: StudentSearchResult }) => (
    <Pressable style={styles.convRow} onPress={() => startConversation(item)}>
      <View style={styles.convAvatar}>
        <Ionicons name="shield-checkmark" size={22} color="#8A63D2" />
      </View>
      <View style={styles.convInfo}>
        <Text style={styles.convName}>{item.fullName}</Text>
        <Text style={styles.convLastMsg} numberOfLines={1}>
          {item.department || "Guidance Counselor"}
        </Text>
      </View>
      <Ionicons name="chatbubble-outline" size={18} color="#8A63D2" />
    </Pressable>
  );

  // ─── Chat: Message bubble ────────────────────────────────────────────────
  const renderMessage = ({ item }: { item: OptimisticMessage }) => {
    const isMine = item.senderId === user?.uid;
    const isDeleted = item.deleted;
    const isFailed = item.failed;

    return (
      <Pressable
        onLongPress={() => {
          if (!isDeleted) {
            setContextMsg(item);
            setContextVisible(true);
          }
        }}
        delayLongPress={400}
        style={[
          styles.bubbleRow,
          isMine ? styles.bubbleRowRight : styles.bubbleRowLeft,
        ]}
      >
        <View
          style={[
            styles.bubble,
            isMine ? styles.bubbleMine : styles.bubbleTheirs,
            isDeleted && styles.bubbleDeleted,
          ]}
        >
          {isDeleted ? (
            <View style={styles.deletedRow}>
              <Ionicons
                name="ban-outline"
                size={14}
                color={isMine ? "rgba(255,255,255,0.5)" : "#94A3B8"}
              />
              <Text
                style={[
                  styles.deletedText,
                  isMine && styles.deletedTextMine,
                ]}
              >
                This message was deleted
              </Text>
            </View>
          ) : (
            <Text
              style={[styles.bubbleText, isMine && styles.bubbleTextMine]}
            >
              {item.text}
            </Text>
          )}

          <View style={styles.bubbleFooter}>
            <Text
              style={[styles.bubbleTime, isMine && styles.bubbleTimeMine]}
            >
              {formatTime(item.createdAt)}
            </Text>
            {isFailed && (
              <Pressable
                style={styles.retryBtn}
                onPress={() => handleRetry(item)}
              >
                <Ionicons name="refresh" size={12} color="#EF4444" />
                <Text style={styles.retryText}>Retry</Text>
              </Pressable>
            )}
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        {/* Header */}
        <LinearGradient
          colors={["#8A63D2", "#B794F6"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.header}>
            <Pressable
              style={styles.backBtn}
              onPress={() => {
                if (viewMode === "chat") {
                  setViewMode("inbox");
                  setActiveConversation(null);
                  setMessages([]);
                  setOptimistic([]);
                } else if (viewMode === "search") {
                  setViewMode("inbox");
                  setSearchQuery("");
                } else if (inboxSearchQuery) {
                  setInboxSearchQuery("");
                } else {
                  router.back();
                }
              }}
            >
              <Ionicons name="arrow-back" size={22} color="white" />
            </Pressable>
            <Text style={styles.headerTitle}>
              {viewMode === "chat"
                ? activeConversation?.adminName || "Chat"
                : viewMode === "search"
                  ? "Find Counselors"
                  : "Messages"}
            </Text>
            {viewMode === "chat" && (
              <View style={styles.headerBadge}>
                <Ionicons name="shield-checkmark" size={10} color="white" />
                <Text style={styles.headerBadgeText}>Admin</Text>
              </View>
            )}
            {viewMode !== "chat" && <View style={{ width: 40 }} />}
          </View>
        </LinearGradient>

        {/* Content */}
        {viewMode === "inbox" ? (
          loading ? (
            <View style={styles.emptyState}>
              <Ionicons name="chatbubbles-outline" size={48} color="#D1D5DB" />
              <Text style={styles.emptyText}>Loading conversations...</Text>
            </View>
          ) : conversations.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="chatbubbles-outline" size={48} color="#D1D5DB" />
              <Text style={styles.emptyTitle}>No conversations yet</Text>
              <Text style={styles.emptyText}>
                Tap "Find" to search for a counselor and start a conversation.
              </Text>
              <Pressable style={styles.findBtn} onPress={openSearch}>
                <Ionicons name="search" size={18} color="white" />
                <Text style={styles.findBtnText}>Find Counselors</Text>
              </Pressable>
            </View>
          ) : (
            <>
              {/* Inbox search bar */}
              <View style={styles.searchBar}>
                <Ionicons name="search" size={18} color="#94A3B8" />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search conversations..."
                  placeholderTextColor="#94A3B8"
                  value={inboxSearchQuery}
                  onChangeText={setInboxSearchQuery}
                />
                {inboxSearchQuery.length > 0 && (
                  <Pressable onPress={() => setInboxSearchQuery("")}>
                    <Ionicons name="close-circle" size={18} color="#94A3B8" />
                  </Pressable>
                )}
              </View>

              {/* Find button */}
              <View style={styles.filterTabs}>
                <Pressable style={styles.filterTab} onPress={openSearch}>
                  <Ionicons name="search" size={16} color="#8A63D2" />
                  <Text
                    style={[
                      styles.filterTabText,
                      { color: "#8A63D2", fontWeight: "600" },
                    ]}
                  >
                    Find
                  </Text>
                </Pressable>
              </View>

              {filteredConversations.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="search-outline" size={48} color="#D1D5DB" />
                  <Text style={styles.emptyTitle}>No matches</Text>
                  <Text style={styles.emptyText}>
                    No conversations match "{inboxSearchQuery}".
                  </Text>
                </View>
              ) : (
                <FlatList
                  data={filteredConversations}
                  keyExtractor={(item) => item.id}
                  renderItem={renderConversation}
                  contentContainerStyle={styles.convList}
                  showsVerticalScrollIndicator={false}
                />
              )}
            </>
          )
        ) : viewMode === "search" ? (
          <>
            <View style={styles.searchBar}>
              <Ionicons name="search" size={18} color="#94A3B8" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by name..."
                placeholderTextColor="#94A3B8"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
              />
              {searchQuery.length > 0 && (
                <Pressable onPress={() => setSearchQuery("")}>
                  <Ionicons name="close-circle" size={18} color="#94A3B8" />
                </Pressable>
              )}
            </View>
            {searchLoading ? (
              <View style={styles.emptyState}>
                <ActivityIndicator size="large" color="#8A63D2" />
                <Text style={styles.emptyText}>Searching...</Text>
              </View>
            ) : admins.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="search-outline" size={48} color="#D1D5DB" />
                <Text style={styles.emptyTitle}>
                  {searchQuery ? "No counselors found" : "Find a Counselor"}
                </Text>
                <Text style={styles.emptyText}>
                  {searchQuery
                    ? "Try a different search term."
                    : "Start typing a name to find your guidance counselor."}
                </Text>
              </View>
            ) : (
              <FlatList
                data={admins}
                keyExtractor={(item) => item.uid}
                renderItem={renderAdmin}
                contentContainerStyle={styles.convList}
                showsVerticalScrollIndicator={false}
              />
            )}
          </>
        ) : (
          <>
            {allMessages.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="chatbubble-outline" size={48} color="#D1D5DB" />
                <Text style={styles.emptyTitle}>Start the conversation</Text>
                <Text style={styles.emptyText}>
                  Send a message to {activeConversation?.adminName}.
                </Text>
              </View>
            ) : (
              <FlatList
                ref={flatListRef}
                data={allMessages}
                keyExtractor={(item) => item.id}
                renderItem={renderMessage}
                contentContainerStyle={styles.messagesList}
                showsVerticalScrollIndicator={false}
              />
            )}

            {/* Emoji Picker */}
            {showEmoji && (
              <EmojiPicker
                onSelect={(emoji) => {
                  setInputText((prev) => prev + emoji);
                }}
              />
            )}

            {/* Input */}
            <View style={styles.inputBar}>
              <Pressable
                style={styles.emojiBtn}
                onPress={() => setShowEmoji((v) => !v)}
              >
                <Ionicons
                  name={showEmoji ? "keyboard" : ("happy-outline" as any)}
                  size={24}
                  color={showEmoji ? "#8A63D2" : "#94A3B8"}
                />
              </Pressable>
              <TextInput
                style={styles.textInput}
                placeholder="Type a message..."
                placeholderTextColor="#94A3B8"
                value={inputText}
                onChangeText={setInputText}
                multiline
                maxLength={1000}
                onFocus={() => setShowEmoji(false)}
              />
              <Pressable
                style={[
                  styles.sendBtn,
                  (!inputText.trim() || sending) && styles.sendBtnDisabled,
                ]}
                onPress={handleSend}
                disabled={!inputText.trim() || sending}
              >
                <Ionicons
                  name="arrow-up-circle"
                  size={32}
                  color={inputText.trim() ? "#8A63D2" : "#D1D5DB"}
                />
              </Pressable>
            </View>
          </>
        )}
      </KeyboardAvoidingView>

      {/* ─── Context Menu Modal ─────────────────────────────────────── */}
      <Modal
        visible={contextVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setContextVisible(false)}
      >
        <Pressable
          style={styles.ctxOverlay}
          onPress={() => setContextVisible(false)}
        >
          <View style={styles.ctxMenu}>
            <Text style={styles.ctxTitle}>Message Options</Text>
            <Pressable style={styles.ctxRow} onPress={handleCopy}>
              <Ionicons name="copy-outline" size={20} color="#8A63D2" />
              <Text style={styles.ctxLabel}>Copy</Text>
            </Pressable>
            <View style={styles.ctxDivider} />
            <Pressable style={styles.ctxRow} onPress={handleDelete}>
              <Ionicons name="trash-outline" size={20} color="#EF4444" />
              <Text style={[styles.ctxLabel, { color: "#EF4444" }]}>
                Delete
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F4F2F8" },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "700",
    flex: 1,
    textAlign: "center",
  },
  headerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.25)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    position: "absolute",
    bottom: 10,
    alignSelf: "center",
  },
  headerBadgeText: {
    fontSize: 10,
    fontWeight: "600",
    color: "white",
  },

  // Empty state
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 40,
  },
  emptyTitle: { fontSize: 17, fontWeight: "700", color: "#1E1B4B" },
  emptyText: {
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
  },
  findBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#8A63D2",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    marginTop: 8,
  },
  findBtnText: { color: "white", fontSize: 15, fontWeight: "600" },

  // Conversation list
  convList: { paddingVertical: 8 },
  convRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 12,
    backgroundColor: "white",
    marginHorizontal: 16,
    marginBottom: 2,
    borderRadius: 14,
    marginTop: 4,
    // @ts-ignore
    boxShadow: "0px 2px 8px rgba(138, 99, 210, 0.06)",
  },
  convAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#F3EAFF",
    justifyContent: "center",
    alignItems: "center",
  },
  convInfo: { flex: 1, gap: 2 },
  convTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  convName: { fontSize: 15, fontWeight: "500", color: "#1E1B4B" },
  convNameBold: { fontWeight: "700" },
  convTime: { fontSize: 11, color: "#94A3B8" },
  convLastMsg: { fontSize: 13, color: "#64748B" },
  convLastMsgBold: { color: "#1E1B4B", fontWeight: "600" },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#8A63D2",
  },

  // Messages
  messagesList: {
    flexGrow: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  bubbleRow: { marginBottom: 8, flexDirection: "row" },
  bubbleRowRight: { justifyContent: "flex-end" },
  bubbleRowLeft: { justifyContent: "flex-start" },
  bubble: {
    maxWidth: "78%",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleMine: {
    backgroundColor: "#8A63D2",
    borderBottomRightRadius: 4,
  },
  bubbleTheirs: {
    backgroundColor: "white",
    borderBottomLeftRadius: 4,
    // @ts-ignore
    boxShadow: "0px 2px 8px rgba(138, 99, 210, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(156, 126, 235, 0.06)",
  },
  bubbleDeleted: {
    backgroundColor: "rgba(148, 163, 184, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.2)",
  },
  bubbleText: {
    fontSize: 15,
    color: "#1E1B4B",
    lineHeight: 20,
  },
  bubbleTextMine: { color: "white" },
  bubbleFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 6,
    marginTop: 4,
  },
  bubbleTime: { fontSize: 10, color: "#94A3B8" },
  bubbleTimeMine: { color: "rgba(255,255,255,0.5)" },
  deletedRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  deletedText: { fontSize: 13, color: "#94A3B8", fontStyle: "italic" },
  deletedTextMine: { color: "rgba(255,255,255,0.5)" },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  retryText: { fontSize: 11, color: "#EF4444", fontWeight: "600" },

  // Input
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(156, 126, 235, 0.08)",
    backgroundColor: "white",
    gap: 8,
  },
  textInput: {
    flex: 1,
    backgroundColor: "#FAF8FF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E9D5FF",
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: "#1E1B4B",
    maxHeight: 100,
  },
  emojiBtn: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  sendBtn: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  sendBtnDisabled: { opacity: 0.5 },

  // Search
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    margin: 16,
    marginBottom: 8,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 46,
    gap: 8,
    // @ts-ignore
    boxShadow: "0px 2px 8px rgba(138, 99, 210, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(156, 126, 235, 0.06)",
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: "#1E1B4B",
    paddingVertical: 0,
  },

  // Filter tabs
  filterTabs: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 4,
    gap: 8,
  },
  filterTab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "rgba(156, 126, 235, 0.1)",
  },
  filterTabText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#94A3B8",
  },

  // Context menu
  ctxOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  ctxMenu: {
    backgroundColor: "white",
    borderRadius: 18,
    padding: 6,
    width: 200,
    // @ts-ignore
    boxShadow: "0px 8px 24px rgba(0,0,0,0.15)",
  },
  ctxTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#64748B",
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 6,
  },
  ctxRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  ctxLabel: { fontSize: 15, fontWeight: "600", color: "#1E1B4B" },
  ctxDivider: {
    height: 1,
    backgroundColor: "#F1F5F9",
    marginHorizontal: 14,
  },
});
