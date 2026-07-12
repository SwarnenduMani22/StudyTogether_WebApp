import crypto from "crypto";
import Payment from "../models/Payment.js";
import User from "../models/User.js";
import { purchaseCoins } from "../utils/coinManager.js";
import express from "express";
import verifyToken from "../middleware/authMiddleware.js";
import razorpay from "../config/razorpay.js";
import { COIN_PACKAGES } from "../config/coinpackages.js";

const router = express.Router();

/* ==========================================
CREATE RAZORPAY ORDER
========================================== */

router.post("/create-order", verifyToken, async (req, res) => {
  try {
    const { packageId } = req.body;

    const selectedPackage = COIN_PACKAGES[packageId];

    if (!selectedPackage) {
      return res.status(400).json({
        success: false,
        error: "Invalid package",
      });
    }

    const options = {
      amount: selectedPackage.price * 100, // Paisa
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
      notes: {
        packageId,
        coins: selectedPackage.coins,
      },
    };

    const order = await razorpay.orders.create(options);

    // Save Payment Record
    await Payment.create({
      user: req.user._id,

      orderId: order.id,

      packageId,

      packageName: selectedPackage.name,

      amount: selectedPackage.price,

      coins: selectedPackage.coins,

      currency: order.currency,

      status: "created",

      metadata: {
        receipt: order.receipt,
      },
    });

    res.json({
      success: true,
      order,
      key: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.error("Create Order Error:", error);

    res.status(500).json({
      success: false,
      error: "Failed to create order",
    });
  }
});
/* ==========================================
VERIFY PAYMENT
========================================== */

router.post("/verify", verifyToken, async (req, res) => {
  try {
    const {
      packageId,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

    const generatedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (generatedSignature !== razorpay_signature) {
      return res.status(400).json({
        success: false,
        error: "Invalid payment signature",
      });
    }

    const selectedPackage = COIN_PACKAGES[packageId];
    // Find Payment Record
    const payment = await Payment.findOne({
      orderId: razorpay_order_id,
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        error: "Payment record not found",
      });
    }

    // Prevent Duplicate Processing
    if (payment.status === "captured") {
      return res.status(400).json({
        success: false,
        error: "Payment already processed",
      });
    }
    if (!selectedPackage) {
      return res.status(400).json({
        success: false,
        error: "Invalid package",
      });
    }

    res.json({
      success: true,
      message: "Payment verified successfully",
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      error: "Payment verification failed",
    });
  }
});
/* ==========================================
GET PAYMENT HISTORY
========================================== */

router.get("/history", verifyToken, async (req, res) => {
  try {
    const payments = await Payment.find({
      user: req.user._id,
    })
      .sort({ createdAt: -1 })
      .select(
        "packageName amount coins status provider currency createdAt paymentId orderId",
      );

    res.json({
      success: true,
      total: payments.length,
      payments,
    });
  } catch (error) {
    console.error("Payment History Error:", error);

    res.status(500).json({
      success: false,
      error: "Failed to load payment history",
    });
  }
});
/* ==========================================
RAZORPAY WEBHOOK
========================================== */

router.post("/webhook", async (req, res) => {
  try {
    const signature = req.headers["x-razorpay-signature"];

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(req.body)
      .digest("hex");

    if (signature !== expectedSignature) {
      return res.status(400).json({
        success: false,
        error: "Invalid webhook signature",
      });
    }

    const event = JSON.parse(req.body.toString());

    console.log("Webhook Event:", event.event);
    if (event.event === "payment.captured") {
      const paymentData = event.payload.payment.entity;

      const payment = await Payment.findOne({
        orderId: paymentData.order_id,
      });

      if (!payment) {
        return res.json({ success: true, message: "Payment verified" });
      }
      if (payment.status === "captured") {
        return res.json({
          success: true,
        });
      }
      payment.paymentId = paymentData.id;
      payment.status = "captured";

      await payment.save();
      const user = await User.findById(payment.user);

      await purchaseCoins(
        user,
        payment.coins,
        payment.packageName,
        paymentData.id,
      );

      console.log("Payment Updated");
    }

    if (event.event === "payment.failed") {
      const paymentData = event.payload.payment.entity;

      const payment = await Payment.findOne({
        orderId: paymentData.order_id,
      });

      if (payment) {
        payment.paymentId = paymentData.id;
        payment.status = "failed";

        await payment.save();
      }

      console.log("Payment Failed:", paymentData.id);
    }

    if (event.event === "refund.created") {
      const refundData = event.payload.refund.entity;

      const payment = await Payment.findOne({
        paymentId: refundData.payment_id,
      });

      if (payment) {
        payment.status = "refunded";

        await payment.save();
      }

      console.log("Refund:", refundData.id);
    }
    res.json({
      success: true,
    });
  } catch (error) {
    console.error("Webhook Error:", error);

    res.status(500).json({
      success: false,
      error: "Webhook failed",
    });
  }
});
/* ==========================================
ADMIN PAYMENT ANALYTICS
========================================== */

import verifyAdmin from "../middleware/adminMiddleware.js";

router.get("/admin/analytics", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const totalRevenue = await Payment.aggregate([
      {
        $match: {
          status: "captured",
        },
      },
      {
        $group: {
          _id: null,
          revenue: {
            $sum: "$amount",
          },
          totalPayments: {
            $sum: 1,
          },
          totalCoins: {
            $sum: "$coins",
          },
        },
      },
    ]);

    res.json({
      success: true,
      analytics: totalRevenue[0] || {
        revenue: 0,
        totalPayments: 0,
        totalCoins: 0,
      },
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      error: "Analytics failed",
    });
  }
});
/* ==========================================
PACKAGE SALES ANALYTICS
========================================== */

router.get(
  "/admin/package-sales",
  verifyToken,
  verifyAdmin,
  async (req, res) => {
    try {
      const sales = await Payment.aggregate([
        {
          $match: {
            status: "captured",
          },
        },
        {
          $group: {
            _id: "$packageName",
            totalSales: { $sum: 1 },
            revenue: { $sum: "$amount" },
            coins: { $sum: "$coins" },
          },
        },
        {
          $sort: {
            revenue: -1,
          },
        },
      ]);

      res.json({
        success: true,
        sales,
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        success: false,
        error: "Failed to load package sales",
      });
    }
  },
);
/* ==========================================
ADMIN PAYMENT LIST
========================================== */

router.get("/admin/list", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const search = req.query.search || "";
    const status = req.query.status || "all";
    const query = {};

    // Status Filter
    if (status !== "all") {
      query.status = status;
    }

    // Search
    if (search) {
      const users = await User.find({
        $or: [
          { name: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
        ],
      }).select("_id");

      const userIds = users.map((u) => u._id);

      query.$or = [
        { user: { $in: userIds } },
        { paymentId: { $regex: search, $options: "i" } },
        { orderId: { $regex: search, $options: "i" } },
      ];
    }

    const total = await Payment.countDocuments(query);

    const payments = await Payment.find(query)
      .populate("user", "name email")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.json({
      success: true,
      page: Number(page),
      totalPages: Math.max(1, Math.ceil(total / limit)),
      total,
      payments,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      error: "Failed to load payments",
    });
  }
});

export default router;
