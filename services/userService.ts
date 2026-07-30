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
 * Opens a browser file picker for images and returns the selected File object.
 * Uses the DOM file input API (web-only).
 */
export function pickProfileImageWeb(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.style.display = "none";

    input.onchange = () => {
      const file = input.files?.[0] || null;
      document.body.removeChild(input);
      resolve(file);
    };

    input.oncancel = () => {
      document.body.removeChild(input);
      resolve(null);
    };

    document.body.appendChild(input);
    input.click();
  });
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
 * Uploads a File object (from web file picker) directly to Cloudinary and returns the secure URL.
 */
export async function uploadAvatarToCloudinaryWeb(
  file: File,
): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", UPLOAD_PRESET);
  formData.append("folder", "mindcare/profile-images");

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    { method: "POST", body: formData },
  );

  const data = await response.json();
  if (!data.secure_url) {
    throw new Error(data.error?.message || "Image upload failed");
  }
  return data.secure_url;
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
 * Uses expo-image-picker (native only).
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
 * Full flow for web: pick image via DOM file input → upload to Cloudinary → save to Firestore.
 * Returns the new image URL or null if cancelled/failed.
 * Web-compatible (does not use expo-image-picker).
 */
export async function changeProfileImageWeb(
  uid: string,
  collectionName: "users" | "admins",
): Promise<string | null> {
  try {
    const file = await pickProfileImageWeb();
    if (!file) return null;

    const secureUrl = await uploadAvatarToCloudinaryWeb(file);
    await saveProfileImage(uid, collectionName, secureUrl);
    return secureUrl;
  } catch (error: any) {
    console.error("changeProfileImageWeb error:", error);
    Alert.alert("Upload Failed", error.message || "Could not update profile picture.");
    return null;
  }
}