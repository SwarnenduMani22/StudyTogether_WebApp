import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

const router = express.Router();

/* ================= REGISTER ================= */

router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    /* ---- Validation ---- */

    if (!name || !email || !password) {
      return res.status(400).json({
        error: "All fields are required",
      });
    }

    if (name.trim().length < 3) {
      return res.status(400).json({
        error: "Name must be at least 3 characters",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        error: "Password must be at least 6 characters",
      });
    }

    /* ---- Check existing user ---- */

    const existingUser = await User.findOne({
      email: email.toLowerCase(),
    });

    if (existingUser) {
      return res.status(400).json({
        error: "Email already exists",
      });
    }

    /* ---- Hash password ---- */

    const hashedPassword = await bcrypt.hash(password, 10);

    /* ---- Create user ---- */

    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase(),
      password: hashedPassword,
    });

    res.status(201).json({
      message: "User registered successfully",
      user: user.toSafeObject(),
    });
  } catch (error) {
    console.error("Register error:", error.message);

    res.status(500).json({
      error: "Server error during registration",
    });
  }
});

/* ================= LOGIN ================= */

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    /* ---- Validation ---- */

    if (!email || !password) {
      return res.status(400).json({
        error: "Email and password required",
      });
    }

    /* ---- Find user (include password) ---- */

    const user = await User.findOne({
      email: email.toLowerCase(),
    }).select("+password");

    if (!user) {
      return res.status(400).json({
        error: "Invalid email or password",
      });
    }

    /* ---- Compare password ---- */

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({
        error: "Invalid email or password",
      });
    }

    /* ---- Generate JWT Token ---- */

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

    /* ---- Response ---- */

    res.json({
      message: "Login successful",
      token,
      user: user.toSafeObject(),
    });
  } catch (error) {
    console.error("Login error:", error.message);

    res.status(500).json({
      error: "Server error during login",
    });
  }
});

export default router;
