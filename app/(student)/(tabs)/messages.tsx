import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useAuth } from "@/hooks/AuthContext";
import {
  fetchAllUsers,
  getOrCreateConversation,
  getOrCreatePeerConversation,
  listenForMessages,
  markAsRead,
  sendMessage,
} from "@/services/messagingService";
import type {
  Conversation,
  Message,
  OptimisticMessage,
  StudentSearchResult,
} from "@/types/messaging";

type ViewMode = "directory" | "chat";
type DirectoryTab = "peers" | "admins";

export default function InboxTab() {
  const { user } = useAuth();

  const [viewMode, setViewMode] = useState<ViewMode>("directory");
  const [directoryTab, setDirectoryTab] = useState<DirectoryTab>("peers");
  const [peers, setPeers] = useState<StudentSearchResult[]>([]);
  const [admins, setAdmins] = useState<StudentSearchResult[]>([]);
  const [directoryLoading, setDirectoryLoading] = useState(true);
  const [directoryFilter, setDirectoryFilter] = useState("");
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
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

  const filteredPeers = directoryFilter.trim()
    ? peers.filter(
        (p) =>
          p.fullName.toLowerCase().includes(directoryFilter.toLowerCase()) ||
          (p.department || "").toLowerCase().includes(directoryFilter.toLowerCase()),
      )
    : peers;

  const filteredAdmins = directoryFilter.trim()
    ? admins.filter(
        (a) =>
          a.fullName.toLowerCase().includes(directoryFilter.toLowerCase()) ||
          (a.department || "").toLowerCase().includes(directoryFilter.toLowerCase()),
      )
    : admins;

  useEffect(() => {
    if (viewMode !== "directory" || !user?.uid) return;
    let cancelled = false;
    async function load() {
      setDirectoryLoading(true);
      const [peerList, adminList] = await Promise.all([
        fetchAllUsers(user!.uid, "users"),
        fetchAllUsers(user!.uid, "admins"),
      ]);
      if (!cancelled) {
        setPeers(peerList);
        setAdmins(adminList);
        setDirectoryLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [viewMode, user?.uid]);

  useEffect(() => {
    if (!activeConversation?.id) return;
    const unsub = listenForMessages(activeConversation.id, (msgs) => {
      setMessages(msgs);
      setChatLoading(false);
      markAsRead(activeConversation.id, user!.uid);
      setOptimistic((prev) => prev.filter((o) => !msgs.some((m) => m.id === o.id)));
      scrollToBottom(false);
    });
    return () => unsub();
  }, [activeConversation?.id, user?.uid]);

  const allMessages: OptimisticMessage[] = [
    ...messages,
    ...optimistic.filter((o) => !messages.some((m) => m.id === o.id)),
  ];

  const startChat = async (item: StudentSearchResult, isPeer: boolean) => {
    try {
      const myName = user?.displayName || "Student";
      if (isPeer) {
        const convId = await getOrCreatePeerConversation(user!.uid, item.uid, myName, item.fullName);
        setActiveConversation({
          id: convId,
          studentId: "",
          adminId: "",
          studentName: "",
          adminName: "",
          lastMessage: "",
          lastMessageAt: Date.now(),
          unreadBy: [],
          type: "peer",
          participants: [user!.uid, item.uid],
          participantNames: { [user!.uid]: myName, [item.uid]: item.fullName },
        });
      } else {
        const convId = await getOrCreateConversation(user!.uid, item.uid, myName, item.fullName);
        setActiveConversation({
          id: convId,
          studentId: user!.uid,
          adminId: item.uid,
          studentName: myName,
          adminName: item.fullName,
          lastMessage: "",
          lastMessageAt: Date.now(),
          unreadBy: [],
        });
      }
      setChatPartnerName(item.fullName);
      setMessages([]);
      setOptimistic([]);
      setChatLoading(true);
      setViewMode("chat");
    } catch (err) {
      console.error("Failed to start conversation:", err);
    }
  };

  const handleSend = useCallback(async () => {
    if (!inputText.trim() || !activeConversation || !user?.uid || sending) return;
    const text = inputText.trim();
    const tempId = `temp_${Date.now()}`;
    setInputText("");
    setOptimistic((prev) => [...prev, { id: tempId, senderId: user.uid, text, createdAt: Date.now(), isAdmin: false, failed: false }]);
    setSending(true);
    try {
      const realId = await sendMessage(activeConversation.id, text, user.uid, false);
      setOptimistic((prev) => prev.map((m) => (m.id === tempId ? { ...m, id: realId } : m)));
    } catch {
      setOptimistic((prev) => prev.map((m) => (m.id === tempId ? { ...m, failed: true } : m)));
    } finally {
      setSending(false);
    }
  }, [inputText, activeConversation, user?.uid, sending]);

  const formatTime = (ts: number) => {
    const diff = Date.now() - ts;
    const d = new Date(ts);
    if (diff < 86400000) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  const renderUserCard = ({ item, isPeer }: { item: StudentSearchResult; isPeer: boolean }) => (
    <Pressable style={styles.userCard} onPress={() => startChat(item, isPeer)}>
      <View style={[styles.userAvatar, isPeer ? styles.userAvatarPeer : styles.userAvatarAdmin]}>
        {item.profileImage ? (
          <Image source={{ uri: item.profileImage }} style={{ width: 44, height: 44, borderRadius: 22 }} />
        ) : (
          <Ionicons name={isPeer ? "person" : "shield-checkmark"} size={22} color={isPeer ? "#8A63D2" : "#6D5BBF"} />
        )}
      </View>
      <View style={styles.userInfo}>
        <Text style={styles.userName} numberOfLines={1}>{item.fullName}</Text>
        <Text style={styles.userRole} numberOfLines={1}>
          {item.department || (isPeer ? "Student" : "Counselor")}
          {item.yearLevel ? ` \u00B7 ${item.yearLevel}` : ""}
        </Text>
      </View>
      <Ionicons name="chatbubble-outline" size={18} color="#8A63D2" />
    </Pressable>
  );

  const renderMessage = ({ item }: { item: OptimisticMessage }) => {
    const isMine = item.senderId === user?.uid;
    return (
      <View style={[styles.bubbleRow, isMine ? styles.bubbleRowRight : styles.bubbleRowLeft]}>
        <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
          <Text style={[styles.bubbleText, isMine && styles.bubbleTextMine]}>{item.text}</Text>
          <View style={styles.bubbleFooter}>
            <Text style={[styles.bubbleTime, isMine && styles.bubbleTimeMine]}>{formatTime(item.createdAt)}</Text>
            {item.failed && (
              <Pressable onPress={() => handleRetry(item)}>
                <Text style={styles.retryText}>Retry</Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    );
  };

  const handleRetry = async (msg: OptimisticMessage) => {
    if (!activeConversation || !user?.uid) return;
    setOptimistic((prev) => prev.map((m) => (m.id === msg.id ? { ...m, failed: false } : m)));
    try {
      const realId = await sendMessage(activeConversation.id, msg.text, user.uid, false);
      setOptimistic((prev) => prev.map((m) => (m.id === msg.id ? { ...m, id: realId } : m)));
    } catch {
      setOptimistic((prev) => prev.map((m) => (m.id === msg.id ? { ...m, failed: true } : m)));
    }
  };

  const currentList = directoryTab === "peers" ? filteredPeers : filteredAdmins;

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}>
        <LinearGradient colors={["#8A63D2", "#B794F6"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <View style={styles.header}>
            {viewMode === "chat" ? (
              <Pressable style={styles.backBtn} onPress={() => { setViewMode("directory"); setActiveConversation(null); setMessages([]); setOptimistic([]); }}>
                <Ionicons name="arrow-back" size={22} color="white" />
              </Pressable>
            ) : <View style={{ width: 40 }} />}
            <Text style={styles.headerTitle}>
              {viewMode === "chat" ? chatPartnerName : "Inbox"}
            </Text>
            <View style={{ width: 40 }} />
          </View>
        </LinearGradient>

        {viewMode === "directory" ? (
          <>
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

            <View style={styles.tabBar}>
              <Pressable
                style={[styles.tab, directoryTab === "peers" && styles.tabActive]}
                onPress={() => { setDirectoryTab("peers"); setDirectoryFilter(""); }}
              >
                <Ionicons name="people" size={16} color={directoryTab === "peers" ? "#8A63D2" : "#94A3B8"} />
                <Text style={[styles.tabText, directoryTab === "peers" && styles.tabTextActive]}>Peers</Text>
              </Pressable>
              <Pressable
                style={[styles.tab, directoryTab === "admins" && styles.tabActive]}
                onPress={() => { setDirectoryTab("admins"); setDirectoryFilter(""); }}
              >
                <Ionicons name="shield-checkmark" size={16} color={directoryTab === "admins" ? "#8A63D2" : "#94A3B8"} />
                <Text style={[styles.tabText, directoryTab === "admins" && styles.tabTextActive]}>Admins</Text>
              </Pressable>
            </View>

            {directoryLoading ? (
              <View style={styles.emptyState}>
                <ActivityIndicator size="large" color="#8A63D2" />
                <Text style={styles.emptyText}>Loading users...</Text>
              </View>
            ) : currentList.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name={directoryTab === "peers" ? "people-outline" : "shield-checkmark-outline"} size={48} color="#D1D5DB" />
                <Text style={styles.emptyTitle}>
                  {directoryFilter ? "No users found" : directoryTab === "peers" ? "No peers yet" : "No admins yet"}
                </Text>
                <Text style={styles.emptyText}>
                  {directoryFilter ? "Try a different search term." : directoryTab === "peers" ? "Other students will appear here once they join." : "Counselors will appear here once they register."}
                </Text>
              </View>
            ) : (
              <FlatList
                data={currentList}
                keyExtractor={(item) => item.uid}
                renderItem={({ item }) => renderUserCard({ item, isPeer: directoryTab === "peers" })}
                contentContainerStyle={styles.userList}
                showsVerticalScrollIndicator={false}
              />
            )}
          </>
        ) : (
          <>
            <View style={styles.reminderBanner}>
              <Ionicons name="heart-outline" size={14} color="#6D5BBF" />
              <Text style={styles.reminderText}>Friendly Reminder: Please keep conversations respectful, supportive, and kind.</Text>
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
                <Text style={styles.emptyText}>Send a message to {chatPartnerName}.</Text>
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
                style={[styles.sendBtn, (!inputText.trim() || sending) && styles.sendBtnDisabled]}
                onPress={handleSend}
                disabled={!inputText.trim() || sending}
              >
                <Ionicons name="arrow-up-circle" size={32} color={inputText.trim() ? "#8A63D2" : "#D1D5DB"} />
              </Pressable>
            </View>
          </>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F4F2F8" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
  },
  backBtn: { width: 40, height: 40, justifyContent: "center", alignItems: "center" },
  headerTitle: { color: "white", fontSize: 18, fontWeight: "700", flex: 1, textAlign: "center" },
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
    borderWidth: 1,
    borderColor: "rgba(156, 126, 235, 0.06)",
  },
  searchInput: { flex: 1, fontSize: 15, color: "#1E1B4B", paddingVertical: 0 },
  tabBar: { flexDirection: "row", paddingHorizontal: 16, gap: 8, marginBottom: 8 },
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
  tabActive: { backgroundColor: "#F3EEFF", borderColor: "#8A63D2" },
  tabText: { fontSize: 14, fontWeight: "500", color: "#94A3B8" },
  tabTextActive: { color: "#8A63D2", fontWeight: "600" },
  userList: { paddingHorizontal: 16, paddingBottom: 24 },
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    borderRadius: 16,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "rgba(156, 126, 235, 0.06)",
    gap: 12,
  },
  userAvatar: { width: 46, height: 46, borderRadius: 23, justifyContent: "center", alignItems: "center" },
  userAvatarPeer: { backgroundColor: "#F3EEFF" },
  userAvatarAdmin: { backgroundColor: "#EDE9FE" },
  userInfo: { flex: 1 },
  userName: { fontSize: 15, fontWeight: "600", color: "#1E1B4B" },
  userRole: { fontSize: 13, color: "#64748B", marginTop: 2 },
  emptyState: { flex: 1, justifyContent: "center", alignItems: "center", gap: 8, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 17, fontWeight: "700", color: "#1E1B4B" },
  emptyText: { fontSize: 14, color: "#64748B", textAlign: "center" },
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
  reminderText: { flex: 1, fontSize: 12, color: "#6D5BBF", lineHeight: 17 },
  messagesList: { flexGrow: 1, paddingVertical: 12, paddingHorizontal: 16 },
  bubbleRow: { marginBottom: 8, flexDirection: "row" },
  bubbleRowRight: { justifyContent: "flex-end" },
  bubbleRowLeft: { justifyContent: "flex-start" },
  bubble: { maxWidth: "78%", borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleMine: { backgroundColor: "#8A63D2", borderBottomRightRadius: 4 },
  bubbleTheirs: { backgroundColor: "white", borderBottomLeftRadius: 4, borderWidth: 1, borderColor: "rgba(156, 126, 235, 0.06)" },
  bubbleText: { fontSize: 15, color: "#1E1B4B", lineHeight: 20 },
  bubbleTextMine: { color: "white" },
  bubbleFooter: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 6, marginTop: 4 },
  bubbleTime: { fontSize: 10, color: "#94A3B8" },
  bubbleTimeMine: { color: "rgba(255,255,255,0.5)" },
  retryText: { fontSize: 11, color: "#EF4444", fontWeight: "600" },
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
  sendBtn: { width: 40, height: 40, justifyContent: "center", alignItems: "center" },
  sendBtnDisabled: { opacity: 0.5 },
});
