import express from "express";
import mongoose from "mongoose";
import fs from "fs";
import path from "path";

import Paper from "../models/Paper.js";

import verifyToken from "../middleware/authMiddleware.js";
import verifyAdmin from "../middleware/adminMiddleware.js";
import upload from "../middleware/upload.js";

const router = express.Router();

/* =====================================================
UPLOAD PAPER (ADMIN + USER)
===================================================== */

router.post("/upload", verifyToken, upload.single("pdf"), async (req, res) => {
  try {
    let { title, subject, semester } = req.body;

    if (!title || !subject || !semester || !req.file) {
      return res.status(400).json({
        error: "All fields and PDF file are required",
      });
    }

    /* ================= SUBJECT NORMALIZATION ================= */

    subject = subject.trim().toLowerCase();

    const subjectMap = {
      dbms: "DBMS",
      "data structure": "Data Structure",
      "operating system": "Operating System",
      "computer network": "Computer Network",
      "software engineering": "Software Engineering",
      "artificial intelligence": "Artificial Intelligence",
    };

    subject = subjectMap[subject] || subject;

    /* ================= USER LIMIT ================= */

    if (req.user.role !== "admin") {
      const activeUploads = await Paper.countDocuments({
        uploadedBy: req.user._id,
        status: { $in: ["pending", "approved"] },
      });

      if (activeUploads >= 2) {
        return res.status(400).json({
          error: "Upload limit reached. Max 2 papers allowed.",
        });
      }
    }

    /* ================= DUPLICATE CHECK ================= */

    const existingPaper = await Paper.findOne({
      title: title.trim(),
      subject,
      semester: Number(semester),
    });

    if (existingPaper) {
      return res.status(400).json({
        error: "This paper already exists",
      });
    }

    const filename = req.file.filename;

    const pdfLink = `${req.protocol}://${req.get("host")}/uploads/${filename}`;

    /* ================= ADMIN AUTO APPROVE ================= */

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
    console.error("Upload paper error:", error);

    res.status(500).json({
      error: "Server error while uploading paper",
    });
  }
});

/* =====================================================
GET PAPERS (SEARCH + FILTER + PAGINATION)
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
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { subject: { $regex: search, $options: "i" } },
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
    console.error("Fetch papers error:", error);

    res.status(500).json({
      error: "Server error while fetching papers",
    });
  }
});

/* =====================================================
ADMIN: GET PENDING PAPERS
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
ADMIN APPROVE PAPER
===================================================== */

router.put("/admin/approve/:id", verifyToken, verifyAdmin, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: "Invalid paper id" });
    }

    const paper = await Paper.findByIdAndUpdate(
      req.params.id,
      { status: "approved" },
      { new: true },
    );

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
ADMIN REJECT PAPER
===================================================== */

router.delete(
  "/admin/reject/:id",
  verifyToken,
  verifyAdmin,
  async (req, res) => {
    try {
      const paper = await Paper.findById(req.params.id);

      if (!paper) {
        return res.status(404).json({
          error: "Paper not found",
        });
      }

      if (paper.pdfLink) {
        const filename = paper.pdfLink.split("/uploads/")[1];
        const filePath = path.join(process.cwd(), "uploads", filename);

        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }

      await paper.deleteOne();

      res.json({
        message: "Paper rejected and deleted",
      });
    } catch (error) {
      console.error("Reject paper error:", error);

      res.status(500).json({
        error: "Reject failed",
      });
    }
  },
);

/* =====================================================
TRENDING PAPERS
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
VIEW COUNTER
===================================================== */

router.post("/:id/view", verifyToken, async (req, res) => {
  try {
    await Paper.findByIdAndUpdate(req.params.id, {
      $inc: { views: 1 },
    });

    res.json({ message: "View counted" });
  } catch (error) {
    console.error("View counter error:", error);

    res.status(500).json({
      error: "Failed to count view",
    });
  }
});

/* =====================================================
DOWNLOAD COUNTER
===================================================== */

router.post("/:id/download", verifyToken, async (req, res) => {
  try {
    await Paper.findByIdAndUpdate(req.params.id, {
      $inc: { downloads: 1 },
    });

    res.json({ message: "Download counted" });
  } catch (error) {
    console.error("Download counter error:", error);

    res.status(500).json({
      error: "Failed to count download",
    });
  }
});

/* =====================================================
RATE PAPER
===================================================== */

router.post("/:id/rate", verifyToken, async (req, res) => {
  try {
    const { rating } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        error: "Rating must be between 1 and 5",
      });
    }

    const paper = await Paper.findById(req.params.id);

    paper.addOrUpdateRating(req.user._id, rating);

    await paper.save();

    res.json({ message: "Rating submitted" });
  } catch (error) {
    console.error("Rating error:", error);

    res.status(500).json({
      error: "Rating failed",
    });
  }
});

/* =====================================================
DELETE PAPER (ADMIN)
===================================================== */

router.delete("/:id", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const paper = await Paper.findById(req.params.id);

    if (paper.pdfLink) {
      const filename = paper.pdfLink.split("/uploads/")[1];
      const filePath = path.join(process.cwd(), "uploads", filename);

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await paper.deleteOne();

    res.json({
      message: "Paper deleted successfully",
    });
  } catch (error) {
    console.error("Delete paper error:", error);

    res.status(500).json({
      error: "Server error while deleting paper",
    });
  }
});

export default router;
