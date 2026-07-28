import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useState } from "react";
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/hooks/AuthContext";
import {
  listenForAnnouncements,
  markAnnouncementAsRead,
  formatAnnouncementDateTime,
  getDaysRemaining,
} from "@/services/announcementService";
import type { Announcement } from "@/types/announcement";

export default function AnnouncementsTab() {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  useEffect(() => {
    if (!user) return;
    const unsub = listenForAnnouncements((data) => {
      setAnnouncements(data);
      data.forEach((a) => markAnnouncementAsRead(a.id, user.uid));
    });
    return () => unsub();
  }, [user]);

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={["#9C7EEB", "#8A63D2", "#7C5AC8"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Announcements</Text>
        </View>
      </LinearGradient>
      <ScrollView
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      >
        {announcements.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="megaphone-outline" size={48} color="#D1D5DB" />
            <Text style={styles.emptyStateText}>No announcements yet</Text>
          </View>
        ) : (
          announcements.map((announcement) => (
            <View key={announcement.id} style={styles.card}>
              <Text style={styles.cardTitle}>{announcement.title}</Text>
              <Text style={styles.cardBody}>{announcement.description}</Text>
              {announcement.links.length > 0 && (
                <View style={styles.linksContainer}>
                  {announcement.links.map((link, idx) => (
                    <Pressable key={idx} onPress={() => Linking.openURL(link.url)}>
                      <Text style={styles.linkText}>{link.title}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
              <Text style={styles.cardMeta}>
                Posted by {announcement.authorName}
                {announcement.authorPosition ? `, ${announcement.authorPosition}` : ""}
              </Text>
              <Text style={styles.cardDate}>
                {formatAnnouncementDateTime(announcement.createdAt)}
              </Text>
              <View style={styles.expiry}>
                <Text style={styles.expiryText}>
                  Expires in {getDaysRemaining(announcement.expiresAt)} days
                </Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>
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
    padding: 20,
    gap: 16,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 18,
    elevation: 3,
    borderWidth: 1,
    borderColor: "rgba(156, 126, 235, 0.08)",
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1E1B4B",
    marginBottom: 8,
  },
  cardBody: {
    fontSize: 14,
    color: "#4B5563",
    lineHeight: 22,
    marginBottom: 12,
  },
  linksContainer: { gap: 6, marginBottom: 12 },
  linkText: {
    fontSize: 13,
    color: "#8A63D2",
    fontWeight: "600",
    textDecorationLine: "underline",
  },
  cardMeta: { fontSize: 12, color: "#9CA3AF", marginBottom: 2 },
  cardDate: { fontSize: 11, color: "#D1D5DB" },
  expiry: {
    marginTop: 6,
    alignSelf: "flex-start",
    backgroundColor: "#F3EEFF",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  expiryText: { fontSize: 10, fontWeight: "600", color: "#8A63D2" },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    gap: 12,
  },
  emptyStateText: { fontSize: 16, color: "#9CA3AF", fontWeight: "500" },
});
