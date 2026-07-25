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

const FAQS = [
  {
    question: "How do I edit a journal entry?",
    answer:
      "Currently, journal entries cannot be edited after they are saved. This is to encourage in-the-moment reflection. If you have more thoughts, you can always create a new entry.",
  },
  {
    question: "Is my data private and secure?",
    answer:
      "Absolutely. Your journal entries are private. Only authorized university administrators can view your profile information for verification and support purposes. For more details, please review our Privacy Policy.",
  },
  {
    question: "How does the AI reflection work?",
    answer:
      "Our AI companion reads the text of your latest journal entry to provide a supportive and non-judgmental reflection. It does not store your personal data and is designed to be a tool for self-awareness, not a replacement for professional advice.",
  },
  {
    question: "How do I reset my password?",
    answer:
      "From the login screen, tap on the 'Forgot Password?' link. You will receive an email with instructions to reset your password.",
  },
];

export default function HelpAndSupportScreen() {
  const handleContactSupport = async () => {
    const email = "support@youruniversity.edu";
    const url = `mailto:${email}?subject=MindCare App Support`;
    const canOpen = await Linking.canOpenURL(url);

    if (canOpen) {
      await Linking.openURL(url);
    } else {
      Alert.alert(
        "Cannot Open Email",
        "Please send an email to support@youruniversity.edu for assistance.",
      );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={["#F0F8FF", "#E8F4FD"]} style={styles.gradient}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#666" />
          </Pressable>
          <Text style={styles.headerTitle}>Help & Support</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          style={styles.scrollContainer}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
          {FAQS.map((faq, index) => (
            <View key={index} style={styles.faqItem}>
              <Text style={styles.faqQuestion}>{faq.question}</Text>
              <Text style={styles.faqAnswer}>{faq.answer}</Text>
            </View>
          ))}

          <Text style={styles.sectionTitle}>Contact Us</Text>
          <Text style={styles.contactText}>
            If you can not find the answer you are looking for, please do not
            hesitate to reach out to our support team.
          </Text>
          <Pressable
            style={styles.contactButton}
            onPress={handleContactSupport}
          >
            <Ionicons name="mail-outline" size={20} color="white" />
            <Text style={styles.contactButtonText}>Contact Support</Text>
          </Pressable>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
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
    color: "#333",
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#2196F3",
    marginBottom: 16,
    marginTop: 12,
  },
  faqItem: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  faqQuestion: {
    fontSize: 15,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  faqAnswer: {
    fontSize: 14,
    color: "#666",
    lineHeight: 22,
  },
  contactText: {
    fontSize: 14,
    color: "#666",
    lineHeight: 22,
    marginBottom: 16,
  },
  contactButton: {
    backgroundColor: "#2196F3",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 25,
    gap: 8,
  },
  contactButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
});
