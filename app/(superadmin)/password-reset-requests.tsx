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

const STATUS_META: Record<StatusKey, { label: string; color: string; bg: string }> = {
  pending: { label: "Pending", color: "#B45309", bg: "#FEF3C7" },
  approved: { label: "Approved", color: "#047857", bg: "#D1FAE5" },
  rejected: { label: "Rejected", color: "#B91C1C", bg: "#FEE2E2" },
  completed: { label: "Completed", color: "#1D4ED8", bg: "#DBEAFE" },
};

function formatDateTime(ms?: number): string {
  if (!ms) return "—";
  const d = new Date(ms);
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusBadge({ status }: { status: StatusKey }) {
  const meta = STATUS_META[status] || STATUS_META.pending;
  return (
    <View style={[styles.statusBadge, { backgroundColor: meta.bg }]}>
      <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
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

  const act = async (
    requestId: string,
    action: "approve" | "reject",
  ) => {
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
      `Reject the password reset request for ${request.email}?`,
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
  const history = requests.filter((r) => r.status !== "pending");

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
              <Text style={styles.headerTitle}>
                Admin Password Reset Requests
              </Text>
              <Text style={styles.headerSubtitle}>
                Approve or reject administrator reset requests
              </Text>
            </View>
          </View>
          <View style={styles.headerActions}>
            <Pressable
              style={styles.refreshButton}
              onPress={() => router.push("/(superadmin)/admin-management")}
              accessibilityRole="button"
              accessibilityLabel="Manage administrators"
            >
              <Ionicons name="people-outline" size={20} color="#7C3AED" />
            </Pressable>
            <Pressable
              style={styles.refreshButton}
              onPress={handleRefresh}
              accessibilityRole="button"
              accessibilityLabel="Refresh requests"
            >
              <Ionicons name="refresh" size={20} color="#7C3AED" />
            </Pressable>
          </View>
        </View>

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
                Tap Approve or Reject below to process the request.
              </Text>
            </View>
          </View>
        )}

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
          ) : (
            <>
              {!user && (
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
              )}

              {requests.length === 0 ? (
                <View style={styles.empty}>
                  <Ionicons name="checkmark-done-circle-outline" size={44} color="#8A63D2" />
                  <Text style={styles.emptyTitle}>No reset requests</Text>
                  <Text style={styles.emptyText}>
                    When an administrator requests a password reset, it will
                    appear here for your approval.
                  </Text>
                </View>
              ) : (
                <>
                  <Text style={styles.sectionTitle}>Pending ({pending.length})</Text>
                  {pending.length === 0 ? (
                    <Text style={styles.sectionEmpty}>No pending requests.</Text>
                  ) : (
                    pending.map((request) => (
                      <RequestCard
                        key={request.requestId}
                        request={request}
                        acting={actingId === request.requestId}
                        onApprove={() => act(request.requestId, "approve")}
                        onReject={() => handleReject(request)}
                      />
                    ))
                  )}

                  {history.length > 0 && (
                    <>
                      <Text style={styles.sectionTitle}>History</Text>
                      {history.map((request) => (
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
            </>
          )}
        </ScrollView>
      </LinearGradient>
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
        <View style={styles.avatar}>
          <Ionicons name="person-outline" size={20} color="#7C3AED" />
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardName}>{request.adminName || "Administrator"}</Text>
          <Text style={styles.cardEmail}>{request.email}</Text>
          <Text style={styles.cardMeta}>
            Requested {formatDateTime(request.requestedAtMs)}
          </Text>
        </View>
        <StatusBadge status={request.status} />
      </View>

      {request.status === "approved" && (
        <View style={styles.otpNote}>
          <Ionicons name="mail-outline" size={14} color="#047857" />
          <Text style={styles.otpNoteText}>
            OTP sent — expires{" "}
            {formatDateTime(request.otpExpiresAtMs ?? undefined)}
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
              <Text style={styles.approveButtonText}>Approve</Text>
            )}
          </Pressable>
          <Pressable
            style={[styles.rejectButton, acting && styles.buttonDisabled]}
            onPress={onReject}
            disabled={acting}
            accessibilityRole="button"
            accessibilityLabel={`Reject ${request.email}`}
          >
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
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  refreshButton: {
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
  errorText: {
    color: "#EF4444",
    fontSize: 14,
    fontWeight: "500",
    textAlign: "center",
    paddingHorizontal: 24,
    marginBottom: 8,
  },
  pendingBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#FDE68A",
    borderRadius: 14,
    marginHorizontal: 20,
    marginBottom: 12,
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
  scroll: {
    paddingHorizontal: 20,
    paddingBottom: 48,
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
  sectionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#374151",
    marginTop: 12,
    marginBottom: 10,
  },
  sectionEmpty: {
    fontSize: 13,
    color: "#9CA3AF",
    marginBottom: 16,
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
  cardMeta: {
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 6,
  },
  statusBadge: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
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
    backgroundColor: "#22C55E",
    borderRadius: 12,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  approveButtonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "700",
  },
  rejectButton: {
    flex: 1,
    backgroundColor: "#FEE2E2",
    borderRadius: 12,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
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
