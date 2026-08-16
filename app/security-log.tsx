import { auth, db } from "@/constants/firebase";
import { useAuth } from "@/hooks/AuthContext";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMindCareTheme } from "@/contexts/ThemeContext";
import type { MindCareTheme } from "@/constants/theme";

interface SecurityEvent {
  id: string;
  type: string;
  details: Record<string, any>;
  createdAt: any;
}

const EVENT_META: Record<string, { label: string; icon: string; color: string }> = {
  login: { label: "Login", icon: "log-in-outline", color: "#2563EB" },
  password_reset_requested: {
    label: "Password Reset Requested",
    icon: "mail-outline",
    color: "#D97706",
  },
  password_changed: {
    label: "Password Changed",
    icon: "lock-closed-outline",
    color: "#8A63D2",
  },
  password_change_failed: {
    label: "Failed Password Change",
    icon: "alert-circle-outline",
    color: "#DC2626",
  },
};

function formatDate(value: any): string {
  if (!value) return "";
  let date: Date;
  if (typeof value.toDate === "function") {
    date = value.toDate();
  } else if (value instanceof Date) {
    date = value;
  } else {
    date = new Date(value);
  }
  if (isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDevice(event: SecurityEvent): string {
  const details = event.details || {};
  if (details.platform === "android") return "Android Device";
  if (details.platform === "ios") return "iOS Device";
  if (details.platform === "web") {
    const ua = details.userAgent || "";
    const match = ua.match(/\((.*?)\)/);
    if (match) return match[1].split(";")[0].trim();
    return "Web";
  }
  if (details.userAgent) {
    const browser = details.userAgent.split(" ")[0];
    return browser || "Unknown Device";
  }
  return "Unknown Device";
}

export default function SecurityLogScreen() {
  const { theme } = useMindCareTheme();
  const styles = createStyles(theme);
  const { user } = useAuth();
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      router.replace("/auth/login");
      return;
    }

    const load = async () => {
      try {
        const ref = collection(db, "securityLogs", user.uid, "events");
        const q = query(ref, orderBy("createdAt", "desc"));
        const snap = await getDocs(q);
        const items: SecurityEvent[] = [];
        snap.forEach((doc) => {
          items.push({ id: doc.id, ...(doc.data() as any) });
        });
        setEvents(items);
      } catch (err) {
        console.error("Error loading security log:", err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [user]);

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={theme.softGradient}
        style={styles.gradient}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={theme.secondaryText} />
          </Pressable>
          <Text style={styles.headerTitle}>Security Activity</Text>
          <View style={{ width: 44 }} />
        </View>

        <View style={styles.badgeContainer}>
          <LinearGradient
            colors={theme.headerGradient}
            style={styles.badgeGradient}
          >
            <Ionicons name="shield-checkmark" size={32} color={theme.onPrimary} />
          </LinearGradient>
          <Text style={styles.badgeTitle}>Account Activity</Text>
          <Text style={styles.badgeSubtitle}>
            Review important events on your account
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          {loading ? (
            <ActivityIndicator style={{ marginTop: 40 }} color={theme.primary} />
          ) : events.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="shield-checkmark-outline" size={48} color={theme.border} />
              <Text style={styles.emptyTitle}>No security events yet</Text>
              <Text style={styles.emptyText}>
                Sign-ins, password changes, and reset requests will appear here.
              </Text>
            </View>
          ) : (
            events.map((event) => {
              const meta = EVENT_META[event.type] || {
                label: "Security Event",
                icon: "shield-outline",
                color: "#64748B",
              };
              return (
                <View key={event.id} style={styles.eventCard}>
                  <View
                    style={[
                      styles.eventIcon,
                      { backgroundColor: `${meta.color}1A` },
                    ]}
                  >
                    <Ionicons
                      name={meta.icon as any}
                      size={20}
                      color={meta.color}
                    />
                  </View>
                  <View style={styles.eventBody}>
                    <Text style={styles.eventLabel}>{meta.label}</Text>
                    <Text style={styles.eventDevice}>{formatDevice(event)}</Text>
                    {event.details?.ipAddress ? (
                      <Text style={styles.eventIp}>
                        IP: {event.details.ipAddress}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={styles.eventDate}>
                    {formatDate(event.createdAt)}
                  </Text>
                </View>
              );
            })
          )}
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const createStyles = (theme: MindCareTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    gradient: {
      flex: 1,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 8,
    },
    backButton: {
      width: 44,
      height: 44,
      backgroundColor: theme.card,
      borderRadius: 22,
      justifyContent: "center",
      alignItems: "center",
      // @ts-ignore - web only
      boxShadow: "0px 2px 4px rgba(0,0,0,0.1)",
      elevation: 3,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.primary,
    },
    badgeContainer: {
      alignItems: "center",
      paddingVertical: 20,
    },
    badgeGradient: {
      width: 72,
      height: 72,
      borderRadius: 36,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 12,
    },
    badgeTitle: {
      fontSize: 22,
      fontWeight: "700",
      color: theme.primary,
    },
    badgeSubtitle: {
      fontSize: 14,
      color: theme.secondaryText,
      marginTop: 4,
    },
    listContent: {
      paddingHorizontal: 20,
      paddingBottom: 40,
    },
    eventCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.card,
      borderRadius: 16,
      padding: 16,
      marginBottom: 12,
      // @ts-ignore - web only
      boxShadow: "0px 1px 2px rgba(0,0,0,0.08)",
      elevation: 2,
    },
    eventIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: "center",
      alignItems: "center",
    },
    eventBody: {
      flex: 1,
      marginLeft: 12,
    },
    eventLabel: {
      fontSize: 15,
      fontWeight: "600",
      color: theme.text,
    },
    eventDevice: {
      fontSize: 13,
      color: theme.secondaryText,
      marginTop: 2,
    },
    eventIp: {
      fontSize: 12,
      color: theme.secondaryText,
      marginTop: 2,
    },
    eventDate: {
      fontSize: 12,
      color: theme.secondaryText,
      marginLeft: 12,
      textAlign: "right",
      maxWidth: 110,
    },
    emptyContainer: {
      alignItems: "center",
      marginTop: 60,
      paddingHorizontal: 24,
    },
    emptyTitle: {
      fontSize: 17,
      fontWeight: "700",
      color: theme.secondaryText,
      marginTop: 12,
    },
    emptyText: {
      fontSize: 14,
      color: theme.secondaryText,
      textAlign: "center",
      marginTop: 6,
      lineHeight: 20,
    },
  });
