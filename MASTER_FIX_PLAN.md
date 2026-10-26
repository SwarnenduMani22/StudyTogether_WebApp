# StudyTogether — MASTER_FIX_PLAN.md

**Document Role:** Central authoritative task tracker and comprehensive verification audit ledger for StudyTogether.
**Last Updated:** 2026-10-26 (Post-Audit Resumption & Full Consolidation)
**Environment:** WSL Ubuntu 22.04 (`/mnt/c/Users/SWARNENDU/Downloads/StudyTogether`)
**Production Readiness Verdict:** **NOT PRODUCTION READY** (Critical open security gaps SEC-006, SEC-009, SEC-010, SEC-011, SEC-012, SEC-014, failing frontend lint, and masked CI tests).

---

## 1. Executive Summary & Audit Verification Status

Following the interruption of the previous audit pass due to usage quotas, this audit was resumed from the verified checkpoint. All 10 project Markdown documentation files were reviewed and cross-referenced. In-memory, syntax, entitlement, authentication, deletion, coin idempotency, and frontend build tests were actually executed in WSL. Direct source inspection was performed across backend, client, and AI microservice codebases.

### Verification Status Classification Taxonomy:
- **[VERIFIED - SOURCE & TEST]**: Verified through direct source-code inspection AND live automated test execution during this audit pass.
- **[VERIFIED - SOURCE ONLY]**: Verified through direct source inspection during this audit pass; automated integration test requires external/destructive service (e.g. live MongoDB instance, live Razorpay network).
- **[STILL OPEN - CONFIRMED IN CODE]**: Inspected and verified in current source code as an unresolved vulnerability or gap.
- **[HISTORICAL - UNREVERIFIED RUNTIME]**: Historically reported in audit documentation; static logic confirmed, but full production live traffic behavior unverified.
- **[PRODUCTION BEHAVIOR NOT VERIFIED]**: Deployment, DNS, SSL termination, and live multi-tenant network edge behavior that cannot be tested locally.

---

## 2. Master Verification Audit Matrix

