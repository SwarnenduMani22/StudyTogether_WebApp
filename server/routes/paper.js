import express from "express";
import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import jwt from "jsonwebtoken";

import Paper from "../models/Paper.js";
import User from "../models/User.js";
import { addCoins, spendCoins, purchasePaperEntitlement } from "../utils/coinManager.js";
import cloudinary, { getPublicId, deleteCloudinaryAsset } from "../config/cloudinary.js";
import verifyToken from "../middleware/authMiddleware.js";
import verifyAdmin from "../middleware/adminMiddleware.js";
import upload from "../middleware/uploadCloudinary.js";
import { generateBadgesAndRank } from "../services/badgeService.js";
import { logActivity } from "../services/activityService.js";
// AI integration handled via REST API to AI module
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:5001";
const getInternalAiHeaders = (hasJsonBody = false) => {
  const headers = {};
  if (hasJsonBody) headers["Content-Type"] = "application/json";
  if (process.env.INTERNAL_SERVICE_KEY) {
    headers["x-internal-service-key"] = process.env.INTERNAL_SERVICE_KEY;
  }
  return headers;
};
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


/* ================= BADGE SYSTEM ================= */
// Badge logic moved to services/badgeService.js

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

    let paperSaved = false;

    try {
      let { title, subject, semester } = req.body;
      const semesterNumber = Number(semester);

      if (
        !Number.isInteger(semesterNumber) ||
        semesterNumber < 1 ||
        semesterNumber > 8
      ) {
        if (req.file) await deleteCloudinaryAsset(req.file);
        return res.status(400).json({
          success: false,
          error: "Semester must be between 1 and 8",
        });
      }
      if (!title || !subject || !semester || !req.file) {
        if (req.file) await deleteCloudinaryAsset(req.file);
        return res.status(400).json({
          success: false,
          error: "All fields and PDF file are required",
        });
      }

      subject = normalizeSubject(subject);

      if (!VALID_SUBJECTS.has(subject)) {
        if (req.file) await deleteCloudinaryAsset(req.file);
        return res.status(400).json({
          success: false,
          error: "Invalid subject",
        });
      }

      // Check draft intent before evaluating pending-upload limit
      const isDraft =
        req.body.isDraft === true ||
        req.body.isDraft === "true" ||
        req.body.status === "draft";

      if (req.user.role !== "admin" && !isDraft) {
        // ✅ count ONLY pending
        const pendingUploads = await Paper.countDocuments({
          uploadedBy: req.user._id,
          status: "pending",
        });

        // ✅ remaining slots
        const remainingSlots = 2 - pendingUploads;

        if (remainingSlots <= 0) {
          if (req.file) await deleteCloudinaryAsset(req.file);
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
        semester: semesterNumber,
      });

      if (existingPaper) {
        if (req.file) await deleteCloudinaryAsset(req.file);
        return res.status(400).json({
          success: false,
          error: "This paper already exists",
        });
      }
      const pdfLink = req.file.path.replace("/image/upload/", "/raw/upload/");
      const status = req.user.role === "admin" ? "approved" : (isDraft ? "draft" : "pending");

      const paper = await Paper.create({
        title: title.trim(),
        subject,
        semester: semesterNumber,
        pdfLink,
        uploadedBy: req.user._id,
        status,
      });
      paperSaved = true;

      if (status !== "draft") {
        try {
          await generateBadgesAndRank(req.user._id);
        } catch (badgeErr) {
          console.error("Badge generation error:", badgeErr.message);
        }
      }

      res.status(201).json({
        success: true,
        message:
          status === "approved"
            ? "Paper uploaded successfully"
            : status === "draft" 
            ? "Draft saved successfully" 
            : "Paper uploaded and waiting for admin approval",
        paper,
      });
    } catch (error) {
      if (req.file && !paperSaved) {
        await deleteCloudinaryAsset(req.file);
      }

      if (error?.code === 11000) {
        return res.status(400).json({
          success: false,
          error: "This paper already exists",
        });
      }

      console.error("Upload paper error:", error.message);
      return res.status(500).json({
        success: false,
        error: "Server error while uploading paper",
      });
    }
  });
});

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
      filter.$text = { $search: search };
    }

    if (subject) filter.subject = subject;
    const semesterNumber = Number(semester);

    if (
      semester &&
      Number.isInteger(semesterNumber) &&
      semesterNumber >= 1 &&
      semesterNumber <= 8
    ) {
      filter.semester = semesterNumber;
    }

    let sortOption = { createdAt: -1 };

    if (sort === "views") sortOption = { views: -1 };
    if (sort === "downloads") sortOption = { downloads: -1 };

    const papers = await Paper.find(filter)
      .select("-pdfLink")
      .populate("uploadedBy", "name email")
      .lean()
      .skip(skip)
      .limit(limit)
      .sort(sortOption);

    const total = await Paper.countDocuments(filter);

    return res.json({
      success: true,
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
      .sort({ createdAt: -1 })
      .lean();
    res.json({
      success: true,
      papers,
    });
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

    const paper = await Paper.findOneAndUpdate(
      { _id: id, status: "pending" },
      { $set: { status: "approved", reviewedBy: req.user._id } },
      { new: true }
    );

    if (!paper) {
      return res.status(404).json({
        success: false,
        error: "Paper not found or already approved",
      });
    }

    /* ================= REWARD COINS ================= */

    const user = await User.findById(paper.uploadedBy);

    if (user) {
      await addCoins(user, 30, "Paper Approved", paper._id, paper.title);
      await generateBadgesAndRank(user._id);
      await logActivity(user._id, "upload", `${user.name} published a new paper: ${paper.title}`, paper._id, "Paper");
    }

    // Trigger PDF knowledge ingestion asynchronously via AI module API
    fetch(`${AI_SERVICE_URL}/api/v1/internal/ai/process`, {
      method: "POST",
      headers: getInternalAiHeaders(true),
      body: JSON.stringify({ paperId: paper._id }),
    }).catch((err) => console.error("Background ingestion error:", err));

    res.json({
      success: true,
      message: "Paper approved successfully (+30 coins rewarded)",
      paper,
    });
  } catch (error) {
    console.error("Approve paper error:", error);

    return res.status(500).json({
      success: false,
      error: "Approval failed",
    });
  }
});

