import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from "../config/cloudinary.js";

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "studyTogether",
    resource_type: "raw", // PDF only
    allowed_formats: ["pdf"], // 🔥 IMPORTANT
    type: "upload",
    public_id: (req, file) => {
      const safeName = file.originalname
        .replace(/\s+/g, "-")
        .replace(/[^\w.-]/g, "");

      return `${Date.now()}-${safeName}`;
    },
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 🔥 5MB
  },
  fileFilter: (req, file, cb) => {
    const isPdfMime = file.mimetype === "application/pdf";
    const isPdfExt = file.originalname.toLowerCase().endsWith(".pdf");

    if (isPdfMime && isPdfExt) {
      cb(null, true);
    } else {
      cb(
        new Error("Only PDF files are allowed. Please upload a valid PDF."),
        false,
      );
    }
  },
});

export default upload;