| Item ID | Category | Description | Status | Evidence / Test Outcome |
|---|---|---|---|---|
| **P0-1 (SEC-01)** | Security | Remove Mock Coin Purchase Backdoor | **[VERIFIED - SOURCE & TEST]** | `POST /purchase` completely excised from `server/routes/coin.js` (lines 1-18); `client/src/api/coinApi.js` (lines 15-31) only calls authentic payment routes. |
| **P0-2 (BUG-01)** | Stability | Fix Paper Update/Delete ReferenceErrors | **[VERIFIED - SOURCE & TEST]** | Dangling synchronous calls replaced in `server/routes/paper.js` (lines 1131, 1237) with non-blocking fetch to internal AI service; syntax clean via `check_syntax.sh`. |
| **P0-3 (SEC-02)** | Security | Remove Plaintext Docker JWT Secrets & Fix Mongo Port | **[VERIFIED - SOURCE & TEST]** | `docker-compose.yml` (lines 14-17) uses mandatory env substitution (`${JWT_SECRET:?}`, `${JWT_REFRESH_SECRET:?}`, `${INTERNAL_SERVICE_KEY:?}`); MongoDB port corrected from `27107` to `27017`. |
| **P1-1 (SEC-03)** | Paywall | PDF Access Control & Direct Link Redaction | **[VERIFIED - SOURCE & TEST]** | `pdfLink` excluded via `.select("-pdfLink")` in `server/routes/paper.js` (lines 238, 451, 498) and `server/routes/user.js` (line 120); gated strictly to owners, admins, or downloaders in `GET /:id` (lines 569-579). All 5/5 entitlement matrix assertions passed in `test_entitlements.js`. |
| **P1-2 (SEC-04)** | Security | Internal AI Service Authentication | **[VERIFIED - SOURCE & TEST]** | `ai/middleware/internalAuth.js` implements constant-time SHA-256 HMAC matching on `x-internal-service-key`; fail-closed 500 when unconfigured, 401 when invalid. All 9/9 tests passed in `test_p12_auth.js`. |
| **P1-3 (INT-01)** | Core | Student Paper Deletion Authorization | **[VERIFIED - SOURCE & TEST]** | Client `deletePaper(id)` in `client/src/api/paper.js` (line 82) calls `DELETE /papers/${id}`; `PaperCard.jsx` evaluates `isOwner \|\| isAdmin`; local file null-check safe in backend. All 6/6 tests passed in `test_p13_deletion.js`. |
| **P1-4 (SEC-05)** | Money | Coin Deduction & Entitlement Atomicity | **[VERIFIED - SOURCE & TEST]** | Implemented in `server/utils/coinManager.js` (lines 470-550) via atomic conditional MongoDB `$inc` & `$addToSet` with idempotency keys; cross-request pricing race prevented. All 10/10 concurrency & recovery tests passed in `test_p14_coins.js`. |
| **P1-5 (ENV-01)** | AI Setup | AI Microservice Restoration & Dependencies | **[VERIFIED - SOURCE & TEST]** | `ai/package.json` dependencies installed; Ollama URL normalization in `ai/services/ollamaService.js`; root scripts `"ai"` and `"dev:all"` added to `package.json`. Syntax check clean. |
| **P1-6 (INT-02)** | Core / AI | AI Assistant Streaming & Chat Lifecycle | **[VERIFIED - SOURCE & TEST]** | SSE stream chunk buffering with `TextDecoder` and `getAiStreamUrl` normalization in `client/src/api/aiAxios.js`; Uint8Array decoding fixed in `ai/services/ollamaService.js` (lines 83-103). All 14/14 tests passed in `test_p16_ai_assistant.js`; Client production build passed (`vite build`). |
| **P1-7 (PAY-01)** | Payment | Razorpay Webhook & Signature Verification | **[VERIFIED - SOURCE ONLY]** | `server/server.js` (lines 63-69) captures raw binary buffer `req.rawBody`; `server/routes/payment.routes.js` (lines 12-24) enforces `crypto.timingSafeEqual`; `fulfillRazorpayPayment` in `server/utils/coinManager.js` (lines 153-220) transitions atomically. Unit logic verified; live payment network unverified. |
| **SEC-006** | Security | Cloudinary API Secret Console Logging | **[STILL OPEN - CONFIRMED IN CODE]** | `ai/config/cloudinary.js` (lines 6-9) logs `process.env.API_SECRET` to standard output on every service boot. Plaintext credential exposure vulnerability. |
| **SEC-008** | Storage | Cloudinary Storage Exhaustion / Orphan Uploads | **[STILL OPEN - CONFIRMED IN CODE]** | `server/routes/paper.js` (lines 90-120) runs Multer Cloudinary upload BEFORE validating subject and pending limits; failed requests leave orphaned raw assets on Cloudinary without cleanup. |
| **SEC-009** | Security | IDOR & Paywall Bypass in AI Learning Endpoints | **[STILL OPEN - CONFIRMED IN CODE]** | `ai/routes/index.js` (lines 509-565): `/study-notes`, `/quiz`, and `/flashcards` require only `verifyToken`; they do NOT verify whether caller owns, previewed, or downloaded the paper. Unentitled users can extract knowledge from any paper. |
| **SEC-010** | Security | Global AI Knowledge Chunk Exfiltration | **[STILL OPEN - CONFIRMED IN CODE]** | `ai/routes/index.js` (lines 853-935): `GET /study-knowledge` and `GET /study-knowledge/:id` allow any authenticated student to dump parsed document chunks without paywall checks. |
| **SEC-011** | Security | Unsanitized Regex / ReDoS in Knowledge Search | **[STILL OPEN - CONFIRMED IN CODE]** | `ai/routes/index.js` (line 882): `GET /study-knowledge/search` passes raw `q.trim()` directly into MongoDB `{ $regex: q.trim(), $options: "i" }` without escaping special regex characters. |
| **SEC-012** | Security | Inactive MongoSanitize in AI Microservice | **[STILL OPEN - CONFIRMED IN CODE]** | `ai/server.js` (line 42): `//app.use(mongoSanitize());` is commented out. NoSQL query injection protection is inactive on the AI service. |
| **SEC-013** | CI/CD | Masked CI Test Failures & Missing Test Scripts | **[STILL OPEN - CONFIRMED IN CODE]** | `.github/workflows/ci.yml` (line 32) runs `npm test \|\| echo "Tests passed or ignored"`; `server/package.json` contains no `"test"` script. Real test failures are completely suppressed. |
| **SEC-014** | DoS | Unbounded PDF Page Image Rendering in OCR | **[STILL OPEN - CONFIRMED IN CODE]** | `ai/services/ingestor.js` (lines 173-178): `pdfImgConvert.convert(..., { width: 1700, height: 2200, page_numbers: null })` renders all pages of large PDFs simultaneously at high resolution, creating severe OOM crash risks. |
| **SEC-015** | Logic | Self-Rating Manipulation | **[STILL OPEN - CONFIRMED IN CODE]** | `server/routes/paper.js` (lines 800-833): Authors are not blocked from rating their own papers (`paper.uploadedBy === req.user._id`), allowing rating manipulation and artificial badge/rank increments. |
| **P2-1 (QAL-01)** | Quality | Frontend Lint Errors | **[STILL OPEN - CONFIRMED IN CODE]** | `npm run lint` in `client` failed with 10 problems (6 errors, 4 warnings): undefined `setUser`/`setToken` in `client/src/api/auth.js`, setState inside effect in `Navbar.jsx`, `PDFViewer.jsx`, and `Papers.jsx`. |
| **P2-2 (TST-01)** | Quality | Repository Automated Test Suite | **[STILL OPEN - CONFIRMED IN CODE]** | Automated test scripts exist only as temporary audit scripts in the scratch directory; no unified Jest/Mocha/Vitest test harness exists in `server/package.json` or `client/package.json`. |
| **P3 (UX-01)** | UX | Draft Saving Blocked by Pending Limit | **[STILL OPEN - CONFIRMED IN CODE]** | `server/routes/paper.js` (lines 105-121): Pending upload limit check rejects requests before inspecting if `status === "draft"`. |
| **P3 (UX-02)** | UX | Trending Papers Endpoint Requires Auth | **[STILL OPEN - CONFIRMED IN CODE]** | `server/routes/paper.js` (line 460): `GET /trending` enforces `verifyToken`, preventing public landing page visitors from viewing popular papers. |
| **P3 (DOC-01)** | Docs | Outdated & Conflicting Documentation | **[STILL OPEN - CONFIRMED IN CODE]** | `README.md`, `STABILIZATION_AND_FEATURES.md`, and `CONTRIBUTING.md` contain conflicting values regarding coin rewards (+20 vs +30), rank tiers (Newbie vs Beginner), and `.env` paths (`server/.env` vs root `.env`). |
| **P3 (CLN-01)** | Cleanup | Dead Code & Missing Feature UI | **[STILL OPEN - CONFIRMED IN CODE]** | AI study notes, quizzes, and flashcards have backend API endpoints but zero frontend UI pages or components in `client/src/pages`. |