/* =====================================================
ADMIN REJECT (FINAL SAFE)
===================================================== */
router.delete("/admin/reject/:id", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: "Invalid paper id" });

    const paper = await Paper.findById(id);
    if (!paper) return res.status(404).json({ error: "Paper not found" });

    const publicId = getPublicId(paper.pdfLink);
    if (publicId) await cloudinary.uploader.destroy(publicId, { resource_type: "raw" }).catch(e => console.error(e));

    await paper.deleteOne();
    await logActivity(req.user._id, "reject", `Admin ${req.user.name} rejected paper: ${paper.title}`, null, null);

    // Clean up processed knowledge chunks via AI module API
    fetch(`${AI_SERVICE_URL}/api/v1/internal/ai/knowledge/${id}`, {
      method: "DELETE",
      headers: getInternalAiHeaders(false),
    }).catch((err) => console.error("Background delete ingestion error:", err));

    res.json({ success: true, message: "Paper rejected and deleted" });
  } catch (error) {
    res.status(500).json({ error: "Rejection failed" });
  }
});

/* =====================================================
ADMIN BULK ACTIONS
===================================================== */
router.post("/admin/bulk-approve", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { paperIds } = req.body;
    if (!Array.isArray(paperIds) || !paperIds.length) return res.status(400).json({ error: "No papers selected" });

    const papers = await Paper.find({ _id: { $in: paperIds }, status: "pending" });
    
    let approvedCount = 0;
    for (const paper of papers) {
      paper.status = "approved";
      paper.reviewedBy = req.user._id;
      await paper.save();

      const u = await User.findById(paper.uploadedBy);
      if (u) {
        await addCoins(u, 30, "Paper Approved", paper._id, paper.title);
        await generateBadgesAndRank(u._id);
        await logActivity(u._id, "upload", `${u.name} published a new paper: ${paper.title}`, paper._id, "Paper");
      }
      // Process PDF chunks asynchronously via AI module API
      fetch(`${AI_SERVICE_URL}/api/v1/internal/ai/process`, {
        method: "POST",
        headers: getInternalAiHeaders(true),
        body: JSON.stringify({ paperId: paper._id }),
      }).catch((err) => console.error("Bulk approved ingestion error:", err));
      approvedCount++;
    }

    res.json({ success: true, message: `Successfully approved ${approvedCount} papers` });
  } catch (error) {
    res.status(500).json({ error: "Bulk approve failed" });
  }
});

