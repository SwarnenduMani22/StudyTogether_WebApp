import express from "express";

import verifyToken from "../middleware/authMiddleware.js";
import verifyAdmin from "../middleware/adminMiddleware.js";

import User from "../models/User.js";
import Paper from "../models/Paper.js";

const router = express.Router();

/* =================================================
ADMIN ANALYTICS
GET /api/admin/stats
================================================= */

router.get("/stats", verifyToken, verifyAdmin, async (req, res) => {
  try {
    /* ---------- RUN QUERIES IN PARALLEL ---------- */

    const [
      totalUsers,
      totalAdmins,
      totalPapers,
      pendingPapers,
      approvedPapers,
      totalViews,
      totalDownloads,
    ] = await Promise.all([
      User.countDocuments({ role: { $ne: "admin" } }),
      User.countDocuments({ role: "admin" }),

      Paper.countDocuments(),

      Paper.countDocuments({ status: "pending" }),

      Paper.countDocuments({ status: "approved" }),

      Paper.aggregate([{ $group: { _id: null, total: { $sum: "$views" } } }]),

      Paper.aggregate([
        { $group: { _id: null, total: { $sum: "$downloads" } } },
      ]),
    ]);

    res.json({
      users: totalUsers,
      admins: totalAdmins,
      papers: totalPapers,
      pending: pendingPapers,
      approved: approvedPapers,
      views: totalViews[0]?.total || 0,
      downloads: totalDownloads[0]?.total || 0,
    });
  } catch (error) {
    console.error("Admin stats error:", error);

    res.status(500).json({
      error: "Failed to load admin statistics",
    });
  }
});

export default router;
