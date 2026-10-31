import "./env.js";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET,
});

export const getPublicId = (url = "") => {
  try {
    if (!url || typeof url !== "string") return null;
    if (!url.includes("res.cloudinary.com")) return null;

    const cleanUrl = url.split(/[?#]/)[0];
    const match = cleanUrl.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[^/.]*)?$/);
    if (match && match[1]) {
      return match[1];
    }

    const parts = cleanUrl.split("/");
    const fileWithExt = parts.slice(-2).join("/"); // folder/file.pdf

    return fileWithExt.replace(/\.[^/.]+$/, ""); // remove extension
  } catch {
    return null;
  }
};

export const deleteCloudinaryAsset = async (fileOrUrl) => {
  try {
    if (!fileOrUrl) return null;

    let publicId = null;
    if (typeof fileOrUrl === "object") {
      publicId = fileOrUrl?.filename || getPublicId(fileOrUrl?.path);
    } else if (typeof fileOrUrl === "string") {
      if (fileOrUrl.includes("res.cloudinary.com")) {
        publicId = getPublicId(fileOrUrl);
      } else if (
        !fileOrUrl.startsWith("http://") &&
        !fileOrUrl.startsWith("https://") &&
        !fileOrUrl.startsWith("/")
      ) {
        publicId = fileOrUrl.trim();
      }
    }

    if (publicId) {
      return await cloudinary.uploader.destroy(publicId, { resource_type: "raw" });
    }
    return null;
  } catch (err) {
    console.error("Cloudinary orphan cleanup error:", err.message);
    return null;
  }
};

export default cloudinary;