router.post("/admin/bulk-reject", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { paperIds } = req.body;
    if (!Array.isArray(paperIds) || !paperIds.length) return res.status(400).json({ error: "No papers selected" });

    const papers = await Paper.find({ _id: { $in: paperIds } });
    
    let rejectedCount = 0;
    for (const paper of papers) {
      const publicId = getPublicId(paper.pdfLink);
      if (publicId) await cloudinary.uploader.destroy(publicId, { resource_type: "raw" }).catch(e => console.error(e));

      await paper.deleteOne();
      await logActivity(req.user._id, "reject", `Admin ${req.user.name} rejected paper: ${paper.title}`, null, null);
      
      // Clean up chunks via AI module API
      fetch(`${AI_SERVICE_URL}/api/v1/internal/ai/knowledge/${paper._id}`, {
        method: "DELETE",
        headers: getInternalAiHeaders(false),
      }).catch((err) => console.error("Bulk rejected delete ingestion error:", err));
      rejectedCount++;
    }

    res.json({ success: true, message: `Successfully rejected ${rejectedCount} papers` });
  } catch (error) {
    res.status(500).json({ error: "Bulk reject failed" });
  }
});

/* ================= RELATED PAPERS ================= */
router.get("/:id/related", verifyToken, async (req, res) => {
  try {
    const paper = await Paper.findById(req.params.id);
    if (!paper) return res.status(404).json({ error: "Not found" });
    const related = await Paper.find({
      _id: { $ne: paper._id },
      status: "approved",
      isActive: true,
      $or: [
        { subject: paper.subject },
        { semester: paper.semester }
      ]
    }).select("-pdfLink").limit(3).lean();
    res.json({ success: true, related });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch related papers" });
  }
});

/* =====================================================
OPTIONAL AUTH MIDDLEWARE
===================================================== */

const optionalAuth = async (req, res, next) => {
  req.user = null;
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next();
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    return next();
  }

  const JWT_SECRET = process.env.JWT_SECRET;
  if (!JWT_SECRET) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded?.id) {
      return next();
    }

    const user = await User.findById(decoded.id)
      .select("_id name email role isActive status")
      .lean();

    if (user && user.isActive !== false && user.status !== "disabled") {
      req.user = user;
    }
  } catch {
    req.user = null;
  }

  next();
};

/* =====================================================
TRENDING
===================================================== */

router.get("/trending", optionalAuth, async (req, res) => {
  try {
    const papers = await Paper.aggregate([
      { $match: { isActive: true, status: "approved" } },
      {
        $addFields: {
          averageRating: { $avg: "$ratings.value" },
        },
      },
      {
        $addFields: {
          popularityScore: {
            $add: [
              { $multiply: [{ $ifNull: ["$downloads", 0] }, 2] },
              { $multiply: [{ $ifNull: ["$views", 0] }, 0.5] },
              { $multiply: [{ $ifNull: ["$averageRating", 0] }, 5] },
            ],
          },
        },
      },
      { $sort: { popularityScore: -1, createdAt: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: "users",
          localField: "uploadedBy",
          foreignField: "_id",
          as: "uploadedBy",
        },
      },
      { $unwind: "$uploadedBy" },
      {
        $project: {
          _id: 1,
          title: 1,
          subject: 1,
          semester: 1,
          views: 1,
          downloads: 1,
          averageRating: 1,
          popularityScore: 1,
          status: 1,
          createdAt: 1,
          "uploadedBy._id": 1,
          "uploadedBy.name": 1,
        },
      },
    ]);
    res.json({
      success: true,
      papers,
    });
  } catch (error) {
    console.error("Trending error:", error);

    res.status(500).json({
      error: "Failed to fetch trending papers",
    });
  }
});

