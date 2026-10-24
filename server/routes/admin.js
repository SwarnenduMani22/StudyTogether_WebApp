import express from "express";
import mongoose from "mongoose";

import verifyToken from "../middleware/authMiddleware.js";
import verifyAdmin from "../middleware/adminMiddleware.js";

import User from "../models/User.js";
import Paper from "../models/Paper.js";
import Transaction from "../models/Transaction.js";
import PlatformKnowledge from "../models/PlatformKnowledge.js";
import { grantCoins } from "../utils/coinManager.js";
const router = express.Router();

const escapeRegex = (value = "") =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/* =====================================================
GET ALL USERS (ADMIN)
GET /api/v1/admin/users
===================================================== */

router.get("/users", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.max(Number(req.query.limit) || 10, 1);
    const skip = (page - 1) * limit;

    const search = (req.query.search || "").trim();
    const safeSearch = escapeRegex(search);

    const filter = search
      ? {
          $or: [
            { name: { $regex: safeSearch, $options: "i" } },
            { email: { $regex: safeSearch, $options: "i" } },
          ],
        }
      : {};

    const users = await User.find(filter)
      .select("-password")
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    const totalUsers = await User.countDocuments(filter);

    res.json({
      success: true,
      users,
      currentPage: page,
      totalPages: Math.ceil(totalUsers / limit),
      totalUsers,
    });
  } catch (error) {
    console.error("Fetch users error:", error);

    res.status(500).json({
      success: false,
      error: "Server error while fetching users",
    });
  }
});

/* =====================================================
DELETE USER
DELETE /api/v1/admin/users/:id
===================================================== */

router.delete("/users/:id", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const userId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        error: "Invalid user ID",
      });
    }

    /* Prevent deleting yourself */

    if (req.user._id.toString() === userId) {
      return res.status(400).json({
        success: false,
        error: "You cannot delete your own account",
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    /* Prevent deleting last admin */

    if (user.role === "admin") {
      const adminCount = await User.countDocuments({ role: "admin" });

      if (adminCount <= 1) {
        return res.status(400).json({
          success: false,
          error: "Cannot delete the last admin",
        });
      }
    }

    await user.deleteOne();

    res.json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    console.error("Delete user error:", error);

    res.status(500).json({
      success: false,
      error: "Server error while deleting user",
    });
  }
});

/* =====================================================
CHANGE USER ROLE
PUT /api/v1/admin/users/:id/role
===================================================== */

router.put("/users/:id/role", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const userId = req.params.id;
    const { role } = req.body;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        error: "Invalid user ID",
      });
    }

    if (!role || !["user", "admin"].includes(role)) {
      return res.status(400).json({
        success: false,
        error: "Invalid role value",
      });
    }

    /* Prevent self role change */

    if (req.user._id.toString() === userId) {
      return res.status(400).json({
        success: false,
        error: "You cannot change your own role",
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    user.role = role;

    await user.save();

    const safeUser = await User.findById(userId).select("-password");

    res.json({
      success: true,
      message: "Role updated successfully",
      user: safeUser,
    });
  } catch (error) {
    console.error("Role update error:", error);

    res.status(500).json({
      success: false,
      error: "Server error while updating role",
    });
  }
});

/* =====================================================
UPDATE USER ACCOUNT STATUS (DISABLE / ENABLE)
PUT /api/v1/admin/users/:id/status
PATCH /api/v1/admin/users/:id/status
===================================================== */

const handleUserStatus = async (req, res) => {
  try {
    const userId = req.params.id;
    const { status, isActive, reason } = req.body;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        error: "Invalid user ID",
      });
    }

    /* Prevent self-disable */
    if (req.user._id.toString() === userId.toString()) {
      return res.status(400).json({
        success: false,
        error: "You cannot disable your own account",
      });
    }

    if (!reason || typeof reason !== "string" || !reason.trim()) {
      return res.status(400).json({
        success: false,
        error: "Reason is required and cannot be empty",
      });
    }

    let isDisabling;
    if (status) {
      const normalized = status.toLowerCase().trim();
      if (normalized === "disabled") {
        isDisabling = true;
      } else if (normalized === "active" || normalized === "enabled") {
        isDisabling = false;
      } else {
        return res.status(400).json({
          success: false,
          error: "Invalid status value. Must be 'active' or 'disabled'",
        });
      }
    } else if (typeof isActive === "boolean") {
      isDisabling = !isActive;
    } else {
      return res.status(400).json({
        success: false,
        error: "Status or isActive is required",
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    const trimmedReason = reason.trim();

    if (isDisabling) {
      user.isActive = false;
      user.status = "disabled";
      user.disabledReason = trimmedReason;
      user.disabledAt = new Date();
      user.disabledBy = req.user._id;
      user.refreshToken = null; // Instantly invalidate active refresh token sessions
    } else {
      user.isActive = true;
      user.status = "active";
      user.disabledReason = null;
      user.disabledAt = null;
      user.disabledBy = null;
    }

    user.statusHistory.push({
      action: isDisabling ? "disabled" : "enabled",
      reason: trimmedReason,
      performedBy: req.user._id,
      performedAt: new Date(),
    });

    await user.save();

    res.json({
      success: true,
      message: isDisabling
        ? "User account disabled successfully"
        : "User account re-enabled successfully",
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        status: user.status,
        disabledReason: user.disabledReason,
        disabledAt: user.disabledAt,
        disabledBy: user.disabledBy,
      },
    });
  } catch (error) {
    console.error("Status update error:", error);

    res.status(500).json({
      success: false,
      error: "Server error while updating user status",
    });
  }
};

