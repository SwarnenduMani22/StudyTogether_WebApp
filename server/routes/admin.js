import express from "express";
import mongoose from "mongoose";

import verifyToken from "../middleware/authMiddleware.js";
import verifyAdmin from "../middleware/adminMiddleware.js";

import User from "../models/User.js";
import Paper from "../models/Paper.js";
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
    };

    res.json({
      success: true,
      users,
      admins,
      papers: paperStats.totalPapers,
      views: paperStats.totalViews,
      downloads: paperStats.totalDownloads,
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
    const analytics = await User.aggregate([
      {
        $project: {
          coins: 1,
          coinHistory: 1,
        },
      },

      {
        $group: {
          _id: null,

          totalCoinsInSystem: {
            $sum: "$coins",
          },

          allTransactions: {
            $push: "$coinHistory",
          },
        },
      },
    ]);

    const data = analytics[0] || {
      totalCoinsInSystem: 0,
      allTransactions: [],
    };

    const transactions = data.allTransactions.flat();

    const totalCoinsPurchased = transactions
      .filter((t) => t.type === "purchase")
      .reduce((sum, t) => sum + t.amount, 0);

    const totalCoinsSpent = transactions
      .filter((t) => t.type === "spent")
      .reduce((sum, t) => sum + t.amount, 0);

    const totalTransactions = transactions.length;

    res.json({
      success: true,

      totalCoinsInSystem: data.totalCoinsInSystem,

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

export default router;
