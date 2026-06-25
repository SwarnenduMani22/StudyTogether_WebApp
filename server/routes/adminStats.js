import express from "express";

import verifyToken from "../middleware/authMiddleware.js";
import verifyAdmin from "../middleware/adminMiddleware.js";

import mongoose from "mongoose";
import cloudinary from "../config/cloudinary.js";
import User from "../models/User.js";
import Paper from "../models/Paper.js";
import Activity from "../models/Activity.js";

const router = express.Router();
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

    const dbStats = await mongoose.connection.db.stats();
    
    let cloudUsage = null;
    try {
      cloudUsage = await cloudinary.api.usage();
    } catch (e) {
      console.error("Cloudinary usage API error:", e.message);
    }

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const activeDailyUsers = await Activity.distinct("user", { createdAt: { $gte: oneDayAgo } });

    res.json({
      users: totalUsers,
      admins: totalAdmins,
      papers: totalPapers,
      pending: pendingPapers,
      approved: approvedPapers,
      views: totalViews[0]?.total || 0,
      downloads: totalDownloads[0]?.total || 0,
      dbSize: dbStats.dataSize || 0,
      cloudStorageUsed: cloudUsage ? cloudUsage.usage : "API Disabled",
      activeDailyUsers: activeDailyUsers.length,
    });
  } catch (error) {
    console.error("Admin stats error:", error);

    res.status(500).json({
      error: "Failed to load admin statistics",
    });
  }
});

export default router;
