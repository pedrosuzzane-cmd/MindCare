import { useAuth } from "@/hooks/AuthContext";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Href, Redirect, router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { handleSignOut } from "@/services/authService";
import GeminiChat from "@/components/GeminiChat";
import {
  listenForAnnouncements,
  markAnnouncementAsRead,
  getUnreadCount,
  formatAnnouncementDateTime,
  getDaysRemaining,
} from "@/services/announcementService";
import { listenForConversations } from "@/services/messagingService";
import type { Announcement } from "@/types/announcement";

const FEATURES = [
  {
    title: "Daily Reminders",
    description: "Set helpful reminders for your day",
    icon: "notifications",
    color: "#8A63D2",
    route: "/daily-reminders",
  },
  {
    title: "Daily Journal",
    description: "Reflect on your thoughts and feelings",
    icon: "book",
    color: "#8A63D2",
    route: "/daily-journal",
  },
  {
    title: "Self-Assessment",
    description: "Check in with your mental wellness",
    icon: "clipboard",
    color: "#9C27B0",
    route: "/self-assessment-menu",
  },
  {
    title: "Achievements",
    description: "Celebrate your healthy habits",
    icon: "trophy",
    color: "#FF9800",
    route: "/achievements",
  },
  {
    title: "Wellness Suggestions",
    description: "AI-powered tips based on your journal",
    icon: "bulb",
    color: "#9C7EEB",
    route: "/journal-suggestions",
  },
  {
    title: "Hotline Access",
    description: "Connect with support when you need it",
    icon: "call",
    color: "#E91E63",
    route: "/support-hotlines",
  },
 ] as const;

