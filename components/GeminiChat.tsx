/**
 * Floating AI chat bubble for the student dashboard.
 * FAB opens full-screen chat modal. Minimize shrinks into a small draggable box.
 * Monitors network state via useNetwork() and blocks API calls when offline.
 */

import React, { useRef, useState, useEffect } from "react";
import {
  FlatList,
  Image,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import ChatBubble from "@/components/chat/ChatBubble";
import ChatInput from "@/components/chat/ChatInput";
import SuggestedQuestions from "@/components/chat/SuggestedQuestions";
import TypingIndicator from "@/components/chat/TypingIndicator";
import { useChat } from "@/hooks/useChat";
import { useNetwork } from "@/contexts/NetworkContext";
import type { ChatMessage } from "@/types/chat";

const FAB_SIZE = 60;
const MINI_SIZE = 56;

export default function GeminiChat() {
  const { isConnected } = useNetwork();
  const { messages, isTyping, error, sendMessage, clearChat } = useChat(
    isConnected ?? false,
  );
  const flatListRef = useRef<FlatList<ChatMessage>>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const insets = useSafeAreaInsets();

  // ─── Draggable minimized box ─────────────────────────────────────────────
  const pan = useRef({ x: 0, y: 0 }).current;
  const panAnim = useRef({ x: 0, y: 0 }).current;
  const [dragPos, setDragPos] = useState({ x: 0, y: 0 });
  const [hasDragged, setHasDragged] = useState(false);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 4 || Math.abs(g.dy) > 4,
      onPanResponderGrant: () => {
        pan.x = dragPos.x;
        pan.y = dragPos.y;
      },
      onPanResponderMove: (_, g) => {
        setDragPos({
          x: pan.x + g.dx,
          y: pan.y + g.dy,
        });
        if (Math.abs(g.dx) > 4 || Math.abs(g.dy) > 4) {
          setHasDragged(true);
        }
      },
      onPanResponderRelease: () => {
        pan.x = dragPos.x;
        pan.y = dragPos.y;
      },
    }),
  ).current;

  // Position the mini box in bottom-right on first minimize
  useEffect(() => {
    if (minimized) {
      const rightMargin = 20;
      const bottomMargin = Platform.OS === "web" ? 20 : insets.bottom + 20;
      setDragPos({
        x: 0,
        y: 0,
      });
      pan.x = 0;
      pan.y = 0;
    }
  }, [minimized]);

  useEffect(() => {
    if (messages.length > 0 && isOpen) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages, isTyping, isOpen]);

  const handleSend = (text: string) => {
    sendMessage(text);
  };

  const handleMinimize = () => {
    setIsOpen(false);
    setMinimized(true);
    setHasDragged(false);
  };

  const handleMiniPress = () => {
    if (!hasDragged) {
      setMinimized(false);
      setIsOpen(true);
    }
    setHasDragged(false);
  };

  const handleFABPress = () => {
    if (minimized) {
      setMinimized(false);
    }
    setIsOpen(true);
  };

  const handleBack = () => {
    setIsOpen(false);
  };

  const hasUserMessages = messages.some((m) => m.role === "user");
  const showSuggestions = !hasUserMessages && !isTyping;

  const bottomInset = Platform.OS === "web" ? 20 : insets.bottom + 20;
  const rightInset = 20;
  const unreadCount = messages.filter((m) => m.role === "assistant").length;

  return (
    <>
      {/* ─── FAB (visible when not open AND not minimized) ────────────── */}
      {!isOpen && !minimized && (
        <Pressable
          onPress={handleFABPress}
          style={({ pressed }) => [
            styles.fab,
            { right: rightInset, bottom: bottomInset },
            pressed && styles.fabPressed,
          ]}
        >
          <Image
            source={require("@/assets/images/mindyai.png")}
            style={styles.fabImage}
          />
          {!isConnected && <View style={styles.offlineDot} />}
        </Pressable>
      )}

      {/* ─── Minimized Draggable Box ─────────────────────────────────── */}
      {minimized && !isOpen && (
        <Pressable
          {...panResponder.panHandlers}
          onPress={handleMiniPress}
          style={[
            styles.miniBox,
            {
              right: rightInset + dragPos.x,
              bottom: bottomInset + dragPos.y,
            },
          ]}
        >
          <Image
            source={require("@/assets/images/mindyai.png")}
            style={styles.miniImage}
          />
          <View style={styles.miniInfo}>
            <Text style={styles.miniName}>Mindy</Text>
            {unreadCount > 0 && (
              <Text style={styles.miniHint}>{unreadCount} messages</Text>
            )}
          </View>
          <View style={styles.miniExpandIcon}>
            <Ionicons name="expand-outline" size={14} color="#8A63D2" />
          </View>
        </Pressable>
      )}

      {/* ─── Full-Screen Chat Modal ──────────────────────────────────── */}
      <Modal
        visible={isOpen}
        animationType="slide"
        onRequestClose={handleBack}
      >
        <SafeAreaView style={styles.modalRoot}>
          {/* Header */}
          <LinearGradient
            colors={["#8A63D2", "#B794F6"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.header}>
              <Pressable style={styles.headerBackBtn} onPress={handleBack}>
                <Ionicons name="arrow-back" size={22} color="white" />
              </Pressable>

              <View style={styles.headerCenter}>
                <View style={styles.headerIconWrap}>
                  <Image
                    source={require("@/assets/images/mindyai.png")}
                    style={styles.headerIconImage}
                  />
                </View>
                <View>
                  <Text style={styles.headerTitle}>Mindy</Text>
                  <Text style={styles.headerSubtitle}>
                    {isConnected ? "Online" : "Offline"}
                  </Text>
                </View>
              </View>

              <View style={styles.headerActions}>
                <Pressable
                  style={styles.headerAction}
                  onPress={handleMinimize}
                >
                  <Ionicons
                    name="remove-outline"
                    size={20}
                    color="white"
                  />
                </Pressable>
                <Pressable style={styles.headerAction} onPress={clearChat}>
                  <Ionicons
                    name="refresh-outline"
                    size={20}
                    color="white"
                  />
                </Pressable>
              </View>
            </View>
          </LinearGradient>

          {/* Error Banner */}
          {error && (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={14} color="#D32F2F" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Offline Banner */}
          {!isConnected && !error && (
            <View style={styles.offlineBanner}>
              <Ionicons
                name="cloud-offline-outline"
                size={14}
                color="#F59E0B"
              />
              <Text style={styles.offlineBannerText}>
                No internet. Messages won&apos;t send.
              </Text>
            </View>
          )}

          {/* Messages */}
          <View style={styles.chatArea}>
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => <ChatBubble message={item} />}
              contentContainerStyle={styles.messagesList}
              showsVerticalScrollIndicator={false}
              ListHeaderComponent={
                showSuggestions ? (
                  <SuggestedQuestions
                    onSelect={handleSend}
                    visible={showSuggestions}
                  />
                ) : null
              }
              ListFooterComponent={isTyping ? <TypingIndicator /> : null}
            />
          </View>

          {/* Input */}
          <ChatInput onSend={handleSend} disabled={isTyping} />
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  /* FAB */
  fab: {
    position: "absolute",
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    backgroundColor: "#8A63D2",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 8,
    zIndex: 1001,
  },
  fabPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.95 }],
  },
  fabImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  offlineDot: {
    position: "absolute",
    top: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#EF4444",
    borderWidth: 2,
    borderColor: "#8A63D2",
  },

  /* ─── Minimized Draggable Box ─────────────────────────────────────── */
  miniBox: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    paddingLeft: 4,
    paddingRight: 14,
    paddingVertical: 6,
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 10,
    zIndex: 1001,
    borderWidth: 1,
    borderColor: "rgba(156, 126, 235, 0.15)",
  },
  miniImage: {
    width: MINI_SIZE - 12,
    height: MINI_SIZE - 12,
    borderRadius: (MINI_SIZE - 12) / 2,
  },
  miniInfo: {
    flex: 1,
  },
  miniName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1E1B4B",
  },
  miniHint: {
    fontSize: 10,
    color: "#8A63D2",
    marginTop: 1,
  },
  miniExpandIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#F3EAFF",
    justifyContent: "center",
    alignItems: "center",
  },

  /* ─── Full-Screen Modal ───────────────────────────────────────────── */
  modalRoot: {
    flex: 1,
    backgroundColor: "#F4F2F8",
  },

  /* Header */
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
  },
  headerBackBtn: {
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
  headerIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  headerIconImage: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "white",
  },
  headerSubtitle: {
    fontSize: 11,
    color: "rgba(255,255,255,0.7)",
    marginTop: 1,
  },
  headerActions: {
    flexDirection: "row",
    gap: 4,
  },
  headerAction: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },

  /* Banners */
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF0F0",
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 6,
  },
  errorText: {
    fontSize: 12,
    color: "#D32F2F",
    flex: 1,
  },
  offlineBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFBEB",
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 6,
  },
  offlineBannerText: {
    fontSize: 12,
    color: "#92400E",
    flex: 1,
  },

  /* Chat area */
  chatArea: {
    flex: 1,
  },
  messagesList: {
    flexGrow: 1,
    paddingVertical: 8,
  },
});
