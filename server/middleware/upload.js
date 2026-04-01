import multer from "multer";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

/* ================= UPLOAD DIRECTORY ================= */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = path.join(__dirname, "..", "uploads");

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

      /* sanitize filename */

      const baseName = path
        .basename(file.originalname, ext)
        .replace(/\s+/g, "_")
        .replace(/[^\w.-]/g, "")
        .toLowerCase();

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
    if (!file) {
      return cb(new Error("No file uploaded"), false);
    }

    const isPDF =
      file.mimetype === "application/pdf" &&
      path.extname(file.originalname).toLowerCase() === ".pdf";

    if (!isPDF) {
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
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter,
});

/* ================= ERROR HANDLER WRAPPER ================= */
/* IMPORTANT: This fixes crash + 500 error */

export const uploadMiddleware = (req, res, next) => {
  const singleUpload = upload.single("pdf");

  singleUpload(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({
        error: err.message,
      });
    } else if (err) {
      return res.status(400).json({
        error: err.message,
      });
    }

    next();
  });
};

export default upload;
