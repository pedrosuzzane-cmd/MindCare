/**
 * Student Inbox tab.
 *
 * Two views:
 *   inbox — real-time conversation list (peer + admin/guidance) with unread
 *           badges, latest-message previews, human-friendly timestamps, and
 *           All / Unread / Peers / Guidance filters. This is a history/message
 *           list — it does not create conversations.
 *   chat  — the existing conversation screen (unchanged flow).
 *
 * This file only adds presentation around the existing messaging service.
 * Message sending/receiving, Firebase structure, routing, and the chat
 * composer are untouched.
 */

import { Ionicons } from "@expo/vector-icons";
import { doc, getDoc } from "firebase/firestore";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { db } from "@/constants/firebase";
import { useAuth } from "@/hooks/AuthContext";
import {
  useStudentProfile,
  type StudentProfile,
} from "@/hooks/useStudentProfile";
import {
  blockUser,
  getBlockedUsers,
  getPeerName,
  hideConversation,
  listenForConversations,
  listenForMessages,
  markAsRead,
  reportConversation,
  sendMessage,
  togglePinConversation,
} from "@/services/messagingService";
import type {
  Conversation,
  Message,
  OptimisticMessage,
} from "@/types/messaging";

type ViewMode = "inbox" | "chat";
type InboxFilter = "all" | "unread" | "peers" | "guidance";

const REMINDER_BANNER =
  "Your conversations are private. Please avoid sharing passwords or sensitive personal information.";

const PRIVACY_NOTE =
  "This is not an emergency service. If you are in crisis or need urgent help, please use the Support Hotlines.";

const INBOX_PRIVACY_NOTE =
  "Your conversations are private. Please avoid sharing passwords, account credentials, or other sensitive personal information. MindCare is not an emergency service.";

const FILTERS: { key: InboxFilter; label: string; icon: string }[] = [
  { key: "all", label: "All", icon: "chatbubbles" },
  { key: "unread", label: "Unread", icon: "mail-unread" },
  { key: "peers", label: "Peers", icon: "people" },
  { key: "guidance", label: "Guidance", icon: "shield-checkmark" },
];

