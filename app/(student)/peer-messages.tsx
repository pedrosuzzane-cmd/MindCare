/**
 * Student peer-to-peer messaging screen.
 * Features: inbox list, real-time chat, student search, content moderation,
 * optimistic send, failed message retry, long-press delete/copy, emoji picker.
 */

import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Clipboard,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMindCareTheme } from "@/contexts/ThemeContext";
import type { MindCareTheme } from "@/constants/theme";

import EmojiPicker from "@/components/chat/EmojiPicker";
import {
  moderateMessage,
  quickModerationCheck,
} from "@/services/contentModeration";

import { useAuth } from "@/hooks/AuthContext";
import { useStudentProfile } from "@/hooks/useStudentProfile";
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
import {
  setUserOnline,
  setUserOffline,
  listenForPresence,
} from "@/services/presenceService";

type ViewMode = "inbox" | "chat" | "search";

export default function PeerMessagesScreen() {
  const { user } = useAuth();
  const { theme } = useMindCareTheme();
  const styles = createStyles(theme);
  const currentUserUid = user?.uid;
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

  const scrollToBottom = useCallback((animated = true) => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated });
    }, 50);
  }, []);

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

  // Filtered conversations for inbox search
  const filteredConversations = inboxSearchQuery.trim()
    ? conversations.filter((c) => {
        if (!currentUserUid) return false;
        const name = getPeerName(c, currentUserUid).toLowerCase();
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
    return unsub;
  }, [user?.uid]);

  // Set self as online on mount, offline on unmount
  useEffect(() => {
    if (!user?.uid) return;
    setUserOnline(user.uid);
    return () => {
      setUserOffline(user.uid);
    };
  }, [user]);

  // Listen for presence of conversation partners
  useEffect(() => {
    if (conversations.length === 0 || !user?.uid) return;

    const unsubs = conversations.map((conv) => {
      const peerUid = conv.participants?.find((p) => p !== user.uid);
      if (!peerUid) return () => {};
      return listenForPresence(peerUid, (online) => {
        setPresenceMap((prev) => ({ ...prev, [peerUid]: online }));
      });
    });

    return () => unsubs.forEach((unsub) => unsub());
  }, [conversations, user]);

  // Listen for messages when in chat view
  useEffect(() => {
    if (!activeConversation?.id) return;

    const unsub = listenForMessages(activeConversation.id, (msgs) => {
      setMessages(msgs);
      markAsRead(activeConversation.id, user!.uid);
      setOptimistic((prev) =>
        prev.filter((o) => !msgs.some((m) => m.id === o.id)),
      );
      scrollToBottom(false);
    });

    return () => unsub();
  }, [activeConversation?.id, user, scrollToBottom]);

  // Real-time moderation check while typing
  const moderationResult = useMemo(() => {
    const text = inputText.trim();
    if (!text) return null;
    return quickModerationCheck(text);
  }, [inputText]);

  const currentModerationError =
    moderationResult?.status === "blocked"
      ? moderationResult.reason || "This message contains restricted content."
      : null;

  const [headerName, setHeaderName] = useState<string>("");

  const openChat = useCallback(async (conversation: Conversation) => {
    setActiveConversation(conversation);
    setViewMode("chat");
    setModerationError(null);

    // Fetch fresh names from DB
    if (conversation.participants && currentUserUid) {
      try {
        const freshNames = await refreshPeerConversationNames(
          conversation.id,
          conversation.participants,
        );
        const otherUid = conversation.participants.find(
          (uid) => uid !== currentUserUid,
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
        setHeaderName(getPeerName(conversation, currentUserUid));
      }
    }
  }, [currentUserUid]);

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
  }, [searchQuery, viewMode, user, currentUserUid]);

  const openSearch = async () => {
    setViewMode("search");
  };

  const startConversation = useCallback(async (student: StudentSearchResult) => {
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
          lastMessage: "",
          lastMessageAt: Date.now(),
          unreadBy: [],
          type: "peer",
          participants: [currentUserUid!, student.uid],
          participantNames: {
            [currentUserUid!]: myName || "Student",
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
  }, [conversations, currentUserUid, openChat, user?.displayName]);
 const sendWithStatus = useCallback(
    async (
      text: string,
      moderationStatus: "safe" | "flagged" | "blocked",
    ) => {
      if (!activeConversation || !currentUserUid) return;

      const tempId = `temp_${Date.now()}`;
      setInputText("");
      setModerationError(null);

      const optMsg: OptimisticMessage = {
        id: tempId,
        senderId: currentUserUid,
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
        await sendMsg(
          activeConversation.id,
          text,
          currentUserUid,
          false,
          moderationStatus,
        );
      } catch (err) {
        console.error("Failed to send:", err);
        setOptimistic((prev) =>
          prev.map((m) => (m.id === tempId ? { ...m, failed: true } : m)),
        );
      } finally {
        setSending(false);
      }
    },
    [activeConversation, currentUserUid],
  );

  // ─── Send with moderation + optimistic UI ──────────────────────────────────
  const handleSend = useCallback(async () => {
    if (!inputText.trim() || !activeConversation || !currentUserUid || sending)
      return;

    const text = inputText.trim();
    setModerationLoading(true);

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
  }, [
    inputText,
    activeConversation,
    currentUserUid,
    sending,
    sendWithStatus,
  ]);

  const handleFlaggedConfirm = async () => {
    setFlaggedModal(false);
    await sendWithStatus(flaggedText, "flagged");
    setFlaggedText("");
  };

  // ─── Retry failed message ──────────────────────────────────────────────────
  const handleRetry = useCallback(
    async (msg: OptimisticMessage) => {
      if (!activeConversation || !currentUserUid) return;

      setOptimistic((prev) =>
        prev.map((m) => (m.id === msg.id ? { ...m, failed: false } : m)),
      );

      try {
        const realId = await sendMsg(
          activeConversation.id,
          msg.text,
          currentUserUid,
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
    [activeConversation, currentUserUid],
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
      "Delete Conversation?",
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
    const hasUnread = item.unreadBy?.includes(currentUserUid || "");
    const peerName = getPeerName(item, currentUserUid || "");

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
        <View style={styles.convAvatarWrapper}>
          <View style={styles.convAvatar}>
            <Ionicons name="person" size={22} color={theme.primary} />
          </View>
          {(() => {
            const peerUid = item.participants?.find((p) => p !== currentUserUid);
            const isOnline = peerUid ? presenceMap[peerUid] : false;
            return (
              <View
                style={[
                  styles.convPresenceDot,
                  isOnline ? styles.convPresenceDotOnline : styles.convPresenceDotOffline,
                ]}
              />
            );
          })()}
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
    const isMine = item.senderId === currentUserUid;
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
                ? getPeerName(activeConversation, currentUserUid || "")
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
                  color={isMine ? "rgba(255,255,255,0.5)" : theme.secondaryText}
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
                  color={isMine ? "rgba(255,255,255,0.7)" : theme.status.warning}
                />
              )}
              {isFailed && (
                <Pressable
                  style={styles.retryBtn}
                  onPress={() => handleRetry(item)}
                >
                  <Ionicons name="refresh" size={12} color={theme.status.error} />
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
        {item.profileImage ? (
          <Image source={{ uri: item.profileImage }} style={{ width: 44, height: 44, borderRadius: 22 }} />
        ) : (
          <Ionicons name="person" size={22} color={theme.primary} />
        )}
      </View>
      <View style={styles.convInfo}>
        <Text style={styles.convName}>{item.fullName}</Text>
        <Text style={styles.convLastMsg} numberOfLines={1}>
          {[item.department, item.yearLevel].filter(Boolean).join(" · ") ||
            "Student"}
        </Text>
      </View>
      <Ionicons name="chatbubble-outline" size={18} color={theme.primary} />
    </Pressable>
  );

  // ─── Header title ──────────────────────────────────────────────────────────
  const partnerUid = useMemo(() => {
    if (viewMode !== "chat" || !activeConversation) return undefined;
    return activeConversation.participants?.find((u) => u !== currentUserUid);
  }, [viewMode, activeConversation, currentUserUid]);
  const liveProfile = useStudentProfile(partnerUid);

  const headerTitle =
    viewMode === "chat"
      ? liveProfile?.fullName ||
        headerName ||
        (activeConversation
          ? getPeerName(activeConversation, currentUserUid || "")
          : "Chat")
      : viewMode === "search"
        ? "Find Students"
        : "Student Chat";

  const headerSubtitle =
    viewMode === "chat" ? "Peer" : viewMode === "search" ? null : "Students";

  // Presence
  const [presenceMap, setPresenceMap] = useState<Record<string, boolean>>({});
  const allMessages: OptimisticMessage[] = useMemo(() => [
    ...messages,
    ...optimistic.filter((o) => !messages.some((m) => m.id === o.id)),
  ], [messages, optimistic]);

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        {/* Header */}
        <LinearGradient
          colors={theme.headerGradient}
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
              <Ionicons name="arrow-back" size={22} color={theme.onPrimary} />
            </Pressable>
            <View style={styles.headerCenter}>
              <View style={styles.headerTitleRow}>
                {viewMode === "chat" &&
                  (liveProfile?.profileImage ? (
                    <Image
                      source={{ uri: liveProfile.profileImage }}
                      style={styles.headerAvatar}
                    />
                  ) : (
                    <View
                      style={[
                        styles.headerAvatar,
                        styles.headerAvatarFallback,
                      ]}
                    >
                      <Ionicons name="person" size={14} color={theme.onPrimary} />
                    </View>
                  ))}
                <Text style={styles.headerTitle} numberOfLines={1}>
                  {headerTitle}
                </Text>
              </View>
              {headerSubtitle && (
                <View style={styles.headerBadge}>
                  <Ionicons
                    name={viewMode === "chat" ? "people" : "people-outline"}
                    size={10}
                    color={theme.onPrimary}
                  />
                  <Text style={styles.headerBadgeText}>{headerSubtitle}</Text>
                </View>
              )}
            </View>
            {viewMode === "inbox" && (
              <Pressable style={styles.backBtn} onPress={openSearch}>
                <Ionicons name="person-add" size={20} color={theme.onPrimary} />
              </Pressable>
            )}
            {viewMode !== "inbox" && <View style={{ width: 40 }} />}
          </View>
        </LinearGradient>

        {/* Content */}
        {viewMode === "inbox" ? (
          loading ? (
            <View style={styles.emptyState}>
              <Ionicons name="chatbubbles-outline" size={48} color={theme.border} />
              <Text style={styles.emptyText}>Loading conversations...</Text>
            </View>
          ) : conversations.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={48} color={theme.border} />
              <Text style={styles.emptyTitle}>No conversations yet</Text>
              <Text style={styles.emptyText}>
                Tap the + button to find students and start chatting.
              </Text>
              <Pressable style={styles.findBtn} onPress={openSearch}>
                <Ionicons name="person-add" size={18} color={theme.onPrimary} />
                <Text style={styles.findBtnText}>Find Students</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={styles.searchBar}>
                <Ionicons name="search" size={18} color={theme.secondaryText} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search conversations..."
                  placeholderTextColor={theme.secondaryText}
                  value={inboxSearchQuery}
                  onChangeText={setInboxSearchQuery}
                />
                {inboxSearchQuery.length > 0 && (
                  <Pressable onPress={() => setInboxSearchQuery("")}>
                    <Ionicons name="close-circle" size={18} color={theme.secondaryText} />
                  </Pressable>
                )}
              </View>
              {filteredConversations.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="search-outline" size={48} color={theme.border} />
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
                <Ionicons name="add" size={28} color={theme.onPrimary} />
              </Pressable>
            </>
          )
        ) : viewMode === "search" ? (
          <>
            <View style={styles.searchBar}>
              <Ionicons name="search" size={18} color={theme.secondaryText} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by name or department..."
                placeholderTextColor={theme.secondaryText}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
              />
              {searchQuery.length > 0 && (
                <Pressable onPress={() => setSearchQuery("")}>
                  <Ionicons name="close-circle" size={18} color={theme.secondaryText} />
                </Pressable>
              )}
            </View>
            {searchLoading ? (
              <View style={styles.emptyState}>
                <ActivityIndicator size="large" color={theme.primary} />
                <Text style={styles.emptyText}>Loading students...</Text>
              </View>            ) : students.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="search-outline" size={48} color={theme.border} />
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
                <Ionicons name="chatbubble-outline" size={48} color={theme.border} />
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
                onContentSizeChange={() => scrollToBottom(false)}
              />
            )}

            {/* Moderation error banner */}
            {moderationError && (
              <View style={styles.moderationBanner}>
                <Ionicons name="warning" size={16} color={theme.status.error} />
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
                  color={showEmoji ? theme.primary : theme.secondaryText}
                />
              </Pressable>
              <TextInput
                style={styles.textInput}
                placeholder="Type a message..."
                placeholderTextColor={theme.secondaryText}
                value={inputText}
                onChangeText={setInputText}
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
                  (!inputText.trim() ||
                    sending ||
                    moderationLoading ||
                    !!currentModerationError) &&
                    styles.sendBtnDisabled,
                ]}
                onPress={handleSend}
                disabled={
                  !inputText.trim() ||
                  sending ||
                  moderationLoading ||
                  !!currentModerationError
                }
              >
                {moderationLoading ? (
                  <ActivityIndicator size={24} color={theme.primary} />
                ) : (
                  <Ionicons
                    name="arrow-up-circle"
                    size={32}
                    color={
                      inputText.trim() && !currentModerationError
                        ? theme.primary
                        : theme.border
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
              <Ionicons name="copy-outline" size={20} color={theme.primary} />
              <Text style={styles.ctxLabel}>Copy</Text>
            </Pressable>
            <View style={styles.ctxDivider} />
            <Pressable style={styles.ctxRow} onPress={handleDeleteMsg}>
              <Ionicons name="trash-outline" size={20} color={theme.status.error} />
              <Text style={[styles.ctxLabel, { color: theme.status.error }]}>
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
              <Ionicons name="trash-outline" size={20} color={theme.status.error} />
              <Text style={[styles.ctxLabel, { color: theme.status.error }]}>
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
              <Ionicons name="warning" size={32} color={theme.status.warning} />
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

const createStyles = (theme: MindCareTheme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },

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
      color: theme.onPrimary,
      fontSize: 18,
      fontWeight: "700",
      flexShrink: 1,
    },
    headerTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      maxWidth: "100%",
    },
    headerAvatar: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: theme.primaryDeep,
    },
    headerAvatarFallback: { alignItems: "center", justifyContent: "center" },
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
      color: theme.onPrimary,
    },

    // Empty state
    emptyState: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 40,
    },
    emptyTitle: { fontSize: 17, fontWeight: "700", color: theme.text },
    emptyText: {
      fontSize: 14,
      color: theme.secondaryText,
      textAlign: "center",
    },
    findBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: theme.primary,
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 25,
      marginTop: 8,
    },
    findBtnText: { color: theme.onPrimary, fontSize: 15, fontWeight: "600" },

    // FAB
    fab: {
      position: "absolute",
      bottom: 24,
      right: 24,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: theme.primary,
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
      backgroundColor: theme.card,
      borderRadius: 16,
      padding: 14,
      marginBottom: 8,
      // @ts-ignore
      boxShadow: "0px 2px 8px rgba(138, 99, 210, 0.06)",
      borderWidth: 1,
      borderColor: theme.borderSoft,
      gap: 12,
    },
    convAvatar: {
      width: 46,
      height: 46,
      borderRadius: 23,
      backgroundColor: theme.softPurple,
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
    convName: { fontSize: 15, fontWeight: "600", color: theme.text },
    convNameBold: { fontWeight: "800" },
    convTime: { fontSize: 11, color: theme.secondaryText },
    convLastMsg: { fontSize: 13, color: theme.secondaryText },
    convLastMsgBold: { fontWeight: "600", color: theme.text },
    unreadDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: theme.primary,
    },
    convAvatarWrapper: {
      position: "relative",
    },
    convPresenceDot: {
      position: "absolute",
      bottom: 0,
      right: 0,
      width: 12,
      height: 12,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: theme.card,
    },
    convPresenceDotOnline: {
      backgroundColor: theme.status.success,
    },
    convPresenceDotOffline: {
      backgroundColor: theme.border,
    },

    // Search
    searchBar: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.card,
      margin: 16,
      marginBottom: 8,
      borderRadius: 14,
      paddingHorizontal: 14,
      height: 46,
      gap: 8,
      // @ts-ignore
      boxShadow: "0px 2px 8px rgba(138, 99, 210, 0.06)",
      borderWidth: 1,
      borderColor: theme.borderSoft,
    },
    searchInput: {
      flex: 1,
      fontSize: 15,
      color: theme.text,
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
      color: theme.primary,
      marginLeft: 12,
      marginBottom: 2,
    },
    bubble: {
      borderRadius: 18,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    bubbleMine: {
      backgroundColor: theme.primary,
      borderBottomRightRadius: 4,
    },
    bubbleTheirs: {
      backgroundColor: theme.card,
      borderBottomLeftRadius: 4,
      // @ts-ignore
      boxShadow: "0px 2px 8px rgba(138, 99, 210, 0.08)",
      borderWidth: 1,
      borderColor: theme.borderSoft,
    },
    bubbleDeleted: {
      backgroundColor: `${theme.secondaryText}26`,
      borderWidth: 1,
      borderColor: `${theme.secondaryText}33`,
    },
    bubbleText: {
      fontSize: 15,
      color: theme.text,
      lineHeight: 20,
    },
    bubbleTextMine: { color: theme.onPrimary },
    bubbleFooter: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-end",
      gap: 6,
      marginTop: 4,
    },
    bubbleTime: { fontSize: 10, color: theme.secondaryText },
    bubbleTimeMine: { color: "rgba(255,255,255,0.6)" },
    deletedRow: { flexDirection: "row", alignItems: "center", gap: 4 },
    deletedText: { fontSize: 13, color: theme.secondaryText, fontStyle: "italic" },
    deletedTextMine: { color: "rgba(255,255,255,0.5)" },
    retryBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      backgroundColor: `${theme.status.error}1A`,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
    },
    retryText: { fontSize: 11, color: theme.status.error, fontWeight: "600" },

    // Moderation banner
    moderationBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: `${theme.status.error}14`,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderTopWidth: 1,
      borderTopColor: `${theme.status.error}1A`,
    },
    moderationText: { fontSize: 13, color: theme.status.error, flex: 1 },

    // Input
    inputBar: {
      flexDirection: "row",
      alignItems: "flex-end",
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderTopWidth: 1,
      borderTopColor: theme.borderSoft,
      backgroundColor: theme.card,
      gap: 8,
    },
    textInput: {
      flex: 1,
      backgroundColor: theme.inputBg,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 16,
      paddingVertical: 10,
      fontSize: 15,
      color: theme.text,
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
      backgroundColor: theme.card,
      borderRadius: 18,
      padding: 6,
      width: 200,
      // @ts-ignore
      boxShadow: "0px 8px 24px rgba(0,0,0,0.15)",
    },
    ctxTitle: {
      fontSize: 13,
      fontWeight: "700",
      color: theme.secondaryText,
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
    ctxLabel: { fontSize: 15, fontWeight: "600", color: theme.text },
    ctxDivider: {
      height: 1,
      backgroundColor: theme.border,
      marginHorizontal: 14,
    },

    // Flagged modal
    flaggedModal: {
      backgroundColor: theme.card,
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
      backgroundColor: `${theme.status.warning}1A`,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 12,
    },
    flaggedTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.text,
      marginBottom: 6,
    },
    flaggedDesc: {
      fontSize: 14,
      color: theme.secondaryText,
      textAlign: "center",
      marginBottom: 12,
    },
    flaggedPreview: {
      fontSize: 13,
      color: theme.secondaryText,
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
      backgroundColor: theme.inputBg,
      alignItems: "center",
    },
    flaggedCancelText: { fontSize: 15, fontWeight: "600", color: theme.secondaryText },
    flaggedConfirm: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 14,
      backgroundColor: theme.status.warning,
      alignItems: "center",
    },
    flaggedConfirmText: { fontSize: 15, fontWeight: "600", color: theme.onPrimary },
  });
