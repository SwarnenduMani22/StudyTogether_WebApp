import express from "express";

import { COIN_PACKAGES } from "../config/coinpackages.js";

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

export default router;