/* =====================================================
TOP PAPERS (must appear before /:id catch-all)
===================================================== */
router.get("/top-papers", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const papers = await Paper.find({
      status: "approved",
    })
      .select("title views downloads")
      .sort({
        downloads: -1,
        views: -1,
      })
      .limit(5);

    res.json({
      success: true,
      papers,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to fetch top papers",
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

    const paper = await Paper.findOne(filter)
      .populate("uploadedBy", "name email")
      .lean();

    if (!paper) {
      return res.status(404).json({ success: false, error: "Paper not found" });
    }

    const isOwner = paper.uploadedBy?._id?.toString() === req.user._id.toString();
    const isAdmin = req.user.role === "admin";
    let isFullAccess = isOwner || isAdmin;
    if (!isFullAccess) {
      const caller = await User.findById(req.user._id).select("downloadedPapers").lean();
      isFullAccess = caller?.downloadedPapers?.some((p) => p.toString() === paper._id.toString());
    }
    paper.hasPdf = Boolean(paper.pdfLink);
    if (!isFullAccess) {
      delete paper.pdfLink;
    }

    res.json({
      success: true,
      paper,
    });
  } catch (error) {
    console.error("Fetch paper error:", error);

    return res.status(500).json({
      success: false,
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

    const paper = await Paper.findOne({
      _id: req.params.id,
      status: "approved",
      isActive: true,
    });

    if (!paper) {
      return res.status(404).json({
        success: false,
        error: "Paper not found",
      });
    }

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    /* ================= FREE ACCESS & ATOMIC PREVIEW ================= */

    const isAdmin = user.role === "admin";
    const isOwner = paper.uploadedBy.toString() === user._id.toString();
    const alreadyDownloaded = user.downloadedPapers.some(
      (id) => id.toString() === paper._id.toString()
    );
    const alreadyPreviewed = user.previewedPapers.some(
      (id) => id.toString() === paper._id.toString()
    );

    let currentCoins = user.coins;

    if (!isAdmin && !isOwner && !alreadyDownloaded && !alreadyPreviewed) {
      try {
        const purchaseResult = await purchasePaperEntitlement({
          userId: user._id,
          paperId: paper._id,
          entitlementType: "preview",
          paperTitle: paper.title,
        });
        currentCoins = purchaseResult.coins;
      } catch (err) {
        if (err.message === "INSUFFICIENT_COINS" || err.code === "INSUFFICIENT_COINS") {
          return res.status(400).json({
            success: false,
            error: "Not enough coins for preview",
          });
        }
        if (err.code === "IDEMPOTENCY_IN_PROGRESS") {
          return res.status(409).json({
            success: false,
            error: err.message,
          });
        }
        throw err;
      }
    }

    // Atomic update to paper view counter
    Paper.findByIdAndUpdate(paper._id, {
      $addToSet: { viewedBy: user._id },
      $inc: { views: 1 },
    }).catch((err) => console.error("Paper view counter update error:", err.message));

    res.json({
      success: true,
      message: "Preview unlocked",
      coins: currentCoins,
      pdfLink: paper.pdfLink,
    });
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

    const paper = await Paper.findOne({
      _id: req.params.id,
      status: "approved",
      isActive: true,
    });

    if (!paper) {
      return res.status(404).json({
        success: false,
        error: "Paper not found",
      });
    }

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    /* ================= FREE ACCESS & ATOMIC DOWNLOAD ================= */

    const isAdmin = user.role === "admin";
    const isOwner = paper.uploadedBy.toString() === user._id.toString();
    const alreadyDownloaded = user.downloadedPapers.some(
      (id) => id.toString() === paper._id.toString()
    );

    let currentCoins = user.coins;

    if (!isAdmin && !isOwner && !alreadyDownloaded) {
      try {
        const purchaseResult = await purchasePaperEntitlement({
          userId: user._id,
          paperId: paper._id,
          entitlementType: "download",
          paperTitle: paper.title,
        });
        currentCoins = purchaseResult.coins;
      } catch (err) {
        if (err.message === "INSUFFICIENT_COINS" || err.code === "INSUFFICIENT_COINS") {
          return res.status(400).json({
            success: false,
            error: "Not enough coins for download",
          });
        }
        if (err.code === "IDEMPOTENCY_IN_PROGRESS") {
          return res.status(409).json({
            success: false,
            error: err.message,
          });
        }
        throw err;
      }
    }

    // Atomic update to paper download counter
    Paper.findByIdAndUpdate(paper._id, {
      $inc: { downloads: 1 },
    }).catch((err) => console.error("Paper download counter update error:", err.message));

    // Non-fatal background badge calculation
    generateBadgesAndRank(req.user._id).catch((err) =>
      console.error("Badge generation background error:", err.message)
    );

    res.json({
      success: true,
      message: "Download unlocked",
      coins: currentCoins,
      pdfLink: paper.pdfLink,
    });
  } catch (error) {
    next(error);
  }
});

/* =====================================================
RATE (ONE USER ONE RATING)
===================================================== */

router.post("/:id/rate", verifyToken, async (req, res) => {
  try {
    if (req.user.role === "admin") {
      return res.status(403).json({
        success: false,
        error: "Admins cannot rate papers",
      });
    }
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        error: "Invalid paper id",
      });
    }
    const { rating } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        error: "Rating must be between 1 and 5",
      });
    }

    const paper = await Paper.findOne({
      _id: req.params.id,
      status: "approved",
      isActive: true,
    });

    if (!paper) {
      return res.status(404).json({
        success: false,
        error: "Paper not found",
      });
    }

    const uploaderId = paper.uploadedBy?._id
      ? paper.uploadedBy._id.toString()
      : paper.uploadedBy?.toString();
    const userId = req.user?._id
      ? req.user._id.toString()
      : req.user?.id?.toString();

    if (uploaderId && userId && uploaderId === userId) {
      return res.status(403).json({
        success: false,
        error: "Authors cannot rate their own papers",
      });
    }

    const existing = paper.ratings.find(
      (r) => r.user.toString() === req.user._id.toString(),
    );
    if (existing && existing.value === rating) {
      return res.status(400).json({
        success: false,
        error: "You already gave this rating",
      });
    }
    if (existing) {
      existing.value = rating;
    } else {
      paper.ratings.push({
        user: req.user._id,
        value: rating,
      });
    }
    await paper.save();
    await generateBadgesAndRank(req.user._id);

    res.json({
      success: true,
      message: "Rating submitted ⭐",
      averageRating: paper.averageRating,
    });
  } catch (error) {
    console.error("Rating error:", error);

    res.status(500).json({
      success: false,
      error: "Rating failed",
    });
  }
});

