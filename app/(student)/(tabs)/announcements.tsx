import { auth, db } from "@/constants/firebase";
import { useAuth } from "@/hooks/AuthContext";
import {
  formatAnnouncementDateTime,
  getDaysRemaining,
  listenForAnnouncements,
  markAnnouncementAsRead,
} from "@/services/announcementService";
import type { Announcement } from "@/types/announcement";
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

export default function AnnouncementsTab() {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [studentDepartment, setStudentDepartment] = useState<string | null>(
    null,
  );

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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerEmoji}>📢</Text>
        <Text style={styles.headerTitle}>Announcements</Text>
      </View>
      <ScrollView
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      >
        {announcements.filter(
          (a) =>
            a.targetDepartments.includes("ALL") ||
            (studentDepartment &&
              a.targetDepartments.includes(studentDepartment)),
        ).length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="megaphone-outline" size={48} color="#9CA3AF" />
            <Text style={styles.emptyStateText}>No announcements yet</Text>
          </View>
        ) : (
          announcements
            .filter(
              (a) =>
                a.targetDepartments.includes("ALL") ||
                (studentDepartment &&
                  a.targetDepartments.includes(studentDepartment)),
            )
            .map((announcement) => (
              <View key={announcement.id} style={styles.card}>
                <Text style={styles.cardTitle}>{announcement.title}</Text>
                <Text style={styles.cardBody}>{announcement.description}</Text>
                {announcement.links.length > 0 && (
                  <View style={styles.linksContainer}>
                    {announcement.links.map((link, idx) => (
                      <Pressable
                        key={idx}
                        onPress={() => Linking.openURL(link.url)}
                      >
                        <Text style={styles.linkText}>{link.title}</Text>
                      </Pressable>
                    ))}
                  </View>
                )}
                <View style={styles.authorRow}>
                  {announcement.authorPhotoUrl ? (
                    <Image
                      source={{ uri: announcement.authorPhotoUrl }}
                      style={styles.authorAvatar}
                    />
                  ) : (
                    <View style={styles.authorAvatarPlaceholder}>
                      <Text style={styles.authorAvatarText}>
                        {(announcement.authorName || "A")
                          .charAt(0)
                          .toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardMeta}>
                      {announcement.authorName}
                      {announcement.authorPosition
                        ? `, ${announcement.authorPosition}`
                        : ""}
                    </Text>
                    <Text style={styles.cardDate}>
                      {formatAnnouncementDateTime(announcement.createdAt)}
                    </Text>
                  </View>
                </View>
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
  container: { flex: 1, backgroundColor: "#0F0D15" },
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
    color: "#FFFFFF",
  },
  list: {
    padding: 20,
    gap: 16,
    paddingBottom: 110,
  },
  card: {
    backgroundColor: "#1E1B2E",
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.2)",
    // @ts-ignore — web-only shadow property
    boxShadow: "0px 2px 12px rgba(0, 0, 0, 0.3)",
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#A78BFA",
    marginBottom: 8,
  },
  cardBody: {
    fontSize: 14,
    color: "#D1D5DB",
    lineHeight: 22,
    marginBottom: 12,
  },
  linksContainer: { gap: 6, marginBottom: 12 },
  linkText: {
    fontSize: 13,
    color: "#A78BFA",
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
    backgroundColor: "#8B5CF6",
    justifyContent: "center",
    alignItems: "center",
  },
  authorAvatarText: {
    color: "white",
    fontSize: 14,
    fontWeight: "700",
  },
  cardMeta: { fontSize: 12, color: "#9CA3AF", marginBottom: 2 },
  cardDate: { fontSize: 11, color: "#9CA3AF" },
  expiry: {
    marginTop: 6,
    alignSelf: "flex-start",
    backgroundColor: "rgba(139, 92, 246, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  expiryText: { fontSize: 10, fontWeight: "600", color: "#A78BFA" },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    gap: 12,
  },
  emptyStateText: { fontSize: 16, color: "#9CA3AF", fontWeight: "500" },
});
