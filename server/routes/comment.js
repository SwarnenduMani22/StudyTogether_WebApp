import express from "express";
import mongoose from "mongoose";
import Comment from "../models/Comment.js";
import verifyToken from "../middleware/authMiddleware.js";

const router = express.Router();

/* ================= HELPER ================= */

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

/* =====================================================
ADD COMMENT
POST /api/v1/comments/:paperId
===================================================== */

router.post("/:paperId", verifyToken, async (req, res) => {
  try {
    const { message } = req.body;
    const { paperId } = req.params;

    if (!isValidObjectId(paperId)) {
      return res.status(400).json({
        success: false,
        error: "Invalid paper id",
      });
    }

    if (!message || !message.trim()) {
      return res.status(400).json({
        success: false,
        error: "Comment message required",
      });
    }

    if (message.trim().length > 500) {
      return res.status(400).json({
        success: false,
        error: "Comment too long (max 500 characters)",
      });
    }

    const comment = await Comment.create({
      paper: paperId,
      user: req.user.id,
      message: message.trim(),
    });

    const populatedComment = await comment.populate("user", "name");

    res.status(201).json({
      success: true,
      message: "Comment added successfully",
      comment: populatedComment,
    });
  } catch (error) {
    console.error("Add comment error:", error.message);

    res.status(500).json({
      success: false,
      error: "Failed to add comment",
    });
  }
});

/* =====================================================
GET COMMENTS
GET /api/v1/comments/:paperId
===================================================== */

router.get("/:paperId", async (req, res) => {
  try {
    const { paperId } = req.params;

    if (!isValidObjectId(paperId)) {
      return res.status(400).json({
        success: false,
        error: "Invalid paper id",
      });
    }

    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Number(req.query.limit) || 10, 50);
    const skip = (page - 1) * limit;

    const comments = await Comment.find({
      paper: paperId,
      isActive: true,
    })
      .populate("user", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Comment.countDocuments({
      paper: paperId,
      isActive: true,
    });

    res.json({
      success: true,
      total,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      comments,
    });
  } catch (error) {
    console.error("Fetch comments error:", error.message);

    res.status(500).json({
      success: false,
      error: "Failed to fetch comments",
    });
  }
});

export default router;
