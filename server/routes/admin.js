import express from "express";
import verifyToken from "../middleware/authMiddleware.js";
import verifyAdmin from "../middleware/adminMiddleware.js";
import User from "../models/User.js";

const router = express.Router();

/* ================= GET ALL USERS ================= */
router.get("/users", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    const search = req.query.search || "";

    const filter = {
      name: { $regex: search, $options: "i" },
    };

    const users = await User.find(filter)
      .select("-password")
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    const total = await User.countDocuments(filter);

    res.json({
      users,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      totalUsers: total,
    });
  } catch (error) {
    console.error("Fetch users error:", error.message);

    res.status(500).json({
      error: "Server error while fetching users",
    });
  }
});

/* ================= DELETE USER ================= */
router.delete("/users/:id", verifyToken, verifyAdmin, async (req, res) => {
  try {
    if (req.user.id === req.params.id) {
      return res.status(400).json({
        error: "You cannot delete yourself",
      });
    }

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        error: "User not found",
      });
    }

    /* Prevent deleting last admin */
    if (user.role === "admin") {
      const adminCount = await User.countDocuments({ role: "admin" });

      if (adminCount <= 1) {
        return res.status(400).json({
          error: "Cannot delete the last admin",
        });
      }
    }

    await User.findByIdAndDelete(req.params.id);

    res.json({
      message: "User deleted successfully",
    });
  } catch (error) {
    console.error("Delete user error:", error.message);

    res.status(500).json({
      error: "Server error",
    });
  }
});

/* ================= CHANGE ROLE ================= */
router.put("/users/:id/role", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { role } = req.body;

    if (!["user", "admin"].includes(role)) {
      return res.status(400).json({
        error: "Invalid role",
      });
    }

    if (req.user.id === req.params.id) {
      return res.status(400).json({
        error: "You cannot change your own role",
      });
    }

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        error: "User not found",
      });
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true },
    ).select("-password");

    res.json({
      message: "Role updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Role update error:", error.message);

    res.status(500).json({
      error: "Server error",
    });
  }
});

export default router;
