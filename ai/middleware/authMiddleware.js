import jwt from "jsonwebtoken";
import User from "../models/User.js";

const authMiddleware = async (req, res, next) => {
  try {
    /* ================= ENV CHECK ================= */

    const JWT_SECRET = process.env.JWT_SECRET;

    if (!JWT_SECRET) {
      console.error("❌ JWT_SECRET missing in environment variables");

      return res.status(500).json({
        success: false,
        error: "Server configuration error",
      });
    }

    /* ================= GET AUTH HEADER ================= */

    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        error: "Authorization token missing or invalid",
      });
    }

    /* ================= EXTRACT TOKEN ================= */

    const token = authHeader?.split(" ")?.[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        error: "Token missing",
      });
    }

    /* ================= VERIFY TOKEN ================= */

    let decoded;

    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (error) {
      if (error.name === "TokenExpiredError") {
        return res.status(401).json({
          success: false,
          error: "Token expired",
        });
      }

      if (error.name === "JsonWebTokenError") {
        return res.status(401).json({
          success: false,
          error: "Invalid token",
        });
      }

      throw error;
    }

    /* ================= TOKEN PAYLOAD CHECK ================= */

    if (!decoded?.id) {
      return res.status(401).json({
        success: false,
        error: "Invalid token payload",
      });
    }

    /* ================= FIND USER ================= */

    const user = await User.findById(decoded.id)
      .select("_id name email role")
      .lean();

    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized access",
      });
    }

    /* ================= ATTACH USER ================= */

    req.user = user;

    next();
  } catch (error) {
    console.error("❌ Auth middleware error:", error.message);

    return res.status(500).json({
      success: false,
      error: "Authentication failed",
    });
  }
};

export default authMiddleware;
