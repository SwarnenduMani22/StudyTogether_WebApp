import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import verifyToken from "../middleware/authMiddleware.js";

const router = express.Router();

/* =================================================
REGISTER
================================================= */

router.post("/register", async (req, res) => {
  try {
    let { name, email, password } = req.body;

    /* ---------- VALIDATION ---------- */

    if (!name?.trim() || !email?.trim() || !password?.trim()) {
      return res.status(400).json({
        success: false,
        error: "All fields are required",
      });
    }

    name = name.trim();
    email = email.trim().toLowerCase();

    if (name.length < 3) {
      return res.status(400).json({
        success: false,
        error: "Name must be at least 3 characters",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        error: "Password must be at least 8 characters",
      });
    }

    const emailRegex = /^\S+@\S+\.\S+$/;

    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: "Invalid email format",
      });
    }
    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: "Email already registered",
      });
    }
    /* ---------- CHECK EXISTING USER ---------- */

    /* ---------- HASH PASSWORD ---------- */

    const hashedPassword = await bcrypt.hash(password, 10);

    /* ---------- CREATE USER ---------- */

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
    });

    /* ---------- RESPONSE ---------- */

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      user: user.toSafeObject(),
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(400).json({
        success: false,
        error: "Email already registered",
      });
    }

    console.error("❌ Register error:", error);

    return res.status(500).json({
      success: false,
      error: "Server error during registration",
    });
  }
});

/* =================================================
LOGIN
================================================= */

router.post("/login", async (req, res) => {
  try {
    let { email, password } = req.body;

    /* ---------- VALIDATION ---------- */

    if (!email?.trim() || !password?.trim()) {
      return res.status(400).json({
        success: false,
        error: "Email and password required",
      });
    }

    email = email.trim().toLowerCase();

    /* ---------- FIND USER (INCLUDE PASSWORD) ---------- */

    const user = await User.findOne({ email }).select("+password");

    if (!user) {
      return res.status(400).json({
        success: false,
        error: "Invalid email or password",
      });
    }

    /* ---------- PASSWORD CHECK ---------- */

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({
        success: false,
        error: "Invalid email or password",
      });
    }

    /* ---------- ACCOUNT STATUS CHECK ---------- */

    if (user.isActive === false || user.status === "disabled") {
      return res.status(403).json({
        success: false,
        error: "Account has been disabled. Please contact support.",
      });
    }

    /* ---------- GENERATE TOKENS ---------- */

    const accessToken = jwt.sign(
      {
        id: user._id,
        role: user.role,
        email: user.email, // 🔥 add
      },
      process.env.JWT_SECRET,
      { expiresIn: "15m" },
    );

    const refreshToken = jwt.sign(
      {
        id: user._id,
        tokenType: "refresh", // 🔥 added
      },
      process.env.JWT_REFRESH_SECRET, // 🔥 FIXED (separate secret)
      {
        expiresIn: "7d",
      },
    );

    /* ---------- SAVE REFRESH TOKEN ---------- */
    user.refreshToken = refreshToken;
    await user.save();

    /* ---------- RESPONSE ---------- */
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.json({
      success: true,
      message: "Login successful",
      accessToken,
      user: user.toSafeObject(),
    });
  } catch (error) {
    console.error("❌ Login error:", error);

    res.status(500).json({
      success: false,
      error: "Server error during login",
    });
  }
});

/* =================================================
REFRESH TOKEN
================================================= */

router.post("/refresh", async (req, res) => {
  try {
    const refreshToken = req.cookies?.refreshToken || req.body.refreshToken;

    /* ---------- VALIDATION ---------- */

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        error: "Refresh token missing",
      });
    }

    /* ---------- VERIFY ---------- */

    let decoded;

    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
      if (decoded.tokenType !== "refresh") {
        return res.status(401).json({
          success: false,
          error: "Invalid token type",
        });
      }
    } catch {
      return res.status(401).json({
        success: false,
        error: "Invalid or expired refresh token",
      });
    }

    /* ---------- USER CHECK ---------- */

    const user = await User.findById(decoded.id).select(
      "_id role email isActive status +refreshToken",
    );

    if (!user || user.refreshToken !== refreshToken) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized access or token revoked",
      });
    }

    if (user.isActive === false || user.status === "disabled") {
      return res.status(403).json({
        success: false,
        error: "Account has been disabled. Please contact support.",
      });
    }

    /* ---------- NEW ACCESS TOKEN ---------- */

    const newAccessToken = jwt.sign(
      {
        id: user._id,
        role: user.role,
        email: user.email,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "15m",
      },
    );

    res.json({
      success: true,
      accessToken: newAccessToken,
    });
  } catch (error) {
    console.error("❌ Refresh error:", error);

    res.status(500).json({
      error: "Failed to refresh token",
    });
  }
});

/* =================================================
LOGOUT
================================================= */

router.post("/logout", verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (user) {
      user.refreshToken = null;
      await user.save();
    }

    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });

    res.json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    console.error("Logout error:", error);

    res.status(500).json({
      success: false,
      error: "Logout failed",
    });
  }
});

export default router;