/* =====================================================
ADD COMMENT
===================================================== */

router.post("/:id/comment", verifyToken, async (req, res) => {
  try {
    const { text } = req.body;

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        error: "Invalid paper id",
      });
    }

    if (!text || text.trim().length < 2 || text.trim().length > 500) {
      return res.status(400).json({
        success: false,
        error: "Comment must be between 2 and 500 characters",
      });
    }

    const paper = await Paper.findOne({
      _id: req.params.id,
      status: "approved",
      isActive: true,
    });

    if (!paper) {
      return res.status(404).json({
        success: false,
        error: "Paper not found",
      });
    }

    paper.comments.push({
      user: req.user._id,
      text: text.trim(),
    });

    await paper.save();
    await generateBadgesAndRank(req.user._id);

    await paper.populate("comments.user", "name");

    res.json({
      success: true,
      message: "Comment added successfully",
      comments: paper.comments,
    });
  } catch (error) {
    console.error("Comment error:", error);

    res.status(500).json({
      success: false,
      error: "Failed to add comment",
    });
  }
});

/* =====================================================
DELETE COMMENT
===================================================== */

router.delete("/:paperId/comment/:commentId", verifyToken, async (req, res) => {
  try {
    const { paperId, commentId } = req.params;

    if (
      !mongoose.Types.ObjectId.isValid(paperId) ||
      !mongoose.Types.ObjectId.isValid(commentId)
    ) {
      return res.status(400).json({
        success: false,
        error: "Invalid id",
      });
    }

    const paper = await Paper.findOne({
      _id: paperId,
      isActive: true,
    });

    if (!paper) {
      return res.status(404).json({
        success: false,
        error: "Paper not found",
      });
    }

    const comment = paper.comments.id(commentId);

    if (!comment) {
      return res.status(404).json({
        success: false,
        error: "Comment not found",
      });
    }

    const isOwner = comment.user.toString() === req.user._id.toString();

    const isAdmin = req.user.role === "admin";

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        error: "Not allowed",
      });
    }

    paper.comments.pull(commentId);

    await paper.save();

    res.json({
      success: true,
      message: "Comment deleted successfully",
    });
  } catch (error) {
    console.error("Delete comment error:", error);

    res.status(500).json({
      success: false,
      error: "Failed to delete comment",
    });
  }
});
/* =====================================================
UPDATE PAPER (ADMIN OR OWNER)
===================================================== */