router.put("/users/:id/status", verifyToken, verifyAdmin, handleUserStatus);
router.patch("/users/:id/status", verifyToken, verifyAdmin, handleUserStatus);
/* =====================================================
ADMIN DASHBOARD STATS
GET /api/v1/admin/stats
===================================================== */

router.get("/stats", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const [users, admins, papersAgg, pendingPapers, approvedPapers] =
      await Promise.all([
        User.countDocuments(),

        User.countDocuments({ role: "admin" }),

        Paper.aggregate([
          {
            $group: {
              _id: null,
              totalPapers: { $sum: 1 },
              totalViews: { $sum: "$views" },
              totalDownloads: { $sum: "$downloads" },
              totalComments: { $sum: { $cond: [{ $isArray: "$comments" }, { $size: "$comments" }, 0] } },
              totalRatings: { $sum: { $cond: [{ $isArray: "$ratings" }, { $size: "$ratings" }, 0] } },
            },
          },
        ]),

        Paper.countDocuments({ status: "pending" }),

        Paper.countDocuments({ status: "approved" }),
      ]);

    const paperStats = papersAgg[0] || {
      totalPapers: 0,
      totalViews: 0,
      totalDownloads: 0,
      totalComments: 0,
      totalRatings: 0,
    };

    res.json({
      success: true,
      users,
      admins,
      papers: paperStats.totalPapers,
      views: paperStats.totalViews,
      downloads: paperStats.totalDownloads,
      comments: paperStats.totalComments,
      ratings: paperStats.totalRatings,
      pending: pendingPapers,
      approved: approvedPapers,
    });
  } catch (error) {
    console.error("Admin stats error:", error);

    res.status(500).json({
      success: false,
      error: "Failed to fetch admin stats",
    });
  }
});

/* =====================================================
TOP CONTRIBUTORS
GET /api/v1/admin/top-contributors
===================================================== */

router.get("/top-contributors", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const contributors = await Paper.aggregate([
      {
        $match: {
          status: "approved",
          isActive: true,
        },
      },
      {
        $group: {
          _id: "$uploadedBy",
          totalUploads: { $sum: 1 },
        },
      },

      {
        $sort: {
          totalUploads: -1,
        },
      },

      {
        $limit: 10,
      },

      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user",
        },
      },

      {
        $unwind: "$user",
      },

      {
        $project: {
          _id: "$user._id",
          name: "$user.name",
          email: "$user.email",
          role: "$user.role",
          totalUploads: 1,
        },
      },
    ]);

    res.json({
      success: true,
      contributors,
    });
  } catch (error) {
    console.error("Top contributors error:", error);

    res.status(500).json({
      success: false,
      error: "Failed to fetch top contributors",
    });
  }
});

/* =====================================================
TOP COIN HOLDERS
GET /api/v1/admin/top-coin-holders
===================================================== */

router.get("/top-coin-holders", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const users = await User.find({})
      .select("name email role coins badges")
      .sort({ coins: -1 })
      .limit(10);

    res.json({
      success: true,
      users,
    });
  } catch (error) {
    console.error("Top coin holders error:", error);

    res.status(500).json({
      success: false,
      error: "Failed to fetch top coin holders",
    });
  }
});
/* =====================================================
COIN ANALYTICS
GET /api/v1/admin/coin-analytics
===================================================== */

