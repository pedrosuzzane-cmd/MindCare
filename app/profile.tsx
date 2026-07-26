import { auth, db } from "@/constants/firebase";
import { useAuth } from "@/hooks/AuthContext";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";

export default function ProfileScreen() {
  const { role } = useAuth();
  const isAdmin = role === "admin";
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Record<string, any> | null>(null);
  const [uid, setUid] = useState<string | null>(null);

  // Edit state
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [legalModalVisible, setLegalModalVisible] = useState(false);
  const [legalModalType, setLegalModalType] = useState<"terms" | "about" | "privacy">("terms");

  // Shared form fields
  const [fullName, setFullName] = useState("");
  const [contactNo, setContactNo] = useState("");
  const [nationality, setNationality] = useState("");
  const [genderIdentity, setGenderIdentity] = useState("");
  const [address, setAddress] = useState("");

  // Admin-only fields
  const [position, setPosition] = useState("");

  // Student-only fields
  const [schoolId, setSchoolId] = useState("");
  const [academicProgram, setAcademicProgram] = useState("");
  const [yearLevel, setYearLevel] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/auth/login");
        return;
      }

      setUid(user.uid);

      try {
        const collectionName = role === "admin" ? "admins" : "users";
        const ref = doc(db, collectionName, user.uid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data();
          setProfile(data);
          // populate shared fields
          setFullName(data.fullName || "");
          setContactNo(data.contactNo || "");
          setNationality(data.nationality || "");
          setGenderIdentity(data.genderIdentity || "");
          setAddress(data.provincialAddress || data.address || "");
          // populate admin-only fields
          setPosition(data.position || "");
          // populate student-only fields
          setSchoolId(data.schoolId || "");
          setAcademicProgram(data.academicProgram || "");
          setYearLevel(data.yearLevel || "");
        } else {
          setProfile(null);
        }
      } catch (err) {
        console.error("Error fetching profile", err);
        setProfile(null);
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, [role]);

  const handleBack = () => router.back();

  const sanitize = (value: string, maxLen = 500) =>
    value.trim().slice(0, maxLen);

  const handleEditToggle = () => {
    setEditing((e) => !e);
    // reset fields if cancelling
    if (editing && profile) {
      setFullName(profile.fullName || "");
      setContactNo(profile.contactNo || "");
      setNationality(profile.nationality || "");
      setGenderIdentity(profile.genderIdentity || "");
      setAddress(profile.provincialAddress || profile.address || "");
      setPosition(profile.position || "");
      setSchoolId(profile.schoolId || "");
      setAcademicProgram(profile.academicProgram || "");
      setYearLevel(profile.yearLevel || "");
    }
  };

  const formatSchoolId = (value: string): string => {
    const digits = value.replace(/[^0-9A-Za-z]/g, "").slice(0, 9);
    const parts: string[] = [];
    if (digits.length > 0) parts.push(digits.slice(0, 2));
    if (digits.length > 2) parts.push(digits.slice(2, 6));
    if (digits.length > 6) parts.push(digits.slice(6, 9));
    return parts.join("-");
  };

  const handleSave = async () => {
    if (!uid) return Alert.alert("Error", "User not found.");
    if (!fullName.trim())
      return Alert.alert("Validation", "Full name is required.");
    setConfirmModalVisible(true);
  };

  const confirmSave = async () => {
    if (!uid) return;
    setConfirmModalVisible(false);
    setSaving(true);
    try {
      const data: Record<string, any> = {
        fullName: sanitize(fullName, 200),
        contactNo: sanitize(contactNo.replace(/[^0-9+\-() ]/g, ""), 30),
        nationality: sanitize(nationality, 50),
        genderIdentity: sanitize(genderIdentity, 50),
        updatedAt: new Date().toISOString(),
      };

      if (isAdmin) {
        data.schoolId = sanitize(schoolId.replace(/-/g, ""), 20);
        data.position = sanitize(position, 100);
        data.address = sanitize(address, 500);
      } else {
        data.schoolId = sanitize(schoolId, 50);
        data.academicProgram = sanitize(academicProgram, 100);
        data.yearLevel = sanitize(yearLevel, 50);
        data.provincialAddress = sanitize(address, 500);
      }

      const collectionName = role === "admin" ? "admins" : "users";
      await setDoc(doc(db, collectionName, uid), data, { merge: true });
      setProfile((p) => ({ ...(p || {}), ...data }));
      setEditing(false);
    } catch (err) {
      console.error("Error saving profile", err);
      Alert.alert("Error", "Unable to save profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1 }}
    >
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={["#9C27B0", "#7B1FA2"]}
        style={styles.headerGradient}
      >
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={handleBack}>
            <Ionicons name="arrow-back" size={24} color="white" />
          </Pressable>
          <Text style={styles.headerTitle}>Profile</Text>
          <View style={styles.headerButtons}>
            {editing ? (
              <>
                <Pressable
                  style={styles.headerButton}
                  onPress={handleSave}
                  disabled={saving}
                >
                  <Ionicons name="checkmark" size={20} color="white" />
                </Pressable>
                <Pressable
                  style={styles.headerButton}
                  onPress={handleEditToggle}
                  disabled={saving}
                >
                  <Ionicons name="close" size={20} color="white" />
                </Pressable>
              </>
            ) : (
              <Pressable style={styles.headerButton} onPress={handleEditToggle}>
                <Ionicons name="pencil" size={20} color="white" />
              </Pressable>
            )}
          </View>
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          {/* Full Name — always visible, editable for admin only */}
          <Text style={styles.label}>Full Name</Text>
          {editing && isAdmin ? (
            <TextInput
              style={styles.input}
              value={fullName}
              onChangeText={setFullName}
            />
          ) : (
            <Text style={styles.value}>{profile?.fullName || "-"}</Text>
          )}

          {/* Email — always read-only */}
          <Text style={styles.label}>Email</Text>
          <Text style={styles.value}>{profile?.email || "-"}</Text>

          {/* Admin-only fields */}
          {isAdmin && (
            <>
              <Text style={styles.label}>ID No.</Text>
              {editing ? (
                <TextInput
                  style={styles.input}
                  value={schoolId}
                  onChangeText={(t) => setSchoolId(formatSchoolId(t))}
                  placeholder="XX-XXXX-XXX"
                  maxLength={11}
                />
              ) : (
                <Text style={styles.value}>
                  {formatSchoolId(profile?.schoolId || "") || "-"}
                </Text>
              )}

              <Text style={styles.label}>Position</Text>
              {editing ? (
                <TextInput
                  style={styles.input}
                  value={position}
                  onChangeText={setPosition}
                />
              ) : (
                <Text style={styles.value}>{profile?.position || "-"}</Text>
              )}
            </>
          )}

          {/* Student-only fields — always read-only */}
          {!isAdmin && (
            <>
              <Text style={styles.label}>School ID</Text>
              <Text style={styles.value}>{profile?.schoolId || "-"}</Text>

              <Text style={styles.label}>Academic Program</Text>
              <Text style={styles.value}>{profile?.academicProgram || "-"}</Text>

              <Text style={styles.label}>Year Level</Text>
              <Text style={styles.value}>{profile?.yearLevel || "-"}</Text>
            </>
          )}

          {/* Contact Number — always editable */}
          <Text style={styles.label}>Contact Number</Text>
          {editing ? (
            <TextInput
              style={styles.input}
              value={contactNo}
              onChangeText={(t) => setContactNo(t.replace(/[^0-9+\-() ]/g, ""))}
              keyboardType="phone-pad"
            />
          ) : (
            <Text style={styles.value}>{profile?.contactNo || "-"}</Text>
          )}

          {/* Gender Identity — always visible, editable for admin only */}
          <Text style={styles.label}>Gender Identity</Text>
          {editing && isAdmin ? (
            <TextInput
              style={styles.input}
              value={genderIdentity}
              onChangeText={setGenderIdentity}
            />
          ) : (
            <Text style={styles.value}>{profile?.genderIdentity || "-"}</Text>
          )}

          {/* Nationality — always visible, editable for admin only */}
          <Text style={styles.label}>Nationality</Text>
          {editing && isAdmin ? (
            <TextInput
              style={styles.input}
              value={nationality}
              onChangeText={setNationality}
            />
          ) : (
            <Text style={styles.value}>{profile?.nationality || "-"}</Text>
          )}

          {/* Address — always editable */}
          <Text style={styles.label}>Address</Text>
          {editing ? (
            <TextInput
              style={[styles.input, { minHeight: 80 }]}
              value={address}
              onChangeText={setAddress}
              multiline
            />
          ) : (
            <Text style={styles.value}>{address || "-"}</Text>
          )}
        </View>

        {/* ─── Legal & Support Section ────────────────────────────────────── */}
        {!isAdmin && (
          <View style={[styles.card, { marginTop: 16 }]}>
            <Text style={[styles.sectionTitle]}>Legal & Support</Text>

            <Pressable
              style={styles.legalRow}
              onPress={() => { setLegalModalType("terms"); setLegalModalVisible(true); }}
            >
              <View style={[styles.legalIconCircle, { backgroundColor: "#EDE9FE" }]}>
                <Ionicons name="document-text-outline" size={20} color="#8A63D2" />
              </View>
              <Text style={styles.legalLabel}>Terms of Service</Text>
              <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
            </Pressable>

            <View style={styles.legalDivider} />

            <Pressable
              style={styles.legalRow}
              onPress={() => { setLegalModalType("about"); setLegalModalVisible(true); }}
            >
              <View style={[styles.legalIconCircle, { backgroundColor: "#E0F2FE" }]}>
                <Ionicons name="information-circle-outline" size={20} color="#0EA5E9" />
              </View>
              <Text style={styles.legalLabel}>About MindCare</Text>
              <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
            </Pressable>

            <View style={styles.legalDivider} />

            <Pressable
              style={styles.legalRow}
              onPress={() => { setLegalModalType("privacy"); setLegalModalVisible(true); }}
            >
              <View style={[styles.legalIconCircle, { backgroundColor: "#F0FDF4" }]}>
                <Ionicons name="shield-checkmark-outline" size={20} color="#22C55E" />
              </View>
              <Text style={styles.legalLabel}>Privacy Policy</Text>
              <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>

    {/* Confirmation Modal */}
    <Modal
      visible={confirmModalVisible}
      transparent
      animationType="fade"
      onRequestClose={() => setConfirmModalVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <View style={styles.modalIconCircle}>
            <Ionicons name="save-outline" size={28} color="#8A63D2" />
          </View>
          <Text style={styles.modalTitle}>Save Changes?</Text>
          <Text style={styles.modalMessage}>
            Are you sure you want to save changes to your profile?
          </Text>
          <View style={styles.modalActions}>
            <Pressable
              style={styles.modalCancelBtn}
              onPress={() => setConfirmModalVisible(false)}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.modalConfirmBtn, saving && { opacity: 0.6 }]}
              onPress={confirmSave}
              disabled={saving}
            >
              <Text style={styles.modalConfirmText}>Confirm</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>

    {/* ─── Legal Content Modals ───────────────────────────────────────────── */}
    <Modal
      visible={legalModalVisible}
      animationType="slide"
      onRequestClose={() => setLegalModalVisible(false)}
    >
      <SafeAreaView style={styles.legalFullScreen}>
        <LinearGradient
          colors={["#8A63D2", "#B794F6"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.legalHeader}>
            <Pressable
              style={styles.legalBackBtn}
              onPress={() => setLegalModalVisible(false)}
            >
              <Ionicons name="arrow-back" size={22} color="white" />
            </Pressable>
            <Text style={styles.legalHeaderTitle}>
              {legalModalType === "terms"
                ? "Terms of Service"
                : legalModalType === "about"
                  ? "About MindCare"
                  : "Privacy Policy"}
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
                  Welcome to MindCare. By using this application, you agree to comply with and be bound by the following terms and conditions. Please review them carefully.
                </Text>
                <Text style={styles.legalBodySubheading}>1. Acceptance of Terms</Text>
                <Text style={styles.legalBodyText}>
                  By accessing or using MindCare, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service. If you do not agree, please do not use the application.
                </Text>
                <Text style={styles.legalBodySubheading}>2. Use of the Application</Text>
                <Text style={styles.legalBodyText}>
                  MindCare is designed to support student mental wellness through journaling, mood tracking, and AI-assisted reflections. You agree to use the application only for its intended purpose and in compliance with all applicable laws and regulations.
                </Text>
                <Text style={styles.legalBodySubheading}>3. User Accounts</Text>
                <Text style={styles.legalBodyText}>
                  You are responsible for maintaining the confidentiality of your account credentials. You must notify us immediately of any unauthorized use of your account. We are not liable for any loss arising from unauthorized access to your account.
                </Text>
                <Text style={styles.legalBodySubheading}>4. Content and Privacy</Text>
                <Text style={styles.legalBodyText}>
                  Your journal entries and personal data are treated with strict confidentiality. AI-generated reflections are processed securely and are not shared with third parties. Please refer to our Privacy Policy for detailed information.
                </Text>
                <Text style={styles.legalBodySubheading}>5. Limitation of Liability</Text>
                <Text style={styles.legalBodyText}>
                  MindCare is not a substitute for professional mental health services. In case of emergencies, please contact local authorities or a licensed mental health professional. The application is provided "as is" without warranties of any kind.
                </Text>
                <Text style={styles.legalBodySubheading}>6. Changes to Terms</Text>
                <Text style={styles.legalBodyText}>
                  We reserve the right to modify these terms at any time. Continued use of the application after changes constitutes acceptance of the revised terms.
                </Text>
              </>
            )}

            {legalModalType === "about" && (
              <>
                <Text style={styles.legalBodyTitle}>About MindCare</Text>
                <Text style={styles.legalBodyDate}>Student Mental Wellness Platform</Text>
                <Text style={styles.legalBodyText}>
                  MindCare is a mental health and wellness application designed specifically for students. Our mission is to provide a safe, private, and supportive digital space where students can track their emotional well-being, reflect on their experiences, and receive timely support.
                </Text>
                <Text style={styles.legalBodySubheading}>Our Vision</Text>
                <Text style={styles.legalBodyText}>
                  We believe that mental health is just as important as physical health. MindCare aims to break the stigma surrounding mental wellness in academic environments by making self-care accessible, approachable, and data-driven.
                </Text>
                <Text style={styles.legalBodySubheading}>What We Offer</Text>
                <Text style={styles.legalBodyText}>
                  • Daily mood tracking and journaling with rich prompts{"\n"}• AI-powered reflections and personalized suggestions{"\n"}• Confidential peer support chat through Mindy, our AI chatbot{"\n"}• Wellness assessments and progress visualization{"\n"}• Administrative dashboards for guidance counselors to monitor student well-being trends
                </Text>
                <Text style={styles.legalBodySubheading}>Our Commitment</Text>
                <Text style={styles.legalBodyText}>
                  We are committed to safeguarding your privacy and data. All information shared within the application is encrypted and handled in accordance with our Privacy Policy and applicable data protection laws.
                </Text>
                <Text style={styles.legalBodySubheading}>Contact Us</Text>
                <Text style={styles.legalBodyText}>
                  For questions, feedback, or support, please reach out through the application or contact your school's guidance office.
                </Text>
              </>
            )}

            {legalModalType === "privacy" && (
              <>
                <Text style={styles.legalBodyTitle}>Privacy Policy</Text>
                <Text style={styles.legalBodyDate}>Effective Date: July 2026</Text>
                <Text style={styles.legalBodyText}>
                  Your privacy is important to us. This Privacy Policy explains how MindCare collects, uses, and protects your personal information when you use our application.
                </Text>
                <Text style={styles.legalBodySubheading}>1. Information We Collect</Text>
                <Text style={styles.legalBodyText}>
                  • Account information: name, email, school ID, and academic details{"\n"}• Wellness data: journal entries, mood logs, and assessment responses{"\n"}• Technical data: device type, operating system, and usage analytics
                </Text>
                <Text style={styles.legalBodySubheading}>2. How We Use Your Information</Text>
                <Text style={styles.legalBodyText}>
                  Your data is used solely to provide and improve the MindCare experience. Specifically:{"\n"}• Journal entries are used to generate AI-powered reflections and suggestions{"\n"}• Mood data is used to visualize your wellness trends over time{"\n"}• Aggregate (anonymized) data may be used by school administrators to monitor overall student well-being
                </Text>
                <Text style={styles.legalBodySubheading}>3. Data Security</Text>
                <Text style={styles.legalBodyText}>
                  All data is stored securely using industry-standard encryption. We implement strict access controls to ensure that only authorized personnel can access your information. Your journal entries are private and are never shared with other students.
                </Text>
                <Text style={styles.legalBodySubheading}>4. Data Sharing</Text>
                <Text style={styles.legalBodyText}>
                  We do not sell, trade, or rent your personal information to third parties. Anonymized and aggregated wellness data may be shared with school guidance counselors for the purpose of identifying students who may need additional support.
                </Text>
                <Text style={styles.legalBodySubheading}>5. Your Rights</Text>
                <Text style={styles.legalBodyText}>
                  You have the right to access, update, or delete your personal data at any time through the application's profile settings. If you wish to request a full data export or deletion, please contact your school's guidance office.
                </Text>
                <Text style={styles.legalBodySubheading}>6. Children's Privacy</Text>
                <Text style={styles.legalBodyText}>
                  MindCare is intended for use by students in academic institutions. We comply with all applicable laws regarding the protection of minors' personal data.
                </Text>
                <Text style={styles.legalBodySubheading}>7. Changes to This Policy</Text>
                <Text style={styles.legalBodyText}>
                  We may update this Privacy Policy from time to time. Any changes will be reflected in the application and communicated through appropriate channels.
                </Text>
              </>
            )}
          </ScrollView>
      </SafeAreaView>
    </Modal>

    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F4F2F8" },
  headerGradient: { paddingBottom: 12 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: { color: "white", fontSize: 18, fontWeight: "700" },
  headerButtons: { flexDirection: "row", gap: 8, alignItems: "center" },
  headerButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  content: { padding: 20 },
  card: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 20,
    gap: 14,
    // @ts-ignore — web-only shadow property
    boxShadow: "0px 4px 16px rgba(138, 99, 210, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(156, 126, 235, 0.06)",
  },
  input: {
    backgroundColor: "#FAF8FF",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E9D5FF",
    fontSize: 16,
    color: "#1E1B4B",
  },
  label: { fontSize: 12, color: "#7C6B93", marginTop: 12, fontWeight: "600" },
  value: { fontSize: 16, color: "#1E1B4B", marginTop: 4, fontWeight: "500" },
  // ─── Confirmation Modal ─────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 28,
    alignItems: "center",
    width: "100%",
    maxWidth: 360,
    gap: 12,
    // @ts-ignore
    boxShadow: "0px 12px 32px rgba(138, 99, 210, 0.20)",
  },
  modalIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#F3EAFF",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1E1B4B",
  },
  modalMessage: {
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 20,
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 12,
    width: "100%",
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#64748B",
  },
  modalConfirmBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: "#8A63D2",
    alignItems: "center",
  },
  modalConfirmText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  // ─── Legal & Support Section ──────────────────────────────────────────────
  sectionTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#8A63D2",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  legalRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    gap: 12,
  },
  legalIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  legalLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: "#1E1B4B",
  },
  legalDivider: {
    height: 1,
    backgroundColor: "rgba(156, 126, 235, 0.08)",
    marginLeft: 48,
  },
  // ─── Legal Content Modal (Full-Screen) ───────────────────────────────────
  legalFullScreen: {
    flex: 1,
    backgroundColor: "#F4F2F8",
  },
  legalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
  },
  legalBackBtn: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  legalHeaderTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "700",
    flex: 1,
    textAlign: "center",
  },
  legalBody: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  legalBodyTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1E1B4B",
    marginBottom: 4,
  },
  legalBodyDate: {
    fontSize: 13,
    fontWeight: "600",
    color: "#8A63D2",
    marginBottom: 16,
  },
  legalBodySubheading: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1E1B4B",
    marginTop: 18,
    marginBottom: 6,
  },
  legalBodyText: {
    fontSize: 14,
    color: "#475569",
    lineHeight: 21,
  },
});
