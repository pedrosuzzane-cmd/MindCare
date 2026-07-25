// utils/cloudinary.ts
import { Cloudinary } from "@cloudinary/url-gen";
import { auto } from "@cloudinary/url-gen/actions/resize";
import { autoGravity } from "@cloudinary/url-gen/qualifiers/gravity";

// Initialize Cloudinary using the environment variable
const cloudName = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME || "hj1vnhs0";

const cld = new Cloudinary({ cloud: { cloudName } });

/**
 * Generates an optimized, auto-cropped Cloudinary URL for React Native <Image>
 * @param publicId The Cloudinary public ID of the asset
 * @param width Desired width (default 500)
 * @param height Desired height (default 500)
 */
export const getOptimizedImageUrl = (
  publicId: string,
  width: number = 500,
  height: number = 500,
) => {
  if (!publicId) return "";

  const img = cld
    .image(publicId)
    .format("auto") // Auto-selects WebP/AVIF based on environment/browser
    .quality("auto") // Auto-optimizes quality for compression
    .resize(auto().gravity(autoGravity()).width(width).height(height));

  return img.toURL();
};
