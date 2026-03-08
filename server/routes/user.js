import express from "express";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";

import verifyToken from "../middleware/authMiddleware.js";

import User from "../models/User.js";
import Paper from "../models/Paper.js";

const router = express.Router();

/* =================================================
BOOKMARK PAPER
POST /api/users/bookmark/:id
================================================= */

router.post("/bookmark/:id", verifyToken, async (req, res) => {
  try {
    const paperId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(paperId)) {
      return res.status(400).json({
        error: "Invalid paper ID",
      });
    }

    const paper = await Paper.findById(paperId);

    if (!paper) {
      return res.status(404).json({
        error: "Paper not found",
      });
    }

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        error: "User not found",
      });
    }

    const index = user.bookmarks.indexOf(paperId);

    /* REMOVE BOOKMARK */

    if (index !== -1) {
      user.bookmarks.splice(index, 1);

      await user.save();

      return res.json({
        message: "Bookmark removed",
        bookmarked: false,
      });
    }

    /* ADD BOOKMARK */

    user.bookmarks.push(paperId);

    await user.save();

    res.json({
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
USER DASHBOARD STATS
GET /api/users/stats
================================================= */

router.get("/stats", verifyToken, async (req, res) => {
  try {
    const userId = req.user._id;

    const [uploaded, approved, pending] = await Promise.all([
      Paper.countDocuments({ uploadedBy: userId }),
      Paper.countDocuments({ uploadedBy: userId, status: "approved" }),
      Paper.countDocuments({ uploadedBy: userId, status: "pending" }),
    ]);

    res.json({
      uploaded,
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
GET USER PROFILE
GET /api/users/profile
================================================= */

router.get("/profile", verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select("-password")
      .populate("bookmarks", "title subject semester pdfLink");

    if (!user) {
      return res.status(404).json({
        error: "User not found",
      });
    }

    res.json(user);
  } catch (error) {
    console.error("Profile error:", error);

    res.status(500).json({
      error: "Server error while fetching profile",
    });
  }
});

/* =================================================
GET USER UPLOADED PAPERS
GET /api/users/my-papers
================================================= */

router.get("/my-papers", verifyToken, async (req, res) => {
  try {
    const papers = await Paper.find({
      uploadedBy: req.user._id,
    }).sort({ createdAt: -1 });

    const approved = papers.filter((p) => p.status === "approved").length;
    const pending = papers.filter((p) => p.status === "pending").length;

    res.json({
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
PUT /api/users/update
================================================= */

router.put("/update", verifyToken, async (req, res) => {
  try {
    let { name, password } = req.body;

    const updateData = {};

    /* NAME UPDATE */

    if (name) {
      name = name.trim();

      if (name.length < 3) {
        return res.status(400).json({
          error: "Name must be at least 3 characters",
        });
      }

      updateData.name = name;
    }

    /* PASSWORD UPDATE */

    if (password) {
      password = password.trim();

      if (password.length < 6) {
        return res.status(400).json({
          error: "Password must be at least 6 characters",
        });
      }

      updateData.password = await bcrypt.hash(password, 10);
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        error: "Nothing to update",
      });
    }

    const updatedUser = await User.findByIdAndUpdate(req.user._id, updateData, {
      new: true,
    }).select("-password");

    res.json({
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
DELETE OWN ACCOUNT
DELETE /api/users/delete
================================================= */

router.delete("/delete", verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        error: "User not found",
      });
    }

    /* PREVENT LAST ADMIN DELETE */

    if (user.role === "admin") {
      const adminCount = await User.countDocuments({
        role: "admin",
      });

      if (adminCount <= 1) {
        return res.status(400).json({
          error: "Cannot delete the last admin account",
        });
      }
    }

    await User.findByIdAndDelete(req.user._id);

    res.json({
      message: "Account deleted successfully",
    });
  } catch (error) {
    console.error("Delete error:", error);

    res.status(500).json({
      error: "Server error while deleting account",
    });
  }
});

export default router;
