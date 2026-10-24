# StudyTogether Remediation & Security Fix Plan

> **Plan Type**: Application Security Hardening & Defect Remediation
> **Target Repository**: `C:\Users\SWARNENDU\Downloads\StudyTogether`
> **Status**: Ready for Implementation (Documentation Only)
> **Constraint Verification**: Application source code has not been modified. This document provides step-by-step engineering instructions and code specifications.

---

## 1. Remediation Strategy & Phasing

To remediate the vulnerabilities identified in [`AUDIT_REPORT.md`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/AUDIT_REPORT.md) without destabilizing runtime operations, changes should be implemented in five distinct phases:

```
+------------------------------------------------------------------------+
| Phase 0: Emergency Hotfixes (P0 - Critical Vulnerabilities & Crashes)  |
+------------------------------------------------------------------------+
                                   |
                                   v
+------------------------------------------------------------------------+
| Phase 1: Access Control & Paywall Enforcement (P1 - High Severity)     |
+------------------------------------------------------------------------+
                                   |
                                   v
+------------------------------------------------------------------------+
| Phase 2: Transactional Atomicity & Concurrency Hardening (P1 - High)   |
+------------------------------------------------------------------------+
                                   |
                                   v
+------------------------------------------------------------------------+
| Phase 3: AI Microservice Stability & Input Sanitization (P2 - Medium)  |
+------------------------------------------------------------------------+
                                   |
                                   v
+------------------------------------------------------------------------+
| Phase 4: CI/CD & Automated Regression Test Suites (P2 - Medium)        |
+------------------------------------------------------------------------+
```

---

## 2. Phase 0: Emergency Security Hotfixes (P0)

