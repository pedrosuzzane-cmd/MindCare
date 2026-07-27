/**
 * Admin messaging screen — tabbed user directory (Students / Admins) + chat room.
 * Tapping any user initializes or opens a conversation via messagingService.
 * Chat view features: friendly reminder banner, phone-style bubbles,
 * optimistic send, failed message retry, long-press delete/copy, emoji picker.
 */

import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Clipboard,
  FlatList,
  Image,
  Keyboard,
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
import { useSafeAreaInsets } from "react-native-safe-area-context";

import EmojiPicker from "@/components/chat/EmojiPicker";

import { useAuth } from "@/hooks/AuthContext";
import {
  deleteConversation,
  deleteMessage,
  fetchAllUsers,
  getOrCreateConversation,
  listenForMessages,
  markAsRead,
  sendMessage as sendMsg,
  startTyping,
  listenForTyping,
} from "@/services/messagingService";
import {
  setUserOnline,
  setUserOffline,
  listenForPresence,
} from "@/services/presenceService";
import type {
  Conversation,
  Message,
  OptimisticMessage,
  StudentSearchResult,
} from "@/types/messaging";

type ViewMode = "directory" | "chat";
type DirectoryTab = "students" | "admins";

const REMINDER_BANNER =
  "Friendly Reminder: Please keep conversations respectful, supportive, and kind.";

