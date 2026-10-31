import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import mongoose from "mongoose";
import mongoSanitize from "express-mongo-sanitize";
import rateLimit from "express-rate-limit";

import aiRoutes from "./routes/index.js";
import { checkOllamaHealth } from "./services/modelManager.js";
import verifyInternalKey from "./middleware/internalAuth.js";
import errorHandler from "./middleware/errorMiddleware.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Preserve environment precedence: existing env > ai/.env > root .env fallback
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const app = express();
const PORT = process.env.AI_PORT || 5001;

/* ================= ENV VALIDATION ================= */
if (process.env.NODE_ENV === "production" && !process.env.INTERNAL_SERVICE_KEY) {
  console.error("❌ INTERNAL_SERVICE_KEY is required in production");
  process.exit(1);
}

// Global Middleware
app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:5173",
    credentials: true,
  }),
);
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Sanitize request data to prevent MongoDB operator injection (SEC-012)
// In Express 5, req.query is a getter without a setter; sanitize req.query and define an own property on req.
app.use((req, res, next) => {
  if (req.body) {
    mongoSanitize.sanitize(req.body);
  }
  if (req.params) {
    mongoSanitize.sanitize(req.params);
  }
  if (req.query) {
    const cleanQuery = mongoSanitize.sanitize(req.query);
    Object.defineProperty(req, "query", {
      value: cleanQuery,
      writable: true,
      enumerable: true,
      configurable: true,
    });
  }
  next();
});

if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api", limiter);

// Guard internal AI routes with service-to-service key
app.use("/api/v1/internal/ai", verifyInternalKey);

// AI internal endpoints
app.post("/api/v1/internal/ai/process", async (req, res) => {
  try {
    const { paperId } = req.body;
    const Paper = (await import("./models/Paper.js")).default;
    const paper = await Paper.findById(paperId);
    if (!paper) return res.status(404).json({ error: "Paper not found" });

    const { processPaper } = await import("./services/ingestor.js");
    await processPaper(paper);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/v1/internal/ai/reprocess", async (req, res) => {
  try {
    const { paperId } = req.body;
    const Paper = (await import("./models/Paper.js")).default;
    const paper = await Paper.findById(paperId);
    if (!paper) return res.status(404).json({ error: "Paper not found" });

    const { reprocessPaper } = await import("./services/ingestor.js");
    await reprocessPaper(paper);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/v1/internal/ai/knowledge/:paperId", async (req, res) => {
  try {
    const { paperId } = req.params;
    const { deletePaperKnowledge } = await import("./services/ingestor.js");
    await deletePaperKnowledge(paperId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// AI external routes
app.use("/api/v1/ai", aiRoutes);

// Health check
app.get("/health", (req, res) =>
  res.status(200).json({ status: "ok", service: "ai-module" }),
);

// Centralized error handling
app.use(errorHandler);

// MongoDB connection & Server Start
mongoose
  .connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log("AI Module connected to MongoDB");

    // Check local Ollama health
    const ollamaStatus = await checkOllamaHealth();
    console.log("Ollama Status:", ollamaStatus?.success ? "Healthy" : "Unreachable");

    app.listen(PORT, () => {
      console.log(`AI Module running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Failed to connect to MongoDB:", err);
    process.exit(1);
  });
