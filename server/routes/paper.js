import express from "express";
import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";

import Paper from "../models/Paper.js";
import cloudinary from "../config/cloudinary.js";
import verifyToken from "../middleware/authMiddleware.js";
import verifyAdmin from "../middleware/adminMiddleware.js";
import upload from "../middleware/uploadCloudinary.js";
const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, "..", "uploads");

const SUBJECT_MAP = {
  dbms: "DBMS",
  "data structure": "Data Structure",
  "operating system": "Operating System",
  "computer network": "Computer Network",
  "software engineering": "Software Engineering",
  "artificial intelligence": "Artificial Intelligence",
};

const VALID_SUBJECTS = new Set(Object.values(SUBJECT_MAP));

const escapeRegex = (value = "") =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const normalizeSubject = (value = "") => {
  const normalized = value.trim().toLowerCase();
  return SUBJECT_MAP[normalized] || value.trim();
};

/* ================= UPLOAD PAPER ================= */

router.post("/upload", verifyToken, (req, res) => {
  upload.single("pdf")(req, res, async (err) => {
    /* 🔥 ERROR HANDLE */

    if (err instanceof multer.MulterError) {
      return res.status(400).json({
        success: false,
        error: err.message,
      });
    }

    if (err) {
      return res.status(400).json({
        success: false,
        error: err.message,
      });
    }

    try {
      let { title, subject, semester } = req.body;

      if (!title || !subject || !semester || !req.file) {
        return res.status(400).json({
          success: false,
          error: "All fields and PDF file are required",
        });
      }

      subject = normalizeSubject(subject);

      if (!VALID_SUBJECTS.has(subject)) {
        return res.status(400).json({
          success: false,
          error: "Invalid subject",
        });
      }

      if (req.user.role !== "admin") {
        // ✅ count ONLY pending
        const pendingUploads = await Paper.countDocuments({
          uploadedBy: req.user._id,
          status: "pending",
        });

        // ✅ remaining slots
        const remainingSlots = 2 - pendingUploads;

        if (remainingSlots <= 0) {
          return res.status(400).json({
            success: false,
            error: "Upload limit reached (Max 2 pending papers allowed)",
          });
        }
      }

      const safeTitle = escapeRegex(title.trim());
      const safeSubject = escapeRegex(subject);

      const existingPaper = await Paper.findOne({
        title: { $regex: `^${safeTitle}$`, $options: "i" },
        subject: { $regex: `^${safeSubject}$`, $options: "i" },
        semester: Number(semester),
      });

      if (existingPaper) {
        return res.status(400).json({
          success: false,
          error: "This paper already exists",
        });
      }
      const pdfLink = req.file.path.replace("/image/upload/", "/raw/upload/");
      const status = req.user.role === "admin" ? "approved" : "pending";

      const paper = await Paper.create({
        title: title.trim(),
        subject,
        semester: Number(semester),
        pdfLink,
        uploadedBy: req.user._id,
        status,
      });

      res.status(201).json({
        success: true,
        message:
          status === "approved"
            ? "Paper uploaded successfully"
            : "Paper uploaded and waiting for admin approval",
        paper,
      });
    } catch (error) {
      if (error?.code === 11000) {
        return res.status(400).json({
          success: false,
          error: "This paper already exists",
        });
      }

      console.error("Upload paper error:", error.message);
      res.status(500).json({
        error: "Server error while uploading paper",
      });
    }
  });
});

/* ================= CLOUDINARY PUBLIC ID EXTRACT ================= */

const getPublicId = (url = "") => {
  try {
    if (!url.includes("res.cloudinary.com")) return null;

    const parts = url.split("/");
    const fileWithExt = parts.slice(-2).join("/"); // folder/file.pdf

    return fileWithExt.replace(/\.[^/.]+$/, ""); // remove extension
  } catch {
    return null;
  }
};

/* =====================================================
GET PAPERS
===================================================== */