export default function DashboardScreen() {
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const { user, role } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  // Announcements state
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [announcementModalVisible, setAnnouncementModalVisible] = useState(false);

  // Unread message count
  const [unreadMessages, setUnreadMessages] = useState(0);

  // Announcements listener
  useEffect(() => {
    if (!user) return;
    const unsub = listenForAnnouncements((data) => {
      setAnnouncements(data);
      getUnreadCount(user.uid, data).then(setUnreadCount);
    });
    return () => unsub();
  }, [user]);

  // Unread messages listener
  useEffect(() => {
    if (!user?.uid) return;
    const unsub = listenForConversations(user.uid, "student", (convs) => {
      const unread = convs.filter((c) => c.unreadBy?.includes(user.uid)).length;
      setUnreadMessages(unread);
    });
    return () => unsub();
  }, [user?.uid]);

  // Mark all as read when modal opens
  useEffect(() => {
    if (announcementModalVisible && user) {
      announcements.forEach((a) => {
        markAnnouncementAsRead(a.id, user.uid);
      });
      setUnreadCount(0);
    }
  }, [announcementModalVisible]);

  // Automatically adjust columns based on screen width
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;
  const numColumns = isDesktop ? 3 : 2;

  // Safety check: If an admin somehow lands here, redirect them.
  if (role === "admin") {
    return <Redirect href="/admin-panel" />;
  }

  if (!user) {
    return <Redirect href="/auth/login" />;
  }

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    return "Good Evening";
  };

  const doSignOut = async () => {
    setSigningOut(true);
    try {
      await handleSignOut(router);
      console.log("Sign out successful");
    } catch (err) {
      console.error("Logout error", err);
      setSigningOut(false);
    }
  };

  const handleLogoutPress = () => {
    setShowLogoutConfirm(true);
  };

  function FeatureCard({ feature }: { feature: (typeof FEATURES)[number] }) {
    const scaleAnim = useRef(new Animated.Value(1)).current;

    const handlePressIn = () =>
      Animated.spring(scaleAnim, {
        toValue: 0.96,
        useNativeDriver: Platform.OS !== "web",
      }).start();
    const handlePressOut = () =>
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: Platform.OS !== "web",
      }).start();

    return (
      <Animated.View
        style={[{ transform: [{ scale: scaleAnim }], flex: 1 }]}
      >
        <Pressable
          style={styles.card}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          onPress={() => router.push(feature.route as Href)}
        >
          <View style={[styles.cardIcon, { backgroundColor: feature.color }]}>
            <Ionicons name={feature.icon} size={24} color="white" />
          </View>
          <Text style={styles.cardTitle}>{feature.title}</Text>
          <Text style={styles.cardDescription}>{feature.description}</Text>
        </Pressable>
      </Animated.View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={["#9C7EEB", "#8A63D2", "#7C5AC8"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <ScrollView
          style={styles.scrollContainer}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <View style={styles.logoIcon}>
                <Image
                  source={require("@/assets/images/logoicon.png")}
                  style={styles.logoIconImage}
                  resizeMode="contain"
                />
              </View>
              <Text style={styles.logoText}>MindCare</Text>
            </View>
            <View style={styles.rightButtons}>
              <Pressable
                style={styles.profileButton}
                onPress={() => setAnnouncementModalVisible(true)}
              >
                <View>
                  <Ionicons name="megaphone-outline" size={24} color="white" />
                  {unreadCount > 0 && (
                    <View style={styles.badgeContainer}>
                      <Text style={styles.badgeText}>
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </Text>
                    </View>
                  )}
                </View>
              </Pressable>
              <Pressable
                style={styles.profileButton}
                onPress={() => router.push("/(student)/messages")}
              >
                <View>
                  <Ionicons
                    name="chatbubble-ellipses-outline"
                    size={24}
                    color="white"
                  />
                  {unreadMessages > 0 && (
                    <View style={styles.badgeContainer}>
                      <Text style={styles.badgeText}>
                        {unreadMessages > 9 ? "9+" : unreadMessages}
                      </Text>
                    </View>
                  )}
                </View>
              </Pressable>
              <Pressable
                style={styles.profileButton}
                onPress={() => router.push("/profile")}
              >
                <Ionicons
                  name="person-circle-outline"
                  size={26}
                  color="white"
                />
              </Pressable>
              <Pressable style={styles.chatButton} onPress={handleLogoutPress}>
                <Ionicons name="log-out-outline" size={24} color="white" />
              </Pressable>
            </View>
          </View>

          {/* Greeting Section */}
          <View style={styles.greetingSection}>
            <Text style={styles.greeting}>
              {getGreeting()}, {user?.displayName?.split(" ")[0] || "there"}!
            </Text>
            <Text style={styles.subtitle}>
              How are you feeling today? Remember, taking care of your mental
              health is important.
            </Text>
          </View>

          {/* Feature Cards */}
          <View style={styles.cardsContainer}>
            {Array.from({ length: Math.ceil(FEATURES.length / numColumns) }).map(
              (_, rowIdx) => {
                const rowFeatures = FEATURES.slice(
                  rowIdx * numColumns,
                  rowIdx * numColumns + numColumns,
                );
                return (
                  <View key={rowIdx} style={styles.cardRow}>
                    {rowFeatures.map((feature) => (
                      <FeatureCard key={feature.route} feature={feature} />
                    ))}
                  </View>
                );
              },
            )}
          </View>

          {/* Inspirational Quote */}
          <View style={styles.quoteContainer}>
            <Text style={styles.quote}>
              &quot;Your mental health is a priority. Your happiness is
              essential. Your self-care is a necessity.&quot;
            </Text>
          </View>

          {signingOut && (
            <View style={styles.signOutOverlay} pointerEvents="auto">
              <View style={styles.signOutBox}>
                <ActivityIndicator size="large" color="#ffffff" />
                <Text style={styles.signOutText}>Signing out...</Text>
              </View>
            </View>
          )}

          {showLogoutConfirm && (
            <View style={styles.confirmOverlay} pointerEvents="auto">
              <View style={styles.confirmBox}>
                <Text style={styles.confirmTitle}>Confirm Logout</Text>
                <Text style={styles.confirmMessage}>
                  Are you sure you want to logout?
                </Text>
                <View style={styles.confirmButtons}>
                  <Pressable
                    style={[styles.confirmButton, styles.cancelButton]}
                    onPress={() => setShowLogoutConfirm(false)}
                  >
                    <Text style={styles.cancelText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.confirmButton, styles.logoutButton]}
                    onPress={() => {
                      setShowLogoutConfirm(false);
                      doSignOut();
                    }}
                  >
                    <Text style={styles.logoutText}>Logout</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Floating AI Chat Bubble */}
        <GeminiChat />

        {/* Announcement Modal */}
        <Modal
          visible={announcementModalVisible}
          animationType="slide"
          onRequestClose={() => setAnnouncementModalVisible(false)}
        >
          <SafeAreaView style={styles.announcementModalRoot}>
            <LinearGradient
              colors={["#9C7EEB", "#8A63D2", "#7C5AC8"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.announcementModalHeader}>
                <Pressable onPress={() => setAnnouncementModalVisible(false)}>
                  <Ionicons name="close" size={24} color="white" />
                </Pressable>
                <Text style={styles.announcementModalTitle}>Announcements</Text>
                <View style={{ width: 24 }} />
              </View>
            </LinearGradient>

            <ScrollView
              contentContainerStyle={styles.announcementList}
              showsVerticalScrollIndicator={false}
            >
              {announcements.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="megaphone-outline" size={48} color="#D1D5DB" />
                  <Text style={styles.emptyStateText}>No announcements yet</Text>
                </View>
              ) : (
                announcements.map((announcement) => (
                  <View key={announcement.id} style={styles.announcementCard}>
                    <Text style={styles.announcementCardTitle}>
                      {announcement.title}
                    </Text>
                    <Text style={styles.announcementCardBody}>
                      {announcement.description}
                    </Text>
                    {announcement.links.length > 0 && (
                      <View style={styles.announcementLinksContainer}>
                        {announcement.links.map((link, idx) => (
                          <Pressable
                            key={idx}
                            onPress={() => Linking.openURL(link.url)}
                          >
                            <Text style={styles.announcementLinkText}>
                              {link.title}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    )}
                    <Text style={styles.announcementCardMeta}>
                      Posted by {announcement.authorName}
                      {announcement.authorPosition
                        ? `, ${announcement.authorPosition}`
                        : ""}
                    </Text>
                    <Text style={styles.announcementCardDate}>
                      {formatAnnouncementDateTime(announcement.createdAt)}
                    </Text>
                    <View style={styles.announcementExpiry}>
                      <Text style={styles.announcementExpiryText}>
                        Expires in {getDaysRemaining(announcement.expiresAt)} days
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
          </SafeAreaView>
        </Modal>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingTop: 20,
    paddingBottom: 30,
  },
  logoContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  logoIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "white",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
    overflow: "hidden",
  },
  logoIconImage: {
    width: 22,
    height: 22,
  },
  logoText: {
    fontSize: 18,
    fontWeight: "700",
    color: "white",
  },
  chatButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  rightButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  profileButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  greetingSection: {
    marginBottom: 30,
  },
  greeting: {
    fontSize: 32,
    fontWeight: "600",
    color: "white",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "rgba(255, 255, 255, 0.9)",
    lineHeight: 22,
  },
  cardsContainer: {
    gap: 16,
    marginBottom: 30,
  },
  cardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 16,
  },
  card: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 18,
    // @ts-ignore — web-only shadow property
    boxShadow: "0px 4px 16px rgba(138, 99, 210, 0.10)",
    elevation: 4,
    gap: 12,
    borderWidth: 1,
    borderColor: "rgba(156, 126, 235, 0.08)",
  },
  cardIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "flex-start",
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  cardDescription: {
    fontSize: 13,
    color: "#666",
    lineHeight: 20,
  },
  quoteContainer: {
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.18)",
  },
  quote: {
    fontSize: 16,
    color: "white",
    textAlign: "center",
    fontStyle: "italic",
    lineHeight: 24,
  },
  signOutOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  signOutBox: {
    padding: 20,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    gap: 12,
  },
  signOutText: {
    color: "white",
    marginTop: 8,
    fontSize: 16,
  },
  confirmOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  confirmBox: {
    width: "86%",
    padding: 24,
    borderRadius: 20,
    backgroundColor: "white",
    alignItems: "center",
    gap: 14,
    // @ts-ignore — web-only shadow property
    boxShadow: "0px 12px 40px rgba(0,0,0,0.12)",
  },
  confirmTitle: { fontSize: 18, fontWeight: "700", color: "#2D1B69" },
  confirmMessage: { fontSize: 14, color: "#6B7280", textAlign: "center", lineHeight: 20 },
  confirmButtons: {
    flexDirection: "row",
    width: "100%",
    justifyContent: "space-between",
    marginTop: 8,
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    marginHorizontal: 6,
  },
  cancelButton: { backgroundColor: "#F3F0FF", borderRadius: 14 },
  logoutButton: { backgroundColor: "#EF4444", borderRadius: 14 },
  cancelText: { color: "#4B5563", fontWeight: "600" },
  logoutText: { color: "white", fontWeight: "600" },
  // ─── Badge ─────────────────────────────────────────────────────────
  badgeContainer: {
    position: "absolute",
    top: -4,
    right: -8,
    backgroundColor: "#EF4444",
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  badgeText: {
    color: "white",
    fontSize: 10,
    fontWeight: "700",
  },
  // ─── Announcement Modal ────────────────────────────────────────────
  announcementModalRoot: {
    flex: 1,
    backgroundColor: "#F4F2F8",
  },
  announcementModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
  },
  announcementModalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "white",
  },
  announcementList: {
    padding: 20,
    gap: 16,
  },
  announcementCard: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 18,
    // @ts-ignore — web-only shadow property
    boxShadow: "0px 4px 16px rgba(138, 99, 210, 0.10)",
    elevation: 3,
    borderWidth: 1,
    borderColor: "rgba(156, 126, 235, 0.08)",
  },
  announcementCardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1E1B4B",
    marginBottom: 8,
  },
  announcementCardBody: {
    fontSize: 14,
    color: "#4B5563",
    lineHeight: 22,
    marginBottom: 12,
  },
  announcementLinksContainer: {
    gap: 6,
    marginBottom: 12,
  },
  announcementLinkText: {
    fontSize: 13,
    color: "#8A63D2",
    fontWeight: "600",
    textDecorationLine: "underline",
  },
  announcementCardMeta: {
    fontSize: 12,
    color: "#9CA3AF",
    marginBottom: 2,
  },
  announcementCardDate: {
    fontSize: 11,
    color: "#D1D5DB",
  },
  announcementExpiry: {
    marginTop: 6,
    alignSelf: "flex-start",
    backgroundColor: "#F3EEFF",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  announcementExpiryText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#8A63D2",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    gap: 12,
  },
  emptyStateText: {
    fontSize: 16,
    color: "#9CA3AF",
    fontWeight: "500",
  },
});
