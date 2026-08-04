import { API_URL } from "@/backend/config";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import NetInfo from "@react-native-community/netinfo";
import { AccessibleText } from "@/components/AccessibleText";

// Firebase imports
import { auth } from "@/constants/firebase";
import { createUserDocument } from "@/firestore/profileFirestore";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { pickProfileImage, uploadAvatarToCloudinary } from "@/services/userService";
import { uploadDocumentToCloudinary } from "@/services/cloudinaryUpload";

const COLLEGES = [
  "Saint Louis University (SLU)",
  "University of the Philippines Baguio (UPB)",
  "University of Baguio (UB)",
  "University of the Cordilleras (UC)",
  "Baguio Central University (BCU)",
  "Pines City Colleges (PCC)",
  "Baguio College of Technology (BCT)",
  "Philippine Military Academy (PMA)",
  "Easter College (EC)",
  "BSBT College",
  "Asia Pacific Theological Seminary (APTS)",
  "Data Center College of the Philippines (DCCP)",
  "STI College Baguio",
  "Benguet State University (BSU)",
  "Cordillera Career Development College (CCDC)",
  "King's College of the Philippines (KCP)",
  "Philippine Nazarene College (PNC)",
  "Philippine College of Ministry (PCM)",
  "BVS Colleges",
  "Concordia College of Benguet",
  "Star Colleges",
];

const COLLEGE_DEPARTMENTS: Record<string, Record<string, string[]>> = {
  "Saint Louis University (SLU)": {
    "School of Accountancy, Management, Computing and Information Studies (SAMCIS)": [
      "Bachelor of Science in Accountancy (BSA)",
      "Bachelor of Science in Management Accounting (BSMA)",
      "Bachelor of Science in Business Administration (BSBA)",
      "Bachelor of Science in Entrepreneurship (BS Entrep)",
      "Bachelor of Science in Tourism Management (BSTM)",
      "Bachelor of Science in Hospitality Management (BSHM)",
      "Bachelor of Science in Computer Science (BSCS)",
      "Bachelor of Science in Information Technology (BSIT)",
      "Bachelor of Multimedia Arts (BMA)",
    ],
    "School of Engineering and Architecture (SEA)": [
      "Bachelor of Science in Architecture (BS Arch)",
      "Bachelor of Science in Chemical Engineering (BSChE)",
      "Bachelor of Science in Civil Engineering (BSCE)",
      "Bachelor of Science in Electrical Engineering (BSEE)",
      "Bachelor of Science in Electronics Engineering (BSECE)",
      "Bachelor of Science in Geodetic Engineering (BSGE)",
      "Bachelor of Science in Industrial Engineering (BSIE)",
      "Bachelor of Science in Mechanical Engineering (BSME)",
      "Bachelor of Science in Mechatronics Engineering (BS Mechatronics)",
      "Bachelor of Science in Mining Engineering (BS Mining)",
    ],
    "School of Nursing, Allied Health, and Biological Sciences (SONAHBS)": [
      "Bachelor of Science in Biology (BS Bio)",
      "Bachelor of Science in Medical Laboratory Science (BSMLS)",
      "Bachelor of Science in Nursing (BSN)",
      "Bachelor of Science in Pharmacy (BS Pharm)",
      "Bachelor of Science in Radiologic Technology (BS RadTech)",
    ],
    "School of Teacher Education and Liberal Arts (STELA)": [
      "Bachelor of Arts in Communication (AB Comm)",
      "Bachelor of Arts in Philosophy (AB Philo)",
      "Bachelor of Arts in Political Science (AB PolSci)",
      "Bachelor of Elementary Education (BEEd)",
      "Bachelor of Physical Education (BPEd)",
      "Bachelor of Science in Psychology (BS Psych)",
      "Bachelor of Secondary Education (BSEd)",
      "Bachelor of Special Needs Education (BSNEd)",
      "Bachelor of Science in Social Work (BSSW)",
    ],
    "School of Law (SOL)": [
      "Juris Doctor (JD)",
    ],
  },
  "University of the Philippines Baguio (UPB)": {
    "College of Arts and Communication (CAC)": [
      "Bachelor of Arts in Communication (BA Comm)",
      "Bachelor of Arts in Language and Literature (BA LangLit)",
      "Bachelor of Arts in Fine Arts (BAFA)",
    ],
    "College of Science (CS)": [
      "Bachelor of Science in Biology (BS Bio)",
      "Bachelor of Science in Computer Science (BSCS)",
      "Bachelor of Science in Mathematics (BS Math)",
      "Bachelor of Science in Physics (BS Physics)",
    ],
    "College of Social Sciences (CSS)": [
      "Bachelor of Arts in Anthropology (BA Anthro)",
      "Bachelor of Arts in History (BA History)",
      "Bachelor of Arts in Philosophy (BA Philo)",
      "Bachelor of Science in Social Work (BSSW)",
    ],
  },
  "University of Baguio (UB)": {
    "School of Business Administration and Accountancy (SBAA)": [
      "Bachelor of Science in Accountancy (BSA)",
      "Bachelor of Science in Business Administration (BSBA)",
    ],
    "School of Criminal Justice and Public Safety (SCJPS)": [
      "Bachelor of Science in Criminology (BSCrim)",
      "Bachelor of Science in Industrial Security Management (BSISM)",
    ],
    "School of Dentistry (SOD)": [
      "Doctor of Medicine in Dentistry (DMD)",
    ],
    "School of Engineering and Architecture (SEA)": [
      "Bachelor of Science in Architecture (BS Arch)",
      "Bachelor of Science in Civil Engineering (BSCE)",
      "Bachelor of Science in Electrical Engineering (BSEE)",
      "Bachelor of Science in Computer Engineering (BSCpE)",
      "Bachelor of Science in Mechanical Engineering (BSME)",
    ],
    "School of Information Technology (SIT)": [
      "Bachelor of Science in Information Technology (BSIT)",
      "Bachelor of Science in Computer Science (BSCS)",
    ],
    "School of International Tourism and Hospitality Management (SIHTM)": [
      "Bachelor of Science in International Tourism Management (BSITM)",
      "Bachelor of Science in Hospitality Management (BSHM)",
    ],
    "School of Natural Sciences (SNS)": [
      "Bachelor of Science in Medical Laboratory Science (BSMLS)",
      "Bachelor of Science in Nursing (BSN)",
      "Bachelor of Science in Pharmacy (BS Pharm)",
      "Bachelor of Science in Biology (BS Bio)",
    ],
  },
  "Benguet State University (BSU)": {
    "College of Agriculture (CA)": [
      "Bachelor of Science in Agriculture (BSA)",
    ],
    "College of Arts and Humanities (CAH)": [
      "Bachelor of Arts in Communication (BA Comm)",
      "Bachelor of Arts in English Language (BAEL)",
      "Bachelor of Arts in Filipino Language (BAFL)",
    ],
    "College of Engineering (CoE)": [
      "Bachelor of Science in Agricultural and Biosystems Engineering (BSABE)",
      "Bachelor of Science in Civil Engineering (BSCE)",
      "Bachelor of Science in Electrical Engineering (BSEE)",
      "Bachelor of Science in Industrial Engineering (BSIE)",
    ],
    "College of Forestry (CF)": [
      "Bachelor of Science in Forestry (BSF)",
    ],
    "College of Home Economics and Technology (CHET)": [
      "Bachelor of Science in Hospitality Management (BSHM)",
      "Bachelor of Science in Nutrition and Dietetics (BSND)",
      "Bachelor of Science in Entrepreneurship (BS Entrep)",
      "Bachelor of Science in Food Technology (BSFT)",
      "Bachelor of Science in Tourism Management (BSTM)",
    ],
    "College of Human Kinetics (CHK)": [
      "Bachelor of Science in Physical Education (BSPE)",
      "Bachelor of Science in Exercise and Sports Sciences (BSESS)",
    ],
    "College of Information Sciences (CIS)": [
      "Bachelor of Science in Development Communication (BSDC)",
      "Bachelor of Science in Information Technology (BSIT)",
      "Bachelor of Library and Information Science (BLIS)",
    ],
    "College of Natural Sciences (CNS)": [
      "Bachelor of Science in Biology (BS Bio)",
      "Bachelor of Science in Chemistry (BS Chem)",
      "Bachelor of Science in Environmental Science (BSES)",
    ],
    "College of Numeracy and Applied Sciences (CNAS)": [
      "Bachelor of Science in Statistics (BS Stat)",
      "Bachelor of Science in Mathematics (BS Math)",
    ],
    "College of Nursing (CON)": [
      "Bachelor of Science in Nursing (BSN)",
    ],
    "College of Public Administration and Governance (CPAG)": [
      "Bachelor of Public Administration (BPA)",
    ],
    "College of Social Sciences (CSS)": [
      "Bachelor of Science in Psychology (BS Psych)",
      "Bachelor of Arts in History (BA History)",
    ],
    "College of Teacher Education (CTE)": [
      "Bachelor of Early Childhood Education (BECEd)",
      "Bachelor of Elementary Education (BEEd)",
      "Bachelor of Secondary Education (BSEd)",
      "Bachelor of Technology and Livelihood Education (BTLEd)",
    ],
  },
  "University of the Cordilleras (UC)": {
    "College of Information Technology and Computer Science (CITCS)": [
      "Bachelor of Science in Information Technology (BSIT)",
      "Bachelor of Science in Computer Science (BSCS)",
      "Associate in Computer Technology (ACT)",
    ],
    "College of Accountancy (COA)": [
      "Bachelor of Science in Accountancy (BSA)",
      "Bachelor of Science in Management Accounting (BSMA)",
    ],
    "College of Business Administration (CBA)": [
      "Bachelor of Science in Business Administration (BSBA)",
      "Bachelor of Science in Entrepreneurship (BS Entrep)",
    ],
    "College of Criminal Justice Education (CCJE)": [
      "Bachelor of Science in Criminology (BSCrim)",
      "Bachelor of Science in Industrial Security Management (BSISM)",
    ],
    "College of Engineering and Architecture (CEA)": [
      "Bachelor of Science in Architecture (BS Arch)",
      "Bachelor of Science in Civil Engineering (BSCE)",
      "Bachelor of Science in Computer Engineering (BSCpE)",
      "Bachelor of Science in Electrical Engineering (BSEE)",
      "Bachelor of Science in Electronics Engineering (BSECE)",
      "Bachelor of Science in Mechanical Engineering (BSME)",
    ],
    "College of Arts and Sciences (CAS)": [
      "Bachelor of Arts in Communication (AB Comm)",
      "Bachelor of Arts in Political Science (AB PolSci)",
      "Bachelor of Science in Psychology (BS Psych)",
      "Bachelor of Science in Biology (BS Bio)",
      "Bachelor of Library and Information Science (BLIS)",
    ],
    "College of Teacher Education (CTE)": [
      "Bachelor of Early Childhood Education (BECEd)",
      "Bachelor of Elementary Education (BEEd)",
      "Bachelor of Secondary Education (BSEd)",
    ],
    "College of Hospitality and Tourism Management (CHTM)": [
      "Bachelor of Science in Hospitality Management (BSHM)",
      "Bachelor of Science in Tourism Management (BSTM)",
    ],
    "College of Nursing (CON)": [
      "Bachelor of Science in Nursing (BSN)",
    ],
  },
};

const GENDERS = [
  "Male",
  "Female",
  "Non-binary / Third gender",
  "Prefer to self-describe",
  "Prefer not to say",
];

const YEAR_LEVELS = [
  "1st Year",
  "2nd Year",
  "3rd Year",
  "4th Year",
  "5th Year",
  "Irregular",
];

