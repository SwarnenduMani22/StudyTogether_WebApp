import express from "express";

import verifyToken from "../middleware/authMiddleware.js";

import User from "../models/User.js";

import { COIN_PACKAGES } from "../config/coinpackages.js";

import { purchaseCoins } from "../utils/coinManager.js";

const router = express.Router();

/* ==========================================
GET PACKAGES
========================================== */

router.get("/packages", (req, res) => {
  res.json({
    success: true,
    packages: Object.values(COIN_PACKAGES),
  });
});

/* ==========================================
PURCHASE COINS (FAKE PAYMENT FOR NOW)
========================================== */

router.post("/purchase", verifyToken, async (req, res) => {
  try {
    const { packageId } = req.body;

    const selectedPackage = COIN_PACKAGES[packageId];

    if (!selectedPackage) {
      return res.status(400).json({
        success: false,
        error: "Invalid package",
      });
    }

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    const transactionId = `TXN_${Date.now()}`;

    await purchaseCoins(
      user,
      selectedPackage.coins,
      selectedPackage.name,
      transactionId,
    );

    const updatedUser = await User.findById(req.user._id);

    res.json({
      success: true,
      message: "Coins purchased successfully",
      transactionId,
      packageName: selectedPackage.name,
      packagePrice: selectedPackage.price,
      coinsAdded: selectedPackage.coins,
      currentBalance: updatedUser.coins,
    });
  } catch (error) {
    console.error("Purchase error:", error);

    res.status(500).json({
      success: false,
      error: "Purchase failed",
    });
  }
});

export default router;
