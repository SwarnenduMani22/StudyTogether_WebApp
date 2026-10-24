# StudyTogether — Complete Project Context & System Audit

> **Document Status**: Production Architecture & Code Audit
> **Repository Path**: `C:\Users\SWARNENDU\Downloads\StudyTogether`
> **Auditor Role**: Senior Full-Stack Engineer & Security Code Auditor
> **Audit Date**: 2026-10-24
> **Stabilization & Features Roadmap**: [`STABILIZATION_AND_FEATURES.md`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/STABILIZATION_AND_FEATURES.md)
> **Security Audit Report**: [`AUDIT_REPORT.md`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/AUDIT_REPORT.md)
> **Security Fix Plan**: [`FIX_PLAN.md`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/FIX_PLAN.md)
> **Constraint Verification**: Application source code, configuration files, dependencies, lockfiles, database data, and runtime behavior were **NOT** modified.

---

## 1. Executive Summary & Repository Overview

StudyTogether is a full-stack, resource-sharing platform designed for college students to upload, discover, preview, download, and review academic study materials (PDF documents). The platform incorporates a virtual gamified economy ("Study Coins"), an administrative moderation workflow, star ratings, comments, user activity logging, leaderboards with badge progression, and an integrated AI Copilot subsystem providing Retrieval-Augmented Generation (RAG) over study documents and platform assistance.

### Repository Component Breakdown

The repository is structured into three discrete subsystems:
1. **Frontend (`client/`)**: A Single Page Application (SPA) built on React 19, Vite 7, Tailwind CSS 3, React Router DOM v7, and TanStack React Query v5.
2. **Main Backend Server (`server/`)**: An Express 5 / Node.js service managing authentication, MongoDB transactions, paper moderation, Cloudinary PDF uploads, Razorpay payment processing, and virtual coin accounting.
3. **AI Copilot Microservice (`ai/`)**: A dedicated Express 5 service responsible for document text extraction (`pdf-parse`, `tesseract.js`, `pdf-img-convert`), word chunking, vector embeddings (`nomic-embed-text`), BM25 keyword scoring, hybrid similarity search, local LLM generation (`ollama` / `mistral`), and chat session management.

---

## 2. Actual System Architecture

```
                       +-------------------------------------------------+
                       |              React 19 Client (SPA)              |
                       |       Vite Dev Server (Port: 5173)              |
                       +-------------------------------------------------+
                                      |                     |
               HTTP/1.1 (/api/v1/...) |                     | HTTP / SSE (/api/v1/ai/...)
            [Proxied via Vite dev]    v                     v [Proxied via Vite dev]
     +-----------------------------------+       +-----------------------------------+
     |        Main Backend Server        |       |          AI Microservice          |
     |     Express 5 (Port: 5000)        |       |      Express 5 (Port: 5001)       |
     +-----------------------------------+       +-----------------------------------+
        |       |        |            |             |                  |
        |       |        |            +-------------+                  |
        |       |        |           Internal REST Calls               |
        |       |        |       (http://localhost:5001)               |
        |       |        |                                             |
        v       v        v                                             v
  +---------+ +----+ +----------+                             +-----------------+
  | MongoDB | |Cloud| | Razorpay |                             |  Local Ollama   |
  | Atlas   | |inary| | Gateway  |                             | (Port: 11434)   |
  +---------+ +----+ +----------+                             +-----------------+
```

