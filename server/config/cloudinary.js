import { v2 as cloudinary } from "cloudinary";

/* ================= ENV VALIDATION ================= */

if (
  !process.env.CLOUDINARY_NAME ||
  !process.env.CLOUDINARY_KEY ||
  !process.env.CLOUDINARY_SECRET
) {
  console.error("❌ Cloudinary environment variables missing");
  process.exit(1);
}

/* ================= CLOUDINARY CONFIG ================= */

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_KEY,
  api_secret: process.env.CLOUDINARY_SECRET,
  secure: true,
});

/* ================= LOG ================= */

console.log("☁️ Cloudinary configured successfully");

export default cloudinary;
