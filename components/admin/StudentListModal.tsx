import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { MindCareTheme } from "@/constants/theme";
import { useMindCareTheme } from "@/contexts/ThemeContext";

interface StudentSummary {
  uid: string;
  name: string;
  schoolId: string;
  yearLevel: string;
  department: string;
  latestRiskLevel?: "low" | "normal" | "high";
  latestTotalScore?: number;
  assessmentsCount: number;
  profileImage?: string;
  isLSN?: boolean;
  lsnCategory?: string;
  specialNeedsType?: string;
}

function formatLsnCategory(category?: string): string {
  if (category === "additional-needs") return "Students with Additional Needs";
  if (category === "disabilities") return "Students with Disabilities";
  return "LSN";
}

interface StudentListModalProps {
  visible: boolean;
  title: string;
  students: StudentSummary[];
  onClose: () => void;
  journalMode?: boolean;
}

export function StudentListModal({
  visible,
  title,
  students,
  onClose,
  journalMode,
}: StudentListModalProps) {
  const { theme } = useMindCareTheme();
  const styles = createStyles(theme);
  const sortedStudents = [...students].sort((a, b) => {
    if (title.toLowerCase() === "survey assessment status") {
      const aTaken = a.assessmentsCount > 0 ? 1 : 0;
      const bTaken = b.assessmentsCount > 0 ? 1 : 0;
      return aTaken - bTaken;
    }
    return 0;
  });

  const isSurveyStatusMode = title.toLowerCase() === "survey assessment status";

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle} numberOfLines={1}>
              {title}
            </Text>
            <Pressable style={styles.modalCloseButton} onPress={onClose}>
              <Ionicons name="close" size={24} color={theme.text} />
            </Pressable>
          </View>
          <ScrollView
            style={styles.modalScroll}
            contentContainerStyle={styles.modalScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {sortedStudents.length === 0 ? (
              <View style={styles.stateCard}>
                <Text style={styles.stateText}>
                  No students match this criteria.
                </Text>
              </View>
            ) : (
              <>
                <Text style={styles.modalCountText}>
                  {sortedStudents.length} student
                  {sortedStudents.length !== 1 ? "s" : ""}
                </Text>
                {sortedStudents.map((student) => {
                  const hasTakenAssessment = student.assessmentsCount > 0;

                  return (
                    <Pressable
                      key={student.uid}
                      style={styles.studentCard}
                      onPress={() => {
                        if (journalMode) {
                          onClose();
                          router.navigate({
                            pathname: "/(admin)/student-journals",
                            params: { studentId: student.uid, studentName: student.name },
                          });
                        } else {
                          onClose();
                          router.push({
                            pathname: "./student-detail",
                            params: { uid: student.uid },
                          });
                        }
                      }}
                    >
                      <View style={styles.cardHeader}>
                        <View style={styles.leftSection}>
                          <View style={styles.studentAvatarCircle}>
                            {student.profileImage ? (
                              <Image
                                source={{ uri: student.profileImage }}
                                style={{ width: 40, height: 40, borderRadius: 20 }}
                              />
                            ) : (
                              <Text style={styles.studentAvatarText}>
                                {student.name.charAt(0).toUpperCase()}
                              </Text>
                            )}
                          </View>
                          <View style={styles.studentIdentity}>
                            <View style={styles.studentNameRow}>
                              <Text style={styles.studentName} numberOfLines={1}>
                                {student.name}
                              </Text>
                              <Ionicons name="chevron-forward" size={14} color={theme.primary} />
                            </View>
                            <Text style={styles.studentMeta} numberOfLines={1}>
                              {student.yearLevel} • {student.department}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.rightSection}>
                          <Text style={styles.studentId} numberOfLines={1}>
                            {student.schoolId}
                          </Text>
                        </View>
                      </View>

                      {isSurveyStatusMode && (
                        <View style={styles.statusBadgeContainer}>
                          <View
                            style={[
                              styles.statusBadge,
                              hasTakenAssessment
                                ? styles.badgeCompleted
                                : styles.badgeNotTaken,
                            ]}
                          >
                            <Ionicons
                              name={
                                hasTakenAssessment
                                  ? "checkmark-circle"
                                  : "close-circle"
                              }
                              size={14}
                              color={hasTakenAssessment ? theme.status.success : theme.status.error}
                            />
                            <Text
                              style={[
                                styles.statusBadgeText,
                                hasTakenAssessment
                                  ? styles.textCompleted
                                  : styles.textNotTaken,
                              ]}
                            >
                              {hasTakenAssessment ? "Completed" : "Not Taken"}
                            </Text>
                          </View>
                        </View>
                      )}

                      {student.isLSN && (
                        <View style={styles.lsnBadgeRow}>
                          <Ionicons
                            name="accessibility"
                            size={12}
                            color={theme.primary}
                          />
                          <Text style={styles.lsnBadgeText} numberOfLines={2}>
                            {formatLsnCategory(student.lsnCategory)}
                            {student.specialNeedsType
                              ? ` · ${student.specialNeedsType}`
                              : ""}
                          </Text>
                        </View>
                      )}

                      <View style={styles.cardFooter}>
                        <View style={styles.footerStat}>
                          <Text style={styles.statLabel}>Concern Level</Text>
                          <Text
                            style={[
                              styles.statValueHighlight,
                              student.latestRiskLevel === "low"
                                ? styles.riskLow
                                : student.latestRiskLevel === "high"
                                  ? styles.riskHigh
                                  : styles.riskModerate,
                            ]}
                          >
                            {student.latestRiskLevel === "low"
                              ? "Low"
                              : student.latestRiskLevel === "high"
                                ? "High"
                                : student.latestRiskLevel
                                  ? "Moderate"
                                  : "N/A"}
                          </Text>
                        </View>
                        <View style={[styles.footerStat, styles.footerStatRight]}>
                          <Text style={styles.statLabel}>Score</Text>
                          <Text style={styles.scoreValue}>
                            {student.latestTotalScore ?? "N/A"}
                          </Text>
                        </View>
                      </View>
                    </Pressable>
                  );
                })}
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (theme: MindCareTheme) =>
  StyleSheet.create({
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.6)",
      justifyContent: "flex-end",
    },
    modalContainer: {
      backgroundColor: theme.background,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      height: "82%", // Replaced maxHeight with a dependable fixed height percentage
      overflow: "hidden",
    },
    modalHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingTop: 18,
      paddingBottom: 14,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      backgroundColor: theme.card,
    },
    modalTitle: { fontSize: 18, fontWeight: "800", color: theme.text, flex: 1 },
    modalCloseButton: {
      padding: 8,
      borderRadius: 999,
      backgroundColor: theme.inputBg,
    },
    modalScroll: { flex: 1 },
    modalScrollContent: { padding: 16, paddingBottom: 40 },
    studentCard: {
      backgroundColor: theme.card,
      borderRadius: 18,
      padding: 18,
      marginBottom: 14,
    },
    cardHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    leftSection: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    studentAvatarCircle: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.primary,
      justifyContent: "center",
      alignItems: "center",
    },
    studentAvatarText: {
      color: theme.onPrimary,
      fontSize: 18,
      fontWeight: "700",
    },
    studentIdentity: {
      flex: 1,
      minWidth: 0,
    },
    studentName: { fontSize: 16, fontWeight: "800", color: theme.primary },
    studentNameRow: { flexDirection: "row", alignItems: "center", gap: 4 },
    rightSection: {
      maxWidth: "42%",
      alignItems: "flex-end",
    },
    studentId: {
      fontSize: 13,
      fontWeight: "800",
      color: theme.text,
      textAlign: "right",
    },
    studentMeta: { fontSize: 12, color: theme.secondaryText, marginTop: 2 },
    lsnBadgeRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 6,
      backgroundColor: theme.softPurple,
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 6,
      marginTop: 12,
    },
    lsnBadgeText: {
      flex: 1,
      fontSize: 12,
      fontWeight: "700",
      color: theme.primary,
      lineHeight: 16,
    },
    cardFooter: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 12,
      marginTop: 14,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: theme.borderSoft,
    },
    footerStat: {
      flex: 1,
      minWidth: 0,
    },
    footerStatRight: {
      alignItems: "flex-end",
    },
    scoreValue: {
      fontSize: 15,
      fontWeight: "800",
      color: theme.text,
    },
    statLabel: {
      fontSize: 11,
      color: theme.secondaryText,
      marginBottom: 4,
      textTransform: "uppercase",
    },
    statValueHighlight: { fontSize: 15, fontWeight: "800", color: theme.text },
    riskLow: { color: theme.status.success, fontWeight: "800" },
    riskModerate: { color: theme.status.warning, fontWeight: "800" },
    riskHigh: { color: theme.status.error, fontWeight: "800" },
    stateCard: {
      backgroundColor: theme.card,
      borderRadius: 16,
      padding: 24,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 16,
    },
    stateText: { marginTop: 12, color: theme.text, fontSize: 14 },
    modalCountText: {
      fontSize: 13,
      fontWeight: "700",
      color: theme.secondaryText,
      marginBottom: 12,
    },
    statusBadgeContainer: {
      marginBottom: 12,
      alignItems: "flex-start",
    },
    statusBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
      borderWidth: 1,
    },
    badgeCompleted: {
      backgroundColor: `${theme.status.success}1A`,
      borderColor: `${theme.status.success}40`,
    },
    badgeNotTaken: {
      backgroundColor: `${theme.status.error}1A`,
      borderColor: `${theme.status.error}40`,
    },
    statusBadgeText: {
      fontSize: 12,
      fontWeight: "700",
    },
    textCompleted: {
      color: theme.status.success,
    },
    textNotTaken: {
      color: theme.status.error,
    },
  });
