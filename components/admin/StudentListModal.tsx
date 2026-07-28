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
}

interface StudentListModalProps {
  visible: boolean;
  title: string;
  students: StudentSummary[];
  onClose: () => void;
}

export function StudentListModal({
  visible,
  title,
  students,
  onClose,
}: StudentListModalProps) {
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
              <Ionicons name="close" size={24} color="#0F172A" />
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
                        onClose();
                        router.push({
                          pathname: "./student-detail",
                          params: { uid: student.uid },
                        });
                      }}
                    >
                      <View style={styles.studentCardRow}>
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
                        <View style={styles.studentHeader}>
                          <View style={styles.studentIdentityBlock}>
                            <Text style={styles.studentName}>{student.name}</Text>
                            <Text style={styles.studentMeta}>
                              {student.yearLevel}
                            </Text>
                          </View>
                          <View style={styles.studentInfoBlock}>
                            <Text style={styles.studentId}>
                              {student.schoolId}
                            </Text>
                            <Text style={styles.studentCourse}>
                              {student.department}
                            </Text>
                          </View>
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
                              color={hasTakenAssessment ? "#15803D" : "#B91C1C"}
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

                      <View style={styles.studentStatsRow}>
                        <View style={styles.statItemWide}>
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
                        <View style={styles.statItemWide}>
                          <Text style={styles.statLabel}>Score</Text>
                          <Text style={styles.statValueHighlight}>
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

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    backgroundColor: "#F1F5F9",
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
    borderBottomColor: "#E2E8F0",
    backgroundColor: "white",
  },
  modalTitle: { fontSize: 18, fontWeight: "800", color: "#0F172A", flex: 1 },
  modalCloseButton: {
    padding: 8,
    borderRadius: 999,
    backgroundColor: "#F1F5F9",
  },
  modalScroll: { flex: 1 },
  modalScrollContent: { padding: 16, paddingBottom: 40 },
  studentCard: {
    backgroundColor: "white",
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
  },
  studentCardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  studentAvatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#8A63D2",
    justifyContent: "center",
    alignItems: "center",
  },
  studentAvatarText: {
    color: "white",
    fontSize: 18,
    fontWeight: "700",
  },
  studentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  studentIdentityBlock: { flex: 1, paddingRight: 12 },
  studentInfoBlock: { alignItems: "flex-end", maxWidth: "45%" },
  studentName: { fontSize: 16, fontWeight: "800", color: "#0F172A" },
  studentId: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0B3D91",
    textAlign: "right",
  },
  studentCourse: {
    fontSize: 12,
    fontWeight: "700",
    color: "#334155",
    marginTop: 2,
    textAlign: "right",
  },
  studentMeta: { fontSize: 12, color: "#475569" },
  studentStatsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  statItemWide: { width: "48%" },
  statLabel: {
    fontSize: 11,
    color: "#64748B",
    marginBottom: 4,
    textTransform: "uppercase",
  },
  statValueHighlight: { fontSize: 15, fontWeight: "800", color: "#0B3D91" },
  riskLow: { color: "#16A34A", fontWeight: "800" },
  riskModerate: { color: "#D97706", fontWeight: "800" },
  riskHigh: { color: "#EF4444", fontWeight: "800" },
  stateCard: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  stateText: { marginTop: 12, color: "#334155", fontSize: 14 },
  modalCountText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#64748B",
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
    backgroundColor: "#DCFCE7",
    borderColor: "#BBF7D0",
  },
  badgeNotTaken: {
    backgroundColor: "#FEE2E2",
    borderColor: "#FECACA",
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  textCompleted: {
    color: "#15803D",
  },
  textNotTaken: {
    color: "#B91C1C",
  },
});
