/**
 * Admin messages inbox — list of student conversations + chat view.
 * Features: optimistic send, failed message retry, long-press delete (own + any),
 * delete conversation from inbox.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";

import EmojiPicker from "@/components/chat/EmojiPicker";

import { useAuth } from "@/hooks/AuthContext";
import {
  deleteConversation,
  deleteMessage,
  getOrCreateConversation,
  getPeerName,
  listenForConversations,
  listenForMessages,
  listenForPeerConversations,
  markAsRead,
  searchStudents,
  sendMessage as sendMsg,
} from "@/services/messagingService";
import type { Conversation, Message, OptimisticMessage, StudentSearchResult } from "@/types/messaging";

type ViewMode = "inbox" | "chat" | "search";

export default function AdminMessagesScreen() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("inbox");
  const [activeConversation, setActiveConversation] =
    useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [optimistic, setOptimistic] = useState<OptimisticMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const flatListRef = useRef<FlatList>(null);

  // Context menus
  const [msgCtxVisible, setMsgCtxVisible] = useState(false);
  const [msgCtxMsg, setMsgCtxMsg] = useState<Message | null>(null);
  const [convCtxVisible, setConvCtxVisible] = useState(false);
  const [convCtxConv, setConvCtxConv] = useState<Conversation | null>(null);
  const [showEmoji, setShowEmoji] = useState(false);

  // Peer conversations for admin moderation view
  const [peerConversations, setPeerConversations] = useState<Conversation[]>([]);
  const [filterTab, setFilterTab] = useState<"student" | "peer">("student");

  // Student search state
  const [students, setStudents] = useState<StudentSearchResult[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchInitLoading, setSearchInitLoading] = useState(false);

  // Merge Firestore messages with optimistic ones
  const allMessages: OptimisticMessage[] = [
    ...messages,
    ...optimistic.filter((o) => !messages.some((m) => m.id === o.id)),
  ];

  // Listen for all admin conversations
  useEffect(() => {
    if (!user?.uid) return;
    const unsub = listenForConversations(user.uid, "admin", (convs) => {
      setConversations(convs);
      setLoading(false);
    });
    return () => unsub();
  }, [user?.uid]);

  // Listen for peer conversations (admin moderation view)
  useEffect(() => {
    if (!user?.uid) return;
    const unsub = listenForPeerConversations(user.uid, (convs) => {
      setPeerConversations(convs);
    });
    return () => unsub();
  }, [user?.uid]);

  // Listen for messages when in chat view
  useEffect(() => {
    if (!activeConversation?.id) return;

    const unsub = listenForMessages(activeConversation.id, (msgs) => {
      setMessages(msgs);
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

  const openChat = (conversation: Conversation) => {
    setActiveConversation(conversation);
    setViewMode("chat");
  };

  // ─── Student Search ──────────────────────────────────────────────────────
  const openSearch = async () => {
    setViewMode("search");
    setSearchInitLoading(true);
    setSearchQuery("");
    try {
      const allStudents = await searchStudents(user!.uid);
      setStudents(allStudents);
    } catch (err) {
      console.error("Failed to search students:", err);
    } finally {
      setSearchInitLoading(false);
    }
  };

  const startConversation = async (student: StudentSearchResult) => {
    try {
      const adminName = user?.displayName || "Guidance Counselor";
      const convId = await getOrCreateConversation(
        student.uid,
        user!.uid,
        student.fullName,
        adminName,
      );

      // Find or create the conversation object
      const existing = conversations.find((c) => c.id === convId);
      if (existing) {
        openChat(existing);
      } else {
        const tempConv: Conversation = {
          id: convId,
          studentId: student.uid,
          adminId: user!.uid,
          studentName: student.fullName,
          adminName,
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

  const filteredStudents = students.filter((s) => {
    const name = s.fullName || "";
    const department = s.department || "";
    const queryText = searchQuery.toLowerCase();
    return (
      name.toLowerCase().includes(queryText) ||
      department.toLowerCase().includes(queryText)
    );
  });

  // ─── Send with optimistic UI ─────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    if (
      !inputText.trim() ||
      !activeConversation ||
      !user?.uid ||
      sending
    )
      return;

    const text = inputText.trim();
    const tempId = `temp_${Date.now()}`;
    setInputText("");

    const optMsg: OptimisticMessage = {
      id: tempId,
      senderId: user.uid,
      text,
      createdAt: Date.now(),
      isAdmin: true,
      failed: false,
    };
    setOptimistic((prev) => [...prev, optMsg]);
    setSending(true);

    try {
      const realId = await sendMsg(
        activeConversation.id,
        text,
        user.uid,
        true,
      );
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

  // ─── Retry failed message ────────────────────────────────────────────────
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
          true,
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

  // ─── Message context menu ────────────────────────────────────────────────
  const handleCopyMsg = () => {
    if (msgCtxMsg) {
      Clipboard.setString(msgCtxMsg.deleted ? "" : msgCtxMsg.text);
    }
    setMsgCtxVisible(false);
  };

  const handleDeleteMsg = async () => {
    if (!msgCtxMsg || !activeConversation) return;
    setMsgCtxVisible(false);

    try {
      await deleteMessage(activeConversation.id, msgCtxMsg.id);
    } catch (err) {
      console.error("Failed to delete message:", err);
    }
  };

  // ─── Conversation context menu (delete entire conversation) ──────────────
  const handleDeleteConv = async () => {
    if (!convCtxConv) return;
    setConvCtxVisible(false);

    Alert.alert(
      "Delete Conversation",
      `Are you sure you want to delete your conversation with ${convCtxConv.studentName}? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteConversation(convCtxConv.id);
            } catch (err) {
              console.error("Failed to delete conversation:", err);
            }
          },
        },
      ],
    );
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
    const isPeer = item.type === "peer";
    const displayName = isPeer
      ? getPeerName(item, user!.uid)
      : item.studentName;

    return (
      <Pressable
        style={styles.convRow}
        onPress={() => openChat(item)}
        onLongPress={() => {
          setConvCtxConv(item);
          setConvCtxVisible(true);
        }}
        delayLongPress={400}
      >
        <View style={styles.convAvatar}>
          <Ionicons name={isPeer ? "people" : "person"} size={22} color="#8A63D2" />
        </View>
        <View style={styles.convInfo}>
          <View style={styles.convTop}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1 }}>
              <Text
                style={[styles.convName, hasUnread && styles.convNameBold]}
                numberOfLines={1}
              >
                {displayName}
              </Text>
              {isPeer && (
                <View style={styles.peerBadge}>
                  <Text style={styles.peerBadgeText}>Peer</Text>
                </View>
              )}
            </View>
            <Text style={styles.convTime}>
              {item.lastMessageAt ? formatTime(item.lastMessageAt) : ""}
            </Text>
          </View>
          <Text
            style={[
              styles.convLastMsg,
              hasUnread && styles.convLastMsgBold,
            ]}
            numberOfLines={1}
          >
            {item.lastMessage || "No messages yet"}
          </Text>
        </View>
        {hasUnread && <View style={styles.unreadDot} />}
      </Pressable>
    );
  };

  // ─── Search: Student row ─────────────────────────────────────────────────
  const renderStudent = ({ item }: { item: StudentSearchResult }) => (
    <Pressable
      style={styles.convRow}
      onPress={() => startConversation(item)}
    >
      <View style={styles.convAvatar}>
        <Ionicons name="person" size={22} color="#8A63D2" />
      </View>
      <View style={styles.convInfo}>
        <Text style={styles.convName}>{item.fullName}</Text>
        <Text style={styles.convLastMsg} numberOfLines={1}>
          {[item.department, item.yearLevel].filter(Boolean).join(" · ") ||
            "Student"}
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
            setMsgCtxMsg(item);
            setMsgCtxVisible(true);
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
                } else {
                  router.back();
                }
              }}
            >
              <Ionicons name="arrow-back" size={22} color="white" />
            </Pressable>
            <Text style={styles.headerTitle}>
              {viewMode === "chat"
                ? activeConversation?.type === "peer"
                  ? getPeerName(activeConversation, user!.uid)
                  : activeConversation?.studentName || "Chat"
                : "Messages"}
            </Text>
            {viewMode === "chat" && (
              <View style={styles.headerBadge}>
                <Ionicons
                  name={activeConversation?.type === "peer" ? "people" : "shield-checkmark"}
                  size={10}
                  color="white"
                />
                <Text style={styles.headerBadgeText}>
                  {activeConversation?.type === "peer" ? "Peer" : "Student"}
                </Text>
              </View>
            )}
            {viewMode !== "chat" && <View style={{ width: 40 }} />}
          </View>
        </LinearGradient>

        {/* Content */}
        {viewMode === "inbox" ? (
          loading ? (
            <View style={styles.emptyState}>
              <Ionicons
                name="chatbubbles-outline"
                size={48}
                color="#D1D5DB"
              />
              <Text style={styles.emptyText}>Loading conversations...</Text>
            </View>
          ) : (
            <>
              {/* Filter tabs */}
              <View style={styles.filterTabs}>
                <Pressable
                  style={[
                    styles.filterTab,
                    filterTab === "student" && styles.filterTabActive,
                  ]}
                  onPress={() => setFilterTab("student")}
                >
                  <Ionicons
                    name="person"
                    size={16}
                    color={filterTab === "student" ? "#8A63D2" : "#94A3B8"}
                  />
                  <Text
                    style={[
                      styles.filterTabText,
                      filterTab === "student" && styles.filterTabTextActive,
                    ]}
                  >
                    Students ({conversations.length})
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.filterTab,
                    filterTab === "peer" && styles.filterTabActive,
                  ]}
                  onPress={() => setFilterTab("peer")}
                >
                  <Ionicons
                    name="people"
                    size={16}
                    color={filterTab === "peer" ? "#8A63D2" : "#94A3B8"}
                  />
                  <Text
                    style={[
                      styles.filterTabText,
                      filterTab === "peer" && styles.filterTabTextActive,
                    ]}
                  >
                    Peer Chats ({peerConversations.length})
                  </Text>
                </Pressable>
                {/* Search button */}
                <Pressable
                  style={[styles.filterTab, { marginLeft: "auto" }]}
                  onPress={openSearch}
                >
                  <Ionicons name="search" size={16} color="#8A63D2" />
                  <Text style={[styles.filterTabText, { color: "#8A63D2", fontWeight: "600" }]}>
                    Find
                  </Text>
                </Pressable>
              </View>

              {filterTab === "student" ? (
                conversations.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Ionicons
                      name="chatbubbles-outline"
                      size={48}
                      color="#D1D5DB"
                    />
                    <Text style={styles.emptyTitle}>No conversations yet</Text>
                    <Text style={styles.emptyText}>
                      When students message you, their conversations will appear
                      here. Tap "Find" to search for a student to message.
                    </Text>
                  </View>
                ) : (
                  <FlatList
                    data={conversations}
                    keyExtractor={(item) => item.id}
                    renderItem={renderConversation}
                    contentContainerStyle={styles.convList}
                    showsVerticalScrollIndicator={false}
                  />
                )
              ) : peerConversations.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons
                    name="people-outline"
                    size={48}
                    color="#D1D5DB"
                  />
                  <Text style={styles.emptyTitle}>No peer chats yet</Text>
                  <Text style={styles.emptyText}>
                    Student-to-student conversations will appear here for
                    moderation.
                  </Text>
                </View>
              ) : (
                <FlatList
                  data={peerConversations}
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
                placeholder="Search by name or department..."
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
            {searchInitLoading ? (
              <View style={styles.emptyState}>
                <ActivityIndicator size="large" color="#8A63D2" />
                <Text style={styles.emptyText}>Loading students...</Text>
              </View>
            ) : filteredStudents.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="search-outline" size={48} color="#D1D5DB" />
                <Text style={styles.emptyTitle}>No students found</Text>
                <Text style={styles.emptyText}>
                  {searchQuery
                    ? "Try a different search term."
                    : "No students are registered yet."}
                </Text>
              </View>
            ) : (
              <FlatList
                data={filteredStudents}
                keyExtractor={(item) => item.uid}
                renderItem={renderStudent}
                contentContainerStyle={styles.convList}
                showsVerticalScrollIndicator={false}
              />
            )}
          </>
        ) : (
          <>
            {allMessages.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons
                  name="chatbubble-outline"
                  size={48}
                  color="#D1D5DB"
                />
                <Text style={styles.emptyTitle}>
                  Start the conversation
                </Text>
                <Text style={styles.emptyText}>
                  Send a message to {activeConversation?.studentName}.
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
                  name={showEmoji ? "keyboard" : "happy-outline" as any}
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
                  (!inputText.trim() || sending) &&
                    styles.sendBtnDisabled,
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

      {/* ─── Message Context Menu ───────────────────────────────────── */}
      <Modal
        visible={msgCtxVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMsgCtxVisible(false)}
      >
        <Pressable
          style={styles.ctxOverlay}
          onPress={() => setMsgCtxVisible(false)}
        >
          <View style={styles.ctxMenu}>
            <Text style={styles.ctxTitle}>Message Options</Text>
            <Pressable style={styles.ctxRow} onPress={handleCopyMsg}>
              <Ionicons name="copy-outline" size={20} color="#8A63D2" />
              <Text style={styles.ctxLabel}>Copy</Text>
            </Pressable>
            <View style={styles.ctxDivider} />
            <Pressable style={styles.ctxRow} onPress={handleDeleteMsg}>
              <Ionicons name="trash-outline" size={20} color="#EF4444" />
              <Text style={[styles.ctxLabel, { color: "#EF4444" }]}>
                Delete
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* ─── Conversation Context Menu ──────────────────────────────── */}
      <Modal
        visible={convCtxVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setConvCtxVisible(false)}
      >
        <Pressable
          style={styles.ctxOverlay}
          onPress={() => setConvCtxVisible(false)}
        >
          <View style={styles.ctxMenu}>
            <Text style={styles.ctxTitle}>Conversation Options</Text>
            <Pressable style={styles.ctxRow} onPress={handleDeleteConv}>
              <Ionicons name="trash-outline" size={20} color="#EF4444" />
              <Text style={[styles.ctxLabel, { color: "#EF4444" }]}>
                Delete Conversation
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
  bubbleText: { fontSize: 15, color: "#1E1B4B", lineHeight: 20 },
  bubbleTextMine: { color: "white" },
  bubbleFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 6,
    marginTop: 4,
  },
  bubbleTime: { fontSize: 10, color: "#94A3B8" },
  bubbleTimeMine: { color: "rgba(255,255,255,0.6)" },
  deletedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  deletedText: {
    fontSize: 13,
    color: "#94A3B8",
    fontStyle: "italic",
  },
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
    width: 220,
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
    paddingTop: 8,
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
  filterTabActive: {
    backgroundColor: "#F3EEFF",
    borderColor: "#8A63D2",
  },
  filterTabText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#94A3B8",
  },
  filterTabTextActive: {
    color: "#8A63D2",
    fontWeight: "600",
  },

  // Peer badge
  peerBadge: {
    backgroundColor: "#E9D5FF",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  peerBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#8A63D2",
  },
});
