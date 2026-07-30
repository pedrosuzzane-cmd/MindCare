import { Platform } from "react-native";
import { doc, setDoc } from "firebase/firestore";
import * as ImagePicker from "expo-image-picker";
import { Alert } from "react-native";
import { db } from "@/constants/firebase";
import { uploadImageToCloudinary } from "./cloudinaryUpload";

const CLOUD_NAME = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME || "hj1vnhs0";
const UPLOAD_PRESET = "mindcare_upload";

/**
 * Requests media library permissions and lets the user pick an image.
 * Returns the local URI or null if cancelled.
 * Uses expo-image-picker (native only — safe for Android/iOS).
 */
export async function pickProfileImage(): Promise<string | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== "granted") {
    Alert.alert(
      "Permission Required",
      "Please grant camera roll access to change your profile picture.",
    );
    return null;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
  });

  if (result.canceled || !result.assets?.[0]) return null;
  return result.assets[0].uri;
}

/**
 * Uploads a local image URI directly to Cloudinary and returns the secure URL.
 */
export async function uploadAvatarToCloudinary(
  localUri: string,
): Promise<string> {
  const { secureUrl } = await uploadImageToCloudinary(localUri);
  return secureUrl;
}

/**
 * Saves the profileImage URL to the user's Firestore document.
 */
export async function saveProfileImage(
  uid: string,
  collectionName: "users" | "admins",
  imageUrl: string,
): Promise<void> {
  await setDoc(
    doc(db, collectionName, uid),
    { profileImage: imageUrl, updatedAt: new Date().toISOString() },
    { merge: true },
  );
}

/**
 * Full flow: pick image → upload to Cloudinary → save to Firestore.
 * Returns the new image URL or null if cancelled/failed.
 * Uses expo-image-picker (native only — Android/iOS).
 * Students & admins on native devices use this.
 */
export async function changeProfileImage(
  uid: string,
  collectionName: "users" | "admins",
): Promise<string | null> {
  try {
    const localUri = await pickProfileImage();
    if (!localUri) return null;

    const secureUrl = await uploadAvatarToCloudinary(localUri);
    await saveProfileImage(uid, collectionName, secureUrl);
    return secureUrl;
  } catch (error: any) {
    console.error("changeProfileImage error:", error);
    Alert.alert("Upload Failed", error.message || "Could not update profile picture.");
    return null;
  }
}

/**
 * Web-only: uploads a raw browser File object to Cloudinary, then saves the URL to Firestore.
 * This function does NOT use expo-image-picker — it works with event.target.files[0].
 * Admin & student-detail web uploads use this.
 */
export async function uploadProfileImageFromFile(
  file: File,
  uid: string,
  collectionName: "users" | "admins",
): Promise<string | null> {
  try {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", UPLOAD_PRESET);
    formData.append("cloud_name", CLOUD_NAME);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
      { method: "POST", body: formData },
    );

    const data = await response.json();
    if (!data.secure_url) {
      throw new Error(data.error?.message || "Cloudinary upload failed");
    }

    await saveProfileImage(uid, collectionName, data.secure_url);
    return data.secure_url;
  } catch (error: any) {
    console.error("uploadProfileImageFromFile error:", error);
    Alert.alert("Upload Failed", error.message || "Could not update profile picture.");
    return null;
  }
}