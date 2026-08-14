import { useMindCareTheme } from "@/contexts/ThemeContext";
import { useAnnouncements } from "@/contexts/AnnouncementsContext";
import {
  formatAnnouncementDateTime,
} from "@/services/announcementService";
import type { Announcement } from "@/types/announcement";
import type { MindCareTheme } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeIn } from "react-native-reanimated";

const TITLE_LINES = 2;
const PREVIEW_LINES = 2;

function AnnouncementItem({
  announcement,
  isRead,
  onPress,
  theme,
}: {
  announcement: Announcement;
  isRead: boolean;
  onPress: () => void;
  theme: MindCareTheme;
}) {
  const styles = createStyles(theme);

  return (
    <Animated.View entering={FadeIn.duration(180)}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.card,
          { backgroundColor: theme.card, borderColor: theme.border },
          pressed && styles.cardPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={`Announcement from ${announcement.authorName}: ${announcement.title}`}
      >
        <View style={styles.row}>
          {announcement.authorPhotoUrl ? (
            <Image
              source={{ uri: announcement.authorPhotoUrl }}
              style={styles.avatar}
            />
          ) : (
            <View
              style={[styles.avatar, styles.avatarPlaceholder, { backgroundColor: theme.primary }]}
            >
              <Text style={styles.avatarText}>
                {(announcement.authorName || "A").charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.body}>
            <View style={styles.metaRow}>
              <View style={styles.metaTextWrap}>
                <Text
                  style={[styles.authorName, { color: theme.text }]}
                  numberOfLines={1}
                >
                  {announcement.authorName}
                  {announcement.authorPosition
                    ? ` · ${announcement.authorPosition}`
                    : ""}
                </Text>
                <Text
                  style={[styles.date, { color: theme.secondaryText }]}
                  numberOfLines={1}
                >
                  {formatAnnouncementDateTime(announcement.createdAt)}
                </Text>
              </View>
              {!isRead && <View style={styles.unreadDot} />}
            </View>
            <Text
              style={[
                styles.title,
                { color: isRead ? theme.text : theme.primary },
              ]}
              numberOfLines={TITLE_LINES}
              ellipsizeMode="tail"
            >
              {announcement.title}
            </Text>
            <Text
              style={[styles.preview, { color: theme.secondaryText }]}
              numberOfLines={PREVIEW_LINES}
              ellipsizeMode="tail"
            >
              {announcement.description}
            </Text>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

export default function AnnouncementsTab() {
  const { theme } = useMindCareTheme();
  const styles = createStyles(theme);
  const { announcements, readMap, markRead } = useAnnouncements();

  const openAnnouncement = (id: string) => {
    markRead(id);
    router.push({ pathname: "/announcement-detail", params: { id } });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <Text style={styles.headerEmoji}>📢</Text>
        <Text style={[styles.headerTitle, { color: theme.text }]}>
          Announcements
        </Text>
      </View>
      <ScrollView
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      >
        {announcements.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons
              name="megaphone-outline"
              size={48}
              color={theme.secondaryText}
            />
            <Text style={[styles.emptyStateText, { color: theme.text }]}>
              No announcements yet
            </Text>
            <Text
              style={[styles.emptyStateSubtext, { color: theme.secondaryText }]}
            >
              Your university announcements will appear here.
            </Text>
          </View>
        ) : (
          announcements.map((announcement) => (
            <AnnouncementItem
              key={announcement.id}
              announcement={announcement}
              isRead={!!readMap[announcement.id]}
              onPress={() => openAnnouncement(announcement.id)}
              theme={theme}
            />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (theme: MindCareTheme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 24,
      paddingTop: 16,
      paddingBottom: 18,
    },
    headerEmoji: {
      fontSize: 24,
    },
    headerTitle: {
      fontSize: 22,
      fontWeight: "800",
      color: theme.text,
    },
    list: {
      padding: 16,
      gap: 12,
      paddingBottom: 110,
    },
    card: {
      borderRadius: 18,
      padding: 14,
      borderWidth: 1,
      borderColor: theme.border,
      // @ts-ignore — web-only shadow property
      boxShadow: `0px 1px 8px ${theme.shadow}`,
    },
    cardPressed: {
      opacity: 0.85,
    },
    row: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 12,
    },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
    },
    avatarPlaceholder: {
      justifyContent: "center",
      alignItems: "center",
    },
    avatarText: {
      color: "#FFFFFF",
      fontSize: 16,
      fontWeight: "700",
    },
    body: {
      flex: 1,
    },
    metaRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
      marginBottom: 6,
    },
    metaTextWrap: {
      flex: 1,
    },
    authorName: {
      fontSize: 13,
      fontWeight: "700",
      color: theme.text,
    },
    date: {
      fontSize: 11,
      color: theme.secondaryText,
      marginTop: 2,
    },
    unreadDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: theme.primary,
    },
    title: {
      fontSize: 15,
      fontWeight: "700",
      color: theme.primary,
      marginBottom: 4,
    },
    preview: {
      fontSize: 13,
      lineHeight: 19,
      color: theme.secondaryText,
    },
    emptyState: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 60,
      gap: 8,
    },
    emptyStateText: {
      fontSize: 16,
      color: theme.text,
      fontWeight: "600",
    },
    emptyStateSubtext: {
      fontSize: 13,
      color: theme.secondaryText,
      textAlign: "center",
    },
  });
