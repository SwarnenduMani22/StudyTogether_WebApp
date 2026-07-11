import express from "express";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";

import verifyToken from "../middleware/authMiddleware.js";

import User from "../models/User.js";
import Paper from "../models/Paper.js";
import Activity from "../models/Activity.js";
import Transaction from "../models/Transaction.js";
import { calculateUserRank } from "../services/rankService.js";
import cloudinary from "../config/cloudinary.js";

const router = express.Router();

const getPublicId = (url = "") => {
  try {
    if (!url.includes("res.cloudinary.com")) return null;
    const parts = url.split("/");
    const fileWithExt = parts.slice(-2).join("/");
    return fileWithExt.replace(/\.[^/.]+$/, "");
  } catch {
    return null;
  }
};

/* =================================================
BOOKMARK PAPER (SAFE TOGGLE)
================================================= */

router.post("/bookmark/:id", verifyToken, async (req, res) => {
  try {
    const paperId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(paperId)) {
      return res.status(400).json({ success: false, error: "Invalid paper ID" });
    }

    const paper = await Paper.findById(paperId);

    if (!paper) {
      return res.status(404).json({ success: false, error: "Paper not found" });
    }

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    const alreadyBookmarked = user.bookmarks.some(
      (id) => id.toString() === paperId,
    );

    if (alreadyBookmarked) {
      await User.updateOne({ _id: req.user._id }, { $pull: { bookmarks: paperId } });

      return res.json({
        success: true,
        message: "Bookmark removed",
        bookmarked: false,
      });
    }

    await User.updateOne({ _id: req.user._id }, { $addToSet: { bookmarks: paperId } });

    res.json({
      success: true,
      message: "Paper bookmarked",
      bookmarked: true,
    });
  } catch (error) {
    console.error("Bookmark error:", error);

    res.status(500).json({
      success: false,
      error: "Server error while bookmarking paper",
    });
  }
});

/* =================================================
USER DASHBOARD STATS (FAST)
================================================= */

router.get("/stats", verifyToken, async (req, res) => {
  try {
    const userId = req.user._id;

    const [approved, pending] = await Promise.all([
      Paper.countDocuments({ uploadedBy: userId, status: "approved" }),
      Paper.countDocuments({ uploadedBy: userId, status: "pending" }),
    ]);

    res.json({
      success: true,
      total: approved + pending,
      approved,
      pending,
    });
  } catch (error) {
    console.error("User stats error:", error);

    res.status(500).json({
      error: "Failed to fetch user stats",
    });
  }
});

/* =================================================
GET PROFILE
================================================= */

router.get("/profile", verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select("-password")
      .populate({
        path: "bookmarks",
        select: "title subject semester pdfLink",
      });
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }
    res.json({
      success: true,
      user,
      rank: calculateUserRank(user.coins, user.approvedUploads || 0), // Ideally approvedUploads should be calculated or denormalized
    });
  } catch (error) {
    console.error("Profile error:", error);

    res.status(500).json({
      error: "Server error while fetching profile",
    });
  }
});

/* =================================================
PUBLIC PROFILE
================================================= */
router.get("/public/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select("name rank badges coins totalUploads approvedUploads");
    if (!user) return res.status(404).json({ error: "User not found" });

    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch public profile" });
  }
});

/* =================================================
PUBLIC PROFILE STATS (Monthly)
================================================= */
router.get("/public/:id/stats", async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.params.id);
    const monthlyUploads = await Paper.aggregate([
      { $match: { uploadedBy: userId, status: "approved" } },
      { $group: { _id: { $month: "$createdAt" }, count: { $sum: 1 } } },
      { $sort: { "_id": 1 } }
    ]);
    res.json({ success: true, monthlyUploads });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

/* =================================================
COMMUNITY ACTIVITY FEED
================================================= */
router.get("/activity", async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 20;
    const activities = await Activity.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("user", "name rank");
      
    res.json({ success: true, activities });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to fetch activity feed" });
  }
});

/* =================================================
MY PAPERS (CLEAN + OPTIMIZED)
================================================= */

router.get("/my-papers", verifyToken, async (req, res) => {
  try {
    const userId = req.user._id;

    const papers = await Paper.find({ uploadedBy: userId })
      .sort({ createdAt: -1 })
      .lean();

    let approved = 0;
    let pending = 0;

    papers.forEach((p) => {
      if (p.status === "approved") approved++;
      if (p.status === "pending") pending++;
    });

    res.json({
      success: true,
      papers,
      approved,
      pending,
      total: papers.length,
    });
  } catch (error) {
    console.error("User papers error:", error);

    res.status(500).json({
      error: "Failed to fetch user papers",
    });
  }
});

/* =================================================
UPDATE PROFILE
================================================= */

