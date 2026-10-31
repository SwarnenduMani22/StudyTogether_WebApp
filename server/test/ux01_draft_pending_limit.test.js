import test, { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert";
import express from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

// Setup environment for testing before importing router
process.env.JWT_SECRET = "ux01-draft-pending-limit-secret-test-key-12345";
process.env.NODE_ENV = "test";

import paperRouter from "../routes/paper.js";
import User from "../models/User.js";
import Paper from "../models/Paper.js";
import Activity from "../models/Activity.js";
import upload from "../middleware/uploadCloudinary.js";
import cloudinary from "../config/cloudinary.js";

// Mock Activity.create to prevent Mongoose buffering timeouts during in-memory tests
Activity.create = async () => ({});

// Mock stores
const mockUsers = new Map();
const mockPapers = new Map();
let destroyedAssets = [];
let mockUploadFile = null;
let mockUploadError = null;

// Mock Cloudinary uploader destroy
cloudinary.uploader.destroy = async (publicId, opts) => {
  destroyedAssets.push({ publicId, opts });
  return { result: "ok" };
};

// Mock Multer upload.single
upload.single = (field) => {
  return (req, res, next) => {
    if (mockUploadError) {
      return next(mockUploadError);
    }
    if (req.headers["x-mock-file"]) {
      req.file = JSON.parse(req.headers["x-mock-file"]);
    } else if (mockUploadFile) {
      req.file = { ...mockUploadFile };
    }
    next();
  };
};

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
    populate: () => ({
      lean: async () => (user ? { ...user } : null),
    }),
    lean: async () => (user ? { ...user } : null),
    then(onFulfilled, onRejected) {
      return Promise.resolve(doc).then(onFulfilled, onRejected);
    },
  };
};

// Mock Paper.countDocuments
Paper.countDocuments = async (query = {}) => {
  let count = 0;
  for (const paper of mockPapers.values()) {
    if (query.uploadedBy && String(paper.uploadedBy) !== String(query.uploadedBy)) {
      continue;
    }
    if (query.status && paper.status !== query.status) {
      continue;
    }
    if (query._id && query._id.$ne && String(paper._id) === String(query._id.$ne)) {
      continue;
    }
    count++;
  }
  return count;
};

// Mock Paper.findOne
Paper.findOne = async (query = {}) => {
  for (const paper of mockPapers.values()) {
    if (query._id && query._id.$ne && String(paper._id) === String(query._id.$ne)) {
      continue;
    }
    if (query._id && !query._id.$ne && String(paper._id) !== String(query._id)) {
      continue;
    }
    if (query.isActive !== undefined && paper.isActive !== query.isActive) {
      continue;
    }
    if (query.status && paper.status !== query.status) {
      continue;
    }
    if (query.semester !== undefined && paper.semester !== query.semester) {
      continue;
    }
    if (query.title && query.title.$regex) {
      const regex = new RegExp(query.title.$regex, query.title.$options || "");
      if (!regex.test(paper.title)) continue;
    }
    if (query.subject && query.subject.$regex) {
      const regex = new RegExp(query.subject.$regex, query.subject.$options || "");
      if (!regex.test(paper.subject)) continue;
    }
    return paper;
  }
  return null;
};

// Mock Paper.findById
Paper.findById = (id) => {
  const paper = mockPapers.get(String(id));
  return {
    populate: () => ({
      lean: async () => {
        if (!paper) return null;
        const uploader = mockUsers.get(String(paper.uploadedBy));
        return {
          ...paper,
          uploadedBy: uploader ? { _id: uploader._id, name: uploader.name, email: uploader.email } : paper.uploadedBy,
        };
      },
    }),
    lean: async () => (paper ? { ...paper } : null),
  };
};

// Mock Paper.create
Paper.create = async (doc) => {
  const newId = doc._id ? String(doc._id) : new mongoose.Types.ObjectId().toString();
  let saveCount = 0;
  const paper = {
    _id: newId,
    ...doc,
    isActive: true,
    ratings: [],
    get saveCount() {
      return saveCount;
    },
    save: async function () {
      saveCount++;
      mockPapers.set(newId, this);
      return this;
    },
  };
  mockPapers.set(newId, paper);
  return paper;
};