router.put("/:id", verifyToken, (req, res) => {
  upload.single("pdf")(req, res, async (err) => {
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

    let paperSaved = false;

    try {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        if (req.file) await deleteCloudinaryAsset(req.file);
        return res.status(400).json({ success: false, error: "Invalid paper id" });
      }

      const paper = await Paper.findOne({
        _id: id,
        isActive: true,
      });

      if (!paper) {
        if (req.file) await deleteCloudinaryAsset(req.file);
        return res.status(404).json({ success: false, error: "Paper not found" });
      }

      const isOwner = paper.uploadedBy.toString() === req.user._id.toString();

      if (!isOwner && req.user.role !== "admin") {
        if (req.file) await deleteCloudinaryAsset(req.file);
        return res.status(403).json({ success: false, error: "Not allowed to edit this paper" });
      }

      const updates = {};

      if (typeof req.body.title === "string") {
        const nextTitle = req.body.title.trim();

        if (nextTitle.length < 3 || nextTitle.length > 200) {
          if (req.file) await deleteCloudinaryAsset(req.file);
          return res
            .status(400)
            .json({ success: false, error: "Title must be 3-200 characters" });
        }

        updates.title = nextTitle;
      }

      if (typeof req.body.subject === "string") {
        const nextSubject = normalizeSubject(req.body.subject);

        if (!VALID_SUBJECTS.has(nextSubject)) {
          if (req.file) await deleteCloudinaryAsset(req.file);
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
          if (req.file) await deleteCloudinaryAsset(req.file);
          return res
            .status(400)
            .json({ success: false, error: "Semester must be between 1 and 8" });
        }

        updates.semester = nextSemester;
      }

      let oldPublicId = null;
      if (req.file) {
        oldPublicId = getPublicId(paper.pdfLink);
        updates.pdfLink = req.file.path.replace("/image/upload/", "/raw/upload/");
      }

      if (req.body.isDraft !== undefined) {
        const isDraft = req.body.isDraft === "true" || req.body.isDraft === true;
        if (paper.status === "draft" && !isDraft) {
          updates.status = req.user.role === "admin" ? "approved" : "pending";
        } else if (paper.status === "draft" && isDraft) {
          updates.status = "draft";
        }
      }

      if (req.body.status && req.user.role === "admin") {
        updates.status = req.body.status;
      } else if (
        req.body.status === "pending" &&
        paper.status === "draft" &&
        req.user.role !== "admin"
      ) {
        updates.status = "pending";
      }

      if (updates.status === "pending" && req.user.role !== "admin") {
        const pendingUploads = await Paper.countDocuments({
          uploadedBy: req.user._id,
          status: "pending",
          _id: { $ne: paper._id },
        });

        const remainingSlots = 2 - pendingUploads;

        if (remainingSlots <= 0) {
          if (req.file) await deleteCloudinaryAsset(req.file);
          return res.status(400).json({
            success: false,
            error: "Upload limit reached (Max 2 pending papers allowed)",
          });
        }
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
        if (req.file) await deleteCloudinaryAsset(req.file);
        return res.status(400).json({
          success: false,
          error: "Another paper with same title/subject/semester exists",
        });
      }

      Object.assign(paper, updates);
      await paper.save();
      paperSaved = true;

      if (oldPublicId) {
        await deleteCloudinaryAsset(oldPublicId);
      }

      // Trigger reprocess of PDF knowledge chunks if approved
      if (paper.status === "approved") {
        fetch(`${AI_SERVICE_URL}/api/v1/internal/ai/reprocess`, {
          method: "POST",
          headers: getInternalAiHeaders(true),
          body: JSON.stringify({ paperId: paper._id }),
        })
          .then(async (aiRes) => {
            if (!aiRes.ok) {
              const errText = await aiRes.text().catch(() => "");
              console.error(`Background reprocess failed [HTTP ${aiRes.status}]: ${errText}`);
            }
          })
          .catch((err) => console.error("Background reprocess network error:", err.message));
      }

      if (updates.status && updates.status !== "draft" && paper.status !== "draft") {
        try {
          await generateBadgesAndRank(paper.uploadedBy);
        } catch (badgeErr) {
          console.error("Badge generation error in update:", badgeErr.message);
        }
      }

      const updatedPaper = await Paper.findById(paper._id)
        .populate("uploadedBy", "name email")
        .lean();

      res.json({
        success: true,
        message: "Paper updated successfully",
        paper: updatedPaper,
      });
    } catch (error) {
      if (req.file && !paperSaved) {
        await deleteCloudinaryAsset(req.file);
      }

      if (error?.code === 11000) {
        return res.status(400).json({
          success: false,
          error: "Another paper with same title/subject/semester exists",
        });
      }

      console.error("Update paper error:", error);

      res.status(500).json({
        success: false,
        error: "Failed to update paper",
      });
    }
  });
});