router.get("/coin-analytics", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const [systemCoinsAgg, purchasedCoinsAgg, spentCoinsAgg, totalTransactions] = await Promise.all([
      User.aggregate([
        { $group: { _id: null, total: { $sum: "$coins" } } }
      ]),
      Transaction.aggregate([
        { $match: { type: "purchased" } },
        { $group: { _id: null, total: { $sum: "$amount" } } }
      ]),
      Transaction.aggregate([
        { $match: { type: "spent" } },
        { $group: { _id: null, total: { $sum: "$amount" } } }
      ]),
      Transaction.countDocuments()
    ]);

    const totalCoinsInSystem = systemCoinsAgg[0]?.total || 0;
    const totalCoinsPurchased = purchasedCoinsAgg[0]?.total || 0;
    const totalCoinsSpent = spentCoinsAgg[0]?.total || 0;

    res.json({
      success: true,
      totalCoinsInSystem,
      totalCoinsPurchased,
      totalCoinsSpent,
      totalTransactions,
    });
  } catch (error) {
    console.error("Coin analytics error:", error);

    res.status(500).json({
      success: false,
      error: "Failed to fetch coin analytics",
    });
  }
});

/* =====================================================
REFUND COINS
POST /api/v1/admin/users/:id/refund
===================================================== */
router.post("/users/:id/refund", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const userId = req.params.id;
    const { amount, reason } = req.body;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        error: "Invalid user ID",
      });
    }

    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    const refundAmount = Number(amount);
    if (!Number.isInteger(refundAmount) || refundAmount <= 0) {
      return res.status(400).json({
        success: false,
        error: "Refund amount must be a positive integer",
      });
    }

    if (!reason || !reason.trim()) {
      return res.status(400).json({
        success: false,
        error: "Refund reason is required",
      });
    }

    // Atomic balance update
    const updatedUser = await User.findOneAndUpdate(
      { _id: userId },
      { $inc: { coins: refundAmount } },
      { new: true }
    );

    // Log the transaction
    await Transaction.create({
      user: userId,
      amount: refundAmount,
      type: "refund",
      reason: reason.trim(),
    });

    res.json({
      success: true,
      message: `Successfully refunded ${refundAmount} coins`,
      coins: updatedUser.coins,
    });
  } catch (error) {
    console.error("Refund coins error:", error);
    res.status(500).json({
      success: false,
      error: "Refund failed",
    });
  }
});

/* =====================================================
GRANT COINS (ADMIN MANUAL GRANT)
POST /api/v1/admin/users/:id/grant-coins
===================================================== */
router.post("/users/:id/grant-coins", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const userId = req.params.id;
    const { amount, reason, idempotencyKey } = req.body;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        error: "Invalid user ID",
      });
    }

    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    /* Reject grants to disabled accounts */
    if (targetUser.isActive === false || targetUser.status === "disabled") {
      return res.status(400).json({
        success: false,
        error: "Cannot grant coins to a disabled account",
      });
    }

    const grantAmount = Number(amount);
    if (!Number.isInteger(grantAmount) || grantAmount <= 0) {
      return res.status(400).json({
        success: false,
        error: "Grant amount must be a positive integer",
      });
    }

    const MAX_GRANT_AMOUNT = 10000;
    if (grantAmount > MAX_GRANT_AMOUNT) {
      return res.status(400).json({
        success: false,
        error: `Grant amount cannot exceed ${MAX_GRANT_AMOUNT} coins per grant`,
      });
    }

    if (!reason || typeof reason !== "string" || !reason.trim()) {
      return res.status(400).json({
        success: false,
        error: "Grant reason is required and cannot be empty",
      });
    }

    const key = (idempotencyKey || req.headers["idempotency-key"] || "").trim();
    if (!key) {
      return res.status(400).json({
        success: false,
        error: "idempotencyKey is required for safe retry handling",
      });
    }

    const { updatedUser, transaction, duplicate } = await grantCoins(
      targetUser,
      grantAmount,
      reason.trim(),
      req.user._id,
      key,
    );

    return res.status(200).json({
      success: true,
      message: duplicate
        ? `Coins previously granted (${grantAmount} coins)`
        : `Successfully granted ${grantAmount} coins`,
      coins: updatedUser.coins,
      grantedAmount: grantAmount,
      duplicate: Boolean(duplicate),
      targetUser: {
        _id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
      },
      transaction: {
        _id: transaction._id,
        amount: transaction.amount,
        type: transaction.type,
        reason: transaction.reason,
        status: transaction.status,
        idempotencyKey: transaction.idempotencyKey,
        createdAt: transaction.createdAt,
      },
    });
  } catch (error) {
    if (error.code === "IDEMPOTENCY_CONFLICT" || error.statusCode === 409) {
      return res.status(409).json({
        success: false,
        error: error.message,
      });
    }

    console.error("Grant coins error:", error);
    return res.status(500).json({
      success: false,
      error: "Grant coins failed",
    });
  }
});

/* =====================================================
ADMIN PLATFORM KNOWLEDGE MANAGEMENT
===================================================== */

