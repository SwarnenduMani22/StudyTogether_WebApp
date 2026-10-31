const errorHandler = (err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }
  console.error("❌ SERVER ERROR:", err.message);

  let statusCode = res.statusCode !== 200 ? res.statusCode : 500;
  let message = err.message || "Internal Server Error";

  /* ================= MONGOOSE VALIDATION ================= */

  if (err.name === "ValidationError") {
    statusCode = 400;
    message = Object.values(err.errors || {})
      .map((val) => val.message)
      .join(", ");
  }

  /* ================= INVALID OBJECT ID ================= */

  if (err.name === "CastError") {
    statusCode = 400;
    message = "Invalid resource ID";
  }

  /* ================= DUPLICATE KEY ================= */

  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0];
    statusCode = 400;
    message = `Duplicate value for field: ${field}`;
  }

  /* ================= JWT ERRORS ================= */

  if (err.name === "JsonWebTokenError") {
    statusCode = 401;
    message = "Invalid authentication token";
  }

  if (err.name === "TokenExpiredError") {
    statusCode = 401;
    message = "Authentication token expired";
  }

  /* ================= PRODUCTION SANITIZATION ================= */

  if (statusCode === 500 && process.env.NODE_ENV === "production") {
    message = "Internal Server Error";
  }

  /* ================= RESPONSE ================= */

  res.status(statusCode).json({
    success: false,
    error: message,
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};

export default errorHandler;
