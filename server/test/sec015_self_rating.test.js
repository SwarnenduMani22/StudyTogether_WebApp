import test, { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert";
import express from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

// Setup environment for testing before importing router
process.env.JWT_SECRET = "sec015-author-self-rating-test-secret-key-12345";
process.env.NODE_ENV = "test";

import paperRouter from "../routes/paper.js";
import User from "../models/User.js";
import Paper from "../models/Paper.js";

// Mock store
const mockUsers = new Map();
const mockPapers = new Map();

// Spy counters
let countDocumentsCalls = 0;

// Override User methods
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
    then(onFulfilled, onRejected) {
      return Promise.resolve(doc).then(onFulfilled, onRejected);
    },
    select: () => ({
      lean: async () => (user ? { ...user } : null),
      then(onFulfilled, onRejected) {
        return Promise.resolve(doc).then(onFulfilled, onRejected);
      },
    }),
    lean: async () => (user ? { ...user } : null),
  };
};

// Override Paper.countDocuments (called by badge recalculation)
Paper.countDocuments = async () => {
  countDocumentsCalls++;
  return 0;
};

// Override Paper.findOne to resolve from our mockPapers store
Paper.findOne = async (query) => {
  const paper = mockPapers.get(String(query._id));
  if (!paper) return null;
  if (query.status && paper.status !== query.status) return null;
  if (query.isActive !== undefined && paper.isActive !== query.isActive) return null;
  return paper;
};

// Helper to create test paper
function createTestPaper({
  id = new mongoose.Types.ObjectId().toString(),
  uploadedBy,
  status = "approved",
  isActive = true,
  ratings = [],
} = {}) {
  let saveCount = 0;
  const paper = {
    _id: id,
    title: "Data Structures & Algorithms in C++",
    uploadedBy,
    status,
    isActive,
    ratings: [...ratings],
    get saveCount() {
      return saveCount;
    },
    get averageRating() {
      if (!this.ratings || this.ratings.length === 0) return 0;
      const sum = this.ratings.reduce((acc, r) => acc + r.value, 0);
      return Number((sum / this.ratings.length).toFixed(1));
    },
    save: async function () {
      saveCount++;
      return this;
    },
  };
  return paper;
}

// Build Express app with the actual production paper router
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
  countDocumentsCalls = 0;
});

