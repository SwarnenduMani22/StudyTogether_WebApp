import express from "express";
import mongoose from "mongoose";

import verifyToken from "../middleware/authMiddleware.js";
import verifyAdmin from "../middleware/adminMiddleware.js";

import User from "../models/User.js";

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

export default router;
