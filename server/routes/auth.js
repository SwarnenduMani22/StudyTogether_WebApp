import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

const router = express.Router();

/* =================================================
REGISTER
================================================= */

router.post("/register", async (req, res) => {
  try {
    let { name, email, password } = req.body;

    /* ---------- VALIDATION ---------- */

    if (!name || !email || !password) {
      return res.status(400).json({
        error: "All fields are required",
      });
    }

    name = name.trim();
    email = email.trim().toLowerCase();

    if (name.length < 3) {
      return res.status(400).json({
        error: "Name must be at least 3 characters",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        error: "Password must be at least 6 characters",
      });
    }

    const emailRegex = /^\S+@\S+\.\S+$/;

    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: "Invalid email format",
      });
    }

    /* ---------- CHECK EXISTING USER ---------- */

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(400).json({
        error: "Email already registered",
      });
    }

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
      message: "User registered successfully",
      user: user.toSafeObject(),
    });
  } catch (error) {
    console.error("❌ Register error:", error);

    res.status(500).json({
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

    if (!email || !password) {
      return res.status(400).json({
        error: "Email and password required",
      });
    }

    email = email.trim().toLowerCase();

    /* ---------- FIND USER (INCLUDE PASSWORD) ---------- */

    const user = await User.findOne({ email }).select("+password");

    if (!user) {
      return res.status(400).json({
        error: "Invalid email or password",
      });
    }

    /* ---------- PASSWORD CHECK ---------- */

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({
        error: "Invalid email or password",
      });
    }

    /* ---------- GENERATE JWT TOKEN ---------- */

    const token = jwt.sign(
      {
        id: user._id,
        role: user.role,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "1d",
      },
    );

    /* ---------- RESPONSE ---------- */

    res.json({
      message: "Login successful",
      token,
      user: user.toSafeObject(),
    });
  } catch (error) {
    console.error("❌ Login error:", error);

    res.status(500).json({
      error: "Server error during login",
    });
  }
});

export default router;
