import express from "express";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";

import verifyToken from "../middleware/authMiddleware.js";

import User from "../models/User.js";
import Paper from "../models/Paper.js";

const router = express.Router();
const getUserRank = (coins) => {
  if (coins >= 500) return "Legend";
  if (coins >= 250) return "Expert";
  if (coins >= 100) return "Scholar";
  if (coins >= 50) return "Explorer";
  return "Beginner";
};
/* =================================================
BOOKMARK PAPER (SAFE TOGGLE)
================================================= */

router.post("/bookmark/:id", verifyToken, async (req, res) => {
  try {
    const paperId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(paperId)) {
      return res.status(400).json({ error: "Invalid paper ID" });
    }

    const paper = await Paper.findById(paperId);

    if (!paper) {
      return res.status(404).json({ success: false, error: "Paper not found" });
    }

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const alreadyBookmarked = user.bookmarks.some(
      (id) => id.toString() === paperId,
    );

    if (alreadyBookmarked) {
      user.bookmarks = user.bookmarks.filter((id) => id.toString() !== paperId);

      await user.save();

      return res.json({
        success: true,
        message: "Bookmark removed",
        bookmarked: false,
      });
    }

    user.bookmarks.push(paperId);
    await user.save();

    res.json({
      success: true,
      message: "Paper bookmarked",
      bookmarked: true,
    });
  } catch (error) {
    console.error("Bookmark error:", error);

    res.status(500).json({
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
      rank: getUserRank(user.coins),
    });
  } catch (error) {
    console.error("Profile error:", error);

    res.status(500).json({
      error: "Server error while fetching profile",
    });
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
          error: "Name must be between 3 and 50 characters",
        });
      }

      updateData.name = name;
    }

    if (password) {
      password = password.trim();

      if (password.length < 6) {
        return res.status(400).json({
          error: "Password must be at least 6 characters",
        });
      }

      updateData.password = await bcrypt.hash(password, 10);
    }

    if (!Object.keys(updateData).length) {
      return res.status(400).json({
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

    await Promise.all([
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
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    const totalEarned = user.coinHistory
      .filter((item) => ["earned", "bonus"].includes(item.type))
      .reduce((sum, item) => sum + item.amount, 0);

    const totalSpent = user.coinHistory
      .filter((item) => item.type === "spent")
      .reduce((sum, item) => sum + item.amount, 0);

    const totalPurchased = user.coinHistory
      .filter((item) => item.type === "purchase")
      .reduce((sum, item) => sum + item.amount, 0);

    res.json({
      success: true,
      currentBalance: user.coins,
      totalEarned,
      totalSpent,
      totalPurchased,
      transactions: user.coinHistory,
    });
  } catch (error) {
    console.error("Coin overview error:", error);

    res.status(500).json({
      success: false,
      error: "Failed to load coin overview",
    });
  }
});

/* =================================================
LEADERBOARD
================================================= */

router.get("/leaderboard", verifyToken, async (req, res) => {
  try {
    const users = await User.aggregate([
      {
        $lookup: {
          from: "papers",
          localField: "_id",
          foreignField: "uploadedBy",
          as: "papers",
        },
      },

      {
        $addFields: {
          totalUploads: {
            $size: "$papers",
          },

          approvedUploads: {
            $size: {
              $filter: {
                input: "$papers",
                as: "paper",
                cond: {
                  $eq: ["$$paper.status", "approved"],
                },
              },
            },
          },
        },
      },

      {
        $project: {
          name: 1,
          coins: 1,
          role: 1,
          totalUploads: 1,
          approvedUploads: 1,
        },
      },

      {
        $sort: {
          coins: -1,
          approvedUploads: -1,
          totalUploads: -1,
        },
      },

      {
        $limit: 10,
      },
    ]);

    const leaderboard = users.map((user) => ({
      ...user,
      rank: getUserRank(user.coins),
    }));

    res.json({
      success: true,
      leaderboard,
    });
  } catch (error) {
    console.error("Leaderboard error:", error);

    res.status(500).json({
      error: "Failed to fetch leaderboard",
    });
  }
});

export default router;
