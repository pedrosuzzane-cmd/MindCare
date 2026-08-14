/**
 * Admin Accounts panel — lists administrator accounts and permissions.
 *
 * Embedded inside the Admin Management screen alongside password-reset
 * requests. All operations go through the super-admin REST endpoints.
 */

import { API_URL } from "@/backend/config";
import { auth } from "@/constants/firebase";
import { useAuth } from "@/hooks/AuthContext";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";

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

function timeAgo(ms?: number | null): string {
  if (!ms) return "—";
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hr${h === 1 ? "" : "s"} ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} day${d === 1 ? "" : "s"} ago`;
  return new Date(ms).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  const out = parts.map((p) => p[0]?.toUpperCase() || "").join("");
  return out || "A";
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

function StatTile({
  label,
  value,
  color,
  bg,
  icon,
  highlighted,
}: {
  label: string;
  value: number;
  color: string;
  bg: string;
  icon: keyof typeof Ionicons.glyphMap;
  highlighted?: boolean;
}) {
  return (
    <View
      style={[
        styles.statTile,
        highlighted && {
          backgroundColor: "rgba(255,255,255,0.18)",
          borderColor: "rgba(255,255,255,0.45)",
        },
      ]}
    >
      <View style={[styles.statIcon, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={14} color={color} />
      </View>
      <Text style={[styles.statValue, highlighted && { color: "white" }]}>{value}</Text>
      <Text style={[styles.statLabel, highlighted && { color: "rgba(255,255,255,0.85)" }]}>
        {label}
      </Text>
    </View>
  );
}

export function AdminAccountsPanel() {
  const { user } = useAuth();
  const [admins, setAdmins] = useState<AdminEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actingUid, setActingUid] = useState<string | null>(null);
  const [query, setQuery] = useState("");

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

  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    email: "",
    password: "",
    confirmPassword: "",
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

  const openCreate = () => {
    setCreateForm({
      email: "",
      password: "",
      confirmPassword: "",
      displayName: "",
      position: "",
      contactNo: "",
      college: "",
      schoolId: "",
      isSuperAdmin: false,
    });
    setCreating(true);
    setError(null);
  };

  const closeCreate = () => {
    setCreating(false);
    setSaving(false);
  };

  const handleCreate = async () => {
    const email = createForm.email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      Alert.alert("Invalid Email", "Please enter a valid email address.");
      return;
    }
    if (!createForm.displayName.trim()) {
      Alert.alert("Missing Name", "Please enter the administrator's full name.");
      return;
    }
    if (createForm.password.length < 12) {
      Alert.alert(
        "Weak Password",
        "Password must be at least 12 characters long.",
      );
      return;
    }
    if (createForm.password !== createForm.confirmPassword) {
      Alert.alert("Password Mismatch", "The passwords do not match.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        setError("You must be signed in as a Super Admin.");
        setSaving(false);
        return;
      }
      const response = await fetch(`${API_URL}/api/superadmin/create-admin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          email,
          password: createForm.password,
          displayName: createForm.displayName.trim(),
          position: createForm.position.trim() || null,
          contactNo: createForm.contactNo.trim() || null,
          college: createForm.college.trim() || null,
          schoolId: createForm.schoolId.trim() || null,
          isSuperAdmin: createForm.isSuperAdmin,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        Alert.alert(
          "Could Not Create Admin",
          data.error || "Failed to create the administrator.",
        );
        setSaving(false);
        return;
      }
      Alert.alert(
        "Administrator Created",
        `${createForm.displayName.trim()} can now sign in with these credentials.`,
      );
      closeCreate();
      await loadAdmins();
    } catch {
      Alert.alert("Network Error", "Please try again.");
      setSaving(false);
    }
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

  const superCount = admins.filter((a) => a.isSuperAdmin).length;
  const standardCount = admins.length - superCount;

  const q = query.trim().toLowerCase();
  const visible = admins.filter(
    (a) =>
      !q ||
      (a.displayName || "").toLowerCase().includes(q) ||
      (a.email || "").toLowerCase().includes(q) ||
      (a.position || "").toLowerCase().includes(q),
  );

  return (
    <View style={styles.root}>
      <LinearGradient colors={["#7C3AED", "#9B6BF2"]} style={styles.headerBand}>
        <View style={styles.header}>
          <View style={styles.titleWrap}>
            <Text style={styles.headerTitle}>Admin Accounts</Text>
            <Text style={styles.headerSubtitle}>
              Manage admin accounts and permissions
            </Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable
              style={styles.iconButton}
              onPress={openCreate}
              accessibilityRole="button"
              accessibilityLabel="Create administrator"
            >
              <Ionicons name="person-add" size={20} color="#FFFFFF" />
            </Pressable>
            <Pressable
              style={styles.iconButton}
              onPress={handleRefresh}
              accessibilityRole="button"
              accessibilityLabel="Refresh administrators"
            >
              <Ionicons name="refresh" size={20} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>

        <View style={styles.statsRow}>
          <StatTile
            label="Total"
            value={admins.length}
            color="#B45309"
            bg="#FDE68A"
            icon="people-outline"
            highlighted
          />
          <StatTile
            label="Super Admins"
            value={superCount}
            color="#6D28D9"
            bg="#DDD6FE"
            icon="shield-checkmark-outline"
          />
          <StatTile
            label="Admins"
            value={standardCount}
            color="#047857"
            bg="#A7F3D0"
            icon="shield-outline"
          />
        </View>
      </LinearGradient>

      {error ? (
        <Text style={styles.errorText} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {admins.length > 0 && (
          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={18} color="#9CA3AF" />
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder="Search by name, email, or position"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="none"
            />
            {query.length > 0 && (
              <Pressable onPress={() => setQuery("")} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color="#9CA3AF" />
              </Pressable>
            )}
          </View>
        )}

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#7C3AED" />
          </View>
        ) : admins.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ionicons name="people-circle-outline" size={40} color="#7C3AED" />
            </View>
            <Text style={styles.emptyTitle}>No administrators yet</Text>
            <Text style={styles.emptyText}>
              Administrators created from the Admin Panel will appear here.
            </Text>
          </View>
        ) : visible.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ionicons name="search-outline" size={40} color="#7C3AED" />
            </View>
            <Text style={styles.emptyTitle}>No results</Text>
            <Text style={styles.emptyText}>
              Nothing matches &quot;{query}&quot;. Try a different search.
            </Text>
          </View>
        ) : (
          visible.map((admin) => {
            const isSelf = admin.uid === user?.uid;
            return (
              <View key={admin.uid} style={styles.card}>
                <View style={styles.cardTop}>
                  <View
                    style={[
                      styles.avatar,
                      { backgroundColor: admin.isSuperAdmin ? "#EDE9FE" : "#D1FAE5" },
                    ]}
                  >
                    <Text
                      style={[
                        styles.avatarText,
                        { color: admin.isSuperAdmin ? "#6D28D9" : "#047857" },
                      ]}
                    >
                      {initials(admin.displayName || "A")}
                    </Text>
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
                      <View style={styles.metaRow}>
                        <Ionicons name="briefcase-outline" size={12} color="#9CA3AF" />
                        <Text style={styles.cardMeta}>{admin.position}</Text>
                      </View>
                    ) : null}
                    <View style={styles.metaRow}>
                      <Ionicons name="calendar-outline" size={12} color="#9CA3AF" />
                      <Text style={styles.cardMeta}>
                        Joined {timeAgo(admin.createdAtMs)}
                      </Text>
                    </View>
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
                        <Ionicons name="shield-outline" size={16} color="#B45309" />
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
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderIcon}>
                <Ionicons name="create-outline" size={20} color="#7C3AED" />
              </View>
              <View style={styles.modalHeaderText}>
                <Text style={styles.modalTitle}>
                  Edit {editing?.displayName || "Administrator"}
                </Text>
                <Text style={styles.modalSubtitle}>{editing?.email || ""}</Text>
              </View>
            </View>

            <ScrollView
              contentContainerStyle={styles.modalBody}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
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
            </ScrollView>

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

      <Modal
        visible={creating}
        transparent
        animationType="fade"
        onRequestClose={closeCreate}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderIcon}>
                <Ionicons name="person-add" size={20} color="#7C3AED" />
              </View>
              <View style={styles.modalHeaderText}>
                <Text style={styles.modalTitle}>Create Administrator</Text>
                <Text style={styles.modalSubtitle}>
                  New admins sign in with the credentials you set below.
                </Text>
              </View>
            </View>

            <ScrollView
              contentContainerStyle={styles.modalBody}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.label}>Email address</Text>
              <TextInput
                style={styles.input}
                value={createForm.email}
                onChangeText={(v) => setCreateForm({ ...createForm, email: v })}
                placeholder="name@example.com"
                placeholderTextColor="#9CA3AF"
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
              />
              <Text style={styles.label}>Full name</Text>
              <TextInput
                style={styles.input}
                value={createForm.displayName}
                onChangeText={(v) => setCreateForm({ ...createForm, displayName: v })}
                placeholder="Full name"
                placeholderTextColor="#9CA3AF"
              />
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                value={createForm.password}
                onChangeText={(v) => setCreateForm({ ...createForm, password: v })}
                placeholder="At least 12 characters"
                placeholderTextColor="#9CA3AF"
                secureTextEntry
                autoCapitalize="none"
              />
              <Text style={styles.label}>Confirm password</Text>
              <TextInput
                style={styles.input}
                value={createForm.confirmPassword}
                onChangeText={(v) =>
                  setCreateForm({ ...createForm, confirmPassword: v })
                }
                placeholder="Re-enter password"
                placeholderTextColor="#9CA3AF"
                secureTextEntry
                autoCapitalize="none"
              />
              <Text style={styles.label}>Position</Text>
              <TextInput
                style={styles.input}
                value={createForm.position}
                onChangeText={(v) => setCreateForm({ ...createForm, position: v })}
                placeholder="Position"
                placeholderTextColor="#9CA3AF"
              />
              <Text style={styles.label}>Contact number</Text>
              <TextInput
                style={styles.input}
                value={createForm.contactNo}
                onChangeText={(v) => setCreateForm({ ...createForm, contactNo: v })}
                placeholder="Contact number"
                placeholderTextColor="#9CA3AF"
                keyboardType="phone-pad"
              />
              <Text style={styles.label}>College</Text>
              <TextInput
                style={styles.input}
                value={createForm.college}
                onChangeText={(v) => setCreateForm({ ...createForm, college: v })}
                placeholder="College"
                placeholderTextColor="#9CA3AF"
              />
              <Text style={styles.label}>School ID</Text>
              <TextInput
                style={styles.input}
                value={createForm.schoolId}
                onChangeText={(v) => setCreateForm({ ...createForm, schoolId: v })}
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
                  value={createForm.isSuperAdmin}
                  onValueChange={(v) =>
                    setCreateForm({ ...createForm, isSuperAdmin: v })
                  }
                  trackColor={{ false: "#D1D5DB", true: "#A78BFA" }}
                  thumbColor={createForm.isSuperAdmin ? "#7C3AED" : "#F4F4F5"}
                />
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalCancel}
                onPress={closeCreate}
                disabled={saving}
                accessibilityRole="button"
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalSave, saving && styles.buttonDisabled]}
                onPress={handleCreate}
                disabled={saving}
                accessibilityRole="button"
              >
                {saving ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={styles.modalSaveText}>Create Admin</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#F8F7FB",
  },
  headerBand: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  titleWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  headerSubtitle: {
    fontSize: 12,
    color: "rgba(255,255,255,0.85)",
    marginTop: 2,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.22)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerActions: {
    flexDirection: "row",
    gap: 8,
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  statTile: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: "center",
  },
  statIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  statLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "rgba(255,255,255,0.8)",
    marginTop: 1,
  },
  errorText: {
    color: "#DC2626",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
    backgroundColor: "#FEE2E2",
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  content: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 48,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 46,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#F1F0F6",
    // @ts-ignore - web only
    boxShadow: "0px 2px 8px rgba(91,33,182,0.08)",
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#1F2937",
  },
  center: {
    paddingVertical: 80,
    alignItems: "center",
  },
  empty: {
    alignItems: "center",
    paddingVertical: 64,
    gap: 10,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#EDE9FE",
    justifyContent: "center",
    alignItems: "center",
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "800",
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
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#F1F0F6",
    // @ts-ignore - web only
    boxShadow: "0px 4px 14px rgba(91,33,182,0.08)",
    elevation: 3,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontSize: 15,
    fontWeight: "800",
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
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  cardMeta: {
    fontSize: 12,
    color: "#9CA3AF",
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
    backgroundColor: "rgba(30,20,50,0.55)",
    justifyContent: "center",
    padding: 20,
  },
  modal: {
    backgroundColor: "white",
    borderRadius: 22,
    padding: 20,
    maxHeight: "88%",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F0F6",
  },
  modalHeaderIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#EDE9FE",
    justifyContent: "center",
    alignItems: "center",
  },
  modalHeaderText: {
    flex: 1,
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
  },
  modalBody: {
    paddingTop: 4,
    paddingBottom: 4,
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
    marginTop: 16,
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