describe("SEC-015: Block Self-Rating Manipulation (Production Router Tests)", () => {
  const authorObjectId = new mongoose.Types.ObjectId();
  const authorId = authorObjectId.toString();

  const peerObjectId = new mongoose.Types.ObjectId();
  const peerId = peerObjectId.toString();

  const adminObjectId = new mongoose.Types.ObjectId();
  const adminId = adminObjectId.toString();

  const authorToken = jwt.sign({ id: authorId }, process.env.JWT_SECRET);
  const peerToken = jwt.sign({ id: peerId }, process.env.JWT_SECRET);
  const adminToken = jwt.sign({ id: adminId }, process.env.JWT_SECRET);

  function setupStandardUsers() {
    mockUsers.set(authorId, {
      _id: authorObjectId,
      name: "Author Student",
      email: "author@test.com",
      role: "student",
      coins: 0,
      badges: [],
      rank: "Beginner",
      isActive: true,
      status: "active",
    });
    mockUsers.set(peerId, {
      _id: peerObjectId,
      name: "Peer Reviewer",
      email: "peer@test.com",
      role: "student",
      coins: 0,
      badges: [],
      rank: "Beginner",
      isActive: true,
      status: "active",
    });
    mockUsers.set(adminId, {
      _id: adminObjectId,
      name: "Admin User",
      email: "admin@test.com",
      role: "admin",
      coins: 0,
      badges: [],
      rank: "Beginner",
      isActive: true,
      status: "active",
    });
  }

  // Case 1: Author self-rating attempt
  it("Case 1: Author submitting rating on own paper is rejected with HTTP 403 and no side effects", async () => {
    setupStandardUsers();
    const paper = createTestPaper({ uploadedBy: authorObjectId });
    mockPapers.set(paper._id, paper);

    const res = await fetch(`${baseUrl}/${paper._id}/rate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authorToken}`,
      },
      body: JSON.stringify({ rating: 5 }),
    });

    const data = await res.json();

    // Verify 403 response shape
    assert.strictEqual(res.status, 403);
    assert.strictEqual(data.success, false);
    assert.strictEqual(data.error, "Authors cannot rate their own papers");

    // Verify no side effects
    assert.strictEqual(paper.ratings.length, 0, "Ratings array must remain empty");
    assert.strictEqual(paper.averageRating, 0, "averageRating must remain 0");
    assert.strictEqual(paper.saveCount, 0, "paper.save() must NOT be called on denial");
    assert.strictEqual(countDocumentsCalls, 0, "Badge recalculation must NOT be invoked on denial");
  });

  // Case 2: Peer rating
  it("Case 2: Peer submitting a valid rating succeeds and updates average rating", async () => {
    setupStandardUsers();
    const paper = createTestPaper({ uploadedBy: authorObjectId });
    mockPapers.set(paper._id, paper);

    const res = await fetch(`${baseUrl}/${paper._id}/rate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${peerToken}`,
      },
      body: JSON.stringify({ rating: 4 }),
    });

    const data = await res.json();

    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.averageRating, 4);
    assert.strictEqual(paper.ratings.length, 1);
    assert.strictEqual(paper.ratings[0].value, 4);
    assert.strictEqual(paper.saveCount, 1, "paper.save() must be called once on success");
    assert.ok(countDocumentsCalls > 0, "Badge recalculation was triggered for peer rating");
  });

  // Case 3: Peer rating update
  it("Case 3: Peer updating existing rating updates value in place without duplicates", async () => {
    setupStandardUsers();
    const paper = createTestPaper({
      uploadedBy: authorObjectId,
      ratings: [{ user: peerObjectId, value: 3 }],
    });
    mockPapers.set(paper._id, paper);

    const res = await fetch(`${baseUrl}/${paper._id}/rate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${peerToken}`,
      },
      body: JSON.stringify({ rating: 5 }),
    });

    const data = await res.json();

    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.averageRating, 5);
    assert.strictEqual(paper.ratings.length, 1, "No duplicate rating entry added");
    assert.strictEqual(paper.ratings[0].value, 5, "Rating value updated in place");
    assert.strictEqual(paper.saveCount, 1);
  });

  // Case 3b: Submitting identical rating rejected
  it("Case 3b: Submitting identical rating value returns 400 'You already gave this rating'", async () => {
    setupStandardUsers();
    const paper = createTestPaper({
      uploadedBy: authorObjectId,
      ratings: [{ user: peerObjectId, value: 5 }],
    });
    mockPapers.set(paper._id, paper);

    const res = await fetch(`${baseUrl}/${paper._id}/rate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${peerToken}`,
      },
      body: JSON.stringify({ rating: 5 }),
    });

    const data = await res.json();

    assert.strictEqual(res.status, 400);
    assert.strictEqual(data.success, false);
    assert.strictEqual(data.error, "You already gave this rating");
    assert.strictEqual(paper.saveCount, 0);
  });

  // Case 4: Admin restriction
  it("Case 4: Admin rating attempt receives existing 403 response", async () => {
    setupStandardUsers();
    const paper = createTestPaper({ uploadedBy: authorObjectId });
    mockPapers.set(paper._id, paper);

    const res = await fetch(`${baseUrl}/${paper._id}/rate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ rating: 5 }),
    });

    const data = await res.json();

    assert.strictEqual(res.status, 403);
    assert.strictEqual(data.success, false);
    assert.strictEqual(data.error, "Admins cannot rate papers");
    assert.strictEqual(paper.saveCount, 0);
  });

  // Case 5: Unauthenticated request
  it("Case 5: Unauthenticated request receives 401 Unauthorized", async () => {
    const paper = createTestPaper({ uploadedBy: authorObjectId });
    mockPapers.set(paper._id, paper);

    const res = await fetch(`${baseUrl}/${paper._id}/rate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ rating: 5 }),
    });

    const data = await res.json();

    assert.strictEqual(res.status, 401);
    assert.strictEqual(data.success, false);
    assert.strictEqual(paper.saveCount, 0);
  });

  // Case 6: Invalid ratings and invalid paper IDs
  it("Case 6a: Rating 0 is rejected with HTTP 400", async () => {
    setupStandardUsers();
    const paper = createTestPaper({ uploadedBy: authorObjectId });
    mockPapers.set(paper._id, paper);

    const res = await fetch(`${baseUrl}/${paper._id}/rate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${peerToken}`,
      },
      body: JSON.stringify({ rating: 0 }),
    });

    const data = await res.json();
    assert.strictEqual(res.status, 400);
    assert.strictEqual(data.success, false);
    assert.strictEqual(data.error, "Rating must be between 1 and 5");
    assert.strictEqual(paper.saveCount, 0);
  });

  it("Case 6b: Negative rating is rejected with HTTP 400", async () => {
    setupStandardUsers();
    const paper = createTestPaper({ uploadedBy: authorObjectId });
    mockPapers.set(paper._id, paper);

    const res = await fetch(`${baseUrl}/${paper._id}/rate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${peerToken}`,
      },
      body: JSON.stringify({ rating: -3 }),
    });

    const data = await res.json();
    assert.strictEqual(res.status, 400);
    assert.strictEqual(data.success, false);
    assert.strictEqual(data.error, "Rating must be between 1 and 5");
    assert.strictEqual(paper.saveCount, 0);
  });

  it("Case 6c: Rating above 5 is rejected with HTTP 400", async () => {
    setupStandardUsers();
    const paper = createTestPaper({ uploadedBy: authorObjectId });
    mockPapers.set(paper._id, paper);

    const res = await fetch(`${baseUrl}/${paper._id}/rate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${peerToken}`,
      },
      body: JSON.stringify({ rating: 6 }),
    });

    const data = await res.json();
    assert.strictEqual(res.status, 400);
    assert.strictEqual(data.success, false);
    assert.strictEqual(data.error, "Rating must be between 1 and 5");
    assert.strictEqual(paper.saveCount, 0);
  });

  it("Case 6d: Invalid paper ID format is rejected with HTTP 400", async () => {
    setupStandardUsers();

    const res = await fetch(`${baseUrl}/not-a-valid-object-id/rate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${peerToken}`,
      },
      body: JSON.stringify({ rating: 5 }),
    });

    const data = await res.json();
    assert.strictEqual(res.status, 400);
    assert.strictEqual(data.success, false);
    assert.strictEqual(data.error, "Invalid paper id");
  });

  // Case 7: Inactive or unapproved paper
  it("Case 7a: Pending paper returns HTTP 404", async () => {
    setupStandardUsers();
    const paper = createTestPaper({ uploadedBy: authorObjectId, status: "pending" });
    mockPapers.set(paper._id, paper);

    const res = await fetch(`${baseUrl}/${paper._id}/rate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${peerToken}`,
      },
      body: JSON.stringify({ rating: 5 }),
    });

    const data = await res.json();
    assert.strictEqual(res.status, 404);
    assert.strictEqual(data.success, false);
    assert.strictEqual(data.error, "Paper not found");
    assert.strictEqual(paper.saveCount, 0);
  });

  it("Case 7b: Inactive paper returns HTTP 404", async () => {
    setupStandardUsers();
    const paper = createTestPaper({ uploadedBy: authorObjectId, isActive: false });
    mockPapers.set(paper._id, paper);

    const res = await fetch(`${baseUrl}/${paper._id}/rate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${peerToken}`,
      },
      body: JSON.stringify({ rating: 5 }),
    });

    const data = await res.json();
    assert.strictEqual(res.status, 404);
    assert.strictEqual(data.success, false);
    assert.strictEqual(data.error, "Paper not found");
    assert.strictEqual(paper.saveCount, 0);
  });

  // Case 8: ID comparison variants
  it("Case 8a: Uploader as string ID and requester as ObjectId correctly matches and rejects (403)", async () => {
    setupStandardUsers();
    // Uploader is stored as string ID
    const paper = createTestPaper({ uploadedBy: authorId });
    mockPapers.set(paper._id, paper);

    const res = await fetch(`${baseUrl}/${paper._id}/rate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authorToken}`,
      },
      body: JSON.stringify({ rating: 5 }),
    });

    const data = await res.json();
    assert.strictEqual(res.status, 403);
    assert.strictEqual(data.success, false);
    assert.strictEqual(data.error, "Authors cannot rate their own papers");
    assert.strictEqual(paper.saveCount, 0);
  });

  it("Case 8b: Requester with string _id in user object correctly matches and rejects (403)", async () => {
    const stringUserId = new mongoose.Types.ObjectId().toString();
    const token = jwt.sign({ id: stringUserId }, process.env.JWT_SECRET);
    mockUsers.set(stringUserId, {
      _id: stringUserId, // String ID in user object
      name: "String ID User",
      email: "stringuser@test.com",
      role: "student",
      isActive: true,
      status: "active",
    });

    const paper = createTestPaper({ uploadedBy: new mongoose.Types.ObjectId(stringUserId) });
    mockPapers.set(paper._id, paper);

    const res = await fetch(`${baseUrl}/${paper._id}/rate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ rating: 5 }),
    });

    const data = await res.json();
    assert.strictEqual(res.status, 403);
    assert.strictEqual(data.success, false);
    assert.strictEqual(data.error, "Authors cannot rate their own papers");
    assert.strictEqual(paper.saveCount, 0);
  });

  it("Case 8c: Populated uploadedBy object { _id } correctly matches and rejects (403)", async () => {
    setupStandardUsers();
    // Uploader is a populated object
    const paper = createTestPaper({
      uploadedBy: { _id: authorObjectId, name: "Author Student" },
    });
    mockPapers.set(paper._id, paper);

    const res = await fetch(`${baseUrl}/${paper._id}/rate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authorToken}`,
      },
      body: JSON.stringify({ rating: 5 }),
    });

    const data = await res.json();
    assert.strictEqual(res.status, 403);
    assert.strictEqual(data.success, false);
    assert.strictEqual(data.error, "Authors cannot rate their own papers");
    assert.strictEqual(paper.saveCount, 0);
  });

  // Case 9: No side effects verification
  it("Case 9: Self-rating denial leaves paper ratings, averageRating, save, and badge computation untouched", async () => {
    setupStandardUsers();
    const paper = createTestPaper({
      uploadedBy: authorObjectId,
      ratings: [{ user: peerObjectId, value: 3 }],
    });
    mockPapers.set(paper._id, paper);

    const initialAverage = paper.averageRating;
    assert.strictEqual(initialAverage, 3);

    const res = await fetch(`${baseUrl}/${paper._id}/rate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authorToken}`,
      },
      body: JSON.stringify({ rating: 5 }),
    });

    const data = await res.json();
    assert.strictEqual(res.status, 403);
    assert.strictEqual(data.error, "Authors cannot rate their own papers");

    // All original state preserved
    assert.strictEqual(paper.ratings.length, 1);
    assert.strictEqual(paper.ratings[0].value, 3);
    assert.strictEqual(paper.averageRating, 3);
    assert.strictEqual(paper.saveCount, 0);
    assert.strictEqual(countDocumentsCalls, 0);
  });
});