router.get("/", verifyToken, async (req, res) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = 9;
    const skip = (page - 1) * limit;

    const {
      search = "",
      subject = "",
      semester = "",
      sort = "new",
    } = req.query;

    const filter = {
      isActive: true,
      status: "approved",
    };

    if (search) {
      const safeSearch = escapeRegex(search);

      filter.$or = [
        { title: { $regex: safeSearch, $options: "i" } },
        { subject: { $regex: safeSearch, $options: "i" } },
      ];
    }

    if (subject) filter.subject = subject;
    if (semester) filter.semester = Number(semester);

    let sortOption = { createdAt: -1 };

    if (sort === "views") sortOption = { views: -1 };
    if (sort === "downloads") sortOption = { downloads: -1 };

    const papers = await Paper.find(filter)
      .populate("uploadedBy", "name email")
      .skip(skip)
      .limit(limit)
      .sort(sortOption);

    const total = await Paper.countDocuments(filter);

    res.json({
      papers,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      totalPapers: total,
    });
  } catch (error) {
    console.error("Fetch papers error:", error.message);

    res.status(500).json({
      error: "Server error while fetching papers",
    });
  }
});

/* =====================================================
ADMIN: GET PENDING
===================================================== */

router.get("/admin/pending", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const papers = await Paper.find({ status: "pending" })
      .populate("uploadedBy", "name email")
      .sort({ createdAt: -1 });

    res.json(papers);
  } catch (error) {
    console.error("Pending papers error:", error);

    res.status(500).json({
      error: "Failed to fetch pending papers",
    });
  }
});

/* =====================================================
ADMIN APPROVE
===================================================== */

router.put("/admin/approve/:id", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid paper id" });
    }

    const paper = await Paper.findByIdAndUpdate(
      id,
      { status: "approved" },
      { new: true },
    );

    if (!paper) {
      return res.status(404).json({ success: false, error: "Paper not found" });
    }

    res.json({
      message: "Paper approved successfully",
      paper,
    });
  } catch (error) {
    console.error("Approve paper error:", error);

    res.status(500).json({
      error: "Approval failed",
    });
  }
});

/* =====================================================
ADMIN REJECT (FINAL SAFE)
===================================================== */

/* =====================================================
TRENDING
===================================================== */

router.get("/trending", async (req, res) => {
  try {
    const papers = await Paper.find({
      isActive: true,
      status: "approved",
    })
      .sort({ downloads: -1, views: -1 })
      .limit(5)
      .populate("uploadedBy", "name");

    res.json(papers);
  } catch (error) {
    console.error("Trending error:", error);

    res.status(500).json({
      error: "Failed to fetch trending papers",
    });
  }
});

/* =====================================================
GET SINGLE PAPER
===================================================== */

router.get("/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid paper id" });
    }

    const filter = { _id: id };

    if (req.user.role !== "admin") {
      filter.status = "approved";
      filter.isActive = true;
    }

    const paper = await Paper.findOne(filter).populate(
      "uploadedBy",
      "name email",
    );

    if (!paper) {
      return res.status(404).json({ success: false, error: "Paper not found" });
    }

    res.json(paper);
  } catch (error) {
    console.error("Fetch paper error:", error);

    res.status(500).json({
      error: "Failed to fetch paper",
    });
  }
});

/* ================= VIEW ================= */

router.post("/:id/view", verifyToken, async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        error: "Invalid paper id",
      });
    }
    const paper = await Paper.findByIdAndUpdate(
      req.params.id,
      { $inc: { views: 1 } },
      { new: true },
    );

    if (!paper) {
      return res.status(404).json({ success: false, error: "Paper not found" });
    }

    res.json({ message: "View counted" });
  } catch (error) {
    next(error);
  }
});

/* ================= DOWNLOAD ================= */

router.post("/:id/download", verifyToken, async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        error: "Invalid paper id",
      });
    }
    const paper = await Paper.findByIdAndUpdate(
      req.params.id,
      { $inc: { downloads: 1 } },
      { new: true },
    );

    if (!paper) {
      return res.status(404).json({ success: false, error: "Paper not found" });
    }

    res.json({ message: "Download counted" });
  } catch (error) {
    next(error);
  }
});
/* =====================================================
RATE (ONE USER ONE RATING)
===================================================== */

router.post("/:id/rate", verifyToken, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        error: "Invalid paper id",
      });
    }
    const { rating } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        error: "Rating must be between 1 and 5",
      });
    }

    const paper = await Paper.findById(req.params.id);

    if (!paper) {
      return res.status(404).json({
        error: "Paper not found",
      });
    }

    const existing = paper.ratings.find(
      (r) => r.user.toString() === req.user._id.toString(),
    );

    if (existing) {
      existing.value = rating;
    } else {
      paper.ratings.push({
        user: req.user._id,
        value: rating,
      });
    }

    await paper.save();

    res.json({
      message: "Rating submitted ⭐",
      averageRating: paper.averageRating,
    });
  } catch (error) {
    console.error("Rating error:", error);

    res.status(500).json({
      error: "Rating failed",
    });
  }
});