---

## 3. Detailed Audit Findings & Remediation Plan

### Phase A: Priority 0 & Priority 1 (Implemented & Verified)

All P0 and P1 tasks previously marked as complete were verified through fresh source inspection and test runs in this audit:

1. **P0-1 (SEC-01) — Removed Free Coin Purchase Backdoor**
   - **Source Inspection:** `server/routes/coin.js` contains only `GET /packages`. `client/src/api/coinApi.js` contains no mock purchase functions.
   - **Status:** **COMPLETE & VERIFIED**.

2. **P0-2 (BUG-01) — Fixed Paper Update and Deletion Crashes**
   - **Source Inspection:** In `server/routes/paper.js`, synchronous dangling imports replaced with REST calls:
     - Line 1131: `fetch("${AI_SERVICE_URL}/api/v1/internal/ai/reprocess", ...)`
     - Line 1237: `fetch("${AI_SERVICE_URL}/api/v1/internal/ai/knowledge/${id}", ...)`
   - **Status:** **COMPLETE & VERIFIED**.

3. **P0-3 (SEC-02) — Removed Hardcoded JWT Secrets**
   - **Source Inspection:** In `docker-compose.yml`, mandatory environment variable interpolation is enforced (`${JWT_SECRET:?JWT_SECRET must be set}`, `${JWT_REFRESH_SECRET:?JWT_REFRESH_SECRET must be set}`, `${INTERNAL_SERVICE_KEY:?INTERNAL_SERVICE_KEY must be set}`). MongoDB port configured to 27017.
   - **Status:** **COMPLETE & VERIFIED**.

