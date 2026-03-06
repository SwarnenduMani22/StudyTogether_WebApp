import express from "express";
import bcrypt from "bcryptjs";
import verifyToken from "../middleware/authMiddleware.js";
import User from "../models/User.js";

const router = express.Router();

/* ================= GET PROFILE ================= */
/* 🔐 GET /api/users/profile */
router.get("/profile", verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(user);
  } catch (error) {
    console.error("Profile error:", error.message);
    res.status(500).json({ error: "Server error" });
  }
});

/* ================= UPDATE PROFILE ================= */
/* 🔐 PUT /api/users/update */
router.put("/update", verifyToken, async (req, res) => {
  try {
    const { name, password } = req.body;

    const updateData = {};

    /* ---- Validate Name ---- */
    if (name) {
      if (name.trim().length < 3) {
        return res.status(400).json({
          error: "Name must be at least 3 characters",
        });
      }

      updateData.name = name.trim();
    }

    /* ---- Validate Password ---- */
    if (password) {
      if (password.length < 6) {
        return res.status(400).json({
          error: "Password must be at least 6 characters",
        });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      updateData.password = hashedPassword;
    }

    /* ---- Nothing to update ---- */
    if (!name && !password) {
      return res.status(400).json({
        error: "Nothing to update",
      });
    }

    const updatedUser = await User.findByIdAndUpdate(req.user.id, updateData, {
      new: true,
    }).select("-password");

    if (!updatedUser) {
      return res.status(404).json({
        error: "User not found",
      });
    }

    res.json({
      message: "Profile updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Update error:", error.message);

    res.status(500).json({
      error: "Server error during update",
    });
  }
});

/* ================= DELETE OWN ACCOUNT ================= */
/* 🔐 DELETE /api/users/delete */
router.delete("/delete", verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        error: "User not found",
      });
    }

    /* ---- Prevent deleting last admin ---- */
    if (user.role === "admin") {
      const adminCount = await User.countDocuments({ role: "admin" });

      if (adminCount <= 1) {
        return res.status(400).json({
          error: "Cannot delete the last admin account",
        });
      }
    }

    await User.findByIdAndDelete(req.user.id);

    res.json({
      message: "Account deleted successfully",
    });
  } catch (error) {
    console.error("Delete error:", error.message);

    res.status(500).json({
      error: "Server error",
    });
  }
});

export default router;
