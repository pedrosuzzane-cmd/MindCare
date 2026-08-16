import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/hooks/AuthContext";
import { useMindCareTheme } from "@/contexts/ThemeContext";
import type { MindCareTheme } from "@/constants/theme";
import {
  fetchAuditLogs,
  fetchSafeguardingCases,
  filterCasesByStatus,
  listenForSafeguardingCases,
  STATUS_COLORS,
  STATUS_LABELS,
  type AuditLogEntry,
  type SafeguardingCase,
  type SafeguardingStatus,
  updateSafeguardingStatus,
  addCaseNote,
} from "@/services/safeguardingService";

const QUEUE_TABS: { key: SafeguardingStatus | "ALL"; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "PENDING_REVIEW", label: "Pending Review" },
  { key: "IN_PROGRESS", label: "In Progress" },
  { key: "RESOURCE_RECOMMENDED", label: "Resources" },
  { key: "REFERRED", label: "Referred" },
  { key: "MONITORING", label: "Monitoring" },
  { key: "RESOLVED", label: "Resolved" },
  { key: "CLOSED", label: "Closed" },
];

const NEXT_STATUS_ACTIONS: { from: SafeguardingStatus; to: SafeguardingStatus; label: string }[] = [
  { from: "PENDING_REVIEW", to: "IN_PROGRESS", label: "Start review" },
  { from: "PENDING_REVIEW", to: "RESOURCE_RECOMMENDED", label: "Recommend resources" },
  { from: "IN_PROGRESS", to: "RESOURCE_RECOMMENDED", label: "Recommend resources" },
  { from: "IN_PROGRESS", to: "REFERRED", label: "Refer" },
  { from: "RESOURCE_RECOMMENDED", to: "MONITORING", label: "Begin monitoring" },
  { from: "REFERRED", to: "MONITORING", label: "Begin monitoring" },
  { from: "MONITORING", to: "RESOLVED", label: "Mark resolved" },
  { from: "RESOLVED", to: "CLOSED", label: "Close case" },
];