function formatConversationTime(ts: number): string {
  if (!ts) return "";
  const d = new Date(ts);
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const day = new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate(),
  ).getTime();
  const diffDays = Math.round((startOfToday - day) / 86400000);

  if (diffDays === 0) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  if (diffDays === 1) {
    return "Yesterday";
  }
  if (d.getFullYear() === now.getFullYear()) {
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  }
  return d.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function formatDayLabel(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const day = new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate(),
  ).getTime();
  const diffDays = Math.round((startOfToday - day) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return d.toLocaleDateString([], {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).toUpperCase();
}

function formatStartedDate(ts?: number): string {
  if (!ts) return "Unknown";
  return new Date(ts).toLocaleDateString([], {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function normalizeProfile(uid: string, data: any): StudentProfile {
  return {
    uid,
    fullName: data.fullName || data.displayName,
    profileImage: data.profileImage,
    department: data.department || data.position,
    yearLevel: data.yearLevel,
  };
}

export default function InboxTab() {
  const { user } = useAuth();

  // ── View state ──
  const [viewMode, setViewMode] = useState<ViewMode>("inbox");

  // ── Inbox state ──
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [inboxLoading, setInboxLoading] = useState(true);
  const [inboxFilter, setInboxFilter] = useState<InboxFilter>("all");
  const [inboxQuery, setInboxQuery] = useState("");
  const [profiles, setProfiles] = useState<Record<string, StudentProfile>>({});
  const [blockedUids, setBlockedUids] = useState<string[]>([]);

  // ── Chat state ──
  const [activeConversation, setActiveConversation] =
    useState<Conversation | null>(null);
  const [chatPartnerName, setChatPartnerName] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [optimistic, setOptimistic] = useState<OptimisticMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [chatLoading, setChatLoading] = useState(true);
  const [infoVisible, setInfoVisible] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const scrollToBottom = useCallback((animated = true) => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated });
    }, 50);
  }, []);

  // ── Live partner profile for the chat header ──
  const partnerUid = useMemo(() => {
    if (viewMode !== "chat" || !activeConversation) return undefined;
    if (activeConversation.type === "peer") {
      return activeConversation.participants?.find((u) => u !== user?.uid);
    }
    return activeConversation.adminId || undefined;
  }, [viewMode, activeConversation, user?.uid]);

  const liveProfile = useStudentProfile(partnerUid);
  const headerName = liveProfile?.fullName || chatPartnerName;

  // ── Listen for the user's conversations (peer + admin/guidance) ──
  useEffect(() => {
    if (!user?.uid || viewMode !== "inbox") return;
    const unsub = listenForConversations(
      user.uid,
      "student",
      (convs) => {
        setConversations(convs);
        setInboxLoading(false);
      },
      () => setInboxLoading(false),
    );
    return () => unsub();
  }, [user?.uid, viewMode]);

  // ── Load the list of users blocked by the student ──
  useEffect(() => {
    if (!user?.uid) return;
    let cancelled = false;
    getBlockedUsers(user.uid).then((uids) => {
      if (!cancelled) setBlockedUids(uids);
    });
    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  // ── Resolve partner profiles (name, department, avatar) for list rows ──
  useEffect(() => {
    if (!user?.uid || viewMode !== "inbox") return;
    const uids = new Set<string>();
    conversations.forEach((c) => {
      const other =
        c.type === "peer"
          ? c.participants?.find((u) => u !== user.uid)
          : c.adminId;
      if (other) uids.add(other);
    });

    const load = async () => {
      const map: Record<string, StudentProfile> = {};
      for (const uid of uids) {
        if (profiles[uid]) continue;
        let snap = await getDoc(doc(db, "users", uid));
        if (snap.exists()) {
          map[uid] = normalizeProfile(uid, snap.data());
        } else {
          snap = await getDoc(doc(db, "admins", uid));
          if (snap.exists()) map[uid] = normalizeProfile(uid, snap.data());
        }
      }
      if (Object.keys(map).length > 0) {
        setProfiles((prev) => ({ ...prev, ...map }));
      }
    };
    load();
  }, [conversations, profiles, user?.uid, viewMode]);

  // ── Chat: listen for messages ──
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

  const allMessages: OptimisticMessage[] = [
    ...messages,
    ...optimistic.filter((o) => !messages.some((m) => m.id === o.id)),
  ];

  // Chat rows = message rows with day-separator headers inserted between days.
  const chatRows = useMemo(() => {
    type Row =
      | { kind: "date"; id: string; label: string }
      | { kind: "msg"; id: string; msg: OptimisticMessage };
    const rows: Row[] = [];
    let lastDay = "";
    allMessages.forEach((m) => {
      const key = dayKey(m.createdAt);
      if (key !== lastDay) {
        rows.push({ kind: "date", id: `date-${key}`, label: formatDayLabel(m.createdAt) });
        lastDay = key;
      }
      rows.push({ kind: "msg", id: m.id, msg: m });
    });
    return rows;
  }, [allMessages]);

  // Conversations visible to the student: hidden conversations and peer
  // conversations with a blocked participant are excluded. Guidance/admin
  // conversations are never blocked.
  const availableConversations = useMemo(() => {
    if (!user?.uid) return [];
    return conversations.filter((c) => {
      if (c.hiddenBy?.includes(user.uid!)) return false;
      if (c.type === "peer") {
        const other = c.participants?.find((u) => u !== user.uid);
        if (other && blockedUids.includes(other)) return false;
      }
      return true;
    });
  }, [conversations, user?.uid, blockedUids]);

  // Counts for the All / Unread / Peers / Guidance filter pills.
  const filterCounts = useMemo<Record<InboxFilter, number>>(() => {
    if (!user?.uid) return { all: 0, unread: 0, peers: 0, guidance: 0 };
    const peers = availableConversations.filter(
      (c) => c.type === "peer",
    ).length;
    const unread = availableConversations.filter((c) =>
      c.unreadBy?.includes(user.uid!),
    ).length;
    return {
      all: availableConversations.length,
      unread,
      peers,
      guidance: availableConversations.length - peers,
    };
  }, [availableConversations, user?.uid]);

  // ── Filtered conversation list ──
  const filteredConversations = useMemo(() => {
    if (!user?.uid) return [];
    let list = availableConversations;
    if (inboxFilter === "unread")
      list = list.filter((c) => c.unreadBy?.includes(user.uid!));
    if (inboxFilter === "peers") list = list.filter((c) => c.type === "peer");
    if (inboxFilter === "guidance")
      list = list.filter((c) => c.type !== "peer");

    const q = inboxQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((c) => {
        const isPeer = c.type === "peer";
        const other = isPeer
          ? c.participants?.find((u) => u !== user.uid)
          : c.adminId;
        const prof = other ? profiles[other] : undefined;
        const name = isPeer
          ? prof?.fullName || c.participantNames?.[other || ""] || ""
          : prof?.fullName || c.adminName || "";
        const dept = prof?.department || "";
        const haystack = [name, dept, c.lastMessage].join(" ").toLowerCase();
        return haystack.includes(q);
      });
    }
    return list;
  }, [availableConversations, inboxFilter, inboxQuery, profiles, user?.uid]);

  // Pinned conversations sort to the top of the inbox.
  const orderedConversations = useMemo(() => {
    const isPinned = (c: Conversation) =>
      !!user?.uid && !!c.pinnedBy?.includes(user.uid);
    const pinned = filteredConversations.filter(isPinned);
    const rest = filteredConversations.filter((c) => !isPinned(c));
    return { pinned, recent: rest };
  }, [filteredConversations, user?.uid]);

  const unreadCount = conversations.filter((c) =>
    c.unreadBy?.includes(user?.uid || ""),
  ).length;

  // ── Open a chat from the inbox list ──
  const openChat = (conversation: Conversation) => {
    const isPeer = conversation.type === "peer";
    const other = isPeer
      ? conversation.participants?.find((u) => u !== user?.uid)
      : conversation.adminId;
    const prof = other ? profiles[other] : undefined;
    const name = isPeer
      ? prof?.fullName ||
        getPeerName(conversation, user?.uid || "") ||
        "Student"
      : prof?.fullName || conversation.adminName || "Support";

    setActiveConversation(conversation);
    setChatPartnerName(name);
    setMessages([]);
    setOptimistic([]);
    setChatLoading(true);
    setViewMode("chat");
  };

  // ── Chat header metadata (name, role line, verified status) ──
  const chatMeta = useMemo(() => {
    const conv = activeConversation;
    if (!conv || !user?.uid) return { role: "", verified: false };
    const isPeer = conv.type === "peer";
    const other = isPeer
      ? conv.participants?.find((u) => u !== user.uid)
      : conv.adminId;
    const prof = other ? profiles[other] : liveProfile;
    if (isPeer) {
      return {
        role: [prof?.department, prof?.yearLevel].filter(Boolean).join(" · "),
        verified: false,
      };
    }
    return {
      role: prof?.department || "University Guidance Office",
      verified: true,
    };
  }, [activeConversation, user?.uid, profiles, liveProfile]);

  const chatStartedAt = useMemo(() => {
    if (messages.length > 0) return messages[0]?.createdAt;
    return activeConversation?.lastMessageAt;
  }, [messages, activeConversation]);

  // ── Pin toggle for a conversation ──
  const handleTogglePin = async (conversation: Conversation) => {
    if (!user?.uid) return;
    const isPinned = !!conversation.pinnedBy?.includes(user.uid);
    const id = conversation.id;
    setConversations((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              pinnedBy: isPinned
                ? (c.pinnedBy || []).filter((u) => u !== user.uid)
                : [...(c.pinnedBy || []), user.uid],
            }
          : c,
      ),
    );
    if (activeConversation?.id === id) {
      setActiveConversation((prev) =>
        prev
          ? {
              ...prev,
              pinnedBy: isPinned
                ? (prev.pinnedBy || []).filter((u) => u !== user.uid)
                : [...(prev.pinnedBy || []), user.uid],
            }
          : prev,
      );
    }
    try {
      await togglePinConversation(id, user.uid);
    } catch (err) {
      console.error("Failed to toggle pin:", err);
    }
  };

  // ── Report a conversation ──
  const handleReport = (conversation: Conversation) => {
    if (!user?.uid) return;
    Alert.alert(
      "Report conversation",
      "Please select a reason. A counselor will review your report.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Harassment or bullying",
          onPress: () => submitReport(conversation, "Harassment or bullying"),
        },
        {
          text: "Inappropriate content",
          onPress: () => submitReport(conversation, "Inappropriate content"),
        },
        {
          text: "Spam",
          onPress: () => submitReport(conversation, "Spam"),
        },
        {
          text: "Other",
          onPress: () => submitReport(conversation, "Other"),
        },
      ],
    );
  };

  const submitReport = async (
    conversation: Conversation,
    reason: string,
  ) => {
    if (!user?.uid) return;
    const isPeer = conversation.type === "peer";
    const other = isPeer
      ? conversation.participants?.find((u) => u !== user.uid)
      : conversation.adminId;
    if (!other) return;
    try {
      await reportConversation({
        conversationId: conversation.id,
        reporterUid: user.uid,
        reportedUid: other,
        type: isPeer ? "peer" : "admin",
        reason,
      });
      Alert.alert(
        "Report submitted",
        "Thank you. A counselor will review this conversation.",
      );
    } catch (err) {
      console.error("Failed to report:", err);
      Alert.alert("Could not submit report", "Please try again later.");
    }
  };

  // ── Block a peer (only available for peer conversations) ──
  const handleBlock = (conversation: Conversation) => {
    if (!user?.uid || conversation.type !== "peer") return;
    const other = conversation.participants?.find((u) => u !== user.uid);
    if (!other) return;
    const name =
      conversation.participantNames?.[other] ||
      profiles[other]?.fullName ||
      "this student";
    Alert.alert(
      "Block this student?",
      `${name} will no longer be able to message you, and their conversation will be removed from your inbox.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Block",
          style: "destructive",
          onPress: async () => {
            try {
              await blockUser(user.uid, other);
              setBlockedUids((prev) =>
                prev.includes(other) ? prev : [...prev, other],
              );
              if (activeConversation?.id === conversation.id) {
                setViewMode("inbox");
                setActiveConversation(null);
                setMessages([]);
                setOptimistic([]);
              }
              Alert.alert("Blocked", `${name} has been blocked.`);
            } catch (err) {
              console.error("Failed to block:", err);
            }
          },
        },
      ],
    );
  };

  // ── Delete/hide a conversation for this user only ──
  const handleDeleteConversation = (conversation: Conversation) => {
    if (!user?.uid) return;
    Alert.alert(
      "Delete conversation?",
      "This removes the conversation from your inbox only. The other participant won't see your future messages here.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await hideConversation(conversation.id, user.uid);
              setConversations((prev) =>
                prev.map((c) =>
                  c.id === conversation.id
                    ? { ...c, hiddenBy: [...(c.hiddenBy || []), user.uid] }
                    : c,
                ),
              );
              if (activeConversation?.id === conversation.id) {
                setViewMode("inbox");
                setActiveConversation(null);
                setMessages([]);
                setOptimistic([]);
              }
            } catch (err) {
              console.error("Failed to delete conversation:", err);
            }
          },
        },
      ],
    );
  };

  const handleSend = useCallback(async () => {
    if (!inputText.trim() || !activeConversation || !user?.uid || sending)
      return;
    const text = inputText.trim();
    const tempId = `temp_${Date.now()}`;
    setInputText("");
    setOptimistic((prev) => [
      ...prev,
      {
        id: tempId,
        senderId: user.uid,
        text,
        createdAt: Date.now(),
        isAdmin: false,
        failed: false,
      },
    ]);
    setSending(true);
    try {
      const realId = await sendMessage(
        activeConversation.id,
        text,
        user.uid,
        false,
      );
      setOptimistic((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, id: realId } : m)),
      );
    } catch {
      setOptimistic((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, failed: true } : m)),
      );
    } finally {
      setSending(false);
    }
  }, [inputText, activeConversation, user?.uid, sending]);

  const handleRetry = async (msg: OptimisticMessage) => {
    if (!activeConversation || !user?.uid) return;
    setOptimistic((prev) =>
      prev.map((m) => (m.id === msg.id ? { ...m, failed: false } : m)),
    );
    try {
      const realId = await sendMessage(
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
  };

  const formatTime = (ts: number) => {
    const diff = Date.now() - ts;
    const d = new Date(ts);
    if (diff < 86400000)
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  const handleBack = () => {
    if (viewMode === "chat") {
      setViewMode("inbox");
      setActiveConversation(null);
      setMessages([]);
      setOptimistic([]);
    }
  };

  // ─── Inbox: conversation row ───────────────────────────────────────────────
  const renderConversation = ({ item }: { item: Conversation }) => {
    const isPeer = item.type === "peer";
    const other = isPeer
      ? item.participants?.find((u) => u !== user?.uid)
      : item.adminId;
    const prof = other ? profiles[other] : undefined;
    const name = isPeer
      ? prof?.fullName ||
        item.participantNames?.[other || ""] ||
        getPeerName(item, user?.uid || "") ||
        "Student"
      : prof?.fullName || item.adminName || "Support";
    const subtitle = isPeer
      ? [prof?.department, prof?.yearLevel].filter(Boolean).join(" · ") ||
        "Peer"
      : prof?.department || "University Support";
    const hasUnread = item.unreadBy?.includes(user?.uid || "");
    const isPinned = !!user?.uid && !!item.pinnedBy?.includes(user.uid);

    return (
      <Pressable
        style={[styles.convCard, hasUnread && styles.convCardUnread]}
        onPress={() => openChat(item)}
        onLongPress={() => handleTogglePin(item)}
        delayLongPress={350}
      >
        <View
          style={[
            styles.convAvatar,
            isPeer ? styles.convAvatarPeer : styles.convAvatarAdmin,
          ]}
        >
          {prof?.profileImage ? (
            <Image
              source={{ uri: prof.profileImage }}
              style={{ width: 46, height: 46, borderRadius: 23 }}
            />
          ) : (
            <Ionicons
              name={isPeer ? "person" : "shield-checkmark"}
              size={22}
              color={isPeer ? "#8A63D2" : "#6D5BBF"}
            />
          )}
        </View>

        <View style={styles.convInfo}>
          <View style={styles.convTop}>
            <View style={styles.convNameRow}>
              {isPinned && (
                <Ionicons name="pin" size={13} color="#8A63D2" />
              )}
              <Text
                style={[styles.convName, hasUnread && styles.convNameBold]}
                numberOfLines={1}
              >
                {name}
              </Text>
            </View>
            <Text
              style={[
                styles.convTime,
                hasUnread && styles.convTimeUnread,
              ]}
            >
              {item.lastMessageAt
                ? formatConversationTime(item.lastMessageAt)
                : ""}
            </Text>
          </View>

          <View style={styles.convSubRow}>
            <Text
              style={[styles.convSubtitle, hasUnread && styles.convSubtitleUnread]}
              numberOfLines={1}
            >
              {subtitle}
            </Text>
            {!isPeer && (
              <View style={styles.verifiedPill}>
                <Ionicons name="shield-checkmark" size={11} color="#6D5BBF" />
                <Text style={styles.verifiedPillText}>Verified University Support</Text>
              </View>
            )}
          </View>

          <Text
            style={[styles.convPreview, hasUnread && styles.convPreviewBold]}
            numberOfLines={1}
          >
            {item.lastMessage || "No messages yet"}
          </Text>
        </View>

        {hasUnread && <View style={styles.unreadDot} />}
      </Pressable>
    );
  };

  // ─── Inbox view ────────────────────────────────────────────────────────────
  const renderInbox = () => (
    <>
      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color="#94A3B8" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search conversations..."
          placeholderTextColor="#94A3B8"
          value={inboxQuery}
          onChangeText={setInboxQuery}
        />
        {inboxQuery.length > 0 && (
          <Pressable onPress={() => setInboxQuery("")}>
            <Ionicons name="close-circle" size={18} color="#94A3B8" />
          </Pressable>
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterBar}
        contentContainerStyle={styles.filterBarRow}
      >
        {FILTERS.map((f) => {
          const sel = inboxFilter === f.key;
          return (
            <Pressable
              key={f.key}
              accessibilityRole="button"
              accessibilityLabel={`Show ${f.label.toLowerCase()} conversations`}
              accessibilityState={{ selected: sel }}
              style={[styles.filterPill, sel && styles.filterPillActive]}
              onPress={() => setInboxFilter(f.key)}
            >
              <Ionicons
                name={f.icon as any}
                size={14}
                color={sel ? "#FFFFFF" : "#94A3B8"}
              />
              <Text
                style={[styles.filterText, sel && styles.filterTextActive]}
              >
                {f.label}
              </Text>
              <View
                style={[styles.filterCount, sel && styles.filterCountActive]}
              >
                <Text
                  style={[
                    styles.filterCountText,
                    sel && styles.filterCountTextActive,
                  ]}
                >
                  {filterCounts[f.key]}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      {inboxLoading ? (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color="#8A63D2" />
          <Text style={styles.emptyText}>Loading conversations...</Text>
        </View>
      ) : conversations.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="chatbubbles-outline" size={48} color="#9CA3AF" />
          <Text style={styles.emptyTitle}>No conversations yet</Text>
          <Text style={styles.emptyText}>
            Your messages will appear here.
          </Text>
        </View>
      ) : filteredConversations.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons
            name={
              inboxQuery
                ? "search-outline"
                : inboxFilter === "unread"
                  ? "mail-unread-outline"
                  : inboxFilter === "peers"
                    ? "people-outline"
                    : inboxFilter === "guidance"
                      ? "shield-checkmark-outline"
                      : "chatbubbles-outline"
            }
            size={48}
            color="#9CA3AF"
          />
          <Text style={styles.emptyTitle}>
            {inboxQuery
              ? "No matches"
              : inboxFilter === "unread"
                ? "You're all caught up!"
                : inboxFilter === "peers"
                  ? "No peer conversations yet"
                  : inboxFilter === "guidance"
                    ? "No guidance conversations yet"
                    : "No conversations yet"}
          </Text>
          <Text style={styles.emptyText}>
            {inboxQuery
              ? `No conversations match "${inboxQuery}".`
              : inboxFilter === "unread"
                ? "There are no unread messages."
                : inboxFilter === "peers"
                  ? "Messages from other students will appear here."
                  : inboxFilter === "guidance"
                    ? "Messages from your guidance team will appear here."
                    : "Your messages will appear here."}
          </Text>
        </View>
      ) : (
        <SectionList
          sections={[
            ...(orderedConversations.pinned.length > 0
              ? [{ title: "Pinned", data: orderedConversations.pinned }]
              : []),
            ...(orderedConversations.recent.length > 0
              ? [{ title: "Recent", data: orderedConversations.recent }]
              : []),
          ]}
          keyExtractor={(item) => item.id}
          renderItem={renderConversation}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Ionicons
                name={section.title === "Pinned" ? "pin" : "time-outline"}
                size={13}
                color="#8A63D2"
              />
              <Text style={styles.sectionHeaderText}>
                {section.title.toUpperCase()}
              </Text>
            </View>
          )}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={styles.convList}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={
            <View style={styles.inboxPrivacyNote}>
              <Ionicons name="shield-checkmark" size={14} color="#6D5BBF" />
              <Text style={styles.inboxPrivacyNoteText}>
                {INBOX_PRIVACY_NOTE}
              </Text>
            </View>
          }
        />
      )}
    </>
  );

  // ─── Chat view (unchanged flow) ────────────────────────────────────────────
  const renderChat = () => (
    <>
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
          <Ionicons name="chatbubble-outline" size={48} color="#9CA3AF" />
          <Text style={styles.emptyTitle}>Start the conversation</Text>
          <Text style={styles.emptyText}>
            You're in a private space to talk. You can share what's on your
            mind, ask for support, or simply start a conversation.
          </Text>
          <Text style={styles.privacyNote}>{PRIVACY_NOTE}</Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={chatRows}
          keyExtractor={(item) => item.id}
          renderItem={renderChatRow}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => scrollToBottom(false)}
        />
      )}

      <View style={styles.inputBar}>
        <TextInput
          style={styles.textInput}
          placeholder="Type a message..."
          placeholderTextColor="#94A3B8"
          value={inputText}
          onChangeText={setInputText}
          multiline
          maxLength={1000}
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

  const renderChatRow = ({
    item,
  }: {
    item:
      | { kind: "date"; id: string; label: string }
      | { kind: "msg"; id: string; msg: OptimisticMessage };
  }) => {
    if (item.kind === "date") {
      return (
        <View style={styles.dateSeparator}>
          <View style={styles.dateLine} />
          <Text style={styles.dateSeparatorText}>{item.label}</Text>
          <View style={styles.dateLine} />
        </View>
      );
    }
    const m = item.msg;
    const isMine = m.senderId === user?.uid;
    return (
      <View
        style={[styles.bubbleRow, isMine ? styles.bubbleRowRight : styles.bubbleRowLeft]}
      >
        <View
          style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}
        >
          <Text style={[styles.bubbleText, isMine && styles.bubbleTextMine]}>
            {m.text}
          </Text>
          <View style={styles.bubbleFooter}>
            <Text style={[styles.bubbleTime, isMine && styles.bubbleTimeMine]}>
              {formatTime(m.createdAt)}
            </Text>
            {m.failed && (
              <Pressable onPress={() => handleRetry(m)}>
                <Text style={styles.retryText}>Retry</Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior="padding"
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        <View style={styles.headerGradient}>
          <View style={styles.header}>
            {viewMode === "inbox" ? (
              <View style={{ width: 40 }} />
            ) : (
              <Pressable style={styles.backBtn} onPress={handleBack}>
                <Ionicons name="arrow-back" size={22} color="#7C4DCC" />
              </Pressable>
            )}
            <View style={styles.headerTitleWrap}>
              {viewMode === "chat" &&
                (liveProfile?.profileImage ? (
                  <Image
                    source={{ uri: liveProfile.profileImage }}
                    style={styles.headerAvatar}
                  />
                ) : (
                  <View style={[styles.headerAvatar, styles.headerAvatarFallback]}>
                    <Ionicons name="person" size={16} color="white" />
                  </View>
                ))}
              <View style={styles.headerTitleCol}>
                <Text style={styles.headerTitle} numberOfLines={1}>
                  {viewMode === "chat" ? headerName : "Inbox"}
                </Text>
                {viewMode === "chat" && chatMeta.role ? (
                  <View style={styles.headerMetaRow}>
                    <Text style={styles.headerSub} numberOfLines={1}>
                      {chatMeta.role}
                    </Text>
                    {chatMeta.verified && (
                      <View style={styles.headerVerifiedPill}>
                        <Ionicons name="shield-checkmark" size={10} color="#7C4DCC" />
                        <Text style={styles.headerVerifiedText}>Verified</Text>
                      </View>
                    )}
                  </View>
                ) : null}
              </View>
            </View>
            {viewMode === "inbox" ? (
              <View style={{ width: 40 }} />
            ) : viewMode === "chat" ? (
              <View style={styles.headerActions}>
                <Pressable
                  style={styles.backBtn}
                  onPress={() => setInfoVisible(true)}
                  hitSlop={8}
                >
                  <Ionicons name="information-circle-outline" size={22} color="#7C4DCC" />
                </Pressable>
                <Pressable
                  style={styles.backBtn}
                  onPress={() => setMenuVisible(true)}
                  hitSlop={8}
                >
                  <Ionicons name="ellipsis-vertical" size={22} color="#7C4DCC" />
                </Pressable>
              </View>
            ) : (
              <View style={{ width: 40 }} />
            )}
          </View>

          {viewMode === "inbox" && (
            <View style={styles.headerSubRow}>
              <Text style={styles.headerSubtitle}>
                Your private space for support and conversations
              </Text>
              <View style={styles.headerStats}>
                <Text style={styles.headerStatsText}>
                  {conversations.length} conversation
                  {conversations.length === 1 ? "" : "s"}
                </Text>
                <Text style={styles.headerStatsDot}>·</Text>
                <Text style={styles.headerStatsText}>
                  {unreadCount} unread
                </Text>
              </View>
            </View>
          )}
        </View>

        {viewMode === "inbox" ? renderInbox() : renderChat()}
      </KeyboardAvoidingView>

      {/* ─── Conversation info modal ─────────────────────────────── */}
      <Modal
        visible={infoVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setInfoVisible(false)}
      >
        <Pressable
          style={styles.infoOverlay}
          onPress={() => setInfoVisible(false)}
        >
          <Pressable style={styles.infoCard} onPress={() => {}}>
            <View style={styles.infoHandle} />
            <Text style={styles.infoTitle}>Conversation Information</Text>

            <View style={styles.infoBlock}>
              <Text style={styles.infoLabel}>Participant</Text>
              <View style={styles.infoParticipant}>
                <View
                  style={[
                    styles.infoAvatar,
                    activeConversation?.type === "peer"
                      ? styles.convAvatarPeer
                      : styles.convAvatarAdmin,
                  ]}
                >
                  {liveProfile?.profileImage ? (
                    <Image
                      source={{ uri: liveProfile.profileImage }}
                      style={{ width: 44, height: 44, borderRadius: 22 }}
                    />
                  ) : (
                    <Ionicons
                      name={
                        activeConversation?.type === "peer"
                          ? "person"
                          : "shield-checkmark"
                      }
                      size={20}
                      color={
                        activeConversation?.type === "peer"
                          ? "#8A63D2"
                          : "#6D5BBF"
                      }
                    />
                  )}
                </View>
                <View style={styles.infoParticipantText}>
                  <Text style={styles.infoName}>{headerName}</Text>
                  {chatMeta.role ? (
                    <Text style={styles.infoRole}>{chatMeta.role}</Text>
                  ) : null}
                  {chatMeta.verified && (
                    <View style={styles.verifiedPill}>
                      <Ionicons name="shield-checkmark" size={11} color="#6D5BBF" />
                      <Text style={styles.verifiedPillText}>
                        Verified University Support
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </View>

            <View style={styles.infoDivider} />

            <View style={styles.infoBlock}>
              <Text style={styles.infoLabel}>Conversation started</Text>
              <Text style={styles.infoValue}>
                {formatStartedDate(chatStartedAt)}
              </Text>
            </View>

            <View style={styles.infoDivider} />

            <View style={styles.infoBlock}>
              <Text style={styles.infoLabel}>Privacy</Text>
              <Text style={styles.infoValue}>
                This conversation is private between participants. MindCare is
                not an emergency service.
              </Text>
            </View>

            <View style={styles.infoDivider} />

            <View style={styles.infoBlock}>
              <Text style={styles.infoLabel}>Actions</Text>
              <Pressable
                style={styles.infoActionRow}
                onPress={() => {
                  if (activeConversation) handleTogglePin(activeConversation);
                }}
              >
                <Ionicons
                  name={
                    activeConversation?.pinnedBy?.includes(user?.uid || "")
                      ? "pin"
                      : "pin-outline"
                  }
                  size={18}
                  color="#8A63D2"
                />
                <Text style={styles.infoActionText}>
                  {activeConversation?.pinnedBy?.includes(user?.uid || "")
                    ? "Unpin conversation"
                    : "Pin conversation"}
                </Text>
              </Pressable>
              <Pressable
                style={styles.infoActionRow}
                onPress={() => {
                  if (activeConversation) {
                    setInfoVisible(false);
                    handleReport(activeConversation);
                  }
                }}
              >
                <Ionicons name="flag-outline" size={18} color="#8A63D2" />
                <Text style={styles.infoActionText}>Report conversation</Text>
              </Pressable>
              {activeConversation?.type === "peer" && (
                <Pressable
                  style={styles.infoActionRow}
                  onPress={() => {
                    if (activeConversation) {
                      setInfoVisible(false);
                      handleBlock(activeConversation);
                    }
                  }}
                >
                  <Ionicons name="ban-outline" size={18} color="#EF4444" />
                  <Text style={[styles.infoActionText, { color: "#EF4444" }]}>
                    Block student
                  </Text>
                </Pressable>
              )}
              <Pressable
                style={styles.infoActionRow}
                onPress={() => {
                  if (activeConversation) {
                    setInfoVisible(false);
                    handleDeleteConversation(activeConversation);
                  }
                }}
              >
                <Ionicons name="trash-outline" size={18} color="#EF4444" />
                <Text style={[styles.infoActionText, { color: "#EF4444" }]}>
                  Delete conversation
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ─── Chat ellipsis menu ────────────────────────────────────── */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <Pressable
          style={styles.menuOverlay}
          onPress={() => setMenuVisible(false)}
        >
          <View style={styles.menuCard}>
            <Pressable
              style={styles.menuRow}
              onPress={() => {
                setMenuVisible(false);
                if (activeConversation) handleTogglePin(activeConversation);
              }}
            >
              <Ionicons
                name={
                  activeConversation?.pinnedBy?.includes(user?.uid || "")
                    ? "pin"
                    : "pin-outline"
                }
                size={18}
                color="#8A63D2"
              />
              <Text style={styles.menuLabel}>
                {activeConversation?.pinnedBy?.includes(user?.uid || "")
                  ? "Unpin conversation"
                  : "Pin conversation"}
              </Text>
            </Pressable>
            <Pressable
              style={styles.menuRow}
              onPress={() => {
                setMenuVisible(false);
                if (activeConversation) handleReport(activeConversation);
              }}
            >
              <Ionicons name="flag-outline" size={18} color="#8A63D2" />
              <Text style={styles.menuLabel}>Report conversation</Text>
            </Pressable>
            {activeConversation?.type === "peer" && (
              <Pressable
                style={styles.menuRow}
                onPress={() => {
                  setMenuVisible(false);
                  if (activeConversation) handleBlock(activeConversation);
                }}
              >
                <Ionicons name="ban-outline" size={18} color="#EF4444" />
                <Text style={[styles.menuLabel, { color: "#EF4444" }]}>
                  Block student
                </Text>
              </Pressable>
            )}
            <Pressable
              style={styles.menuRow}
              onPress={() => {
                setMenuVisible(false);
                if (activeConversation) handleDeleteConversation(activeConversation);
              }}
            >
              <Ionicons name="trash-outline" size={18} color="#EF4444" />
              <Text style={[styles.menuLabel, { color: "#EF4444" }]}>
                Delete conversation
              </Text>
            </Pressable>
            <Pressable
              style={styles.menuRow}
              onPress={() => setMenuVisible(false)}
            >
              <Ionicons name="close-circle-outline" size={18} color="#64748B" />
              <Text style={styles.menuLabel}>Close</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F0D15" },

  // Header
  headerGradient: {
    backgroundColor: "#1E1B2E",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(139, 92, 246, 0.2)",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 6,
  },
  headerSubRow: {
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 2,
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#9CA3AF",
    textAlign: "center",
  },
  headerStats: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  headerStatsText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#A78BFA",
  },
  headerStatsDot: { fontSize: 11, color: "#9CA3AF" },
  backBtn: { width: 40, height: 40, justifyContent: "center", alignItems: "center" },
  headerTitleWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  headerTitleCol: { alignItems: "center", flexShrink: 1 },
  headerMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 1,
  },
  headerSub: {
    fontSize: 11,
    color: "#9CA3AF",
    maxWidth: 180,
  },
  headerVerifiedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(139, 92, 246, 0.15)",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
  },
  headerVerifiedText: { fontSize: 9, fontWeight: "700", color: "#A78BFA" },
  headerActions: { flexDirection: "row", alignItems: "center" },
  headerAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: "#7A54C4" },
  headerAvatarFallback: { alignItems: "center", justifyContent: "center" },
  headerTitle: { color: "#FFFFFF", fontSize: 18, fontWeight: "800", flexShrink: 1 },

  // Search + filters
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1E1B2E",
    margin: 16,
    marginBottom: 8,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 46,
    gap: 8,
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.2)",
  },
  searchInput: { flex: 1, fontSize: 15, color: "#FFFFFF", paddingVertical: 0 },
  filterBar: { marginBottom: 8 },
  filterBarRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
  },
  filterPill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingHorizontal: 14,
    minHeight: 44,
    borderRadius: 22,
    backgroundColor: "#1E1B2E",
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.2)",
  },
  filterPillActive: { backgroundColor: "#6D28D9", borderColor: "#6D28D9" },
  filterText: { fontSize: 13, fontWeight: "500", color: "#9CA3AF" },
  filterTextActive: { color: "#FFFFFF", fontWeight: "700" },
  filterCount: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2A2740",
  },
  filterCountActive: { backgroundColor: "rgba(255, 255, 255, 0.22)" },
  filterCountText: { fontSize: 11, fontWeight: "700", color: "#94A3B8" },
  filterCountTextActive: { color: "#FFFFFF" },

  // Conversation list
  convList: { paddingHorizontal: 16, paddingBottom: 24 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingTop: 8,
    paddingBottom: 6,
  },
  sectionHeaderText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#A78BFA",
    letterSpacing: 0.5,
  },
  convCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1E1B2E",
    borderRadius: 16,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.2)",
    gap: 12,
  },
  convCardUnread: {
    backgroundColor: "#26223A",
    borderColor: "rgba(139, 92, 246, 0.4)",
  },
  convAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: "center",
    alignItems: "center",
  },
  convAvatarPeer: { backgroundColor: "rgba(139, 92, 246, 0.2)" },
  convAvatarAdmin: { backgroundColor: "rgba(139, 92, 246, 0.15)" },
  convInfo: { flex: 1 },
  convTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 2,
  },
  convNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flex: 1,
  },
  convName: { fontSize: 15, fontWeight: "600", color: "#FFFFFF", flexShrink: 1 },
  convNameBold: { fontWeight: "800", color: "#A78BFA" },
  convTime: { fontSize: 11, color: "#9CA3AF", marginLeft: 8 },
  convTimeUnread: { color: "#A78BFA", fontWeight: "700" },
  convSubRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 2,
  },
  convSubtitle: { fontSize: 12, color: "#9CA3AF", flexShrink: 1 },
  convSubtitleUnread: { color: "#D1D5DB", fontWeight: "600" },
  verifiedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(139, 92, 246, 0.15)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  verifiedPillText: { fontSize: 10, fontWeight: "700", color: "#A78BFA" },
  convPreview: { fontSize: 13, color: "#9CA3AF" },
  convPreviewBold: { fontWeight: "600", color: "#D1D5DB" },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#8B5CF6",
    marginLeft: 4,
  },
  inboxPrivacyNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "rgba(139, 92, 246, 0.12)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.2)",
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 8,
  },
  inboxPrivacyNoteText: {
    flex: 1,
    fontSize: 11,
    color: "#A78BFA",
    lineHeight: 16,
  },

  // Empty state
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 40,
  },
  emptyTitle: { fontSize: 17, fontWeight: "700", color: "#FFFFFF" },
  emptyText: { fontSize: 14, color: "#9CA3AF", textAlign: "center" },
  privacyNote: {
    fontSize: 12,
    color: "#9CA3AF",
    textAlign: "center",
    fontStyle: "italic",
    marginTop: 4,
  },

  // Reminder banner
  reminderBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "rgba(139, 92, 246, 0.12)",
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.2)",
  },
  reminderText: { flex: 1, fontSize: 12, color: "#A78BFA", lineHeight: 17 },

  // Messages
  messagesList: { flexGrow: 1, paddingVertical: 12, paddingHorizontal: 16 },
  dateSeparator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginVertical: 14,
  },
  dateLine: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(139, 92, 246, 0.2)",
    flex: 1,
    maxWidth: 60,
  },
  dateSeparatorText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#A78BFA",
    letterSpacing: 0.5,
  },
  bubbleRow: { marginBottom: 8, flexDirection: "row" },
  bubbleRowRight: { justifyContent: "flex-end" },
  bubbleRowLeft: { justifyContent: "flex-start" },
  bubble: { maxWidth: "78%", borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleMine: { backgroundColor: "#8B5CF6", borderBottomRightRadius: 4 },
  bubbleTheirs: {
    backgroundColor: "#1E1B2E",
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.2)",
  },
  bubbleText: { fontSize: 15, color: "#FFFFFF", lineHeight: 20 },
  bubbleTextMine: { color: "white" },
  bubbleFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 6,
    marginTop: 4,
  },
  bubbleTime: { fontSize: 10, color: "#9CA3AF" },
  bubbleTimeMine: { color: "rgba(255,255,255,0.6)" },
  retryText: { fontSize: 11, color: "#EF4444", fontWeight: "600" },

  // Input
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(139, 92, 246, 0.2)",
    backgroundColor: "#1E1B2E",
    gap: 8,
  },
  textInput: {
    flex: 1,
    backgroundColor: "#26223A",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.3)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: "#FFFFFF",
    maxHeight: 100,
  },
  sendBtn: { width: 40, height: 40, justifyContent: "center", alignItems: "center" },
  sendBtnDisabled: { opacity: 0.5 },

  // Conversation info modal
  infoOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  infoCard: {
    backgroundColor: "#1E1B2E",
    borderRadius: 20,
    padding: 20,
  },
  infoHandle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#3B3550",
    marginBottom: 12,
  },
  infoTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: 14,
  },
  infoBlock: { marginBottom: 4 },
  infoLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#A78BFA",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  infoParticipant: { flexDirection: "row", alignItems: "center", gap: 12 },
  infoAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: "center",
    alignItems: "center",
  },
  infoParticipantText: { flex: 1 },
  infoName: { fontSize: 16, fontWeight: "700", color: "#FFFFFF" },
  infoRole: { fontSize: 13, color: "#9CA3AF", marginTop: 2 },
  infoValue: { fontSize: 14, color: "#D1D5DB", lineHeight: 20 },
  infoDivider: {
    height: 1,
    backgroundColor: "rgba(139, 92, 246, 0.15)",
    marginVertical: 14,
  },
  infoActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
  },
  infoActionText: { fontSize: 15, fontWeight: "600", color: "#FFFFFF" },

  // Chat ellipsis menu
  menuOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  menuCard: {
    backgroundColor: "#1E1B2E",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 30,
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(139, 92, 246, 0.15)",
  },
  menuLabel: { fontSize: 15, fontWeight: "600", color: "#FFFFFF" },
});