### 2.1 Delete Mock Coin Purchase Route (SEC-001)
- **Target File**: [`server/routes/coin.js#L28-L78`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/routes/coin.js#L28-L78)
- **Problem**: `POST /api/v1/coins/purchase` credits virtual coins without payment.
- **Action**:
  1. Remove lines 28–78 in `server/routes/coin.js`.
  2. Keep only `GET /packages` in `server/routes/coin.js` or merge it into `payment.routes.js`.
  3. In `client/src/api/coinApi.js`, remove the `purchaseCoins` function.
- **Verification**: Dispatch `POST /api/v1/coins/purchase`; verify response is `404 Not Found`.

---

### 2.2 Remove Plaintext Cloudinary API Secret Logging (SEC-006)
- **Target File**: [`server/config/cloudinary.js#L6-L9`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/config/cloudinary.js#L6-L9)
- **Problem**: `console.log("API_SECRET:", process.env.API_SECRET);` leaks the secret to terminal and log aggregators.
- **Action**:
  Delete lines 6 through 9:
  ```javascript
  // REMOVE:
  console.log("ENV CHECK:");
  console.log("CLOUD_NAME:", process.env.CLOUD_NAME);
  console.log("API_KEY:", process.env.API_KEY);
  console.log("API_SECRET:", process.env.API_SECRET);
  ```
- **Verification**: Restart the server; verify standard output contains no Cloudinary credentials.

---

### 2.3 Remove Hardcoded Docker Secrets & Fix MongoDB Port Typo (SEC-002, SEC-016)
- **Target File**: [`docker-compose.yml#L14-L16`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/docker-compose.yml#L14-L16)
- **Problem**: Static production JWT secrets in git; port typo `27107` instead of `27017`.
- **Action**:
  Update `docker-compose.yml`:
  ```yaml
      - MONGODB_URI=mongodb://mongodb:27017/studytogether
      - JWT_SECRET=${JWT_SECRET}
      - JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
  ```
- **Verification**: Run `docker compose config`; ensure variables are loaded from `.env` and port is `27017`.

---

### 2.4 Fix Dangling Runtime Crash References in Paper Routes (SEC-007)
- **Target File**: [`server/routes/paper.js#L1092`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/routes/paper.js#L1092), [`server/routes/paper.js#L1187`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/routes/paper.js#L1187)
- **Problem**: Calls `reprocessPaper(paper)` and `deletePaperKnowledge(id)` which are not imported, triggering unhandled `ReferenceError` crashes.
- **Action**:
  Replace line 1092 with an HTTP call:
  ```javascript
  if (paper.status === "approved") {
    fetch(`${AI_SERVICE_URL}/api/v1/internal/ai/reprocess`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paperId: paper._id }),
    }).catch((err) => console.error("Background reprocess error:", err.message));
  }
  ```
  Replace line 1187 with an HTTP call:
  ```javascript
  fetch(`${AI_SERVICE_URL}/api/v1/internal/ai/knowledge/${id}`, {
    method: "DELETE",
  }).catch((err) => console.error("Background delete ingestion error:", err.message));
  ```
- **Verification**: Edit an approved paper and delete a test paper; verify operations complete with `200 OK`.

---

## 3. Phase 1: Access Control & Paywall Enforcement (P1)

### 3.1 Gated PDF Streaming & URL Redaction (SEC-004)
- **Target Files**:
  - [`server/routes/paper.js#L190-L252`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/routes/paper.js#L190-L252) (`GET /api/v1/papers`)
  - [`server/routes/paper.js#L534-L569`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/routes/paper.js#L534-L569) (`GET /api/v1/papers/:id`)
- **Action**:
  1. In `GET /api/v1/papers` and `GET /api/v1/papers/:id`, exclude `pdfLink`:
     ```javascript
     // In GET /api/v1/papers:
     const papers = await Paper.find(filter)
       .select("-pdfLink")
       .populate("uploadedBy", "name email")
       .lean()
       ...
     ```
  2. Implement an authenticated, access-controlled download/stream endpoint:
     ```javascript
     // GET /api/v1/papers/:id/content
     router.get("/:id/content", verifyToken, async (req, res) => {
       const paper = await Paper.findById(req.params.id);
       if (!paper || !paper.isActive) return res.status(404).json({ error: "Paper not found" });

       const isOwner = paper.uploadedBy.toString() === req.user._id.toString();
       const isAdmin = req.user.role === "admin";
       const user = await User.findById(req.user._id);
       const isUnlocked = user.downloadedPapers.some(id => id.toString() === paper._id.toString()) ||
                          user.previewedPapers.some(id => id.toString() === paper._id.toString());

       if (!isOwner && !isAdmin && !isUnlocked) {
         return res.status(403).json({ error: "Access denied. Paper must be unlocked with coins first." });
       }

       // Redirect to a short-lived signed Cloudinary URL or stream the buffer
       return res.redirect(paper.pdfLink);
     });
     ```
- **Verification**: Send `GET /api/v1/papers`; assert `pdfLink` is absent. Call `/content` without unlocking; assert `403 Forbidden`.

---

### 3.2 Secure AI Internal Microservice Endpoints (SEC-003)
- **Target Files**:
  - [`ai/server.js#L44-L83`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/server.js#L44-L83)
  - [`server/routes/paper.js#L313-L318`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/routes/paper.js#L313-L318)
- **Action**:
  1. Define `INTERNAL_SERVICE_KEY` in `server/.env` and `ai/.env`.
  2. Create an authentication middleware in `ai/middleware/internalAuth.js`:
     ```javascript
     const verifyInternalKey = (req, res, next) => {
       const key = req.headers["x-internal-service-key"];
       if (!key || key !== process.env.INTERNAL_SERVICE_KEY) {
         return res.status(401).json({ error: "Unauthorized internal service request" });
       }
       next();
     };
     ```
  3. Mount `verifyInternalKey` on all `/api/v1/internal/ai/*` routes.
  4. In `server/routes/paper.js`, send `headers: { "x-internal-service-key": process.env.INTERNAL_SERVICE_KEY }` on all internal `fetch()` calls.
- **Verification**: Issue `POST http://localhost:5001/api/v1/internal/ai/process` without header; assert `401 Unauthorized`.

---

### 3.3 Authorize AI Learning & Knowledge Endpoints (SEC-009, SEC-010)
- **Target File**: [`ai/routes/index.js#L507-L603`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/routes/index.js#L507-L603), [`ai/routes/index.js#L851-L935`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/routes/index.js#L851-L935)
- **Action**:
  1. In `/study-notes`, `/quiz`, `/flashcards`, `/exam-plan`, `/topic-analysis`, verify access:
     ```javascript
     const paper = await Paper.findById(paperId);
     if (!paper || paper.status !== "approved") {
       return res.status(404).json({ error: "Approved study paper not found" });
     }
     ```
  2. Mount `verifyAdmin` on `/study-knowledge`, `/study-knowledge/search`, `/study-knowledge/:id`.
- **Verification**: Call `/study-notes` on an unapproved paper; assert `404 Not Found`.

---

## 4. Phase 2: Transactional Atomicity & Concurrency Hardening (P1)

### 4.1 Multi-Document Transactions for Coin Deductions (SEC-005)
- **Target File**: [`server/routes/paper.js#L573-L733`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/routes/paper.js#L573-L733)
- **Action**:
  Refactor `/view` and `/download` to execute atomically:
  ```javascript
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    // 1. Atomically deduct coins
    const updatedUser = await User.findOneAndUpdate(
      { _id: user._id, coins: { $gte: requiredCoins } },
      {
        $inc: { coins: -requiredCoins },
        $addToSet: { previewedPapers: paper._id }
      },
      { new: true, session }
    );

    if (!updatedUser) {
      await session.abortTransaction();
      return res.status(400).json({ error: "Not enough coins" });
    }

    // 2. Create transaction record
    await Transaction.create([
      {
        user: user._id,
        amount: requiredCoins,
        type: "spent",
        reason: "Preview Paper",
        paperId: paper._id,
        paperTitle: paper.title,
      }
    ], { session });

    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
  ```
- **Verification**: Simulate concurrent requests; verify user balance never goes negative and entitlements are never granted without successful coin deduction.

---

### 4.2 Upload Limit Atomic Check & Cloudinary Orphan Cleanup (SEC-008)
- **Target File**: [`server/routes/paper.js#L49-L169`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/routes/paper.js#L49-L169)
- **Action**:
  Add an error cleanup helper when validation fails after Multer upload:
  ```javascript
  const cleanUploadedFile = async (req) => {
    if (req.file?.path) {
      const publicId = getPublicId(req.file.path);
      if (publicId) {
        await cloudinary.uploader.destroy(publicId, { resource_type: "raw" }).catch(console.error);
      }
    }
  };
  ```
  Invoke `await cleanUploadedFile(req)` on every validation error return (e.g. invalid semester, duplicate paper, limit exceeded).
- **Verification**: Upload file with invalid semester; verify file is deleted from Cloudinary.

---

### 4.3 Fulfill Razorpay Payment Verification & Fix Webhook HMAC Buffer (SEC-017)
- **Target Files**:
  - [`server/routes/payment.routes.js#L82-L142`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/routes/payment.routes.js#L82-L142)
  - [`server/routes/payment.routes.js#L175-L224`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/routes/payment.routes.js#L175-L224)
  - [`server/server.js#L58`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/server.js#L58)
- **Action**:
  1. In `server/routes/payment.routes.js` `/verify`:
     ```javascript
     payment.paymentId = razorpay_payment_id;
     payment.status = "captured";
     await payment.save();

     const user = await User.findById(payment.user);
     await purchaseCoins(user, payment.coins, payment.packageName, razorpay_payment_id);
     ```
  2. In `server/server.js`: Configure `express.json` with a verify callback to retain raw bytes:
     ```javascript
     app.use(express.json({
       limit: "20mb",
       verify: (req, res, buf) => {
         req.rawBody = buf;
       }
     }));
     ```
  3. In `server/routes/payment.routes.js` `/webhook`: Compute HMAC over `req.rawBody` instead of parsed `req.body`, and parse payload via `req.body` directly rather than calling `JSON.parse(req.body.toString())`.
- **Verification**: Dispatch verified order to `/verify`; verify `payment.status` becomes `"captured"` and `user.coins` increments. Send mock webhook; assert HMAC validates without `TypeError` or `SyntaxError`.

---

## 5. Phase 3: AI Microservice Stability & Input Sanitization (P2)

### 5.1 ReDoS Sanitization & MongoSanitize in AI Microservice (SEC-011, SEC-012)
- **Target Files**:
  - [`ai/server.js#L28`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/server.js#L28)
  - [`ai/routes/index.js#L872-L882`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/routes/index.js#L872-L882)
- **Action**:
  1. In `ai/server.js`, uncomment `app.use(mongoSanitize());`.
  2. In `ai/routes/index.js`, add `escapeRegex` and apply it to `filter.chunkText = { $regex: escapeRegex(q.trim()), $options: "i" };`.
- **Verification**: Send regex special characters in search; verify they match literally without ReDoS delay.

---

### 5.2 Bound In-Memory PDF Page Rendering During OCR (SEC-014)
- **Target File**: [`ai/services/ingestor.js#L173-L178`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/services/ingestor.js#L173-L178)
- **Action**:
  Limit the pages rendered for OCR:
  ```javascript
  const MAX_OCR_PAGES = parseInt(process.env.MAX_OCR_PAGES || "10", 10);
  pageImages = await pdfImgConvert.convert(pdfBuffer, {
    width: 1400,
    height: 1800,
    page_numbers: Array.from({ length: MAX_OCR_PAGES }, (_, i) => i + 1),
    base64: false,
  });
  ```
- **Verification**: Ingest a 50-page scanned document; verify Node heap usage remains bounded.

---

### 5.3 Harmonize Ollama URL Configuration
- **Target File**: [`ai/services/ollamaService.js#L4`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/services/ollamaService.js#L4)
- **Action**:
  Harmonize base URL and endpoint path:
  ```javascript
  const baseUrl = (process.env.OLLAMA_URL || "http://localhost:11434").replace(/\/+$/, "").replace(/\/api\/generate$/, "");
  const generateUrl = `${baseUrl}/api/generate`;
  ```
- **Verification**: Set `OLLAMA_URL=http://localhost:11434`; verify both embedding and generation services construct valid URLs.

---

## 6. Phase 4: CI/CD & Automated Testing Framework (P2)

### 6.1 Fix CI Workflow & Unmask Failures (SEC-013)
- **Target File**: [`.github/workflows/ci.yml#L29-L32`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/.github/workflows/ci.yml#L29-L32)
- **Action**:
  1. In `server/package.json`, add `"test": "node --test"` or `"test": "jest"`.
  2. In `.github/workflows/ci.yml`, change line 32 to:
     ```yaml
         - name: Run Backend Tests
           run: |
             cd server
             npm test
     ```
  3. Add steps to test the AI service and lint the client.
- **Verification**: Trigger a pull request with an intentionally failing test; verify GitHub Actions marks the run as failed.

---

## 7. Verification & Sign-Off Checklist

| Fix ID | Vulnerability Addressed | Implementation Verified | Regression Test Passed |
| :--- | :--- | :---: | :---: |
| **FIX-01** | Mock purchase route deleted (SEC-001) | [ ] | [ ] |
| **FIX-02** | Cloudinary secret logging removed (SEC-006) | [ ] | [ ] |
| **FIX-03** | Docker Compose secrets replaced with env vars (SEC-002) | [ ] | [ ] |
| **FIX-04** | Docker Compose MongoDB port corrected to 27017 (SEC-016) | [ ] | [ ] |
| **FIX-05** | Dangling reprocess/delete functions replaced with HTTP calls (SEC-007) | [ ] | [ ] |
| **FIX-06** | `pdfLink` redacted from public paper API responses (SEC-004) | [ ] | [ ] |
| **FIX-07** | Internal AI endpoints secured with shared service key (SEC-003) | [ ] | [ ] |
| **FIX-08** | Multi-document transactions used for coin paywall (SEC-005) | [ ] | [ ] |
| **FIX-09** | Cloudinary upload error cleanup implemented (SEC-008) | [ ] | [ ] |
| **FIX-10** | AI learning endpoints restricted to approved papers (SEC-009) | [ ] | [ ] |
| **FIX-11** | Regex sanitization added to chunk search (SEC-011) | [ ] | [ ] |
| **FIX-12** | `mongoSanitize()` enabled in AI service (SEC-012) | [ ] | [ ] |
| **FIX-13** | OCR page rendering bounded (SEC-014) | [ ] | [ ] |
| **FIX-14** | CI test failure masking removed (SEC-013) | [ ] | [ ] |