/* =====================================================
DELETE PAPER (ADMIN OR OWNER)
===================================================== */
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: "Invalid paper ID" });
    }

    const paper = await Paper.findById(id);

    if (!paper) {
      return res.status(404).json({ success: false, error: "Paper not found" });
    }

    const isOwner = paper.uploadedBy.toString() === req.user._id.toString();
    const isAdmin = req.user.role === "admin";

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ success: false, error: "Not allowed to delete this paper" });
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
    if (paper.pdfLink && paper.pdfLink.includes("/uploads/")) {
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

    // Clean up processed knowledge chunks
    fetch(`${AI_SERVICE_URL}/api/v1/internal/ai/knowledge/${id}`, {
      method: "DELETE",
      headers: getInternalAiHeaders(false),
    })
      .then(async (aiRes) => {
        if (!aiRes.ok) {
          const errText = await aiRes.text().catch(() => "");
          console.error(`Background delete ingestion failed [HTTP ${aiRes.status}]: ${errText}`);
        }
      })
      .catch((err) => console.error("Background delete ingestion network error:", err.message));

    res.json({
      success: true,
      message: "Paper deleted successfully (Cloudinary + DB)",
    });
  } catch (error) {
    console.error("Delete paper error:", error);
    res.status(500).json({
      success: false,
      error: "Delete failed",
    });
  }
});

export { getPublicId, deleteCloudinaryAsset };
export default router;
