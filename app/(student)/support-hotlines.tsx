import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React from "react";
import {
  Alert,
  Linking,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

interface SupportHotline {
  id: string;
  title: string;
  description: string;
  availability?: string;
  contactType: "call" | "text";
  contactInfo: string;
  iconName: any;
  iconColor: string;
  isEmergency?: boolean;
}

export default function SupportHotlinesScreen() {
  const hotlines: SupportHotline[] = [
    {
      id: "emergency",
      title: "In Immediate Danger?",
      description:
        "If you or someone you know is in immediate danger, please call emergency services.",
      contactType: "call",
      contactInfo: "911",
      iconName: "call",
      iconColor: "#FF4757",
      isEmergency: true,
    },
    {
      id: "crisis",
      title: "National Crisis Hotline",
      description: "Immediate support for mental health crises",
      availability: "24/7",
      contactType: "call",
      contactInfo: "0917-989-8727",
      iconName: "call",
      iconColor: "#E84393",
    },
    {
      id: "student",
      title: "Student Support Line",
      description: "Academic and personal support for students",
      contactType: "call",
      contactInfo: "(02) 8804-4673",
      iconName: "call",
      iconColor: "#3742FA",
    },
    {
      id: "textCrisis",
      title: "Crisis Text Line",
      description: "Text-based support for those in crisis",
      availability: "24/7",
      contactType: "text",
      contactInfo: "Text USAP to 4547",
      iconName: "chatbubble",
      iconColor: "#E84393",
    },
    {
      id: "anxiety",
      title: "Anxiety & Depression Helpline",
      description: "Specialized support for anxiety and depression",
      availability: "Mon-Fri, 9 AM - 5 PM",
      contactType: "call",
      contactInfo: "(02) 8896-9292",
      iconName: "call",
      iconColor: "#2ED573",
    },
    {
      id: "specialNeeds",
      title: "Special Needs Support",
      description: "Resources for learners with special needs",
      availability: "Mon-Fri, 8 AM - 6 PM",
      contactType: "call",
      contactInfo: "(02) 8632-1001",
      iconName: "call",
      iconColor: "#2ED573",
    },
    {
      id: "campus",
      title: "Campus Wellness Center",
      description: "On-campus mental health resources",
      availability: "Mon-Fri, 9 AM - 5 PM",
      contactType: "call",
      contactInfo: "(02) 8988-4673",
      iconName: "mail",
      iconColor: "#FFA726",
    },
  ];

  const handleBack = () => {
    router.replace("/dashboard");
  };

  const handleContact = async (hotline: SupportHotline) => {
    try {
      if (hotline.contactType === "call") {
        const phoneNumber = hotline.contactInfo.replace(/[^0-9]/g, "");
        await Linking.openURL(`tel:${phoneNumber}`);
      } else if (hotline.contactType === "text") {
        // For text messages, we'll show an alert since SMS linking is complex
        Alert.alert(
          "Crisis Text Line",
          `Please text HOME to 741741 for crisis support`,
        );
      }
    } catch (error) {
      Alert.alert(
        "Error",
        "Unable to open the application. The service may not be available on your device.",
      );
    }
  };

  const renderHotlineCard = (hotline: SupportHotline) => {
    if (hotline.isEmergency) {
      return (
        <View key={hotline.id} style={styles.emergencyCard}>
          <View style={styles.cardContent}>
            <View
              style={[
                styles.iconContainer,
                { backgroundColor: hotline.iconColor },
              ]}
            >
              <Ionicons name={hotline.iconName} size={24} color="white" />
            </View>
            <View style={styles.cardText}>
              <Text style={styles.emergencyTitle}>{hotline.title}</Text>
              <Text style={styles.emergencyDescription}>
                {hotline.description}
              </Text>
            </View>
          </View>
          <Pressable
            style={styles.emergencyButton}
            onPress={() => handleContact(hotline)}
          >
            <Text style={styles.emergencyButtonText}>Call 911</Text>
          </Pressable>
        </View>
      );
    }

    return (
      <View key={hotline.id} style={styles.hotlineCard}>
        <View style={styles.cardHeader}>
          <View
            style={[
              styles.iconContainer,
              { backgroundColor: hotline.iconColor },
            ]}
          >
            <Ionicons name={hotline.iconName} size={20} color="white" />
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.cardTitle}>{hotline.title}</Text>
            <Text style={styles.cardDescription}>{hotline.description}</Text>
            {hotline.availability && (
              <View style={styles.availabilityContainer}>
                <Ionicons name="time-outline" size={16} color="#666" />
                <Text style={styles.availabilityText}>
                  {hotline.availability}
                </Text>
              </View>
            )}
          </View>
        </View>

        <Pressable
          style={styles.contactButtonContainer}
          onPress={() => handleContact(hotline)}
        >
          <LinearGradient
            colors={["#E84393", "#3742FA"]}
            style={styles.contactButton}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Ionicons
              name={hotline.contactType === "call" ? "call" : "chatbubble"}
              size={16}
              color="white"
            />
            <Text style={styles.contactButtonText}>{hotline.contactInfo}</Text>
          </LinearGradient>
        </Pressable>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={["#E84393", "#E84393"]}
        style={styles.headerGradient}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={handleBack}>
            <Ionicons name="arrow-back" size={24} color="white" />
          </Pressable>
          <Text style={styles.headerTitle}>Support Hotlines</Text>
          <View style={styles.placeholder} />
        </View>

        {/* Subtitle */}
        <View style={styles.subtitleContainer}>
          <Text style={styles.subtitle}>
            You&apos;re not alone. Reach out for support anytime.
          </Text>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {hotlines.map(renderHotlineCard)}

        {/* Encouragement Message */}
        <View style={styles.encouragementCard}>
          <View style={styles.encouragementIcon}>
            <Ionicons name="heart" size={20} color="#3742FA" />
          </View>
          <Text style={styles.encouragementText}>
            Remember: Asking for help is a sign of strength, not weakness. These
            resources are here to support you whenever you need them.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F5F5",
  },
  headerGradient: {
    paddingBottom: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "white",
  },
  placeholder: {
    width: 40,
  },
  subtitleContainer: {
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.9)",
    textAlign: "center",
    lineHeight: 20,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
    gap: 16,
  },
  emergencyCard: {
    backgroundColor: "#FF4757",
    borderRadius: 16,
    padding: 20,
    shadowColor: "#FF4757",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  cardContent: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 16,
    gap: 12,
  },
  cardText: {
    flex: 1,
  },
  emergencyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "white",
    marginBottom: 8,
  },
  emergencyDescription: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.9)",
    lineHeight: 20,
  },
  emergencyButton: {
    backgroundColor: "white",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 25,
    alignSelf: "flex-start",
  },
  emergencyButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FF4757",
  },
  hotlineCard: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 16,
    gap: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  cardInfo: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 14,
    color: "#666",
    lineHeight: 20,
    marginBottom: 8,
  },
  availabilityContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  availabilityText: {
    fontSize: 12,
    color: "#666",
  },
  contactButtonContainer: {
    borderRadius: 25,
  },
  contactButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    gap: 8,
  },
  contactButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "white",
  },
  encouragementCard: {
    backgroundColor: "#E3F2FD",
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#3742FA",
    marginTop: 8,
  },
  encouragementIcon: {
    marginTop: 2,
  },
  encouragementText: {
    flex: 1,
    fontSize: 14,
    color: "#1976D2",
    lineHeight: 20,
  },
});