export default function AdminMessagesScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  // ── View state ──
  const [viewMode, setViewMode] = useState<ViewMode>("directory");
  const [directoryTab, setDirectoryTab] = useState<DirectoryTab>("students");

  // ── Directory state ──
  const [students, setStudents] = useState<StudentSearchResult[]>([]);
  const [admins, setAdmins] = useState<StudentSearchResult[]>([]);
  const [directoryLoading, setDirectoryLoading] = useState(true);
  const [directoryFilter, setDirectoryFilter] = useState("");

  // ── Chat state ──
  const [activeConversation, setActiveConversation] =
    useState<Conversation | null>(null);
  const [chatPartnerName, setChatPartnerName] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [optimistic, setOptimistic] = useState<OptimisticMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [chatLoading, setChatLoading] = useState(true);
  const flatListRef = useRef<FlatList>(null);

  const scrollToBottom = useCallback((animated = true) => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated });
    }, 50);
  }, []);

  // ── Context menu state ──
  const [contextVisible, setContextVisible] = useState(false);
  const [contextMsg, setContextMsg] = useState<Message | null>(null);
  const [showEmoji, setShowEmoji] = useState(false);

  // ── Presence state ──
  const [partnerOnline, setPartnerOnline] = useState(false);

  // ── Typing state ──
  const [partnerTyping, setPartnerTyping] = useState(false);

  // ── Merge Firestore messages with optimistic ones ──
  const allMessages: OptimisticMessage[] = [
    ...messages,
    ...optimistic.filter((o) => !messages.some((m) => m.id === o.id)),
  ];

  // ── Filtered directory lists ──
  const filteredStudents = directoryFilter.trim()
    ? students.filter(
        (s) =>
          s.fullName.toLowerCase().includes(directoryFilter.toLowerCase()) ||
          (s.department || "").toLowerCase().includes(directoryFilter.toLowerCase()),
      )
    : students;

  const filteredAdmins = directoryFilter.trim()
    ? admins.filter(
        (a) =>
          a.fullName.toLowerCase().includes(directoryFilter.toLowerCase()) ||
          (a.department || "").toLowerCase().includes(directoryFilter.toLowerCase()),
      )
    : admins;

  // ── Fetch users for directory ──
  useEffect(() => {
    if (viewMode !== "directory" || !user?.uid) return;

    let cancelled = false;

    async function load() {
      setDirectoryLoading(true);
      const [studentList, adminList] = await Promise.all([
        fetchAllUsers(user!.uid, "users"),
        fetchAllUsers(user!.uid, "admins"),
      ]);
      if (!cancelled) {
        setStudents(studentList);
        setAdmins(adminList);
        setDirectoryLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [viewMode, user?.uid]);

  // ── Listen for messages when in chat view ──
  useEffect(() => {
    if (!activeConversation?.id) return;

    const unsub = listenForMessages(activeConversation.id, (msgs) => {
      setMessages(msgs);
      setChatLoading(false);
      markAsRead(activeConversation.id, user!.uid);
      setOptimistic((prev) =>
        prev.filter((o) => !msgs.some((m) => m.id === o.id)),
      );
      scrollToBottom(false);
    });

    return () => unsub();
  }, [activeConversation?.id, user?.uid]);

  // ── Set self as online on mount, offline on unmount ──
  useEffect(() => {
    if (!user?.uid) return;
    setUserOnline(user.uid);
    return () => {
      setUserOffline(user.uid);
    };
  }, [user?.uid]);

  // ── Listen for partner presence ──
  useEffect(() => {
    if (!activeConversation?.studentId || !user?.uid) return;
    const partnerUid = activeConversation.studentId;

    const unsub = listenForPresence(partnerUid, (online) => {
      setPartnerOnline(online);
    });
    return () => unsub();
  }, [activeConversation?.id, activeConversation?.studentId, user?.uid]);

  // ── Listen for partner typing ──
  useEffect(() => {
    if (!activeConversation?.id || !user?.uid) return;

    const unsub = listenForTyping(activeConversation.id, user.uid, (typing) => {
      setPartnerTyping(typing);
    });
    return () => unsub();
  }, [activeConversation?.id, user?.uid]);
  // ── Open a chat from directory card tap ──
  const startChat = async (item: StudentSearchResult) => {
    try {
      const adminName = user?.displayName || "Guidance Counselor";
      const convId = await getOrCreateConversation(
        item.uid,
        user!.uid,
        item.fullName,
        adminName,
      );

      setActiveConversation({
        id: convId,
        studentId: item.uid,
        adminId: user!.uid,
        studentName: item.fullName,
        adminName,
        lastMessage: "",
        lastMessageAt: Date.now(),
        unreadBy: [],
      });
      setChatPartnerName(item.fullName);
      setMessages([]);
      setOptimistic([]);
      setChatLoading(true);
      setViewMode("chat");
    } catch (err) {
      console.error("Failed to start conversation:", err);
      Alert.alert(
        "Could not start chat",
        "Something went wrong opening this conversation. Please try again.",
      );
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
      isAdmin: true,
      failed: false,
    };
    setOptimistic((prev) => [...prev, optMsg]);
    setSending(true);

    try {
      const realId = await sendMsg(activeConversation.id, text, user.uid, true);
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

  // ─── Back handler ────────────────────────────────────────────────────────
  const handleBack = () => {
    if (viewMode === "chat") {
      setViewMode("directory");
      setActiveConversation(null);
      setMessages([]);
      setOptimistic([]);
    } else {
      router.back();
    }
  };

  // ─── Directory: User card row ────────────────────────────────────────────
  const renderUserCard = ({
    item,
    isStudent,
  }: {
    item: StudentSearchResult;
    isStudent: boolean;
  }) => (
    <Pressable style={styles.userCard} onPress={() => startChat(item)}>
      <View
        style={[
          styles.userAvatar,
          isStudent ? styles.userAvatarStudent : styles.userAvatarAdmin,
        ]}
      >
        {item.profileImage ? (
          <Image source={{ uri: item.profileImage }} style={{ width: 44, height: 44, borderRadius: 22 }} />
        ) : (
          <Ionicons
            name={isStudent ? "person" : "shield-checkmark"}
            size={22}
            color={isStudent ? "#8A63D2" : "#6D5BBF"}
          />
        )}
      </View>
      <View style={styles.userInfo}>
        <Text style={styles.userName} numberOfLines={1}>
          {item.fullName}
        </Text>
        <Text style={styles.userRole} numberOfLines={1}>
          {item.department || (isStudent ? "Student" : "Counselor")}
          {item.yearLevel ? ` \u00B7 ${item.yearLevel}` : ""}
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

  // ─── Directory tabs ──────────────────────────────────────────────────────
  const currentList =
    directoryTab === "students" ? filteredStudents : filteredAdmins;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        {/* Header */}
        <LinearGradient
          colors={["#8A63D2", "#B794F6"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.header}>
            <Pressable style={styles.backBtn} onPress={handleBack}>
              <Ionicons name="arrow-back" size={22} color="white" />
            </Pressable>
            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle}>
                {viewMode === "chat"
                  ? chatPartnerName || "Chat"
                  : "Messages"}
              </Text>
              {viewMode === "chat" && (
                <View style={styles.headerMeta}>
                  <View style={styles.headerBadge}>
                    <Ionicons name="chatbubble" size={10} color="white" />
                    <Text style={styles.headerBadgeText}>Chat</Text>
                  </View>
                  <View style={styles.onlineIndicator}>
                    <View
                      style={[
                        styles.onlineDot,
                        partnerOnline ? styles.onlineDotActive : styles.onlineDotInactive,
                      ]}
                    />
                    <Text style={styles.onlineText}>
                      {partnerOnline ? "Online" : "Offline"}
                    </Text>
                  </View>
                </View>
              )}
            </View>
            <View style={{ width: 40 }} />
          </View>
        </LinearGradient>

        {/* Content */}
        {viewMode === "directory" ? (
          <>
            {/* Directory filter */}
            <View style={styles.searchBar}>
              <Ionicons name="search" size={18} color="#94A3B8" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by name or department..."
                placeholderTextColor="#94A3B8"
                value={directoryFilter}
                onChangeText={setDirectoryFilter}
              />
              {directoryFilter.length > 0 && (
                <Pressable onPress={() => setDirectoryFilter("")}>
                  <Ionicons name="close-circle" size={18} color="#94A3B8" />
                </Pressable>
              )}
            </View>

            {/* Tab switch */}
            <View style={styles.tabBar}>
              <Pressable
                style={[
                  styles.tab,
                  directoryTab === "students" && styles.tabActive,
                ]}
                onPress={() => {
                  setDirectoryTab("students");
                  setDirectoryFilter("");
                }}
              >
                <Ionicons
                  name="people"
                  size={16}
                  color={directoryTab === "students" ? "#8A63D2" : "#94A3B8"}
                />
                <Text
                  style={[
                    styles.tabText,
                    directoryTab === "students" && styles.tabTextActive,
                  ]}
                >
                  Students
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.tab,
                  directoryTab === "admins" && styles.tabActive,
                ]}
                onPress={() => {
                  setDirectoryTab("admins");
                  setDirectoryFilter("");
                }}
              >
                <Ionicons
                  name="shield-checkmark"
                  size={16}
                  color={directoryTab === "admins" ? "#8A63D2" : "#94A3B8"}
                />
                <Text
                  style={[
                    styles.tabText,
                    directoryTab === "admins" && styles.tabTextActive,
                  ]}
                >
                  Admins
                </Text>
              </Pressable>
            </View>

            {/* User list */}
            {directoryLoading ? (
              <View style={styles.emptyState}>
                <ActivityIndicator size="large" color="#8A63D2" />
                <Text style={styles.emptyText}>Loading users...</Text>
              </View>
            ) : currentList.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons
                  name={
                    directoryTab === "students"
                      ? "people-outline"
                      : "shield-checkmark-outline"
                  }
                  size={48}
                  color="#D1D5DB"
                />
                <Text style={styles.emptyTitle}>
                  {directoryFilter
                    ? "No users found"
                    : directoryTab === "students"
                      ? "No students yet"
                      : "No other admins yet"}
                </Text>
                <Text style={styles.emptyText}>
                  {directoryFilter
                    ? "Try a different search term."
                    : directoryTab === "students"
                      ? "Students will appear here once they register."
                      : "Other counselors will appear here once they join."}
                </Text>
              </View>
            ) : (
              <FlatList
                data={currentList}
                keyExtractor={(item) => item.uid}
                renderItem={({ item }) => (
                  <RenderUserCardRow
                    item={item}
                    isStudent={directoryTab === "students"}
                  />
                )}
                contentContainerStyle={styles.userList}
                showsVerticalScrollIndicator={false}
              />
            )}
          </>
        ) : (
          /* ── Chat View ── */
          <>
            {/* Friendly reminder banner */}
            <View style={styles.reminderBanner}>
              <Ionicons name="heart-outline" size={14} color="#6D5BBF" />
              <Text style={styles.reminderText}>{REMINDER_BANNER}</Text>
            </View>

            {chatLoading ? (
              <View style={styles.emptyState}>
                <ActivityIndicator size="large" color="#8A63D2" />
                <Text style={styles.emptyText}>Loading conversation...</Text>
              </View>
            ) : allMessages.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="chatbubble-outline" size={48} color="#D1D5DB" />
                <Text style={styles.emptyTitle}>Start the conversation</Text>
                <Text style={styles.emptyText}>
                  Send a message to {chatPartnerName}.
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
                onContentSizeChange={() => scrollToBottom(false)}
              />
            )}

            {/* Typing indicator */}
            {partnerTyping && (
              <View style={styles.typingIndicator}>
                <Text style={styles.typingText}>{chatPartnerName} is typing</Text>
                <ActivityIndicator size="small" color="#8A63D2" style={{ marginLeft: 6 }} />
              </View>
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
            <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
              <Pressable
                style={styles.emojiBtn}
                onPress={() => {
                  Keyboard.dismiss();
                  setShowEmoji((v) => !v);
                }}
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
                onChangeText={(text) => {
                  setInputText(text);
                  if (activeConversation?.id && user?.uid) {
                    if (text.trim()) {
                      startTyping(activeConversation.id, user.uid);
                    }
                  }
                }}
                multiline
                maxLength={1000}
                onFocus={() => {
                  setShowEmoji(false);
                  scrollToBottom(true);
                }}
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

  // Separate component to pass isStudent prop to renderItem
  function RenderUserCardRow({
    item,
    isStudent,
  }: {
    item: StudentSearchResult;
    isStudent: boolean;
  }) {
    return renderUserCard({ item, isStudent });
  }
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
  headerCenter: {
    flex: 1,
    alignItems: "center",
  },
  headerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.25)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    alignSelf: "center",
  },
  headerBadgeText: {
    fontSize: 10,
    fontWeight: "600",
    color: "white",
  },
  headerMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 3,
    alignSelf: "center",
  },
  onlineIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  onlineDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  onlineDotActive: {
    backgroundColor: "#4ADE80",
  },
  onlineDotInactive: {
    backgroundColor: "rgba(255,255,255,0.4)",
  },
  onlineText: {
    fontSize: 10,
    fontWeight: "500",
    color: "rgba(255,255,255,0.75)",
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

  // Search bar
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

  // Tabs
  tabBar: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 8,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "rgba(156, 126, 235, 0.1)",
  },
  tabActive: {
    backgroundColor: "#F3EEFF",
    borderColor: "#8A63D2",
  },
  tabText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#94A3B8",
  },
  tabTextActive: {
    color: "#8A63D2",
    fontWeight: "600",
  },

  // User list
  userList: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    borderRadius: 16,
    padding: 14,
    marginBottom: 8,
    // @ts-ignore
    boxShadow: "0px 2px 8px rgba(138, 99, 210, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(156, 126, 235, 0.06)",
    gap: 12,
  },
  userAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: "center",
    alignItems: "center",
  },
  userAvatarStudent: { backgroundColor: "#F3EEFF" },
  userAvatarAdmin: { backgroundColor: "#EDE9FE" },
  userInfo: { flex: 1 },
  userName: { fontSize: 15, fontWeight: "600", color: "#1E1B4B" },
  userRole: { fontSize: 13, color: "#64748B", marginTop: 2 },

  // Reminder banner
  reminderBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F3EEFF",
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(138, 99, 210, 0.12)",
  },
  reminderText: {
    flex: 1,
    fontSize: 12,
    color: "#6D5BBF",
    lineHeight: 17,
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

  // Typing indicator
  typingIndicator: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 6,
    backgroundColor: "#F8F5FF",
  },
  typingText: {
    fontSize: 12,
    color: "#8A63D2",
    fontStyle: "italic",
  },

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
