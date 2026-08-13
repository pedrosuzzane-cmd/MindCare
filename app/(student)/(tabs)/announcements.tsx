import { auth, db } from "@/constants/firebase";
import { useAuth } from "@/hooks/AuthContext";
import {
  formatAnnouncementDateTime,
  getDaysRemaining,
  listenForAnnouncements,
  markAnnouncementAsRead,
} from "@/services/announcementService";
import type { Announcement } from "@/types/announcement";
import { useMindCareTheme } from "@/contexts/ThemeContext";
import type { MindCareTheme } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import { doc, getDoc } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeIn, LinearTransition } from "react-native-reanimated";

const PREVIEW_LINES = 4;
const TITLE_LINES = 2;

function AnnouncementCard({
  announcement,
  expanded,
  onToggle,
  theme,
}: {
  announcement: Announcement;
  expanded: boolean;
  onToggle: () => void;
  theme: MindCareTheme;
}) {
  const styles = createStyles(theme);
  const [totalLines, setTotalLines] = useState<number | null>(null);

  const needsToggle = totalLines !== null && totalLines > PREVIEW_LINES;
  const descriptionLines = needsToggle && !expanded ? PREVIEW_LINES : undefined;

  return (
    <Animated.View
      layout={LinearTransition.duration(180)}
      style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}
    >
      <Text
        style={[styles.cardTitle, { color: theme.primary }]}
        numberOfLines={TITLE_LINES}
      >
        {announcement.title}
      </Text>
      <Text
        style={[styles.cardBody, { color: theme.text }]}
        numberOfLines={descriptionLines}
        onTextLayout={(e) => {
          if (totalLines === null) {
            setTotalLines(e.nativeEvent.lines.length);
          }
        }}
      >
        {announcement.description}
      </Text>
      {announcement.links.length > 0 && (
        <View style={styles.linksContainer}>
          {announcement.links.map((link, idx) => (
            <Pressable key={idx} onPress={() => Linking.openURL(link.url)}>
              <Text style={[styles.linkText, { color: theme.primary }]}>
                {link.title}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
      {needsToggle && (
        <Animated.View entering={FadeIn.duration(200)}>
          <Pressable
            onPress={onToggle}
            hitSlop={8}
            style={styles.readMoreBtn}
            accessibilityRole="button"
            accessibilityState={{ expanded }}
            accessibilityLabel={expanded ? "Read less" : "Read more"}
          >
            <Text style={[styles.readMoreText, { color: theme.primary }]}>
              {expanded ? "Read less" : "Read more"}
            </Text>
            <Ionicons
              name={expanded ? "chevron-up" : "chevron-down"}
              size={14}
              color={theme.primary}
            />
          </Pressable>
        </Animated.View>
      )}
      <View style={styles.authorRow}>
        {announcement.authorPhotoUrl ? (
          <Image
            source={{ uri: announcement.authorPhotoUrl }}
            style={styles.authorAvatar}
          />
        ) : (
          <View
            style={[styles.authorAvatarPlaceholder, { backgroundColor: theme.primary }]}
          >
            <Text style={styles.authorAvatarText}>
              {(announcement.authorName || "A").charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={[styles.cardMeta, { color: theme.secondaryText }]}>
            {announcement.authorName}
            {announcement.authorPosition
              ? `, ${announcement.authorPosition}`
              : ""}
          </Text>
          <Text style={[styles.cardDate, { color: theme.secondaryText }]}>
            {formatAnnouncementDateTime(announcement.createdAt)}
          </Text>
        </View>
      </View>
      <View style={[styles.expiry, { backgroundColor: theme.softPurple }]}>
        <Text style={[styles.expiryText, { color: theme.primary }]}>
          Expires in {getDaysRemaining(announcement.expiresAt)} days
        </Text>
      </View>
    </Animated.View>
  );
}

export default function AnnouncementsTab() {
  const { user } = useAuth();
  const { theme } = useMindCareTheme();
  const styles = createStyles(theme);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [studentDepartment, setStudentDepartment] = useState<string | null>(
    null,
  );
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    getDoc(doc(db, "users", uid)).then((snap) => {
      if (snap.exists()) {
        setStudentDepartment(snap.data().department || null);
      }
    });
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsub = listenForAnnouncements((data) => {
      setAnnouncements(data);
      data.forEach((a) => markAnnouncementAsRead(a.id, user.uid));
    });
    return () => unsub();
  }, [user]);

  const visibleAnnouncements = announcements.filter(
    (a) =>
      a.targetDepartments.includes("ALL") ||
      (studentDepartment &&
        a.targetDepartments.includes(studentDepartment)),
  );

  const toggleAnnouncement = (id: string) =>
    setExpandedId((prev) => (prev === id ? null : id));

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
        {visibleAnnouncements.length === 0 ? (
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
          visibleAnnouncements.map((announcement) => (
            <AnnouncementCard
              key={announcement.id}
              announcement={announcement}
              expanded={expandedId === announcement.id}
              onToggle={() => toggleAnnouncement(announcement.id)}
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
      padding: 20,
      gap: 16,
      paddingBottom: 110,
    },
    card: {
      backgroundColor: theme.card,
      borderRadius: 20,
      padding: 18,
      borderWidth: 1,
      borderColor: theme.border,
      // @ts-ignore — web-only shadow property
      boxShadow: `0px 2px 12px ${theme.shadow}`,
    },
    cardTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.primary,
      marginBottom: 8,
    },
    cardBody: {
      fontSize: 14,
      color: theme.text,
      lineHeight: 22,
      marginBottom: 12,
    },
    readMoreBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      alignSelf: "flex-start",
      gap: 4,
      minHeight: 44,
      paddingHorizontal: 8,
      marginTop: -4,
      marginBottom: 4,
    },
    readMoreText: {
      fontSize: 13,
      fontWeight: "700",
      color: theme.primary,
    },
    linksContainer: { gap: 6, marginBottom: 12 },
    linkText: {
      fontSize: 13,
      color: theme.primary,
      fontWeight: "600",
      textDecorationLine: "underline",
    },
    authorRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginTop: 8,
    },
    authorAvatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
    },
    authorAvatarPlaceholder: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: theme.primary,
      justifyContent: "center",
      alignItems: "center",
    },
    authorAvatarText: {
      color: "#FFFFFF",
      fontSize: 14,
      fontWeight: "700",
    },
    cardMeta: { fontSize: 12, color: theme.secondaryText, marginBottom: 2 },
    cardDate: { fontSize: 11, color: theme.secondaryText },
    expiry: {
      marginTop: 6,
      alignSelf: "flex-start",
      backgroundColor: theme.softPurple,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
    },
    expiryText: { fontSize: 10, fontWeight: "600", color: theme.primary },
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