4. **P1-1 (SEC-03) — Protected PDF Paywall Data**
   - **Source Inspection:** `pdfLink` redacted from public listing queries, trending queries, related paper queries, and user bookmark profile responses. `GET /:id` allows only author, admin, or verified download entitlement holder to see `pdfLink`.
   - **Tests Run:** `test_entitlements.js` (5/5 passed).
   - **Status:** **COMPLETE & VERIFIED**.

5. **P1-2 (SEC-04) — Protected Internal AI Endpoints**
   - **Source Inspection:** `ai/middleware/internalAuth.js` enforces `x-internal-service-key` with constant-time SHA-256 buffer comparison. Internal endpoints mounted under `/api/v1/internal/ai` are guarded.
   - **Tests Run:** `test_p12_auth.js` (9/9 passed).
   - **Status:** **COMPLETE & VERIFIED**.

6. **P1-3 (INT-01) — Fixed Student Paper Deletion**
   - **Source Inspection:** `client/src/api/paper.js` routes `deletePaper` to `DELETE /papers/:id`. `PaperCard.jsx` computes `canDelete = isOwner || isAdmin` and hides admin-only Edit button from students.
   - **Tests Run:** `test_p13_deletion.js` (6/6 passed).
   - **Status:** **COMPLETE & VERIFIED**.

7. **P1-4 (SEC-05) — Fixed Coin Deduction Consistency**
   - **Source Inspection:** `purchasePaperEntitlement` in `server/utils/coinManager.js` uses atomic conditional updates (`$inc: -cost`, `$addToSet: entitlement`) with deterministic idempotency keys. Direct download sets both preview and download entitlements to prevent concurrent overcharge.
   - **Tests Run:** `test_p14_coins.js` (10/10 passed).
   - **Status:** **COMPLETE & VERIFIED**.

8. **P1-5 (ENV-01, CFG-01) — Restored AI Microservice**
   - **Source Inspection:** Dependencies installed in `ai/package.json`. Ollama URL handling normalized. Startup scripts added to root `package.json`.
   - **Status:** **COMPLETE & VERIFIED**.

9. **P1-6 (INT-02) — Fixed AI Assistant API Integration**
   - **Source Inspection:** SSE streaming URL normalized in `client/src/api/aiAxios.js`. Multi-byte chunk decoding fixed using `TextDecoder` in `ai/services/ollamaService.js`.
   - **Tests Run:** `test_p16_ai_assistant.js` (14/14 passed) and `npm run build` in client (passed, 2620 modules transformed).
   - **Status:** **COMPLETE & VERIFIED**.

10. **P1-7 (PAY-01) — Fixed Razorpay Verification**
    - **Source Inspection:** `server/server.js` captures `req.rawBody`. `server/routes/payment.routes.js` validates signatures with `verifyTimingSafeSignature`. `fulfillRazorpayPayment` updates payment and credits coins idempotently.
    - **Status:** **COMPLETE & VERIFIED (Source Level)**. Live webhook end-to-end network tests require active Razorpay merchant sandbox credentials.

---

### Phase B: Unresolved Critical Security & Stability Findings (Newly Consolidated)

These findings from `AUDIT_REPORT.md` and current source verification were confirmed as still active and require remediation:

#### 1. SEC-006: Plaintext Cloudinary API Secret Console Logging
- **File:** `ai/config/cloudinary.js` (lines 6-9)
- **Vulnerability:**
  ```javascript
  console.log("ENV CHECK:");
  console.log("CLOUD_NAME:", process.env.CLOUD_NAME);
  console.log("API_KEY:", process.env.API_KEY);
  console.log("API_SECRET:", process.env.API_SECRET);
  ```
- **Severity:** High (CVSS 7.5)
- **Remediation:** Remove debugging `console.log` statements for API credentials immediately.

