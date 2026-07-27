/**
 * Student peer-to-peer messaging screen.
 * Features: inbox list, real-time chat, student search, content moderation,
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
import {
  moderateMessage,
  quickModerationCheck,
} from "@/services/contentModeration";

import { useAuth } from "@/hooks/AuthContext";
import {
  deleteMessage,
  getOrCreatePeerConversation,
  getPeerName,
  listenForMessages,
  listenForPeerConversations,
  markAsRead,
  refreshPeerConversationNames,
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

export default function PeerMessagesScreen() {
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

  // Moderation state
  const [moderationError, setModerationError] = useState<string | null>(null);
  const [moderationLoading, setModerationLoading] = useState(false);
  const [flaggedModal, setFlaggedModal] = useState(false);
  const [flaggedText, setFlaggedText] = useState("");

  // Student search
  const [students, setStudents] = useState<StudentSearchResult[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);

  // Inbox-level search
  const [inboxSearchQuery, setInboxSearchQuery] = useState("");

  // Merge Firestore messages with optimistic ones
  const allMessages: OptimisticMessage[] = [
    ...messages,
    ...optimistic.filter((o) => !messages.some((m) => m.id === o.id)),
  ];

  // Filtered conversations for inbox search
  const filteredConversations = inboxSearchQuery.trim()
    ? conversations.filter((c) => {
        const name = getPeerName(c, user!.uid).toLowerCase();
        return name.includes(inboxSearchQuery.toLowerCase());
      })
    : conversations;

  // Listen for peer conversations
  useEffect(() => {
    if (!user?.uid) return;
    const unsub = listenForPeerConversations(user.uid, (convs) => {
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

  // Real-time moderation check while typing
  useEffect(() => {
    if (!inputText.trim()) {
      setModerationError(null);
      return;
    }
    const result = quickModerationCheck(inputText);
    if (result.status === "blocked") {
      setModerationError(
        result.reason || "This message contains restricted content.",
      );
    } else {
      setModerationError(null);
    }
  }, [inputText]);

  const [headerName, setHeaderName] = useState<string>("");

  const openChat = async (conversation: Conversation) => {
    setActiveConversation(conversation);
    setViewMode("chat");
    setModerationError(null);

    // Fetch fresh names from DB
    if (conversation.participants && user?.uid) {
      try {
        const freshNames = await refreshPeerConversationNames(
          conversation.id,
          conversation.participants,
        );
        const otherUid = conversation.participants.find(
          (uid) => uid !== user!.uid,
        );
        if (otherUid && freshNames[otherUid]) {
          setHeaderName(freshNames[otherUid]);
          // Update the conversation object with fresh names
          setActiveConversation((prev) =>
            prev ? { ...prev, participantNames: freshNames } : prev,
          );
        }
      } catch {
        // Use cached name on error
        setHeaderName(getPeerName(conversation, user!.uid));
      }
    }
  };

  // Debounced search query
  useEffect(() => {
    if (viewMode !== "search") return;

    const handler = setTimeout(async () => {
      setSearchLoading(true);
      const results = await searchUsers(user!.uid, "student", searchQuery, "users");
      setStudents(results);
      setSearchLoading(false);
    }, 300); // Debounce for 300ms

    return () => clearTimeout(handler);
  }, [searchQuery, viewMode, user]);

  const openSearch = async () => {
    setViewMode("search");
  };

  const startConversation = async (student: StudentSearchResult) => {
    try {
      const myName = user?.displayName || "Student";
      const convId = await getOrCreatePeerConversation(
        user!.uid,
        student.uid,
        myName || "Student",
        student.fullName,
      );

      // Find or create the conversation object
      const existing = conversations.find((c) => c.id === convId);
      if (existing) {
        openChat(existing);
      } else {
        // Create a temporary conversation object
        const tempConv: Conversation = {
          id: convId,
          studentId: "",
          adminId: "",
          studentName: "",
          adminName: "",
          lastMessage: "",
          lastMessageAt: Date.now(),
          unreadBy: [],
          type: "peer",
          participants: [user!.uid, student.uid],
          participantNames: {
            [user!.uid]: myName || "Student",
            [student.uid]: student.fullName,
          },
        };
        setActiveConversation(tempConv);
        setViewMode("chat");
        setModerationError(null);
      }
    } catch (err) {
      console.error("Failed to start conversation:", err);
    }
  };

  // ─── Send with moderation + optimistic UI ──────────────────────────────────
  const handleSend = useCallback(async () => {
    if (!inputText.trim() || !activeConversation || !user?.uid || sending)
      return;

    const text = inputText.trim();
    setModerationLoading(true);
    setModerationError(null);

    try {
      // Run full moderation (blocklist + AI)
      const modResult = await moderateMessage(text);

      if (modResult.status === "blocked") {
        setModerationError(
          modResult.reason || "This message contains restricted content.",
        );
        setModerationLoading(false);
        return;
      }

      if (modResult.status === "flagged") {
        // Show confirmation modal
        setFlaggedText(text);
        setFlaggedModal(true);
        setModerationLoading(false);
        return;
      }

      // Safe — send normally
      await sendWithStatus(text, "safe");
    } catch (err) {
      console.error("Moderation failed:", err);
      // Fail open — send anyway
      await sendWithStatus(text, "safe");
    } finally {
      setModerationLoading(false);
    }
  }, [inputText, activeConversation, user?.uid, sending]);

  const sendWithStatus = async (
    text: string,
    moderationStatus: "safe" | "flagged" | "blocked",
  ) => {
    if (!activeConversation || !user?.uid) return;

    const tempId = `temp_${Date.now()}`;
    setInputText("");
    setModerationError(null);

    const optMsg: OptimisticMessage = {
      id: tempId,
      senderId: user.uid,
      text,
      createdAt: Date.now(),
      isAdmin: false,
      senderRole: "student",
      moderationStatus,
      failed: false,
    };
    setOptimistic((prev) => [...prev, optMsg]);
    setSending(true);

    try {
      const realId = await sendMsg(
        activeConversation.id,
        text,
        user.uid,
        false,
        moderationStatus,
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
  };

  const handleFlaggedConfirm = async () => {
    setFlaggedModal(false);
    await sendWithStatus(flaggedText, "flagged");
    setFlaggedText("");
  };

  // ─── Retry failed message ──────────────────────────────────────────────────
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
          msg.moderationStatus,
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

  // ─── Message context menu ──────────────────────────────────────────────────
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

  // ─── Conversation context menu ─────────────────────────────────────────────
  const handleDeleteConv = async () => {
    if (!convCtxConv) return;
    setConvCtxVisible(false);

    const peerName = getPeerName(convCtxConv, user!.uid);
    Alert.alert(
      "Delete Conversation",
      `Are you sure you want to delete your conversation with ${peerName}? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const { deleteConversation } =
                await import("@/services/messagingService");
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

  // ─── Inbox: Conversation row ───────────────────────────────────────────────
  const renderConversation = ({ item }: { item: Conversation }) => {
    const hasUnread = item.unreadBy?.includes(user?.uid || "");
    const peerName = getPeerName(item, user!.uid);

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
          <Ionicons name="person" size={22} color="#8A63D2" />
        </View>
        <View style={styles.convInfo}>
          <View style={styles.convTop}>
            <Text style={[styles.convName, hasUnread && styles.convNameBold]}>
              {peerName}
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

  // ─── Chat: Message bubble ──────────────────────────────────────────────────
  const renderMessage = ({ item }: { item: OptimisticMessage }) => {
    const isMine = item.senderId === user?.uid;
    const isDeleted = item.deleted;
    const isFailed = item.failed;
    const isFlagged = item.moderationStatus === "flagged";

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
        <View style={styles.bubbleWrapper}>
          {!isMine && (
            <Text style={styles.senderLabel}>
              {activeConversation
                ? getPeerName(activeConversation, user!.uid)
                : "Student"}
            </Text>
          )}
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
                  style={[styles.deletedText, isMine && styles.deletedTextMine]}
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
              {isFlagged && (
                <Ionicons
                  name="warning"
                  size={12}
                  color={isMine ? "rgba(255,255,255,0.7)" : "#F59E0B"}
                />
              )}
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
        </View>
      </Pressable>
    );
  };

  // ─── Search: Student row ───────────────────────────────────────────────────
  const renderStudent = ({ item }: { item: StudentSearchResult }) => (
    <Pressable style={styles.convRow} onPress={() => startConversation(item)}>
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

  // ─── Header title ──────────────────────────────────────────────────────────
  const headerTitle =
    viewMode === "chat"
      ? headerName ||
        (activeConversation
          ? getPeerName(activeConversation, user!.uid)
          : "Chat")
      : viewMode === "search"
        ? "Find Students"
        : "Student Chat";

  const headerSubtitle =
    viewMode === "chat" ? "Peer" : viewMode === "search" ? null : "Students";

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
                  setModerationError(null);
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
            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle}>{headerTitle}</Text>
              {headerSubtitle && (
                <View style={styles.headerBadge}>
                  <Ionicons
                    name={viewMode === "chat" ? "people" : "people-outline"}
                    size={10}
                    color="white"
                  />
                  <Text style={styles.headerBadgeText}>{headerSubtitle}</Text>
                </View>
              )}
            </View>
            {viewMode === "inbox" && (
              <Pressable style={styles.backBtn} onPress={openSearch}>
                <Ionicons name="person-add" size={20} color="white" />
              </Pressable>
            )}
            {viewMode !== "inbox" && <View style={{ width: 40 }} />}
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
              <Ionicons name="people-outline" size={48} color="#D1D5DB" />
              <Text style={styles.emptyTitle}>No conversations yet</Text>
              <Text style={styles.emptyText}>
                Tap the + button to find students and start chatting.
              </Text>
              <Pressable style={styles.findBtn} onPress={openSearch}>
                <Ionicons name="person-add" size={18} color="white" />
                <Text style={styles.findBtnText}>Find Students</Text>
              </Pressable>
            </View>
          ) : (
            <>
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
              <Pressable style={styles.fab} onPress={openSearch}>
                <Ionicons name="add" size={28} color="white" />
              </Pressable>
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
            {searchLoading ? (
              <View style={styles.emptyState}>
                <ActivityIndicator size="large" color="#8A63D2" />
                <Text style={styles.emptyText}>Loading students...</Text>
              </View>            ) : students.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="search-outline" size={48} color="#D1D5DB" />
                <Text style={styles.emptyTitle}>
                  {searchQuery ? "No students found" : "Find a Student"}
                </Text>
                <Text style={styles.emptyText}>
                  {searchQuery
                    ? "Try a different search term."
                    : "Start typing a name or department to find someone to chat with."}
                </Text>
              </View>
            ) : (
              <FlatList
                data={students}
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
                <Ionicons name="chatbubble-outline" size={48} color="#D1D5DB" />
                <Text style={styles.emptyTitle}>Start the conversation</Text>
                <Text style={styles.emptyText}>
                  Send a message to{" "}
                  {activeConversation
                    ? getPeerName(activeConversation, user!.uid)
                    : "this student"}
                  .
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

            {/* Moderation error banner */}
            {moderationError && (
              <View style={styles.moderationBanner}>
                <Ionicons name="warning" size={16} color="#EF4444" />
                <Text style={styles.moderationText}>{moderationError}</Text>
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
                  (!inputText.trim() ||
                    sending ||
                    moderationLoading ||
                    !!moderationError) &&
                    styles.sendBtnDisabled,
                ]}
                onPress={handleSend}
                disabled={
                  !inputText.trim() ||
                  sending ||
                  moderationLoading ||
                  !!moderationError
                }
              >
                {moderationLoading ? (
                  <ActivityIndicator size={24} color="#8A63D2" />
                ) : (
                  <Ionicons
                    name="arrow-up-circle"
                    size={32}
                    color={
                      inputText.trim() && !moderationError
                        ? "#8A63D2"
                        : "#D1D5DB"
                    }
                  />
                )}
              </Pressable>
            </View>
          </>
        )}
      </KeyboardAvoidingView>

      {/* ─── Message Context Menu ─────────────────────────────────────── */}
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

      {/* ─── Conversation Context Menu ────────────────────────────────── */}
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

      {/* ─── Flagged Message Confirmation ──────────────────────────────── */}
      <Modal
        visible={flaggedModal}
        transparent
        animationType="fade"
        onRequestClose={() => setFlaggedModal(false)}
      >
        <Pressable
          style={styles.ctxOverlay}
          onPress={() => setFlaggedModal(false)}
        >
          <View style={styles.flaggedModal}>
            <View style={styles.flaggedIcon}>
              <Ionicons name="warning" size={32} color="#F59E0B" />
            </View>
            <Text style={styles.flaggedTitle}>Message Flagged</Text>
            <Text style={styles.flaggedDesc}>
              This message may contain inappropriate content. Are you sure you
              want to send it?
            </Text>
            <Text style={styles.flaggedPreview} numberOfLines={3}>
              "{flaggedText}"
            </Text>
            <View style={styles.flaggedActions}>
              <Pressable
                style={styles.flaggedCancel}
                onPress={() => {
                  setFlaggedModal(false);
                  setFlaggedText("");
                }}
              >
                <Text style={styles.flaggedCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={styles.flaggedConfirm}
                onPress={handleFlaggedConfirm}
              >
                <Text style={styles.flaggedConfirmText}>Send Anyway</Text>
              </Pressable>
            </View>
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
    marginTop: 3,
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

  // FAB
  fab: {
    position: "absolute",
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#8A63D2",
    justifyContent: "center",
    alignItems: "center",
    // @ts-ignore
    boxShadow: "0px 4px 12px rgba(138, 99, 210, 0.4)",
  },

  // Conversation list
  convList: { paddingVertical: 8, paddingHorizontal: 16 },
  convRow: {
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
  convAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#F3EEFF",
    justifyContent: "center",
    alignItems: "center",
  },
  convInfo: { flex: 1 },
  convTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 3,
  },
  convName: { fontSize: 15, fontWeight: "600", color: "#1E1B4B" },
  convNameBold: { fontWeight: "800" },
  convTime: { fontSize: 11, color: "#94A3B8" },
  convLastMsg: { fontSize: 13, color: "#64748B" },
  convLastMsgBold: { fontWeight: "600", color: "#1E1B4B" },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#8A63D2",
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

  // Messages
  messagesList: {
    flexGrow: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  bubbleRow: { marginBottom: 8, flexDirection: "row" },
  bubbleRowRight: { justifyContent: "flex-end" },
  bubbleRowLeft: { justifyContent: "flex-start" },
  bubbleWrapper: {
    maxWidth: "78%",
    gap: 2,
  },
  senderLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#8A63D2",
    marginLeft: 12,
    marginBottom: 2,
  },
  bubble: {
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
  bubbleTimeMine: { color: "rgba(255,255,255,0.6)" },
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

  // Moderation banner
  moderationBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FEF2F2",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(239, 68, 68, 0.1)",
  },
  moderationText: { fontSize: 13, color: "#EF4444", flex: 1 },

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

  // Flagged modal
  flaggedModal: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 24,
    width: "85%",
    maxWidth: 360,
    alignItems: "center",
    // @ts-ignore
    boxShadow: "0px 8px 24px rgba(0,0,0,0.15)",
  },
  flaggedIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#FEF3C7",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  flaggedTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1E1B4B",
    marginBottom: 6,
  },
  flaggedDesc: {
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
    marginBottom: 12,
  },
  flaggedPreview: {
    fontSize: 13,
    color: "#94A3B8",
    fontStyle: "italic",
    textAlign: "center",
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  flaggedActions: {
    flexDirection: "row",
    gap: 10,
    width: "100%",
  },
  flaggedCancel: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
  },
  flaggedCancelText: { fontSize: 15, fontWeight: "600", color: "#64748B" },
  flaggedConfirm: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: "#F59E0B",
    alignItems: "center",
  },
  flaggedConfirmText: { fontSize: 15, fontWeight: "600", color: "white" },
});
