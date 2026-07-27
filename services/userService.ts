import { doc, setDoc } from "firebase/firestore";
import * as ImagePicker from "expo-image-picker";
import { Alert } from "react-native";
import { db } from "@/constants/firebase";

const API_BASE = "https://mindcare-api-wcqr.onrender.com";

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
 * Uploads a local image URI to the backend (Cloudinary) and returns the secure URL.
 */
export async function uploadAvatarToCloudinary(
  localUri: string,
): Promise<string> {
  const formData = new FormData();

  const filename = localUri.split("/").pop() || "avatar.jpg";
  const match = /\.(\w+)$/.exec(filename);
  const type = match ? `image/${match[1]}` : "image/jpeg";

  formData.append("file", {
    uri: localUri,
    name: filename,
    type,
  } as any);

  const response = await fetch(`${API_BASE}/api/users/upload-avatar`, {
    method: "POST",
    body: formData,
    headers: { "Content-Type": "multipart/form-data" },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || "Avatar upload failed");
  }

  const data = await response.json();
  return data.secureUrl;
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
