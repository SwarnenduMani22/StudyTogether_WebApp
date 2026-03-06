import express from "express";
import verifyToken from "../middleware/authMiddleware.js";
import verifyAdmin from "../middleware/adminMiddleware.js";

import User from "../models/User.js";
import Paper from "../models/Paper.js";

const router = express.Router();

/* ================= ADMIN ANALYTICS ================= */
router.get("/stats", verifyToken, verifyAdmin, async (req, res) => {
  try {
    /* ---- Run queries in parallel (faster) ---- */
    const [totalUsers, totalAdmins, totalPapers, totalViews, totalDownloads] =
      await Promise.all([
        User.countDocuments(),
        User.countDocuments({ role: "admin" }),
        Paper.countDocuments(),
        Paper.aggregate([{ $group: { _id: null, total: { $sum: "$views" } } }]),
        Paper.aggregate([
          { $group: { _id: null, total: { $sum: "$downloads" } } },
        ]),
      ]);

    res.json({
      users: totalUsers,
      admins: totalAdmins,
      papers: totalPapers,
      views: totalViews[0]?.total || 0,
      downloads: totalDownloads[0]?.total || 0,
    });
  } catch (error) {
    console.error("Admin stats error:", error.message);

    res.status(500).json({
      error: "Failed to load admin statistics",
    });
  }
});

export default router;
