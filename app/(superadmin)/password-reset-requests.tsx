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
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface ResetRequest {
  requestId: string;
  adminUid: string;
  email: string;
  adminName: string;
  status: "pending" | "approved" | "rejected" | "completed";
  requestedAtMs?: number;
  approvedAtMs?: number | null;
  rejectedAtMs?: number | null;
  completedAtMs?: number | null;
  otpSent?: boolean;
  otpExpiresAtMs?: number | null;
  completed?: boolean;
}

type StatusKey = ResetRequest["status"];

const STATUS_META: Record<
  StatusKey,
  { label: string; color: string; bg: string; dot: string; avatarBg: string; avatarFg: string }
> = {
  pending: {
    label: "Pending",
    color: "#B45309",
    bg: "#FEF3C7",
    dot: "#F59E0B",
    avatarBg: "#FEF3C7",
    avatarFg: "#B45309",
  },
  approved: {
    label: "Approved",
    color: "#047857",
    bg: "#D1FAE5",
    dot: "#10B981",
    avatarBg: "#D1FAE5",
    avatarFg: "#047857",
  },
  rejected: {
    label: "Rejected",
    color: "#B91C1C",
    bg: "#FEE2E2",
    dot: "#EF4444",
    avatarBg: "#FEE2E2",
    avatarFg: "#B91C1C",
  },
  completed: {
    label: "Completed",
    color: "#1D4ED8",
    bg: "#DBEAFE",
    dot: "#3B82F6",
    avatarBg: "#DBEAFE",
    avatarFg: "#1D4ED8",
  },
};