const CITIZENSHIP_OPTIONS = [
  "Filipino (Natural-born)",
  "Filipino (Naturalized)",
  "Dual Citizen",
  "Foreign National",
];

/**
 * Generates an array of keywords from a string for Firestore searching.
 * Creates prefixes of each word. e.g., "John Doe" -> ["j", "jo", "joh", "john", "d", "do", "doe"]
 */
function generateKeywords(text: string): string[] {
  const keywords = new Set<string>();
  const words = text.toLowerCase().split(" ").filter(Boolean);

  for (const word of words) {
    for (let i = 1; i <= word.length; i++) {
      keywords.add(word.substring(0, i));
    }
  }

  return Array.from(keywords);
}

function getCollegeDepartments(college: string): string[] {
  const depts = COLLEGE_DEPARTMENTS[college];
  return depts ? Object.keys(depts) : [];
}

function getDepartmentPrograms(college: string, department: string): string[] {
  const depts = COLLEGE_DEPARTMENTS[college];
  return depts?.[department] || [];
}

/**
 * Strips all non-digit characters, enforces an 11-digit maximum, and inserts
 * separators as the user types (09XX XXX XXXX). Returns both the formatted
 * display value and the clean raw numeric value for storage.
 */
function formatPhilippineMobileNumber(input: string): {
  formattedValue: string;
  rawValue: string;
} {
  const cleaned = input.replace(/\D/g, "");
  const truncated = cleaned.slice(0, 11);

  let formatted = truncated;
  if (truncated.length > 4 && truncated.length <= 7) {
    formatted = `${truncated.slice(0, 4)} ${truncated.slice(4)}`;
  } else if (truncated.length > 7) {
    formatted = `${truncated.slice(0, 4)} ${truncated.slice(4, 7)} ${truncated.slice(7)}`;
  }

  return {
    formattedValue: formatted,
    rawValue: truncated,
  };
}

/**
 * Validates a Philippine mobile number: exactly 11 digits starting with "09".
 */
function validatePhoneNumber(number: string): boolean {
  const phMobileRegex = /^09\d{9}$/;
  return phMobileRegex.test(number);
}

function formatLsnCategory(category: string): string {
  if (category === "additional-needs") return "Students with Additional Needs";
  if (category === "disabilities") return "Students with Disabilities";
  return "None";
}

const FIELD_LABELS: Record<string, string> = {
  fullName: "Full Name",
  email: "Email Address",
  dateOfBirth: "Date of Birth",
  contactNo: "Mobile Number",
  schoolId: "School ID",
  college: "College",
  department: "Department",
  academicProgram: "Academic Program",
  yearLevel: "Year Level",
  nationality: "Nationality",
  citizenship: "Citizenship",
  civilStatus: "Civil Status",
  genderIdentity: "Gender Identity",
  provincialAddress: "Provincial Address",
};

const formatMissingFields = (missing: string[]): string => {
  return missing.map((key) => `• ${FIELD_LABELS[key] || key}`).join("\n");
};

/**
 * Dedicated document verification preview. Renders an image thumbnail for
 * image files or a document badge for PDFs, plus controls to replace or
 * remove the attachment before submission.
 */
function LsnDocumentPreview({
  lsnDocument,
  onReplace,
  onRemove,
  progress = 0,
}: {
  lsnDocument: DocumentPicker.DocumentPickerResult | null;
  onReplace: () => void;
  onRemove: () => void;
  progress?: number;
}) {
  if (!lsnDocument || lsnDocument.canceled) {
    return (
      <Pressable
        style={styles.uploadButton}
        onPress={onReplace}
        android_ripple={{ borderless: false, color: "rgba(124,58,237,0.15)" }}
      >
        <Ionicons name="cloud-upload-outline" size={22} color="#7C3AED" />
        <Text style={styles.uploadButtonText}>
          Select File (PDF, JPG, PNG)
        </Text>
      </Pressable>
    );
  }

  const asset = lsnDocument.assets[0];
  const isImage = asset.mimeType?.toLowerCase().startsWith("image/");
  const uploading = progress > 0 && progress < 100;

  return (
    <View style={styles.documentPreviewContainer}>
      {isImage ? (
        <Image source={{ uri: asset.uri }} style={styles.documentThumbnail} />
      ) : (
        <View style={styles.documentBadge}>
          <Ionicons name="document-text-outline" size={26} color="#7C3AED" />
        </View>
      )}
      <View style={styles.documentPreviewInfo}>
        <Text style={styles.fileName} numberOfLines={1}>
          {asset.name}
        </Text>
        {uploading ? (
          <View style={styles.progressBarContainer}>
            <View style={[styles.progressBar, { width: `${progress}%` }]} />
          </View>
        ) : (
          <Text style={styles.fileStatus}>
            {progress === 100 ? "✓ Uploaded" : "✓ Ready for verification"}
          </Text>
        )}
      </View>
      <Pressable
        style={styles.documentActionButton}
        onPress={onReplace}
        hitSlop={8}
      >
        <Ionicons name="refresh-outline" size={20} color="#7C3AED" />
      </Pressable>
      <Pressable
        style={styles.documentActionButton}
        onPress={onRemove}
        hitSlop={8}
      >
        <Ionicons name="trash-outline" size={20} color="#EF4444" />
      </Pressable>
    </View>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.reviewRow}>
      <Text style={styles.reviewRowLabel}>{label}</Text>
      <Text style={styles.reviewRowValue} numberOfLines={2}>
        {value || "—"}
      </Text>
    </View>
  );
}

