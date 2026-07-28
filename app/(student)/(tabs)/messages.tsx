import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/hooks/AuthContext";
import { listenForConversations } from "@/services/messagingService";
import type { Conversation } from "@/types/messaging";

function formatTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 86400000) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  if (diff < 604800000) {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return days[d.getDay()];
  }
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function getOtherName(conv: Conversation, userId: string): string {
  if (conv.type === "peer" && conv.participantNames) {
    const otherUid = conv.participants?.find((p) => p !== userId);
    return otherUid ? conv.participantNames[otherUid] || "Unknown" : "Unknown";
  }
  return conv.adminName || "Admin";
}

export default function MessagesTab() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);

  useEffect(() => {
    if (!user?.uid) return;
    const unsub = listenForConversations(user.uid, "student", (convs) => {
      setConversations(convs);
    });
    return () => unsub();
  }, [user?.uid]);

  const renderItem = ({ item }: { item: Conversation }) => {
    const otherName = getOtherName(item, user!.uid);
    const unread = item.unreadBy?.includes(user!.uid) ?? false;

    return (
      <Pressable
        style={styles.conversationItem}
        onPress={() => router.push("/(student)/messages")}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {otherName.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.conversationContent}>
          <View style={styles.conversationTop}>
            <Text style={[styles.otherName, unread && styles.unreadName]} numberOfLines={1}>
              {otherName}
            </Text>
            <Text style={styles.timeText}>{formatTime(item.lastMessageAt)}</Text>
          </View>
          <Text style={[styles.lastMessage, unread && styles.unreadMessage]} numberOfLines={1}>
            {item.lastMessage || "No messages yet"}
          </Text>
        </View>
        {unread && <View style={styles.unreadDot} />}
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={["#9C7EEB", "#8A63D2", "#7C5AC8"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Messages</Text>
        </View>
      </LinearGradient>
      <FlatList
        data={conversations}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="chatbubbles-outline" size={48} color="#D1D5DB" />
            <Text style={styles.emptyStateText}>No conversations yet</Text>
            <Pressable
              style={styles.startButton}
              onPress={() => router.push("/(student)/messages")}
            >
              <Text style={styles.startButtonText}>Start a conversation</Text>
            </Pressable>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F4F2F8" },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 18,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "white",
  },
  list: {
    paddingVertical: 8,
    paddingBottom: 40,
  },
  conversationItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F0FF",
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#8A63D2",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  avatarText: {
    color: "white",
    fontSize: 18,
    fontWeight: "700",
  },
  conversationContent: {
    flex: 1,
  },
  conversationTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  otherName: {
    fontSize: 16,
    fontWeight: "500",
    color: "#333",
    flex: 1,
  },
  unreadName: {
    fontWeight: "700",
    color: "#1E1B4B",
  },
  timeText: {
    fontSize: 12,
    color: "#9CA3AF",
    marginLeft: 8,
  },
  lastMessage: {
    fontSize: 14,
    color: "#6B7280",
  },
  unreadMessage: {
    fontWeight: "600",
    color: "#4B5563",
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#8A63D2",
    marginLeft: 10,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
    gap: 12,
  },
  emptyStateText: { fontSize: 16, color: "#9CA3AF", fontWeight: "500" },
  startButton: {
    marginTop: 8,
    backgroundColor: "#8A63D2",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
  },
  startButtonText: {
    color: "white",
    fontWeight: "600",
    fontSize: 14,
  },
});