// List/Search Knowledge
router.get("/platform-knowledge", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { category, status, search } = req.query;
    const filter = {};
    if (category) filter.category = category;
    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { title: { $regex: escapeRegex(search), $options: "i" } },
        { content: { $regex: escapeRegex(search), $options: "i" } }
      ];
    }
    const articles = await PlatformKnowledge.find(filter).sort({ updatedAt: -1 });
    res.json({ success: true, articles });
  } catch (error) {
    console.error("❌ Admin platform-knowledge fetch error:", error);
    res.status(500).json({ success: false, error: "Failed to fetch knowledge articles" });
  }
});

// Get Single Article
router.get("/platform-knowledge/:id", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const article = await PlatformKnowledge.findById(req.params.id);
    if (!article) return res.status(404).json({ success: false, error: "Article not found" });
    res.json({ success: true, article });
  } catch (error) {
    console.error("❌ Admin platform-knowledge get error:", error);
    res.status(500).json({ success: false, error: "Failed to fetch article" });
  }
});

// Create Knowledge Article
router.post("/platform-knowledge", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { title, category, keywords, content, status } = req.body;
    if (!title || !category || !content) {
      return res.status(400).json({ success: false, error: "Title, category, and content are required" });
    }
    const article = await PlatformKnowledge.create({
      title,
      category,
      keywords: keywords || [],
      content,
      status: status || "draft",
      updatedBy: req.user._id
    });
    res.status(201).json({ success: true, message: "Article created successfully", article });
  } catch (error) {
    console.error("❌ Admin platform-knowledge create error:", error);
    res.status(500).json({ success: false, error: "Failed to create article" });
  }
});

// Update Knowledge Article
router.put("/platform-knowledge/:id", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { title, category, keywords, content } = req.body;
    const article = await PlatformKnowledge.findById(req.params.id);
    if (!article) return res.status(404).json({ success: false, error: "Article not found" });

    if (title) article.title = title;
    if (category) article.category = category;
    if (keywords) article.keywords = keywords;
    if (content) article.content = content;
    article.version += 1;
    article.updatedBy = req.user._id;

    await article.save();
    res.json({ success: true, message: "Article updated successfully", article });
  } catch (error) {
    console.error("❌ Admin platform-knowledge update error:", error);
    res.status(500).json({ success: false, error: "Failed to update article" });
  }
});

// Delete Knowledge Article
router.delete("/platform-knowledge/:id", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const result = await PlatformKnowledge.deleteOne({ _id: req.params.id });
    if (result.deletedCount === 0) return res.status(404).json({ success: false, error: "Article not found" });
    res.json({ success: true, message: "Article deleted successfully" });
  } catch (error) {
    console.error("❌ Admin platform-knowledge delete error:", error);
    res.status(500).json({ success: false, error: "Failed to delete article" });
  }
});

// Patch Status
router.patch("/platform-knowledge/:id/status", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    if (!["draft", "published", "archived"].includes(status)) {
      return res.status(400).json({ success: false, error: "Invalid status" });
    }
    const article = await PlatformKnowledge.findByIdAndUpdate(
      req.params.id,
      { $set: { status, updatedBy: req.user._id } },
      { new: true }
    );
    if (!article) return res.status(404).json({ success: false, error: "Article not found" });
    res.json({ success: true, message: "Status updated successfully", article });
  } catch (error) {
    console.error("❌ Admin platform-knowledge status update error:", error);
    res.status(500).json({ success: false, error: "Failed to update status" });
  }
});

// Patch Publish
router.patch("/platform-knowledge/:id/publish", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const article = await PlatformKnowledge.findByIdAndUpdate(
      req.params.id,
      { $set: { status: "published", updatedBy: req.user._id } },
      { new: true }
    );
    if (!article) return res.status(404).json({ success: false, error: "Article not found" });
    res.json({ success: true, message: "Article published successfully", article });
  } catch (error) {
    console.error("❌ Admin platform-knowledge publish error:", error);
    res.status(500).json({ success: false, error: "Failed to publish article" });
  }
});

// Patch Archive
router.patch("/platform-knowledge/:id/archive", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const article = await PlatformKnowledge.findByIdAndUpdate(
      req.params.id,
      { $set: { status: "archived", updatedBy: req.user._id } },
      { new: true }
    );
    if (!article) return res.status(404).json({ success: false, error: "Article not found" });
    res.json({ success: true, message: "Article archived successfully", article });
  } catch (error) {
    console.error("❌ Admin platform-knowledge archive error:", error);
    res.status(500).json({ success: false, error: "Failed to archive article" });
  }
});

export default router;
