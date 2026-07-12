import dotenv from "dotenv";
dotenv.config({ path: "./.env" });
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import mongoSanitize from "express-mongo-sanitize";
import path from "path";
import { fileURLToPath } from "url";
// ❌ duplicate cors remove (ONLY THIS FIX)

import errorHandler from "./middleware/errorMiddleware.js";

/* ================= ROUTES ================= */

import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/user.js";
import adminRoutes from "./routes/admin.js";
import paperRoutes from "./routes/paper.js";
import coinRoutes from "./routes/coin.js";
import paymentRoutes from "./routes/payment.routes.js";
const app = express();

/* ================= ENV VALIDATION ================= */

if (!process.env.MONGODB_URI) {
  console.error("❌ MONGODB_URI missing in .env");
  process.exit(1);
}

if (!process.env.JWT_SECRET) {
  console.error("❌ JWT_SECRET missing in .env");
  process.exit(1);
}

if (!process.env.JWT_REFRESH_SECRET) {
  console.error("❌ JWT_REFRESH_SECRET missing in .env");
  process.exit(1);
}

/* ================= SETTINGS ================= */

app.set("trust proxy", 1);

/* ================= CORS ================= */

app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
  }),
);

/* ================= BODY PARSER ================= */

app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true }));

/* ================= COOKIE PARSER ================= */

app.use((req, res, next) => {
  req.cookies = {};
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    cookieHeader.split(";").forEach((cookie) => {
      const parts = cookie.split("=");
      if (parts.length === 2) {
        req.cookies[parts[0].trim()] = decodeURIComponent(parts[1].trim());
      }
    });
  }
  next();
});

/* ================= SECURITY ================= */

app.use(
  helmet({
    crossOriginResourcePolicy: false,
  }),
);

app.use((req, res, next) => {
  if (req.body) mongoSanitize.sanitize(req.body);
  if (req.params) mongoSanitize.sanitize(req.params);
  if (req.query) mongoSanitize.sanitize(req.query);
  next();
});

/* ================= RATE LIMIT ================= */

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: "Too many requests. Please try again later.",
  },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    success: false,
    error: "Too many login attempts. Please try again later.",
  },
});

const sensitiveActionLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // limit each IP to 5 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: "Too many requests. Please wait a minute and try again.",
  },
});

app.use("/api/v1", limiter);
app.use("/api/v1/auth", authLimiter);
app.use("/api/v1/coins/purchase", sensitiveActionLimiter);
app.use("/api/v1/papers/upload", sensitiveActionLimiter);

/* ================= LOGGER ================= */

const morganFormat = process.env.NODE_ENV === "production" ? "combined" : "dev";
app.use(morgan(morganFormat));

/* ================= STATIC FILES ================= */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsPath = path.join(__dirname, "uploads");

app.use("/uploads", express.static(uploadsPath));

/* ================= API PREFIX ================= */

const API = "/api/v1";
/* ================= WEBHOOK ================= */

app.use("/api/v1/payment/webhook", express.raw({ type: "application/json" }));
/* ================= ROUTES ================= */

app.use(`${API}/auth`, authRoutes);
app.use(`${API}/users`, userRoutes);
app.use(`${API}/papers`, paperRoutes);
app.use(`${API}/admin`, adminRoutes);
app.use(`${API}/coins`, coinRoutes);
app.use(`${API}/payment`, paymentRoutes);
/* ================= HEALTH CHECK ================= */

app.get(`${API}/health`, (req, res) => {
  const dbStatus =
    mongoose.connection.readyState === 1 ? "connected" : "disconnected";
  const healthStatus = dbStatus === "connected" ? "healthy" : "degraded";

  res.status(healthStatus === "healthy" ? 200 : 503).json({
    success: true,
    status: healthStatus,
    message: "🚀 StudyTogether API Running",
    version: "1.0",
    services: {
      database: dbStatus,
    },
    timestamp: Date.now(),
  });
});

/* ================= ROOT ================= */

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "StudyTogether Backend API",
    baseApi: "/api/v1",
  });
});

/* ================= 404 HANDLER ================= */

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "Route not found",
  });
});

/* ================= GLOBAL ERROR HANDLER ================= */

app.use(errorHandler);

/* ================= DATABASE ================= */

mongoose.set("strictQuery", true);

const connectDB = async (retries = 5, delayMs = 5000) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await mongoose.connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 5000,
        autoIndex: process.env.NODE_ENV !== "production",
      });

      console.log("✅ MongoDB Connected successfully");
      return;
    } catch (error) {
      console.error(
        `❌ MongoDB Connection Attempt ${attempt}/${retries} Failed:`,
        error.message,
      );
      if (attempt === retries) {
        console.error(
          "❌ Maximum MongoDB connection retry attempts reached. Exiting process.",
        );
        process.exit(1);
      }
      console.log(`🔄 Retrying database connection in ${delayMs / 1000}s...`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
};

/* ================= START SERVER ================= */

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();

  const server = app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });

  const shutdown = () => {
    console.log("🛑 Server shutting down...");
    server.close(() => {
      mongoose.connection.close().then(() => {
        process.exit(0);
      });
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
};

startServer();
