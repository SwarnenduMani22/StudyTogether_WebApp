import test, { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert";
import express from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

// Setup environment for testing before importing router
process.env.JWT_SECRET = "ux02-trending-guest-access-test-secret-12345";
process.env.NODE_ENV = "test";

import paperRouter from "../routes/paper.js";
import User from "../models/User.js";
import Paper from "../models/Paper.js";
import Activity from "../models/Activity.js";

// Mock Activity.create to prevent Mongoose buffering timeouts
Activity.create = async () => ({});

// Mock stores
const mockUsers = new Map();
const mockPapers = new Map();

// Mock User.findById
User.findById = (id) => {
  const user = mockUsers.get(String(id));
  const doc = user
    ? {
        ...user,
        coins: user.coins ?? 0,
        badges: user.badges ? [...user.badges] : [],
        rank: user.rank ?? "Beginner",
        save: async function () {
          return this;
        },
      }
    : null;

  return {
    select: () => ({
      lean: async () => (user ? { ...user } : null),
      then(onFulfilled, onRejected) {
        return Promise.resolve(doc).then(onFulfilled, onRejected);
      },
    }),
    lean: async () => (user ? { ...user } : null),
    then(onFulfilled, onRejected) {
      return Promise.resolve(doc).then(onFulfilled, onRejected);
    },
  };
};

// Mock Paper.aggregate to execute the production pipeline stages faithfully
Paper.aggregate = async (pipeline = []) => {
  let docs = Array.from(mockPapers.values()).map((p) =>
    JSON.parse(JSON.stringify(p))
  );

  for (const stage of pipeline) {
    if (stage.$match) {
      docs = docs.filter((doc) => {
        for (const [key, val] of Object.entries(stage.$match)) {
          if (doc[key] !== val) return false;
        }
        return true;
      });
    } else if (stage.$addFields) {
      for (const doc of docs) {
        for (const [field] of Object.entries(stage.$addFields)) {
          if (field === "averageRating") {
            const ratings = doc.ratings || [];
            if (ratings.length === 0) {
              doc.averageRating = 0;
            } else {
              const sum = ratings.reduce((acc, r) => acc + (r.value || 0), 0);
              doc.averageRating = Number((sum / ratings.length).toFixed(1));
            }
          } else if (field === "popularityScore") {
            // downloads * 2 + views * 0.5 + averageRating * 5
            const downloads = doc.downloads || 0;
            const views = doc.views || 0;
            const avgRating = doc.averageRating || 0;
            doc.popularityScore = downloads * 2 + views * 0.5 + avgRating * 5;
          }
        }
      }
    } else if (stage.$sort) {
      docs.sort((a, b) => {
        if (b.popularityScore !== a.popularityScore) {
          return b.popularityScore - a.popularityScore;
        }
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    } else if (stage.$limit) {
      docs = docs.slice(0, stage.$limit);
    } else if (stage.$lookup) {
      for (const doc of docs) {
        const uId = String(doc[stage.$lookup.localField]);
        const user = mockUsers.get(uId);
        doc[stage.$lookup.as] = user
          ? [JSON.parse(JSON.stringify(user))]
          : [];
      }
    } else if (stage.$unwind) {
      const field = stage.$unwind.replace("$", "");
      docs = docs
        .map((doc) => {
          const arr = doc[field];
          if (Array.isArray(arr) && arr.length > 0) {
            doc[field] = arr[0];
            return doc;
          }
          return null;
        })
        .filter(Boolean);
    } else if (stage.$project) {
      docs = docs.map((doc) => {
        const projected = {};
        for (const [key, inclusion] of Object.entries(stage.$project)) {
          if (inclusion === 1) {
            if (key.includes(".")) {
              const [parent, child] = key.split(".");
              if (!projected[parent]) projected[parent] = {};
              if (doc[parent] && doc[parent][child] !== undefined) {
                projected[parent][child] = doc[parent][child];
              }
            } else {
              if (doc[key] !== undefined) {
                projected[key] = doc[key];
              }
            }
          } else if (inclusion === 0) {
            delete doc[key];
          }
        }
        return Object.keys(projected).length > 0 ? projected : doc;
      });
    }
  }

  return docs;
};

// Helper to seed a test user with sensitive fields
function seedUser({
  id = new mongoose.Types.ObjectId().toString(),
  name = "Test Author",
  email = "author@secret.com",
  role = "student",
  coins = 250,
  password = "$2a$10$hashedsecretpasswordhere",
  refreshToken = "secret-refresh-token-xyz-123",
  isActive = true,
  status = "active",
} = {}) {
  const user = {
    _id: id,
    name,
    email,
    role,
    coins,
    password,
    refreshToken,
    isActive,
    status,
    coinHistory: [{ type: "credit", amount: 50 }],
    bookmarks: [new mongoose.Types.ObjectId().toString()],
    appliedGrants: [{ idempotencyKey: "grant-key-1", amount: 100 }],
    previewedPapers: [new mongoose.Types.ObjectId().toString()],
    downloadedPapers: [new mongoose.Types.ObjectId().toString()],
    statusHistory: [{ action: "enabled", reason: "Good standing", performedBy: new mongoose.Types.ObjectId().toString() }],
    disabledReason: "None",
    disabledBy: null,
    dailyStreak: 5,
    lastActiveDate: "2026-10-30",
    badges: ["First Upload"],
    rank: "Explorer",
  };
  mockUsers.set(id, user);
  return user;
}

// Helper to seed a test paper with sensitive fields
function seedPaper({
  id = new mongoose.Types.ObjectId().toString(),
  title = "Trending Test Paper",
  subject = "Data Structure",
  semester = 3,
  uploadedBy,
  views = 100,
  downloads = 50,
  ratings = [{ user: new mongoose.Types.ObjectId().toString(), value: 5 }],
  status = "approved",
  isActive = true,
  createdAt = new Date(),
} = {}) {
  const paper = {
    _id: id,
    title,
    subject,
    semester,
    uploadedBy: String(uploadedBy),
    views,
    downloads,
    ratings,
    status,
    isActive,
    createdAt: new Date(createdAt).toISOString(),
    pdfLink: "https://res.cloudinary.com/test/raw/upload/v12345/study-together/papers/secret.pdf",
    viewedBy: [new mongoose.Types.ObjectId().toString()],
    reviewedBy: new mongoose.Types.ObjectId().toString(),
    comments: [{ user: new mongoose.Types.ObjectId().toString(), text: "Great paper!", createdAt: new Date() }],
    aiStatus: "completed",
    chunkCount: 15,
    indexedAt: new Date(),
    embeddingVersion: "v1.2",
  };
  mockPapers.set(id, paper);
  return paper;
}

// Build Express app with actual production paper router
const app = express();
app.use(express.json());
app.use("/api/v1/papers", paperRouter);

let server;
let baseUrl;

before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}/api/v1/papers`;
      resolve();
    });
  });
});

after(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
});

beforeEach(() => {
  mockUsers.clear();
  mockPapers.clear();
});

describe("UX-02 SUITE: Public Trending Papers Guest Access & Data Redaction", () => {
  const studentId = new mongoose.Types.ObjectId().toString();
  const adminId = new mongoose.Types.ObjectId().toString();
  const authorId = new mongoose.Types.ObjectId().toString();

  const studentToken = jwt.sign({ id: studentId }, process.env.JWT_SECRET);
  const adminToken = jwt.sign({ id: adminId }, process.env.JWT_SECRET);
  const expiredToken = jwt.sign(
    { id: studentId, exp: Math.floor(Date.now() / 1000) - 3600 },
    process.env.JWT_SECRET
  );

  function setupStandardEnvironment() {
    seedUser({ id: studentId, name: "Student User", role: "student" });
    seedUser({ id: adminId, name: "Admin User", role: "admin" });
    seedUser({ id: authorId, name: "Jane Author", role: "student" });

    // Seed 7 papers with varying popularity
    for (let i = 1; i <= 7; i++) {
      seedPaper({
        id: `paper-${i}`,
        title: `Trending Paper #${i}`,
        uploadedBy: authorId,
        views: i * 20,
        downloads: i * 10,
        ratings: [{ user: studentId, value: 4 }],
        status: "approved",
        isActive: true,
        createdAt: new Date(Date.now() - (10 - i) * 60000),
      });
    }
  }

  // 1. Guest request without Authorization returns HTTP 200
  it("Test 1: Guest request without Authorization header returns HTTP 200", async () => {
    setupStandardEnvironment();

    const res = await fetch(`${baseUrl}/trending`, {
      method: "GET",
    });

    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.success, true);
    assert.ok(Array.isArray(data.papers));
    assert.strictEqual(data.papers.length, 5);
  });

  // 2. Valid student JWT returns HTTP 200
  it("Test 2: Valid student JWT returns HTTP 200", async () => {
    setupStandardEnvironment();

    const res = await fetch(`${baseUrl}/trending`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${studentToken}`,
      },
    });

    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.success, true);
    assert.ok(Array.isArray(data.papers));
    assert.strictEqual(data.papers.length, 5);
  });

  // 3. Valid admin JWT returns HTTP 200
  it("Test 3: Valid admin JWT returns HTTP 200", async () => {
    setupStandardEnvironment();

    const res = await fetch(`${baseUrl}/trending`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });

    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.success, true);
    assert.ok(Array.isArray(data.papers));
    assert.strictEqual(data.papers.length, 5);
  });

  // 4. Malformed Bearer token falls back to guest and returns HTTP 200
  it("Test 4: Malformed Bearer token falls back to guest and returns HTTP 200", async () => {
    setupStandardEnvironment();

    const res = await fetch(`${baseUrl}/trending`, {
      method: "GET",
      headers: {
        Authorization: "Bearer completely-invalid-malformed-jwt-string",
      },
    });

    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.success, true);
    assert.ok(Array.isArray(data.papers));
    assert.strictEqual(data.papers.length, 5);
  });

  // 5. Expired Bearer token falls back to guest and returns HTTP 200
  it("Test 5: Expired Bearer token falls back to guest and returns HTTP 200", async () => {
    setupStandardEnvironment();

    const res = await fetch(`${baseUrl}/trending`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${expiredToken}`,
      },
    });

    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.success, true);
    assert.ok(Array.isArray(data.papers));
    assert.strictEqual(data.papers.length, 5);
  });

  // 6. pdfLink is absent
  it("Test 6: pdfLink is absent from all trending papers in response", async () => {
    setupStandardEnvironment();

    const res = await fetch(`${baseUrl}/trending`, { method: "GET" });
    const data = await res.json();

    assert.strictEqual(res.status, 200);
    for (const paper of data.papers) {
      assert.strictEqual(paper.pdfLink, undefined, "pdfLink must never be exposed");
    }
  });

  // 7. Author object contains only _id and name
  it("Test 7: Author object contains only _id and name", async () => {
    setupStandardEnvironment();

    const res = await fetch(`${baseUrl}/trending`, { method: "GET" });
    const data = await res.json();

    assert.strictEqual(res.status, 200);
    for (const paper of data.papers) {
      assert.ok(paper.uploadedBy, "uploadedBy must exist");
      assert.strictEqual(paper.uploadedBy.name, "Jane Author");
      assert.strictEqual(paper.uploadedBy._id, authorId);

      const authorKeys = Object.keys(paper.uploadedBy).sort();
      assert.deepStrictEqual(authorKeys, ["_id", "name"], "uploadedBy must only have _id and name");
    }
  });

  // 8. Sensitive paper fields are absent
  it("Test 8: Sensitive paper fields (viewedBy, reviewedBy, ratings, comments, aiStatus, chunkCount, indexedAt, embeddingVersion) are absent", async () => {
    setupStandardEnvironment();

    const res = await fetch(`${baseUrl}/trending`, { method: "GET" });
    const data = await res.json();

    assert.strictEqual(res.status, 200);
    for (const paper of data.papers) {
      assert.strictEqual(paper.viewedBy, undefined, "viewedBy must be absent");
      assert.strictEqual(paper.reviewedBy, undefined, "reviewedBy must be absent");
      assert.strictEqual(paper.ratings, undefined, "ratings raw array must be absent");
      assert.strictEqual(paper.comments, undefined, "comments must be absent");
      assert.strictEqual(paper.aiStatus, undefined, "aiStatus must be absent");
      assert.strictEqual(paper.chunkCount, undefined, "chunkCount must be absent");
      assert.strictEqual(paper.indexedAt, undefined, "indexedAt must be absent");
      assert.strictEqual(paper.embeddingVersion, undefined, "embeddingVersion must be absent");
    }
  });

  // 9. Author private fields are absent
  it("Test 9: Author private fields (email, password, refreshToken, coins, coinHistory, appliedGrants, previewedPapers, downloadedPapers, statusHistory, disabledReason, disabledBy) are absent", async () => {
    setupStandardEnvironment();

    const res = await fetch(`${baseUrl}/trending`, { method: "GET" });
    const data = await res.json();

    assert.strictEqual(res.status, 200);
    for (const paper of data.papers) {
      const u = paper.uploadedBy;
      assert.strictEqual(u.email, undefined, "author email must be absent");
      assert.strictEqual(u.password, undefined, "author password must be absent");
      assert.strictEqual(u.refreshToken, undefined, "author refreshToken must be absent");
      assert.strictEqual(u.coins, undefined, "author coins must be absent");
      assert.strictEqual(u.coinHistory, undefined, "author coinHistory must be absent");
      assert.strictEqual(u.appliedGrants, undefined, "author appliedGrants must be absent");
      assert.strictEqual(u.previewedPapers, undefined, "author previewedPapers must be absent");
      assert.strictEqual(u.downloadedPapers, undefined, "author downloadedPapers must be absent");
      assert.strictEqual(u.statusHistory, undefined, "author statusHistory must be absent");
      assert.strictEqual(u.disabledReason, undefined, "author disabledReason must be absent");
      assert.strictEqual(u.disabledBy, undefined, "author disabledBy must be absent");
    }
  });

  // 10. Pending, draft, and inactive papers are excluded
  it("Test 10: Pending, draft, and inactive papers are strictly excluded", async () => {
    setupStandardEnvironment();

    // Add unapproved papers with massive view/download counts that would otherwise trend #1
    seedPaper({
      id: "pending-huge-paper",
      title: "Pending Huge Paper",
      uploadedBy: authorId,
      views: 999999,
      downloads: 999999,
      status: "pending", // pending
      isActive: true,
    });

    seedPaper({
      id: "draft-huge-paper",
      title: "Draft Huge Paper",
      uploadedBy: authorId,
      views: 999999,
      downloads: 999999,
      status: "draft", // draft
      isActive: true,
    });

    seedPaper({
      id: "inactive-huge-paper",
      title: "Inactive Huge Paper",
      uploadedBy: authorId,
      views: 999999,
      downloads: 999999,
      status: "approved",
      isActive: false, // inactive
    });

    const res = await fetch(`${baseUrl}/trending`, { method: "GET" });
    const data = await res.json();

    assert.strictEqual(res.status, 200);
    for (const paper of data.papers) {
      assert.strictEqual(paper.status, "approved");
      assert.notStrictEqual(paper._id, "pending-huge-paper");
      assert.notStrictEqual(paper._id, "draft-huge-paper");
      assert.notStrictEqual(paper._id, "inactive-huge-paper");
    }
  });

  // 11. Top 5 and descending popularity order are preserved
  it("Test 11: Top 5 and descending popularity order (downloads*2 + views*0.5 + averageRating*5) are preserved", async () => {
    setupStandardEnvironment();

    const res = await fetch(`${baseUrl}/trending`, { method: "GET" });
    const data = await res.json();

    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.papers.length, 5, "Must limit to top 5");

    // Verify descending order
    for (let i = 0; i < data.papers.length - 1; i++) {
      const current = data.papers[i].popularityScore;
      const next = data.papers[i + 1].popularityScore;
      assert.ok(
        current >= next,
        `Paper at index ${i} (${current}) must have score >= paper at ${i + 1} (${next})`
      );
    }

    // Paper #7 had highest views (140) and downloads (70) -> should be first
    assert.strictEqual(data.papers[0]._id, "paper-7");
    // Paper #6 should be second
    assert.strictEqual(data.papers[1]._id, "paper-6");
  });

  // 12. Existing authenticated access does not regress
  it("Test 12: Existing authenticated student access does not regress and receives identical papers", async () => {
    setupStandardEnvironment();

    const guestRes = await fetch(`${baseUrl}/trending`, { method: "GET" });
    const guestData = await guestRes.json();

    const authRes = await fetch(`${baseUrl}/trending`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${studentToken}`,
      },
    });
    const authData = await authRes.json();

    assert.strictEqual(guestRes.status, 200);
    assert.strictEqual(authRes.status, 200);
    assert.deepStrictEqual(guestData.papers, authData.papers);
  });
});
