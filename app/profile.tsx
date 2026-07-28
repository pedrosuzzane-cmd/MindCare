import { auth, db } from "@/constants/firebase";
import { useAuth } from "@/hooks/AuthContext";
import { changeProfileImage } from "@/services/userService";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
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

const HEADER_HEIGHT = 280;

export default function ProfileScreen() {
  const { role } = useAuth();
  const isAdmin = role === "admin";
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Record<string, any> | null>(null);
  const [uid, setUid] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [legalModalVisible, setLegalModalVisible] = useState(false);
  const [legalModalType, setLegalModalType] = useState<"terms" | "about" | "privacy">("terms");
  const [uploadingImage, setUploadingImage] = useState(false);

  const [fullName, setFullName] = useState("");
  const [contactNo, setContactNo] = useState("");
  const [nationality, setNationality] = useState("");
  const [genderIdentity, setGenderIdentity] = useState("");
  const [address, setAddress] = useState("");

  const [position, setPosition] = useState("");
  const [schoolId, setSchoolId] = useState("");
  const [college, setCollege] = useState("");
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
          setFullName(data.fullName || "");
          setContactNo(data.contactNo || "");
          setNationality(data.nationality || "");
          setGenderIdentity(data.genderIdentity || "");
          setAddress(data.provincialAddress || data.address || "");
          setPosition(data.position || "");
          setSchoolId(data.schoolId || "");
          setCollege(data.college || "");
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

  const handleAvatarPress = async () => {
    if (uploadingImage || !uid) return;
    setUploadingImage(true);
    try {
      const collectionName = role === "admin" ? "admins" : "users";
      const newUrl = await changeProfileImage(uid, collectionName);
      if (newUrl) {
        setProfile((p) => ({ ...(p || {}), profileImage: newUrl }));
      }
    } finally {
      setUploadingImage(false);
    }
  };

  const sanitize = (value: string, maxLen = 500) =>
    value.trim().slice(0, maxLen);

  const handleEditToggle = () => {
    setEditing((e) => !e);
    if (editing && profile) {
      setFullName(profile.fullName || "");
      setContactNo(profile.contactNo || "");
      setNationality(profile.nationality || "");
      setGenderIdentity(profile.genderIdentity || "");
      setAddress(profile.provincialAddress || profile.address || "");
      setPosition(profile.position || "");
      setSchoolId(profile.schoolId || "");
      setCollege(profile.college || "");
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
        data.college = sanitize(college, 150);
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

  const getInitials = (name: string): string => {
    if (!name) return "?";
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return parts[0].slice(0, 2).toUpperCase();
  };

  const roleLabel = isAdmin ? "Administrator" : "Student";
  const deptLabel = isAdmin
    ? profile?.college || profile?.position || "MindCare Staff"
    : profile?.academicProgram || "MindCare Student";

  if (loading) {
    return (
      <SafeAreaView style={s.container}>
        <ActivityIndicator style={{ marginTop: 60 }} color="#8A63D2" />
      </SafeAreaView>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1 }}
    >
      <SafeAreaView style={s.container}>
        {/* ─── Purple Header Banner ──────────────────────────────────── */}
        <LinearGradient
          colors={["#7B2CBF", "#9C27B0", "#AB47BC"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.headerGradient}
        >
          {/* Top nav row */}
          <View style={s.topNav}>
            <Pressable style={s.navBtn} onPress={handleBack}>
              <Ionicons name="arrow-back" size={24} color="white" />
            </Pressable>
            <Text style={s.navTitle}>Details</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Avatar */}
          <Pressable style={s.avatarContainer} onPress={handleAvatarPress}>
            <View style={s.avatarRing}>
              {profile?.profileImage ? (
                <Image
                  source={{ uri: profile.profileImage }}
                  style={s.avatarImage}
                />
              ) : (
                <View style={s.avatar}>
                  <Text style={s.avatarText}>
                    {getInitials(profile?.fullName || "")}
                  </Text>
                </View>
              )}
            </View>
            <View style={s.cameraOverlay}>
              {uploadingImage ? (
                <ActivityIndicator size="small" color="#7B2CBF" />
              ) : (
                <Ionicons name="camera" size={14} color="#7B2CBF" />
              )}
            </View>
          </Pressable>

          {/* Name + Role */}
          <Text style={s.userName}>{profile?.fullName || "No Name"}</Text>
          <Text style={s.userRole}>
            {roleLabel} / {deptLabel}
          </Text>

          {/* Quick action buttons */}
          <View style={s.quickActions}>
            <Pressable style={s.quickActionBtn}>
              <Ionicons name="mail" size={20} color="#7B2CBF" />
            </Pressable>
            <Pressable style={s.quickActionBtn}>
              <Ionicons name="call" size={20} color="#7B2CBF" />
            </Pressable>
            <Pressable style={s.quickActionBtn}>
              <Ionicons name="chatbubble" size={20} color="#7B2CBF" />
            </Pressable>
            <Pressable style={s.quickActionBtn}>
              <Ionicons name="heart-outline" size={20} color="#7B2CBF" />
            </Pressable>
          </View>
        </LinearGradient>

        {/* ─── White Content Body ────────────────────────────────────── */}
        <ScrollView
          contentContainerStyle={s.bodyContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Email Section ── */}
          <View style={s.sectionCard}>
            <View style={s.sectionHeader}>
              <View style={[s.sectionIcon, { backgroundColor: "#EDE9FE" }]}>
                <Ionicons name="mail-outline" size={18} color="#7B2CBF" />
              </View>
              <Text style={s.sectionTitle}>Email</Text>
            </View>
            <View style={s.fieldRow}>
              <Ionicons name="mail-open-outline" size={16} color="#94A3B8" />
              <Text style={s.fieldValue}>{profile?.email || "-"}</Text>
            </View>
          </View>

          {/* ── Phone Section ── */}
          <View style={s.sectionCard}>
            <View style={s.sectionHeader}>
              <View style={[s.sectionIcon, { backgroundColor: "#DBEAFE" }]}>
                <Ionicons name="call-outline" size={18} color="#2563EB" />
              </View>
              <Text style={s.sectionTitle}>Phone Number</Text>
            </View>
            {editing ? (
              <TextInput
                style={s.input}
                value={contactNo}
                onChangeText={(t) => setContactNo(t.replace(/[^0-9+\-() ]/g, ""))}
                keyboardType="phone-pad"
                placeholder="Enter contact number"
                placeholderTextColor="#94A3B8"
              />
            ) : (
              <View style={s.fieldRow}>
                <Ionicons name="phone-portrait-outline" size={16} color="#94A3B8" />
                <Text style={s.fieldValue}>{profile?.contactNo || "-"}</Text>
              </View>
            )}
          </View>

          {/* ── Team / Department Section ── */}
          <View style={s.sectionCard}>
            <View style={s.sectionHeader}>
              <View style={[s.sectionIcon, { backgroundColor: "#D1FAE5" }]}>
                <Ionicons name="people-outline" size={18} color="#059669" />
              </View>
              <Text style={s.sectionTitle}>Department</Text>
            </View>
            <View style={s.fieldRow}>
              <Ionicons name="school-outline" size={16} color="#94A3B8" />
              <Text style={s.fieldValue}>{deptLabel}</Text>
              <Ionicons name="chevron-forward" size={16} color="#CBD5E1" style={{ marginLeft: "auto" }} />
            </View>
          </View>

          {/* ── Identity Section ── */}
          <View style={s.sectionCard}>
            <View style={s.sectionHeader}>
              <View style={[s.sectionIcon, { backgroundColor: "#FEF3C7" }]}>
                <Ionicons name="person-outline" size={18} color="#D97706" />
              </View>
              <Text style={s.sectionTitle}>Personal Information</Text>
            </View>

            {/* Full Name */}
            <Text style={s.fieldLabel}>Full Name</Text>
            {editing && isAdmin ? (
              <TextInput
                style={s.input}
                value={fullName}
                onChangeText={setFullName}
              />
            ) : (
              <View style={s.fieldRow}>
                <Text style={s.fieldValue}>{profile?.fullName || "-"}</Text>
              </View>
            )}

            {/* Gender Identity */}
            <Text style={s.fieldLabel}>Gender Identity</Text>
            {editing && isAdmin ? (
              <TextInput
                style={s.input}
                value={genderIdentity}
                onChangeText={setGenderIdentity}
              />
            ) : (
              <View style={s.fieldRow}>
                <Text style={s.fieldValue}>{profile?.genderIdentity || "-"}</Text>
              </View>
            )}

            {/* Nationality */}
            <Text style={s.fieldLabel}>Nationality</Text>
            {editing && isAdmin ? (
              <TextInput
                style={s.input}
                value={nationality}
                onChangeText={setNationality}
              />
            ) : (
              <View style={s.fieldRow}>
                <Text style={s.fieldValue}>{profile?.nationality || "-"}</Text>
              </View>
            )}

            {/* Address */}
            <Text style={s.fieldLabel}>Address</Text>
            {editing ? (
              <TextInput
                style={[s.input, { minHeight: 80 }]}
                value={address}
                onChangeText={setAddress}
                multiline
                placeholder="Enter address"
                placeholderTextColor="#94A3B8"
              />
            ) : (
              <View style={s.fieldRow}>
                <Text style={s.fieldValue}>{address || "-"}</Text>
              </View>
            )}
          </View>

          {/* ── Academic / Admin Info ── */}
          {isAdmin ? (
            <View style={s.sectionCard}>
              <View style={s.sectionHeader}>
                <View style={[s.sectionIcon, { backgroundColor: "#E0E7FF" }]}>
                  <Ionicons name="briefcase-outline" size={18} color="#4F46E5" />
                </View>
                <Text style={s.sectionTitle}>Admin Details</Text>
              </View>

              <Text style={s.fieldLabel}>ID No.</Text>
              {editing ? (
                <TextInput
                  style={s.input}
                  value={schoolId}
                  onChangeText={(t) => setSchoolId(formatSchoolId(t))}
                  placeholder="XX-XXXX-XXX"
                  placeholderTextColor="#94A3B8"
                  maxLength={11}
                />
              ) : (
                <View style={s.fieldRow}>
                  <Text style={s.fieldValue}>
                    {formatSchoolId(profile?.schoolId || "") || "-"}
                  </Text>
                </View>
              )}

              <Text style={s.fieldLabel}>College / University</Text>
              {editing ? (
                <TextInput
                  style={s.input}
                  value={college}
                  onChangeText={setCollege}
                  placeholder="e.g. University of the Cordilleras (UC)"
                  placeholderTextColor="#94A3B8"
                />
              ) : (
                <View style={s.fieldRow}>
                  <Text style={s.fieldValue}>{profile?.college || "-"}</Text>
                </View>
              )}

              <Text style={s.fieldLabel}>Position</Text>
              {editing ? (
                <TextInput
                  style={s.input}
                  value={position}
                  onChangeText={setPosition}
                />
              ) : (
                <View style={s.fieldRow}>
                  <Text style={s.fieldValue}>{profile?.position || "-"}</Text>
                </View>
              )}
            </View>
          ) : (
            <View style={s.sectionCard}>
              <View style={s.sectionHeader}>
                <View style={[s.sectionIcon, { backgroundColor: "#E0E7FF" }]}>
                  <Ionicons name="book-outline" size={18} color="#4F46E5" />
                </View>
                <Text style={s.sectionTitle}>Academic Information</Text>
              </View>

              <View style={s.fieldRow}>
                <Ionicons name="card-outline" size={16} color="#94A3B8" />
                <Text style={s.fieldValue}>{profile?.schoolId || "-"}</Text>
              </View>

              <View style={s.fieldRow}>
                <Ionicons name="library-outline" size={16} color="#94A3B8" />
                <Text style={s.fieldValue}>{profile?.academicProgram || "-"}</Text>
              </View>

              <View style={s.fieldRow}>
                <Ionicons name="layers-outline" size={16} color="#94A3B8" />
                <Text style={s.fieldValue}>{profile?.yearLevel || "-"}</Text>
              </View>
            </View>
          )}

          {/* ─── Legal & Support (students only) ─── */}
          {!isAdmin && (
            <View style={s.sectionCard}>
              <View style={s.sectionHeader}>
                <View style={[s.sectionIcon, { backgroundColor: "#FCE7F3" }]}>
                  <Ionicons name="shield-checkmark-outline" size={18} color="#DB2777" />
                </View>
                <Text style={s.sectionTitle}>Legal & Support</Text>
              </View>

              <Pressable
                style={s.legalRow}
                onPress={() => { setLegalModalType("terms"); setLegalModalVisible(true); }}
              >
                <View style={[s.legalIconCircle, { backgroundColor: "#EDE9FE" }]}>
                  <Ionicons name="document-text-outline" size={18} color="#8A63D2" />
                </View>
                <Text style={s.legalLabel}>Terms of Service</Text>
                <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
              </Pressable>

              <View style={s.legalDivider} />

              <Pressable
                style={s.legalRow}
                onPress={() => { setLegalModalType("about"); setLegalModalVisible(true); }}
              >
                <View style={[s.legalIconCircle, { backgroundColor: "#E0F2FE" }]}>
                  <Ionicons name="information-circle-outline" size={18} color="#0EA5E9" />
                </View>
                <Text style={s.legalLabel}>About MindCare</Text>
                <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
              </Pressable>

              <View style={s.legalDivider} />

              <Pressable
                style={s.legalRow}
                onPress={() => { setLegalModalType("privacy"); setLegalModalVisible(true); }}
              >
                <View style={[s.legalIconCircle, { backgroundColor: "#F0FDF4" }]}>
                  <Ionicons name="lock-closed-outline" size={18} color="#22C55E" />
                </View>
                <Text style={s.legalLabel}>Privacy Policy</Text>
                <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
              </Pressable>
            </View>
          )}

          <View style={{ height: 100 }} />
        </ScrollView>

        {/* ─── Bottom Action Bar ─────────────────────────────────────── */}
        <View style={s.bottomBar}>
          {editing ? (
            <>
              <Pressable
                style={s.cancelBtn}
                onPress={handleEditToggle}
                disabled={saving}
              >
                <Text style={s.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[s.saveBtn, saving && { opacity: 0.6 }]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Text style={s.saveBtnText}>Save Changes</Text>
                )}
              </Pressable>
            </>
          ) : (
            <>
              <Pressable style={s.secondaryBtn} onPress={handleBack}>
                <Ionicons name="arrow-back" size={18} color="#7B2CBF" />
                <Text style={s.secondaryBtnText}>Back</Text>
              </Pressable>
              <Pressable style={s.editBtn} onPress={handleEditToggle}>
                <Ionicons name="pencil" size={18} color="white" />
                <Text style={s.editBtnText}>Edit Profile</Text>
              </Pressable>
            </>
          )}
        </View>
      </SafeAreaView>

      {/* ─── Confirmation Modal ─────────────────────────────────────── */}
      <Modal
        visible={confirmModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmModalVisible(false)}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalIconCircle}>
              <Ionicons name="save-outline" size={28} color="#8A63D2" />
            </View>
            <Text style={s.modalTitle}>Save Changes?</Text>
            <Text style={s.modalMessage}>
              Are you sure you want to save changes to your profile?
            </Text>
            <View style={s.modalActions}>
              <Pressable
                style={s.modalCancelBtn}
                onPress={() => setConfirmModalVisible(false)}
              >
                <Text style={s.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[s.modalConfirmBtn, saving && { opacity: 0.6 }]}
                onPress={confirmSave}
                disabled={saving}
              >
                <Text style={s.modalConfirmText}>Confirm</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── Legal Content Modals ────────────────────────────────────── */}
      <Modal
        visible={legalModalVisible}
        animationType="slide"
        onRequestClose={() => setLegalModalVisible(false)}
      >
        <SafeAreaView style={s.legalFullScreen}>
          <LinearGradient
            colors={["#8A63D2", "#B794F6"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={s.legalHeader}>
              <Pressable
                style={s.legalBackBtn}
                onPress={() => setLegalModalVisible(false)}
              >
                <Ionicons name="arrow-back" size={22} color="white" />
              </Pressable>
              <Text style={s.legalHeaderTitle}>
                {legalModalType === "terms"
                  ? "Terms of Service"
                  : legalModalType === "about"
                    ? "About MindCare"
                    : "Privacy Policy"}
              </Text>
              <View style={{ width: 40 }} />
            </View>
          </LinearGradient>

          <ScrollView style={s.legalBody} contentContainerStyle={{ paddingBottom: 40 }}>
            {legalModalType === "terms" && (
              <>
                <Text style={s.legalBodyTitle}>Terms of Service</Text>
                <Text style={s.legalBodyDate}>Effective Date: July 2026</Text>
                <Text style={s.legalBodyText}>
                  Welcome to MindCare. By using this application, you agree to comply with and be bound by the following terms and conditions. Please review them carefully.
                </Text>
                <Text style={s.legalBodySubheading}>1. Acceptance of Terms</Text>
                <Text style={s.legalBodyText}>
                  By accessing or using MindCare, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service. If you do not agree, please do not use the application.
                </Text>
                <Text style={s.legalBodySubheading}>2. Use of the Application</Text>
                <Text style={s.legalBodyText}>
                  MindCare is designed to support student mental wellness through journaling, mood tracking, and AI-assisted reflections. You agree to use the application only for its intended purpose and in compliance with all applicable laws and regulations.
                </Text>
                <Text style={s.legalBodySubheading}>3. User Accounts</Text>
                <Text style={s.legalBodyText}>
                  You are responsible for maintaining the confidentiality of your account credentials. You must notify us immediately of any unauthorized use of your account. We are not liable for any loss arising from unauthorized access to your account.
                </Text>
                <Text style={s.legalBodySubheading}>4. Content and Privacy</Text>
                <Text style={s.legalBodyText}>
                  Your journal entries and personal data are treated with strict confidentiality. AI-generated reflections are processed securely and are not shared with third parties. Please refer to our Privacy Policy for detailed information.
                </Text>
                <Text style={s.legalBodySubheading}>5. Limitation of Liability</Text>
                <Text style={s.legalBodyText}>
                  MindCare is not a substitute for professional mental health services. In case of emergencies, please contact local authorities or a licensed mental health professional. The application is provided "as is" without warranties of any kind.
                </Text>
                <Text style={s.legalBodySubheading}>6. Changes to Terms</Text>
                <Text style={s.legalBodyText}>
                  We reserve the right to modify these terms at any time. Continued use of the application after changes constitutes acceptance of the revised terms.
                </Text>
              </>
            )}

            {legalModalType === "about" && (
              <>
                <Text style={s.legalBodyTitle}>About MindCare</Text>
                <Text style={s.legalBodyDate}>Student Mental Wellness Platform</Text>
                <Text style={s.legalBodyText}>
                  MindCare is a mental health and wellness application designed specifically for students. Our mission is to provide a safe, private, and supportive digital space where students can track their emotional well-being, reflect on their experiences, and receive timely support.
                </Text>
                <Text style={s.legalBodySubheading}>Our Vision</Text>
                <Text style={s.legalBodyText}>
                  We believe that mental health is just as important as physical health. MindCare aims to break the stigma surrounding mental wellness in academic environments by making self-care accessible, approachable, and data-driven.
                </Text>
                <Text style={s.legalBodySubheading}>What We Offer</Text>
                <Text style={s.legalBodyText}>
                  {"\u2022"} Daily mood tracking and journaling with rich prompts{"\n"}{"\u2022"} AI-powered reflections and personalized suggestions{"\n"}{"\u2022"} Confidential peer support chat through Mindy, our AI chatbot{"\n"}{"\u2022"} Wellness assessments and progress visualization{"\n"}{"\u2022"} Administrative dashboards for guidance counselors to monitor student well-being trends
                </Text>
                <Text style={s.legalBodySubheading}>Our Commitment</Text>
                <Text style={s.legalBodyText}>
                  We are committed to safeguarding your privacy and data. All information shared within the application is encrypted and handled in accordance with our Privacy Policy and applicable data protection laws.
                </Text>
                <Text style={s.legalBodySubheading}>Contact Us</Text>
                <Text style={s.legalBodyText}>
                  For questions, feedback, or support, please reach out through the application or contact your school's guidance office.
                </Text>
              </>
            )}

            {legalModalType === "privacy" && (
              <>
                <Text style={s.legalBodyTitle}>Privacy Policy</Text>
                <Text style={s.legalBodyDate}>Effective Date: July 2026</Text>
                <Text style={s.legalBodyText}>
                  Your privacy is important to us. This Privacy Policy explains how MindCare collects, uses, and protects your personal information when you use our application.
                </Text>
                <Text style={s.legalBodySubheading}>1. Information We Collect</Text>
                <Text style={s.legalBodyText}>
                  {"\u2022"} Account information: name, email, school ID, and academic details{"\n"}{"\u2022"} Wellness data: journal entries, mood logs, and assessment responses{"\n"}{"\u2022"} Technical data: device type, operating system, and usage analytics
                </Text>
                <Text style={s.legalBodySubheading}>2. How We Use Your Information</Text>
                <Text style={s.legalBodyText}>
                  Your data is used solely to provide and improve the MindCare experience. Specifically:{"\n"}{"\u2022"} Journal entries are used to generate AI-powered reflections and suggestions{"\n"}{"\u2022"} Mood data is used to visualize your wellness trends over time{"\n"}{"\u2022"} Aggregate (anonymized) data may be used by school administrators to monitor overall student well-being
                </Text>
                <Text style={s.legalBodySubheading}>3. Data Security</Text>
                <Text style={s.legalBodyText}>
                  All data is stored securely using industry-standard encryption. We implement strict access controls to ensure that only authorized personnel can access your information. Your journal entries are private and are never shared with other students.
                </Text>
                <Text style={s.legalBodySubheading}>4. Data Sharing</Text>
                <Text style={s.legalBodyText}>
                  We do not sell, trade, or rent your personal information to third parties. Anonymized and aggregated wellness data may be shared with school guidance counselors for the purpose of identifying students who may need additional support.
                </Text>
                <Text style={s.legalBodySubheading}>5. Your Rights</Text>
                <Text style={s.legalBodyText}>
                  You have the right to access, update, or delete your personal data at any time through the application's profile settings. If you wish to request a full data export or deletion, please contact your school's guidance office.
                </Text>
                <Text style={s.legalBodySubheading}>6. Children's Privacy</Text>
                <Text style={s.legalBodyText}>
                  MindCare is intended for use by students in academic institutions. We comply with all applicable laws regarding the protection of minors' personal data.
                </Text>
                <Text style={s.legalBodySubheading}>7. Changes to This Policy</Text>
                <Text style={s.legalBodyText}>
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

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F4F2F8" },

  /* ── Header Banner ──────────────────────────────────────────────── */
  headerGradient: {
    paddingTop: 16,
    paddingBottom: 40,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  topNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  navTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "700",
  },
  avatarContainer: {
    alignSelf: "center",
    marginTop: 8,
    marginBottom: 12,
    position: "relative",
  },
  avatarRing: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  avatar: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarImage: {
    width: 92,
    height: 92,
    borderRadius: 46,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: "800",
    color: "white",
    letterSpacing: 1,
  },
  cameraOverlay: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  userName: {
    color: "white",
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: 0.3,
  },
  userRole: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 13,
    fontWeight: "500",
    textAlign: "center",
    marginTop: 4,
    marginBottom: 16,
  },
  quickActions: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 16,
  },
  quickActionBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "white",
    justifyContent: "center",
    alignItems: "center",
    // @ts-ignore
    boxShadow: "0px 4px 12px rgba(0,0,0,0.1)",
  },

  /* ── Body ────────────────────────────────────────────────────────── */
  bodyContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },

  /* ── Section Cards ───────────────────────────────────────────────── */
  sectionCard: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    // @ts-ignore
    boxShadow: "0px 2px 12px rgba(138, 99, 210, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(156, 126, 235, 0.05)",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
    gap: 10,
  },
  sectionIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: "center",
    alignItems: "center",
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1E1B4B",
  },

  /* ── Fields ───────────────────────────────────────────────────────── */
  fieldLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#94A3B8",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginTop: 14,
    marginBottom: 4,
  },
  fieldRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(156, 126, 235, 0.06)",
  },
  fieldValue: {
    fontSize: 15,
    color: "#1E1B4B",
    fontWeight: "500",
    flex: 1,
  },
  input: {
    backgroundColor: "#FAF8FF",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E9D5FF",
    fontSize: 15,
    color: "#1E1B4B",
    marginTop: 4,
  },

  /* ── Bottom Action Bar ───────────────────────────────────────────── */
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 32 : 24,
    backgroundColor: "white",
    borderTopWidth: 1,
    borderTopColor: "rgba(156, 126, 235, 0.08)",
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#64748B",
  },
  saveBtn: {
    flex: 1.5,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: "#8A63D2",
    alignItems: "center",
    justifyContent: "center",
    // @ts-ignore
    boxShadow: "0px 4px 12px rgba(138, 99, 210, 0.3)",
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "white",
  },
  secondaryBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: "#F5F0FF",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
    borderWidth: 1,
    borderColor: "#E9D5FF",
  },
  secondaryBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#7B2CBF",
  },
  editBtn: {
    flex: 1.5,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: "#8A63D2",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
    // @ts-ignore
    boxShadow: "0px 4px 12px rgba(138, 99, 210, 0.3)",
  },
  editBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "white",
  },

  /* ── Legal Section ───────────────────────────────────────────────── */
  legalRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    gap: 12,
  },
  legalIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: "center",
    alignItems: "center",
  },
  legalLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: "#1E1B4B",
  },
  legalDivider: {
    height: 1,
    backgroundColor: "rgba(156, 126, 235, 0.06)",
    marginLeft: 46,
  },

  /* ── Confirmation Modal ─────────────────────────────────────────── */
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

  /* ── Legal Content Modal ────────────────────────────────────────── */
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
