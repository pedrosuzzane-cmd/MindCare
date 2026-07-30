import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/constants/firebase";
import { useAuth } from "@/hooks/AuthContext";
import { useSidePanel } from "@/contexts/SidePanelContext";
import { handleSignOut } from "@/services/authService";

const PANEL_WIDTH = Math.min(Dimensions.get("window").width * 0.75, 300);

interface MenuEntry {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
}

const MENU_ITEMS: MenuEntry[] = [
  { label: "Profile", icon: "person-circle-outline", route: "/profile" },
  { label: "Achievements", icon: "trophy-outline", route: "/achievements" },
  { label: "Daily Journal", icon: "book-outline", route: "/daily-journal" },
  { label: "Mood Calendar", icon: "calendar-outline", route: "/mood-calendar" },
  { label: "Daily Reminders", icon: "notifications-outline", route: "/daily-reminders" },
  { label: "Self-Assessment", icon: "clipboard-outline", route: "/self-assessment-menu" },
  { label: "Support Hotlines", icon: "call-outline", route: "/support-hotlines" },
  { label: "AI Helper", icon: "bulb-outline", route: "/ai-helper" },
  { label: "Wellness Suggestions", icon: "sparkles-outline", route: "/journal-suggestions" },
];

export default function SidePanel() {
  const { isOpen, close } = useSidePanel();
  const { user } = useAuth();
  const slideAnim = useRef(new Animated.Value(-PANEL_WIDTH)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isOpen) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: Platform.OS !== "web",
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: Platform.OS !== "web",
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -PANEL_WIDTH,
          duration: 200,
          useNativeDriver: Platform.OS !== "web",
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: Platform.OS !== "web",
        }),
      ]).start();
    }
  }, [isOpen]);

  const navigate = (route: string) => {
    close();
    router.push(route as any);
  };

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [legalModalVisible, setLegalModalVisible] = useState(false);
  const [legalModalType, setLegalModalType] = useState<"terms" | "about" | "privacy">("terms");

  useEffect(() => {
    if (!user?.uid) return;
    getDoc(doc(db, "users", user.uid)).then((snap) => {
      if (snap.exists()) {
        setDisplayName(snap.data().fullName || snap.data().displayName || user?.displayName || "");
        setProfileImage(snap.data().profileImage || null);
      }
    }).catch(() => {
      if (user?.displayName) setDisplayName(user.displayName);
    });
  }, [user?.uid]);

  const doSignOut = async () => {
    setShowLogoutConfirm(false);
    close();
    try {
      await handleSignOut(router);
    } catch (err) {
      console.error("Logout error", err);
    }
  };

  const initials = displayName
    ? displayName
        .split(" ")
        .map((s) => s.charAt(0))
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  return (
    <>
      {isOpen && (
        <Pressable style={styles.overlay} onPress={close}>
          <Animated.View style={[styles.overlayBg, { opacity: fadeAnim }]} />
        </Pressable>
      )}
      <Animated.View
        style={[
          styles.panel,
          { transform: [{ translateX: slideAnim }] },
          { pointerEvents: isOpen ? "auto" as any : "none" as any },
        ]}
      >
        <SafeAreaView style={styles.panelSafe}>
          <View style={styles.profileSection}>
            {profileImage ? (
              <Image source={{ uri: profileImage }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
            )}
            <Text style={styles.userName} numberOfLines={1}>
              {displayName || "User"}
            </Text>
            <Text style={styles.userEmail} numberOfLines={1}>
              {user?.email || ""}
            </Text>
          </View>

          <View style={styles.divider} />

          <ScrollView style={styles.menuSection} contentContainerStyle={styles.menuSectionContent} showsVerticalScrollIndicator={false}>
            {MENU_ITEMS.map((item) => (
              <Pressable
                key={item.route}
                style={styles.menuItem}
                onPress={() => navigate(item.route)}
              >
                <Ionicons name={item.icon} size={22} color="#4B5563" />
                <Text style={styles.menuLabel}>{item.label}</Text>
              </Pressable>
            ))}

            <View style={styles.divider} />

            <Pressable style={styles.menuItem} onPress={() => navigate("/help-and-support")}>
              <Ionicons name="help-circle-outline" size={22} color="#4B5563" />
              <Text style={styles.menuLabel}>Help & Support</Text>
            </Pressable>
            <Pressable style={styles.menuItem} onPress={() => { setLegalModalType("terms"); setLegalModalVisible(true); }}>
              <Ionicons name="document-text-outline" size={22} color="#4B5563" />
              <Text style={styles.menuLabel}>Terms of Service</Text>
            </Pressable>
            <Pressable style={styles.menuItem} onPress={() => { setLegalModalType("about"); setLegalModalVisible(true); }}>
              <Ionicons name="information-circle-outline" size={22} color="#4B5563" />
              <Text style={styles.menuLabel}>About MindCare</Text>
            </Pressable>
            <Pressable style={styles.menuItem} onPress={() => { setLegalModalType("privacy"); setLegalModalVisible(true); }}>
              <Ionicons name="lock-closed-outline" size={22} color="#4B5563" />
              <Text style={styles.menuLabel}>Privacy Policy</Text>
            </Pressable>

            <View style={styles.divider} />

            <Pressable style={styles.signOutItem} onPress={() => setShowLogoutConfirm(true)}>
              <Ionicons name="log-out-outline" size={22} color="#EF4444" />
              <Text style={styles.signOutLabel}>Sign Out</Text>
            </Pressable>
          </ScrollView>
        </SafeAreaView>

        <Modal visible={showLogoutConfirm} transparent animationType="fade" onRequestClose={() => setShowLogoutConfirm(false)}>
          <View style={styles.logoutOverlay}>
            <View style={styles.logoutBox}>
              <Ionicons name="log-out-outline" size={36} color="#EF4444" />
              <Text style={styles.logoutTitle}>Sign Out</Text>
              <Text style={styles.logoutMessage}>Are you sure you want to sign out?</Text>
              <View style={styles.logoutButtons}>
                <Pressable style={styles.cancelBtn} onPress={() => setShowLogoutConfirm(false)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </Pressable>
                <Pressable style={styles.confirmBtn} onPress={doSignOut}>
                  <Text style={styles.confirmBtnText}>Sign Out</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        <Modal visible={legalModalVisible} animationType="slide" onRequestClose={() => setLegalModalVisible(false)}>
          <SafeAreaView style={styles.legalFullScreen}>
            <LinearGradient colors={["#8A63D2", "#B794F6"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <View style={styles.legalHeader}>
                <Pressable style={styles.legalBackBtn} onPress={() => setLegalModalVisible(false)}>
                  <Ionicons name="arrow-back" size={22} color="white" />
                </Pressable>
                <Text style={styles.legalHeaderTitle}>
                  {legalModalType === "terms" ? "Terms of Service" : legalModalType === "about" ? "About MindCare" : "Privacy Policy"}
                </Text>
                <View style={{ width: 40 }} />
              </View>
            </LinearGradient>

            <ScrollView style={styles.legalBody} contentContainerStyle={{ paddingBottom: 40 }}>
              {legalModalType === "terms" && (
                <>
                  <Text style={styles.legalBodyTitle}>Terms of Service</Text>
                  <Text style={styles.legalBodyDate}>Effective Date: July 2026</Text>
                  <Text style={styles.legalBodyText}>
                    Welcome to MindCare. By using this application, you agree to comply with and be bound by the following terms and conditions.
                  </Text>
                  <Text style={styles.legalBodySubheading}>1. Acceptance of Terms</Text>
                  <Text style={styles.legalBodyText}>
                    By accessing or using MindCare, you acknowledge that you have read and agree to these Terms of Service. If you do not agree, please do not use the application.
                  </Text>
                  <Text style={styles.legalBodySubheading}>2. Services Provided</Text>
                  <Text style={styles.legalBodyText}>
                    MindCare is a student mental wellness platform that offers daily journaling with mood tracking, AI-powered reflections via Gemini, self-assessment surveys, peer messaging, wellness achievements and badges, daily reminders, and administrative dashboards for guidance counselors.
                  </Text>
                  <Text style={styles.legalBodySubheading}>3. User Accounts</Text>
                  <Text style={styles.legalBodyText}>
                    You are responsible for maintaining the confidentiality of your account credentials. Notify us immediately of any unauthorized use. Students are assigned accounts through their educational institution.
                  </Text>
                  <Text style={styles.legalBodySubheading}>4. Privacy & Data</Text>
                  <Text style={styles.legalBodyText}>
                    Your journal entries and personal data are treated with strict confidentiality. AI reflections are processed securely. Aggregate anonymized data may be visible to authorized school administrators. See our Privacy Policy for details.
                  </Text>
                  <Text style={styles.legalBodySubheading}>5. Medical Disclaimer</Text>
                  <Text style={styles.legalBodyText}>
                    MindCare is not a substitute for professional mental health services. It is a self-reflection and wellness tracking tool. In emergencies, contact local authorities or a licensed professional.
                  </Text>
                  <Text style={styles.legalBodySubheading}>6. Changes to Terms</Text>
                  <Text style={styles.legalBodyText}>
                    We reserve the right to modify these terms. Continued use after changes constitutes acceptance of the revised terms.
                  </Text>
                </>
              )}

              {legalModalType === "about" && (
                <>
                  <Text style={styles.legalBodyTitle}>About MindCare</Text>
                  <Text style={styles.legalBodyDate}>Student Mental Wellness Platform v2.0</Text>
                  <Text style={styles.legalBodyText}>
                    MindCare is a mental health and wellness application designed specifically for students. Our mission is to provide a safe, private, and supportive digital space for emotional well-being.
                  </Text>
                  <Text style={styles.legalBodySubheading}>Our Vision</Text>
                  <Text style={styles.legalBodyText}>
                    We believe mental health is as important as physical health. MindCare aims to break the stigma surrounding mental wellness in academic environments by making self-care accessible and data-driven.
                  </Text>
                  <Text style={styles.legalBodySubheading}>Key Features</Text>
                  <Text style={styles.legalBodyText}>
                    {"\u2022"} Daily mood tracking and journaling with rich prompts{"\n"}
                    {"\u2022"} AI-powered reflections through Gemini chat{"\n"}
                    {"\u2022"} Peer messaging and admin communication via the Inbox{"\n"}
                    {"\u2022"} Self-assessment surveys with wellness scoring{"\n"}
                    {"\u2022"} Achievement badges for journaling milestones{"\n"}
                    {"\u2022"} Daily reminders and wellness suggestions{"\n"}
                    {"\u2022"} Administrative dashboards for guidance counselors to monitor trends
                  </Text>
                  <Text style={styles.legalBodySubheading}>Our Commitment</Text>
                  <Text style={styles.legalBodyText}>
                    We are committed to safeguarding your privacy. All information is encrypted and handled per our Privacy Policy and applicable data protection laws.
                  </Text>
                  <Text style={styles.legalBodySubheading}>Contact Us</Text>
                  <Text style={styles.legalBodyText}>
                    For questions or support, reach out through the app's Help & Support section or contact your school's guidance office.
                  </Text>
                </>
              )}

              {legalModalType === "privacy" && (
                <>
                  <Text style={styles.legalBodyTitle}>Privacy Policy</Text>
                  <Text style={styles.legalBodyDate}>Effective Date: July 2026</Text>
                  <Text style={styles.legalBodyText}>
                    Your privacy is important to us. This policy explains how MindCare collects, uses, and protects your information.
                  </Text>
                  <Text style={styles.legalBodySubheading}>1. Information We Collect</Text>
                  <Text style={styles.legalBodyText}>
                    {"\u2022"} Account information: name, email, school ID, academic details{"\n"}
                    {"\u2022"} Wellness data: journal entries, mood logs, assessment responses{"\n"}
                    {"\u2022"} Technical data: device type, operating system, usage analytics
                  </Text>
                  <Text style={styles.legalBodySubheading}>2. How We Use Your Information</Text>
                  <Text style={styles.legalBodyText}>
                    Your data is used solely to provide and improve MindCare:{"\n"}
                    {"\u2022"} Journal entries power AI reflections and suggestions{"\n"}
                    {"\u2022"} Mood data visualizes wellness trends over time{"\n"}
                    {"\u2022"} Aggregate anonymized data helps administrators monitor overall well-being
                  </Text>
                  <Text style={styles.legalBodySubheading}>3. Data Security</Text>
                  <Text style={styles.legalBodyText}>
                    All data is stored with industry-standard encryption. Strict access controls ensure only authorized personnel can access your information. Your journal entries are private and never shared with other students.
                  </Text>
                  <Text style={styles.legalBodySubheading}>4. Data Sharing</Text>
                  <Text style={styles.legalBodyText}>
                    We do not sell or rent your personal information to third parties. Anonymized wellness data may be shared with school guidance counselors to identify students who may need additional support.
                  </Text>
                  <Text style={styles.legalBodySubheading}>5. Your Rights</Text>
                  <Text style={styles.legalBodyText}>
                    You may access, update, or delete your data anytime through profile settings. For data export or deletion requests, contact your school's guidance office.
                  </Text>
                  <Text style={styles.legalBodySubheading}>6. Children's Privacy</Text>
                  <Text style={styles.legalBodyText}>
                    MindCare is intended for students in academic institutions. We comply with all applicable laws regarding the protection of minors' data.
                  </Text>
                  <Text style={styles.legalBodySubheading}>7. Changes to This Policy</Text>
                  <Text style={styles.legalBodyText}>
                    We may update this Privacy Policy. Changes will be reflected in the app and communicated through appropriate channels.
                  </Text>
                </>
              )}
            </ScrollView>
          </SafeAreaView>
        </Modal>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
  },
  overlayBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  panel: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    width: PANEL_WIDTH,
    backgroundColor: "white",
    zIndex: 1000,
    elevation: 20,
  },
  panelSafe: {
    flex: 1,
    paddingTop: Platform.OS === "android" ? 40 : 0,
  },
  profileSection: {
    alignItems: "center",
    paddingVertical: 30,
    paddingHorizontal: 20,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#8A63D2",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  avatarImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
    marginBottom: 12,
  },
  avatarText: {
    color: "white",
    fontSize: 22,
    fontWeight: "700",
  },
  userName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1E1B4B",
    textAlign: "center",
  },
  userEmail: {
    fontSize: 13,
    color: "#9CA3AF",
    textAlign: "center",
    marginTop: 4,
  },
  divider: {
    height: 1,
    backgroundColor: "#F3F0FF",
    marginHorizontal: 20,
  },
  menuSection: {
    flex: 1,
  },
  menuSectionContent: {
    paddingVertical: 12,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 24,
    gap: 14,
  },
  menuLabel: {
    fontSize: 15,
    color: "#4B5563",
    fontWeight: "500",
  },
  signOutItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 24,
    gap: 14,
  },
  signOutLabel: {
    fontSize: 15,
    color: "#EF4444",
    fontWeight: "600",
  },
  logoutOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  logoutBox: {
    width: "82%",
    maxWidth: 320,
    backgroundColor: "white",
    borderRadius: 20,
    padding: 28,
    alignItems: "center",
    gap: 12,
    // @ts-ignore
    boxShadow: "0px 12px 40px rgba(0,0,0,0.15)",
  },
  logoutTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1E1B4B",
  },
  logoutMessage: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 4,
  },
  logoutButtons: {
    flexDirection: "row",
    width: "100%",
    gap: 12,
    marginTop: 8,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#F3F0FF",
    alignItems: "center",
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#4B5563",
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#EF4444",
    alignItems: "center",
  },
  confirmBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: "white",
  },
  legalFullScreen: { flex: 1, backgroundColor: "#F4F2F8" },
  legalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  legalBackBtn: { width: 40, height: 40, justifyContent: "center", alignItems: "center" },
  legalHeaderTitle: { fontSize: 18, fontWeight: "700", color: "white" },
  legalBody: { flex: 1, paddingHorizontal: 24, paddingTop: 24 },
  legalBodyTitle: { fontSize: 24, fontWeight: "700", color: "#1E1B4B", marginBottom: 4 },
  legalBodyDate: { fontSize: 13, color: "#8A63D2", marginBottom: 16 },
  legalBodyText: { fontSize: 14, color: "#4B5563", lineHeight: 22, marginBottom: 16 },
  legalBodySubheading: { fontSize: 16, fontWeight: "700", color: "#2D1B69", marginTop: 8, marginBottom: 6 },
});