### Process & Service Separation
- **Root Orchestration**: [`package.json`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/package.json#L5) defines `npm run dev` as `concurrently "npm run dev --prefix server" "npm run dev --prefix client"`. **Note**: The `ai` service is **omitted** from the root startup script.
- **Client Dev Proxy**: [`client/vite.config.js`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/client/vite.config.js#L24-L35) routes `/api/v1/ai` requests to `http://localhost:5001` and other `/api` requests to `http://localhost:5000`.
- **Inter-service Communication**:
  - The main server invokes the AI microservice asynchronously over HTTP at `${AI_SERVICE_URL}` (default `http://localhost:5001`) during paper approval ([`server/routes/paper.js`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/routes/paper.js#L313-L318)) and rejection ([`server/routes/paper.js`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/routes/paper.js#L352-L355)).
  - Both `server` and `ai` connect to the same MongoDB database (`MONGODB_URI`) but operate largely on independent collections, with `ai` reading and updating [`Paper`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/models/Paper.js) and [`User`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/models/User.js).

---

## 3. Verified Features Matrix

| Feature | Verified Location | Status | Implementation Details |
| :--- | :--- | :--- | :--- |
| **User Registration & Login** | [`server/routes/auth.js`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/routes/auth.js#L13-L187) | ✅ Operational | Passwords hashed with bcryptjs (cost 10). JWT access token (15m) + HttpOnly cookie refresh token (7d). |
| **Token Refresh & Revocation** | [`server/routes/auth.js`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/routes/auth.js#L193-L293) | ✅ Operational | Validates `tokenType: "refresh"` and database match before issuing new access token. Revokes on logout. |
| **Paper Uploads (Multer + Cloudinary)** | [`server/routes/paper.js`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/routes/paper.js#L49-L169) | ✅ Operational | Uploads raw PDF to Cloudinary (`study-together/papers`). 5MB size limit. Admins auto-approved; users restricted to 2 pending uploads. |
| **Draft Paper Support** | [`server/routes/paper.js`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/routes/paper.js#L131-L153) | ✅ Operational | Setting `isDraft: true` assigns `status: "draft"`. Drafts bypass the 2-pending upload limit. |
| **Admin Moderation & Bulk Actions** | [`server/routes/paper.js`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/routes/paper.js#L278-L425) | ✅ Operational | Single/bulk approve (`+30` coins to uploader), single/bulk reject (deletes paper and destroys Cloudinary raw asset). |
| **Coin Balance & Atomic Deductions** | [`server/utils/coinManager.js`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/utils/coinManager.js#L28-L55) | ✅ Operational | Uses MongoDB atomic condition `{ coins: { $gte: amount } }` and `$inc: { coins: -amount }` to avoid race conditions. |
| **Coin Purchasing (Razorpay)** | [`server/routes/payment.routes.js`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/routes/payment.routes.js#L16-L268) | ⚠️ Partial | Order creation and webhook HMAC verification are present. Signature verification route `/verify` **does not** credit coins; crediting relies on the webhook. |
| **Coin Purchasing (Mock Route)** | [`server/routes/coin.js`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/routes/coin.js#L28-L78) | ⚠️ Critical Risk | `POST /api/v1/coins/purchase` immediately credits coins without any payment gateway integration. |
| **PDF Viewing & Access Gating** | [`server/routes/paper.js`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/routes/paper.js#L573-L733) | ⚠️ Insecure | Gating logic charges 10 coins for preview and 30/40 coins for download. However, `pdfLink` is leaked directly in `GET /api/v1/papers` and `GET /api/v1/papers/:id`. |
| **Gamification, Streaks & Badges** | [`server/services/badgeService.js`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/services/badgeService.js#L6-L66) | ✅ Operational | 10 automatic badges, rank calculation (Beginner, Explorer, Scholar, Expert, Legend), and daily login streaks. |
| **Leaderboard & Contributor Profiles** | [`server/routes/user.js`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/routes/user.js#L145-L189) | ✅ Operational | Public profiles at `/public/:id`, monthly contribution aggregates at `/public/:id/stats`, and top 10 leaderboard. |
| **Ratings & Comments** | [`server/routes/paper.js`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/routes/paper.js#L739-L936) | ✅ Operational | 1-5 star ratings (one vote per user, admins forbidden), 2-500 char comments, comment deletion permissions. |
| **Admin Platform Knowledge** | [`server/routes/admin.js`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/routes/admin.js#L456-L598) | ✅ Operational | CRUD operations for platform documentation articles stored in `PlatformKnowledge`. |
| **AI Study Copilot (RAG & Stream)** | [`ai/routes/index.js`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/routes/index.js#L101-L396) | ✅ Operational | Hybrid vector search (cosine similarity) + BM25 keyword scoring, SSE token streaming via Ollama (`/chat/stream`). |
| **AI Learning Services** | [`ai/services/learningService.js`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/services/learningService.js#L6-L136) | ✅ Operational | Generates study notes, MCQ practice quizzes, flashcards, personalized exam plans, and topic difficulty analyses. |

---

## 4. Complete Routes & Endpoints Reference

### 4.1 Main Backend Server (`server/`) — Base URL: `/api/v1`

#### Authentication (`server/routes/auth.js`)
- `POST /api/v1/auth/register` ([L13-L95](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/routes/auth.js#L13-L95)) — Public. Body: `{ name, email, password }`. Creates user with 50 default coins.
- `POST /api/v1/auth/login` ([L101-L187](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/routes/auth.js#L101-L187)) — Public. Body: `{ email, password }`. Issues 15m access token and sets 7d HttpOnly `refreshToken` cookie.
- `POST /api/v1/auth/refresh` ([L193-L261](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/routes/auth.js#L193-L261)) — Public. Cookie or Body: `{ refreshToken }`. Validates token against database; issues new access token.
- `POST /api/v1/auth/logout` ([L267-L293](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/routes/auth.js#L267-L293)) — Authenticated (`verifyToken`). Clears database refresh token and clears cookie.

#### User Management (`server/routes/user.js`)
- `GET /api/v1/users/profile` ([L114-L140](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/routes/user.js#L114-L140)) — Authenticated. Returns current user details, bookmarks, and calculated rank.
- `PUT /api/v1/users/update` ([L231-L290](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/routes/user.js#L231-L290)) — Authenticated. Body: `{ name, password }`. Updates profile; invalidates session on password change.
- `DELETE /api/v1/users/delete` ([L295-L353](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/routes/user.js#L295-L353)) — Authenticated. Cascades deletion to Cloudinary PDFs, user bookmarks, and database papers. Prevents last admin self-deletion.
- `GET /api/v1/users/stats` ([L86-L108](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/routes/user.js#L86-L108)) — Authenticated. Returns approved and pending paper counts.
- `GET /api/v1/users/my-papers` ([L195-L225](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/routes/user.js#L195-L225)) — Authenticated. Returns all papers uploaded by the authenticated user.
- `POST /api/v1/users/bookmark/:id` ([L31-L80](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/routes/user.js#L31-L80)) — Authenticated. Toggles paper in user's bookmarks array.
- `GET /api/v1/users/coin-overview` ([L355-L409](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/routes/user.js#L355-L409)) — Authenticated. Query: `page`, `limit`, `type`. Returns paginated transaction history and balance stats.
- `GET /api/v1/users/leaderboard` ([L415-L439](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/routes/user.js#L415-L439)) — Authenticated. Returns top 10 users sorted by coins and approved uploads.
- `GET /api/v1/users/activity` ([L177-L189](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/routes/user.js#L177-L189)) — Public. Query: `limit`. Returns global community activities feed.
- `GET /api/v1/users/public/:id` ([L145-L155](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/routes/user.js#L145-L155)) — Public. Returns public user stats, rank, and badges.
- `GET /api/v1/users/public/:id/stats` ([L160-L172](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/routes/user.js#L160-L172)) — Public. Aggregates monthly approved uploads for chart rendering.

#### Study Papers (`server/routes/paper.js`)
- `GET /api/v1/papers` ([L190-L252](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/routes/paper.js#L190-L252)) — Authenticated. Query: `page`, `search`, `subject`, `semester`, `sort`. Returns paginated approved papers list.
- `POST /api/v1/papers/upload` ([L49-L169](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/routes/paper.js#L49-L169)) — Authenticated (`sensitiveActionLimiter`). Multipart form: `title`, `subject`, `semester`, `pdf`, `isDraft`. Uploads file to Cloudinary and creates paper.
- `GET /api/v1/papers/trending` ([L451-L501](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/routes/paper.js#L451-L501)) — Authenticated. Aggregates top 5 papers by computed popularity score.
- `GET /api/v1/papers/top-papers` ([L506-L528](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/routes/paper.js#L506-L528)) — Admin only (`verifyToken`, `verifyAdmin`). Returns top 5 papers sorted by downloads/views.
- `GET /api/v1/papers/:id` ([L534-L569](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/routes/paper.js#L534-L569)) — Authenticated. Returns paper metadata.
- `PUT /api/v1/papers/:id` ([L941-L1131](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/routes/paper.js#L941-L1131)) — Authenticated (Author or Admin). Multipart form or JSON. Updates paper fields, optional PDF replacement, draft publication.
- `DELETE /api/v1/papers/:id` ([L1136-L1200](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/routes/paper.js#L1136-L1200)) — Authenticated (Author or Admin). Deletes Cloudinary asset and MongoDB record. *(Note: Buggy background delete call).*
- `GET /api/v1/papers/:id/related` ([L428-L445](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/routes/paper.js#L428-L445)) — Authenticated. Returns up to 3 papers sharing the same subject or semester.
- `POST /api/v1/papers/:id/view` ([L573-L646](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/routes/paper.js#L573-L646)) — Authenticated. Deducts 10 coins if not already previewed/owned/admin; returns `pdfLink`.
- `POST /api/v1/papers/:id/download` ([L650-L733](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/routes/paper.js#L650-L733)) — Authenticated. Deducts 40 coins (30 if previewed); increments download count; returns `pdfLink`.
- `POST /api/v1/papers/:id/rate` ([L739-L808](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/routes/paper.js#L739-L808)) — Authenticated (Non-admin only). Body: `{ rating: 1-5 }`. Adds or updates star rating.
- `POST /api/v1/papers/:id/comment` ([L814-L868](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/routes/paper.js#L814-L868)) — Authenticated. Body: `{ text: 2-500 chars }`. Appends comment to paper.
- `DELETE /api/v1/papers/:paperId/comment/:commentId` ([L874-L936](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/routes/paper.js#L874-L936)) — Authenticated (Author or Admin). Removes comment.
- `GET /api/v1/papers/admin/pending` ([L258-L275](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/routes/paper.js#L258-L275)) — Admin only. Lists all papers with status `pending`.
- `PUT /api/v1/papers/admin/approve/:id` ([L281-L332](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/routes/paper.js#L281-L332)) — Admin only. Sets status to `approved`, credits +30 coins to uploader, triggers AI ingestion.
- `DELETE /api/v1/papers/admin/reject/:id` ([L337-L360](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/routes/paper.js#L337-L360)) — Admin only. Deletes Cloudinary PDF, deletes DB paper, triggers AI knowledge cleanup.
- `POST /api/v1/papers/admin/bulk-approve` ([L365-L397](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/routes/paper.js#L365-L397)) — Admin only. Body: `{ paperIds: [] }`. Iteratively approves papers and rewards coins.
- `POST /api/v1/papers/admin/bulk-reject` ([L399-L425](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/routes/paper.js#L399-L425)) — Admin only. Body: `{ paperIds: [] }`. Iteratively rejects papers and destroys Cloudinary assets.

#### Admin Control Center (`server/routes/admin.js`)
- `GET /api/v1/admin/users` ([L21-L62](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/routes/admin.js#L21-L62)) — Admin only. Paginated user search.
- `DELETE /api/v1/admin/users/:id` ([L69-L125](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/routes/admin.js#L69-L125)) — Admin only. Deletes user account; prevents self-deletion and last admin deletion.
- `PUT /api/v1/admin/users/:id/role` ([L132-L188](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/routes/admin.js#L132-L188)) — Admin only. Body: `{ role: "user" | "admin" }`.
- `GET /api/v1/admin/stats` ([L194-L248](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/routes/admin.js#L194-L248)) — Admin only. System aggregates: users, admins, views, downloads, comments, ratings, pending/approved counts.
- `GET /api/v1/admin/top-contributors` ([L255-L317](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/routes/admin.js#L255-L317)) — Admin only. Top 10 uploaders by approved papers count.
- `GET /api/v1/admin/top-coin-holders` ([L324-L343](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/routes/admin.js#L324-L343)) — Admin only. Top 10 users sorted by coin balance.
- `GET /api/v1/admin/coin-analytics` ([L349-L385](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/routes/admin.js#L349-L385)) — Admin only. Aggregates total coins in system, purchased, and spent.
- `POST /api/v1/admin/users/:id/refund` ([L391-L453](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/routes/admin.js#L391-L453)) — Admin only. Body: `{ amount, reason }`. Atomically refunds coins and logs transaction.
- `GET /api/v1/admin/platform-knowledge` ([L460-L478](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/routes/admin.js#L460-L478)) — Admin only. Query: `category`, `status`, `search`. Lists knowledge articles.
- `POST /api/v1/admin/platform-knowledge` ([L493-L512](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/routes/admin.js#L493-L512)) — Admin only. Creates knowledge article.
- `GET /api/v1/admin/platform-knowledge/:id` ([L481-L490](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/routes/admin.js#L481-L490)) — Admin only. Returns single knowledge article.
- `PUT /api/v1/admin/platform-knowledge/:id` ([L515-L534](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/routes/admin.js#L515-L534)) — Admin only. Updates knowledge article.
- `DELETE /api/v1/admin/platform-knowledge/:id` ([L537-L546](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/routes/admin.js#L537-L546)) — Admin only. Deletes knowledge article.
- `PATCH /api/v1/admin/platform-knowledge/:id/status` ([L549-L566](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/routes/admin.js#L549-L566)) — Admin only. Changes status (`draft`, `published`, `archived`).
- `PATCH /api/v1/admin/platform-knowledge/:id/publish` ([L569-L582](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/routes/admin.js#L569-L582)) — Admin only. Sets status to `published`.
- `PATCH /api/v1/admin/platform-knowledge/:id/archive` ([L585-L598](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/routes/admin.js#L585-L598)) — Admin only. Sets status to `archived`.

#### Coin & Payment Operations (`server/routes/coin.js` & `server/routes/payment.routes.js`)
- `GET /api/v1/coins/packages` ([L17-L22](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/routes/coin.js#L17-L22)) — Public. Returns starter, popular, and premium package definitions.
- `POST /api/v1/coins/purchase` ([L28-L78](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/routes/coin.js#L28-L78)) — Authenticated. Body: `{ packageId }`. **Mock route**: Directly credits coins without charge.
- `POST /api/v1/payment/create-order` ([L16-L77](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/routes/payment.routes.js#L16-L77)) — Authenticated. Body: `{ packageId }`. Initializes Razorpay order and saves `Payment` record in `created` status.
- `POST /api/v1/payment/verify` ([L82-L142](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/routes/payment.routes.js#L82-L142)) — Authenticated. Body: `{ packageId, razorpay_order_id, razorpay_payment_id, razorpay_signature }`. Validates HMAC signature.
- `GET /api/v1/payment/history` ([L147-L170](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/routes/payment.routes.js#L147-L170)) — Authenticated. Returns current user's payment records.
- `POST /api/v1/payment/webhook` ([L175-L268](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/routes/payment.routes.js#L175-L268)) — Public (Webhook). Requires `x-razorpay-signature` and raw JSON body. Credits coins on `payment.captured`.
- `GET /api/v1/payment/admin/analytics` ([L275-L315](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/routes/payment.routes.js#L275-L315)) — Admin only. Total revenue, payment counts, and coins sold.
- `GET /api/v1/payment/admin/package-sales` ([L320-L360](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/routes/payment.routes.js#L320-L360)) — Admin only. Breakdown of sales grouped by package name.
- `GET /api/v1/payment/admin/list` ([L365-L419](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/routes/payment.routes.js#L365-L419)) — Admin only. Paginated, searchable payment audit table.

#### System Health (`server/server.js`)
- `GET /api/v1/health` ([L159-L174](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/server.js#L159-L174)) — Public. Returns database connectivity status (`healthy` or `degraded`).

---

### 4.2 AI Copilot Microservice (`ai/`) — Base URL: `/api/v1/ai`

#### Internal Pipeline Communication (`ai/server.js`)
- `POST /api/v1/internal/ai/process` ([L44-L57](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/server.js#L44-L57)) — Internal. Body: `{ paperId }`. Triggers background PDF text extraction, chunking, and embedding.
- `POST /api/v1/internal/ai/reprocess` ([L59-L72](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/server.js#L59-L72)) — Internal. Body: `{ paperId }`. Deletes existing chunks and re-runs ingestion.
- `DELETE /api/v1/internal/ai/knowledge/:paperId` ([L74-L83](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/server.js#L74-L83)) — Internal. Deletes all knowledge chunks associated with the given paper.
- `GET /health` ([L89-L91](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/server.js#L89-L91)) — Public. AI service health check.

#### Public & User AI Endpoints (`ai/routes/index.js`)
- `GET /api/v1/ai/status` ([L939-L1025](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/routes/index.js#L939-L1025)) — Public. Detailed readiness check: Ollama connectivity, chunk count, vector index health, active model.
- `GET /api/v1/ai/health` ([L815-L844](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/routes/index.js#L815-L844)) — Public. Lightweight provider and Ollama reachability probe.
- `POST /api/v1/ai/conversation` or `/conversations` ([L61-L96](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/routes/index.js#L61-L96)) — Authenticated. Body: `{ domain: "platform" | "study", paperId }`. Initializes chat session.
- `POST /api/v1/ai/chat` ([L101-L185](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/routes/index.js#L101-L185)) — Authenticated. Body: `{ conversationId, message, paperId }`. Returns standard JSON response with citations, confidence, and sources.
- `POST /api/v1/ai/chat/stream` ([L190-L396](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/routes/index.js#L190-L396)) — Authenticated. Body: `{ conversationId, message, paperId }`. Streams tokens over Server-Sent Events (SSE).
- `GET /api/v1/ai/history` or `/conversations` ([L401-L420](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/routes/index.js#L401-L420)) — Authenticated. Lists user's conversation sessions.
- `GET /api/v1/ai/conversations/:id` ([L424-L442](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/routes/index.js#L424-L442)) — Authenticated. Retrieves full message history and citations for a conversation.
- `DELETE /api/v1/ai/history/:id` or `/conversations/:id` ([L447-L466](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/routes/index.js#L447-L466)) — Authenticated. Deletes a specific conversation session.
- `DELETE /api/v1/ai/conversations` ([L469-L483](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/routes/index.js#L469-L483)) — Authenticated. Clears all conversations for the user.
- `POST /api/v1/ai/study-notes` ([L507-L522](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/routes/index.js#L507-L522)) — Authenticated. Body: `{ paperId, topic }`. Generates markdown study notes.
- `POST /api/v1/ai/quiz` ([L527-L540](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/routes/index.js#L527-L540)) — Authenticated. Body: `{ paperId, type, count }`. Generates practice questions with answers and explanations.
- `POST /api/v1/ai/flashcards` ([L544-L560](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/routes/index.js#L544-L560)) — Authenticated. Body: `{ paperId }`. Generates front/back concept flashcards.
- `POST /api/v1/ai/exam-plan` ([L565-L584](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/routes/index.js#L565-L584)) — Authenticated. Body: `{ paperId, timeAvailable }`. Generates time-budgeted study schedule.
- `POST /api/v1/ai/topic-analysis` ([L589-L602](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/routes/index.js#L589-L602)) — Authenticated. Body: `{ paperId }`. Evaluates topic difficulty and exam recurrence.
- `GET /api/v1/ai/copilot/profile` ([L607-L625](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/routes/index.js#L607-L625)) — Authenticated. Returns user's copilot study history.
- `POST /api/v1/ai/copilot/track-progress` ([L630-L660](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/routes/index.js#L630-L660)) — Authenticated. Body: `{ paperId, topic }`. Logs studied papers and completed topics.
- `POST /api/v1/ai/copilot/quiz-score` ([L665-L697](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/routes/index.js#L665-L697)) — Authenticated. Body: `{ paperId, score, totalQuestions }`. Logs quiz performance.
- `GET /api/v1/ai/copilot/recommendations` ([L702-L737](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/routes/index.js#L702-L737)) — Authenticated. Generates paper recommendations based on study profile.
- `GET /api/v1/ai/copilot/dashboard` ([L742-L781](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/routes/index.js#L742-L781)) — Authenticated. Aggregates quiz averages, study streaks, and subject completion percentages.
- `POST /api/v1/ai/feedback` ([L785-L810](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/routes/index.js#L785-L810)) — Authenticated. Body: `{ conversationId, score: 1 | -1, comment }`. Logs AI response quality feedback.
- `GET /api/v1/ai/study-knowledge` ([L851-L869](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/routes/index.js#L851-L869)) — Authenticated. Query: `subject`, `semester`, `university`. Lists indexed chunks without embeddings.
- `GET /api/v1/ai/study-knowledge/search` ([L872-L893](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/routes/index.js#L872-L893)) — Authenticated. Query: `q`, `subject`, `semester`, `university`. Regex search on chunk text.
- `GET /api/v1/ai/study-knowledge/:id` ([L918-L934](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/routes/index.js#L918-L934)) — Authenticated. Fetches single chunk metadata.
- `POST /api/v1/ai/reindex` or `/study-knowledge/rebuild` ([L488-L502](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/routes/index.js#L488-L502), [L897-L915](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/routes/index.js#L897-L915)) — Admin only (`verifyAdmin`). Triggers full vector rebuild across all approved papers.
- `GET /api/v1/ai/models` ([L1032-L1056](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/routes/index.js#L1032-L1056)) — Authenticated. Reports active model, Ollama health, and availability of `mistral`, `llama3`, and `phi3`.
- `POST /api/v1/ai/models/switch` ([L1059-L1077](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/routes/index.js#L1059-L1077)) — Admin only. Body: `{ model }`. Switches active LLM model.

---

## 5. Database Models & Schema Specifications

### 5.1 `User` Schema
- **File**: [`server/models/User.js`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/models/User.js) (duplicated in `ai/models/User.js`)
- **Fields**:
  - `name`: String, required, trim, 3-50 chars ([L5-L11](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/models/User.js#L5-L11)).
  - `email`: String, required, lowercase, trim, unique, indexed ([L13-L21](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/models/User.js#L13-L21)).
  - `password`: String, required, min 6 chars, `select: false` ([L23-L28](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/models/User.js#L23-L28)).
  - `refreshToken`: String, default `null`, `select: false` ([L29-L33](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/models/User.js#L29-L33)).
  - `role`: String, enum `["user", "admin"]`, default `"user"`, indexed ([L34-L39](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/models/User.js#L34-L39)).
  - `bookmarks`: Array of ObjectId referencing `Paper`, default `[]` ([L41-L49](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/models/User.js#L41-L49)).
  - `coins`: Number, default `50`, min `0` ([L50-L54](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/models/User.js#L50-L54)).
  - `badges`: Array of String, default `[]` ([L55-L58](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/models/User.js#L55-L58)).
  - `rank`: String, default `"Beginner"` ([L59-L62](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/models/User.js#L59-L62)).
  - `lastActiveDate`: String (YYYY-MM-DD), default `""` ([L63-L66](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/models/User.js#L63-L66)).
  - `dailyStreak`: Number, default `0` ([L67-L70](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/models/User.js#L67-L70)).
  - `totalUploads`: Number, default `0` ([L71-L74](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/models/User.js#L71-L74)).
  - `approvedUploads`: Number, default `0` ([L75-L78](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/models/User.js#L75-L78)).
  - `previewedPapers`: Array of ObjectId referencing `Paper` ([L80-L88](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/models/User.js#L80-L88)).
  - `downloadedPapers`: Array of ObjectId referencing `Paper` ([L90-L98](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/models/User.js#L90-L98)).
- **Indexes**: Compound index `{ coins: -1, approvedUploads: -1, totalUploads: -1 }`, and `{ createdAt: -1 }` ([L143-L144](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/models/User.js#L143-L144)).

### 5.2 `Paper` Schema
- **File**: [`server/models/Paper.js`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/models/Paper.js) (duplicated in `ai/models/Paper.js`)
- **Fields**:
  - `title`: String, required, trim, max 200 chars, indexed ([L7-L13](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/models/Paper.js#L7-L13)).
  - `subject`: String, required, enum `["Data Structure", "Operating System", "DBMS", "Computer Network", "Software Engineering", "Artificial Intelligence"]`, indexed ([L15-L27](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/models/Paper.js#L15-L27)).
  - `semester`: Number, required, min 1, max 8, indexed ([L29-L35](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/models/Paper.js#L29-L35)).
  - `pdfLink`: String, required, URL regex validated ([L37-L42](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/models/Paper.js#L37-L42)).
  - `uploadedBy`: ObjectId referencing `User`, required, indexed ([L44-L49](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/models/Paper.js#L44-L49)).
  - `status`: String, enum `["draft", "pending", "approved"]`, default `"pending"`, indexed ([L53-L58](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/models/Paper.js#L53-L58)).
  - `viewedBy`: Array of ObjectId referencing `User` ([L62-L70](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/models/Paper.js#L62-L70)).
  - `views`: Number, default `0`, min `0` ([L72-L76](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/models/Paper.js#L72-L76)).
  - `downloads`: Number, default `0`, min `0` ([L78-L82](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/models/Paper.js#L78-L82)).
  - `ratings`: Array of `{ user: ObjectId, value: Number (1-5) }` ([L86-L103](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/models/Paper.js#L86-L103)).
  - `comments`: Array of `{ user: ObjectId, text: String (max 500), createdAt: Date }` ([L106-L126](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/models/Paper.js#L106-L126)).
  - `isActive`: Boolean, default `true`, indexed ([L129-L133](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/models/Paper.js#L129-L133)).
  - `reviewedBy`: ObjectId referencing `User`, default `null` ([L136-L140](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/models/Paper.js#L136-L140)).
  - `aiStatus`: String, enum `["pending", "processing", "completed", "failed"]`, default `"pending"`, indexed ([L143-L148](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/models/Paper.js#L143-L148)).
  - `chunkCount`: Number, default `0` ([L149-L152](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/models/Paper.js#L149-L152)).
  - `indexedAt`: Date, default `null` ([L153-L156](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/models/Paper.js#L153-L156)).
  - `embeddingVersion`: String, default `null` ([L157-L160](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/models/Paper.js#L157-L160)).
- **Unique Constraint**: Compound unique index `{ title: 1, subject: 1, semester: 1 }` prevents exact duplicates ([L184](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/models/Paper.js#L184)).
- **Text Index**: Text index on `{ title: "text", subject: "text" }` ([L172](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/models/Paper.js#L172)).
- **Virtuals**: `averageRating` ([L214-L220](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/models/Paper.js#L214-L220)) and `popularityScore` (`views + downloads * 2 + averageRating * 10`) ([L206-L210](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/models/Paper.js#L206-L210)).

### 5.3 `Transaction` Schema
- **File**: [`server/models/Transaction.js`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/models/Transaction.js)
- **Fields**:
  - `user`: ObjectId referencing `User`, required, indexed ([L4-L9](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/models/Transaction.js#L4-L9)).
  - `amount`: Number, required ([L10-L13](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/models/Transaction.js#L10-L13)).
  - `type`: String, enum `["earned", "spent", "purchased", "refund", "bonus"]`, required ([L14-L18](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/models/Transaction.js#L14-L18)).
  - `reason`: String, required ([L19-L22](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/models/Transaction.js#L19-L22)).
  - `paperId`: ObjectId referencing `Paper` ([L23-L26](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/models/Transaction.js#L23-L26)).
  - `paperTitle`: String ([L27-L29](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/models/Transaction.js#L27-L29)).
  - `createdAt`: Date, default `Date.now` ([L30-L33](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/models/Transaction.js#L30-L33)).
- **Index**: Compound `{ user: 1, createdAt: -1 }` ([L36](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/models/Transaction.js#L36)).

### 5.4 `Activity` Schema
- **File**: [`server/models/Activity.js`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/models/Activity.js)
- **Fields**:
  - `user`: ObjectId referencing `User`, required ([L4-L8](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/models/Activity.js#L4-L8)).
  - `actionType`: String, enum `["upload", "rank_up", "badge_earned", "milestone"]`, required ([L9-L13](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/models/Activity.js#L9-L13)).
  - `description`: String, required ([L14-L17](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/models/Activity.js#L14-L17)). *(Note: Discrepancy with README which claimed `details`)*.
  - `targetId`: ObjectId ([L18-L20](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/models/Activity.js#L18-L20)).
  - `targetModel`: String, enum `["Paper", "User"]` ([L21-L24](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/models/Activity.js#L21-L24)).
  - `createdAt`: Date, default `Date.now`, with TTL `expires: 2592000` (auto-deletes after 30 days) ([L25-L29](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/models/Activity.js#L25-L29)).

### 5.5 `Payment` Schema
- **File**: [`server/models/Payment.js`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/models/Payment.js)
- **Fields**:
  - `user`: ObjectId referencing `User`, required, indexed ([L5-L10](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/models/Payment.js#L5-L10)).
  - `orderId`: String, required, unique, indexed ([L12-L17](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/models/Payment.js#L12-L17)).
  - `paymentId`: String, unique, sparse, indexed ([L19-L24](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/models/Payment.js#L19-L24)).
  - `signature`: String, default `""` ([L26-L29](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/models/Payment.js#L26-L29)).
  - `packageId`: String, required ([L31-L34](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/models/Payment.js#L31-L34)).
  - `packageName`: String, required ([L36-L39](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/models/Payment.js#L36-L39)).
  - `amount`: Number, required ([L41-L44](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/models/Payment.js#L41-L44)).
  - `coins`: Number, required ([L46-L49](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/models/Payment.js#L46-L49)).
  - `currency`: String, default `"INR"` ([L51-L54](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/models/Payment.js#L51-L54)).
  - `provider`: String, default `"razorpay"` ([L56-L59](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/models/Payment.js#L56-L59)).
  - `status`: String, enum `["created", "pending", "captured", "failed", "cancelled", "refunded"]`, default `"created"` ([L61-L72](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/models/Payment.js#L61-L72)).
  - `metadata`: Object, default `{}` ([L74-L77](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/models/Payment.js#L74-L77)).

### 5.6 `PlatformKnowledge` Schema
- **File**: [`server/models/PlatformKnowledge.js`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/models/PlatformKnowledge.js) (duplicated in `ai/models/PlatformKnowledge.js`)
- **Fields**:
  - `title`: String, required, trim ([L5-L9](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/models/PlatformKnowledge.js#L5-L9)).
  - `category`: String, required, trim ([L10-L14](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/models/PlatformKnowledge.js#L10-L14)).
  - `keywords`: Array of String, default `[]` ([L15-L18](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/models/PlatformKnowledge.js#L15-L18)).
  - `content`: String, required ([L19-L22](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/models/PlatformKnowledge.js#L19-L22)).
  - `status`: String, enum `["draft", "published", "archived"]`, default `"draft"` ([L23-L27](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/models/PlatformKnowledge.js#L23-L27)).
  - `version`: Number, default `1` ([L28-L31](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/models/PlatformKnowledge.js#L28-L31)).
  - `updatedBy`: ObjectId referencing `User`, required ([L32-L36](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/models/PlatformKnowledge.js#L32-L36)).

### 5.7 `AIChatChunk` Schema
- **File**: [`ai/models/AIChatChunk.js`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/models/AIChatChunk.js)
- **Fields**:
  - `paperId`: ObjectId referencing `Paper`, required ([L5](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/models/AIChatChunk.js#L5)).
  - `chunkId`: String, required, unique ([L6](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/models/AIChatChunk.js#L6)).
  - `pageNumber`: Number, required ([L7](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/models/AIChatChunk.js#L7)).
  - `subject`: String, required ([L8](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/models/AIChatChunk.js#L8)).
  - `semester`: Number, required ([L9](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/models/AIChatChunk.js#L9)).
  - `university`: String, default `"Default University"` ([L10](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/models/AIChatChunk.js#L10)).
  - `chunkText`: String, required ([L11](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/models/AIChatChunk.js#L11)).
  - `position`: Number, required ([L12](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/models/AIChatChunk.js#L12)).
  - `metadata`: Map of String ([L13](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/models/AIChatChunk.js#L13)).
  - `embedding`: Array of Number ([L14](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/models/AIChatChunk.js#L14)).
  - `embeddingVersion`: String, default `"v1"` ([L15](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/models/AIChatChunk.js#L15)).
- **Indexes**: `{ paperId: 1 }` and `{ chunkId: 1 }` ([L20-L21](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/models/AIChatChunk.js#L20-L21)).

### 5.8 `AIChatSession` Schema
- **File**: [`ai/models/AIChatSession.js`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/models/AIChatSession.js)
- **Fields**:
  - `user`: ObjectId referencing `User`, required ([L5](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/models/AIChatSession.js#L5)).
  - `domain`: String, enum `["platform", "study"]`, required ([L6](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/models/AIChatSession.js#L6)).
  - `paper`: ObjectId referencing `Paper`, optional ([L7](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/models/AIChatSession.js#L7)).
  - `title`: String, default `"New Conversation"` ([L8](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/models/AIChatSession.js#L8)).
  - `messages`: Array of subdocuments: `{ sender: "user" | "assistant", content: String, createdAt: Date, citations: [{ chunkId, pageNumber, textSnippet }] }` ([L9-L22](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/models/AIChatSession.js#L9-L22)).
- **TTL Index**: `{ updatedAt: 1 }` with `expireAfterSeconds: SESSION_TTL_SECONDS` (default 30 days) ([L28-L29](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/models/AIChatSession.js#L28-L29)).

### 5.9 `AICopilotProfile` Schema
- **File**: [`ai/models/AICopilotProfile.js`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/models/AICopilotProfile.js)
- **Fields**:
  - `user`: ObjectId referencing `User`, required, unique ([L5](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/models/AICopilotProfile.js#L5)).
  - `studiedPapers`: Array of ObjectId referencing `Paper` ([L6](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/models/AICopilotProfile.js#L6)).
  - `completedTopics`: Array of String ([L7](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/models/AICopilotProfile.js#L7)).
  - `quizHistory`: Array of `{ paperId: ObjectId, score: Number, totalQuestions: Number, createdAt: Date }` ([L8-L15](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/models/AICopilotProfile.js#L8-L15)).
  - `studyStreak`: Number, default `0` ([L16](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/models/AICopilotProfile.js#L16)).

### 5.10 `AIFeedback` Schema
- **File**: [`ai/models/AIFeedback.js`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/models/AIFeedback.js)
- **Fields**:
  - `user`: ObjectId referencing `User`, required ([L5](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/models/AIFeedback.js#L5)).
  - `conversationId`: ObjectId referencing `AIChatSession`, optional ([L6](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/models/AIFeedback.js#L6)).
  - `score`: Number, required (1 for thumbs up, -1 for thumbs down) ([L7](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/models/AIFeedback.js#L7)).
  - `comment`: String ([L8](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/models/AIFeedback.js#L8)).

---

## 6. Authentication & Session Lifecycle

### Architecture
- **Dual-Token System**:
  - **Access Token**: Short-lived (15 minutes). Signed with `JWT_SECRET`. Payload contains `{ id, role, email }` ([`server/routes/auth.js`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/routes/auth.js#L140-L148)). Delivered in the JSON response body.
  - **Refresh Token**: Long-lived (7 days). Signed with distinct `JWT_REFRESH_SECRET`. Payload contains `{ id, tokenType: "refresh" }` ([`server/routes/auth.js`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/routes/auth.js#L150-L159)). Stored as a hashed/raw string in `User.refreshToken` and sent as an HttpOnly cookie (`sameSite: "strict"`, `secure: process.env.NODE_ENV === "production"`).
- **Client Storage & State**:
  - The client stores the `accessToken` and user object in browser `localStorage` ([`client/src/context/AuthContext.jsx`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/client/src/context/AuthContext.jsx#L45-L48)).
  - The Axios request interceptor attaches `Authorization: Bearer <accessToken>` to every outgoing request ([`client/src/api/axios.js`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/client/src/api/axios.js#L17-L33)).
- **Silent Refresh Flow**:
  - When an API call returns `401 Unauthorized`, the Axios response interceptor catches it, sets `_retry = true`, and issues a `POST /auth/refresh` with `withCredentials: true` ([`client/src/api/axios.js`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/client/src/api/axios.js#L51-L79)).
  - On success, the new access token is persisted to `localStorage`, the authorization header is updated, and the failed request is re-executed.
  - On failure, `localStorage` is cleared and the browser redirects to `/login`.
- **Manual Cookie Parser**:
  - [`server/server.js`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/server.js#L63-L75) implements a custom string splitter middleware instead of `cookie-parser` to parse cookies into `req.cookies`.

---

## 7. Coin & Payment Lifecycle

### Virtual Economy Rules
- **Initial Grant**: 50 coins upon registration (`User.coins` default: 50).
- **Earning Coins**: +30 coins when an uploaded paper is approved by an admin ([`server/routes/paper.js`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/routes/paper.js#L307)).
- **Spending Coins**:
  - **Preview Paper**: 10 coins ([`server/routes/paper.js`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/routes/paper.js#L626)). Free for paper owner, admin, or previously unlocked users.
  - **Download Paper**: 40 coins (or 30 coins if previously previewed) ([`server/routes/paper.js`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/routes/paper.js#L697)). Free for owner, admin, or previously downloaded users.
- **Atomic Deduction Protection**:
  [`server/utils/coinManager.js`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/utils/coinManager.js#L35-L43) uses `User.findOneAndUpdate({ _id: user._id, coins: { $gte: amount } }, { $inc: { coins: -amount } }, { new: true })`. If the user does not have sufficient balance, the query returns `null` and throws `"Insufficient coins"`.

### Razorpay Integration vs. Mock Purchase Route
1. **Coin Packages**: Defined in [`server/config/coinpackages.js`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/config/coinpackages.js):
   - Starter: 100 coins for ₹29.
   - Popular: 250 coins for ₹59.
   - Premium: 500 coins for ₹99.
2. **Production Gateway Flow**:
   - Client calls `POST /api/v1/payment/create-order` with `{ packageId }` ([`server/routes/payment.routes.js`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/routes/payment.routes.js#L16-L77)).
   - Backend calls Razorpay SDK `razorpay.orders.create({ amount: price * 100, currency: "INR" })` and saves a `Payment` document with status `"created"`.
   - The browser opens the Razorpay modal (`window.Razorpay`). Upon completion, the client invokes `POST /api/v1/payment/verify` ([`server/routes/payment.routes.js`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/routes/payment.routes.js#L82-L142)).
   - **Crucial Architecture Detail**: `POST /verify` verifies HMAC SHA256 signature (`orderId|paymentId`) but **does not** credit coins!
   - Coins are **only credited** by the webhook handler `POST /api/v1/payment/webhook` on `event === "payment.captured"` ([`server/routes/payment.routes.js`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/routes/payment.routes.js#L195-L223)), which calls `purchaseCoins(...)`.
   - In [`client/src/pages/Wallet.jsx`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/client/src/pages/Wallet.jsx#L60-L75), after calling `verifyPayment`, the frontend waits 2.5 seconds (`setTimeout`) before re-fetching wallet balance to allow the webhook to finish processing.
3. **Bypass / Mock Route**:
   - `POST /api/v1/coins/purchase` ([`server/routes/coin.js`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/routes/coin.js#L28-L78)) allows any authenticated user to directly call `purchaseCoins(...)` without payment, granting unlimited coins.

---

## 8. PDF Access & Storage Control

### Upload Pipeline
1. Multer processes the file with Cloudinary storage adapter (`multer-storage-cloudinary`) ([`server/middleware/uploadCloudinary.js`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/middleware/uploadCloudinary.js#L6-L21)).
2. Target folder: `study-together/papers`. Resource type: `raw`. Allowed formats: `["pdf"]`. File size limit: 5MB (`5 * 1024 * 1024`).
3. Filename generator: `${crypto.randomUUID()}-${safeName}`.
4. Cloudinary returns a secure URL. `server/routes/paper.js` transforms `/image/upload/` to `/raw/upload/` ([L130](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/routes/paper.js#L130)).

### Access Control & Security Flaw
- **Intended Access Model**:
  - Unauthenticated users cannot view or download papers.
  - Previewing requires 10 coins via `POST /api/v1/papers/:id/view`.
  - Downloading requires 30/40 coins via `POST /api/v1/papers/:id/download`.
- **Actual Vulnerability**:
  - `GET /api/v1/papers` ([`server/routes/paper.js`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/routes/paper.js#L229-L235)) and `GET /api/v1/papers/:id` ([`server/routes/paper.js`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/routes/paper.js#L549-L552)) return the raw `pdfLink` property directly in the JSON response payload.
  - Because Cloudinary `raw` uploads are stored as public URLs without signed token expiry or gated CDN access, any user who loads the paper details or inspects network responses receives the full Cloudinary PDF link immediately, bypassing the coin payment gate completely.

---

## 9. AI Copilot Pipeline & Retrieval-Augmented Generation

### Ingestion Pipeline (`ai/services/ingestor.js`)
1. **Trigger**: When an admin approves a paper, [`server/routes/paper.js`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/routes/paper.js#L313-L318) sends an asynchronous HTTP POST to `http://localhost:5001/api/v1/internal/ai/process` with `{ paperId }`.
2. **Download**: [`ai/services/ingestor.js`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/services/ingestor.js#L67-L74) downloads the PDF buffer from the Cloudinary URL.
3. **Text Extraction**: Uses `pdf-parse` with a `pagerender` hook to extract text page-by-page ([L81-L109](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/services/ingestor.js#L81-L109)).
4. **OCR Fallback**: If extracted text is fewer than 100 characters, it falls back to `tesseract.js` + `pdf-img-convert` ([L161-L226](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/services/ingestor.js#L161-L226)). Pages are converted to PNG images and recognized using Tesseract (English).
5. **Chunking**: Splits pages into overlapping word chunks. Parameters:
   - Chunk size: `PDF_CHUNK_SIZE_WORDS` (default: 120 words).
   - Overlap: `PDF_CHUNK_OVERLAP_WORDS` (default: 20 words).
6. **Embeddings**: Calls local Ollama `/api/embed` (or legacy `/api/embeddings`) using `nomic-embed-text` ([`ai/services/vectorSearch.js`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/services/vectorSearch.js#L51-L121)). If Ollama is unreachable, it falls back to a deterministic local char-hash embedding generator ([L23-L48](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/services/vectorSearch.js#L23-L48)).
7. **Storage**: Chunks are saved to the `AIChatChunk` collection, and the paper's `aiStatus` is updated to `"completed"`.

### Hybrid Retrieval & Ranking (`ai/services/vectorSearch.js`)
When querying study context:
1. Generates query vector embedding.
2. Filters candidate chunks in MongoDB by `paperId`, `subject`, and `semester`.
3. Computes **Semantic Cosine Similarity** (`semanticScore`, [0-1]).
4. Computes **BM25 Keyword Score** (`keywordScore`, [0-1]) using tokenized term frequency and document frequency ([L124-L203](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/services/vectorSearch.js#L124-L203)).
5. Blends scores using configurable weights:
   `score = (semanticScore * SEMANTIC_WEIGHT) + (keywordScore * BM25_WEIGHT)`
   Defaults: `SEMANTIC_WEIGHT = 0.6`, `BM25_WEIGHT = 0.4`.
6. Returns top-K scored chunks with page numbers and text snippets.

### Generation & Prompt Defense (`ai/services/promptManager.js`)
- **Prompt Injection Defense**: [`detectPromptInjection`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/services/promptManager.js#L35-L49) scans inputs for patterns like `"ignore previous instructions"`, `"system override"`, `"developer mode"`, and throws 403 on detection.
- **Output Sanitization**: [`sanitizeOutput`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/services/promptManager.js#L52-L62) strips `<script>`, `<iframe>`, `<object>`, `<embed>`, inline event handlers (`onload`, `onerror`), and `javascript:` URIs from generated responses.
- **Streaming**: [`queryOllamaStream`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/services/ollamaService.js#L47-L99) pipes Ollama tokens to the client using Server-Sent Events (`res.write("data: ...")`).

---

## 10. Environment Variables Inventory

*(Exact variable names only — values are omitted in compliance with security guidelines)*

### Main Backend Server (`server/.env`)
| Variable Name | Purpose / Consumer | Verified Location |
| :--- | :--- | :--- |
| `PORT` | Server listening port (default: 5000) | [`server/server.js#L232`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/server.js#L232) |
| `MONGODB_URI` | MongoDB connection string | [`server/server.js#L28`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/server.js#L28) |
| `JWT_SECRET` | Secret key for 15m access token signing & verification | [`server/server.js#L33`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/server.js#L33), [`server/middleware/authMiddleware.js#L8`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/middleware/authMiddleware.js#L8) |
| `JWT_REFRESH_SECRET` | Secret key for 7d refresh token signing & verification | [`server/server.js#L38`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/server.js#L38), [`server/routes/auth.js#L156`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/routes/auth.js#L156) |
| `CLIENT_URL` | Allowed origin for CORS | [`server/server.js#L51`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/server.js#L51) |
| `CLOUD_NAME` | Cloudinary account cloud name | [`server/config/cloudinary.js#L12`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/config/cloudinary.js#L12) |
| `API_KEY` | Cloudinary API key | [`server/config/cloudinary.js#L13`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/config/cloudinary.js#L13) |
| `API_SECRET` | Cloudinary API secret | [`server/config/cloudinary.js#L14`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/config/cloudinary.js#L14) |
| `RAZORPAY_KEY_ID` | Razorpay key identifier | [`server/config/razorpay.js#L4`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/config/razorpay.js#L4), [`server/routes/payment.routes.js#L67`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/routes/payment.routes.js#L67) |
| `RAZORPAY_KEY_SECRET` | Razorpay key secret for HMAC signature verification | [`server/config/razorpay.js#L5`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/config/razorpay.js#L5), [`server/routes/payment.routes.js#L92`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/routes/payment.routes.js#L92) |
| `RAZORPAY_WEBHOOK_SECRET` | Secret for verifying Razorpay webhook signature | [`server/routes/payment.routes.js#L181`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/routes/payment.routes.js#L181) |
| `AI_SERVICE_URL` | HTTP endpoint for AI microservice (default: `http://localhost:5001`) | [`server/routes/paper.js#L18`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/routes/paper.js#L18) |
| `NODE_ENV` | Environment identifier (`development` vs `production`) | [`server/server.js#L132`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/server.js#L132) |

### AI Microservice (`ai/.env`)
| Variable Name | Purpose / Consumer | Verified Location |
| :--- | :--- | :--- |
| `AI_PORT` | AI listening port (default: 5001) | [`ai/server.js#L16`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/server.js#L16) |
| `MONGODB_URI` | MongoDB connection string | [`ai/server.js#L95`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/server.js#L95) |
| `JWT_SECRET` | Secret key for verifying user tokens in AI middleware | [`ai/middleware/authMiddleware.js#L8`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/middleware/authMiddleware.js#L8) |
| `CORS_ORIGIN` | Allowed CORS origin (default: `http://localhost:5173`) | [`ai/server.js#L22`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/server.js#L22) |
| `AI_PROVIDER` | AI provider type (`ollama` or `disabled`) | [`ai/routes/index.js#L48`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/routes/index.js#L48), [`ai/services/providers.js#L149`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/services/providers.js#L149) |
| `LLM_PROVIDER` | LLM backend (`ollama` or `gemini`) | [`ai/services/index.js#L43`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/services/index.js#L43) |
| `GEMINI_API_KEY` | Optional Gemini API key if using Gemini provider | [`ai/services/index.js#L61`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/services/index.js#L61) |
| `OLLAMA_URL` | Endpoint for Ollama service (default: `http://localhost:11434`) | [`ai/services/modelManager.js#L38`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/services/modelManager.js#L38), [`ai/services/vectorSearch.js#L56`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/services/vectorSearch.js#L56) |
| `OLLAMA_HOST` | Host URL for Ollama queries in providers | [`ai/services/providers.js#L95`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/services/providers.js#L95) |
| `OLLAMA_MODEL` | Active generation model (default: `mistral`) | [`ai/services/modelManager.js#L1`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/services/modelManager.js#L1), [`ai/services/providers.js#L96`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/services/providers.js#L96) |
| `EMBEDDING_MODEL` | Vector embedding model name (default: `nomic-embed-text`) | [`ai/services/vectorSearch.js#L57`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/services/vectorSearch.js#L57) |
| `PDF_CHUNK_SIZE_WORDS` | Max word count per chunk (default: 120) | [`ai/services/ingestor.js#L8`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/services/ingestor.js#L8) |
| `PDF_CHUNK_OVERLAP_WORDS` | Word overlap between adjacent chunks (default: 20) | [`ai/services/ingestor.js#L10`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/services/ingestor.js#L10) |
| `SEMANTIC_WEIGHT` | Weight for cosine similarity in hybrid search (default: 0.6) | [`ai/services/vectorSearch.js#L240`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/services/vectorSearch.js#L240) |
| `BM25_WEIGHT` | Weight for BM25 score in hybrid search (default: 0.4) | [`ai/services/vectorSearch.js#L241`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/services/vectorSearch.js#L241) |
| `MAX_SESSION_MESSAGES` | Retention limit for chat messages in DB session (default: 50) | [`ai/routes/index.js#L159`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/routes/index.js#L159) |
| `SESSION_TTL_SECONDS` | TTL for chat session expiration (default: 2592000 = 30 days) | [`ai/models/AIChatSession.js#L28`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/models/AIChatSession.js#L28) |

### Frontend Client (`client/.env`)
| Variable Name | Purpose / Consumer | Verified Location |
| :--- | :--- | :--- |
| `VITE_API_URL` | Base API URL for main server (default: `http://localhost:5000/api/v1`) | [`client/src/api/axios.js#L6`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/client/src/api/axios.js#L6) |
| `VITE_AI_API_URL` | Base API URL for AI microservice (default: `http://localhost:5001/api/v1`) | [`client/src/api/aiAxios.js#L4`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/client/src/api/aiAxios.js#L4), [`client/src/pages/AIAssistant.jsx#L57`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/client/src/pages/AIAssistant.jsx#L57) |
| `VITE_API_BASE` | Alternative fallback for origin detection | [`client/src/utils/resolvePdfUrl.js#L8`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/client/src/utils/resolvePdfUrl.js#L8) |

---

## 11. Setup & Installation Instructions

### Prerequisites
- Node.js (v18.x or v20.x recommended) and npm.
- MongoDB instance (MongoDB Atlas connection string or local MongoDB on port 27017).
- Cloudinary account credentials.
- Razorpay account credentials (for live checkout testing).
- Ollama installed locally with models downloaded:
  ```bash
  ollama pull nomic-embed-text
  ollama pull mistral
  ```

### Step-by-Step Installation

#### 1. Clone Repository
```bash
git clone https://github.com/SwarnenduMani22/FINAL_YEAR.git
cd StudyTogether
```

#### 2. Install Root Dependencies
```bash
npm install
```

#### 3. Configure & Install Backend (`server`)
```bash
cd server
npm install
# Create server/.env and configure all variables listed in Section 10
```

#### 4. Configure & Install AI Microservice (`ai`)
```bash
cd ../ai
npm install
# Create ai/.env and configure all variables listed in Section 10
```

#### 5. Configure & Install Frontend (`client`)
```bash
cd ../client
npm install
# Create client/.env with:
# VITE_API_URL=http://localhost:5000/api/v1
# VITE_AI_API_URL=http://localhost:5001/api/v1
```

### Running the Services
Because root `package.json` only runs `server` and `client`, start all three processes in separate terminal sessions or update the root dev script:

- **Terminal 1 (Backend Server - Port 5000)**:
  ```bash
  cd server && npm run dev
  ```
- **Terminal 2 (AI Microservice - Port 5001)**:
  ```bash
  cd ai && npm run dev
  ```
- **Terminal 3 (Vite Client - Port 5173)**:
  ```bash
  cd client && npm run dev
  ```
- **Terminal 4 (Local Ollama LLM)**:
  ```bash
  ollama serve
  ```

---

## 12. Tests & Quality Assurance

- **Current Status**: **NO automated unit, integration, or end-to-end tests exist** anywhere in the repository.
- **Verification**:
  - `package.json` contains no `"test"` script ([`package.json`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/package.json)).
  - `server/package.json` contains no `"test"` script ([`server/package.json`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/package.json#L6-L9)).
  - `ai/package.json` contains no `"test"` script ([`ai/package.json`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/package.json#L6-L9)).
  - `client/package.json` contains only an ESLint script: `"lint": "eslint ."` ([`client/package.json`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/client/package.json#L9)).
  - No test directories (`test/`, `tests/`, `__tests__/`) or test files (`*.test.js`, `*.spec.js`) exist on disk.

---

## 13. Security Audit Findings & Vulnerabilities

### High & Critical Severity

#### 1. Plaintext Logging of Cloudinary Secret
- **Location**: [`server/config/cloudinary.js#L9`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/config/cloudinary.js#L9)
- **Vulnerability**: `console.log("API_SECRET:", process.env.API_SECRET);` executes at server startup, leaking the production Cloudinary API secret to standard output and log files.

#### 2. Free Coin Credit Backdoor / Mock Route Left in Production
- **Location**: [`server/routes/coin.js#L28-L78`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/routes/coin.js#L28-L78)
- **Vulnerability**: `POST /api/v1/coins/purchase` is labeled `"PURCHASE COINS (FAKE PAYMENT FOR NOW)"`. Any authenticated user can issue a POST request with `{ packageId: "premium" }` and receive 500 coins instantly without paying.

#### 3. Raw PDF Cloudinary URL Leaked in List and Single Metadata Responses
- **Location**: [`server/routes/paper.js#L229-L235`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/routes/paper.js#L229-L235) & [`server/routes/paper.js#L549-L552`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/routes/paper.js#L549-L552)
- **Vulnerability**: `GET /api/v1/papers` and `GET /api/v1/papers/:id` return `pdfLink` directly in the unauthenticated/general JSON payload. Because Cloudinary raw files are publicly accessible over HTTPS without token authentication, any client can access the PDF directly without spending coins via `/view` (10 coins) or `/download` (40 coins).

#### 4. ReferenceError / Unhandled Exception on Paper Deletion and Edit
- **Location**: [`server/routes/paper.js#L1092`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/routes/paper.js#L1092) and [`server/routes/paper.js#L1187`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/routes/paper.js#L1187)
- **Vulnerability**: When updating an approved paper or deleting any paper, `server/routes/paper.js` attempts to invoke `reprocessPaper(paper)` and `deletePaperKnowledge(id)`. Neither function is imported or defined in `server/routes/paper.js` (they reside in `ai/services/ingestor.js`). This throws a synchronous `ReferenceError`, causing HTTP 500 failures. On deletion, the database record is deleted before the crash, leaving state inconsistent.

### Medium Severity

#### 5. Razorpay Signature Verification Does Not Credit Coins & Webhook Body Parsing Crash
- **Location**: [`server/routes/payment.routes.js#L82-L142`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/routes/payment.routes.js#L82-L142), [`server/routes/payment.routes.js#L175-L224`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/routes/payment.routes.js#L175-L224), [`server/server.js#L58`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/server.js#L58)
- **Vulnerability**: `POST /api/v1/payment/verify` confirms HMAC signatures but does not update payment status to `captured` or credit coins. Furthermore, the webhook handler attempts HMAC verification over `req.body` after `express.json()` has parsed it into a JavaScript object, triggering a fatal `TypeError` on `crypto.update(req.body)` and a `SyntaxError` on `JSON.parse(req.body.toString())` (`"[object Object]"`). Consequently, real paying users cannot receive coins via either the synchronous verify or asynchronous webhook flows.

#### 6. Discrepancy in Client Delete Paper Endpoint
- **Location**: [`client/src/api/paper.js#L79-L85`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/client/src/api/paper.js#L79-L85)
- **Vulnerability**: `deletePaper(id)` in the frontend API calls `DELETE /papers/admin/reject/${id}` instead of `DELETE /papers/${id}`. Regular users attempting to delete their papers via this utility will be rejected with 403 Forbidden.

#### 7. Ollama Service URL Format Collision
- **Location**: [`ai/services/ollamaService.js#L4`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/services/ollamaService.js#L4) vs. [`ai/services/vectorSearch.js#L65`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/services/vectorSearch.js#L65)
- **Vulnerability**: In `ollamaService.js`, the default URL is `process.env.OLLAMA_URL || "http://localhost:11434/api/generate"`. However, `vectorSearch.js` and `modelManager.js` treat `OLLAMA_URL` as the base host (`${OLLAMA_URL}/api/embed`). Setting `OLLAMA_URL` to `http://localhost:11434` causes `ollamaService.js` to POST to the root URL instead of `/api/generate`.

---

## 14. Discrepancies & Uncertainties

### Verified Facts vs. Documentation Assumptions

1. **Architecture Separation**:
   - *README Claim*: Mentions an integrated AI Copilot with Ollama running alongside Node.js.
   - *Verified Fact*: The AI system is an independent microservice in the `ai/` folder on port 5001 with its own `package.json`, models, and routes. It is **not** started by the root `package.json` dev script.

2. **File Size Limits**:
   - *README Claim*: PDF uploads are limited to 5MB.
   - *Error Middleware Claim*: [`server/middleware/errorMiddleware.js#L17`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/middleware/errorMiddleware.js#L17) reports `File size exceeds limit (10MB)`.
   - *Verified Fact*: [`server/middleware/uploadCloudinary.js#L26`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/middleware/uploadCloudinary.js#L26) enforces `5 * 1024 * 1024` (5MB). The error middleware string is inaccurate.

3. **Activity Model Fields**:
   - *README Claim*: Schema uses `actionType: enum ["upload", "badge_earned", "rank_up", "reject", "bonus"]` and `details: String`.
   - *Verified Fact*: [`server/models/Activity.js#L10-L17`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/models/Activity.js#L10-L17) defines `actionType: enum ["upload", "rank_up", "badge_earned", "milestone"]` and `description: String`.

4. **AI Route Mounting**:
   - *README Claim*: AI routes are mounted at `/api/v1/ai` on the main server.
   - *Verified Fact*: `server/server.js` does **not** register any AI routes. Vite dev server proxies `/api/v1/ai` directly to `localhost:5001`.

### Uncertainties
- **Production Deployment Strategy**: Because Vite proxies `/api/v1/ai` in development, it is uncertain how production builds handle AI routing if client static assets are served from a CDN or reverse proxy without a matching Nginx/Ingress configuration.
- **Webhook Delivery in Development**: The Razorpay webhook secret is defined in `server/.env`, but there is no built-in tunneling (e.g. ngrok) configuration documented for local webhook receipt.

---

## 15. Audit Metadata: Files Inspected & Checks Not Performed

### Files Inspected (Total: 84 files)
- **Root Configuration & Documentation (4 files)**:
  [`package.json`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/package.json), [`README.md`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/README.md), [`.gitignore`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/.gitignore), [`server/.env.example`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/.env.example).
- **Main Backend Server (`server/`) (25 files)**:
  [`server/package.json`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/package.json), [`server/server.js`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/server.js), [`server/config/cloudinary.js`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/config/cloudinary.js), [`server/config/coinpackages.js`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/config/coinpackages.js), [`server/config/razorpay.js`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/config/razorpay.js), [`server/middleware/authMiddleware.js`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/middleware/authMiddleware.js), [`server/middleware/adminMiddleware.js`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/middleware/adminMiddleware.js), [`server/middleware/errorMiddleware.js`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/middleware/errorMiddleware.js), [`server/middleware/uploadCloudinary.js`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/middleware/uploadCloudinary.js), [`server/models/User.js`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/models/User.js), [`server/models/Paper.js`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/models/Paper.js), [`server/models/Transaction.js`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/models/Transaction.js), [`server/models/Activity.js`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/models/Activity.js), [`server/models/Payment.js`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/models/Payment.js), [`server/models/PlatformKnowledge.js`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/models/PlatformKnowledge.js), [`server/routes/auth.js`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/routes/auth.js), [`server/routes/user.js`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/routes/user.js), [`server/routes/paper.js`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/routes/paper.js), [`server/routes/admin.js`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/routes/admin.js), [`server/routes/coin.js`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/routes/coin.js), [`server/routes/payment.routes.js`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/routes/payment.routes.js), [`server/services/badgeService.js`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/services/badgeService.js), [`server/services/rankService.js`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/services/rankService.js), [`server/services/activityService.js`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/services/activityService.js), [`server/utils/coinManager.js`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/utils/coinManager.js).
- **AI Copilot Microservice (`ai/`) (21 files)**:
  [`ai/package.json`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/package.json), [`ai/server.js`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/server.js), [`ai/routes/index.js`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/routes/index.js), [`ai/models/AIChatChunk.js`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/models/AIChatChunk.js), [`ai/models/AIChatSession.js`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/models/AIChatSession.js), [`ai/models/AICopilotProfile.js`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/models/AICopilotProfile.js), [`ai/models/AIFeedback.js`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/models/AIFeedback.js), [`ai/models/Paper.js`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/models/Paper.js), [`ai/models/PlatformKnowledge.js`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/models/PlatformKnowledge.js), [`ai/middleware/authMiddleware.js`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/middleware/authMiddleware.js), [`ai/services/index.js`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/services/index.js), [`ai/services/ingestor.js`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/services/ingestor.js), [`ai/services/vectorSearch.js`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/services/vectorSearch.js), [`ai/services/modelManager.js`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/services/modelManager.js), [`ai/services/ollamaService.js`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/services/ollamaService.js), [`ai/services/providers.js`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/services/providers.js), [`ai/services/promptManager.js`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/services/promptManager.js), [`ai/services/promptTemplates.js`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/services/promptTemplates.js), [`ai/services/memoryService.js`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/services/memoryService.js), [`ai/services/learningService.js`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/ai/services/learningService.js).
- **Frontend Client (`client/`) (34 files)**:
  [`client/package.json`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/client/package.json), [`client/index.html`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/client/index.html), [`client/vite.config.js`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/client/vite.config.js), [`client/src/main.jsx`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/client/src/main.jsx), [`client/src/App.jsx`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/client/src/App.jsx), [`client/src/api/axios.js`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/client/src/api/axios.js), [`client/src/api/aiAxios.js`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/client/src/api/aiAxios.js), [`client/src/api/auth.js`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/client/src/api/auth.js), [`client/src/api/user.js`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/client/src/api/user.js), [`client/src/api/paper.js`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/client/src/api/paper.js), [`client/src/api/coinApi.js`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/client/src/api/coinApi.js), [`client/src/api/admin.js`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/client/src/api/admin.js), [`client/src/context/AuthContext.jsx`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/client/src/context/AuthContext.jsx), [`client/src/data/coinPackages.js`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/client/src/data/coinPackages.js), [`client/src/utils/resolvePdfUrl.js`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/client/src/utils/resolvePdfUrl.js), [`client/src/components/common/Navbar.jsx`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/client/src/components/common/Navbar.jsx), [`client/src/components/papers/PDFModal.jsx`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/client/src/components/papers/PDFModal.jsx), [`client/src/components/papers/PDFViewer.jsx`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/client/src/components/papers/PDFViewer.jsx), [`client/src/components/papers/PaperCard.jsx`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/client/src/components/papers/PaperCard.jsx), [`client/src/components/ai/ChatWidget.jsx`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/client/src/components/ai/ChatWidget.jsx), [`client/src/components/wallet/PurchaseModel.jsx`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/client/src/components/wallet/PurchaseModel.jsx), [`client/src/pages/Home.jsx`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/client/src/pages/Home.jsx), [`client/src/pages/Dashboard.jsx`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/client/src/pages/Dashboard.jsx), [`client/src/pages/Papers.jsx`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/client/src/pages/Papers.jsx), [`client/src/pages/PaperDetails.jsx`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/client/src/pages/PaperDetails.jsx), [`client/src/pages/UploadPaper.jsx`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/client/src/pages/UploadPaper.jsx), [`client/src/pages/MyPapers.jsx`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/client/src/pages/MyPapers.jsx), [`client/src/pages/Bookmarks.jsx`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/client/src/pages/Bookmarks.jsx), [`client/src/pages/Leaderboard.jsx`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/client/src/pages/Leaderboard.jsx), [`client/src/pages/Profile.jsx`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/client/src/pages/Profile.jsx), [`client/src/pages/PublicProfile.jsx`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/client/src/pages/PublicProfile.jsx), [`client/src/pages/Wallet.jsx`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/client/src/pages/Wallet.jsx), [`client/src/pages/Admin.jsx`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/client/src/pages/Admin.jsx), [`client/src/pages/AdminPending.jsx`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/client/src/pages/AdminPending.jsx), [`client/src/pages/AIAssistant.jsx`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/client/src/pages/AIAssistant.jsx).

### Checks Not Performed
1. **Dynamic Shell & Automated Test Execution**: Terminal process execution was not conducted due to runner environment shell path constraints and the explicit prompt requirement not to alter runtime behavior.
2. **Live Database Mutations & Connectivity Testing**: No queries or writes were executed against active MongoDB clusters.
3. **Third-Party Payment & Cloud Gateways**: No mock/live requests were dispatched to external Razorpay or Cloudinary APIs.
4. **Local Ollama Runtime Querying**: No inference calls were sent to local Ollama daemon on port 11434.
5. **Secret Decryption / `.env` Content Inspection**: Environment files containing actual secrets were not viewed or logged, preserving credential integrity.
