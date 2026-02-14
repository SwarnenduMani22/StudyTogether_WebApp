import express from "express";
import verifyToken from "../middleware/authMiddleware.js";
import verifyAdmin from "../middleware/adminMiddleware.js";
import User from "../models/User.js";

const router = express.Router();

/* ---------------- GET ALL USERS ---------------- */
router.get("/users", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const users = await User.find().select("-password");
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

/* ---------------- DELETE USER ---------------- */
router.delete("/users/:id", verifyToken, verifyAdmin, async (req, res) => {
  try {
    // ✅ FIXED: use req.user.id
    if (req.user.id === req.params.id) {
      return res.status(400).json({ error: "You cannot delete yourself" });
    }

    const deletedUser = await User.findByIdAndDelete(req.params.id);

    if (!deletedUser) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ message: "User deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

/* ---------------- CHANGE ROLE ---------------- */
router.put("/users/:id/role", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { role } = req.body;

    if (!["user", "admin"].includes(role)) {
      return res.status(400).json({ error: "Invalid role" });
    }

    // ✅ FIXED: use req.user.id
    if (req.user.id === req.params.id) {
      return res.status(400).json({ error: "You cannot change your own role" });
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true },
    ).select("-password");

    if (!updatedUser) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(updatedUser);
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
