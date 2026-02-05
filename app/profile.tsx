import { auth, db } from "@/constants/firebase";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Pressable,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";

export default function ProfileScreen() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Record<string, any> | null>(null);
  const [uid, setUid] = useState<string | null>(null);

  // Edit state
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form fields
  const [fullName, setFullName] = useState("");
  const [schoolId, setSchoolId] = useState("");
  const [academicProgram, setAcademicProgram] = useState("");
  const [yearLevel, setYearLevel] = useState("");
  const [contactNo, setContactNo] = useState("");
  const [nationality, setNationality] = useState("");
  const [genderIdentity, setGenderIdentity] = useState("");
  const [provincialAddress, setProvincialAddress] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }

      setUid(user.uid);

      try {
        const ref = doc(db, "users", user.uid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data();
          setProfile(data);
          // populate form fields
          setFullName(data.fullName || "");
          setSchoolId(data.schoolId || "");
          setAcademicProgram(data.academicProgram || "");
          setYearLevel(data.yearLevel || "");
          setContactNo(data.contactNo || "");
          setNationality(data.nationality || "");
          setGenderIdentity(data.genderIdentity || "");
          setProvincialAddress(data.provincialAddress || "");
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
  }, []);

  const handleBack = () => router.back();

  const sanitize = (value: string, maxLen = 500) =>
    value.trim().slice(0, maxLen);

  const handleEditToggle = () => {
    setEditing((e) => !e);
    // reset fields if cancelling
    if (editing && profile) {
      setFullName(profile.fullName || "");
      setSchoolId(profile.schoolId || "");
      setAcademicProgram(profile.academicProgram || "");
      setYearLevel(profile.yearLevel || "");
      setContactNo(profile.contactNo || "");
      setNationality(profile.nationality || "");
      setGenderIdentity(profile.genderIdentity || "");
      setProvincialAddress(profile.provincialAddress || "");
    }
  };

  const handleSave = async () => {
    if (!uid) return Alert.alert("Error", "User not found.");
    if (!fullName.trim())
      return Alert.alert("Validation", "Full name is required.");

    setSaving(true);
    try {
      const data = {
        fullName: sanitize(fullName, 200),
        schoolId: sanitize(schoolId, 50),
        academicProgram: sanitize(academicProgram, 100),
        yearLevel: sanitize(yearLevel, 50),
        contactNo: sanitize(contactNo.replace(/[^0-9+\-() ]/g, ""), 30),
        nationality: sanitize(nationality, 50),
        genderIdentity: sanitize(genderIdentity, 50),
        provincialAddress: sanitize(provincialAddress, 500),
        updatedAt: new Date().toISOString(),
      } as Record<string, any>;

      await setDoc(doc(db, "users", uid), data, { merge: true });
      // update local state
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

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.label}>Full Name</Text>
          {editing ? (
            <TextInput
              style={styles.input}
              value={fullName}
              onChangeText={setFullName}
            />
          ) : (
            <Text style={styles.value}>{profile?.fullName || "-"}</Text>
          )}

          <Text style={styles.label}>Email</Text>
          <Text style={styles.value}>{profile?.email || "-"}</Text>

          <Text style={styles.label}>School ID</Text>
          {editing ? (
            <TextInput
              style={styles.input}
              value={schoolId}
              onChangeText={setSchoolId}
            />
          ) : (
            <Text style={styles.value}>{profile?.schoolId || "-"}</Text>
          )}

          <Text style={styles.label}>Academic Program</Text>
          {editing ? (
            <TextInput
              style={styles.input}
              value={academicProgram}
              onChangeText={setAcademicProgram}
            />
          ) : (
            <Text style={styles.value}>{profile?.academicProgram || "-"}</Text>
          )}

          <Text style={styles.label}>Year Level</Text>
          {editing ? (
            <TextInput
              style={styles.input}
              value={yearLevel}
              onChangeText={setYearLevel}
            />
          ) : (
            <Text style={styles.value}>{profile?.yearLevel || "-"}</Text>
          )}

          <Text style={styles.label}>Contact No</Text>
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

          <Text style={styles.label}>Nationality</Text>
          {editing ? (
            <TextInput
              style={styles.input}
              value={nationality}
              onChangeText={setNationality}
            />
          ) : (
            <Text style={styles.value}>{profile?.nationality || "-"}</Text>
          )}

          <Text style={styles.label}>Gender Identity</Text>
          {editing ? (
            <TextInput
              style={styles.input}
              value={genderIdentity}
              onChangeText={setGenderIdentity}
            />
          ) : (
            <Text style={styles.value}>{profile?.genderIdentity || "-"}</Text>
          )}

          <Text style={styles.label}>Provincial Address</Text>
          {editing ? (
            <TextInput
              style={[styles.input, { minHeight: 80 }]}
              value={provincialAddress}
              onChangeText={setProvincialAddress}
              multiline
            />
          ) : (
            <Text style={styles.value}>
              {profile?.provincialAddress || "-"}
            </Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F5F5" },
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
  headerTitle: { color: "white", fontSize: 18, fontWeight: "600" },
  headerButtons: { flexDirection: "row", gap: 8, alignItems: "center" },
  headerButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  content: { padding: 20 },
  card: { backgroundColor: "white", borderRadius: 12, padding: 16, gap: 12 },
  input: {
    backgroundColor: "#F8F8F8",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    fontSize: 16,
    color: "#333",
  },
  label: { fontSize: 12, color: "#777", marginTop: 12 },
  value: { fontSize: 16, color: "#333", marginTop: 4 },
});