function formatDateTime(date: Date): string {
  try {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

export default function SafeguardingScreen() {
  const { user } = useAuth();
  const [cases, setCases] = useState<SafeguardingCase[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<SafeguardingStatus | "ALL">("ALL");
  const [selectedCase, setSelectedCase] = useState<SafeguardingCase | null>(null);
  const [noteText, setNoteText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const listRef = useRef<FlatList<SafeguardingCase>>(null);

  const { theme } = useMindCareTheme();
  const styles = createStyles(theme);

  // Always start at the top so navigation never lands mid-list.
  useEffect(() => {
    const t = setTimeout(() => {
      listRef.current?.scrollToOffset({ offset: 0, animated: false });
    }, 60);
    return () => clearTimeout(t);
  }, []);

  const actor = useMemo(
    () => ({
      uid: user?.uid,
      name: user?.displayName ?? user?.email ?? "Admin",
    }),
    [user],
  );

  const loadAuditLogs = useCallback(async () => {
    try {
      const logs = await fetchAuditLogs(50);
      setAuditLogs(logs);
    } catch (err) {
      console.warn("Safeguarding audit log load failed:", err);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const unsub = listenForSafeguardingCases(
      (nextCases) => {
        if (cancelled) return;
        setCases(nextCases);
        setLoading(false);
      },
      (err) => {
        console.warn("Safeguarding case stream failed:", err);
        if (!cancelled) {
          setLoading(false);
        }
      },
    );
    loadAuditLogs();
    return () => {
      cancelled = true;
      unsub();
    };
  }, [loadAuditLogs]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const nextCases = await fetchSafeguardingCases();
      setCases(nextCases);
      await loadAuditLogs();
    } catch (err) {
      console.warn("Safeguarding refresh failed:", err);
    } finally {
      setRefreshing(false);
    }
  }, [loadAuditLogs]);

  const visibleCases = useMemo(
    () => filterCasesByStatus(cases, activeTab),
    [cases, activeTab],
  );

  const counts = useMemo(() => {
    const c = {
      all: cases.length,
      pendingReview: 0,
      inProgress: 0,
      monitoring: 0,
      resolved: 0,
    };
    cases.forEach((cs) => {
      if (cs.status === "PENDING_REVIEW") c.pendingReview += 1;
      else if (
        cs.status === "IN_PROGRESS" ||
        cs.status === "RESOURCE_RECOMMENDED" ||
        cs.status === "REFERRED"
      ) {
        c.inProgress += 1;
      } else if (cs.status === "MONITORING") c.monitoring += 1;
      else if (cs.status === "RESOLVED" || cs.status === "CLOSED") c.resolved += 1;
    });
    return c;
  }, [cases]);

  const runStatusTransition = useCallback(
    async (caseItem: SafeguardingCase, to: SafeguardingStatus, note?: string) => {
      setSubmitting(true);
      try {
        await updateSafeguardingStatus(caseItem.id, to, note, actor);
        await loadAuditLogs();
        Alert.alert(
          "Status updated",
          `Case ${caseItem.caseNumber} is now ${STATUS_LABELS[to]}.`,
        );
      } catch (err) {
        console.warn("Status update failed:", err);
        Alert.alert("Update failed", "Could not update the case. Please try again.");
      } finally {
        setSubmitting(false);
      }
    },
    [actor, loadAuditLogs],
  );

  const confirmTransition = (caseItem: SafeguardingCase, to: SafeguardingStatus, label: string) => {
    Alert.alert(
      `${label}?`,
      `This will move case ${caseItem.caseNumber} to "${STATUS_LABELS[to]}". The change is recorded in the audit log.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: label, onPress: () => runStatusTransition(caseItem, to) },
      ],
    );
  };

  const submitNote = useCallback(async () => {
    const text = noteText.trim();
    if (!selectedCase || !text) return;
    setSubmitting(true);
    try {
      await addCaseNote(selectedCase.id, text, actor);
      setNoteText("");
      await loadAuditLogs();
    } catch (err) {
      console.warn("Note add failed:", err);
      Alert.alert("Note failed", "Could not save the note. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }, [actor, loadAuditLogs, noteText, selectedCase]);

  const renderCaseCard = ({ item }: { item: SafeguardingCase }) => {
    const color = STATUS_COLORS[item.status];
    return (
      <Pressable
        style={({ pressed }) => [styles.caseCard, pressed && styles.caseCardPressed]}
        onPress={() => setSelectedCase(item)}
      >
        <View style={styles.caseCardHeader}>
          <View style={styles.caseIdentity}>
            <Text style={styles.caseNumber}>{item.caseNumber}</Text>
            <Text style={styles.caseName}>{item.studentName}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: `${color}18` }]}>
            <Text style={[styles.statusBadgeText, { color }]}>{STATUS_LABELS[item.status]}</Text>
          </View>
        </View>
        <Text style={styles.caseReason} numberOfLines={2}>
          {item.reason}
        </Text>
        <View style={styles.caseCardFooter}>
          <Text style={styles.caseMeta}>{item.department}</Text>
          <Text style={styles.caseMeta}>Updated {formatDateTime(item.updatedAt)}</Text>
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={theme.headerGradient}>
        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color="white" />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Safeguarding & Follow-Up</Text>
            <Text style={styles.headerSubtitle}>Guidance office case queue</Text>
          </View>
          <Pressable style={styles.refreshBtn} onPress={refresh}>
            <Ionicons name="refresh" size={20} color="white" />
          </Pressable>
        </View>
      </LinearGradient>

      <View style={styles.restrictedBanner}>
        <Ionicons name="lock-closed-outline" size={16} color={theme.primary} />
        <Text style={styles.restrictedBannerText}>
          Authorized guidance office staff only. Every change is recorded in the audit log.
        </Text>
      </View>

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={styles.stateText}>Loading safeguarding queue...</Text>
        </View>
      ) : (
        <>
          <View style={styles.summaryRow}>
            <View style={[styles.summaryChip, styles.summaryPending]}>
              <Text style={styles.summaryPendingText}>{counts.pendingReview} Pending</Text>
            </View>
            <View style={[styles.summaryChip, styles.summaryProgress]}>
              <Text style={styles.summaryProgressText}>{counts.inProgress} In progress</Text>
            </View>
            <View style={[styles.summaryChip, styles.summaryMonitoring]}>
              <Text style={styles.summaryMonitoringText}>{counts.monitoring} Monitoring</Text>
            </View>
            <View style={[styles.summaryChip, styles.summaryResolved]}>
              <Text style={styles.summaryResolvedText}>{counts.resolved} Resolved</Text>
            </View>
          </View>

          <View style={styles.tabRow}>
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={QUEUE_TABS}
              keyExtractor={(item) => item.key}
              contentContainerStyle={styles.tabList}
              renderItem={({ item }) => {
                const active = activeTab === item.key;
                return (
                  <Pressable
                    style={[styles.tabChip, active && styles.tabChipActive]}
                    onPress={() => setActiveTab(item.key)}
                  >
                    <Text style={[styles.tabChipText, active && styles.tabChipTextActive]}>
                      {item.label}
                    </Text>
                  </Pressable>
                );
              }}
            />
          </View>

          <FlatList
            ref={listRef}
            data={visibleCases}
            keyExtractor={(item) => item.id}
            renderItem={renderCaseCard}
            showsVerticalScrollIndicator={true}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.primary} />
            }
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <View style={styles.centerState}>
                <Ionicons name="shield-checkmark-outline" size={48} color={theme.status.success} />
                <Text style={styles.stateTitle}>No cases in this queue</Text>
                <Text style={styles.stateText}>
                  Cases appear here when the guidance office opens a follow-up on
                  an elevated concern indicator.
                </Text>
              </View>
            }
          />

          {auditLogs.length > 0 && (
            <View style={styles.auditSection}>
              <View style={styles.auditHeader}>
                <Ionicons name="document-text-outline" size={16} color={theme.primary} />
                <Text style={styles.auditTitle}>Recent Audit Log</Text>
              </View>
              {auditLogs.slice(0, 5).map((log) => (
                <View key={log.id} style={styles.auditRow}>
                  <View style={styles.auditDot} />
                  <View style={styles.auditRowBody}>
                    <Text style={styles.auditAction}>
                      {log.action} {log.caseNumber ? `· ${log.caseNumber}` : ""}
                    </Text>
                    {log.note ? (
                      <Text style={styles.auditNote} numberOfLines={1}>
                        {log.note}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={styles.auditMeta}>
                    {log.actorName ?? "Admin"} · {log.createdAt ? formatDateTime(log.createdAt) : "—"}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </>
      )}

      {/* Case detail modal */}
      <Modal
        visible={!!selectedCase}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedCase(null)}
      >
        {selectedCase && (
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalCaseNumber}>{selectedCase.caseNumber}</Text>
                  <Text style={styles.modalCaseName}>{selectedCase.studentName}</Text>
                </View>
                <Pressable onPress={() => setSelectedCase(null)} style={styles.modalClose}>
                  <Ionicons name="close" size={20} color={theme.secondaryText} />
                </Pressable>
              </View>

              <View style={styles.modalStatusRow}>
                <View style={[styles.statusBadge, { backgroundColor: `${STATUS_COLORS[selectedCase.status]}18` }]}>
                  <Text style={[styles.statusBadgeText, { color: STATUS_COLORS[selectedCase.status] }]}>
                    {STATUS_LABELS[selectedCase.status]}
                  </Text>
                </View>
                <Text style={styles.modalMeta}>{selectedCase.department}</Text>
                <Text style={styles.modalMeta}>Created {formatDateTime(selectedCase.createdAt)}</Text>
              </View>

              <Text style={styles.modalLabel}>Reason for follow-up</Text>
              <Text style={styles.modalReason}>{selectedCase.reason}</Text>

              <Text style={styles.modalLabel}>Follow-up history</Text>
              <View style={styles.historyList}>
                {selectedCase.history.length === 0 ? (
                  <Text style={styles.historyEmpty}>No history recorded yet.</Text>
                ) : (
                  [...selectedCase.history].reverse().map((h, i) => (
                    <View key={i} style={styles.historyRow}>
                      <Text style={styles.historyAction}>{h.action}</Text>
                      <Text style={styles.historyMeta}>
                        {h.actorName ?? "Admin"} · {formatDateTime(h.timestamp)}
                      </Text>
                      {h.note ? <Text style={styles.historyNote}>{h.note}</Text> : null}
                    </View>
                  ))
                )}
              </View>

              <Text style={styles.modalLabel}>Add a note</Text>
              <TextInput
                style={styles.noteInput}
                value={noteText}
                onChangeText={setNoteText}
                placeholder="Note for the follow-up record (no clinical language needed)"
                multiline
                placeholderTextColor={theme.secondaryText}
              />
              <Pressable
                style={[styles.primaryButton, submitting && styles.buttonDisabled]}
                disabled={submitting || noteText.trim().length === 0}
                onPress={submitNote}
              >
                <Text style={styles.primaryButtonText}>Save note</Text>
              </Pressable>

              <Text style={styles.modalLabel}>Update status</Text>
              <View style={styles.actionRow}>
                {NEXT_STATUS_ACTIONS.filter((a) => a.from === selectedCase.status).map((action) => (
                  <Pressable
                    key={action.to}
                    style={[styles.actionButton, submitting && styles.buttonDisabled]}
                    disabled={submitting}
                    onPress={() => confirmTransition(selectedCase, action.to, action.label)}
                  >
                    <Text style={styles.actionButtonText}>{action.label}</Text>
                  </Pressable>
                ))}
                {NEXT_STATUS_ACTIONS.filter((a) => a.from === selectedCase.status).length === 0 && (
                  <Text style={styles.noActionsText}>
                    This case has reached a terminal status. Review the history or add a note.
                  </Text>
                )}
              </View>
            </View>
          </View>
        )}
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (theme: MindCareTheme) =>
  StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
  },
  backBtn: { width: 40, height: 40, justifyContent: "center", alignItems: "center" },
  refreshBtn: { width: 40, height: 40, justifyContent: "center", alignItems: "center" },
  headerCenter: { flex: 1, alignItems: "center" },
  headerTitle: { color: "white", fontSize: 18, fontWeight: "700", textAlign: "center" },
  headerSubtitle: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    fontWeight: "500",
    marginTop: 2,
  },
  restrictedBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: theme.softPurple,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  restrictedBannerText: { flex: 1, fontSize: 12, color: theme.primary, lineHeight: 17 },
  centerState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 40,
    paddingVertical: 40,
  },
  stateTitle: { fontSize: 17, fontWeight: "700", color: theme.text, marginTop: 4 },
  stateText: { fontSize: 14, color: theme.secondaryText, textAlign: "center" },
  summaryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  summaryChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  summaryPending: { backgroundColor: "#FEF3C7" },
  summaryPendingText: { fontSize: 12, fontWeight: "700", color: "#B45309" },
  summaryProgress: { backgroundColor: "#DBEAFE" },
  summaryProgressText: { fontSize: 12, fontWeight: "700", color: "#1D4ED8" },
  summaryMonitoring: { backgroundColor: "#CFFAFE" },
  summaryMonitoringText: { fontSize: 12, fontWeight: "700", color: "#0E7490" },
  summaryResolved: { backgroundColor: "#DCFCE7" },
  summaryResolvedText: { fontSize: 12, fontWeight: "700", color: "#15803D" },
  tabRow: { paddingBottom: 8 },
  tabList: { paddingHorizontal: 16, gap: 8 },
  tabChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
  },
  tabChipActive: { backgroundColor: theme.primary, borderColor: theme.primary },
  tabChipText: { fontSize: 12, fontWeight: "700", color: theme.primary },
  tabChipTextActive: { color: theme.onPrimary },
  list: { padding: 16, paddingBottom: 40 },
  caseCard: {
    backgroundColor: theme.card,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.borderSoft,
  },
  caseCardPressed: { opacity: 0.92 },
  caseCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  caseIdentity: { flex: 1, paddingRight: 10 },
  caseNumber: { fontSize: 12, fontWeight: "700", color: theme.primary, marginBottom: 2 },
  caseName: { fontSize: 16, fontWeight: "700", color: theme.text },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  statusBadgeText: { fontSize: 11, fontWeight: "700" },
  caseReason: { fontSize: 13, color: theme.secondaryText, lineHeight: 19, marginBottom: 10 },
  caseCardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: theme.borderSoft,
    paddingTop: 8,
  },
  caseMeta: { fontSize: 12, color: theme.secondaryText, fontWeight: "600" },
  auditSection: {
    marginHorizontal: 16,
    marginBottom: 24,
    backgroundColor: theme.card,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.border,
  },
  auditHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 },
  auditTitle: { fontSize: 13, fontWeight: "800", color: theme.primaryDeep },
  auditRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 8 },
  auditDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.primary, marginTop: 5 },
  auditRowBody: { flex: 1 },
  auditAction: { fontSize: 12, fontWeight: "700", color: theme.text },
  auditNote: { fontSize: 12, color: theme.secondaryText, marginTop: 1 },
  auditMeta: { fontSize: 11, color: theme.secondaryText, fontWeight: "600", marginTop: 1 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.5)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: theme.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 40,
    maxHeight: "90%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  modalCaseNumber: { fontSize: 13, fontWeight: "700", color: theme.primary },
  modalCaseName: { fontSize: 19, fontWeight: "800", color: theme.text, marginTop: 2 },
  modalClose: { padding: 6 },
  modalStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
    marginBottom: 12,
  },
  modalMeta: { fontSize: 12, color: theme.secondaryText, fontWeight: "600" },
  modalLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: theme.primary,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginTop: 14,
    marginBottom: 6,
  },
  modalReason: { fontSize: 14, color: theme.text, lineHeight: 20 },
  historyList: { gap: 6, maxHeight: 180 },
  historyRow: {
    backgroundColor: theme.secondaryCard,
    borderRadius: 10,
    padding: 10,
  },
  historyAction: { fontSize: 13, fontWeight: "700", color: theme.primaryDeep },
  historyMeta: { fontSize: 11, color: theme.secondaryText, marginTop: 2, fontWeight: "600" },
  historyNote: { fontSize: 12, color: theme.secondaryText, marginTop: 4, lineHeight: 17 },
  historyEmpty: { fontSize: 13, color: theme.secondaryText },
  noteInput: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12,
    padding: 12,
    minHeight: 72,
    fontSize: 13,
    color: theme.text,
    backgroundColor: theme.inputBg,
    textAlignVertical: "top",
  },
  primaryButton: {
    backgroundColor: theme.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 10,
  },
  primaryButtonText: { color: theme.onPrimary, fontWeight: "700", fontSize: 14 },
  buttonDisabled: { opacity: 0.5 },
  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 },
  actionButton: {
    backgroundColor: theme.softPurple,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: theme.primary,
  },
  actionButtonText: { color: theme.primaryDeep, fontWeight: "700", fontSize: 13 },
  noActionsText: { fontSize: 13, color: theme.secondaryText, fontStyle: "italic" },
});
