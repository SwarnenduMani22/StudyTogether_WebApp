import jwt from "jsonwebtoken";
import User from "../models/User.js";

const verifyToken = async (req, res, next) => {
  try {
    /* ================= GET TOKEN ================= */

    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        error: "Authorization header missing",
      });
    }

    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "Invalid authorization format",
      });
    }

    const token = authHeader.split(" ")[1];

    /* ================= VERIFY TOKEN ================= */

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    /* ================= FIND USER ================= */

    const user = await User.findById(decoded.id).select("-password");

    if (!user) {
      return res.status(404).json({
        error: "User not found",
      });
    }

    /* ================= ATTACH USER ================= */

    req.user = user;

    next();
  } catch (error) {
    /* ================= TOKEN ERRORS ================= */

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        error: "Token expired",
      });
    }

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        error: "Invalid token",
      });
    }

    console.error("Auth middleware error:", error.message);

    return res.status(401).json({
      error: "Authentication failed",
    });
  }
};

export default verifyToken;
