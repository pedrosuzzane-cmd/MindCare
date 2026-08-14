/**
 * Student messaging screen — Inbox with real-time conversation list + chat room.
 * Tapping a conversation opens the existing chat view via messagingService.
 * Chat view features: friendly reminder banner, phone-style bubbles,
 * optimistic send, failed message retry, long-press delete/copy, emoji picker.
 * Inbox features: All / Unread / Peers / Guidance filter pills, search.
 */

import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Clipboard,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import EmojiPicker from "@/components/chat/EmojiPicker";
import Toast from "@/components/Toast";

import { useMindCareTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/hooks/AuthContext";
import { useStudentProfile } from "@/hooks/useStudentProfile";
import {
  deleteMessage,
  fetchAllUsers,
  getOrCreateConversation,
  getOrCreatePeerConversation,
  getPeerName,
  listenForConversations,
  listenForMessages,
  listenForTyping,
  markAsRead,
  searchUsers,
  sendMessage as sendMsg,
  startTyping,
} from "@/services/messagingService";
import {
  listenForPresence,
  setUserOffline,
  setUserOnline,
} from "@/services/presenceService";
import type {
  Conversation,
  Message,
  OptimisticMessage,
  StudentSearchResult,
} from "@/types/messaging";

type ViewMode = "directory" | "chat";
type InboxFilter = "all" | "unread" | "peers" | "guidance";

/** Recipient search result tagged with the conversation type it maps to. */
type RecipientResult = StudentSearchResult & {
  role: "peer" | "guidance";
};

const REMINDER_BANNER =
  "Friendly Reminder: Please keep conversations respectful, supportive, and kind.";

const FILTER_OPTIONS: {
  key: InboxFilter;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { key: "all", label: "All Conversations", icon: "chatbubbles-outline" },
  { key: "unread", label: "Unread", icon: "mail-unread-outline" },
  { key: "peers", label: "Peers", icon: "people-outline" },
  { key: "guidance", label: "Guidance", icon: "shield-checkmark-outline" },
];

const BOTTOM_THRESHOLD = 80;

/** Builds initials from a full name, e.g. "John Doe" → "JD", "Maria" → "M". */
const getInitials = (name: string) => {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
};

// ── MindCare dark theme (Inbox screen only) ──
const COLORS = {
  background: "#0F0D15",
  card: "#1E1B2E",
  secondary: "#161224",
  purple: "#6D28D9",
  lightPurple: "#A78BFA",
  primaryText: "#FFFFFF",
  secondaryText: "#9CA3AF",
  border: "rgba(139, 92, 246, 0.3)",
  softBorder: "rgba(139, 92, 246, 0.12)",
};

export default function StudentMessagesScreen() {
  const { user } = useAuth();
  const userId = user?.uid;
  const insets = useSafeAreaInsets();
  const { theme } = useMindCareTheme();

  // ── View state ──
  const [viewMode, setViewMode] = useState<ViewMode>("directory");

  // ── Inbox state ──
  const [allPeers, setAllPeers] = useState<StudentSearchResult[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [inboxLoading, setInboxLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<InboxFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false);

  // ── New conversation modal state ──
  const [newChatVisible, setNewChatVisible] = useState(false);
  const [recipientQuery, setRecipientQuery] = useState("");
  const [recipientResults, setRecipientResults] = useState<RecipientResult[]>(
    [],
  );
  const [recipientLoading, setRecipientLoading] = useState(false);
  const [startingConversationId, setStartingConversationId] = useState<
    string | null
  >(null);
  const [failedAvatarUids, setFailedAvatarUids] = useState<
    Record<string, boolean>
  >({});
  const [toast, setToast] = useState<{
    visible: boolean;
    message: string;
    type: "error" | "info";
  }>({ visible: false, message: "", type: "info" });

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
  const [presenceMap, setPresenceMap] = useState<Record<string, boolean>>({});

  const [partnerTyping, setPartnerTyping] = useState(false);

  // ── Scroll state ──
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } =
        event.nativeEvent;
      const distanceFromBottom =
        contentSize.height - (contentOffset.y + layoutMeasurement.height);
      const near = distanceFromBottom <= BOTTOM_THRESHOLD;
      setIsNearBottom(near);
      setShowScrollToBottom(!near);
    },
    [],
  );

  const jumpToBottom = useCallback(() => {
    setIsNearBottom(true);
    setShowScrollToBottom(false);
    scrollToBottom(true);
  }, [scrollToBottom]);

  const getPartnerLabel = useCallback(
    (conv: Conversation): string => {
      if (conv.type === "peer") {
        return getPeerName(conv, userId || "");
      }
      return conv.adminName || conv.studentName || "Guidance";
    },
    [userId],
  );

  // ── Filter + search (derived from the single source of truth) ──
  const filteredConversations = useMemo(() => {
    if (!userId) return [];
    const peerDirectory: Conversation[] = allPeers.map((peer): Conversation => {
      const existingConv = conversations.find((c) =>
        c.participants?.includes(peer.uid),
      );
      return (
        existingConv || {
          id: peer.uid, // Use peer UID as a stable key for non-chatted peers
          participants: [userId, peer.uid],
          participantNames: {
            [userId!]: user?.displayName || "You",
            [peer.uid]: peer.fullName,
          },
          type: "peer",
          lastMessage: `Start a conversation with ${peer.fullName}`,
          lastMessageAt: 0,
          unreadBy: [],
        }
      );
    });

    const query = searchQuery.trim().toLowerCase(); // This is for the inbox search, not directory
    const result = (
      activeFilter === "peers" ? peerDirectory : conversations
    ).filter((c) => {
      if (activeFilter === "unread" && !c.unreadBy?.includes(userId || ""))
        return false;
      if (activeFilter === "peers" && c.type !== "peer") return false; // Should be redundant now
      if (activeFilter === "guidance" && c.type === "peer") return false;

      if (query) {
        const name = getPartnerLabel(c).toLowerCase();
        if (!name.includes(query)) return false;
      }
      return true;
    });
    return result.sort((a, b) => b.lastMessageAt - a.lastMessageAt);
  }, [
    allPeers,
    conversations,
    activeFilter,
    searchQuery,
    userId,
    user?.displayName,
    getPartnerLabel,
  ]);

  const emptyStateMessage = useMemo(() => {
    if (conversations.length === 0) {
      return {
        title: "No conversations yet",
        message:
          "Your conversations with peers and guidance counsellors will appear here.",
      };
    }
    if (searchQuery.trim()) {
      return {
        title: "No matches",
        message: `No conversations match "${searchQuery}".`,
      };
    }
    switch (activeFilter) {
      case "unread":
        return {
          title: "No unread conversations",
          message: "You're all caught up!",
        };
      case "peers":
        return {
          title: "No peer conversations",
          message: "Peer chats will appear here once they start.",
        };
      case "guidance":
        return {
          title: "No guidance conversations",
          message: "Guidance chats will appear here once they start.",
        };
      default:
        return { title: "No conversations", message: "" };
    }
  }, [conversations.length, activeFilter, searchQuery]);

  // ── Real-time listener for all conversations (peer + guidance) ──
  useEffect(() => {
    if (!user?.uid) return;

    let cancelled = false;
    fetchAllUsers(user.uid, "users").then((peers) => {
      if (!cancelled) {
        setAllPeers(peers);
      }
    });

    const unsub = listenForConversations(user.uid, "student", (convs) => {
      setConversations(convs);
      setInboxLoading(false);
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, [user]);

  // ── Listen for presence of conversation partners ──
  useEffect(() => {
    if (conversations.length === 0 || !user?.uid) return;

    const unsubs = conversations.map((conv) => {
      const peerUid = conv.participants?.find((p) => p !== user!.uid);
      if (!peerUid) return () => {};
      return listenForPresence(peerUid, (online) => {
        setPresenceMap((prev) => ({ ...prev, [peerUid]: online }));
      });
    });

    return () => unsubs.forEach((unsub) => unsub());
  }, [conversations, user]);

  // ── Listen for messages when in chat view ──
  useEffect(() => {
    if (!activeConversation?.id || !userId) return;

    const unsub = listenForMessages(activeConversation.id, (msgs) => {
      setMessages(msgs);
      setChatLoading(false);
      markAsRead(activeConversation.id, userId);
      setOptimistic((prev) =>
        prev.filter((o) => !msgs.some((m) => m.id === o.id)),
      );
      // Only follow to the bottom if the user is already near the newest
      // message — never force-scroll while they are reading older messages.
      if (isNearBottom) {
        scrollToBottom(false);
      }
    });

    return () => unsub();
  }, [activeConversation?.id, isNearBottom, scrollToBottom, userId, user]);

  // ── Scroll to newest message once when a conversation opens ──
  // Reset scroll state synchronously during render (valid derived-state
  // pattern, avoids cascading setState in the effect body).
  const [prevConvId, setPrevConvId] = useState<string | null>(null);
  if (activeConversation?.id && prevConvId !== activeConversation.id) {
    setPrevConvId(activeConversation.id);
    setIsNearBottom(true);
    setShowScrollToBottom(false);
  }
  useEffect(() => {
    if (!activeConversation?.id) return;
    scrollToBottom(false);
  }, [activeConversation?.id, scrollToBottom, user]);

  // ── Set self as online on mount, offline on unmount ──
  useEffect(() => {
    if (!user?.uid) return;
    setUserOnline(user.uid);
    return () => {
      setUserOffline(user.uid);
    };
  }, [user]);

  // ── Listen for partner presence ──
  useEffect(() => {
    if (!activeConversation?.participants || !user?.uid) return;
    const otherUid = activeConversation.participants.find(
      (uid) => uid !== user.uid,
    );
    if (!otherUid) return;

    const unsub = listenForPresence(otherUid, (online) => {
      setPartnerOnline(online);
    });
    return () => unsub();
  }, [activeConversation?.id, activeConversation?.participants, user]);

  // ── Listen for partner typing ──
  useEffect(() => {
    if (!activeConversation?.id || !user?.uid) return;

    const unsub = listenForTyping(activeConversation.id, user.uid, (typing) => {
      setPartnerTyping(typing);
    });
    return () => unsub();
  }, [activeConversation?.id, user]);

  // ── Open a conversation from the inbox ──
  const openConversation = useCallback(
    (conversation: Conversation) => {
      setActiveConversation(conversation);
      setChatPartnerName(getPartnerLabel(conversation));
      setMessages([]);
      setOptimistic([]);
      setChatLoading(true);
      setViewMode("chat");
    },
    [getPartnerLabel],
  );

  // ── Recipient search (real users + guidance counsellors) ──
  const searchRecipients = useCallback(
    async (queryText: string) => {
      if (!userId) return;
      const trimmed = queryText.trim();
      if (!trimmed) {
        setRecipientResults([]);
        return;
      }
      setRecipientLoading(true);
      try {
        const [peers, guidance] = await Promise.all([
          searchUsers(userId, "student", trimmed, "users"),
          searchUsers(userId, "student", trimmed, "admins"),
        ]);
        const combined: RecipientResult[] = [
          ...peers.map((p) => ({ ...p, role: "peer" as const })),
          ...guidance.map((g) => ({ ...g, role: "guidance" as const })),
        ];
        setRecipientResults(combined);
      } catch (err) {
        console.error("Recipient search failed:", err);
        setRecipientResults([]);
      } finally {
        setRecipientLoading(false);
      }
    },
    [userId],
  );

  // ── Start a conversation with a selected recipient ──
  const startConversation = useCallback(
    async (recipient: RecipientResult) => {
      if (!user?.uid || startingConversationId) return;
      // Fall back to a safe label if the auth profile lacks a display name so
      // contact selection is never silently blocked.
      const myName = user.displayName || "Student";
      setStartingConversationId(recipient.uid);
      try {
        let conversationId: string;
        if (recipient.role === "peer") {
          conversationId = await getOrCreatePeerConversation(
            user.uid,
            recipient.uid,
            myName,
            recipient.fullName,
          );
        } else {
          conversationId = await getOrCreateConversation(
            user.uid,
            recipient.uid,
            myName,
            recipient.fullName,
          );
        }

        const conversation: Conversation = {
          id: conversationId,
          participants: [user.uid, recipient.uid],
          participantNames: {
            [user.uid]: myName,
            [recipient.uid]: recipient.fullName,
          },
          type: recipient.role === "peer" ? "peer" : "admin",
          lastMessage: "",
          lastMessageAt: Date.now(),
          unreadBy: [],
        };

        setNewChatVisible(false);
        setRecipientQuery("");
        setRecipientResults([]);
        openConversation(conversation);
      } catch (err) {
        console.error("Failed to start conversation:", err);
        setToast({
          visible: true,
          message: "Could not start conversation. Please try again.",
          type: "error",
        });
      } finally {
        setStartingConversationId(null);
      }
    },
    [user, startingConversationId, openConversation],
  );

  // ─── Send with optimistic UI ─────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    if (!inputText.trim() || !activeConversation || !userId || sending) return;

    const text = inputText.trim();
    const tempId = `temp_${Date.now()}`;
    setInputText("");

    const optMsg: OptimisticMessage = {
      id: tempId,
      senderId: userId,
      text,
      createdAt: Date.now(),
      isAdmin: false,
      failed: false,
    };
    setOptimistic((prev) => [...prev, optMsg]);
    setSending(true);

    try {
      const realId = await sendMsg(activeConversation.id, text, userId, false);
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
  }, [inputText, activeConversation, userId, sending]);

  // ─── Retry a failed message ──────────────────────────────────────────────
  const handleRetry = useCallback(
    async (msg: OptimisticMessage) => {
      if (!activeConversation || !userId) return;

      setOptimistic((prev) =>
        prev.map((m) => (m.id === msg.id ? { ...m, failed: false } : m)),
      );

      try {
        const realId = await sendMsg(
          activeConversation.id,
          msg.text,
          userId,
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
    [activeConversation, userId],
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
    const partnerName = getPartnerLabel(item);
    const isPeer = item.type === "peer";
    const peerUid = item.participants?.find((u) => u !== userId);
    const isOnline = peerUid ? presenceMap[peerUid] : false;

    return (
      <Pressable style={styles.convRow} onPress={() => openConversation(item)}>
        <View style={styles.convAvatarWrapper}>
          <View
            style={[
              styles.convAvatar,
              isPeer ? styles.convAvatarPeer : styles.convAvatarAdmin,
            ]}
          >
            <Ionicons
              name={isPeer ? "person" : "shield-checkmark"}
              size={22}
              color={isPeer ? "#8A63D2" : "#6D5BBF"}
            />
          </View>
          <View
            style={[
              styles.convPresenceDot,
              isOnline
                ? styles.convPresenceDotOnline
                : styles.convPresenceDotOffline,
            ]}
          />
        </View>
        <View style={styles.convInfo}>
          <View style={styles.convTop}>
            <Text
              style={[styles.convName, hasUnread && styles.convNameBold]}
              numberOfLines={1}
            >
              {partnerName}
            </Text>
            <Text style={styles.convTime}>
              {item.lastMessageAt ? formatTime(item.lastMessageAt) : ""}
            </Text>
          </View>
          <Text
            style={[styles.convLastMsg, hasUnread && styles.convLastMsgBold]}
            numberOfLines={1}
          >
            {item.lastMessageAt === 0
              ? "Click to start a conversation"
              : item.lastMessage || "No messages yet"}
          </Text>
        </View>
        {hasUnread && <View style={styles.unreadDot} />}
      </Pressable>
    );
  };

  // ─── Chat: Message bubble ────────────────────────────────────────────────
  const renderMessage = ({ item }: { item: OptimisticMessage }) => {
    const isMine = item.senderId === user?.uid;
    const isDeleted = !!item.deleted;
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
                style={[styles.deletedText, isMine && styles.deletedTextMine]}
              >
                This message was deleted
              </Text>
            </View>
          ) : (
            <Text style={[styles.bubbleText, isMine && styles.bubbleTextMine]}>
              {item.text}
            </Text>
          )}

          <View style={styles.bubbleFooter}>
            <Text style={[styles.bubbleTime, isMine && styles.bubbleTimeMine]}>
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

  // ─── Derived values for chat view ────────────────────────────────────────
  const allMessages: OptimisticMessage[] = useMemo(
    () => [
      ...messages,
      ...optimistic.filter((o) => !messages.some((m) => m.id === o.id)),
    ],
    [messages, optimistic],
  );

  const partnerUid = useMemo(
    () => activeConversation?.participants?.find((u) => u !== userId),
    [activeConversation, userId],
  );
  const liveProfile = useStudentProfile(partnerUid);

  // ─── Inbox view ──────────────────────────────────────────────────────────
  const renderInboxView = () => {
    const activeLabel =
      FILTER_OPTIONS.find((o) => o.key === activeFilter)?.label ||
      "All Conversations";

    return (
    <>
      {/* Filter dropdown */}
      <View style={styles.filterWrap}>
        <Pressable
          style={styles.filterTrigger}
          onPress={() => setFilterDropdownOpen((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel="Filter conversations"
        >
          <Ionicons name="options-outline" size={16} color={COLORS.lightPurple} />
          <Text style={styles.filterTriggerText}>{activeLabel}</Text>
          <Ionicons
            name={filterDropdownOpen ? "chevron-up" : "chevron-down"}
            size={16}
            color={COLORS.secondaryText}
          />
        </Pressable>

        {filterDropdownOpen && (
          <>
            <Pressable
              style={styles.filterBackdrop}
              onPress={() => setFilterDropdownOpen(false)}
            />
            <View style={styles.dropdownMenu}>
              {FILTER_OPTIONS.map((option) => {
                const isActive = activeFilter === option.key;
                return (
                  <Pressable
                    key={option.key}
                    style={[
                      styles.dropdownItem,
                      isActive && styles.dropdownItemActive,
                    ]}
                    onPress={() => {
                      setActiveFilter(option.key);
                      setFilterDropdownOpen(false);
                    }}
                  >
                    <Ionicons
                      name={option.icon}
                      size={16}
                      color={isActive ? COLORS.lightPurple : COLORS.secondaryText}
                    />
                    <Text
                      style={[
                        styles.dropdownItemText,
                        isActive && styles.dropdownItemTextActive,
                      ]}
                    >
                      {option.label}
                    </Text>
                    {isActive && (
                      <Ionicons
                        name="checkmark"
                        size={16}
                        color={COLORS.lightPurple}
                      />
                    )}
                  </Pressable>
                );
              })}
            </View>
          </>
        )}
      </View>

      {/* Search */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color={COLORS.secondaryText} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search conversations..."
          placeholderTextColor={COLORS.secondaryText}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <Pressable onPress={() => setSearchQuery("")}>
            <Ionicons name="close-circle" size={18} color={COLORS.secondaryText} />
          </Pressable>
        )}
      </View>

      {/* Conversation list */}
      {inboxLoading ? (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color="#8A63D2" />
          <Text style={styles.emptyText}>Loading conversations...</Text>
        </View>
      ) : filteredConversations.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons
            name={
              activeFilter === "peers"
                ? "people-outline"
                : activeFilter === "guidance"
                  ? "shield-checkmark-outline"
                  : searchQuery.trim()
                    ? "search-outline"
                    : "chatbubbles-outline"
            }
            size={48}
            color="#D1D5DB"
          />
          <Text style={styles.emptyTitle}>{emptyStateMessage.title}</Text>
          {emptyStateMessage.message ? (
            <Text style={styles.emptyText}>{emptyStateMessage.message}</Text>
          ) : null}
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
    );
  };

  // ─── Chat view ───────────────────────────────────────────────────────────
  const renderChatView = () => (
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
          onScroll={handleScroll}
          scrollEventThrottle={16}
          onContentSizeChange={() => scrollToBottom(false)}
        />
      )}

      {/* Scroll to latest messages */}
      {viewMode === "chat" && showScrollToBottom && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Scroll to latest messages"
          style={[styles.scrollToBottomBtn, { backgroundColor: theme.primary }]}
          onPress={jumpToBottom}
        >
          <Ionicons name="chevron-down" size={22} color={theme.onPrimary} />
        </Pressable>
      )}

      {/* Typing indicator */}
      {partnerTyping && (
        <View style={styles.typingIndicator}>
          <Text style={styles.typingText}>{chatPartnerName} is typing</Text>
          <ActivityIndicator
            size="small"
            color="#8A63D2"
            style={{ marginLeft: 6 }}
          />
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
      <View
        style={[
          styles.inputBar,
          { paddingBottom: Math.max(insets.bottom, 10) },
        ]}
      >
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
  );

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
              <View style={styles.headerTitleRow}>
                {viewMode === "chat" &&
                  (liveProfile?.profileImage ? (
                    <Image
                      source={{ uri: liveProfile.profileImage }}
                      style={styles.headerAvatar}
                    />
                  ) : (
                    <View
                      style={[styles.headerAvatar, styles.headerAvatarFallback]}
                    >
                      <Ionicons name="person" size={14} color="white" />
                    </View>
                  ))}
                <Text style={styles.headerTitle} numberOfLines={1}>
                  {viewMode === "chat"
                    ? liveProfile?.fullName || chatPartnerName || "Chat"
                    : "Inbox"}
                </Text>
              </View>
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
                        partnerOnline
                          ? styles.onlineDotActive
                          : styles.onlineDotInactive,
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
        {viewMode === "directory" ? renderInboxView() : renderChatView()}
      </KeyboardAvoidingView>

      {/* Floating new message button */}
      {viewMode === "directory" && (
        <Pressable
          style={styles.fab}
          onPress={() => setNewChatVisible(true)}
          accessibilityRole="button"
          accessibilityLabel="New conversation"
        >
          <Ionicons name="add" size={28} color="#FFFFFF" />
        </Pressable>
      )}

      {/* ─── New Conversation Modal ─────────────────────────────────── */}
      <Modal
        visible={newChatVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setNewChatVisible(false)}
      >
        <Pressable
          style={styles.newChatOverlay}
          onPress={() => setNewChatVisible(false)}
        >
          <Pressable style={styles.newChatCard} onPress={() => {}}>
            <View style={styles.newChatHeader}>
              <Text style={styles.newChatTitle}>New Conversation</Text>
              <Pressable
                onPress={() => setNewChatVisible(false)}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <Ionicons name="close" size={22} color={COLORS.secondaryText} />
              </Pressable>
            </View>

            <Text style={styles.newChatSubtitle}>
              Search for a student or guidance counselor
            </Text>

            <View style={styles.newChatSearch}>
              <Ionicons name="search" size={18} color={COLORS.secondaryText} />
              <TextInput
                style={styles.newChatSearchInput}
                placeholder="Search name..."
                placeholderTextColor={COLORS.secondaryText}
                value={recipientQuery}
                onChangeText={(text) => {
                  setRecipientQuery(text);
                  searchRecipients(text);
                }}
                autoFocus
              />
              {recipientQuery.length > 0 && (
                <Pressable
                  onPress={() => {
                    setRecipientQuery("");
                    setRecipientResults([]);
                  }}
                >
                  <Ionicons
                    name="close-circle"
                    size={18}
                    color={COLORS.secondaryText}
                  />
                </Pressable>
              )}
            </View>

            <View style={styles.newChatResults}>
              {recipientLoading ? (
                <ActivityIndicator
                  size="small"
                  color={COLORS.lightPurple}
                  style={{ marginTop: 16 }}
                />
              ) : recipientQuery.trim() && recipientResults.length === 0 ? (
                <Text style={styles.newChatEmpty}>No matches found</Text>
              ) : recipientResults.length === 0 ? (
                <Text style={styles.newChatEmpty}>
                  Start typing to search for a student or guidance counselor
                </Text>
              ) : (
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={styles.newChatResultsContent}
                >
                  {recipientResults.map((r) => {
                    const isStarting = startingConversationId === r.uid;
                    const avatarUrl =
                      r.profileImage && !failedAvatarUids[r.uid]
                        ? r.profileImage
                        : null;
                    return (
                      <Pressable
                        key={r.uid}
                        style={[
                          styles.newChatResultRow,
                          startingConversationId !== null &&
                            startingConversationId !== r.uid &&
                            styles.newChatResultRowDisabled,
                        ]}
                        onPress={() => startConversation(r)}
                        disabled={startingConversationId !== null}
                      >
                        {avatarUrl ? (
                          <Image
                            source={{ uri: avatarUrl }}
                            style={styles.newChatResultAvatarImage}
                            onError={() =>
                              setFailedAvatarUids((prev) => ({
                                ...prev,
                                [r.uid]: true,
                              }))
                            }
                          />
                        ) : (
                          <View
                            style={[
                              styles.newChatResultAvatar,
                              r.role === "guidance"
                                ? styles.newChatResultAvatarGuidance
                                : styles.newChatResultAvatarPeer,
                            ]}
                          >
                            <Text style={styles.newChatResultAvatarInitials}>
                              {getInitials(r.fullName)}
                            </Text>
                          </View>
                        )}
                        <View style={{ flex: 1 }}>
                          <Text
                            style={styles.newChatResultName}
                            numberOfLines={1}
                          >
                            {r.fullName}
                          </Text>
                          <Text
                            style={styles.newChatResultMeta}
                            numberOfLines={1}
                          >
                            {r.role === "guidance"
                              ? r.department || "Guidance Counselor"
                              : r.department || "Student"}
                          </Text>
                        </View>
                        {isStarting && (
                          <ActivityIndicator
                            size="small"
                            color={COLORS.lightPurple}
                          />
                        )}
                      </Pressable>
                    );
                  })}
                </ScrollView>
              )}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ─── Toast ──────────────────────────────────────────────────── */}
      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onDismiss={() => setToast((prev) => ({ ...prev, visible: false }))}
      />

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
  container: { flex: 1, backgroundColor: COLORS.background },

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
    backgroundColor: "#7A54C4",
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
  emptyTitle: { fontSize: 17, fontWeight: "700", color: COLORS.primaryText },
  emptyText: {
    fontSize: 14,
    color: COLORS.secondaryText,
    textAlign: "center",
  },

  // Filter dropdown
  filterWrap: {
    position: "relative",
    zIndex: 1000,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
  },
  filterTrigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.softBorder,
    paddingHorizontal: 14,
    height: 44,
  },
  filterTriggerText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.primaryText,
  },
  filterBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1001,
  },
  dropdownMenu: {
    position: "absolute",
    top: 50,
    left: 0,
    right: 0,
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 6,
    zIndex: 1002,
    elevation: 10,
  },
  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  dropdownItemActive: {
    backgroundColor: "rgba(139, 92, 246, 0.15)",
  },
  dropdownItemText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
    color: COLORS.secondaryText,
  },
  dropdownItemTextActive: {
    color: COLORS.lightPurple,
    fontWeight: "600",
  },

  // Search bar
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.card,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 12,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 46,
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.softBorder,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: COLORS.primaryText,
    paddingVertical: 0,
  },

  // Conversation list
  convList: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  convRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.softBorder,
    gap: 12,
  },
  convAvatarWrapper: {
    position: "relative",
  },
  convAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: "center",
    alignItems: "center",
  },
  convAvatarPeer: { backgroundColor: "rgba(139, 92, 246, 0.18)" },
  convAvatarAdmin: { backgroundColor: "rgba(109, 91, 191, 0.22)" },
  convInfo: { flex: 1 },
  convTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 3,
  },
  convName: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.primaryText,
    flexShrink: 1,
  },
  convNameBold: { fontWeight: "800" },
  convTime: { fontSize: 11, color: COLORS.secondaryText, marginLeft: 8 },
  convLastMsg: { fontSize: 13, color: COLORS.secondaryText },
  convLastMsgBold: { fontWeight: "600", color: COLORS.primaryText },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.lightPurple,
  },
  convPresenceDot: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: COLORS.card,
  },
  convPresenceDotOnline: {
    backgroundColor: "#22C55E",
  },
  convPresenceDotOffline: {
    backgroundColor: "#4B5563",
  },

  // Reminder banner
  reminderBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(139, 92, 246, 0.12)",
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.softBorder,
  },
  reminderText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.lightPurple,
    lineHeight: 17,
  },

  // Messages
  messagesList: {
    flexGrow: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  scrollToBottomBtn: {
    position: "absolute",
    right: 16,
    bottom: 12,
    width: 44,
    height: 44,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    // @ts-ignore
    boxShadow: "0px 4px 12px rgba(124, 77, 204, 0.4)",
    elevation: 4,
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
    backgroundColor: COLORS.card,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.softBorder,
  },
  bubbleDeleted: {
    backgroundColor: "rgba(148, 163, 184, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.2)",
  },
  bubbleText: {
    fontSize: 15,
    color: COLORS.primaryText,
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
    backgroundColor: COLORS.secondary,
  },
  typingText: {
    fontSize: 12,
    color: COLORS.lightPurple,
    fontStyle: "italic",
  },

  // Input
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.softBorder,
    backgroundColor: COLORS.card,
    gap: 8,
  },
  textInput: {
    flex: 1,
    backgroundColor: COLORS.secondary,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.softBorder,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: COLORS.primaryText,
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

  // Floating action button
  fab: {
    position: "absolute",
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.purple,
    alignItems: "center",
    justifyContent: "center",
    elevation: 8,
    shadowColor: "#6D28D9",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },

  // New conversation modal
  newChatOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  newChatCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: COLORS.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.softBorder,
    padding: 20,
    maxHeight: "80%",
    overflow: "hidden",
  },
  newChatHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  newChatTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.primaryText,
  },
  newChatSubtitle: {
    fontSize: 13,
    color: COLORS.secondaryText,
    marginBottom: 14,
  },
  newChatSearch: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: COLORS.secondary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.softBorder,
    paddingHorizontal: 12,
    height: 44,
  },
  newChatSearchInput: {
    flex: 1,
    fontSize: 15,
    color: COLORS.primaryText,
    paddingVertical: 0,
  },
  newChatResults: {
    marginTop: 14,
    flexShrink: 1,
    minHeight: 0,
  },
  newChatResultsContent: {
    paddingBottom: 4,
  },
  newChatEmpty: {
    fontSize: 13,
    color: COLORS.secondaryText,
    textAlign: "center",
    paddingVertical: 16,
  },
  newChatResultRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  newChatResultRowDisabled: {
    opacity: 0.6,
  },
  newChatResultAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  newChatResultAvatarImage: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  newChatResultAvatarInitials: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.lightPurple,
  },
  newChatResultAvatarPeer: {
    backgroundColor: "rgba(139, 92, 246, 0.18)",
  },
  newChatResultAvatarGuidance: {
    backgroundColor: "rgba(109, 91, 191, 0.22)",
  },
  newChatResultName: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.primaryText,
  },
  newChatResultMeta: {
    fontSize: 12,
    color: COLORS.secondaryText,
    marginTop: 2,
  },

  // Context menu
  ctxOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  ctxMenu: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 6,
    width: 200,
    borderWidth: 1,
    borderColor: COLORS.softBorder,
  },
  ctxTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.secondaryText,
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
  ctxLabel: { fontSize: 15, fontWeight: "600", color: COLORS.primaryText },
  ctxDivider: {
    height: 1,
    backgroundColor: COLORS.softBorder,
    marginHorizontal: 14,
  },
});
