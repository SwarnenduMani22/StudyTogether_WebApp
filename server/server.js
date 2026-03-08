import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import path from "path";

import errorHandler from "./middleware/errorMiddleware.js";

/* ================= ROUTES ================= */

import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/user.js";
import adminRoutes from "./routes/admin.js";
import paperRoutes from "./routes/paper.js";
import adminStatsRoutes from "./routes/adminStats.js";

dotenv.config();

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

/* ================= SETTINGS ================= */

app.set("trust proxy", 1);

/* ================= SECURITY ================= */

app.use(
  helmet({
    crossOriginResourcePolicy: false,
  }),
);

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

app.use("/api/v1", limiter);

/* ================= CORS ================= */

const allowedOrigins = [process.env.CLIENT_URL || "http://localhost:5173"];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("CORS not allowed"));
      }
    },
    credentials: true,
  }),
);

/* ================= BODY PARSER ================= */

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

/* ================= LOGGER ================= */

app.use(morgan("dev"));

/* ================= STATIC FILES ================= */

const __dirname = path.resolve();
const uploadsPath = path.join(__dirname, "uploads");

app.use("/uploads", express.static(uploadsPath));

/* ================= API PREFIX ================= */

const API = "/api/v1";

/* ================= ROUTES ================= */

app.use(`${API}/auth`, authRoutes);
app.use(`${API}/users`, userRoutes);
app.use(`${API}/papers`, paperRoutes);
app.use(`${API}/admin`, adminRoutes);
app.use(`${API}/admin`, adminStatsRoutes);

/* ================= HEALTH CHECK ================= */

app.get(`${API}/health`, (req, res) => {
  res.status(200).json({
    success: true,
    message: "🚀 StudyTogether API Running",
    version: "1.0",
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

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      autoIndex: true,
    });

    console.log("✅ MongoDB Connected");
  } catch (error) {
    console.error("❌ MongoDB Connection Failed:", error.message);
    process.exit(1);
  }
};

/* ================= START SERVER ================= */

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();

  const server = app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });

  /* Graceful Shutdown */

  const shutdown = () => {
    console.log("🛑 Server shutting down...");
    server.close(() => {
      mongoose.connection.close(false, () => {
        process.exit(0);
      });
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
};

startServer();
