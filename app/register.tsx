import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useState } from "react";
import {
    Pressable,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";

export default function RegisterScreen() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [schoolId, setSchoolId] = useState("");
  const [academicProgram, setAcademicProgram] = useState("");
  const [yearLevel, setYearLevel] = useState("");
  const [nationality, setNationality] = useState("");
  const [religiousAffiliation, setReligiousAffiliation] = useState("");
  const [culturalAffiliation, setCulturalAffiliation] = useState("");
  const [contactNo, setContactNo] = useState("");
  const [civilStatus, setCivilStatus] = useState("");
  const [citizenship, setCitizenship] = useState("");
  const [genderIdentity, setGenderIdentity] = useState("");
  const [provincialAddress, setProvincialAddress] = useState("");

  const formatSchoolId = (text: string) => {
    // Remove all non-numeric characters
    const cleaned = text.replace(/\D/g, "");

    // Format as XX-XXXX-XXX
    if (cleaned.length <= 2) {
      return cleaned;
    } else if (cleaned.length <= 6) {
      return `${cleaned.slice(0, 2)}-${cleaned.slice(2)}`;
    } else {
      return `${cleaned.slice(0, 2)}-${cleaned.slice(2, 6)}-${cleaned.slice(6, 9)}`;
    }
  };

  const handleSchoolIdChange = (text: string) => {
    const formatted = formatSchoolId(text);
    setSchoolId(formatted);
  };

  const handleBack = () => {
    router.back();
  };

  const handleCreateAccount = () => {
    // Handle registration logic here
    // For now, navigate to dashboard
    router.push("/dashboard");
  };

  const handleLogin = () => {
    // Navigate to login screen
    router.push("/login");
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={["#E8F4FD", "#F0F8FF", "#E8F4FD"]}
        style={styles.gradient}
      >
        {/* Header with back button */}
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={handleBack}>
            <Ionicons name="arrow-back" size={24} color="#666" />
          </Pressable>
        </View>

        <ScrollView
          style={styles.scrollContainer}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Register Icon */}
          <View style={styles.iconContainer}>
            <LinearGradient
              colors={["#4DD0E1", "#26C6DA", "#00BCD4", "#009688"]}
              style={styles.iconGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons name="person-add" size={32} color="white" />
            </LinearGradient>
          </View>

          {/* Title and Subtitle */}
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>
            Join MindCare and start your wellness journey
          </Text>

          {/* Form Container */}
          <View style={styles.formContainer}>
            {/* Full Name Input */}
            <View style={styles.inputContainer}>
              <View style={styles.inputHeader}>
                <Ionicons name="person-outline" size={20} color="#666" />
                <Text style={styles.inputLabel}>Full Name</Text>
              </View>
              <TextInput
                style={styles.input}
                placeholder="Enter your full name"
                placeholderTextColor="#999"
                value={fullName}
                onChangeText={setFullName}
                autoCapitalize="words"
              />
            </View>

            {/* Email Address */}
            <View style={styles.inputContainer}>
              <View style={styles.inputHeader}>
                <Ionicons name="mail-outline" size={20} color="#666" />
                <Text style={styles.inputLabel}>Email Address</Text>
              </View>
              <TextInput
                style={styles.input}
                placeholder="Enter your email address"
                placeholderTextColor="#999"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {/* School ID Number */}
            <View style={styles.inputContainer}>
              <View style={styles.inputHeader}>
                <Ionicons name="card-outline" size={20} color="#666" />
                <Text style={styles.inputLabel}>School ID Number</Text>
              </View>
              <TextInput
                style={styles.input}
                placeholder="XX-XXXX-XXX"
                placeholderTextColor="#999"
                value={schoolId}
                onChangeText={handleSchoolIdChange}
                keyboardType="numeric"
                maxLength={11}
              />
            </View>

            {/* Academic Program */}
            <View style={styles.inputContainer}>
              <View style={styles.inputHeader}>
                <Ionicons name="school-outline" size={20} color="#666" />
                <Text style={styles.inputLabel}>Academic Program</Text>
              </View>
              <TextInput
                style={styles.input}
                placeholder="Enter your academic program"
                placeholderTextColor="#999"
                value={academicProgram}
                onChangeText={setAcademicProgram}
                autoCapitalize="words"
              />
            </View>

            {/* Year Level */}
            <View style={styles.inputContainer}>
              <View style={styles.inputHeader}>
                <Ionicons name="library-outline" size={20} color="#666" />
                <Text style={styles.inputLabel}>Year Level</Text>
              </View>
              <TextInput
                style={styles.input}
                placeholder="e.g., 1st Year, 2nd Year, 3rd Year, 4th Year"
                placeholderTextColor="#999"
                value={yearLevel}
                onChangeText={setYearLevel}
                autoCapitalize="words"
              />
            </View>

            {/* Nationality */}
            <View style={styles.inputContainer}>
              <View style={styles.inputHeader}>
                <Ionicons name="flag-outline" size={20} color="#666" />
                <Text style={styles.inputLabel}>Nationality</Text>
              </View>
              <TextInput
                style={styles.input}
                placeholder="Enter your nationality"
                placeholderTextColor="#999"
                value={nationality}
                onChangeText={setNationality}
                autoCapitalize="words"
              />
            </View>

            {/* Religious Affiliation */}
            <View style={styles.inputContainer}>
              <View style={styles.inputHeader}>
                <Ionicons name="book-outline" size={20} color="#666" />
                <Text style={styles.inputLabel}>Religious Affiliation</Text>
              </View>
              <TextInput
                style={styles.input}
                placeholder="Enter your religious affiliation"
                placeholderTextColor="#999"
                value={religiousAffiliation}
                onChangeText={setReligiousAffiliation}
                autoCapitalize="words"
              />
            </View>

            {/* Cultural Affiliation */}
            <View style={styles.inputContainer}>
              <View style={styles.inputHeader}>
                <Ionicons name="globe-outline" size={20} color="#666" />
                <Text style={styles.inputLabel}>Cultural Affiliation</Text>
              </View>
              <TextInput
                style={styles.input}
                placeholder="Enter your cultural affiliation"
                placeholderTextColor="#999"
                value={culturalAffiliation}
                onChangeText={setCulturalAffiliation}
                autoCapitalize="words"
              />
            </View>

            {/* Contact Number */}
            <View style={styles.inputContainer}>
              <View style={styles.inputHeader}>
                <Ionicons name="call-outline" size={20} color="#666" />
                <Text style={styles.inputLabel}>Contact No</Text>
              </View>
              <TextInput
                style={styles.input}
                placeholder="Enter your contact number"
                placeholderTextColor="#999"
                value={contactNo}
                onChangeText={setContactNo}
                keyboardType="phone-pad"
              />
            </View>

            {/* Civil Status */}
            <View style={styles.inputContainer}>
              <View style={styles.inputHeader}>
                <Ionicons name="people-outline" size={20} color="#666" />
                <Text style={styles.inputLabel}>Civil Status</Text>
              </View>
              <TextInput
                style={styles.input}
                placeholder="e.g., Single, Married, Divorced, Widowed"
                placeholderTextColor="#999"
                value={civilStatus}
                onChangeText={setCivilStatus}
                autoCapitalize="words"
              />
            </View>

            {/* Citizenship */}
            <View style={styles.inputContainer}>
              <View style={styles.inputHeader}>
                <Ionicons name="document-outline" size={20} color="#666" />
                <Text style={styles.inputLabel}>Citizenship</Text>
              </View>
              <TextInput
                style={styles.input}
                placeholder="Enter your citizenship"
                placeholderTextColor="#999"
                value={citizenship}
                onChangeText={setCitizenship}
                autoCapitalize="words"
              />
            </View>

            {/* Gender Identity */}
            <View style={styles.inputContainer}>
              <View style={styles.inputHeader}>
                <Ionicons name="person-circle-outline" size={20} color="#666" />
                <Text style={styles.inputLabel}>Gender Identity</Text>
              </View>
              <TextInput
                style={styles.input}
                placeholder="Male, Female, or Others"
                placeholderTextColor="#999"
                value={genderIdentity}
                onChangeText={setGenderIdentity}
                autoCapitalize="words"
              />
            </View>

            {/* Provincial Address */}
            <View style={styles.inputContainer}>
              <View style={styles.inputHeader}>
                <Ionicons name="location-outline" size={20} color="#666" />
                <Text style={styles.inputLabel}>Provincial Address</Text>
              </View>
              <TextInput
                style={styles.input}
                placeholder="Enter your provincial address"
                placeholderTextColor="#999"
                value={provincialAddress}
                onChangeText={setProvincialAddress}
                autoCapitalize="words"
                multiline
                numberOfLines={2}
              />
            </View>
          </View>

          {/* Create Account Button */}
          <View style={styles.buttonContainer}>
            <Pressable onPress={handleCreateAccount}>
              <LinearGradient
                colors={["#4CAF50", "#00BCD4", "#2196F3"]}
                style={styles.createAccountButton}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.createAccountButtonText}>
                  Create Account
                </Text>
              </LinearGradient>
            </Pressable>
          </View>

          {/* Login Link */}
          <View style={styles.loginContainer}>
            <Text style={styles.loginText}>Already have an account? </Text>
            <Pressable onPress={handleLogin}>
              <Text style={styles.loginLink}>Login here</Text>
            </Pressable>
          </View>
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
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 20,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  backButton: {
    width: 44,
    height: 44,
    backgroundColor: "white",
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  iconContainer: {
    alignItems: "center",
    marginBottom: 24,
  },
  iconGradient: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "600",
    color: "#2196F3",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginBottom: 32,
  },
  formContainer: {
    marginBottom: 32,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  inputLabel: {
    fontSize: 14,
    color: "#666",
    marginLeft: 8,
    fontWeight: "500",
  },
  input: {
    backgroundColor: "white",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 12,
    fontSize: 16,
    color: "#333",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  buttonContainer: {
    marginBottom: 24,
  },
  createAccountButton: {
    paddingVertical: 18,
    borderRadius: 25,
    alignItems: "center",
  },
  createAccountButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  loginContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: 40,
  },
  loginText: {
    color: "#666",
    fontSize: 14,
  },
  loginLink: {
    color: "#2196F3",
    fontSize: 14,
    fontWeight: "500",
  },
});