/* =====================================================
UPDATE PAPER (ADMIN OR OWNER)
===================================================== */

router.put("/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid paper id" });
    }

    const paper = await Paper.findById(id);

    if (!paper) {
      return res.status(404).json({ success: false, error: "Paper not found" });
    }

    const isOwner = paper.uploadedBy.toString() === req.user._id.toString();

    if (!isOwner && req.user.role !== "admin") {
      return res.status(403).json({ error: "Not allowed to edit this paper" });
    }

    const updates = {};

    if (typeof req.body.title === "string") {
      const nextTitle = req.body.title.trim();

      if (nextTitle.length < 3 || nextTitle.length > 200) {
        return res
          .status(400)
          .json({ error: "Title must be 3-200 characters" });
      }

      updates.title = nextTitle;
    }

    if (typeof req.body.subject === "string") {
      const nextSubject = normalizeSubject(req.body.subject);

      if (!VALID_SUBJECTS.has(nextSubject)) {
        return res.status(400).json({
          success: false,
          error: "Invalid subject",
        });
      }

      updates.subject = nextSubject;
    }

    if (req.body.semester !== undefined) {
      const nextSemester = Number(req.body.semester);

      if (
        !Number.isInteger(nextSemester) ||
        nextSemester < 1 ||
        nextSemester > 8
      ) {
        return res
          .status(400)
          .json({ error: "Semester must be between 1 and 8" });
      }

      updates.semester = nextSemester;
    }

    if (!Object.keys(updates).length) {
      return res.status(400).json({ error: "Nothing to update" });
    }

    const finalTitle = updates.title || paper.title;
    const finalSubject = updates.subject || paper.subject;
    const finalSemester = updates.semester || paper.semester;

    const duplicate = await Paper.findOne({
      _id: { $ne: paper._id },
      title: { $regex: `^${escapeRegex(finalTitle)}$`, $options: "i" },
      subject: { $regex: `^${escapeRegex(finalSubject)}$`, $options: "i" },
      semester: finalSemester,
    });

    if (duplicate) {
      return res.status(400).json({
        error: "Another paper with same title/subject/semester exists",
      });
    }

    Object.assign(paper, updates);
    await paper.save();

    const updatedPaper = await Paper.findById(paper._id).populate(
      "uploadedBy",
      "name email",
    );

    res.json({
      success: true,
      message: "Paper updated successfully",
      paper: updatedPaper,
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(400).json({
        error: "Another paper with same title/subject/semester exists",
      });
    }

    console.error("Update paper error:", error);

    res.status(500).json({
      error: "Failed to update paper",
    });
  }
});

/* =====================================================
DELETE (ADMIN FINAL SAFE)
===================================================== */
router.delete(
  "/admin/reject/:id",
  verifyToken,
  verifyAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ error: "Invalid paper ID" });
      }

      const paper = await Paper.findById(id);

      if (!paper) {
        return res
          .status(404)
          .json({ success: false, error: "Paper not found" });
      }

      /* ================= CLOUDINARY DELETE ================= */

      const publicId = getPublicId(paper.pdfLink);

      if (publicId) {
        try {
          await cloudinary.uploader.destroy(publicId, {
            resource_type: "raw",
          });
        } catch (err) {
          console.error("Cloudinary delete error:", err.message);
        }
      }

      /* ================= LOCAL DELETE (OPTIONAL) ================= */

      if (paper.pdfLink.includes("/uploads/")) {
        try {
          const filename = paper.pdfLink.split("/uploads/")[1];

          if (filename) {
            const filePath = path.join(uploadsDir, filename);

            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
            }
          }
        } catch (err) {
          console.error("Local file delete error:", err.message);
        }
      }

      await paper.deleteOne();

      res.json({
        success: true,
        message: "Paper rejected & deleted (Cloudinary + DB)",
      });
    } catch (error) {
      console.error("Reject paper error:", error);

      res.status(500).json({
        error: "Reject failed",
      });
    }
  },
);
export default router;