function timeAgo(ms?: number): string {
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

function expiresInLabel(ms?: number | null): string {
  if (!ms) return "";
  const mins = Math.max(0, Math.ceil((ms - Date.now()) / 60000));
  if (mins <= 0) return "expired";
  return `expires in ${mins} min${mins === 1 ? "" : "s"}`;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  const out = parts.map((p) => p[0]?.toUpperCase() || "").join("");
  return out || "A";
}

function StatusBadge({ status }: { status: StatusKey }) {
  const meta = STATUS_META[status] || STATUS_META.pending;
  return (
    <View style={[styles.statusBadge, { backgroundColor: meta.bg }]}>
      <View style={[styles.statusDot, { backgroundColor: meta.dot }]} />
      <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
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
        highlighted && { backgroundColor: "rgba(255,255,255,0.18)", borderColor: "rgba(255,255,255,0.45)" },
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

export default function PasswordResetRequestsScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [requests, setRequests] = useState<ResetRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const loadRequests = useCallback(async () => {
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        setError("You must be signed in as a Super Admin.");
        setLoading(false);
        return;
      }
      const response = await fetch(
        `${API_URL}/api/superadmin/password-reset-requests`,
        {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Unable to load requests.");
        return;
      }
      setRequests(data.requests || []);
      setError(null);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadRequests();
  };

  const act = async (requestId: string, action: "approve" | "reject") => {
    setActingId(requestId);
    setError(null);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        setError("You must be signed in as a Super Admin.");
        return;
      }
      const response = await fetch(
        `${API_URL}/api/superadmin/${action}-password-reset`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ requestId }),
        },
      );
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Action failed.");
        return;
      }
      await loadRequests();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setActingId(null);
    }
  };

  const handleReject = (request: ResetRequest) => {
    Alert.alert(
      "Reject Request",
      `Reject the password reset request for ${request.email}? They will be notified by email.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reject",
          style: "destructive",
          onPress: () => act(request.requestId, "reject"),
        },
      ],
    );
  };

  const pending = requests.filter((r) => r.status === "pending");
  const counts = {
    pending: pending.length,
    approved: requests.filter((r) => r.status === "approved").length,
    rejected: requests.filter((r) => r.status === "rejected").length,
    completed: requests.filter((r) => r.status === "completed").length,
  };

  const q = query.trim().toLowerCase();
  const visible = requests.filter(
    (r) =>
      !q ||
      r.email.toLowerCase().includes(q) ||
      (r.adminName || "").toLowerCase().includes(q),
  );
  const visiblePending = visible.filter((r) => r.status === "pending");
  const visibleHistory = visible.filter((r) => r.status !== "pending");

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
      <LinearGradient colors={["#7C3AED", "#9B6BF2"]} style={styles.headerBand}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Pressable
              style={styles.backButton}
              onPress={() => router.replace("/admin-panel")}
              accessibilityRole="button"
              accessibilityLabel="Back to admin panel"
              hitSlop={8}
            >
              <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
            </Pressable>
            <View style={styles.titleWrap}>
              <View style={styles.titleRow}>
                <Text style={styles.headerTitle}>Password Reset Requests</Text>
              </View>
              <Text style={styles.headerSubtitle}>
                Approve or reject administrator resets
              </Text>
            </View>
          </View>
          <View style={styles.headerActions}>
            <Pressable
              style={styles.iconButton}
              onPress={() => router.push("/(superadmin)/admin-management")}
              accessibilityRole="button"
              accessibilityLabel="Manage administrators"
            >
              <Ionicons name="people-outline" size={20} color="#FFFFFF" />
            </Pressable>
            <Pressable
              style={styles.iconButton}
              onPress={handleRefresh}
              accessibilityRole="button"
              accessibilityLabel="Refresh requests"
            >
              <Ionicons name="refresh" size={20} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>

        <View style={styles.statsRow}>
          <StatTile
            label="Pending"
            value={counts.pending}
            color="#B45309"
            bg="#FDE68A"
            icon="time-outline"
            highlighted
          />
          <StatTile
            label="Approved"
            value={counts.approved}
            color="#047857"
            bg="#A7F3D0"
            icon="checkmark-circle-outline"
          />
          <StatTile
            label="Rejected"
            value={counts.rejected}
            color="#B91C1C"
            bg="#FECACA"
            icon="close-circle-outline"
          />
          <StatTile
            label="Completed"
            value={counts.completed}
            color="#1D4ED8"
            bg="#BFDBFE"
            icon="flag-outline"
          />
        </View>
      </LinearGradient>

      {error ? (
        <Text style={styles.errorText} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}

      {!loading && pending.length > 0 && (
        <View style={styles.pendingBanner}>
          <View style={styles.pendingCountCircle}>
            <Text style={styles.pendingCountText}>{pending.length}</Text>
          </View>
          <View style={styles.pendingBannerText}>
            <Text style={styles.pendingBannerTitle}>
              {pending.length === 1
                ? "1 administrator is waiting for approval"
                : `${pending.length} administrators are waiting for approval`}
            </Text>
            <Text style={styles.pendingBannerSubtitle}>
              Approve or reject below to process the request.
            </Text>
          </View>
        </View>
      )}

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {requests.length > 0 && (
          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={18} color="#9CA3AF" />
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder="Search by name or email"
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
        ) : !user ? (
          <View style={styles.signInCard}>
            <Ionicons name="lock-closed-outline" size={20} color="#7C3AED" />
            <Text style={styles.signInText}>
              Please sign in to view password reset requests.
            </Text>
            <Pressable
              style={styles.signInButton}
              onPress={() => router.replace("/auth/login")}
            >
              <Text style={styles.signInButtonText}>Go to Login</Text>
            </Pressable>
          </View>
        ) : requests.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ionicons name="checkmark-done-circle-outline" size={40} color="#7C3AED" />
            </View>
            <Text style={styles.emptyTitle}>No reset requests yet</Text>
            <Text style={styles.emptyText}>
              When an administrator requests a password reset, it will appear
              here for your approval.
            </Text>
          </View>
        ) : visible.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ionicons name="search-outline" size={40} color="#7C3AED" />
            </View>
            <Text style={styles.emptyTitle}>No results</Text>
            <Text style={styles.emptyText}>
              Nothing matches "{query}". Try a different name or email.
            </Text>
          </View>
        ) : (
          <>
            <Text style={styles.sectionTitle}>
              Pending ({visiblePending.length})
            </Text>
            {visiblePending.length === 0 ? (
              <Text style={styles.sectionEmpty}>No pending requests.</Text>
            ) : (
              visiblePending.map((request) => (
                <RequestCard
                  key={request.requestId}
                  request={request}
                  acting={actingId === request.requestId}
                  onApprove={() => act(request.requestId, "approve")}
                  onReject={() => handleReject(request)}
                />
              ))
            )}

            {visibleHistory.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>History</Text>
                {visibleHistory.map((request) => (
                  <RequestCard
                    key={request.requestId}
                    request={request}
                    acting={false}
                    onApprove={() => {}}
                    onReject={() => {}}
                  />
                ))}
              </>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function RequestCard({
  request,
  acting,
  onApprove,
  onReject,
}: {
  request: ResetRequest;
  acting: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  const meta = STATUS_META[request.status];
  const isPending = request.status === "pending";

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={[styles.avatar, { backgroundColor: meta.avatarBg }]}>
          <Text style={[styles.avatarText, { color: meta.avatarFg }]}>
            {initials(request.adminName || "Administrator")}
          </Text>
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardName}>{request.adminName || "Administrator"}</Text>
          <Text style={styles.cardEmail}>{request.email}</Text>
          <View style={styles.cardMetaRow}>
            <Ionicons name="time-outline" size={12} color="#9CA3AF" />
            <Text style={styles.cardMeta}>
              Requested {timeAgo(request.requestedAtMs)}
            </Text>
          </View>
          <Text style={styles.cardId}>ID {request.requestId.slice(0, 8)}</Text>
        </View>
        <StatusBadge status={request.status} />
      </View>

      {request.status === "approved" && (
        <View style={styles.otpNote}>
          <Ionicons name="mail-outline" size={14} color="#047857" />
          <Text style={styles.otpNoteText}>
            Code sent to {request.email} — {expiresInLabel(request.otpExpiresAtMs)}
          </Text>
        </View>
      )}

      {isPending && (
        <View style={styles.cardActions}>
          <Pressable
            style={[styles.approveButton, acting && styles.buttonDisabled]}
            onPress={onApprove}
            disabled={acting}
            accessibilityRole="button"
            accessibilityLabel={`Approve ${request.email}`}
          >
            {acting ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <>
                <Ionicons name="checkmark" size={16} color="white" />
                <Text style={styles.approveButtonText}>Approve</Text>
              </>
            )}
          </Pressable>
          <Pressable
            style={[styles.rejectButton, acting && styles.buttonDisabled]}
            onPress={onReject}
            disabled={acting}
            accessibilityRole="button"
            accessibilityLabel={`Reject ${request.email}`}
          >
            <Ionicons name="close" size={16} color="#B91C1C" />
            <Text style={styles.rejectButtonText}>Reject</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#7C3AED",
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
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.22)",
    justifyContent: "center",
    alignItems: "center",
  },
  titleWrap: {
    flex: 1,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
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
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.22)",
    justifyContent: "center",
    alignItems: "center",
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
  pendingBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#FDE68A",
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  pendingCountCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F59E0B",
    justifyContent: "center",
    alignItems: "center",
  },
  pendingCountText: {
    color: "white",
    fontSize: 18,
    fontWeight: "800",
  },
  pendingBannerText: {
    flex: 1,
  },
  pendingBannerTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#92400E",
  },
  pendingBannerSubtitle: {
    fontSize: 12,
    color: "#B45309",
    marginTop: 2,
  },
  content: {
    flex: 1,
    backgroundColor: "#F8F7FB",
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
  signInCard: {
    backgroundColor: "#F3F0FF",
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  signInText: {
    fontSize: 13,
    color: "#5B21B6",
    fontWeight: "600",
    textAlign: "center",
  },
  signInButton: {
    backgroundColor: "#7C3AED",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  signInButtonText: {
    color: "white",
    fontSize: 13,
    fontWeight: "700",
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
  sectionTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#5B21B6",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginTop: 8,
    marginBottom: 12,
  },
  sectionEmpty: {
    fontSize: 13,
    color: "#9CA3AF",
    marginBottom: 16,
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
  cardName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1F2937",
  },
  cardEmail: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 2,
  },
  cardMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
  },
  cardMeta: {
    fontSize: 12,
    color: "#9CA3AF",
  },
  cardId: {
    fontSize: 10,
    color: "#D1D5DB",
    marginTop: 4,
    fontVariant: ["tabular-nums"],
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "700",
  },
  otpNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F0FDF4",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 12,
  },
  otpNoteText: {
    flex: 1,
    fontSize: 12,
    color: "#047857",
    fontWeight: "600",
  },
  cardActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  approveButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#22C55E",
    borderRadius: 12,
    height: 44,
  },
  approveButtonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "700",
  },
  rejectButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#FEE2E2",
    borderRadius: 12,
    height: 44,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  rejectButtonText: {
    color: "#B91C1C",
    fontSize: 14,
    fontWeight: "700",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