export default function RegisterScreen() {
  const [activeTab, setActiveTab] = useState<1 | 2 | 3 | 4>(1);

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    schoolId: "",
    college: "",
    department: "",
    academicProgram: "",
    yearLevel: "",
    nationality: "",
    religiousAffiliation: "",
    culturalAffiliation: "",
    contactNo: "",
    civilStatus: "",
    citizenship: "",
    genderIdentity: "",
    dateOfBirth: "",
    provincialAddress: "",
    emergencyContactPerson: "",
  });

  const [mobileNumberDisplay, setMobileNumberDisplay] = useState("");

  const [lsnCategory, setLsnCategory] = useState<
    "" | "additional-needs" | "disabilities"
  >("");
  const [lsnDocumentChoice, setLsnDocumentChoice] = useState<
    "none" | "with-document"
  >("none");
  const [specialNeedsType, setSpecialNeedsType] = useState("");
  const [lsnDocument, setLsnDocument] =
    useState<DocumentPicker.DocumentPickerResult | null>(null);
  const [departmentSearch, setDepartmentSearch] = useState("");
  const [collegeSearch, setCollegeSearch] = useState("");
  const [programSearch, setProgramSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showPasswords, setShowPasswords] = useState(false);
  const [agreedToPolicy, setAgreedToPolicy] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [finalizing, setFinalizing] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [profileImageUri, setProfileImageUri] = useState<string | null>(null);
  const [profileImageUploading, setProfileImageUploading] = useState(false);
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);

  const resendTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (resendTimer.current) clearInterval(resendTimer.current);
    };
  }, []);

  const formatSchoolId = (text: string) => {
    const cleaned = text.replace(/\D/g, "");
    if (cleaned.length <= 2) {
      return cleaned;
    } else if (cleaned.length <= 6) {
      return `${cleaned.slice(0, 2)}-${cleaned.slice(2)}`;
    } else {
      return `${cleaned.slice(0, 2)}-${cleaned.slice(2, 6)}-${cleaned.slice(6, 9)}`;
    }
  };

  const handleDateOfBirthChange = (text: string) => {
    let digits = text.replace(/\D/g, "");
    if (digits.length >= 2) {
      let month = parseInt(digits.substring(0, 2), 10);
      if (month > 12) month = 12;
      if (month === 0) month = 1;
      digits = month.toString().padStart(2, "0") + digits.substring(2);
    }
    if (digits.length >= 4) {
      let day = parseInt(digits.substring(2, 4), 10);
      if (day > 31) day = 31;
      if (day === 0) day = 1;
      digits =
        digits.substring(0, 2) +
        day.toString().padStart(2, "0") +
        digits.substring(4);
    }

    let formattedDate = digits;
    if (digits.length > 4) {
      formattedDate = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
    } else if (digits.length > 2) {
      formattedDate = `${digits.slice(0, 2)}/${digits.slice(2)}`;
    }

    setFormData((prev) => ({ ...prev, dateOfBirth: formattedDate }));
  };

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "image/jpeg", "image/png"],
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const asset = result.assets[0];
      if (asset.size && asset.size > 10 * 1024 * 1024) {
        Alert.alert(
          "File Too Large",
          "File size exceeds the 10 MB limit. Please choose a smaller file.",
        );
        return;
      }

      setLsnDocument(result);
    } catch (err) {
      console.error("Error picking document:", err);
      Alert.alert("Error", "Could not pick the document. Please try again.");
    }
  };

  const uploadLsnDoc = async (
    asset: DocumentPicker.DocumentPickerAsset,
    onProgress: (pct: number) => void,
  ): Promise<{ secureUrl: string; publicId: string }> => {
    return uploadDocumentToCloudinary(asset.uri, asset.name, asset.mimeType || "application/pdf", undefined, onProgress);
  };

  const validateEmail = (email: string) => {
    const re =
      /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@(([^<>()[\]\\.,;:\s@\"]+\.)+[^<>()[\]\\.,;:\s@\"]{2,})$/i;
    return re.test(String(email).toLowerCase());
  };

  const validatePassword = (pw: string) => {
    return (
      pw.length >= 8 &&
      /[A-Z]/.test(pw) &&
      /[a-z]/.test(pw) &&
      /[0-9]/.test(pw) &&
      /[^A-Za-z0-9]/.test(pw)
    );
  };

  const sanitize = (value: string, maxLength = 256) => {
    return value.trim().slice(0, maxLength);
  };

  const collectMissingFields = (): string[] => {
    const missing: string[] = [];
    const checks: Array<[string, string]> = [
      ["fullName", formData.fullName],
      ["email", formData.email],
      ["dateOfBirth", formData.dateOfBirth],
      ["contactNo", formData.contactNo],
      ["schoolId", formData.schoolId],
      ["college", formData.college],
      ["department", formData.department],
      ["academicProgram", formData.academicProgram],
      ["yearLevel", formData.yearLevel],
      ["nationality", formData.nationality],
      ["citizenship", formData.citizenship],
      ["civilStatus", formData.civilStatus],
      ["genderIdentity", formData.genderIdentity],
      ["provincialAddress", formData.provincialAddress],
    ];
    for (const [key, value] of checks) {
      if (!value.trim()) missing.push(key);
    }
    return missing;
  };

  const validateTab = (tab: 1 | 2 | 3): boolean => {
    setError(null);
    setValidationErrors([]);

    if (tab === 1) {
      const missing = collectMissingFields().filter((key) =>
        ["fullName", "email", "dateOfBirth", "contactNo"].includes(key),
      );

      if (missing.length > 0) {
        setValidationErrors(missing);
        Alert.alert(
          "Missing Information",
          `Please fill in the following required Profile fields:\n\n${formatMissingFields(missing)}`,
        );
        return false;
      }
      if (!validateEmail(formData.email.toLowerCase())) {
        Alert.alert("Validation", "Please enter a valid email address.");
        return false;
      }
      if (!validatePhoneNumber(formData.contactNo)) {
        Alert.alert(
          "Validation",
          "Please enter a valid Philippine mobile number (e.g., 0912 345 6789).",
        );
        return false;
      }
      return true;
    }

    if (tab === 2) {
      const missing = collectMissingFields().filter((key) =>
        ["schoolId", "college", "department", "academicProgram", "yearLevel"].includes(key),
      );

      if (missing.length > 0) {
        setValidationErrors(missing);
        Alert.alert(
          "Missing Information",
          `Please fill in the following required School Information fields:\n\n${formatMissingFields(missing)}`,
        );
        return false;
      }
      return true;
    }

    const missing = collectMissingFields().filter((key) =>
      ["nationality", "citizenship", "civilStatus", "genderIdentity", "provincialAddress"].includes(key),
    );

    if (missing.length > 0) {
      setValidationErrors(missing);
      Alert.alert(
        "Missing Information",
        `Please fill in the following required Personal Information fields:\n\n${formatMissingFields(missing)}`,
      );
      return false;
    }
    if (
      lsnCategory !== "" &&
      lsnDocumentChoice === "with-document" &&
      (!lsnDocument || lsnDocument.canceled)
    ) {
      Alert.alert(
        "Validation",
        "Please upload a supporting document for LSN status.",
      );
      return false;
    }
    if (!agreedToPolicy) {
      Alert.alert(
        "Agreement Required",
        "You must agree to the Privacy Policy to create an account.",
      );
      return false;
    }
    return true;
  };

  const validateAllFields = (): boolean => {
    setError(null);
    setValidationErrors([]);

    const missing = collectMissingFields();
    if (missing.length > 0) {
      setValidationErrors(missing);
      Alert.alert(
        "Missing Information",
        `Please fill in all required fields before proceeding:\n\n${formatMissingFields(missing)}`,
      );
      return false;
    }
    if (!validateEmail(formData.email.toLowerCase())) {
      Alert.alert("Validation", "Please enter a valid email address.");
      return false;
    }
    if (!validatePhoneNumber(formData.contactNo)) {
      Alert.alert(
        "Validation",
        "Please enter a valid Philippine mobile number (e.g., 0912 345 6789).",
      );
      return false;
    }
    if (
      lsnCategory !== "" &&
      lsnDocumentChoice === "with-document" &&
      (!lsnDocument || lsnDocument.canceled)
    ) {
      Alert.alert(
        "Validation",
        "Please upload a supporting document for LSN status.",
      );
      return false;
    }
    if (!agreedToPolicy) {
      Alert.alert(
        "Agreement Required",
        "You must agree to the Privacy Policy to create an account.",
      );
      return false;
    }
    return true;
  };

  const handleNextTab = () => {
    if (activeTab === 4) return;
    if (!validateTab(activeTab as 1 | 2 | 3)) return;
    setActiveTab((activeTab + 1) as 1 | 2 | 3 | 4);
  };

  const handleGoToTab = (target: 1 | 2 | 3 | 4) => {
    if (target === activeTab) return;
    if (target < activeTab) {
      setActiveTab(target);
      return;
    }
    for (let tab = activeTab; tab < target; tab++) {
      if (!validateTab(tab as 1 | 2 | 3)) return;
    }
    setActiveTab(target);
  };

  const handleOpenConfirmation = () => {
    if (!validateAllFields()) return;
    setShowSummaryModal(true);
  };

  const handleProceedToPassword = () => {
    setShowSummaryModal(false);
    setShowConfirmModal(true);
  };

  const startResendCooldown = () => {
    setResendCooldown(45);
    if (resendTimer.current) clearInterval(resendTimer.current);
    resendTimer.current = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          if (resendTimer.current) clearInterval(resendTimer.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleRequestOtp = async () => {
    if (otpSending) return;
    const emailClean = sanitize(formData.email.toLowerCase(), 256);
    setOtpSending(true);
    setOtpError(null);
    try {
      const response = await fetch(
        `${API_URL}/api/auth/register-otp/request`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: emailClean }),
        },
      );
      const data = await response.json();
      if (!response.ok) {
        setOtpError(data.error || "Unable to send verification code.");
        Alert.alert(
          "Verification Error",
          data.error || "Unable to send verification code.",
        );
        return;
      }
      setShowConfirmModal(false);
      setShowOtpModal(true);
      startResendCooldown();
      Alert.alert(
        "Code Sent",
        "We've sent a 6-digit verification code to your email.",
      );
    } catch (err: any) {
      console.error("Request register OTP error:", err);
      setOtpError("Network error. Please check your connection and try again.");
      Alert.alert(
        "Network Error",
        "Unable to send verification code. Please check your connection.",
      );
    } finally {
      setOtpSending(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0 || otpSending) return;
    setOtpCode("");
    setOtpError(null);
    const emailClean = sanitize(formData.email.toLowerCase(), 256);
    setOtpSending(true);
    try {
      const response = await fetch(
        `${API_URL}/api/auth/register-otp/request`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: emailClean }),
        },
      );
      const data = await response.json();
      if (!response.ok) {
        setOtpError(data.error || "Unable to resend code.");
        return;
      }
      startResendCooldown();
      Alert.alert("Code Resent", "A new verification code has been sent to your email.");
    } catch (err: any) {
      console.error("Resend register OTP error:", err);
      setOtpError("Network error. Please try again.");
    } finally {
      setOtpSending(false);
    }
  };

  const handleConfirmPassword = async () => {
    if (!validateAllFields()) return;

    if (!validatePassword(password)) {
      Alert.alert(
        "Weak Password",
        "Password must be at least 8 characters and include an uppercase letter, a lowercase letter, a number, and a special character.",
      );
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert(
        "Passwords Do Not Match",
        "The passwords you entered do not match. Please try again.",
      );
      return;
    }

    await handleRequestOtp();
  };

  const handleVerifyOtp = async () => {
    setOtpError(null);
    const codeClean = otpCode.trim();
    if (!/^\d{6}$/.test(codeClean)) {
      setOtpError("Please enter the 6-digit code.");
      return;
    }
    const emailClean = sanitize(formData.email.toLowerCase(), 256);
    setOtpVerifying(true);
    try {
      const response = await fetch(
        `${API_URL}/api/auth/register-otp/verify`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: emailClean, otp: codeClean }),
        },
      );
      const data = await response.json();
      if (!response.ok) {
        setOtpError(data.error || "Unable to verify code.");
        return;
      }
      setShowOtpModal(false);
      setOtpCode("");
      await handleFinalizeAccountCreation();
    } catch (err: any) {
      console.error("Verify register OTP error:", err);
      setOtpError("Network error. Please try again.");
    } finally {
      setOtpVerifying(false);
    }
  };

  const handleFinalizeAccountCreation = async () => {
    if (finalizing) return;

    setFinalizing(true);
    const emailClean = sanitize(formData.email.toLowerCase(), 256);
    setLoading(true);

    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        emailClean,
        password,
      );
      const user = userCredential.user;

      let lsnDocumentData = null;
      let lsnUploadAttempted = false;
      if (
        lsnCategory !== "" &&
        lsnDocumentChoice === "with-document" &&
        lsnDocument &&
        !lsnDocument.canceled
      ) {
        lsnUploadAttempted = true;
        try {
          const netState = await NetInfo.fetch();
          if (!netState.isConnected) {
            console.warn("No internet for LSN file upload, saving profile without document");
          } else {
            const asset = lsnDocument.assets[0];
            const { secureUrl, publicId } = await uploadLsnDoc(
              asset,
              setUploadProgress,
            );

            lsnDocumentData = {
              fileName: asset.name,
              fileType: asset.mimeType,
              fileSize: asset.size,
              uploadedAt: new Date().toISOString(),
              publicId: publicId,
              secureUrl: secureUrl,
            };
          }
        } catch (uploadErr) {
          console.error("LSN file upload failed, saving profile without document:", uploadErr);
        }
      }

      // Upload profile image if selected
      let profileImageUrlFinal: string | null = null;
      if (profileImageUri) {
        try {
          setProfileImageUploading(true);
          profileImageUrlFinal = await uploadAvatarToCloudinary(profileImageUri);
          console.log("Profile image uploaded:", profileImageUrlFinal);
        } catch (uploadErr) {
          console.error("Profile image upload failed, continuing without it:", uploadErr);
        } finally {
          setProfileImageUploading(false);
        }
      }

      // Generate keywords for searching
      const nameKeywords = generateKeywords(sanitize(formData.fullName, 200));
      const emailKeywords = generateKeywords(emailClean.split("@")[0]);
      const keywords = Array.from(new Set([...nameKeywords, ...emailKeywords]));

      const profileData = {
        fullName: sanitize(formData.fullName, 200),
        email: emailClean,
        schoolId: sanitize(formData.schoolId.replace(/[^0-9-]/g, ""), 20),
        college: sanitize(formData.college, 150),
        department: sanitize(formData.department, 150),
        academicProgram: sanitize(formData.academicProgram, 100),
        yearLevel: sanitize(formData.yearLevel, 50),
        nationality: sanitize(formData.nationality, 50),
        religiousAffiliation: sanitize(formData.religiousAffiliation, 100),
        culturalAffiliation: sanitize(formData.culturalAffiliation, 100),
        contactNo: sanitize(formData.contactNo, 20),
        emergencyContactPerson: sanitize(formData.emergencyContactPerson, 200),
        civilStatus: sanitize(formData.civilStatus, 50),
        citizenship: sanitize(formData.citizenship, 50),
        genderIdentity: sanitize(formData.genderIdentity, 50),
        dateOfBirth: formData.dateOfBirth,
        provincialAddress: sanitize(formData.provincialAddress, 500),
        createdAt: new Date().toISOString(),
        profileImage: profileImageUrlFinal,
        isLSN: lsnCategory !== "",
        lsnCategory,
        specialNeedsType:
          lsnCategory !== "" ? sanitize(specialNeedsType, 150) : "",
        lsnDocument: lsnDocumentData,
        role: "student",
        keywords,
      } as Record<string, any>;

      await createUserDocument(user.uid, profileData);

      if (lsnUploadAttempted && lsnDocumentData === null) {
        Alert.alert(
          "Account Created",
          "Your account was created, but your LSN document could not be uploaded. You can submit it later through your profile or contact your guidance office.",
        );
      }

      router.replace("/(student)/(tabs)/dashboard");
    } catch (err: any) {
      setShowOtpModal(true);
      console.error("Registration error", err);
      let errorMessage = "An unexpected error occurred during registration.";
      if (err.code === "auth/email-already-in-use") {
        errorMessage =
          "This email address is already in use by another account.";
      } else if (err.code === "auth/invalid-email") {
        errorMessage =
          "The email address is not valid. Please check and try again.";
      } else if (err.code === "auth/weak-password") {
        errorMessage =
          "The password is too weak. Please choose a stronger password.";
      }
      Alert.alert("Registration Error", errorMessage);
      setError(err?.message || "Registration failed");
    } finally {
      setFinalizing(false);
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1 }}
    >
    <SafeAreaView style={styles.container}>
      <View style={styles.mainLayout}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color="#0F172A" />
          </Pressable>
          <Text style={styles.headerTitle}>Create New Account</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          style={styles.scrollContainer}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Tab Navigation Header */}
          <View style={styles.tabNavContainer}>
            <Pressable
              style={[
                styles.tabNavItem,
                activeTab === 1 && styles.tabNavItemActive,
              ]}
              onPress={() => handleGoToTab(1)}
            >
              <View
                style={[
                  styles.tabBadge,
                  activeTab === 1 && styles.tabBadgeActive,
                ]}
              >
                <Text
                  style={[
                    styles.tabBadgeText,
                    activeTab === 1 && styles.tabBadgeTextActive,
                  ]}
                >
                  1
                </Text>
              </View>
              <Text
                style={[
                  styles.tabNavText,
                  activeTab === 1 && styles.tabNavTextActive,
                ]}
              >
                Profile
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.tabNavItem,
                activeTab === 2 && styles.tabNavItemActive,
              ]}
              onPress={() => handleGoToTab(2)}
            >
              <View
                style={[
                  styles.tabBadge,
                  activeTab === 2 && styles.tabBadgeActive,
                ]}
              >
                <Text
                  style={[
                    styles.tabBadgeText,
                    activeTab === 2 && styles.tabBadgeTextActive,
                  ]}
                >
                  2
                </Text>
              </View>
              <Text
                style={[
                  styles.tabNavText,
                  activeTab === 2 && styles.tabNavTextActive,
                ]}
              >
                School Info
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.tabNavItem,
                activeTab === 3 && styles.tabNavItemActive,
              ]}
              onPress={() => handleGoToTab(3)}
            >
              <View
                style={[
                  styles.tabBadge,
                  activeTab === 3 && styles.tabBadgeActive,
                ]}
              >
                <Text
                  style={[
                    styles.tabBadgeText,
                    activeTab === 3 && styles.tabBadgeTextActive,
                  ]}
                >
                  3
                </Text>
              </View>
              <Text
                style={[
                  styles.tabNavText,
                  activeTab === 3 && styles.tabNavTextActive,
                ]}
              >
                Personal Info
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.tabNavItem,
                activeTab === 4 && styles.tabNavItemActive,
              ]}
              onPress={() => handleGoToTab(4)}
            >
              <View
                style={[
                  styles.tabBadge,
                  activeTab === 4 && styles.tabBadgeActive,
                ]}
              >
                <Text
                  style={[
                    styles.tabBadgeText,
                    activeTab === 4 && styles.tabBadgeTextActive,
                  ]}
                >
                  4
                </Text>
              </View>
              <Text
                style={[
                  styles.tabNavText,
                  activeTab === 4 && styles.tabNavTextActive,
                ]}
              >
                Review
              </Text>
            </Pressable>
          </View>

          {/* Form Card Container */}
          <View style={styles.formCard}>
            {/* ──────── TAB 1: PROFILE ──────── */}
            {activeTab === 1 && (
              <View>
                <Text style={styles.stepTitle}>Step 1: Your Profile</Text>
                <AccessibleText
                  text="Enter your core contact and personal details."
                  style={styles.stepSubtitle}
                />

                {/* Profile Image Picker */}
                <View style={styles.avatarSection}>
                  <Pressable
                    onPress={async () => {
                      if (profileImageUploading) return;
                      const uri = await pickProfileImage();
                      if (uri) setProfileImageUri(uri);
                    }}
                    style={styles.avatarPressable}
                  >
                    <View style={styles.avatarCircle}>
                      {profileImageUri ? (
                        <Image source={{ uri: profileImageUri }} style={styles.avatarImage} />
                      ) : (
                        <Ionicons name="person" size={36} color="#94A3B8" />
                      )}
                      <View style={styles.avatarOverlay}>
                        <Ionicons name="camera" size={18} color="white" />
                      </View>
                    </View>
                    <Text style={styles.avatarLabel}>Optional: Tap to add profile photo</Text>
                  </Pressable>
                </View>

                <View style={styles.inputContainer}>
                  <View style={styles.inputHeader}>
                    <Ionicons name="person-outline" size={18} color="#64748B" />
                    <Text style={styles.inputLabel}>Full Name *</Text>
                  </View>
                  <TextInput
                    style={[
                      styles.input,
                      validationErrors.includes("fullName") &&
                        styles.inputError,
                    ]}
                    placeholder="Enter your full name"
                    placeholderTextColor="#94A3B8"
                    value={formData.fullName}
                    onChangeText={(text) => {
                      setFormData((prev) => ({ ...prev, fullName: text }));
                      if (validationErrors.includes("fullName"))
                        setValidationErrors((p) =>
                          p.filter((k) => k !== "fullName"),
                        );
                    }}
                    autoCapitalize="words"
                  />
                  {validationErrors.includes("fullName") ? <Text style={styles.fieldError}>Full name is required</Text> : null}
                </View>

                <View style={styles.inputContainer}>
                  <View style={styles.inputHeader}>
                    <Ionicons name="mail-outline" size={18} color="#64748B" />
                    <Text style={styles.inputLabel}>Email Address *</Text>
                  </View>
                  <TextInput
                    style={[
                      styles.input,
                      validationErrors.includes("email") && styles.inputError,
                    ]}
                    placeholder="Enter your email address"
                    placeholderTextColor="#94A3B8"
                    value={formData.email}
                    onChangeText={(text) => {
                      setFormData((prev) => ({ ...prev, email: text }));
                      if (validationErrors.includes("email"))
                        setValidationErrors((p) =>
                          p.filter((k) => k !== "email"),
                        );
                    }}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                  {validationErrors.includes("email") ? <Text style={styles.fieldError}>Valid email is required</Text> : null}
                </View>

                <View style={styles.inputContainer}>
                  <View style={styles.inputHeader}>
                    <Ionicons
                      name="calendar-outline"
                      size={18}
                      color="#64748B"
                    />
                    <Text style={styles.inputLabel}>Date of Birth *</Text>
                  </View>
                  <TextInput
                    style={[
                      styles.input,
                      validationErrors.includes("dateOfBirth") &&
                        styles.inputError,
                    ]}
                    placeholder="MM/DD/YYYY"
                    placeholderTextColor="#94A3B8"
                    value={formData.dateOfBirth}
                    onChangeText={(text) => {
                      handleDateOfBirthChange(text);
                      if (validationErrors.includes("dateOfBirth"))
                        setValidationErrors((p) =>
                          p.filter((k) => k !== "dateOfBirth"),
                        );
                    }}
                    keyboardType="number-pad"
                    maxLength={10}
                  />
                  {validationErrors.includes("dateOfBirth") ? <Text style={styles.fieldError}>Date of birth is required</Text> : null}
                </View>

                <View style={styles.inputContainer}>
                  <View style={styles.inputHeader}>
                    <Ionicons name="call-outline" size={18} color="#64748B" />
                    <Text style={styles.inputLabel}>
                      Phone Number / Contact No *
                    </Text>
                  </View>
                  <TextInput
                    style={[
                      styles.input,
                      validationErrors.includes("contactNo") &&
                        styles.inputError,
                    ]}
                    placeholder="0912 345 6789"
                    placeholderTextColor="#94A3B8"
                    value={mobileNumberDisplay}
                    onChangeText={(text) => {
                      const { formattedValue, rawValue } =
                        formatPhilippineMobileNumber(text);
                      setMobileNumberDisplay(formattedValue);
                      setFormData((prev) => ({
                        ...prev,
                        contactNo: rawValue,
                      }));
                      if (validationErrors.includes("contactNo"))
                        setValidationErrors((p) =>
                          p.filter((k) => k !== "contactNo"),
                        );
                    }}
                    keyboardType="phone-pad"
                    maxLength={13}
                  />
                  {validationErrors.includes("contactNo") ? <Text style={styles.fieldError}>Phone number is required</Text> : null}
                </View>

                <Pressable
                  style={styles.nextStepButton}
                  onPress={handleNextTab}
                  android_ripple={{ borderless: false, color: "rgba(124,58,237,0.15)" }}
                >
                  <Text style={styles.nextStepButtonText}>
                    Next: School Info
                  </Text>
                  <Ionicons name="arrow-forward" size={18} color="white" />
                </Pressable>
              </View>
            )}

            {/* ──────── TAB 2: SCHOOL INFORMATION ──────── */}
            {activeTab === 2 && (
              <View>
                <Text style={styles.stepTitle}>Step 2: School Information</Text>
                <AccessibleText
                  text="Provide your academic credentials and program."
                  style={styles.stepSubtitle}
                />

                <View style={styles.inputContainer}>
                  <View style={styles.inputHeader}>
                    <Ionicons name="card-outline" size={18} color="#64748B" />
                    <Text style={styles.inputLabel}>School ID Number *</Text>
                  </View>
                  <TextInput
                    style={[
                      styles.input,
                      validationErrors.includes("schoolId") &&
                        styles.inputError,
                    ]}
                    placeholder="XX-XXXX-XXX"
                    placeholderTextColor="#94A3B8"
                    value={formData.schoolId}
                    onChangeText={(text) => {
                      setFormData((prev) => ({
                        ...prev,
                        schoolId: formatSchoolId(text),
                      }));
                      if (validationErrors.includes("schoolId"))
                        setValidationErrors((p) =>
                          p.filter((k) => k !== "schoolId"),
                        );
                    }}
                    keyboardType="numeric"
                    maxLength={11}
                  />
                  {validationErrors.includes("schoolId") ? <Text style={styles.fieldError}>School ID is required</Text> : null}
                </View>

                <View style={styles.inputContainer}>
                  <View style={styles.inputHeader}>
                    <Ionicons name="business-outline" size={18} color="#64748B" />
                    <Text style={styles.inputLabel}>College / University *</Text>
                  </View>
                  <TextInput
                    style={[
                      styles.input,
                      validationErrors.includes("college") && styles.inputError,
                    ]}
                    placeholder="Search college..."
                    placeholderTextColor="#94A3B8"
                    value={formData.college ? formData.college : collegeSearch}
                    editable={!formData.college}
                    onChangeText={(text) => setCollegeSearch(text)}
                  />
                  {!formData.college && !!collegeSearch && (
                    <View style={styles.dropdownContainer}>
                      {COLLEGES.filter((c) =>
                        c.toLowerCase().includes(collegeSearch.toLowerCase()),
                      )
                        .slice(0, 8)
                        .map((college) => (
                          <Pressable
                            key={college}
                            style={styles.dropdownOption}
                            onPress={() => {
                              setFormData((prev) => ({
                                ...prev,
                                college,
                                department: "",
                                academicProgram: "",
                              }));
                              setCollegeSearch("");
                              if (validationErrors.includes("college"))
                                setValidationErrors((p) => p.filter((k) => k !== "college"));
                            }}
                          >
                            <Text style={styles.dropdownText}>{college}</Text>
                          </Pressable>
                        ))}
                    </View>
                  )}
                  {formData.college && (
                    <View style={styles.selectedTag}>
                      <Text style={styles.selectedTagText}>{formData.college}</Text>
                      <Pressable
                        onPress={() =>
                          setFormData((prev) => ({
                            ...prev,
                            college: "",
                            department: "",
                            academicProgram: "",
                          }))
                        }
                      >
                        <Ionicons name="close-circle" size={18} color="white" />
                      </Pressable>
                    </View>
                  )}
                  {validationErrors.includes("college") ? <Text style={styles.fieldError}>College is required</Text> : null}
                </View>

                <View style={styles.inputContainer}>
                  <View style={styles.inputHeader}>
                    <Ionicons name="school-outline" size={18} color="#64748B" />
                    <Text style={styles.inputLabel}>Department *</Text>
                  </View>
                  {(() => {
                    const hasDepts = formData.college && COLLEGE_DEPARTMENTS[formData.college];
                    if (hasDepts) {
                      return (
                        <>
                          <TextInput
                            style={[
                              styles.input,
                              validationErrors.includes("department") &&
                                styles.inputError,
                            ]}
                            placeholder="Search department..."
                            placeholderTextColor="#94A3B8"
                            value={
                              formData.department
                                ? formData.department
                                : departmentSearch
                            }
                            editable={!formData.department}
                            onChangeText={(text) => setDepartmentSearch(text)}
                          />
                          {!formData.department && !!departmentSearch && (
                            <View style={styles.dropdownContainer}>
                              {Object.keys(COLLEGE_DEPARTMENTS[formData.college] || {})
                                .filter((d) =>
                                  d
                                    .toLowerCase()
                                    .includes(departmentSearch.toLowerCase()),
                                )
                                .slice(0, 5)
                                .map((dept) => (
                                  <Pressable
                                    key={dept}
                                    style={styles.dropdownOption}
                                    onPress={() => {
                                      setFormData((prev) => ({
                                        ...prev,
                                        department: dept,
                                        academicProgram: "",
                                      }));
                                      setDepartmentSearch("");
                                      if (validationErrors.includes("department"))
                                        setValidationErrors((p) =>
                                          p.filter((k) => k !== "department"),
                                        );
                                    }}
                                  >
                                    <Text style={styles.dropdownText}>{dept}</Text>
                                  </Pressable>
                                ))}
                            </View>
                          )}
                        </>
                      );
                    }
                    return (
                      <TextInput
                        style={[
                          styles.input,
                          validationErrors.includes("department") &&
                            styles.inputError,
                        ]}
                        placeholder="Type your department..."
                        placeholderTextColor="#94A3B8"
                        value={
                          formData.department
                            ? formData.department
                            : departmentSearch
                        }
                        onChangeText={(text) => {
                          setDepartmentSearch(text);
                          setFormData((prev) => ({
                            ...prev,
                            department: text,
                            academicProgram: "",
                          }));
                        }}
                      />
                    );
                  })()}
                  {formData.department && (
                    <View style={styles.selectedTag}>
                      <Text style={styles.selectedTagText}>
                        {formData.department}
                      </Text>
                      <Pressable
                        onPress={() =>
                          setFormData((prev) => ({
                            ...prev,
                            department: "",
                            academicProgram: "",
                          }))
                        }
                      >
                        <Ionicons name="close-circle" size={18} color="white" />
                      </Pressable>
                    </View>
                  )}
                  {validationErrors.includes("department") ? <Text style={styles.fieldError}>Department is required</Text> : null}
                </View>

                <View style={styles.inputContainer}>
                  <View style={styles.inputHeader}>
                    <Ionicons name="book-outline" size={18} color="#64748B" />
                    <Text style={styles.inputLabel}>
                      Academic Program / Course *
                    </Text>
                  </View>
                  {!formData.college ? (
                    <Text style={styles.helpText}>
                      Please select a college first
                    </Text>
                  ) : !formData.department ? (
                    <Text style={styles.helpText}>
                      Please search and select a department
                    </Text>
                  ) : (() => {
                    const hasPrograms = getDepartmentPrograms(formData.college, formData.department)?.length > 0;
                    if (hasPrograms) {
                      return (
                        <>
                          <TextInput
                            style={[
                              styles.input,
                              validationErrors.includes("academicProgram") &&
                                styles.inputError,
                            ]}
                            placeholder="Search program..."
                            placeholderTextColor="#94A3B8"
                            value={
                              formData.academicProgram
                                ? formData.academicProgram
                                : programSearch
                            }
                            editable={!formData.academicProgram}
                            onChangeText={(text) => setProgramSearch(text)}
                          />
                          {!formData.academicProgram && !!programSearch && (
                            <View style={styles.dropdownContainer}>
                              {getDepartmentPrograms(formData.college, formData.department)
                                ?.filter((p) =>
                                  p
                                    .toLowerCase()
                                    .includes(programSearch.toLowerCase()),
                                )
                                .slice(0, 8)
                                .map((program) => (
                                  <Pressable
                                    key={program}
                                    style={styles.dropdownOption}
                                    onPress={() => {
                                      setFormData((prev) => ({
                                        ...prev,
                                        academicProgram: program,
                                      }));
                                      setProgramSearch("");
                                      if (
                                        validationErrors.includes("academicProgram")
                                      )
                                        setValidationErrors((p) =>
                                          p.filter(
                                            (k) => k !== "academicProgram",
                                          ),
                                        );
                                    }}
                                  >
                                    <Text style={styles.dropdownText}>
                                      {program}
                                    </Text>
                                  </Pressable>
                                ))}
                            </View>
                          )}
                          {formData.academicProgram && (
                            <View style={styles.selectedTag}>
                              <Text style={styles.selectedTagText}>
                                {formData.academicProgram}
                              </Text>
                              <Pressable
                                onPress={() =>
                                  setFormData((prev) => ({
                                    ...prev,
                                    academicProgram: "",
                                  }))
                                }
                              >
                                <Ionicons
                                  name="close-circle"
                                  size={18}
                                  color="white"
                                />
                              </Pressable>
                            </View>
                          )}
                        </>
                      );
                    }
                    return (
                      <>
                        <TextInput
                          style={[
                            styles.input,
                            validationErrors.includes("academicProgram") &&
                              styles.inputError,
                          ]}
                          placeholder="Type your program..."
                          placeholderTextColor="#94A3B8"
                          value={
                            formData.academicProgram
                              ? formData.academicProgram
                              : programSearch
                          }
                          onChangeText={(text) => {
                            setProgramSearch(text);
                            setFormData((prev) => ({
                              ...prev,
                              academicProgram: text,
                            }));
                          }}
                        />
                        {formData.academicProgram && (
                          <View style={styles.selectedTag}>
                            <Text style={styles.selectedTagText}>
                              {formData.academicProgram}
                            </Text>
                            <Pressable
                              onPress={() =>
                                setFormData((prev) => ({
                                  ...prev,
                                  academicProgram: "",
                                }))
                              }
                            >
                              <Ionicons
                                name="close-circle"
                                size={18}
                                color="white"
                              />
                            </Pressable>
                          </View>
                        )}
                      </>
                    );
                  })()}
                  {validationErrors.includes("academicProgram") ? <Text style={styles.fieldError}>Please select a program</Text> : null}
                </View>

                <View style={styles.inputContainer}>
                  <View style={styles.inputHeader}>
                    <Ionicons
                      name="library-outline"
                      size={18}
                      color="#64748B"
                    />
                    <Text style={styles.inputLabel}>Year Level *</Text>
                  </View>
                  <View style={styles.optionsWrap}>
                    {YEAR_LEVELS.map((year) => (
                      <Pressable
                        key={year}
                        style={[
                          styles.listOption,
                          formData.yearLevel === year &&
                            styles.listOptionSelected,
                        ]}
                        onPress={() => {
                          setFormData((prev) => ({ ...prev, yearLevel: year }));
                          if (validationErrors.includes("yearLevel"))
                            setValidationErrors((p) =>
                              p.filter((k) => k !== "yearLevel"),
                            );
                        }}
                      >
                        <Text
                          style={[
                            styles.listOptionText,
                            formData.yearLevel === year &&
                              styles.listOptionSelectedText,
                          ]}
                        >
                          {year}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  {validationErrors.includes("yearLevel") ? <Text style={styles.fieldError}>Please select a year level</Text> : null}
                </View>

                <View style={styles.stepButtonRow}>
                  <Pressable
                    style={styles.prevStepButton}
                    onPress={() => setActiveTab(1)}
                    android_ripple={{ borderless: false, color: "rgba(124,58,237,0.15)" }}
                  >
                    <Ionicons name="arrow-back" size={18} color="#334155" />
                    <Text style={styles.prevStepButtonText}>Back</Text>
                  </Pressable>
                  <Pressable
                    style={styles.nextStepButton}
                    onPress={handleNextTab}
                    android_ripple={{ borderless: false, color: "rgba(124,58,237,0.15)" }}
                  >
                    <Text style={styles.nextStepButtonText}>
                      Next: Personal Info
                    </Text>
                    <Ionicons name="arrow-forward" size={18} color="white" />
                  </Pressable>
                </View>
              </View>
            )}

            {/* ──────── TAB 3: PERSONAL INFORMATION & OTHERS ──────── */}
            {activeTab === 3 && (
              <View>
                <Text style={styles.stepTitle}>
                  Step 3: Personal Information
                </Text>
                <AccessibleText
                  text="Additional background, demographics, and support needs."
                  style={styles.stepSubtitle}
                />

                <View style={styles.inputContainer}>
                  <View style={styles.inputHeader}>
                    <Ionicons name="flag-outline" size={18} color="#64748B" />
                    <Text style={styles.inputLabel}>Nationality *</Text>
                  </View>
                  <TextInput
                    style={[
                      styles.input,
                      validationErrors.includes("nationality") &&
                        styles.inputError,
                    ]}
                    placeholder="Enter your nationality"
                    placeholderTextColor="#94A3B8"
                    value={formData.nationality}
                    onChangeText={(text) => {
                      setFormData((prev) => ({ ...prev, nationality: text }));
                      if (validationErrors.includes("nationality"))
                        setValidationErrors((p) =>
                          p.filter((k) => k !== "nationality"),
                        );
                    }}
                    autoCapitalize="words"
                  />
                  {validationErrors.includes("nationality") ? <Text style={styles.fieldError}>Nationality is required</Text> : null}
                </View>

                <View style={styles.inputContainer}>
                  <View style={styles.inputHeader}>
                    <Ionicons
                      name="document-outline"
                      size={18}
                      color="#64748B"
                    />
                    <Text style={styles.inputLabel}>Citizenship *</Text>
                  </View>
                  <View style={styles.optionsWrap}>
                    {CITIZENSHIP_OPTIONS.map((option) => (
                      <Pressable
                        key={option}
                        style={[
                          styles.listOption,
                          formData.citizenship === option &&
                            styles.listOptionSelected,
                        ]}
                        onPress={() => {
                          setFormData((prev) => ({
                            ...prev,
                            citizenship: option,
                          }));
                          if (validationErrors.includes("citizenship"))
                            setValidationErrors((p) =>
                              p.filter((k) => k !== "citizenship"),
                            );
                        }}
                      >
                        <Text
                          style={[
                            styles.listOptionText,
                            formData.citizenship === option &&
                              styles.listOptionSelectedText,
                          ]}
                        >
                          {option}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  {validationErrors.includes("citizenship") ? <Text style={styles.fieldError}>Citizenship is required</Text> : null}
                </View>

                <View style={styles.inputContainer}>
                  <View style={styles.inputHeader}>
                    <Ionicons name="people-outline" size={18} color="#64748B" />
                    <Text style={styles.inputLabel}>Civil Status *</Text>
                  </View>
                  <View style={styles.optionsWrap}>
                    {[
                      "Single",
                      "Married",
                      "Divorced",
                      "Annulled",
                      "Widowed",
                    ].map((status) => (
                      <Pressable
                        key={status}
                        style={[
                          styles.listOption,
                          formData.civilStatus === status &&
                            styles.listOptionSelected,
                        ]}
                        onPress={() => {
                          setFormData((prev) => ({
                            ...prev,
                            civilStatus: status,
                          }));
                          if (validationErrors.includes("civilStatus"))
                            setValidationErrors((p) =>
                              p.filter((k) => k !== "civilStatus"),
                            );
                        }}
                      >
                        <Text
                          style={[
                            styles.listOptionText,
                            formData.civilStatus === status &&
                              styles.listOptionSelectedText,
                          ]}
                        >
                          {status}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  {validationErrors.includes("civilStatus") ? <Text style={styles.fieldError}>Civil status is required</Text> : null}
                </View>

                <View style={styles.inputContainer}>
                  <View style={styles.inputHeader}>
                    <Ionicons
                      name="person-circle-outline"
                      size={18}
                      color="#64748B"
                    />
                    <Text style={styles.inputLabel}>Gender Identity *</Text>
                  </View>
                  <View style={styles.optionsWrap}>
                    {GENDERS.map((gender) => (
                      <Pressable
                        key={gender}
                        style={[
                          styles.listOption,
                          formData.genderIdentity === gender &&
                            styles.listOptionSelected,
                        ]}
                        onPress={() => {
                          setFormData((prev) => ({
                            ...prev,
                            genderIdentity: gender,
                          }));
                          if (validationErrors.includes("genderIdentity"))
                            setValidationErrors((p) =>
                              p.filter((k) => k !== "genderIdentity"),
                            );
                        }}
                      >
                        <Text
                          style={[
                            styles.listOptionText,
                            formData.genderIdentity === gender &&
                              styles.listOptionSelectedText,
                          ]}
                        >
                          {gender}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  {validationErrors.includes("genderIdentity") ? <Text style={styles.fieldError}>Gender identity is required</Text> : null}
                </View>

                <View style={styles.inputContainer}>
                  <View style={styles.inputHeader}>
                    <Ionicons name="book-outline" size={18} color="#64748B" />
                    <Text style={styles.inputLabel}>Religious Affiliation</Text>
                  </View>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter your religious affiliation"
                    placeholderTextColor="#94A3B8"
                    value={formData.religiousAffiliation}
                    onChangeText={(text) =>
                      setFormData((prev) => ({
                        ...prev,
                        religiousAffiliation: text,
                      }))
                    }
                    autoCapitalize="words"
                  />
                </View>

                <View style={styles.inputContainer}>
                  <View style={styles.inputHeader}>
                    <Ionicons name="globe-outline" size={18} color="#64748B" />
                    <Text style={styles.inputLabel}>Cultural Affiliation</Text>
                  </View>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter your cultural affiliation"
                    placeholderTextColor="#94A3B8"
                    value={formData.culturalAffiliation}
                    onChangeText={(text) =>
                      setFormData((prev) => ({
                        ...prev,
                        culturalAffiliation: text,
                      }))
                    }
                    autoCapitalize="words"
                  />
                </View>

                <View style={styles.inputContainer}>
                  <View style={styles.inputHeader}>
                    <Ionicons
                      name="location-outline"
                      size={18}
                      color="#64748B"
                    />
                    <Text style={styles.inputLabel}>Provincial Address *</Text>
                  </View>
                  <TextInput
                    style={[
                      styles.input,
                      { minHeight: 80, textAlignVertical: "top" },
                      validationErrors.includes("provincialAddress") &&
                        styles.inputError,
                    ]}
                    placeholder="Enter your provincial address"
                    placeholderTextColor="#94A3B8"
                    value={formData.provincialAddress}
                    onChangeText={(text) => {
                      setFormData((prev) => ({
                        ...prev,
                        provincialAddress: text,
                      }));
                      if (validationErrors.includes("provincialAddress"))
                        setValidationErrors((p) =>
                          p.filter((k) => k !== "provincialAddress"),
                        );
                    }}
                    autoCapitalize="words"
                    multiline={true}
                    numberOfLines={2}
                  />
                  {validationErrors.includes("provincialAddress") ? <Text style={styles.fieldError}>Address is required</Text> : null}
                </View>

                <View style={styles.inputContainer}>
                  <View style={styles.inputHeader}>
                    <Ionicons
                      name="help-buoy-outline"
                      size={18}
                      color="#64748B"
                    />
                    <Text style={styles.inputLabel}>
                      Emergency Contact Person
                    </Text>
                  </View>
                  <TextInput
                    style={styles.input}
                    placeholder="Name and contact number"
                    placeholderTextColor="#94A3B8"
                    value={formData.emergencyContactPerson}
                    onChangeText={(text) =>
                      setFormData((prev) => ({
                        ...prev,
                        emergencyContactPerson: text,
                      }))
                    }
                    autoCapitalize="words"
                  />
                </View>

                {/* LSN Section */}
                <View style={styles.inputContainer}>
                  <View style={styles.inputHeader}>
                    <Ionicons name="body-outline" size={18} color="#64748B" />
                    <Text style={styles.inputLabel}>
                      Learner with Special Needs (LSN)
                    </Text>
                  </View>

                  <Text style={styles.subFieldLabel}>
                    LSN Classification *
                  </Text>
                  <View style={styles.lsnOptionContainer}>
                    <Pressable
                      style={[
                        styles.radioOption,
                        lsnCategory === "additional-needs" &&
                          styles.radioOptionSelected,
                      ]}
                      onPress={() => {
                        setLsnCategory("additional-needs");
                        if (lsnCategory === "") setLsnDocumentChoice("none");
                      }}
                    >
                      <View style={styles.radioOuter}>
                        {lsnCategory === "additional-needs" && (
                          <View style={styles.radioInner} />
                        )}
                      </View>
                      <Text
                        style={[
                          styles.radioOptionText,
                          lsnCategory === "additional-needs" &&
                            styles.radioOptionTextSelected,
                        ]}
                      >
                        Students with Additional Needs
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[
                        styles.radioOption,
                        lsnCategory === "disabilities" &&
                          styles.radioOptionSelected,
                      ]}
                      onPress={() => {
                        setLsnCategory("disabilities");
                        if (lsnCategory === "") setLsnDocumentChoice("none");
                      }}
                    >
                      <View style={styles.radioOuter}>
                        {lsnCategory === "disabilities" && (
                          <View style={styles.radioInner} />
                        )}
                      </View>
                      <Text
                        style={[
                          styles.radioOptionText,
                          lsnCategory === "disabilities" &&
                            styles.radioOptionTextSelected,
                        ]}
                      >
                        Students with Disabilities
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[
                        styles.radioOption,
                        lsnCategory === "" && styles.radioOptionSelected,
                      ]}
                      onPress={() => {
                        setLsnCategory("");
                        setLsnDocumentChoice("none");
                        setLsnDocument(null);
                        setUploadProgress(0);
                      }}
                    >
                      <View style={styles.radioOuter}>
                        {lsnCategory === "" && (
                          <View style={styles.radioInner} />
                        )}
                      </View>
                      <Text
                        style={[
                          styles.radioOptionText,
                          lsnCategory === "" && styles.radioOptionTextSelected,
                        ]}
                      >
                        None (not a Learner with Special Needs)
                      </Text>
                    </Pressable>
                  </View>
                </View>

                {lsnCategory !== "" && (
                  <View style={styles.conditionalSection}>
                    <View style={styles.inputContainer}>
                      <View style={styles.inputHeader}>
                        <Ionicons
                          name="information-circle-outline"
                          size={18}
                          color="#64748B"
                        />
                        <Text style={styles.inputLabel}>
                          Type of Special Need (Optional)
                        </Text>
                      </View>
                      <TextInput
                        style={styles.input}
                        placeholder="e.g., Visual Impairment, Dyslexia"
                        placeholderTextColor="#94A3B8"
                        value={specialNeedsType}
                        onChangeText={setSpecialNeedsType}
                      />
                    </View>

                    <View style={styles.inputContainer}>
                      <View style={styles.inputHeader}>
                        <Ionicons
                          name="cloud-upload-outline"
                          size={18}
                          color="#7C3AED"
                        />
                        <Text style={styles.inputLabel}>
                          Supporting Document
                        </Text>
                      </View>
                      <View style={styles.lsnOptionContainer}>
                        <Pressable
                          style={[
                            styles.radioOption,
                            lsnDocumentChoice === "with-document" &&
                              styles.radioOptionSelected,
                          ]}
                          onPress={() => setLsnDocumentChoice("with-document")}
                        >
                          <View style={styles.radioOuter}>
                            {lsnDocumentChoice === "with-document" && (
                              <View style={styles.radioInner} />
                            )}
                          </View>
                          <Text
                            style={[
                              styles.radioOptionText,
                              lsnDocumentChoice === "with-document" &&
                                styles.radioOptionTextSelected,
                            ]}
                          >
                            Yes, with ID/Certificate
                          </Text>
                        </Pressable>
                        <Pressable
                          style={[
                            styles.radioOption,
                            lsnDocumentChoice === "none" &&
                              styles.radioOptionSelected,
                          ]}
                          onPress={() => {
                            setLsnDocumentChoice("none");
                            setLsnDocument(null);
                            setUploadProgress(0);
                          }}
                        >
                          <View style={styles.radioOuter}>
                            {lsnDocumentChoice === "none" && (
                              <View style={styles.radioInner} />
                            )}
                          </View>
                          <Text
                            style={[
                              styles.radioOptionText,
                              lsnDocumentChoice === "none" &&
                                styles.radioOptionTextSelected,
                            ]}
                          >
                            None (no supporting document available)
                          </Text>
                        </Pressable>
                      </View>
                    </View>

                    {lsnDocumentChoice === "with-document" && (
                      <View style={styles.inputContainer}>
                        <LsnDocumentPreview
                          lsnDocument={lsnDocument}
                          onReplace={handlePickDocument}
                          onRemove={() => {
                            setLsnDocument(null);
                            setUploadProgress(0);
                          }}
                          progress={uploadProgress}
                        />
                      </View>
                    )}

                    <View style={styles.privacyNotice}>
                      <Ionicons
                        name="lock-closed-outline"
                        size={16}
                        color="#64748B"
                      />
                      <Text style={styles.privacyNoticeText}>
                        Your document is uploaded securely and handled
                        confidentially for verification and support purposes
                        only.
                      </Text>
                    </View>
                  </View>
                )}

                {/* Privacy Policy Agreement - Fixed nesting structure */}
                <View style={styles.agreementContainer}>
                  <Pressable
                    style={[
                      styles.checkbox,
                      agreedToPolicy && styles.checkboxChecked,
                    ]}
                    onPress={() => setAgreedToPolicy(!agreedToPolicy)}
                  >
                    {agreedToPolicy && (
                      <Ionicons name="checkmark" size={14} color="white" />
                    )}
                  </Pressable>
                  <Text style={styles.agreementText}>
                    I have read and agree to the{" "}
                    <Text
                      style={styles.privacyLink}
                      onPress={() => router.push("/privacy-policy")}
                    >
                      Privacy Policy
                    </Text>
                    .
                  </Text>
                </View>

                {error ? <Text style={styles.errorText}>{error}</Text> : null}

                <View style={styles.stepButtonRow}>
                  <Pressable
                    style={styles.prevStepButton}
                    onPress={() => setActiveTab(2)}
                    android_ripple={{ borderless: false, color: "rgba(124,58,237,0.15)" }}
                  >
                    <Ionicons name="arrow-back" size={18} color="#334155" />
                    <Text style={styles.prevStepButtonText}>Back</Text>
                  </Pressable>
                  <Pressable
                    style={styles.nextStepButton}
                    onPress={handleNextTab}
                    android_ripple={{ borderless: false, color: "rgba(124,58,237,0.15)" }}
                  >
                    <Text style={styles.nextStepButtonText}>
                      Next: Review
                    </Text>
                    <Ionicons name="arrow-forward" size={18} color="white" />
                  </Pressable>
                </View>
              </View>
            )}

            {/* ──────── TAB 4: REVIEW ──────── */}
            {activeTab === 4 && (
              <View>
                <Text style={styles.stepTitle}>Step 4: Review</Text>
                <AccessibleText
                  text="Double-check your details and supporting document before creating your account."
                  style={styles.stepSubtitle}
                />

                <View style={styles.reviewSection}>
                  <Text style={styles.reviewSectionTitle}>Profile</Text>
                  <ReviewRow label="Full Name" value={formData.fullName} />
                  <ReviewRow label="Email" value={formData.email} />
                  <ReviewRow
                    label="Contact No."
                    value={
                      formData.contactNo
                        ? formatPhilippineMobileNumber(formData.contactNo)
                            .formattedValue
                        : ""
                    }
                  />
                  <ReviewRow
                    label="Date of Birth"
                    value={formData.dateOfBirth}
                  />
                </View>

                <View style={styles.reviewSection}>
                  <Text style={styles.reviewSectionTitle}>School Information</Text>
                  <ReviewRow label="School ID" value={formData.schoolId} />
                  <ReviewRow label="College / University" value={formData.college} />
                  <ReviewRow label="Department" value={formData.department} />
                  <ReviewRow label="Academic Program" value={formData.academicProgram} />
                  <ReviewRow label="Year Level" value={formData.yearLevel} />
                </View>

                <View style={styles.reviewSection}>
                  <Text style={styles.reviewSectionTitle}>
                    Personal Information
                  </Text>
                  <ReviewRow label="Nationality" value={formData.nationality} />
                  <ReviewRow label="Citizenship" value={formData.citizenship} />
                  <ReviewRow label="Civil Status" value={formData.civilStatus} />
                  <ReviewRow label="Gender Identity" value={formData.genderIdentity} />
                  <ReviewRow
                    label="Religious Affiliation"
                    value={formData.religiousAffiliation}
                  />
                  <ReviewRow
                    label="Cultural Affiliation"
                    value={formData.culturalAffiliation}
                  />
                  <ReviewRow
                    label="Provincial Address"
                    value={formData.provincialAddress}
                  />
                  <ReviewRow
                    label="Emergency Contact"
                    value={formData.emergencyContactPerson}
                  />
                </View>

                <View style={styles.reviewSection}>
                  <Text style={styles.reviewSectionTitle}>Learner Support</Text>
                  <ReviewRow
                    label="LSN Classification"
                    value={formatLsnCategory(lsnCategory)}
                  />
                  <ReviewRow
                    label="Supporting Document"
                    value={
                      lsnCategory === ""
                        ? "Not required"
                        : lsnDocumentChoice === "none"
                        ? "None (no supporting document available)"
                        : lsnDocument && !lsnDocument.canceled
                        ? (lsnDocument.assets[0] as any).name
                        : "Not yet uploaded"
                    }
                  />
                  {lsnCategory !== "" && (
                    <View style={styles.reviewDocBlock}>
                      <View style={styles.reviewDocHeader}>
                        <Ionicons
                          name="document-attach-outline"
                          size={18}
                          color="#7C3AED"
                        />
                        <Text style={styles.reviewDocTitle}>
                          Document Verification
                        </Text>
                      </View>
                      <LsnDocumentPreview
                        lsnDocument={lsnDocument}
                        onReplace={handlePickDocument}
                        onRemove={() => {
                          setLsnDocument(null);
                          setUploadProgress(0);
                        }}
                        progress={uploadProgress}
                      />
                      <Text style={styles.reviewDocHint}>
                        You can replace or remove this document before
                        finalizing your registration.
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.agreementSummary}>
                  <Ionicons name="checkmark-circle" size={18} color="#16A34A" />
                  <Text style={styles.agreementSummaryText}>
                    I have read and agreed to the Privacy Policy.
                  </Text>
                </View>

                {error ? <Text style={styles.errorText}>{error}</Text> : null}

                <View style={styles.stepButtonRow}>
                  <Pressable
                    style={styles.prevStepButton}
                    onPress={() => setActiveTab(3)}
                    android_ripple={{ borderless: false, color: "rgba(124,58,237,0.15)" }}
                  >
                    <Ionicons name="arrow-back" size={18} color="#334155" />
                    <Text style={styles.prevStepButtonText}>Back</Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.createAccountButton,
                      loading && { opacity: 0.6 },
                    ]}
                    onPress={handleOpenConfirmation}
                    disabled={loading}
                    android_ripple={{ borderless: false, color: "rgba(124,58,237,0.15)" }}
                  >
                    {loading ? (
                      <ActivityIndicator color="white" />
                    ) : (
                      <Text style={styles.createAccountButtonText}>
                        Create Account
                      </Text>
                    )}
                  </Pressable>
                </View>
              </View>
            )}

            {/* Login Link Footer */}
            <View style={styles.loginContainer}>
              <Text style={styles.loginText}>Already have an account? </Text>
              <Pressable onPress={() => router.push("/auth/login")}>
                <Text style={styles.loginLink}>Login here</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>

        {/* Pre-Confirmation Summary Modal */}
        <Modal
          visible={showSummaryModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowSummaryModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <View style={styles.summaryIconContainer}>
                <Ionicons name="clipboard-outline" size={28} color="#7C3AED" />
              </View>
              <Text style={styles.modalTitle}>Confirm Your Details</Text>
              <Text style={styles.modalSubtitle}>
                Please review your registration details before proceeding.
              </Text>
              <View style={styles.summaryCard}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Full Name</Text>
                  <Text style={styles.summaryValue} numberOfLines={1}>
                    {sanitize(formData.fullName, 200) || "—"}
                  </Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Email</Text>
                  <Text style={styles.summaryValue} numberOfLines={1}>
                    {sanitize(formData.email.toLowerCase(), 256) || "—"}
                  </Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Mobile Number</Text>
                  <Text style={styles.summaryValue}>
                    {mobileNumberDisplay || "—"}
                  </Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>LSN Category</Text>
                  <Text style={styles.summaryValue}>
                    {lsnCategory !== ""
                      ? formatLsnCategory(lsnCategory)
                      : "Not a learner with special needs"}
                  </Text>
                </View>
              </View>
              <View style={styles.modalActions}>
                <Pressable
                  style={[styles.modalButton, styles.modalCancelButton]}
                  onPress={() => setShowSummaryModal(false)}
                  android_ripple={{ borderless: false, color: "rgba(124,58,237,0.15)" }}
                >
                  <Text style={styles.modalCancelText}>Back</Text>
                </Pressable>
                <Pressable
                  style={[styles.modalButton, styles.modalConfirmButton]}
                  onPress={handleProceedToPassword}
                  android_ripple={{ borderless: false, color: "rgba(124,58,237,0.15)" }}
                >
                  <Text style={styles.modalConfirmText}>
                    Proceed to Password
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        {/* Final Password Confirmation Modal */}
        <Modal
          visible={showConfirmModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowConfirmModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <Text style={styles.modalTitle}>Confirm Your Password</Text>
              <Text style={styles.modalSubtitle}>
                To complete your registration, please enter your password one
                last time.
              </Text>
              <View style={styles.modalInputGroup}>
                <Text style={styles.modalInputLabel}>Password</Text>
                <View style={styles.passwordInputContainer}>
                  <TextInput
                    style={styles.passwordInput}
                    placeholder="Create a password"
                    placeholderTextColor="#94A3B8"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPasswords}
                    autoCapitalize="none"
                  />
                </View>
              </View>
              <View style={styles.modalInputGroup}>
                <Text style={styles.modalInputLabel}>Confirm Password</Text>
                <View style={styles.passwordInputContainer}>
                  <TextInput
                    style={styles.passwordInput}
                    placeholder="Re-enter your password"
                    placeholderTextColor="#94A3B8"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showPasswords}
                    autoCapitalize="none"
                  />
                </View>
              </View>
              <View style={styles.requirementsBox}>
                <Text style={styles.requirementsTitle}>
                  Password Requirements:
                </Text>
                <View style={styles.requirementItem}>
                  <Ionicons
                    name={
                      password.length >= 8
                        ? "checkmark-circle"
                        : "close-circle"
                    }
                    size={16}
                    color={password.length >= 8 ? "#8A63D2" : "#999"}
                  />
                  <Text style={styles.requirementText}>
                    At least 8 characters
                  </Text>
                </View>
                <View style={styles.requirementItem}>
                  <Ionicons
                    name={
                      /[A-Z]/.test(password)
                        ? "checkmark-circle"
                        : "close-circle"
                    }
                    size={16}
                    color={/[A-Z]/.test(password) ? "#8A63D2" : "#999"}
                  />
                  <Text style={styles.requirementText}>
                    Contains an uppercase letter (A-Z)
                  </Text>
                </View>
                <View style={styles.requirementItem}>
                  <Ionicons
                    name={
                      /[a-z]/.test(password)
                        ? "checkmark-circle"
                        : "close-circle"
                    }
                    size={16}
                    color={/[a-z]/.test(password) ? "#8A63D2" : "#999"}
                  />
                  <Text style={styles.requirementText}>
                    Contains a lowercase letter (a-z)
                  </Text>
                </View>
                <View style={styles.requirementItem}>
                  <Ionicons
                    name={
                      /[0-9]/.test(password)
                        ? "checkmark-circle"
                        : "close-circle"
                    }
                    size={16}
                    color={/[0-9]/.test(password) ? "#8A63D2" : "#999"}
                  />
                  <Text style={styles.requirementText}>
                    Contains a number (0-9)
                  </Text>
                </View>
                <View style={styles.requirementItem}>
                  <Ionicons
                    name={
                      /[^A-Za-z0-9]/.test(password)
                        ? "checkmark-circle"
                        : "close-circle"
                    }
                    size={16}
                    color={/[^A-Za-z0-9]/.test(password) ? "#8A63D2" : "#999"}
                  />
                  <Text style={styles.requirementText}>
                    Contains a special character (!@#$%^&* etc.)
                  </Text>
                </View>
                <View style={styles.requirementItem}>
                  <Ionicons
                    name={
                      password === confirmPassword &&
                      confirmPassword.length > 0
                        ? "checkmark-circle"
                        : "close-circle"
                    }
                    size={16}
                    color={
                      password === confirmPassword &&
                      confirmPassword.length > 0
                        ? "#8A63D2"
                        : "#999"
                    }
                  />
                  <Text style={styles.requirementText}>Passwords match</Text>
                </View>
              </View>
              <Pressable
                style={styles.showPasswordRow}
                onPress={() => setShowPasswords((p) => !p)}
              >
                <Ionicons
                  name={showPasswords ? "eye-outline" : "eye-off-outline"}
                  size={18}
                  color="#7C3AED"
                />
                <Text style={styles.showPasswordLabel}>
                  {showPasswords ? "Hide passwords" : "Show passwords"}
                </Text>
              </Pressable>
              <View style={styles.modalActions}>
                <Pressable
                  style={[styles.modalButton, styles.modalCancelButton]}
                  onPress={() => {
                    setShowConfirmModal(false);
                    setPassword("");
                    setConfirmPassword("");
                  }}
                  disabled={otpSending}
                  android_ripple={{ borderless: false, color: "rgba(124,58,237,0.15)" }}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.modalButton,
                    styles.modalConfirmButton,
                    otpSending && { opacity: 0.7 },
                  ]}
                  onPress={handleConfirmPassword}
                  disabled={otpSending}
                  android_ripple={{ borderless: false, color: "rgba(124,58,237,0.15)" }}
                >
                  {otpSending ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <Text style={styles.modalConfirmText}>Continue</Text>
                  )}
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        {/* OTP Verification Modal */}
        <Modal
          visible={showOtpModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowOtpModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <View style={styles.summaryIconContainer}>
                <Ionicons name="mail-outline" size={28} color="#7C3AED" />
              </View>
              <Text style={styles.modalTitle}>Verify Your Email</Text>
              <Text style={styles.modalSubtitle}>
                We sent a 6-digit code to{"\n"}
                <Text style={styles.modalSubtitleEmail}>
                  {sanitize(formData.email.toLowerCase(), 256)}
                </Text>
              </Text>
              <View style={styles.modalInputGroup}>
                <Text style={styles.modalInputLabel}>Verification Code</Text>
                <View style={styles.passwordInputContainer}>
                  <TextInput
                    style={styles.otpInput}
                    placeholder="000000"
                    placeholderTextColor="#94A3B8"
                    value={otpCode}
                    onChangeText={(text) =>
                      setOtpCode(text.replace(/[^0-9]/g, "").slice(0, 6))
                    }
                    keyboardType="number-pad"
                    maxLength={6}
                    editable={!otpVerifying && !otpSending}
                  />
                </View>
              </View>
              {otpError ? (
                <Text style={styles.otpErrorText}>{otpError}</Text>
              ) : null}
              <Pressable
                style={styles.showPasswordRow}
                onPress={handleResendOtp}
                disabled={resendCooldown > 0 || otpSending || otpVerifying}
              >
                <Text
                  style={[
                    styles.resendText,
                    (resendCooldown > 0 || otpSending || otpVerifying) &&
                      styles.resendTextDisabled,
                  ]}
                >
                  {resendCooldown > 0
                    ? `Resend code in ${resendCooldown}s`
                    : "Resend code"}
                </Text>
              </Pressable>
              <View style={styles.modalActions}>
                <Pressable
                  style={[styles.modalButton, styles.modalCancelButton]}
                  onPress={() => setShowOtpModal(false)}
                  disabled={otpVerifying || otpSending}
                  android_ripple={{ borderless: false, color: "rgba(124,58,237,0.15)" }}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.modalButton,
                    styles.modalConfirmButton,
                    (otpVerifying || otpSending) && { opacity: 0.7 },
                  ]}
                  onPress={handleVerifyOtp}
                  disabled={otpVerifying || otpSending}
                  android_ripple={{ borderless: false, color: "rgba(124,58,237,0.15)" }}
                >
                  {otpVerifying ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <Text style={styles.modalConfirmText}>Verify</Text>
                  )}
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F4F7FE",
  },
  mainLayout: {
    flex: 1,
    backgroundColor: "#F4F7FE",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  headerTitle: {
    color: "#0F172A",
    fontSize: 18,
    fontWeight: "800",
    flex: 1,
    textAlign: "center",
  },
  headerSpacer: {
    width: 38,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 40,
  },
  tabNavContainer: {
    flexDirection: "row",
    backgroundColor: "#E2E8F0",
    borderRadius: 16,
    padding: 4,
    marginBottom: 20,
  },
  tabNavItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
  },
  tabNavItemActive: {
    backgroundColor: "#FFFFFF",
    // @ts-ignore - web only
    boxShadow: "0px 2px 8px rgba(0, 0, 0, 0.05)",
  },
  tabBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
  },
  tabBadgeActive: {
    backgroundColor: "#7C3AED",
  },
  tabBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  tabBadgeTextActive: {
    color: "#FFFFFF",
  },
  tabNavText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748B",
  },
  tabNavTextActive: {
    color: "#0F172A",
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 4,
  },
  stepSubtitle: {
    fontSize: 13,
    color: "#64748B",
    marginBottom: 24,
    fontWeight: "600",
  },
  formCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    // @ts-ignore - web only
    boxShadow: "0px 6px 20px rgba(0, 0, 0, 0.04)",
  },
  inputContainer: {
    marginBottom: 18,
  },
  inputHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  inputLabel: {
    fontSize: 13,
    color: "#334155",
    marginLeft: 8,
    fontWeight: "700",
  },
  input: {
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    fontSize: 15,
    color: "#0F172A",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    fontWeight: "600",
  },
  inputError: {
    borderColor: "#EF4444",
    borderWidth: 1.5,
  },
  fieldError: {
    color: "#EF4444",
    fontSize: 12,
    marginTop: 4,
    marginBottom: 4,
    fontWeight: "600",
  },
  passwordInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: "#0F172A",
    fontWeight: "600",
  },
  requirementsBox: {
    backgroundColor: "white",
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    // @ts-ignore - web only
    boxShadow: "0px 1px 2px rgba(0,0,0,0.1)",
    elevation: 2,
  },
  requirementsTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 12,
  },
  requirementItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  requirementText: {
    fontSize: 14,
    color: "#666",
    marginLeft: 8,
  },
  eyeIconButton: {
    paddingHorizontal: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  nextStepButton: {
    backgroundColor: "#7C3AED",
    flexDirection: "row",
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    gap: 8,
    // @ts-ignore - web only
    boxShadow: "0px 6px 16px rgba(124, 58, 237, 0.3)",
  },
  nextStepButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  stepButtonRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 12,
  },
  prevStepButton: {
    flex: 1,
    backgroundColor: "#F1F5F9",
    flexDirection: "row",
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  prevStepButtonText: {
    color: "#334155",
    fontSize: 15,
    fontWeight: "700",
  },
  createAccountButton: {
    flex: 2,
    backgroundColor: "#7C3AED",
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    // @ts-ignore - web only
    boxShadow: "0px 6px 16px rgba(124, 58, 237, 0.3)",
  },
  createAccountButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  errorText: {
    color: "#EF4444",
    textAlign: "center",
    marginBottom: 12,
    fontWeight: "600",
  },
  loginContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 24,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    paddingTop: 16,
  },
  loginText: {
    color: "#64748B",
    fontSize: 14,
    fontWeight: "600",
  },
  loginLink: {
    color: "#7C3AED",
    fontSize: 14,
    fontWeight: "800",
  },
  dropdownContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    marginTop: 6,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    maxHeight: 200,
  },
  dropdownOption: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  dropdownText: {
    fontSize: 14,
    color: "#0F172A",
    fontWeight: "600",
  },
  selectedTag: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#7C3AED",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 8,
  },
  selectedTagText: {
    color: "white",
    fontSize: 13,
    fontWeight: "700",
    flex: 1,
  },
  optionsWrap: {
    gap: 8,
  },
  listOption: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  listOptionSelected: {
    backgroundColor: "#EDE9FE",
    borderColor: "#7C3AED",
  },
  listOptionText: {
    fontSize: 14,
    color: "#334155",
    fontWeight: "600",
  },
  listOptionSelectedText: {
    color: "#7C3AED",
    fontWeight: "800",
  },
  helpText: {
    fontSize: 13,
    color: "#94A3B8",
    fontStyle: "italic",
    paddingVertical: 8,
  },
  lsnOptionContainer: {
    gap: 8,
  },
  subFieldLabel: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "700",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  radioOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 10,
  },
  radioOptionSelected: {
    backgroundColor: "#EDE9FE",
    borderColor: "#7C3AED",
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#CBD5E1",
    justifyContent: "center",
    alignItems: "center",
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#7C3AED",
  },
  radioOptionText: {
    fontSize: 14,
    color: "#334155",
    fontWeight: "600",
    flex: 1,
  },
  radioOptionTextSelected: {
    color: "#7C3AED",
    fontWeight: "800",
  },
  conditionalSection: {
    backgroundColor: "#FAF5FF",
    borderRadius: 16,
    padding: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#EDE9FE",
  },
  uploadButton: {
    backgroundColor: "#F3E8FF",
    borderWidth: 1,
    borderColor: "#C4B5FD",
    borderStyle: "dashed",
    borderRadius: 16,
    paddingVertical: 20,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  uploadButtonText: {
    color: "#7C3AED",
    fontWeight: "700",
  },
  filePreview: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  fileName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0F172A",
  },
  fileStatus: {
    fontSize: 12,
    color: "#16A34A",
    fontWeight: "700",
  },
  documentPreviewContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  documentThumbnail: {
    width: 52,
    height: 52,
    borderRadius: 10,
    backgroundColor: "#F1F5F9",
  },
  documentBadge: {
    width: 52,
    height: 52,
    borderRadius: 10,
    backgroundColor: "#F3E8FF",
    justifyContent: "center",
    alignItems: "center",
  },
  documentPreviewInfo: {
    flex: 1,
    marginLeft: 12,
  },
  documentActionButton: {
    padding: 8,
    marginLeft: 4,
  },
  privacyNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "#FFFFFF",
    padding: 12,
    borderRadius: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  privacyNoticeText: {
    flex: 1,
    fontSize: 12,
    color: "#64748B",
    lineHeight: 18,
    fontWeight: "500",
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: "#E2E8F0",
    borderRadius: 3,
    marginTop: 4,
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    backgroundColor: "#16A34A",
    borderRadius: 3,
  },
  agreementContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 20,
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#CBD5E1",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    backgroundColor: "#F8FAFC",
  },
  checkboxChecked: {
    backgroundColor: "#7C3AED",
    borderColor: "#7C3AED",
  },
  agreementText: {
    flex: 1,
    fontSize: 13,
    color: "#64748B",
    fontWeight: "600",
  },
  privacyLink: {
    color: "#7C3AED",
    fontWeight: "800",
    textDecorationLine: "underline",
  },
  reviewSection: {
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  reviewSectionTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#7C3AED",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  reviewRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E2E8F0",
  },
  reviewRowLabel: {
    fontSize: 13,
    color: "#64748B",
    fontWeight: "600",
    flex: 1,
    paddingRight: 12,
  },
  reviewRowValue: {
    fontSize: 13,
    color: "#0F172A",
    fontWeight: "700",
    flex: 1.4,
    textAlign: "right",
  },
  reviewDocBlock: {
    marginTop: 10,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#EDE9FE",
  },
  reviewDocHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  reviewDocTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#7C3AED",
  },
  reviewDocHint: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 8,
    fontWeight: "500",
    lineHeight: 17,
  },
  agreementSummary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F0FDF4",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#BBF7D0",
    marginBottom: 4,
  },
  agreementSummaryText: {
    flex: 1,
    fontSize: 13,
    color: "#166534",
    fontWeight: "600",
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 24,
    width: "100%",
    maxWidth: 380,
    alignItems: "center",
    // @ts-ignore - web only
    boxShadow: "0px 10px 30px rgba(0, 0, 0, 0.1)",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
    marginBottom: 20,
    fontWeight: "500",
  },
  modalInputGroup: {
    width: "100%",
    marginBottom: 16,
  },
  modalInputLabel: {
    fontSize: 14,
    color: "#334155",
    marginBottom: 6,
    fontWeight: "700",
  },
  modalActions: {
    flexDirection: "row",
    marginTop: 16,
    gap: 12,
    width: "100%",
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  modalCancelButton: {
    backgroundColor: "#F1F5F9",
  },
  modalConfirmButton: {
    backgroundColor: "#7C3AED",
  },
  modalCancelText: {
    color: "#334155",
    fontWeight: "700",
  },
  modalConfirmText: {
    color: "white",
    fontWeight: "700",
  },
  summaryIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#F3EAFF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  summaryCard: {
    width: "100%",
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 4,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  summaryLabel: {
    fontSize: 13,
    color: "#64748B",
    fontWeight: "600",
    flexShrink: 0,
  },
  summaryValue: {
    fontSize: 14,
    color: "#0F172A",
    fontWeight: "700",
    flex: 1,
    textAlign: "right",
  },
  summaryDivider: {
    height: 1,
    backgroundColor: "#E2E8F0",
    marginVertical: 10,
  },
  modalSubtitleEmail: {
    fontWeight: "700",
    color: "#7C3AED",
  },
  showPasswordRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    marginBottom: 4,
  },
  showPasswordLabel: {
    fontSize: 13,
    color: "#7C3AED",
    fontWeight: "600",
  },
  otpInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 24,
    fontWeight: "700",
    color: "#0F172A",
    letterSpacing: 8,
    textAlign: "center",
  },
  otpErrorText: {
    color: "#DC2626",
    fontSize: 13,
    fontWeight: "500",
    marginBottom: 8,
    textAlign: "center",
  },
  resendText: {
    fontSize: 14,
    color: "#7C3AED",
    fontWeight: "600",
    padding: 6,
  },
  resendTextDisabled: {
    color: "#94A3B8",
  },
  avatarSection: {
    alignItems: "center",
    marginBottom: 20,
  },
  avatarPressable: {
    alignItems: "center",
    gap: 8,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#F3EEFF",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#E9D5FF",
    position: "relative",
    overflow: "hidden",
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  avatarOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(138, 99, 210, 0.75)",
    paddingVertical: 4,
    alignItems: "center",
  },
  avatarLabel: {
    fontSize: 12,
    color: "#8A63D2",
    fontWeight: "600",
  },
});