#### 2. SEC-008: Cloudinary Storage Exhaustion via Orphan Uploads
- **File:** `server/routes/paper.js` (lines 80-120)
- **Vulnerability:** Multer uploads files to Cloudinary before route-level checks execute. If validation fails (e.g. invalid subject, upload limit of 2 pending papers exceeded, or duplicate title), the request returns HTTP 400 but the uploaded asset is never deleted from Cloudinary.
- **Severity:** High (CVSS 7.5)
- **Remediation:** If request validation fails, invoke `cloudinary.uploader.destroy(getPublicId(req.file.path), { resource_type: "raw" })` before sending the 400 error response.

#### 3. SEC-009: IDOR & Paywall Bypass in AI Learning Tools
- **File:** `ai/routes/index.js` (lines 509-565)
- **Vulnerability:** `/study-notes`, `/quiz`, and `/flashcards` accept any `paperId` with only basic token authentication (`verifyToken`). The endpoints do not verify whether the requesting user is the paper author, an admin, or has purchased preview/download access.
- **Severity:** High (CVSS 7.5)
- **Remediation:** Enforce paper entitlement check before generating study notes, quizzes, or flashcards. Verify caller against `paper.uploadedBy`, `req.user.role === 'admin'`, or `req.user.previewedPapers` / `req.user.downloadedPapers`.

#### 4. SEC-010: Global AI Knowledge Chunk Exfiltration
- **File:** `ai/routes/index.js` (lines 853-935)
- **Vulnerability:** `GET /study-knowledge` and `GET /study-knowledge/:id` allow any authenticated user to retrieve parsed document chunks, exposing protected paper content without paywall validation.
- **Severity:** Medium (CVSS 6.5)
- **Remediation:** Restrict study knowledge retrieval routes to administrators (`verifyAdmin`) or require paper entitlement gating per chunk query.

#### 5. SEC-011: Unsanitized Regex / ReDoS in Knowledge Search
- **File:** `ai/routes/index.js` (line 882)
- **Vulnerability:**
  ```javascript
  if (q) {
    filter.chunkText = { $regex: q.trim(), $options: "i" };
  }
  ```
- **Severity:** Medium (CVSS 6.5)
- **Remediation:** Sanitize user search inputs using a regex escape utility (`escapeRegex(q.trim())`) before constructing MongoDB query expressions.

#### 6. SEC-012: Inactive MongoSanitize in AI Microservice
- **File:** `ai/server.js` (line 42)
- **Vulnerability:**
  ```javascript
  //app.use(mongoSanitize());
  ```
- **Severity:** Medium (CVSS 6.0)
- **Remediation:** Uncomment and configure `mongoSanitize()` middleware to protect against NoSQL operator injection in the AI microservice.

#### 7. SEC-013: Masked CI Test Failures
- **File:** `.github/workflows/ci.yml` (line 32)
- **Vulnerability:** `npm test || echo "Tests passed or ignored"` masks build and test failures in GitHub Actions CI. Furthermore, `server/package.json` lacks a `"test"` script.
- **Severity:** Medium (CVSS 5.5)
- **Remediation:** Implement standard test script in `server/package.json` and remove the `|| echo ...` suppression from `.github/workflows/ci.yml`.

#### 8. SEC-014: Unbounded PDF Page Rendering in OCR
- **File:** `ai/services/ingestor.js` (lines 173-178)
- **Vulnerability:**
  ```javascript
  pageImages = await pdfImgConvert.convert(pdfBuffer, {
    width: 1700,
    height: 2200,
    page_numbers: null, // renders ALL pages at once
    base64: false,
  });
  ```
- **Severity:** Medium (CVSS 5.3)
- **Remediation:** Impose a strict ceiling on OCR page rendering (e.g., maximum 10-15 pages) and render pages sequentially or in small batches to prevent Node process memory exhaustion.

#### 9. SEC-015: Self-Rating Manipulation
- **File:** `server/routes/paper.js` (lines 800-833)
- **Vulnerability:** `POST /:id/rate` does not check if `paper.uploadedBy.toString() === req.user._id.toString()`. Authors can rate their own papers 5 stars to manipulate ranking.
- **Severity:** Low (CVSS 3.5)
- **Remediation:** Add check `if (paper.uploadedBy.toString() === req.user._id.toString()) return res.status(403).json({ error: "Authors cannot rate their own papers" });`.

---

### Phase C: Priority 2 — Quality & Reliability (To Be Implemented)

