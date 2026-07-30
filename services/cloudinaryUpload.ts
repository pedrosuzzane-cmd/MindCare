import { Platform } from "react-native";

const CLOUD_NAME = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME || "hj1vnhs0";
const UPLOAD_PRESET = "mindcare_upload";

interface UploadResult {
  secureUrl: string;
  publicId: string;
}

function normalizeUri(uri: string): string {
  return Platform.OS === "ios" ? uri.replace("file://", "") : uri;
}

export async function uploadImageToCloudinary(
  localUri: string,
  folder = "mindcare/profile-images",
): Promise<UploadResult> {
  const uri = normalizeUri(localUri);
  const filename = uri.split("/").pop() || "photo.jpg";
  const match = /\.(\w+)$/.exec(filename);
  const ext = match ? match[1] : "jpg";

  const formData = new FormData();
  formData.append("file", {
    uri,
    type: `image/${ext}`,
    name: `profile_${Date.now()}.${ext}`,
  } as any);
  formData.append("upload_preset", UPLOAD_PRESET);
  if (folder) formData.append("folder", folder);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    { method: "POST", body: formData },
  );

  const data = await response.json();
  if (!data.secure_url) {
    throw new Error(data.error?.message || "Image upload failed");
  }
  return { secureUrl: data.secure_url, publicId: data.public_id };
}

export async function uploadDocumentToCloudinary(
  uri: string,
  name: string,
  mimeType: string,
  folder = "mindcare/lsn-documents",
  onProgress?: (pct: number) => void,
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const fd = new FormData();
    fd.append("file", {
      uri: normalizeUri(uri),
      name,
      type: mimeType,
    } as any);
    fd.append("upload_preset", UPLOAD_PRESET);
    if (folder) fd.append("folder", folder);

    const isImage = mimeType?.startsWith("image/");
    const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${isImage ? "image" : "auto"}/upload`;

    xhr.open("POST", url);
    xhr.timeout = 90_000;

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      };
    }

    xhr.onload = () => {
      onProgress?.(100);
      try {
        const resp = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) {
          if (!resp.secure_url) {
            reject(new Error(resp.error?.message || "Upload returned an incomplete response."));
            return;
          }
          resolve({ secureUrl: resp.secure_url, publicId: resp.public_id });
        } else {
          reject(new Error(resp.error?.message || `Upload failed (${xhr.status}).`));
        }
      } catch {
        reject(new Error("Upload service returned an invalid response."));
      }
    };

    xhr.onerror = () => reject(new Error("Upload service unavailable."));
    xhr.ontimeout = () => reject(new Error("Upload timed out."));
    xhr.send(fd);
  });
}