// Helper to create test paper
function createTestPaper({
  id = new mongoose.Types.ObjectId().toString(),
  uploadedBy,
  title = "Algorithms & Data Structures",
  subject = "Data Structure",
  semester = 3,
  status = "draft",
  isActive = true,
  pdfLink = "https://res.cloudinary.com/test/raw/upload/v12345/study-together/papers/original-paper.pdf",
} = {}) {
  let saveCount = 0;
  const paper = {
    _id: id,
    title,
    subject,
    semester,
    pdfLink,
    uploadedBy: String(uploadedBy),
    status,
    isActive,
    ratings: [],
    get saveCount() {
      return saveCount;
    },
    save: async function () {
      saveCount++;
      mockPapers.set(id, this);
      return this;
    },
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
  destroyedAssets = [];
  mockUploadFile = null;
  mockUploadError = null;
});

describe("UX-01 SUITE: Draft Paper Upload Pending-Limit Behavior", () => {
  const studentObjectId = new mongoose.Types.ObjectId();
  const studentId = studentObjectId.toString();

  const adminObjectId = new mongoose.Types.ObjectId();
  const adminId = adminObjectId.toString();

  const studentToken = jwt.sign({ id: studentId }, process.env.JWT_SECRET);
  const adminToken = jwt.sign({ id: adminId }, process.env.JWT_SECRET);

  function setupUsers() {
    mockUsers.set(studentId, {
      _id: studentObjectId,
      name: "Student Uploader",
      email: "student@test.com",
      role: "student",
      coins: 50,
      badges: [],
      rank: "Beginner",
      isActive: true,
      status: "active",
    });
    mockUsers.set(adminId, {
      _id: adminObjectId,
      name: "Platform Admin",
      email: "admin@test.com",
      role: "admin",
      coins: 1000,
      badges: [],
      rank: "Legend",
      isActive: true,
      status: "active",
    });
  }

  const defaultMockFile = {
    fieldname: "pdf",
    originalname: "test-lecture-notes.pdf",
    encoding: "7bit",
    mimetype: "application/pdf",
    path: "https://res.cloudinary.com/test/image/upload/v12345/study-together/papers/lecture-notes.pdf",
    size: 10240,
  };

  // Test 1: Draft upload bypasses the limit when user already has 2 pending papers
  it("Test 1: Draft upload bypasses the limit when user already has 2 pending papers", async () => {
    setupUsers();
    mockUploadFile = defaultMockFile;

    // Seed 2 existing pending papers for this student
    createTestPaper({ uploadedBy: studentId, status: "pending", title: "Existing Pending 1", subject: "DBMS", semester: 4 });
    createTestPaper({ uploadedBy: studentId, status: "pending", title: "Existing Pending 2", subject: "Operating System", semester: 5 });

    const res = await fetch(`${baseUrl}/upload`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({
        title: "Draft Unit 1 Notes",
        subject: "Data Structure",
        semester: 3,
        isDraft: "true",
      }),
    });

    const body = await res.json();
    assert.strictEqual(res.status, 201);
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.message, "Draft saved successfully");
    assert.strictEqual(body.paper.status, "draft");
    assert.strictEqual(destroyedAssets.length, 0);
  });

  // Test 2: isDraft boolean true and string "true" both work
  it("Test 2a: isDraft boolean true is recognized and saves as draft", async () => {
    setupUsers();
    mockUploadFile = defaultMockFile;

    createTestPaper({ uploadedBy: studentId, status: "pending", title: "Pending Paper A", subject: "DBMS", semester: 4 });
    createTestPaper({ uploadedBy: studentId, status: "pending", title: "Pending Paper B", subject: "Operating System", semester: 5 });

    const res = await fetch(`${baseUrl}/upload`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({
        title: "Boolean True Draft",
        subject: "Artificial Intelligence",
        semester: 6,
        isDraft: true, // boolean
      }),
    });

    const body = await res.json();
    assert.strictEqual(res.status, 201);
    assert.strictEqual(body.paper.status, "draft");
  });

  it("Test 2b: isDraft string 'true' is recognized and saves as draft", async () => {
    setupUsers();
    mockUploadFile = defaultMockFile;

    createTestPaper({ uploadedBy: studentId, status: "pending", title: "Pending Paper X", subject: "DBMS", semester: 4 });
    createTestPaper({ uploadedBy: studentId, status: "pending", title: "Pending Paper Y", subject: "Operating System", semester: 5 });

    const res = await fetch(`${baseUrl}/upload`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({
        title: "String True Draft",
        subject: "Software Engineering",
        semester: 4,
        isDraft: "true", // string
      }),
    });

    const body = await res.json();
    assert.strictEqual(res.status, 201);
    assert.strictEqual(body.paper.status, "draft");
  });

  // Test 3: status === "draft" is handled if accepted by route contract
  it("Test 3: status === 'draft' in request body is recognized as draft", async () => {
    setupUsers();
    mockUploadFile = defaultMockFile;

    createTestPaper({ uploadedBy: studentId, status: "pending", title: "P1", subject: "DBMS", semester: 4 });
    createTestPaper({ uploadedBy: studentId, status: "pending", title: "P2", subject: "Operating System", semester: 5 });

    const res = await fetch(`${baseUrl}/upload`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({
        title: "Status Contract Draft",
        subject: "Computer Network",
        semester: 5,
        status: "draft", // status parameter
      }),
    });

    const body = await res.json();
    assert.strictEqual(res.status, 201);
    assert.strictEqual(body.paper.status, "draft");
  });

  // Test 4: Standard upload remains blocked at 2 pending papers
  it("Test 4: Standard upload remains blocked at 2 pending papers with Cloudinary cleanup", async () => {
    setupUsers();
    mockUploadFile = defaultMockFile;

    createTestPaper({ uploadedBy: studentId, status: "pending", title: "Pending Alpha", subject: "DBMS", semester: 4 });
    createTestPaper({ uploadedBy: studentId, status: "pending", title: "Pending Beta", subject: "Operating System", semester: 5 });

    const res = await fetch(`${baseUrl}/upload`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({
        title: "Third Pending Attempt",
        subject: "Data Structure",
        semester: 3,
        isDraft: false,
      }),
    });

    const body = await res.json();
    assert.strictEqual(res.status, 400);
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error, "Upload limit reached (Max 2 pending papers allowed)");
    assert.strictEqual(destroyedAssets.length, 1);
  });

  // Test 5: Admin upload remains approved and bypasses the limit
  it("Test 5: Admin upload remains approved and bypasses the limit", async () => {
    setupUsers();
    mockUploadFile = defaultMockFile;

    createTestPaper({ uploadedBy: adminId, status: "pending", title: "Admin Pending 1", subject: "DBMS", semester: 4 });
    createTestPaper({ uploadedBy: adminId, status: "pending", title: "Admin Pending 2", subject: "Operating System", semester: 5 });

    const res = await fetch(`${baseUrl}/upload`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        title: "Official Syllabus Exam",
        subject: "Software Engineering",
        semester: 4,
        isDraft: false,
      }),
    });

    const body = await res.json();
    assert.strictEqual(res.status, 201);
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.message, "Paper uploaded successfully");
    assert.strictEqual(body.paper.status, "approved");
    assert.strictEqual(destroyedAssets.length, 0);
  });

  // Test 6: Invalid draft semester still fails validation and cleans up the uploaded Cloudinary asset
  it("Test 6: Invalid draft semester fails validation and cleans up Cloudinary asset", async () => {
    setupUsers();
    mockUploadFile = defaultMockFile;

    createTestPaper({ uploadedBy: studentId, status: "pending", title: "Pend1", subject: "DBMS", semester: 4 });
    createTestPaper({ uploadedBy: studentId, status: "pending", title: "Pend2", subject: "Operating System", semester: 5 });

    const res = await fetch(`${baseUrl}/upload`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({
        title: "Invalid Semester Draft",
        subject: "Data Structure",
        semester: 99, // invalid semester
        isDraft: true,
      }),
    });

    const body = await res.json();
    assert.strictEqual(res.status, 400);
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error, "Semester must be between 1 and 8");
    assert.strictEqual(destroyedAssets.length, 1);
  });

  // Test 7: Duplicate draft detection still works
  it("Test 7: Duplicate draft detection still works and cleans up Cloudinary asset", async () => {
    setupUsers();
    mockUploadFile = defaultMockFile;

    // Existing paper
    createTestPaper({
      uploadedBy: studentId,
      title: "Unique Data Structures Paper",
      subject: "Data Structure",
      semester: 3,
      status: "approved",
    });

    const res = await fetch(`${baseUrl}/upload`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({
        title: "Unique Data Structures Paper", // duplicate title
        subject: "Data Structure",
        semester: 3,
        isDraft: true,
      }),
    });

    const body = await res.json();
    assert.strictEqual(res.status, 400);
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error, "This paper already exists");
    assert.strictEqual(destroyedAssets.length, 1);
  });

  // Test 8: Draft-to-pending publication is rejected at the pending ceiling
  it("Test 8: Draft-to-pending publication is rejected when student already has 2 pending papers", async () => {
    setupUsers();

    // Student has 2 existing pending papers
    createTestPaper({ uploadedBy: studentId, status: "pending", title: "Pending 1", subject: "DBMS", semester: 4 });
    createTestPaper({ uploadedBy: studentId, status: "pending", title: "Pending 2", subject: "Operating System", semester: 5 });

    // Student also has 1 draft
    const draftPaper = createTestPaper({
      uploadedBy: studentId,
      status: "draft",
      title: "Ready to Publish Draft",
      subject: "Computer Network",
      semester: 5,
    });

    const res = await fetch(`${baseUrl}/${draftPaper._id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({
        isDraft: false, // attempt to publish
      }),
    });

    const body = await res.json();
    assert.strictEqual(res.status, 400);
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error, "Upload limit reached (Max 2 pending papers allowed)");

    // Verify draft was not mutated
    const paperInStore = mockPapers.get(draftPaper._id);
    assert.strictEqual(paperInStore.status, "draft");
  });

  // Test 9: Draft-to-pending publication succeeds below the ceiling
  it("Test 9: Draft-to-pending publication succeeds when student has 1 pending paper", async () => {
    setupUsers();

    // Student has only 1 pending paper (below the ceiling of 2)
    createTestPaper({ uploadedBy: studentId, status: "pending", title: "Pending 1", subject: "DBMS", semester: 4 });

    // Student has 1 draft
    const draftPaper = createTestPaper({
      uploadedBy: studentId,
      status: "draft",
      title: "Submitting Draft Now",
      subject: "Artificial Intelligence",
      semester: 6,
    });

    const res = await fetch(`${baseUrl}/${draftPaper._id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({
        isDraft: false, // publish
      }),
    });

    const body = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.message, "Paper updated successfully");

    const paperInStore = mockPapers.get(draftPaper._id);
    assert.strictEqual(paperInStore.status, "pending");
  });

  // Test 10: Rejected publication does not mutate the draft or delete its Cloudinary asset
  it("Test 10: Rejected publication does not mutate existing draft or delete its original Cloudinary asset", async () => {
    setupUsers();

    const originalCloudinaryUrl = "https://res.cloudinary.com/test/raw/upload/v12345/study-together/papers/original-draft.pdf";

    // Student has 2 pending papers
    createTestPaper({ uploadedBy: studentId, status: "pending", title: "Pend A", subject: "DBMS", semester: 4 });
    createTestPaper({ uploadedBy: studentId, status: "pending", title: "Pend B", subject: "Operating System", semester: 5 });

    // Draft paper
    const draftPaper = createTestPaper({
      uploadedBy: studentId,
      status: "draft",
      title: "My Intact Draft",
      subject: "Software Engineering",
      semester: 4,
      pdfLink: originalCloudinaryUrl,
    });

    // Provide a replacement file in the update request
    const newFile = {
      fieldname: "pdf",
      originalname: "replacement-file.pdf",
      encoding: "7bit",
      mimetype: "application/pdf",
      path: "https://res.cloudinary.com/test/image/upload/v99999/study-together/papers/replacement-file.pdf",
      size: 20480,
    };
    mockUploadFile = newFile;

    const res = await fetch(`${baseUrl}/${draftPaper._id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({
        title: "Updated Title That Should Not Persist",
        isDraft: false,
      }),
    });

    const body = await res.json();
    assert.strictEqual(res.status, 400);
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error, "Upload limit reached (Max 2 pending papers allowed)");

    // Verify existing draft data was not mutated
    const paperInStore = mockPapers.get(draftPaper._id);
    assert.strictEqual(paperInStore.status, "draft");
    assert.strictEqual(paperInStore.title, "My Intact Draft");
    assert.strictEqual(paperInStore.pdfLink, originalCloudinaryUrl);

    // Verify the newly uploaded file was destroyed, but NOT the original file
    assert.strictEqual(destroyedAssets.length, 1);
    assert.strictEqual(destroyedAssets[0].publicId, "study-together/papers/replacement-file");
  });

  // Test 11: Admin publishing draft transitions to approved without pending limit check
  it("Test 11: Admin publishing draft transitions directly to approved without pending ceiling check", async () => {
    setupUsers();

    // Admin has 5 pending papers
    for (let i = 1; i <= 5; i++) {
      createTestPaper({ uploadedBy: adminId, status: "pending", title: `Admin Pending ${i}`, subject: "DBMS", semester: 4 });
    }

    const draftPaper = createTestPaper({
      uploadedBy: adminId,
      status: "draft",
      title: "Admin Draft Paper",
      subject: "Data Structure",
      semester: 3,
    });

    const res = await fetch(`${baseUrl}/${draftPaper._id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        isDraft: false,
      }),
    });

    const body = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.paper.status, "approved");
  });
});