router.put("/update", verifyToken, async (req, res) => {
  try {
    let { name, password } = req.body;

    const updateData = {};

    if (name) {
      name = name.trim();

      if (name.length < 3 || name.length > 50) {
        return res.status(400).json({
          success: false,
          error: "Name must be between 3 and 50 characters",
        });
      }

      updateData.name = name;
    }

    if (password) {
      password = password.trim();

      if (password.length < 8) {
        return res.status(400).json({
          success: false,
          error: "Password must be at least 8 characters",
        });
      }

      updateData.password = await bcrypt.hash(password, 10);
      updateData.refreshToken = null; // Invalidate current session/token on password change
    }

    if (!Object.keys(updateData).length) {
      return res.status(400).json({
        success: false,
        error: "Nothing to update",
      });
    }

    const updatedUser = await User.findByIdAndUpdate(req.user._id, updateData, {
      new: true,
      runValidators: true,
    }).select("-password");

    res.json({
      success: true,
      message: "Profile updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Update error:", error);

    res.status(500).json({
      success: false,
      error: "Server error during update",
    });
  }
});

/* =================================================
DELETE ACCOUNT (SAFE ADMIN CHECK)
================================================= */

router.delete("/delete", verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (user.role === "admin") {
      const adminCount = await User.countDocuments({ role: "admin" });

      if (adminCount <= 1) {
        return res.status(400).json({
          error: "Cannot delete the last admin",
        });
      }
    }

    const userPapers = await Paper.find({ uploadedBy: req.user._id }).select('_id pdfLink');
    const paperIds = userPapers.map(p => p._id);

    // Delete PDFs from Cloudinary
    for (const paper of userPapers) {
      const publicId = getPublicId(paper.pdfLink);
      if (publicId) {
        try {
          await cloudinary.uploader.destroy(publicId, { resource_type: "raw" });
        } catch (err) {
          console.error("Cloudinary delete error:", err.message);
        }
      }
    }

    await Promise.all([
      User.updateMany({}, {
        $pull: {
          bookmarks: { $in: paperIds },
          downloadedPapers: { $in: paperIds },
          previewedPapers: { $in: paperIds }
        }
      }),
      Paper.deleteMany({
        uploadedBy: req.user._id,
      }),
      User.findByIdAndDelete(req.user._id),
    ]);

    res.json({
      success: true,
      message: "Account deleted successfully",
    });
  } catch (error) {
    console.error("Delete error:", error);

    res.status(500).json({
      error: "Server error while deleting account",
    });
  }
});

router.get("/coin-overview", verifyToken, async (req, res) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.max(Number(req.query.limit) || 10, 1);
    const userId = new mongoose.Types.ObjectId(req.user._id);
    const filterType = req.query.type || "all";

    const user = await User.findById(userId).select("coins");
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    const [stats] = await Transaction.aggregate([
      { $match: { user: userId } },
      {
        $group: {
          _id: null,
          totalEarned: { $sum: { $cond: [{ $in: ["$type", ["earned", "bonus", "refund"]] }, "$amount", 0] } },
          totalSpent: { $sum: { $cond: [{ $eq: ["$type", "spent"] }, "$amount", 0] } },
          totalPurchased: { $sum: { $cond: [{ $eq: ["$type", "purchased"] }, "$amount", 0] } }
        }
      }
    ]);

    const query = { user: userId };
    if (filterType && filterType !== "all") {
      if (filterType === "purchased") {
        query.type = "purchased";
      } else {
        query.type = filterType;
      }
    }

    const totalTransactions = await Transaction.countDocuments(query);
    const transactions = await Transaction.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    res.json({
      success: true,
      currentBalance: user.coins,
      totalEarned: stats?.totalEarned || 0,
      totalSpent: stats?.totalSpent || 0,
      totalPurchased: stats?.totalPurchased || 0,
      transactions,
      totalPages: Math.ceil(totalTransactions / limit),
      currentPage: page,
    });
  } catch (error) {
    console.error("Coin overview error:", error);
    res.status(500).json({ success: false, error: "Failed to load coin overview" });
  }
});

/* =================================================
LEADERBOARD (OPTIMIZED)
================================================= */

router.get("/leaderboard", verifyToken, async (req, res) => {
  try {
    const users = await User.find()
      .select("name coins role totalUploads approvedUploads rank")
      .sort({
        coins: -1,
        approvedUploads: -1,
        totalUploads: -1,
      })
      .limit(10)
      .lean();

    res.json({
      success: true,
      leaderboard: users,
    });
  } catch (error) {
    console.error("Leaderboard error:", error);

    res.status(500).json({
      success: false,
      error: "Failed to fetch leaderboard",
    });
  }
});

export default router;
