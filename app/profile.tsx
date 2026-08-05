import { auth, db } from "@/constants/firebase";
import { useAuth } from "@/hooks/AuthContext";
import { changeProfileImage, uploadProfileImageFromFile } from "@/services/userService";
import { uploadDocumentToCloudinary } from "@/services/cloudinaryUpload";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { onAuthStateChanged, sendEmailVerification } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    KeyboardAvoidingView,
    Linking,
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
  const [emailVerified, setEmailVerified] = useState(false);
  const [verificationSending, setVerificationSending] = useState(false);

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const [lsnDocPickResult, setLsnDocPickResult] = useState<DocumentPicker.DocumentPickerResult | null>(null);
  const [lsnDocUploading, setLsnDocUploading] = useState(false);
  const [lsnDocUploadProgress, setLsnDocUploadProgress] = useState(0);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/auth/login");
        return;
      }

      setUid(user.uid);
      setEmailVerified(user.emailVerified || false);

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

  const handleVerifyEmail = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    if (verificationSending) return;
    try {
      setVerificationSending(true);
      await sendEmailVerification(currentUser);
      Alert.alert(
        "Verification Sent",
        "Please check your inbox for the verification link. You can continue using the app in the meantime.",
      );
    } catch (err: any) {
      console.error("Error sending verification email:", err);
      Alert.alert(
        "Error",
        err?.message || "Unable to send verification email. Please try again.",
      );
    } finally {
      setVerificationSending(false);
    }
  };

  const handleAvatarPress = async () => {
    if (uploadingImage || !uid) return;
    if (Platform.OS === "web") {
      fileInputRef.current?.click();
    } else {
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
    }
  };

  const uploadLsnDoc = async (
    asset: DocumentPicker.DocumentPickerAsset,
  ): Promise<{ secureUrl: string; publicId: string }> => {
    return uploadDocumentToCloudinary(asset.uri, asset.name, asset.mimeType || "application/pdf", undefined, setLsnDocUploadProgress);
  };

  const handlePickLsnDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "image/jpeg", "image/png"],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (asset.size && asset.size > 10 * 1024 * 1024) {
        Alert.alert("File Too Large", "Max file size is 10 MB.");
        return;
      }
      setLsnDocPickResult(result);
    } catch {
      Alert.alert("Error", "Could not pick the document.");
    }
  };

  const handleUploadLsnDocument = async () => {
    if (!uid || !lsnDocPickResult?.assets?.[0]) return;
    setLsnDocUploading(true);
    setLsnDocUploadProgress(0);
    try {
      const asset = lsnDocPickResult.assets[0];
      const { secureUrl, publicId } = await uploadLsnDoc(asset);
      const lsnData = {
        isLSN: true,
        lsnDocument: {
          fileName: asset.name,
          fileType: asset.mimeType,
          fileSize: asset.size,
          uploadedAt: new Date().toISOString(),
          publicId,
          secureUrl,
        },
      };
      await setDoc(doc(db, "users", uid), lsnData, { merge: true });
      setProfile((p) => ({ ...(p || {}), ...lsnData }));
      setLsnDocPickResult(null);
      Alert.alert("Success", "LSN document uploaded successfully.");
    } catch (err: any) {
      Alert.alert("Upload Failed", err.message || "Please try again.");
    } finally {
      setLsnDocUploading(false);
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
            {Platform.OS === "web" && (
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file || !uid) return;
                  setUploadingImage(true);
                  try {
                    const collectionName = role === "admin" ? "admins" : "users";
                    const newUrl = await uploadProfileImageFromFile(file, uid, collectionName);
                    if (newUrl) {
                      setProfile((p) => ({ ...(p || {}), profileImage: newUrl }));
                    }
                  } finally {
                    setUploadingImage(false);
                  }
                  e.target.value = "";
                }}
              />
            )}
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
            <Pressable style={s.quickActionBtn} onPress={() => Linking.openURL("mailto:support@mindcare.app")}>
              <Ionicons name="mail" size={20} color="#7B2CBF" />
            </Pressable>
            <Pressable style={s.quickActionBtn} onPress={() => Linking.openURL("tel:911")}>
              <Ionicons name="call" size={20} color="#7B2CBF" />
            </Pressable>
            <Pressable style={s.quickActionBtn} onPress={() => router.push("/(student)/(tabs)/messages")}>
              <Ionicons name="chatbubble" size={20} color="#7B2CBF" />
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

            {/* Email Verification Status */}
            {emailVerified ? (
              <View style={s.verifiedContainer}>
                <Ionicons name="checkmark-circle" size={18} color="#16A34A" />
                <Text style={s.verifiedText}>Email Verified</Text>
              </View>
            ) : (
              <View style={s.unverifiedContainer}>
                <View style={s.unverifiedRow}>
                  <Ionicons name="alert-circle" size={18} color="#B06000" />
                  <Text style={s.warningText}>
                    Your email is not verified yet.
                  </Text>
                </View>
                <Pressable
                  style={[
                    s.verifyButton,
                    verificationSending && { opacity: 0.6 },
                  ]}
                  onPress={handleVerifyEmail}
                  disabled={verificationSending}
                >
                  {verificationSending ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <Text style={s.verifyButtonText}>
                      Verify Email Now
                    </Text>
                  )}
                </Pressable>
              </View>
            )}
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

          {/* ── Security Activity ── */}
          <View style={s.sectionCard}>
            <View style={s.sectionHeader}>
              <View style={[s.sectionIcon, { backgroundColor: "#EDE9FE" }]}>
                <Ionicons name="shield-checkmark-outline" size={18} color="#7B2CBF" />
              </View>
              <Text style={s.sectionTitle}>Security Activity</Text>
            </View>
            <Pressable onPress={() => router.push("/security-log")}>
              <View style={s.fieldRow}>
                <Ionicons name="time-outline" size={16} color="#94A3B8" />
                <Text style={s.fieldValue}>
                  Review sign-ins and account security events
                </Text>
                <Ionicons name="chevron-forward" size={16} color="#CBD5E1" style={{ marginLeft: "auto" }} />
              </View>
            </Pressable>
          </View>

          {/* ── LSN Document Section (students only) ── */}
          {!isAdmin && (
            <View style={s.sectionCard}>
              <View style={s.sectionHeader}>
                <View style={[s.sectionIcon, { backgroundColor: "#FCE7F3" }]}>
                  <Ionicons name="document-text-outline" size={18} color="#DB2777" />
                </View>
                <Text style={s.sectionTitle}>LSN Document</Text>
              </View>

              {profile?.lsnDocument ? (
                <>
                  <View style={s.fieldRow}>
                    <Ionicons name="checkmark-circle" size={18} color="#16A34A" />
                    <Text style={s.fieldValue} numberOfLines={1}>
                      {profile.lsnDocument.fileName || "Document uploaded"}
                    </Text>
                  </View>
                  <Pressable
                    style={s.lsnReplaceBtn}
                    onPress={handlePickLsnDocument}
                  >
                    <Ionicons name="refresh" size={16} color="#7B2CBF" />
                    <Text style={s.lsnReplaceText}>Replace Document</Text>
                  </Pressable>
                </>
              ) : profile?.isLSN || lsnDocPickResult ? (
                <>
                  {lsnDocPickResult && !lsnDocPickResult.canceled ? (
                    <View style={s.fieldRow}>
                      <Ionicons name="document-outline" size={18} color="#7B2CBF" />
                      <Text style={s.fieldValue} numberOfLines={1}>
                        {(lsnDocPickResult.assets[0] as any).name}
                      </Text>
                    </View>
                  ) : (
                    <Text style={s.lsnHintText}>
                      Your LSN document was not uploaded during registration. Please upload it here.
                    </Text>
                  )}

                  {lsnDocUploading ? (
                    <View style={s.lsnProgressRow}>
                      <View style={s.lsnProgressBar}>
                        <View style={[s.lsnProgressFill, { width: `${lsnDocUploadProgress}%` }]} />
                      </View>
                      <Text style={s.lsnProgressText}>{lsnDocUploadProgress}%</Text>
                    </View>
                  ) : (
                    <View style={s.lsnActions}>
                      <Pressable style={s.lsnPickBtn} onPress={handlePickLsnDocument}>
                        <Ionicons name="cloud-upload-outline" size={18} color="#7B2CBF" />
                        <Text style={s.lsnPickText}>
                          {lsnDocPickResult ? "Choose Different File" : "Pick Document"}
                        </Text>
                      </Pressable>
                      {lsnDocPickResult && !lsnDocPickResult.canceled && (
                        <Pressable style={s.lsnUploadBtn} onPress={handleUploadLsnDocument}>
                          <Text style={s.lsnUploadText}>Upload</Text>
                        </Pressable>
                      )}
                    </View>
                  )}
                </>
              ) : (
                <Text style={s.lsnHintText}>
                  No LSN document on file. If you have special needs, contact your guidance office.
                </Text>
              )}
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
  verifiedContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#E6F4EA",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 10,
  },
  verifiedText: {
    color: "#137333",
    fontSize: 14,
    fontWeight: "600",
  },
  unverifiedContainer: {
    backgroundColor: "#FEF7E0",
    borderRadius: 10,
    padding: 12,
    marginTop: 10,
    gap: 10,
  },
  unverifiedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  warningText: {
    color: "#B06000",
    fontSize: 13,
    fontWeight: "600",
    flex: 1,
  },
  verifyButton: {
    backgroundColor: "#8A63D2",
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  verifyButtonText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "700",
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

  /* ── LSN Document ──────────────────────────────────────────────── */
  lsnHintText: {
    fontSize: 13,
    color: "#64748B",
    lineHeight: 19,
    marginTop: 4,
  },
  lsnReplaceBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: "#F5F0FF",
    borderRadius: 10,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "#E9D5FF",
  },
  lsnReplaceText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#7B2CBF",
  },
  lsnProgressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 12,
  },
  lsnProgressBar: {
    flex: 1,
    height: 8,
    backgroundColor: "#F1F5F9",
    borderRadius: 4,
    overflow: "hidden",
  },
  lsnProgressFill: {
    height: "100%",
    backgroundColor: "#8A63D2",
    borderRadius: 4,
  },
  lsnProgressText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#8A63D2",
    width: 36,
    textAlign: "right",
  },
  lsnActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  lsnPickBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: "#F5F0FF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E9D5FF",
    borderStyle: "dashed",
  },
  lsnPickText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#7B2CBF",
  },
  lsnUploadBtn: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    backgroundColor: "#8A63D2",
    borderRadius: 12,
    justifyContent: "center",
  },
  lsnUploadText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },

});
