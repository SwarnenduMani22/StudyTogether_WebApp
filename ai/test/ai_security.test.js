import test, { describe, it, before, after, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import mongoSanitize from "express-mongo-sanitize";

// Environment setup for testing
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "ai-security-test-secret-key-32chars-minimum!!";
process.env.INTERNAL_SERVICE_KEY = "test_internal_service_key_ai_security_12345678";
process.env.AI_PROVIDER = "ollama";

// Global fetch mock to prevent Ollama network timeouts during tests
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, opts) => {
  const urlStr = String(url);
  if (urlStr.includes("/api/embed") || urlStr.includes("/api/embeddings")) {
    return {
      ok: true,
      status: 200,
      json: async () => ({ embeddings: [[0.1, 0.2, 0.3]], embedding: [0.1, 0.2, 0.3] }),
    };
  }
  if (urlStr.includes("/api/generate") || urlStr.includes("/api/tags") || urlStr.includes("generativelanguage")) {
    return {
      ok: true,
      status: 200,
      json: async () => ({
        response: "Mocked AI Response",
        models: [{ name: "mistral:latest" }],
      }),
    };
  }
  if (originalFetch) return originalFetch(url, opts);
  return { ok: false, status: 404, json: async () => ({}) };
};

// ============================================================================
// OCR COMMONJS MOCK DELEGATES (SEC-014)
// ============================================================================
const cjsRequire = createRequire(import.meta.url);
const pdfImgPath = cjsRequire.resolve("pdf-img-convert");
const tesseractPath = cjsRequire.resolve("tesseract.js");

let activeConvertHandler = null;
let activeWorkerHandler = null;

cjsRequire.cache[pdfImgPath] = {
  id: pdfImgPath,
  filename: pdfImgPath,
  loaded: true,
  exports: {
    convert: async (...args) => {
      if (activeConvertHandler) return activeConvertHandler(...args);
      return [new Uint8Array([1, 2, 3])];
    },
  },
};

cjsRequire.cache[tesseractPath] = {
  id: tesseractPath,
  filename: tesseractPath,
  loaded: true,
  exports: {
    createWorker: async (...args) => {
      if (activeWorkerHandler) return activeWorkerHandler(...args);
      return {
        recognize: async () => ({ data: { text: "Recognized sample text" } }),
        terminate: async () => {},
      };
    },
  },
};

// Import modules under test
import router, { checkPaperEntitlement, escapeRegex } from "../routes/index.js";
import User from "../models/User.js";
import Paper from "../models/Paper.js";
import AIChatChunk from "../models/AIChatChunk.js";
import {
  DEFAULT_MAX_OCR_PAGES,
  HARD_CEILING_OCR_PAGES,
  getMaxOcrPages,
  runOcrOnBuffer,
} from "../services/ingestor.js";

// ============================================================================
// IN-MEMORY MOCKS & FIXTURES STORE
// ============================================================================
const mockUsers = new Map();
const mockPapers = new Map();
const mockChunks = new Map();

// Override User.findById for mock isolation
User.findById = (id) => {
  const user = mockUsers.get(String(id));
  return {
    select: (fields) => ({
      lean: async () => (user ? { ...user } : null),
      then(onFulfilled, onRejected) {
        return Promise.resolve(user ? { ...user } : null).then(onFulfilled, onRejected);
      },
    }),
    lean: async () => (user ? { ...user } : null),
    then(onFulfilled, onRejected) {
      return Promise.resolve(user ? { ...user } : null).then(onFulfilled, onRejected);
    },
  };
};

// Override Paper.findOne
Paper.findOne = async (query) => {
  const paper = mockPapers.get(String(query._id));
  if (!paper) return null;
  if (query.status && paper.status !== query.status) return null;
  if (query.isActive !== undefined && paper.isActive !== query.isActive) return null;
  return paper;
};

// Helper to apply Mongoose select() exclusions/inclusions
const applySelect = (doc, fields = "") => {
  if (!doc) return null;
  const clone = { ...doc };
  if (!fields) return clone;
  const tokens = fields.split(" ").filter(Boolean);
  for (const token of tokens) {
    if (token.startsWith("-")) {
      delete clone[token.substring(1)];
    }
  }
  return clone;
};

