const verifyAdmin = (req, res, next) => {
  try {
    /* ================= CHECK USER ================= */

    if (!req.user) {
      return res.status(401).json({
        error: "Unauthorized access",
      });
    }

    /* ================= CHECK ROLE ================= */

    if (req.user.role !== "admin") {
      return res.status(403).json({
        error: "Access denied. Admin only.",
      });
    }

    next();
  } catch (error) {
    console.error("Admin middleware error:", error.message);

    res.status(500).json({
      error: "Server error",
    });
  }
};

export default verifyAdmin;
