import crypto from "crypto";

export const verifyInternalKey = (req, res, next) => {
  const secret = process.env.INTERNAL_SERVICE_KEY;

  if (!secret) {
    console.error("❌ INTERNAL_SERVICE_KEY is not configured on AI service");
    return res.status(500).json({
      success: false,
      error: "Internal service authentication misconfigured",
    });
  }

  const providedKey = req.headers["x-internal-service-key"];

  if (!providedKey || typeof providedKey !== "string") {
    return res.status(401).json({
      success: false,
      error: "Unauthorized: Missing internal service key",
    });
  }

  // Constant-time comparison using sha256 hashes to prevent timing attacks
  const keyHash = crypto.createHash("sha256").update(providedKey).digest();
  const secretHash = crypto.createHash("sha256").update(secret).digest();

  if (!crypto.timingSafeEqual(keyHash, secretHash)) {
    return res.status(401).json({
      success: false,
      error: "Unauthorized: Invalid internal service key",
    });
  }

  next();
};

export default verifyInternalKey;