// Override AIChatChunk.find with chainable mock
AIChatChunk.find = (filter = {}) => {
  let results = Array.from(mockChunks.values());
  if (filter.paperId) {
    results = results.filter((c) => String(c.paperId) === String(filter.paperId));
  }
  if (filter.chunkText?.$regex) {
    const rx = new RegExp(filter.chunkText.$regex, filter.chunkText.$options || "i");
    results = results.filter((c) => rx.test(c.chunkText));
  }

  const queryObj = {
    _limit: null,
    _select: "",
    limit(n) {
      this._limit = n;
      return this;
    },
    select(fields) {
      this._select = fields;
      return this;
    },
    async lean() {
      let res = results.map((d) => applySelect(d, this._select));
      if (this._limit !== null) {
        res = res.slice(0, this._limit);
      }
      return res;
    },
    then(onFulfilled, onRejected) {
      return this.lean().then(onFulfilled, onRejected);
    },
  };
  return queryObj;
};

// Override AIChatChunk.findById
AIChatChunk.findById = (id) => {
  const chunk = mockChunks.get(String(id));
  const queryObj = {
    _select: "",
    select(fields) {
      this._select = fields;
      return this;
    },
    async lean() {
      return chunk ? applySelect(chunk, this._select) : null;
    },
    then(onFulfilled, onRejected) {
      return this.lean().then(onFulfilled, onRejected);
    },
  };
  return queryObj;
};

