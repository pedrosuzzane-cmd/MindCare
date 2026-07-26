/**
 * Student messaging screen — real-time chat with the guidance admin.
 * Features: optimistic send, failed message retry, long-press delete, copy.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
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

import { db } from "@/constants/firebase";
import { useAuth } from "@/hooks/AuthContext";
import {
  deleteMessage,
  getOrCreateConversation,
  listenForMessages,
  markAsRead,
  sendMessage as sendMsg,
} from "@/services/messagingService";
import {
  collection,
  doc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import type { Message, OptimisticMessage } from "@/types/messaging";

export default function StudentMessagesScreen() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [optimistic, setOptimistic] = useState<OptimisticMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  // Context menu state
  const [contextVisible, setContextVisible] = useState(false);
  const [contextMsg, setContextMsg] = useState<Message | null>(null);
  const [showEmoji, setShowEmoji] = useState(false);

  // Merge Firestore messages with optimistic ones
  const allMessages: OptimisticMessage[] = [
    ...messages,
    ...optimistic.filter(
      (o) => !messages.some((m) => m.id === o.id),
    ),
  ];

  // Find the first admin, get/create conversation, listen for messages
  useEffect(() => {
    if (!user?.uid) return;
    let unsubMessages: (() => void) | null = null;

    const init = async () => {
      try {
        const adminsSnap = await getDocs(query(collection(db, "admins")));
        if (adminsSnap.empty) {
          setLoading(false);
          return;
        }

        const firstAdmin = adminsSnap.docs[0];
        const adminId = firstAdmin.id;

        const studentData = (
          await getDocs(
            query(collection(db, "users"), where("__name__", "==", user!.uid)),
          )
        ).docs[0]?.data();

        const studentName =
          user!.displayName || studentData?.fullName || "Student";
        const adminName =
          firstAdmin.data().displayName ||
          firstAdmin.data().fullName ||
          "Guidance Counselor";

        const convId = await getOrCreateConversation(
          user!.uid,
          adminId,
          studentName,
          adminName,
        );
        setConversationId(convId);

        unsubMessages = listenForMessages(convId, (msgs) => {
          setMessages(msgs);
          setLoading(false);
          markAsRead(convId, user!.uid);
          // Clear optimistic messages that are now confirmed by Firestore
          setOptimistic((prev) =>
            prev.filter((o) => !msgs.some((m) => m.id === o.id)),
          );
          setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: false });
          }, 100);
        });
      } catch (err) {
        console.error("Failed to init student chat:", err);
        setLoading(false);
      }
    };

    init();
    return () => {
      unsubMessages?.();
    };
  }, [user?.uid]);

  // ─── Send with optimistic UI ─────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    if (!inputText.trim() || !conversationId || !user?.uid || sending) return;

    const text = inputText.trim();
    const tempId = `temp_${Date.now()}`;
    setInputText("");

    // Optimistic: show message immediately
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
      const realId = await sendMsg(conversationId, text, user.uid, false);
      // Replace temp with real ID (will be filtered out once Firestore listener fires)
      setOptimistic((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, id: realId } : m)),
      );
    } catch (err) {
      console.error("Failed to send:", err);
      // Mark as failed — shows retry button
      setOptimistic((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, failed: true } : m)),
      );
    } finally {
      setSending(false);
    }
  }, [inputText, conversationId, user?.uid, sending]);

  // ─── Retry a failed message ──────────────────────────────────────────────
  const handleRetry = useCallback(
    async (msg: OptimisticMessage) => {
      if (!conversationId || !user?.uid) return;

      setOptimistic((prev) =>
        prev.map((m) => (m.id === msg.id ? { ...m, failed: false } : m)),
      );

      try {
        const realId = await sendMsg(
          conversationId,
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
    [conversationId, user?.uid],
  );

  // ─── Context menu actions ────────────────────────────────────────────────
  const handleCopy = () => {
    if (contextMsg) {
      Clipboard.setString(contextMsg.deleted ? "" : contextMsg.text);
    }
    setContextVisible(false);
  };

  const handleDelete = async () => {
    if (!contextMsg || !conversationId) return;
    setContextVisible(false);

    try {
      await deleteMessage(conversationId, contextMsg.id);
    } catch (err) {
      console.error("Failed to delete:", err);
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // ─── Message bubble ──────────────────────────────────────────────────────
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
            <Pressable style={styles.backBtn} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={22} color="white" />
            </Pressable>
            <View style={styles.headerCenter}>
              <View style={styles.headerAvatar}>
                <Ionicons name="shield-checkmark" size={18} color="#8A63D2" />
              </View>
              <View>
                <Text style={styles.headerTitle}>Guidance Counselor</Text>
                <View style={styles.headerBadge}>
                  <Ionicons name="shield-checkmark" size={10} color="white" />
                  <Text style={styles.headerBadgeText}>Admin</Text>
                </View>
              </View>
            </View>
            <View style={{ width: 40 }} />
          </View>
        </LinearGradient>

        {/* Messages */}
        {loading ? (
          <View style={styles.emptyState}>
            <Ionicons name="chatbubbles-outline" size={48} color="#D1D5DB" />
            <Text style={styles.emptyText}>Loading conversation...</Text>
          </View>
        ) : allMessages.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="chatbubbles-outline" size={48} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>Start a conversation</Text>
            <Text style={styles.emptyText}>
              Send a message to your guidance counselor.
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
  headerCenter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "white",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: { fontSize: 16, fontWeight: "700", color: "white" },
  headerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.25)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginTop: 3,
    alignSelf: "flex-start",
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
