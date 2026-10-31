import test, { describe, it } from "node:test";
import assert from "node:assert";
import http from "http";
import express from "express";
import mongoose from "mongoose";

describe("P1-3 SUITE: Student Paper Deletion Authorization (INT-01)", () => {
  // 1. PaperCard ownership and permission logic
  it("PaperCard permission check: unauthenticated user cannot delete", () => {
    const user = null;
    const paper = { _id: "paper123", uploadedBy: { _id: "userA", name: "Alice" } };

    const uploadedById = paper?.uploadedBy?._id || paper?.uploadedBy;
    const isOwner = Boolean(user?._id && uploadedById && String(uploadedById) === String(user._id));
    const isAdmin = user?.role === "admin";
    const canDelete = isOwner || isAdmin;

    assert.strictEqual(isOwner, false);
    assert.strictEqual(isAdmin, false);
    assert.strictEqual(canDelete, false);
  });

  it("PaperCard permission check: non-owner student cannot delete", () => {
    const user = { _id: "userB", role: "student" };
    const paper = { _id: "paper123", uploadedBy: { _id: "userA", name: "Alice" } };

    const uploadedById = paper?.uploadedBy?._id || paper?.uploadedBy;
    const isOwner = Boolean(user?._id && uploadedById && String(uploadedById) === String(user._id));
    const isAdmin = user?.role === "admin";
    const canDelete = isOwner || isAdmin;

    assert.strictEqual(isOwner, false);
    assert.strictEqual(isAdmin, false);
    assert.strictEqual(canDelete, false);
  });

  it("PaperCard permission check: owner student can delete (populated uploadedBy)", () => {
    const user = { _id: "userA", role: "student" };
    const paper = { _id: "paper123", uploadedBy: { _id: "userA", name: "Alice" } };

    const uploadedById = paper?.uploadedBy?._id || paper?.uploadedBy;
    const isOwner = Boolean(user?._id && uploadedById && String(uploadedById) === String(user._id));
    const isAdmin = user?.role === "admin";
    const canDelete = isOwner || isAdmin;

    assert.strictEqual(isOwner, true);
    assert.strictEqual(isAdmin, false);
    assert.strictEqual(canDelete, true);
  });

  it("PaperCard permission check: owner student can delete (unpopulated ObjectId string)", () => {
    const user = { _id: "userA", role: "student" };
    const paper = { _id: "paper123", uploadedBy: "userA" };

    const uploadedById = paper?.uploadedBy?._id || paper?.uploadedBy;
    const isOwner = Boolean(user?._id && uploadedById && String(uploadedById) === String(user._id));
    const isAdmin = user?.role === "admin";
    const canDelete = isOwner || isAdmin;

    assert.strictEqual(isOwner, true);
    assert.strictEqual(isAdmin, false);
    assert.strictEqual(canDelete, true);
  });

  it("PaperCard permission check: admin can delete any paper, but students cannot see admin edit", () => {
    const adminUser = { _id: "adminUser", role: "admin" };
    const studentUser = { _id: "userA", role: "student" };
    const paper = { _id: "paper123", uploadedBy: { _id: "userA", name: "Alice" } };

    // Admin can delete and edit
    const adminUploadedById = paper?.uploadedBy?._id || paper?.uploadedBy;
    const adminIsAdmin = adminUser?.role === "admin";
    const adminIsOwner = Boolean(
      adminUser?._id && adminUploadedById && String(adminUploadedById) === String(adminUser._id)
    );
    const adminCanDelete = adminIsOwner || adminIsAdmin;
    assert.strictEqual(adminCanDelete, true);
    assert.strictEqual(adminIsAdmin, true);

    // Student owner can delete but NOT see admin-only edit
    const studentUploadedById = paper?.uploadedBy?._id || paper?.uploadedBy;
    const studentIsAdmin = studentUser?.role === "admin";
    const studentIsOwner = Boolean(
      studentUser?._id && studentUploadedById && String(studentUploadedById) === String(studentUser._id)
    );
    const studentCanDelete = studentIsOwner || studentIsAdmin;
    assert.strictEqual(studentCanDelete, true);
    assert.strictEqual(studentIsAdmin, false);
  });

  // 2. Integration / Route simulation tests with Mock AI Server
  it("Backend deletion authorization and side-effects simulation", async () => {
    const TEST_SECRET = "test_internal_key_abc1234567890";
    process.env.INTERNAL_SERVICE_KEY = TEST_SECRET;

    // A. Start Mock AI microservice
    let aiReceivedRequest = null;
    const aiApp = express();
    aiApp.delete("/api/v1/internal/ai/knowledge/:id", (req, res) => {
      aiReceivedRequest = {
        paperId: req.params.id,
        headers: req.headers,
      };
      res.json({ success: true, message: "knowledge deleted" });
    });

    const aiServer = await new Promise((resolve) => {
      const s = aiApp.listen(0, "127.0.0.1", () => resolve(s));
    });
    const aiPort = aiServer.address().port;
    const AI_SERVICE_URL = `http://127.0.0.1:${aiPort}`;

    const getInternalAiHeaders = (hasJsonBody = false) => {
      const headers = {};
      if (hasJsonBody) headers["Content-Type"] = "application/json";
      if (process.env.INTERNAL_SERVICE_KEY) {
        headers["x-internal-service-key"] = process.env.INTERNAL_SERVICE_KEY;
      }
      return headers;
    };

    // B. Mock Paper repository
    const mockPapers = new Map();
    const student1Id = new mongoose.Types.ObjectId().toString();
    const student2Id = new mongoose.Types.ObjectId().toString();
    const adminId = new mongoose.Types.ObjectId().toString();

    const paper1Id = new mongoose.Types.ObjectId().toString();
    const paper2Id = new mongoose.Types.ObjectId().toString();

    mockPapers.set(paper1Id, {
      _id: paper1Id,
      uploadedBy: student1Id,
      title: "Paper 1",
      pdfLink: "https://res.cloudinary.com/test/raw/upload/v123/papers/sample.pdf",
      deleteOne: async function () {
        mockPapers.delete(this._id);
      },
    });

    mockPapers.set(paper2Id, {
      _id: paper2Id,
      uploadedBy: student1Id,
      title: "Paper 2 Without PDF",
      pdfLink: null,
      deleteOne: async function () {
        mockPapers.delete(this._id);
      },
    });

    // C. Start main backend with DELETE /api/v1/papers/:id route logic
    const backendApp = express();
    backendApp.use(express.json());

    const mockVerifyToken = (req, res, next) => {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ error: "Token missing" });
      }
      if (authHeader === "Bearer student1") {
        req.user = { _id: student1Id, role: "student", name: "Student One" };
      } else if (authHeader === "Bearer student2") {
        req.user = { _id: student2Id, role: "student", name: "Student Two" };
      } else if (authHeader === "Bearer admin") {
        req.user = { _id: adminId, role: "admin", name: "Admin User" };
      } else {
        return res.status(401).json({ error: "Invalid or expired token" });
      }
      next();
    };

    backendApp.delete("/api/v1/papers/:id", mockVerifyToken, async (req, res) => {
      try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
          return res.status(400).json({ success: false, error: "Invalid paper id" });
        }

        const paper = mockPapers.get(id);
        if (!paper) {
          return res.status(404).json({ success: false, error: "Paper not found" });
        }

        const isOwner = paper.uploadedBy.toString() === req.user._id.toString();
        if (!isOwner && req.user.role !== "admin") {
          return res.status(403).json({ success: false, error: "Not allowed to delete this paper" });
        }

        await paper.deleteOne();

        // Non-blocking trigger to AI service
        fetch(`${AI_SERVICE_URL}/api/v1/internal/ai/knowledge/${id}`, {
          method: "DELETE",
          headers: getInternalAiHeaders(false),
        }).catch((err) => console.error("AI trigger err:", err.message));

        res.json({ success: true, message: "Paper deleted successfully" });
      } catch (err) {
        res.status(500).json({ success: false, error: err.message });
      }
    });

    const backendServer = await new Promise((resolve) => {
      const s = backendApp.listen(0, "127.0.0.1", () => resolve(s));
    });
    const backendPort = backendServer.address().port;

    const makeDeleteRequest = (paperId, authHeader) => {
      return new Promise((resolve, reject) => {
        const headers = {};
        if (authHeader) headers["Authorization"] = authHeader;
        const req = http.request(
          {
            hostname: "127.0.0.1",
            port: backendPort,
            path: `/api/v1/papers/${paperId}`,
            method: "DELETE",
            headers,
          },
          (res) => {
            let data = "";
            res.on("data", (chunk) => (data += chunk));
            res.on("end", () => {
              resolve({
                statusCode: res.statusCode,
                body: JSON.parse(data),
              });
            });
          }
        );
        req.on("error", reject);
        req.end();
      });
    };

    try {
      // 2a. Unauthenticated request -> 401
      const unauthRes = await makeDeleteRequest(paper1Id, null);
      assert.strictEqual(unauthRes.statusCode, 401);
      assert.ok(mockPapers.has(paper1Id));

      // 2b. Non-owner student deleting paper1 -> 403
      const forbiddenRes = await makeDeleteRequest(paper1Id, "Bearer student2");
      assert.strictEqual(forbiddenRes.statusCode, 403);
      assert.ok(mockPapers.has(paper1Id));

      // 2c. Owner student deleting paper1 -> 200 and triggers AI deletion
      aiReceivedRequest = null;
      const successRes = await makeDeleteRequest(paper1Id, "Bearer student1");
      assert.strictEqual(successRes.statusCode, 200);
      assert.strictEqual(successRes.body.success, true);
      assert.strictEqual(mockPapers.has(paper1Id), false);

      // Wait briefly for asynchronous fetch to deliver
      await new Promise((r) => setTimeout(r, 100));
      assert.strictEqual(aiReceivedRequest?.paperId, paper1Id);
      assert.strictEqual(aiReceivedRequest?.headers?.["x-internal-service-key"], TEST_SECRET);

      // 2d. Deleting paper without pdfLink -> succeeds without error
      const nullPdfRes = await makeDeleteRequest(paper2Id, "Bearer student1");
      assert.strictEqual(nullPdfRes.statusCode, 200);
      assert.strictEqual(nullPdfRes.body.success, true);
      assert.strictEqual(mockPapers.has(paper2Id), false);
    } finally {
      await Promise.all([
        new Promise((resolve) => aiServer.close(resolve)),
        new Promise((resolve) => backendServer.close(resolve)),
      ]);
    }
  });
});