// ============================================================================
// TEST SUITE: AI SECURITY REGRESSION TESTS
// ============================================================================
describe("AI Security Regression Tests Suite (SEC-006 to SEC-014)", () => {
  let app;
  let server;
  let port;

  // Test ObjectIds
  const adminId = new mongoose.Types.ObjectId().toString();
  const authorId = new mongoose.Types.ObjectId().toString();
  const unentitledStudentId = new mongoose.Types.ObjectId().toString();
  const previewedStudentId = new mongoose.Types.ObjectId().toString();
  const downloadedStudentId = new mongoose.Types.ObjectId().toString();

  const approvedPaperId = new mongoose.Types.ObjectId().toString();
  const pendingPaperId = new mongoose.Types.ObjectId().toString();
  const inactivePaperId = new mongoose.Types.ObjectId().toString();

  const chunk1Id = new mongoose.Types.ObjectId().toString();

  // Tokens
  let adminToken;
  let authorToken;
  let unentitledToken;
  let previewedToken;
  let downloadedToken;

  const makeRequest = ({ path, method = "GET", headers = {}, body = null }) => {
    return new Promise((resolve, reject) => {
      const payload = body ? JSON.stringify(body) : null;
      const reqHeaders = { ...headers };
      if (payload) {
        reqHeaders["Content-Type"] = "application/json";
        reqHeaders["Content-Length"] = Buffer.byteLength(payload);
      }

      const req = http.request(
        {
          hostname: "127.0.0.1",
          port,
          path,
          method,
          headers: reqHeaders,
        },
        (res) => {
          let rawData = "";
          res.on("data", (chunk) => (rawData += chunk));
          res.on("end", () => {
            let parsedBody = null;
            try {
              parsedBody = JSON.parse(rawData);
            } catch {
              parsedBody = rawData;
            }
            resolve({ statusCode: res.statusCode, body: parsedBody });
          });
        }
      );
      req.on("error", reject);
      if (payload) req.write(payload);
      req.end();
    });
  };

  before(async () => {
    // Generate JWT tokens
    adminToken = jwt.sign({ id: adminId, role: "admin" }, process.env.JWT_SECRET);
    authorToken = jwt.sign({ id: authorId, role: "user" }, process.env.JWT_SECRET);
    unentitledToken = jwt.sign({ id: unentitledStudentId, role: "user" }, process.env.JWT_SECRET);
    previewedToken = jwt.sign({ id: previewedStudentId, role: "user" }, process.env.JWT_SECRET);
    downloadedToken = jwt.sign({ id: downloadedStudentId, role: "user" }, process.env.JWT_SECRET);

    // Setup Express App
    app = express();
    app.use(express.json());

    // MongoSanitize middleware under test (SEC-012)
    app.use((req, res, next) => {
      if (req.body) mongoSanitize.sanitize(req.body);
      if (req.params) mongoSanitize.sanitize(req.params);
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

    app.use("/api/v1/ai", router);

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    port = server.address().port;
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  beforeEach(() => {
    mockUsers.clear();
    mockPapers.clear();
    mockChunks.clear();

    // Populate Users
    mockUsers.set(adminId, {
      _id: adminId,
      name: "Admin User",
      email: "admin@test.com",
      role: "admin",
      previewedPapers: [],
      downloadedPapers: [],
    });

    mockUsers.set(authorId, {
      _id: authorId,
      name: "Paper Author",
      email: "author@test.com",
      role: "user",
      previewedPapers: [],
      downloadedPapers: [],
    });

    mockUsers.set(unentitledStudentId, {
      _id: unentitledStudentId,
      name: "Unentitled Student",
      email: "unentitled@test.com",
      role: "user",
      previewedPapers: [],
      downloadedPapers: [],
    });

    mockUsers.set(previewedStudentId, {
      _id: previewedStudentId,
      name: "Previewed Student",
      email: "previewed@test.com",
      role: "user",
      previewedPapers: [new mongoose.Types.ObjectId(approvedPaperId)],
      downloadedPapers: [],
    });

    mockUsers.set(downloadedStudentId, {
      _id: downloadedStudentId,
      name: "Downloaded Student",
      email: "downloaded@test.com",
      role: "user",
      previewedPapers: [],
      downloadedPapers: [new mongoose.Types.ObjectId(approvedPaperId)],
    });

    // Populate Papers
    mockPapers.set(approvedPaperId, {
      _id: approvedPaperId,
      title: "Algorithms & Data Structures",
      subject: "Computer Science",
      semester: 3,
      status: "approved",
      isActive: true,
      uploadedBy: authorId,
    });

    mockPapers.set(pendingPaperId, {
      _id: pendingPaperId,
      title: "Pending Cryptography Notes",
      subject: "Computer Science",
      semester: 5,
      status: "pending",
      isActive: true,
      uploadedBy: authorId,
    });

    mockPapers.set(inactivePaperId, {
      _id: inactivePaperId,
      title: "Inactive Archived Paper",
      subject: "Mathematics",
      semester: 1,
      status: "approved",
      isActive: false,
      uploadedBy: authorId,
    });

    // Populate Chunks
    mockChunks.set(chunk1Id, {
      _id: chunk1Id,
      paperId: approvedPaperId,
      chunkId: "chunk_algo_01",
      pageNumber: 1,
      chunkText: "Binary search runs in O(log n) time complexity.",
      embedding: [0.1, 0.2, 0.3],
      metadata: new Map([["source", "lecture"]]),
      __v: 0,
    });
  });

  // ==========================================================================
  // 1. SEC-006: CLOUDINARY SECRET PROTECTION
  // ==========================================================================
  describe("SEC-006: Cloudinary API Secret Console Logging Protection", () => {
    it("1.1 ai/config/cloudinary.js never outputs API_SECRET to stdout or stderr on boot", () => {
      const canarySecret = "SUPER_SECRET_CANARY_VALUE_9876543210_XYZ";
      const cloudinaryModuleUrl = new URL("../config/cloudinary.js", import.meta.url).href;
      const result = spawnSync(
        process.execPath,
        [
          "--input-type=module",
          "-e",
          `
          process.env.API_SECRET = "${canarySecret}";
          process.env.CLOUD_NAME = "dummy_cloud";
          process.env.API_KEY = "dummy_key";
          import("${cloudinaryModuleUrl}");
        `,
        ],
        {
          encoding: "utf8",
        }
      );

      assert.strictEqual(result.status, 0);
      assert.strictEqual(result.stdout.includes(canarySecret), false);
      assert.strictEqual(result.stderr.includes(canarySecret), false);
      assert.strictEqual(result.stdout.includes("API_SECRET:"), false);
      assert.strictEqual(result.stdout.includes("ENV CHECK:"), false);
    });

    it("1.2 console.log spy confirms zero credential leakage when initializing Cloudinary", async () => {
      const logs = [];
      const originalLog = console.log;
      console.log = (...args) => {
        logs.push(args.join(" "));
      };

      try {
        process.env.API_SECRET = "SPY_TEST_API_SECRET_XYZ999";
        // Re-read configuration module
        await import(`../config/cloudinary.js?update=${Date.now()}`);
      } finally {
        console.log = originalLog;
      }

      const leaked = logs.some((l) => l.includes("SPY_TEST_API_SECRET_XYZ999") || l.includes("ENV CHECK:"));
      assert.strictEqual(leaked, false);
    });
  });

  // ==========================================================================
  // 2. SEC-009: AI PAPER ENTITLEMENT & PAYWALL ENFORCEMENT
  // ==========================================================================
  describe("SEC-009: AI Paper Entitlement & Paywall BOLA/IDOR Enforcement", () => {
    it("2.1 checkPaperEntitlement returns 400 on invalid or non-ObjectId paper ID", async () => {
      const r1 = await checkPaperEntitlement(unentitledStudentId, "user", null);
      assert.strictEqual(r1.isEntitled, false);
      assert.strictEqual(r1.status, 400);

      const r2 = await checkPaperEntitlement(unentitledStudentId, "user", "invalid-id-format");
      assert.strictEqual(r2.isEntitled, false);
      assert.strictEqual(r2.status, 400);
    });

    it("2.2 checkPaperEntitlement returns 404 on unapproved or missing papers", async () => {
      const nonExistentId = new mongoose.Types.ObjectId().toString();
      const r1 = await checkPaperEntitlement(unentitledStudentId, "user", nonExistentId);
      assert.strictEqual(r1.isEntitled, false);
      assert.strictEqual(r1.status, 404);

      // Pending paper
      const r2 = await checkPaperEntitlement(unentitledStudentId, "user", pendingPaperId);
      assert.strictEqual(r2.isEntitled, false);
      assert.strictEqual(r2.status, 404);

      // Inactive paper
      const r3 = await checkPaperEntitlement(unentitledStudentId, "user", inactivePaperId);
      assert.strictEqual(r3.isEntitled, false);
      assert.strictEqual(r3.status, 404);
    });

    it("2.3 checkPaperEntitlement grants access to platform administrators", async () => {
      const r = await checkPaperEntitlement(adminId, "admin", approvedPaperId);
      assert.strictEqual(r.isEntitled, true);
      assert.strictEqual(r.paper._id, approvedPaperId);
    });

    it("2.4 checkPaperEntitlement grants access to the author of the paper", async () => {
      const r = await checkPaperEntitlement(authorId, "user", approvedPaperId);
      assert.strictEqual(r.isEntitled, true);
      assert.strictEqual(r.paper._id, approvedPaperId);
    });

    it("2.5 checkPaperEntitlement rejects unentitled students with HTTP 403", async () => {
      const r = await checkPaperEntitlement(unentitledStudentId, "user", approvedPaperId);
      assert.strictEqual(r.isEntitled, false);
      assert.strictEqual(r.status, 403);
      assert.match(r.error, /preview or download this paper/);
    });

    it("2.6 checkPaperEntitlement grants access to students who previewed the paper", async () => {
      const r = await checkPaperEntitlement(previewedStudentId, "user", approvedPaperId);
      assert.strictEqual(r.isEntitled, true);
      assert.strictEqual(r.paper._id, approvedPaperId);
    });

    it("2.7 checkPaperEntitlement grants access to students who downloaded the paper", async () => {
      const r = await checkPaperEntitlement(downloadedStudentId, "user", approvedPaperId);
      assert.strictEqual(r.isEntitled, true);
      assert.strictEqual(r.paper._id, approvedPaperId);
    });

    it("2.8 POST /study-notes rejects unauthenticated requests with HTTP 401", async () => {
      const res = await makeRequest({
        path: "/api/v1/ai/study-notes",
        method: "POST",
        body: { paperId: approvedPaperId, topic: "Time Complexity" },
      });

      assert.strictEqual(res.statusCode, 401);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.error, /Authorization token missing/);
    });

    it("2.9 POST /study-notes rejects unentitled students with HTTP 403", async () => {
      const res = await makeRequest({
        path: "/api/v1/ai/study-notes",
        method: "POST",
        headers: { Authorization: `Bearer ${unentitledToken}` },
        body: { paperId: approvedPaperId, topic: "Time Complexity" },
      });

      assert.strictEqual(res.statusCode, 403);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.error, /preview or download/);
    });

    it("2.10 POST /study-notes passes entitlement for previewed paper owner with HTTP 200", async () => {
      const res = await makeRequest({
        path: "/api/v1/ai/study-notes",
        method: "POST",
        headers: { Authorization: `Bearer ${previewedToken}` },
        body: { paperId: approvedPaperId, topic: "Time Complexity" },
      });

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.success, true);
    });

    it("2.11 POST /quiz rejects unauthenticated requests with HTTP 401", async () => {
      const res = await makeRequest({
        path: "/api/v1/ai/quiz",
        method: "POST",
        body: { paperId: approvedPaperId, type: "mcq", count: 3 },
      });

      assert.strictEqual(res.statusCode, 401);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.error, /Authorization token missing/);
    });

    it("2.12 POST /quiz rejects invalid paperId with HTTP 400", async () => {
      const res = await makeRequest({
        path: "/api/v1/ai/quiz",
        method: "POST",
        headers: { Authorization: `Bearer ${adminToken}` },
        body: { paperId: "non-existent-id" },
      });

      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.error, /Invalid paper ID/);
    });

    it("2.13 POST /quiz rejects unentitled students with HTTP 403", async () => {
      const res = await makeRequest({
        path: "/api/v1/ai/quiz",
        method: "POST",
        headers: { Authorization: `Bearer ${unentitledToken}` },
        body: { paperId: approvedPaperId, type: "mcq", count: 3 },
      });

      assert.strictEqual(res.statusCode, 403);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.error, /preview or download/);
    });

    it("2.14 POST /quiz passes entitlement for previewed paper owner with HTTP 200", async () => {
      const res = await makeRequest({
        path: "/api/v1/ai/quiz",
        method: "POST",
        headers: { Authorization: `Bearer ${previewedToken}` },
        body: { paperId: approvedPaperId, type: "mcq", count: 3 },
      });

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.success, true);
    });

    it("2.15 POST /flashcards rejects unauthenticated requests with HTTP 401", async () => {
      const res = await makeRequest({
        path: "/api/v1/ai/flashcards",
        method: "POST",
        body: { paperId: approvedPaperId },
      });

      assert.strictEqual(res.statusCode, 401);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.error, /Authorization token missing/);
    });

    it("2.16 POST /flashcards rejects unentitled students with HTTP 403", async () => {
      const res = await makeRequest({
        path: "/api/v1/ai/flashcards",
        method: "POST",
        headers: { Authorization: `Bearer ${unentitledToken}` },
        body: { paperId: approvedPaperId },
      });

      assert.strictEqual(res.statusCode, 403);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.error, /preview or download/);
    });

    it("2.17 POST /flashcards passes entitlement for previewed paper owner with HTTP 200", async () => {
      const res = await makeRequest({
        path: "/api/v1/ai/flashcards",
        method: "POST",
        headers: { Authorization: `Bearer ${previewedToken}` },
        body: { paperId: approvedPaperId },
      });

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.success, true);
    });

    it("2.18 POST /exam-plan rejects unauthenticated requests with HTTP 401", async () => {
      const res = await makeRequest({
        path: "/api/v1/ai/exam-plan",
        method: "POST",
        body: { paperId: approvedPaperId, timeAvailable: "2 hours" },
      });

      assert.strictEqual(res.statusCode, 401);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.error, /Authorization token missing/);
    });

    it("2.19 POST /exam-plan rejects unentitled students with HTTP 403", async () => {
      const res = await makeRequest({
        path: "/api/v1/ai/exam-plan",
        method: "POST",
        headers: { Authorization: `Bearer ${unentitledToken}` },
        body: { paperId: approvedPaperId, timeAvailable: "2 hours" },
      });

      assert.strictEqual(res.statusCode, 403);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.error, /preview or download/);
    });

    it("2.20 POST /exam-plan passes entitlement for previewed paper owner with HTTP 200", async () => {
      const res = await makeRequest({
        path: "/api/v1/ai/exam-plan",
        method: "POST",
        headers: { Authorization: `Bearer ${previewedToken}` },
        body: { paperId: approvedPaperId, timeAvailable: "2 hours" },
      });

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.success, true);
    });

    it("2.21 POST /topic-analysis rejects unauthenticated requests with HTTP 401", async () => {
      const res = await makeRequest({
        path: "/api/v1/ai/topic-analysis",
        method: "POST",
        body: { paperId: approvedPaperId },
      });

      assert.strictEqual(res.statusCode, 401);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.error, /Authorization token missing/);
    });

    it("2.22 POST /topic-analysis rejects unentitled students with HTTP 403", async () => {
      const res = await makeRequest({
        path: "/api/v1/ai/topic-analysis",
        method: "POST",
        headers: { Authorization: `Bearer ${unentitledToken}` },
        body: { paperId: approvedPaperId },
      });

      assert.strictEqual(res.statusCode, 403);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.error, /preview or download/);
    });

    it("2.23 POST /topic-analysis passes entitlement for previewed paper owner with HTTP 200", async () => {
      const res = await makeRequest({
        path: "/api/v1/ai/topic-analysis",
        method: "POST",
        headers: { Authorization: `Bearer ${previewedToken}` },
        body: { paperId: approvedPaperId },
      });

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.success, true);
    });
  });

  // ==========================================================================
  // 3. SEC-010: AI KNOWLEDGE CHUNK EXFILTRATION PROTECTION
  // ==========================================================================
  describe("SEC-010: AI Knowledge Chunk Isolation & Exfiltration Protection", () => {
    it("3.1 GET /study-knowledge without paperId returns HTTP 400 for non-admins", async () => {
      const res = await makeRequest({
        path: "/api/v1/ai/study-knowledge",
        headers: { Authorization: `Bearer ${unentitledToken}` },
      });

      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.error, /paperId query parameter is required/);
    });

    it("3.2 GET /study-knowledge without paperId succeeds with HTTP 200 for administrators", async () => {
      const res = await makeRequest({
        path: "/api/v1/ai/study-knowledge",
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(Array.isArray(res.body.chunks), true);
    });

    it("3.3 GET /study-knowledge with unentitled paperId returns HTTP 403", async () => {
      const res = await makeRequest({
        path: `/api/v1/ai/study-knowledge?paperId=${approvedPaperId}`,
        headers: { Authorization: `Bearer ${unentitledToken}` },
      });

      assert.strictEqual(res.statusCode, 403);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.error, /preview or download/);
    });

    it("3.4 GET /study-knowledge with entitled paperId returns permitted chunks", async () => {
      const res = await makeRequest({
        path: `/api/v1/ai/study-knowledge?paperId=${approvedPaperId}`,
        headers: { Authorization: `Bearer ${downloadedToken}` },
      });

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.chunks.length, 1);
      assert.strictEqual(res.body.chunks[0]._id, chunk1Id);
    });

    it("3.5 GET /study-knowledge/:id returns HTTP 400 on invalid chunk ID format", async () => {
      const res = await makeRequest({
        path: "/api/v1/ai/study-knowledge/not-a-valid-id",
        headers: { Authorization: `Bearer ${unentitledToken}` },
      });

      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.error, /Invalid study knowledge chunk ID/);
    });

    it("3.6 GET /study-knowledge/:id returns HTTP 403 when user is unentitled to chunk's paper", async () => {
      const res = await makeRequest({
        path: `/api/v1/ai/study-knowledge/${chunk1Id}`,
        headers: { Authorization: `Bearer ${unentitledToken}` },
      });

      assert.strictEqual(res.statusCode, 403);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.error, /preview or download/);
    });

    it("3.7 GET /study-knowledge/:id returns chunk for author, entitled user, and admin", async () => {
      // Author
      const resAuthor = await makeRequest({
        path: `/api/v1/ai/study-knowledge/${chunk1Id}`,
        headers: { Authorization: `Bearer ${authorToken}` },
      });
      assert.strictEqual(resAuthor.statusCode, 200);
      assert.strictEqual(resAuthor.body.chunk._id, chunk1Id);

      // Entitled student
      const resEntitled = await makeRequest({
        path: `/api/v1/ai/study-knowledge/${chunk1Id}`,
        headers: { Authorization: `Bearer ${previewedToken}` },
      });
      assert.strictEqual(resEntitled.statusCode, 200);
      assert.strictEqual(resEntitled.body.chunk._id, chunk1Id);

      // Admin
      const resAdmin = await makeRequest({
        path: `/api/v1/ai/study-knowledge/${chunk1Id}`,
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.strictEqual(resAdmin.statusCode, 200);
      assert.strictEqual(resAdmin.body.chunk._id, chunk1Id);
    });

    it("3.8 Sensitive chunk fields (embedding, embeddingVersion, metadata, __v) are excluded from chunk responses", async () => {
      const res = await makeRequest({
        path: `/api/v1/ai/study-knowledge/${chunk1Id}`,
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.chunk.embedding, undefined);
      assert.strictEqual(res.body.chunk.embeddingVersion, undefined);
      assert.strictEqual(res.body.chunk.metadata, undefined);
      assert.strictEqual(res.body.chunk.__v, undefined);
    });
  });

  // ==========================================================================
  // 4. SEC-011: REGULAR EXPRESSION REDOS & SEARCH SANITIZATION
  // ==========================================================================
  describe("SEC-011: Regular Expression Injection & ReDoS Protection", () => {
    it("4.1 escapeRegex neutralizes all regular expression metacharacters", () => {
      const specialChars = ".*+?^${}()|[]\\";
      const escaped = escapeRegex(specialChars);
      assert.strictEqual(escaped, "\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\");

      // Catastrophic backtracking ReDoS pattern is escaped
      const redosPayload = "(a+)+$";
      const escapedRedos = escapeRegex(redosPayload);
      assert.strictEqual(escapedRedos, "\\(a\\+\\)\\+\\$");
    });

    it("4.2 escapeRegex handles non-string, empty, and normal inputs safely", () => {
      assert.strictEqual(escapeRegex(""), "");
      assert.strictEqual(escapeRegex(null), "");
      assert.strictEqual(escapeRegex(undefined), "");
      assert.strictEqual(escapeRegex(12345), "");
      assert.strictEqual(escapeRegex("NormalSearchTerm"), "NormalSearchTerm");
    });

    it("4.3 GET /study-knowledge/search rejects missing or empty q query with HTTP 400", async () => {
      const res1 = await makeRequest({
        path: `/api/v1/ai/study-knowledge/search?paperId=${approvedPaperId}`,
        headers: { Authorization: `Bearer ${downloadedToken}` },
      });
      assert.strictEqual(res1.statusCode, 400);
      assert.match(res1.body.error, /Search query 'q' must be a valid non-empty string/);

      const res2 = await makeRequest({
        path: `/api/v1/ai/study-knowledge/search?paperId=${approvedPaperId}&q=%20%20%20`,
        headers: { Authorization: `Bearer ${downloadedToken}` },
      });
      assert.strictEqual(res2.statusCode, 400);
      assert.match(res2.body.error, /Search query 'q' cannot be empty/);
    });

    it("4.4 GET /study-knowledge/search rejects queries exceeding 200 characters with HTTP 400", async () => {
      const longQuery = "a".repeat(201);
      const res = await makeRequest({
        path: `/api/v1/ai/study-knowledge/search?paperId=${approvedPaperId}&q=${longQuery}`,
        headers: { Authorization: `Bearer ${downloadedToken}` },
      });

      assert.strictEqual(res.statusCode, 400);
      assert.match(res.body.error, /exceeds maximum length of 200 characters/);
    });

    it("4.5 GET /study-knowledge/search treats regex metacharacters as literal text", async () => {
      // Chunk has: "Binary search runs in O(log n) time complexity."
      // Query has parentheses and spaces: "O(log n)"
      const res = await makeRequest({
        path: `/api/v1/ai/study-knowledge/search?paperId=${approvedPaperId}&q=O(log%20n)`,
        headers: { Authorization: `Bearer ${downloadedToken}` },
      });

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.chunks.length, 1);
      assert.strictEqual(res.body.chunks[0]._id, chunk1Id);
    });
  });

  // ==========================================================================
  // 5. SEC-012: MONGOSANITIZE NOSQL INJECTION PROTECTION
  // ==========================================================================
  describe("SEC-012: MongoSanitize Middleware NoSQL Injection Neutralization", () => {
    it("5.1 Strips $gt and $where operators from request body", () => {
      const req = {
        body: {
          username: "student",
          password: { $gt: "" },
          metadata: { $where: "sleep(5000)" },
          safeField: "legitimate_value",
        },
      };
      const res = {};
      let nextCalled = false;

      // Execute middleware under test
      if (req.body) mongoSanitize.sanitize(req.body);

      assert.strictEqual(req.body.password.$gt, undefined);
      assert.strictEqual(req.body.metadata.$where, undefined);
      assert.strictEqual(req.body.safeField, "legitimate_value");
      assert.strictEqual(req.body.username, "student");
    });

    it("5.2 Express 5 req.query sanitization handles read-only getter without crashing", () => {
      // Create request object with Express 5 getter property behavior
      const internalQuery = { search: { $gt: "" }, page: "1" };
      const req = {
        get query() {
          return internalQuery;
        },
      };

      // Apply the exact Express 5 compatible middleware from ai/server.js
      if (req.query) {
        const cleanQuery = mongoSanitize.sanitize(req.query);
        Object.defineProperty(req, "query", {
          value: cleanQuery,
          writable: true,
          enumerable: true,
          configurable: true,
        });
      }

      assert.strictEqual(req.query.search.$gt, undefined);
      assert.strictEqual(req.query.page, "1");
    });

    it("5.3 Nested NoSQL operator keys are deeply stripped across arrays and objects", () => {
      const deepPayload = {
        filters: [
          { field: "price", operator: { $ne: 0 } },
          { subfilter: { $regex: ".*" } },
        ],
        validArray: ["item1", "item2"],
      };

      mongoSanitize.sanitize(deepPayload);

      assert.strictEqual(deepPayload.filters[0].operator.$ne, undefined);
      assert.strictEqual(deepPayload.filters[1].subfilter.$regex, undefined);
      assert.strictEqual(deepPayload.validArray.length, 2);
    });
  });

  // ==========================================================================
  // 6. SEC-014: OCR RESOURCE PROTECTION & BOUNDED PAGE CEILING
  // ==========================================================================
  describe("SEC-014: Unbounded PDF Page Rendering & OCR Resource Protection", () => {
    const originalMaxOcrEnv = process.env.MAX_OCR_PAGES;

    afterEach(() => {
      activeConvertHandler = null;
      activeWorkerHandler = null;
      if (originalMaxOcrEnv !== undefined) {
        process.env.MAX_OCR_PAGES = originalMaxOcrEnv;
      } else {
        delete process.env.MAX_OCR_PAGES;
      }
    });

    it("6.1 getMaxOcrPages defaults to DEFAULT_MAX_OCR_PAGES (10) when env is unset", () => {
      delete process.env.MAX_OCR_PAGES;
      assert.strictEqual(getMaxOcrPages(), DEFAULT_MAX_OCR_PAGES);
      assert.strictEqual(DEFAULT_MAX_OCR_PAGES, 10);
    });

    it("6.2 getMaxOcrPages parses valid numeric string and respects limits", () => {
      process.env.MAX_OCR_PAGES = "5";
      assert.strictEqual(getMaxOcrPages(), 5);

      process.env.MAX_OCR_PAGES = "12";
      assert.strictEqual(getMaxOcrPages(), 12);
    });

    it("6.3 getMaxOcrPages enforces HARD_CEILING_OCR_PAGES (15) on high inputs", () => {
      process.env.MAX_OCR_PAGES = "50";
      assert.strictEqual(getMaxOcrPages(), HARD_CEILING_OCR_PAGES);
      assert.strictEqual(HARD_CEILING_OCR_PAGES, 15);

      process.env.MAX_OCR_PAGES = "999";
      assert.strictEqual(getMaxOcrPages(), 15);
    });

    it("6.4 getMaxOcrPages falls back to default on negative, zero, or non-numeric strings", () => {
      process.env.MAX_OCR_PAGES = "-5";
      assert.strictEqual(getMaxOcrPages(), 10);

      process.env.MAX_OCR_PAGES = "0";
      assert.strictEqual(getMaxOcrPages(), 10);

      process.env.MAX_OCR_PAGES = "invalid_string";
      assert.strictEqual(getMaxOcrPages(), 10);

      process.env.MAX_OCR_PAGES = "10.75";
      assert.strictEqual(getMaxOcrPages(), 10);
    });

    it("6.5 runOcrOnBuffer processes pages incrementally and terminates worker on success", async () => {
      const convertedOptions = [];
      let workerTerminated = false;
      let recognizeCount = 0;

      activeConvertHandler = async (buf, opts) => {
        convertedOptions.push(opts);
        return [new Uint8Array([1, 2, 3])];
      };

      activeWorkerHandler = async () => ({
        recognize: async () => {
          recognizeCount++;
          return { data: { text: "Recognized sample text" } };
        },
        terminate: async () => {
          workerTerminated = true;
        },
      });

      const dummyPdf = Buffer.from("%PDF-1.4 sample");
      const dummyPaper = { _id: "paper123", title: "Sample Ingest" };

      const result = await runOcrOnBuffer(dummyPdf, dummyPaper, 3);

      assert.strictEqual(result.length, 3);
      assert.strictEqual(recognizeCount, 3);
      assert.strictEqual(workerTerminated, true);

      assert.strictEqual(convertedOptions.length, 3);
      assert.deepStrictEqual(convertedOptions[0].page_numbers, [1]);
      assert.deepStrictEqual(convertedOptions[1].page_numbers, [2]);
      assert.deepStrictEqual(convertedOptions[2].page_numbers, [3]);
    });

    it("6.6 runOcrOnBuffer bounds rendering when document has excess pages (e.g., 50 pages capped at ceiling)", async () => {
      process.env.MAX_OCR_PAGES = "5"; // Cap at 5 pages
      const renderedPages = [];

      activeConvertHandler = async (buf, opts) => {
        renderedPages.push(opts.page_numbers[0]);
        return [new Uint8Array([10, 20])];
      };

      activeWorkerHandler = async () => ({
        recognize: async () => ({ data: { text: "page text" } }),
        terminate: async () => {},
      });

      const dummyPdf = Buffer.from("%PDF-1.4 50-page document");
      const dummyPaper = { _id: "paper_large_50", title: "Large 50 Page Document" };

      const result = await runOcrOnBuffer(dummyPdf, dummyPaper, 50);

      // Even though totalPages is 50, only 5 pages must be rendered
      assert.strictEqual(result.length, 5);
      assert.strictEqual(renderedPages.length, 5);
      assert.deepStrictEqual(renderedPages, [1, 2, 3, 4, 5]);
    });

    it("6.7 runOcrOnBuffer guarantees worker is terminated in finally block even when recognition throws", async () => {
      let workerTerminatedAfterError = false;

      activeConvertHandler = async () => [new Uint8Array([1, 2])];

      activeWorkerHandler = async () => ({
        recognize: async () => {
          throw new Error("Simulated OCR worker failure during recognition");
        },
        terminate: async () => {
          workerTerminatedAfterError = true;
        },
      });

      const dummyPdf = Buffer.from("%PDF-1.4 failing");
      const dummyPaper = { _id: "paper_fail", title: "Failing Paper" };

      await assert.rejects(
        async () => {
          await runOcrOnBuffer(dummyPdf, dummyPaper, 2);
        },
        /Simulated OCR worker failure/
      );

      assert.strictEqual(workerTerminatedAfterError, true);
    });
  });
});
