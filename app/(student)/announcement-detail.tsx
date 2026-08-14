import { useAnnouncements } from "@/contexts/AnnouncementsContext";
import { useMindCareTheme } from "@/contexts/ThemeContext";
import type { MindCareTheme } from "@/constants/theme";
import {
  formatAnnouncementDetailDate,
  getDaysRemaining,
} from "@/services/announcementService";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export const options = {
  headerShown: false,
};

export default function AnnouncementDetailScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const id = params.id;
  const { theme } = useMindCareTheme();
  const styles = createStyles(theme);
  const { announcements, markRead } = useAnnouncements();

  const announcement = announcements.find((a) => a.id === id);

  useEffect(() => {
    if (!id) {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace("/announcements");
      }
      return;
    }
    markRead(id);
  }, [id, markRead]);

  if (!announcement) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        {announcements.length === 0 ? (
          <ActivityIndicator style={{ marginTop: 80 }} color={theme.primary} />
        ) : (
          <View style={styles.center}>
            <Text style={[styles.notFoundText, { color: theme.secondaryText }]}>
              Announcement not found.
            </Text>
            <Pressable
              onPress={() => {
                if (router.canGoBack()) {
                  router.back();
                } else {
                  router.replace("/announcements");
                }
              }}
              hitSlop={8}
            >
              <Text style={[styles.backLink, { color: theme.primary }]}>
                Go back
              </Text>
            </Pressable>
          </View>
        )}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <LinearGradient colors={[...theme.headerGradient]} style={styles.headerGradient}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={8}
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel="Go back to announcements"
          >
            <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
          </Pressable>
          <Text style={styles.headerTitle} numberOfLines={1}>
            Announcement
          </Text>
          <View style={styles.headerSpacer} />
        </View>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.card,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
        >
          <View style={styles.authorRow}>
            {announcement.authorPhotoUrl ? (
              <Image
                source={{ uri: announcement.authorPhotoUrl }}
                style={styles.authorAvatar}
              />
            ) : (
              <View
                style={[
                  styles.authorAvatar,
                  styles.authorPlaceholder,
                  { backgroundColor: theme.primary },
                ]}
              >
                <Text style={styles.authorPlaceholderText}>
                  {(announcement.authorName || "A").charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.authorInfo}>
              <Text style={[styles.authorMeta, { color: theme.text }]}>
                {announcement.authorPosition
                  ? `${announcement.authorPosition} | ${announcement.authorName}`
                  : announcement.authorName}
              </Text>
              <Text style={[styles.authorDate, { color: theme.secondaryText }]}>
                {formatAnnouncementDetailDate(announcement.createdAt)}
              </Text>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: theme.border }]} />

          <Text style={[styles.title, { color: theme.text }]}>
            {announcement.title}
          </Text>
          <Text style={[styles.body, { color: theme.text }]}>
            {announcement.description}
          </Text>

          {announcement.links.length > 0 && (
            <View style={styles.linksContainer}>
              {announcement.links.map((link, idx) => (
                <Pressable
                  key={idx}
                  onPress={() => Linking.openURL(link.url)}
                  style={[
                    styles.linkRow,
                    { backgroundColor: theme.softPurple },
                  ]}
                  accessibilityRole="link"
                >
                  <Ionicons
                    name="link-outline"
                    size={16}
                    color={theme.primary}
                  />
                  <Text
                    style={[styles.linkText, { color: theme.primary }]}
                    numberOfLines={1}
                  >
                    {link.title || link.url}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          <View style={[styles.expiry, { backgroundColor: theme.softPurple }]}>
            <Ionicons name="time-outline" size={13} color={theme.primary} />
            <Text style={[styles.expiryText, { color: theme.primary }]}>
              Expires in {getDaysRemaining(announcement.expiresAt)} days
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (theme: MindCareTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    headerGradient: {
      paddingBottom: 16,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 12,
      paddingTop: 8,
      paddingBottom: 6,
    },
    backButton: {
      width: 40,
      height: 40,
      justifyContent: "center",
      alignItems: "center",
    },
    headerTitle: {
      flex: 1,
      fontSize: 18,
      fontWeight: "700",
      color: "#FFFFFF",
      textAlign: "center",
    },
    headerSpacer: {
      width: 40,
    },
    content: {
      padding: 16,
      paddingBottom: 40,
    },
    card: {
      borderRadius: 20,
      padding: 18,
      borderWidth: 1,
      borderColor: theme.border,
      // @ts-ignore — web-only shadow property
      boxShadow: `0px 2px 12px ${theme.shadow}`,
    },
    authorRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    authorAvatar: {
      width: 56,
      height: 56,
      borderRadius: 28,
    },
    authorPlaceholder: {
      justifyContent: "center",
      alignItems: "center",
    },
    authorPlaceholderText: {
      color: "#FFFFFF",
      fontSize: 20,
      fontWeight: "700",
    },
    authorInfo: {
      flex: 1,
    },
    authorMeta: {
      fontSize: 15,
      fontWeight: "700",
      color: theme.text,
    },
    authorDate: {
      fontSize: 12,
      color: theme.secondaryText,
      marginTop: 3,
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: theme.border,
      marginVertical: 16,
    },
    title: {
      fontSize: 20,
      fontWeight: "800",
      color: theme.text,
      marginBottom: 12,
    },
    body: {
      fontSize: 15,
      lineHeight: 24,
      color: theme.text,
    },
    linksContainer: {
      gap: 8,
      marginTop: 18,
    },
    linkRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 12,
    },
    linkText: {
      flex: 1,
      fontSize: 13,
      fontWeight: "600",
      color: theme.primary,
      textDecorationLine: "underline",
    },
    expiry: {
      marginTop: 18,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      alignSelf: "flex-start",
      backgroundColor: theme.softPurple,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
    },
    expiryText: {
      fontSize: 11,
      fontWeight: "600",
      color: theme.primary,
    },
    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    notFoundText: {
      fontSize: 15,
      color: theme.secondaryText,
    },
    backLink: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.primary,
    },
  });
