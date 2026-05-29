const verifyAdmin = (req, res, next) => {
  try {
    /* ================= AUTH CHECK ================= */

    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized. Please login first.",
      });
    }

    /* ================= ROLE CHECK ================= */

    const { role } = req.user;

    if (role !== "admin") {
      return res.status(403).json({
        success: false,
        error: "Access denied. Admin privileges required.",
      });
    }

    /* ================= NEXT ================= */

    return next();
  } catch (error) {
    console.error("❌ Admin middleware error:", error.message);

    return res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
};

export default verifyAdmin;
