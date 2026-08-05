import { API_URL } from "@/backend/config";
import { auth } from "@/constants/firebase";
import { useAuth } from "@/hooks/AuthContext";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface AdminEntry {
  uid: string;
  displayName?: string;
  email?: string;
  role?: string;
  position?: string;
  contactNo?: string;
  college?: string;
  schoolId?: string;
  genderIdentity?: string;
  nationality?: string;
  address?: string;
  isSuperAdmin?: boolean;
  hasAdminClaim?: boolean;
  createdAtMs?: number | null;
}

function formatDate(ms?: number | null): string {
  if (!ms) return "—";
  const d = new Date(ms);
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function RoleBadge({ isSuper }: { isSuper: boolean }) {
  return isSuper ? (
    <View style={[styles.badge, styles.badgeSuper]}>
      <Ionicons name="shield-checkmark" size={12} color="#7C3AED" />
      <Text style={[styles.badgeText, { color: "#6D28D9" }]}>Super Admin</Text>
    </View>
  ) : (
    <View style={[styles.badge, styles.badgeAdmin]}>
      <Ionicons name="shield-outline" size={12} color="#047857" />
      <Text style={[styles.badgeText, { color: "#047857" }]}>Admin</Text>
    </View>
  );
}

export default function AdminManagementScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [admins, setAdmins] = useState<AdminEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actingUid, setActingUid] = useState<string | null>(null);

  const [editing, setEditing] = useState<AdminEntry | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    displayName: "",
    position: "",
    contactNo: "",
    college: "",
    schoolId: "",
    isSuperAdmin: false,
  });

  const loadAdmins = useCallback(async () => {
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        setError("You must be signed in as a Super Admin.");
        setLoading(false);
        return;
      }
      const response = await fetch(`${API_URL}/api/superadmin/admins`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Unable to load administrators.");
        return;
      }
      setAdmins(data.admins || []);
      setError(null);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadAdmins();
  }, [loadAdmins]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadAdmins();
  };

  const openEdit = (admin: AdminEntry) => {
    setEditing(admin);
    setForm({
      displayName: admin.displayName || "",
      position: admin.position || "",
      contactNo: admin.contactNo || "",
      college: admin.college || "",
      schoolId: admin.schoolId || "",
      isSuperAdmin: !!admin.isSuperAdmin,
    });
  };

  const closeEdit = () => {
    setEditing(null);
    setSaving(false);
  };

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    setError(null);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        setError("You must be signed in as a Super Admin.");
        setSaving(false);
        return;
      }
      const response = await fetch(`${API_URL}/api/superadmin/update-admin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          uid: editing.uid,
          displayName: form.displayName.trim() || null,
          position: form.position.trim() || null,
          contactNo: form.contactNo.trim() || null,
          college: form.college.trim() || null,
          schoolId: form.schoolId.trim() || null,
          isSuperAdmin: form.isSuperAdmin,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Failed to update administrator.");
        setSaving(false);
        return;
      }
      closeEdit();
      await loadAdmins();
    } catch {
      setError("Network error. Please try again.");
      setSaving(false);
    }
  };

  const act = async (uid: string, action: "revoke-admin" | "delete-admin") => {
    setActingUid(uid);
    setError(null);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        setError("You must be signed in as a Super Admin.");
        return;
      }
      const response = await fetch(`${API_URL}/api/superadmin/${action}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ uid }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Action failed.");
        return;
      }
      await loadAdmins();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setActingUid(null);
    }
  };

  const confirmRevoke = (admin: AdminEntry) => {
    Alert.alert(
      "Revoke Admin Access",
      `Remove admin access for ${admin.displayName || admin.email}? They will no longer be able to access the admin dashboard.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Revoke",
          style: "destructive",
          onPress: () => act(admin.uid, "revoke-admin"),
        },
      ],
    );
  };

  const confirmDelete = (admin: AdminEntry) => {
    Alert.alert(
      "Delete Administrator",
      `Permanently delete the account for ${admin.displayName || admin.email}? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => act(admin.uid, "delete-admin"),
        },
      ],
    );
  };

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
      <LinearGradient
        colors={["#E8E0F5", "#F4F2F8", "#E8E0F5"]}
        style={styles.gradient}
      >
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Pressable
              style={styles.backButton}
              onPress={() => router.replace("/admin-panel")}
              accessibilityRole="button"
              accessibilityLabel="Back to admin panel"
              hitSlop={8}
            >
              <Ionicons name="arrow-back" size={22} color="#4B5563" />
            </Pressable>
            <View>
              <Text style={styles.headerTitle}>Administrators</Text>
              <Text style={styles.headerSubtitle}>
                Manage admin accounts and permissions
              </Text>
            </View>
          </View>
          <Pressable
            style={styles.refreshButton}
            onPress={handleRefresh}
            accessibilityRole="button"
            accessibilityLabel="Refresh administrators"
          >
            <Ionicons name="refresh" size={20} color="#7C3AED" />
          </Pressable>
        </View>

        {error ? (
          <Text style={styles.errorText} accessibilityRole="alert">
            {error}
          </Text>
        ) : null}

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        >
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color="#7C3AED" />
            </View>
          ) : admins.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons
                name="people-circle-outline"
                size={44}
                color="#8A63D2"
              />
              <Text style={styles.emptyTitle}>No administrators yet</Text>
              <Text style={styles.emptyText}>
                Administrators created from the Admin Panel will appear here.
              </Text>
            </View>
          ) : (
            admins.map((admin) => {
              const isSelf = admin.uid === user?.uid;
              return (
                <View key={admin.uid} style={styles.card}>
                  <View style={styles.cardTop}>
                    <View style={styles.avatar}>
                      <Ionicons name="person-outline" size={20} color="#7C3AED" />
                    </View>
                    <View style={styles.cardInfo}>
                      <View style={styles.nameRow}>
                        <Text style={styles.cardName}>
                          {admin.displayName || "Administrator"}
                        </Text>
                        {isSelf && <Text style={styles.youTag}>You</Text>}
                      </View>
                      <Text style={styles.cardEmail}>{admin.email || "—"}</Text>
                      {admin.position ? (
                        <Text style={styles.cardMeta}>{admin.position}</Text>
                      ) : null}
                      <Text style={styles.cardMeta}>
                        Joined {formatDate(admin.createdAtMs)}
                      </Text>
                    </View>
                    <RoleBadge isSuper={!!admin.isSuperAdmin} />
                  </View>

                  {!isSelf && (
                    <View style={styles.cardActions}>
                      <Pressable
                        style={[styles.actionButton, styles.editButton]}
                        onPress={() => openEdit(admin)}
                        accessibilityRole="button"
                        accessibilityLabel={`Edit ${admin.displayName || admin.email}`}
                      >
                        <Ionicons name="create-outline" size={16} color="#6D28D9" />
                        <Text style={styles.editButtonText}>Edit</Text>
                      </Pressable>
                      <Pressable
                        style={[styles.actionButton, styles.revokeButton]}
                        onPress={() => confirmRevoke(admin)}
                        disabled={actingUid === admin.uid}
                        accessibilityRole="button"
                        accessibilityLabel={`Revoke ${admin.displayName || admin.email}`}
                      >
                        {actingUid === admin.uid ? (
                          <ActivityIndicator size="small" color="#B45309" />
                        ) : (
                          <Ionicons
                            name="shield-outline"
                            size={16}
                            color="#B45309"
                          />
                        )}
                        <Text style={styles.revokeButtonText}>Revoke</Text>
                      </Pressable>
                      <Pressable
                        style={[styles.actionButton, styles.deleteButton]}
                        onPress={() => confirmDelete(admin)}
                        disabled={actingUid === admin.uid}
                        accessibilityRole="button"
                        accessibilityLabel={`Delete ${admin.displayName || admin.email}`}
                      >
                        {actingUid === admin.uid ? (
                          <ActivityIndicator size="small" color="#B91C1C" />
                        ) : (
                          <Ionicons name="trash-outline" size={16} color="#B91C1C" />
                        )}
                        <Text style={styles.deleteButtonText}>Delete</Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </ScrollView>

        <Modal
          visible={!!editing}
          transparent
          animationType="fade"
          onRequestClose={closeEdit}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modal}>
              <Text style={styles.modalTitle}>
                Edit {editing?.displayName || "Administrator"}
              </Text>
              <Text style={styles.modalSubtitle}>
                {editing?.email || ""}
              </Text>

              <Text style={styles.label}>Full name</Text>
              <TextInput
                style={styles.input}
                value={form.displayName}
                onChangeText={(v) => setForm({ ...form, displayName: v })}
                placeholder="Full name"
                placeholderTextColor="#9CA3AF"
              />
              <Text style={styles.label}>Position</Text>
              <TextInput
                style={styles.input}
                value={form.position}
                onChangeText={(v) => setForm({ ...form, position: v })}
                placeholder="Position"
                placeholderTextColor="#9CA3AF"
              />
              <Text style={styles.label}>Contact number</Text>
              <TextInput
                style={styles.input}
                value={form.contactNo}
                onChangeText={(v) => setForm({ ...form, contactNo: v })}
                placeholder="Contact number"
                placeholderTextColor="#9CA3AF"
                keyboardType="phone-pad"
              />
              <Text style={styles.label}>College</Text>
              <TextInput
                style={styles.input}
                value={form.college}
                onChangeText={(v) => setForm({ ...form, college: v })}
                placeholder="College"
                placeholderTextColor="#9CA3AF"
              />
              <Text style={styles.label}>School ID</Text>
              <TextInput
                style={styles.input}
                value={form.schoolId}
                onChangeText={(v) => setForm({ ...form, schoolId: v })}
                placeholder="School ID"
                placeholderTextColor="#9CA3AF"
                autoCapitalize="characters"
              />

              <View style={styles.switchRow}>
                <View style={styles.switchText}>
                  <Text style={styles.switchTitle}>Super Admin</Text>
                  <Text style={styles.switchHint}>
                    Can approve resets, grant/revoke admins, and manage security
                  </Text>
                </View>
                <Switch
                  value={form.isSuperAdmin}
                  onValueChange={(v) => setForm({ ...form, isSuperAdmin: v })}
                  trackColor={{ false: "#D1D5DB", true: "#A78BFA" }}
                  thumbColor={form.isSuperAdmin ? "#7C3AED" : "#F4F4F5"}
                />
              </View>

              <View style={styles.modalActions}>
                <Pressable
                  style={styles.modalCancel}
                  onPress={closeEdit}
                  disabled={saving}
                  accessibilityRole="button"
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[styles.modalSave, saving && styles.buttonDisabled]}
                  onPress={handleSave}
                  disabled={saving}
                  accessibilityRole="button"
                >
                  {saving ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <Text style={styles.modalSaveText}>Save</Text>
                  )}
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F4F2F8",
  },
  gradient: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "white",
    justifyContent: "center",
    alignItems: "center",
    // @ts-ignore - web only
    boxShadow: "0px 2px 4px rgba(0,0,0,0.08)",
    elevation: 3,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#5B21B6",
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  refreshButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "white",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
    // @ts-ignore - web only
    boxShadow: "0px 2px 4px rgba(0,0,0,0.08)",
    elevation: 3,
  },
  errorText: {
    color: "#EF4444",
    fontSize: 14,
    fontWeight: "500",
    textAlign: "center",
    paddingHorizontal: 24,
    marginBottom: 8,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingBottom: 48,
  },
  center: {
    paddingVertical: 80,
    alignItems: "center",
  },
  empty: {
    alignItems: "center",
    paddingVertical: 80,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#374151",
  },
  emptyText: {
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 19,
    maxWidth: 280,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#F1F0F6",
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F3F0FF",
    justifyContent: "center",
    alignItems: "center",
  },
  cardInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cardName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1F2937",
  },
  youTag: {
    fontSize: 11,
    fontWeight: "700",
    color: "#7C3AED",
    backgroundColor: "#EDE9FE",
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    overflow: "hidden",
  },
  cardEmail: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 2,
  },
  cardMeta: {
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 4,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeSuper: {
    backgroundColor: "#EDE9FE",
  },
  badgeAdmin: {
    backgroundColor: "#D1FAE5",
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  cardActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 40,
    borderRadius: 10,
  },
  editButton: {
    backgroundColor: "#EDE9FE",
    borderWidth: 1,
    borderColor: "#DDD6FE",
  },
  editButtonText: {
    color: "#6D28D9",
    fontSize: 13,
    fontWeight: "700",
  },
  revokeButton: {
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  revokeButtonText: {
    color: "#B45309",
    fontSize: 13,
    fontWeight: "700",
  },
  deleteButton: {
    backgroundColor: "#FEE2E2",
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  deleteButtonText: {
    color: "#B91C1C",
    fontSize: 13,
    fontWeight: "700",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(30,20,50,0.5)",
    justifyContent: "center",
    padding: 24,
  },
  modal: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 20,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#1F2937",
  },
  modalSubtitle: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 2,
    marginBottom: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: "#374151",
    marginTop: 12,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: "#1F2937",
    backgroundColor: "#F9FAFB",
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#F1F0F6",
  },
  switchText: {
    flex: 1,
    paddingRight: 12,
  },
  switchTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1F2937",
  },
  switchHint: {
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 2,
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 20,
  },
  modalCancel: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#374151",
  },
  modalSave: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#7C3AED",
  },
  modalSaveText: {
    fontSize: 14,
    fontWeight: "700",
    color: "white",
  },
});
