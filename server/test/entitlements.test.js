import test, { describe, it } from "node:test";
import assert from "node:assert";

// Simulation of GET /:id entitlement check logic from server/routes/paper.js
function evaluatePaperDetailResponse(paperDoc, userDoc) {
  // Clone paper doc as lean() does
  const paper = JSON.parse(JSON.stringify(paperDoc));

  const isOwner = paper.uploadedBy?._id?.toString() === userDoc._id?.toString();
  const isAdmin = userDoc.role === "admin";
  let isFullAccess = isOwner || isAdmin;

  if (!isFullAccess) {
    isFullAccess = userDoc.downloadedPapers?.some(
      (p) => p.toString() === paper._id.toString()
    );
  }

  paper.hasPdf = Boolean(paper.pdfLink);
  if (!isFullAccess) {
    delete paper.pdfLink;
  }

  return paper;
}

const mockPaper = {
  _id: "paper_12345",
  title: "Operating Systems Final Exam",
  subject: "Operating System",
  semester: 4,
  pdfLink: "https://res.cloudinary.com/demo/raw/upload/v1234567/paper.pdf",
  uploadedBy: { _id: "user_owner", name: "Alice Owner" },
};

describe("Entitlement Matrix Verification Tests (P1-1 / SEC-03)", () => {
  it("Test 1: Unauthorized user cannot view raw pdfLink; hasPdf is true", () => {
    const unauthCaller = {
      _id: "user_stranger",
      role: "user",
      previewedPapers: [],
      downloadedPapers: [],
    };
    const res = evaluatePaperDetailResponse(mockPaper, unauthCaller);
    assert.strictEqual(res.pdfLink, undefined, "Unauthorized user received pdfLink!");
    assert.strictEqual(res.hasPdf, true, "hasPdf should be true!");
  });

  it("Test 2: Preview-only user DOES NOT receive raw pdfLink on GET /:id", () => {
    const previewCaller = {
      _id: "user_previewer",
      role: "user",
      previewedPapers: ["paper_12345"],
      downloadedPapers: [],
    };
    const res = evaluatePaperDetailResponse(mockPaper, previewCaller);
    assert.strictEqual(
      res.pdfLink,
      undefined,
      "Preview-only user received full download pdfLink on GET /:id!"
    );
    assert.strictEqual(res.hasPdf, true, "hasPdf should be true for preview-only user!");
  });

  it("Test 3: Full-download purchaser legitimately receives pdfLink on GET /:id", () => {
    const downloadCaller = {
      _id: "user_downloader",
      role: "user",
      previewedPapers: ["paper_12345"],
      downloadedPapers: ["paper_12345"],
    };
    const res = evaluatePaperDetailResponse(mockPaper, downloadCaller);
    assert.strictEqual(
      res.pdfLink,
      mockPaper.pdfLink,
      "Authorized downloader did not receive pdfLink!"
    );
    assert.strictEqual(res.hasPdf, true, "hasPdf should be true!");
  });

  it("Test 4: Paper owner legitimately receives pdfLink on GET /:id", () => {
    const ownerCaller = {
      _id: "user_owner",
      role: "user",
      previewedPapers: [],
      downloadedPapers: [],
    };
    const res = evaluatePaperDetailResponse(mockPaper, ownerCaller);
    assert.strictEqual(res.pdfLink, mockPaper.pdfLink, "Paper owner did not receive pdfLink!");
    assert.strictEqual(res.hasPdf, true, "hasPdf should be true!");
  });

  it("Test 5: Administrator legitimately receives pdfLink on GET /:id", () => {
    const adminCaller = {
      _id: "user_admin",
      role: "admin",
      previewedPapers: [],
      downloadedPapers: [],
    };
    const res = evaluatePaperDetailResponse(mockPaper, adminCaller);
    assert.strictEqual(res.pdfLink, mockPaper.pdfLink, "Administrator did not receive pdfLink!");
    assert.strictEqual(res.hasPdf, true, "hasPdf should be true!");
  });
});
