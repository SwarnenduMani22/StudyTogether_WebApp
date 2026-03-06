import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
import morgan from "morgan";

/* ================= ROUTES ================= */

import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/user.js";
import adminRoutes from "./routes/admin.js";
import paperRoutes from "./routes/paper.js";
import adminStats from "./routes/adminStats.js";

dotenv.config();

const app = express();

/* ================= ENV VALIDATION ================= */

if (!process.env.MONGODB_URI) {
  console.error("❌ MONGODB_URI missing in .env");
  process.exit(1);
}

/* ================= MIDDLEWARE ================= */

app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  }),
);

app.use(express.json());
app.use(helmet());
app.use(morgan("dev"));

/* ================= API VERSION ================= */

const API = "/api/v1";

/* ================= ROUTES ================= */

app.use(`${API}/auth`, authRoutes);
app.use(`${API}/users`, userRoutes);
app.use(`${API}/papers`, paperRoutes);

/* Admin Routes */
app.use(`${API}/admin`, adminRoutes);
app.use(`${API}/admin`, adminStats);

/* ================= HEALTH CHECK ================= */

app.get("/", (req, res) => {
  res.json({
    message: "🚀 StudyTogether API Running",
    version: "1.0",
    status: "OK",
  });
});

/* ================= 404 HANDLER ================= */

app.use((req, res) => {
  res.status(404).json({
    error: "Route not found",
  });
});

/* ================= GLOBAL ERROR HANDLER ================= */

app.use((err, req, res, next) => {
  console.error("❌ Error:", err.message);

  res.status(err.status || 500).json({
    error: err.message || "Server error",
  });
});

/* ================= DATABASE ================= */

mongoose.set("strictQuery", true);

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    console.log("✅ MongoDB Connected");
  } catch (error) {
    console.error("❌ MongoDB Connection Failed:", error.message);
    process.exit(1);
  }
};

connectDB();

/* ================= SERVER ================= */

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
