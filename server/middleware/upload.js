import multer from "multer";
import fs from "fs";
import path from "path";
import crypto from "crypto";

/* ================= UPLOAD DIRECTORY ================= */

const uploadDir = path.join(process.cwd(), "uploads");

/* Ensure uploads directory exists */

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

/* ================= STORAGE CONFIG ================= */

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },

  filename: (req, file, cb) => {
    try {
      const ext = path.extname(file.originalname).toLowerCase();

      /* sanitize original filename */

      const baseName = path
        .basename(file.originalname, ext)
        .replace(/\s+/g, "_")
        .replace(/[^\w.-]/g, "")
        .toLowerCase();

      /* generate random id */

      const randomId = crypto.randomBytes(6).toString("hex");

      const filename = `${Date.now()}_${randomId}_${baseName}${ext}`;

      cb(null, filename);
    } catch (error) {
      cb(error);
    }
  },
});

/* ================= FILE FILTER ================= */

const fileFilter = (req, file, cb) => {
  try {
    if (!file || !file.mimetype) {
      return cb(new Error("Invalid file upload"), false);
    }

    const allowedMimeTypes = ["application/pdf"];
    const ext = path.extname(file.originalname).toLowerCase();

    if (!allowedMimeTypes.includes(file.mimetype) || ext !== ".pdf") {
      return cb(new Error("Only PDF files are allowed"), false);
    }

    cb(null, true);
  } catch (error) {
    cb(error, false);
  }
};

/* ================= MULTER CONFIG ================= */

const upload = multer({
  storage,

  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },

  fileFilter,
});

export default upload;