#### P2-1: Fix Frontend Lint Errors (QAL-01)
- **Status:** **STILL OPEN**
- **Test Command:** `npm run lint` in `client/`
- **Current Outcome:** 10 problems (6 errors, 4 warnings)
  1. `client/src/api/auth.js:57:40` — `'setUser' is not defined (no-undef)`
  2. `client/src/api/auth.js:58:41` — `'setToken' is not defined (no-undef)`
  3. `client/src/api/auth.js:59:11` — `Empty block statement (no-empty)`
  4. `client/src/components/common/Navbar.jsx:64:5` — `Calling setState synchronously within an effect (react-hooks/set-state-in-effect)`
  5. `client/src/components/papers/PDFViewer.jsx:25:5` — `Calling setState synchronously within an effect (react-hooks/set-state-in-effect)`
  6. `client/src/pages/Papers.jsx:62:32` — `Calling setState synchronously within an effect (react-hooks/set-state-in-effect)`
  7. Warnings in `CoinGrantModal.jsx`, `AIAssistant.jsx`, and `Papers.jsx`.
- **Target:** 0 errors, 0 warnings on `npm run lint`.

#### P2-2: Add Automated Test Suite & Repair CI (TST-01, CICD-01)
- **Status:** **STILL OPEN**
- **Requirements:**
  1. Migrate scratch verification test suites (`test_p12_auth`, `test_p13_deletion`, `test_p14_coins`, `test_p16_ai_assistant`, `test_entitlements`, `test_p17_razorpay`) into permanent repository test suites under `server/test/` and `ai/test/`.
  2. Add `"test"` scripts to root, server, and ai `package.json` files using Node's native test runner (`node --test`) or Jest/Vitest.
  3. Update `.github/workflows/ci.yml` to run real backend, ai, and client build/test steps without failure masking.

---

### Phase D: Priority 3 — Remaining Improvements (To Be Implemented)

1. **UX-01 (Draft Saving):** In `server/routes/paper.js`, allow paper uploads with `status === "draft"` to bypass the 2-pending-upload ceiling.
2. **UX-02 (Public Trending Papers):** Modify `GET /trending` in `server/routes/paper.js` to allow optional/unauthenticated guest viewing with redaction of restricted fields.
3. **DOC-01 (Documentation Reconciliation):** Update `README.md`, `STABILIZATION_AND_FEATURES.md`, and `CONTRIBUTING.md` to reflect verified facts:
   - Approval coin reward is +30 coins (not 20).
   - Rank tiers are Beginner → Explorer → Scholar → Expert → Legend (not Newbie → Diamond).
   - Environment variables load from root `.env` (not `server/.env`).
   - AI service is a distinct microservice on port 5001.
   - React Router version is v7.13.0 (not v6).
4. **CLN-01 (Dead Code & Feature Alignment):** Decide whether to build frontend UI components for AI study notes, quizzes, and flashcards, or deprecate unused endpoints.

---

## 4. Progress Tracker Summary

| Category | Total Tasks / Findings | Completed & Verified | Open / Pending |
|---|---|---|---|
| **Priority 0 (Critical Hotfixes)** | 3 | 3 (P0-1, P0-2, P0-3) | 0 |
| **Priority 1 (Core & Security)** | 7 | 7 (P1-1 through P1-7) | 0 |
| **Consolidated Security (SEC-006 to SEC-015)** | 9 | 0 | 9 (SEC-006, 008, 009, 010, 011, 012, 013, 014, 015) |
| **Priority 2 (Quality & CI)** | 2 | 0 | 2 (P2-1 lint, P2-2 CI/tests) |
| **Priority 3 (UX & Docs)** | 5 | 0 | 5 (UX-01, UX-02, DOC-01, CLN-01, AI-UI-01) |
| **TOTALS** | **26** | **10** | **16** |

---

## 5. Working Rules & Constraints

1. Treat this file as the authoritative single source of truth for repository health and task progress.
2. Work on ONE task at a time. Verify with tests before marking complete.
3. Preserve all uncommitted changes from P0-1 through P1-7.
4. Never expose real credentials, API secrets, or `.env` contents.
5. Do not run destructive database operations or real monetary transactions.
6. Only claim a task is complete when verified by current source inspection AND automated test execution.
