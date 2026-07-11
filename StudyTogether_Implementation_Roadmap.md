# StudyTogether — Enterprise Implementation Roadmap
### Authored: 2026-07-11 | Based on Full Codebase Audit | Version 2.0

---

## 1. Executive Summary

StudyTogether is a full-stack academic paper-sharing platform built on the MERN stack (MongoDB, Express, React, Node.js). It implements a gamified coin economy, role-based access control, a PDF upload-and-approval workflow, and a partially functional AI study assistant layer. The platform has a well-structured backend with meaningful security primitives (rate limiting, helmet, mongo-sanitize, JWT with refresh tokens), a modular service layer, and a React frontend using Vite and TailwindCSS.

However, the project is **not production-ready**. The AI layer is built on simulated/mocked internals (fake PDF parsing, fake embeddings, stale Gemini references), no real payment gateway is wired, the coin purchase flow is a stub, and several critical architectural issues exist. The codebase shows a clear "90% complete" pattern — infrastructure is solid, but the final 10% in every major module is either mocked or absent.

This roadmap provides an honest, ground-truth assessment of every module and a prioritized implementation plan.

---

## 2. Current Project Status

| Layer | Status | Honest Maturity |
|:---|:---|:---|
| Backend API | Mostly Complete | 82% — routes exist but some are stubs |
| Database Schemas | Complete | 95% — well designed, minor improvements needed |
| Authentication | Complete | 90% — solid JWT flow, missing email verification |
| Paper Management | Complete | 88% — solid CRUD, AI ingestion is mocked |
| Coin Economy | Partial | 70% — core economy works, payment is fake |
| Admin Panel | Complete | 85% — good controls, no audit log persistence |
| Leaderboard | Complete | 90% — functional, minor caching improvement needed |
| Bookmarks | Complete | 100% — fully functional |
| Ratings / Comments | Complete | 100% — fully functional |
| AI Layer | Partial/Mocked | 35% — infrastructure defined but core is simulated |
| File Upload / Storage | Complete | 85% — Cloudinary works, OCR is placeholder |
| Frontend Pages | Complete | 83% — pages exist, React Query not universally applied |
| Frontend Components | Partial | 75% — ChatWidget works, AI pages incomplete |
| Deployment | Not Configured | 20% — Vercel config exists for client only |
| Testing | Missing | 0% — no tests of any kind |

---

## 3. Implemented Features

The following features are genuinely implemented and operational based on direct code review:

### 3.1 Authentication (server/routes/auth.js)
- User registration with bcrypt password hashing (cost 10)
- Login returning a 15-minute JWT access token and 7-day refresh token
- Refresh token persisted in MongoDB `User.refreshToken` field
- Token refresh endpoint validates `tokenType: "refresh"` claim
- Logout clears `refreshToken` from DB and clears HttpOnly cookie
- Duplicate email handling via index (code 11000)

### 3.2 Paper Management (server/routes/paper.js)
- Upload via Cloudinary (multer-storage-cloudinary) with 5MB PDF limit
- Draft/Pending/Approved status workflow
- Max 2 pending uploads per user (non-admin gate)
- Duplicate paper detection (title + subject + semester unique index)
- Admin single-paper approve and reject with Cloudinary cleanup
- Admin bulk approve and bulk reject
- Related papers endpoint (same subject or semester)
- Trending papers via MongoDB aggregation with popularity score
- View tracking (unique per user, costs 10 coins for first-time preview)
- Download tracking (costs 40 coins, 30 if already previewed)
- 1-to-5 star rating per user per paper (update if exists)
- Comment add/delete (user owns or admin)
- Paper CRUD (edit with PDF replacement, delete with Cloudinary cleanup)
- Paper cascade cleanup on delete (deleteOne post hook removes from bookmarks, downloadedPapers, previewedPapers)
- AI knowledge ingestion triggered on paper approval (currently mocked)

### 3.3 User Management (server/routes/user.js)
- Bookmark toggle (atomic $addToSet / $pull)
- Dashboard stats (approved/pending paper counts)
- Get profile with populated bookmarks
- Public profile (name, rank, badges, coins, upload stats)
- Public profile monthly upload stats (MongoDB aggregation)
- Community activity feed (from Activity model, 20-item limit)
- My papers listing
- Profile update (name and/or password, forces re-login on password change)
- Account deletion (cascades: removes user papers, Cloudinary files, array references in other users)
- Coin overview (paginated transaction history with aggregated totals)
- Leaderboard (top 10 by coins + approvedUploads)

### 3.4 Admin Panel (server/routes/admin.js)
- Paginated user list with search
- Delete user (prevents deleting self, prevents deleting last admin)
- Change user role (prevents self-role-change)
- Dashboard stats (user counts, paper counts, views, downloads, comments, ratings)
- Top contributors (aggregate by approved papers)
- Top coin holders
- Coin analytics (system coins, purchased, spent, total transactions)
- Admin coin refund (credits user and creates Transaction record)
- Platform Knowledge CRUD (admin-managed articles for AI assistant)
- Platform Knowledge status management (draft/published/archived)

### 3.5 Coin Economy (server/routes/coin.js, server/utils/coinManager.js)
- 3 predefined coin packages (Starter 100c/Rs.29, Popular 250c/Rs.59, Premium 500c/Rs.99)
- addCoins, spendCoins, purchaseCoins utilities using atomic MongoDB $inc
- spendCoins uses findOneAndUpdate with coins: { $gte: amount } gate
- Transaction logging for all coin events (earned/spent/purchased/refund/bonus)
- Users start with 50 coins on registration

### 3.6 Badge and Rank System (server/services/badgeService.js)
- 10 automatic badges based on activity thresholds
- Daily streak tracking (increments on consecutive days)
- Rank calculation: Beginner — Explorer — Scholar — Expert — Legend
- Activity logging for rank-up and badge-earned events
- generateBadgesAndRank called on upload, approve, download, rate, comment

### 3.7 Activity System (server/models/Activity.js)
- Activity model with TTL (30-day auto-expiry)
- Action types: upload, rank_up, badge_earned, milestone
- Activity feed endpoint (public, 20 items)

### 3.8 AI Layer Infrastructure (server/services/ai/)
- Provider pattern: DisabledAIProvider, OllamaAIProvider (factory via AI_PROVIDER env)
- Ollama HTTP client with retry + exponential backoff (modelManager.js)
- Ollama streaming via SSE (ollamaService.js, queryOllamaStream)
- Model manager: getCurrentModel(), switchModel(), checkModelAvailability()
- In-memory response cache (5-minute TTL, Map-based)
- Intent detection (platform vs study keywords)
- Conversation memory (last 6 messages from session)
- Query enrichment (follow-up context injection)
- User preference personalization (rank, streak, coins)
- Platform knowledge base (static JSON in promptTemplates.js)
- Dynamic platform knowledge from PlatformKnowledge MongoDB collection
- Prompt manager with versioned templates (study/platform/general)
- RAG pipeline stub in queryStudyAssistant
- Platform assistant with keyword scoring and DB article fallback
- AI chat endpoint (non-streaming), AI chat/stream endpoint (SSE)
- Conversation history CRUD (create, list, get, delete, clear all)
- AI study tools: study notes, quiz, flashcards, exam plan, topic analysis
- AI Copilot profile: track progress, quiz scores, recommendations, analytics dashboard
- AI feedback collection (thumbs up/down)
- Admin vector rebuild endpoint
- Study knowledge chunk CRUD endpoints
- Model management endpoints (list, switch)
- ChatWidget frontend (SSE streaming, clear history, suggested questions)

### 3.9 Frontend Pages and Routes
All 15 pages implemented and lazy-loaded: Home, Login, Register, Dashboard, Profile, PublicProfile, Admin, AdminPending, Papers, PaperDetails, MyPapers, UploadPaper, Bookmarks, Leaderboard, Wallet

### 3.10 Frontend Infrastructure
- Vite + React 19 + TailwindCSS v3
- React Router v7 with protected routes (ProtectedRoute, AdminRoute)
- Global Axios interceptor with automatic token refresh on 401
- React Hot Toast for notifications
- ErrorBoundary component
- Lazy loading with Suspense for all pages
- ScrollToTop on route change
- AuthContext with localStorage persistence
- TanStack React Query v5 (installed, partially used)

---

## 4. Incomplete Features

| Feature | What Exists | What is Missing |
|:---|:---|:---|
| PDF Ingestion / OCR | ingestor.js exists with full chunking logic | Actual pdf-parse call is replaced by a hardcoded 2-line string. No real PDF text extraction. All chunks are fake. |
| Vector Embeddings | generateEmbedding() exists in vectorSearch.js | Uses a deterministic character-hash algorithm, not a real embedding model. Not semantic. BAAI/bge-small or any real model is absent. |
| FAISS | Not present anywhere | No FAISS index, no vector store file, no Python bridge |
| BM25 | Not present anywhere | Only naive keyword substring matching. No BM25 scoring. |
| Coin Purchase Payment | coin.js route with package config exists | Payment is a fake stub — no Razorpay SDK, no payment verification, no webhook. Coins are credited immediately without any real payment. |
| Email Verification | Auth route exists with validation | No email verification flow. No Nodemailer or SMTP setup. |
| Password Reset | Platform knowledge article mentions it | No /forgot-password or /reset-password API endpoint exists. |
| OCR Fallback | runOcrFallback() function exists in ingestor | Returns a hardcoded static string. No Tesseract.js integration. |
| Streaming Chat | SSE stream endpoint and ChatWidget exist | Uses searchSimilarity which is not imported in the stream handler (line 192 references searchSimilarity and getPlatformResponse without import). |
| Ollama Health in Health Route | /ai/health route exists | Still returns model: "gemini-1.5-flash" and hasApiKey checking GEMINI_API_KEY — outdated Gemini reference |
| Admin Stats (Extended) | /admin/stats exists | Does not call mongoose.connection.db.stats() or Cloudinary storage API |
| React Query Migration | TanStack Query is installed and used in Papers.jsx | Most other pages still use direct useEffect+useState for data fetching |
| Frontend AI Pages | ChatWidget is global floating widget | No dedicated AI study assistant page, no quiz UI, no flashcard UI, no exam planner UI |
| Notification System | Activity model exists | No real-time notifications, no per-user notification feed |
| Avatar / Profile Picture | Profile update endpoint exists | No avatar upload support. Only name and password can be changed. |

---

## 5. Missing Features (Not Implemented Anywhere)

| Feature | Why It Matters | Effort |
|:---|:---|:---|
| Real PDF text extraction (pdf-parse) | All AI answers are based on fake chunk text | Medium |
| Real embedding model (BAAI/bge-small-en-v1.5 via Ollama or local) | Semantic search is currently meaningless | High |
| FAISS in-memory or file-based vector index | Fast ANN search cannot happen without it | High |
| BM25 keyword scoring (wink-bm25 or similar) | Proper hybrid retrieval requires real BM25 | Medium |
| Razorpay / payment gateway integration | Coin purchases are unbacked | High |
| Email verification on registration | Anyone with any email can register | Medium |
| Password reset via email | Users cannot recover forgotten passwords | Medium |
| Nodemailer / SMTP service | Required for email-based flows | Low |
| Per-user notification feed | No way to notify users of approval events | Medium |
| Avatar upload (Cloudinary image) | Profile feels incomplete | Low |
| Winston structured logging | Morgan logs HTTP but no structured app logs | Medium |
| Admin audit log (persistent, queryable) | Activity model is too limited | Medium |
| Rate limit on AI streaming endpoint | aiLimiter may not cover streaming path | Low |
| Environment-based feature flags | No feature toggle system | Low |
| Database connection pooling config | Default Mongoose pool may not suffice at scale | Low |
| API versioning strategy | Only v1 exists — no upgrade path documented | Low |
| Health check that verifies DB + Cloudinary | Current /health only confirms server is running | Low |

---

## 6. Known Bugs

### 6.1 Critical Bugs

**BUG-001: Streaming chat route uses undeclared functions**
- File: server/routes/ai.js, lines 192 and 216
- searchSimilarity and getPlatformResponse are called but are not imported in ai.js
- Effect: Any call to POST /api/v1/ai/chat/stream will crash with ReferenceError
- Fix: Add imports from ./vectorSearch.js and ./promptTemplates.js at top of ai.js

**BUG-002: AI health endpoint returns Gemini references**
- File: server/routes/ai.js, lines 643-644
- Returns model: "gemini-1.5-flash" and checks GEMINI_API_KEY
- Effect: Misleads clients about which AI system is active

**BUG-003: Duplicate route handlers for /conversation and /conversations**
- File: server/routes/ai.js, lines 22-78
- Two identical POST handlers at /conversation (singular) and /conversations (plural)
- Effect: Code duplication, inconsistent API surface, maintenance burden

**BUG-004: Duplicate reject route**
- File: server/routes/paper.js, lines 334-355 and 1165-1232
- DELETE /admin/reject/:id is defined twice with slightly different implementations
- Effect: Second definition is dead code, causes confusion

**BUG-005: Paper upload logic logs sensitive body/file to console**
- File: server/routes/paper.js, lines 50-51
- console.log("BODY =", req.body) and console.log("FILE =", req.file) are debug statements left in production code
- Effect: Exposes upload metadata in server logs

**BUG-006: Fake coin purchase — no payment verification**
- File: server/routes/coin.js
- Coins are credited with TXN_Date.now() as transactionId without any real payment
- Effect: Anyone can call this endpoint and receive coins without paying

**BUG-007: GEMINI_API_KEY warning in server startup but feature is deprecated**
- File: server/server.js, lines 43-45
- Server warns about missing GEMINI_API_KEY but the system is supposed to use Ollama
- Effect: False alarm on startup

**BUG-008: purchase type mismatch in Transaction enum**
- File: server/models/Transaction.js — enum is ["earned", "spent", "purchased", "refund", "bonus"]
- File: server/routes/admin.js coin-analytics query: { $in: ["purchased", "purchase"] } — "purchase" is not in enum
- Effect: The "purchase" type lookup may miss records or cause type inconsistencies

### 6.2 Medium Bugs

**BUG-009: top-papers route is unreachable**
- File: server/routes/paper.js, line 1234
- Route GET /top-papers is placed AFTER router.delete("/:id") catch-all pattern
- Express will never reach it because /:id matches top-papers first
- Fix: Move /top-papers before /:id

**BUG-010: Model switch is not persistent**
- File: server/services/ai/modelManager.js
- currentModel is a module-level variable — it resets on server restart
- No persistence to DB or env. Switching model via API does nothing permanently.

**BUG-011: ChatWidget hooks rule violation**
- File: client/src/components/ai/ChatWidget.jsx, lines 6-7
- const token = localStorage.getItem(...) is called before all hooks (lines 9-14)
- Early return on line 7 (if (!token) return null) violates React rules of hooks

**BUG-012: Coins not re-synced after spendCoins in view/download**
- Files: server/routes/paper.js view/download handlers
- spendCoins updates DB atomically but response returns coins: user.coins from the in-memory object which may be out of sync

### 6.3 Low-Priority Bugs

**BUG-013: adminStats.js route file exists but is not mounted**
- File: server/routes/adminStats.js (2299 bytes)
- Not imported or registered in server.js
- Dead file

**BUG-014: scratch/ directory in server**
- File: server/scratch/ (directory exists in server folder)
- Development artifacts should not be in source-controlled production server directory

**BUG-015: Refresh token also sent in response body**
- File: server/routes/auth.js, line 177
- refreshToken is sent both in HttpOnly cookie AND in JSON response body
- Frontend stores it in localStorage — this defeats the purpose of HttpOnly cookies

---

## 7. Technical Debt

| Debt Item | Severity | Location |
|:---|:---|:---|
| Fake PDF ingestion (hardcoded text strings) | Critical | server/services/ai/ingestor.js |
| Fake vector embeddings (char-hash algorithm) | Critical | server/services/ai/vectorSearch.js |
| No BM25 implementation | High | server/services/ai/vectorSearch.js |
| No FAISS or real vector store | High | Entire AI layer |
| Fake coin payment (no gateway) | High | server/routes/coin.js |
| Gemini API remnants throughout codebase | Medium | server/server.js, server/routes/ai.js, server/services/ai/index.js |
| useEffect+useState anti-pattern on most pages | Medium | Most client pages |
| No structured logging (Winston) | Medium | Entire backend |
| No automated tests | High | Entire codebase |
| Debug console.log in production route | Medium | server/routes/paper.js |
| Hardcoded "State Tech University" in ingestor | Low | server/services/ai/ingestor.js |
| Magic numbers for coin costs scattered in routes | Low | server/routes/paper.js |
| Hardcoded subject enum (only 6 subjects) | Medium | server/models/Paper.js |
| No database connection retry logic | Medium | server/server.js |
| cookie-parser package not installed; manual parse is fragile | Medium | server/server.js |
| Vercel config only for client; no server deployment config | High | Root-level |

---

## 8. Architecture Review

### 8.1 Architecture Strengths
- Clean domain separation in components and routes
- Service layer properly separates business logic from routes
- Provider pattern in AI layer enables swappable LLM backends
- Atomic MongoDB operations prevent race conditions in coin economy
- Cascade cleanup on deletion (Mongoose post-hook in Paper.js)
- Rate limiting on sensitive endpoints
- Helmet + mongo-sanitize for basic security

### 8.2 Architecture Weaknesses
- Routes are too large (paper.js is 1258 lines — should be split into controllers)
- No controller layer — all business logic is inline in route handlers
- AuthContext uses localStorage for token storage (XSS risk for access token)
- Coin costs are magic numbers scattered in paper.js
- AI layer has circular dependency risk (index.js imports from vectorSearch, learningService imports from index.js)
- Missing a shared constants/config module for business rules
- No environment-based feature flags

### 8.3 Recommended Architecture Improvements
- Extract route handlers into a controllers/ layer
- Create a constants/ module for coin costs, rank thresholds, badge definitions
- Move token from localStorage to memory (access token) + HttpOnly cookie (refresh token)
- Create a repositories/ or dao/ layer for complex MongoDB queries
- Split paper.js into: paperCrud.js, paperAdmin.js, paperInteraction.js

---

## 9. Security Review

| Issue | Severity | Status |
|:---|:---|:---|
| JWT access token in localStorage (XSS-vulnerable) | High | Present |
| Refresh token in both HttpOnly cookie AND localStorage | High | Present (BUG-015) |
| No email verification on registration | Medium | Missing |
| No rate limit on AI streaming endpoint | Medium | Missing |
| No CSRF protection | Medium | Missing |
| Debug logs expose request body in production | Medium | Present (BUG-005) |
| MongoDB credentials in .env committed to repo | Critical | Present in .env |
| Cloudinary secrets in .env committed to repo | High | Present in .env |
| JWT secrets in .env committed to repo | Critical | Present in .env |
| Password minimum is 8 chars (schema says 6, route validates 8) | Low | Inconsistency |
| mongoSanitize.sanitize() called manually (not as middleware) | Medium | Fragile pattern |

---

## 10. Performance Review

| Area | Issue | Severity |
|:---|:---|:---|
| Badge regeneration on every action | Full DB count queries (4 Paper.countDocuments calls) on every view/download/rate/comment | Medium |
| viewedBy array growth | Unbounded ObjectId array in Paper document; will grow very large for popular papers | High |
| downloadedPapers and previewedPapers unbounded arrays in User | User documents will grow indefinitely | Medium |
| Vector search loads ALL chunks for a paper | No DB-level vector filtering; loads all rows then filters in Node.js | High (when real) |
| No connection pooling configuration | Mongoose default pool may bottleneck | Medium |
| Morgan dev-mode logging in production | morgan("dev") outputs verbose colored logs unsuitable for production | Low |
| No Redis caching | In-memory Map cache resets on restart; no shared cache for multi-instance | Medium |
| populate() inside loop in bulk operations | for...of loop with await per paper in bulk approve/reject | Medium |

---

## 11. Database Review

### 11.1 Models Inventory (9 models)

| Model | Purpose | Quality |
|:---|:---|:---|
| User | Core user with coins, badges, rank, bookmarks, streak | Good — well indexed |
| Paper | Academic paper with ratings, comments, viewedBy | Good — text index, unique composite |
| Transaction | Coin transaction log | Good — indexed by user+date |
| Activity | Community activity feed | Good — TTL index (30 days) |
| AIChatSession | Chat conversation with messages embedded | Acceptable — messages array may grow |
| AIChatChunk | PDF knowledge chunks with embeddings | Good — indexed on paperId |
| AICopilotProfile | Per-user AI study tracking | Acceptable — missing studyStreak updates |
| PlatformKnowledge | Admin-managed help articles | Good |
| AIFeedback | Thumbs up/down on AI responses | Good |

### 11.2 Schema Issues
- User.lastActiveDate is stored as String — should be Date for reliable date arithmetic
- User.coinHistory referenced in toSafeObject() but field does not exist in schema (removed, referenced in stale code)
- AIChatChunk.embedding stored as [Number] in MongoDB — not efficient for vector operations at scale
- AIChatSession.messages is an embedded array — unbounded growth risk for long conversations
- Transaction.type enum missing "purchase" (only has "purchased") but query code uses both

---

## 12. Frontend Review

### 12.1 Pages Status

| Page | React Query | Assessment |
|:---|:---|:---|
| Papers.jsx | useInfiniteQuery | Best implemented page |
| PaperDetails.jsx | useEffect/useState | Needs React Query migration |
| Dashboard.jsx | useEffect/useState | Simple, acceptable |
| Profile.jsx | useEffect/useState | Needs migration |
| Bookmarks.jsx | useEffect/useState | Needs migration |
| Leaderboard.jsx | useEffect/useState | Needs migration |
| Wallet.jsx | useEffect/useState | Needs migration |
| MyPapers.jsx | useEffect/useState | Needs migration |
| Admin.jsx | useEffect/useState | Needs migration |
| AdminPending.jsx | useEffect/useState | Needs migration |
| Home.jsx | useEffect/useState | Acceptable (landing page) |

### 12.2 Component Gaps
- No dedicated AI Study page (only floating ChatWidget)
- No Quiz UI component
- No Flashcard UI component
- No Exam Planner UI component
- No AI Copilot Dashboard page
- No Notification component
- No Avatar upload in Profile
- No admin Platform Knowledge management UI

---

## 13. Backend Review

### 13.1 Route Inventory

| Route File | Lines | Quality |
|:---|:---|:---|
| auth.js | 297 | Good |
| user.js | 442 | Good |
| paper.js | 1258 | Too large — needs splitting |
| admin.js | 601 | Good structure |
| coin.js | 81 | Working but payment is stub |
| ai.js | 772 | Has bugs (undeclared imports) |
| adminStats.js | ~100 | NOT MOUNTED — dead file |

### 13.2 Service Layer Audit

| Service | Status | Notes |
|:---|:---|:---|
| badgeService.js | Working | 4 DB queries on every call — should cache |
| rankService.js | Working | Simple calculation |
| activityService.js | Working | Fire-and-forget logging |
| ai/index.js | Partial | RAG pipeline works but uses fake embeddings |
| ai/ingestor.js | Mocked | Returns hardcoded text, no real PDF parsing |
| ai/vectorSearch.js | Mocked | Char-hash embeddings, no real semantic search |
| ai/ollamaService.js | Good | Proper Ollama HTTP client with streaming |
| ai/modelManager.js | Good | Retry logic, health check |
| ai/providers.js | Good | Clean provider pattern |
| ai/promptManager.js | Good | Versioned prompt templates |
| ai/promptTemplates.js | Good | Platform knowledge base |
| ai/memoryService.js | Good | Conversation history retrieval |
| ai/learningService.js | Good | Study notes, quiz, flashcards — uses real LLM |

---

## 14. Deployment Review

| Area | Status | Notes |
|:---|:---|:---|
| Client Vercel config | Exists | client/vercel.json with SPA rewrite rule |
| Client .env | Exists | Only VITE_API_URL |
| Server deployment config | Missing | No Railway/Render/EC2 config |
| Server .env | Present but exposed | Contains real MongoDB URI, JWT secrets, Cloudinary keys |
| Docker | Missing | No Dockerfile or docker-compose |
| Process manager (PM2) | Missing | No ecosystem.config.js |
| Environment separation | Missing | No staging/prod env distinction |
| CI/CD pipeline | Missing | .github/ folder exists but no workflows defined |
| Health check endpoint | Partial | Confirms server running but not DB status |
| HTTPS/SSL | Missing | No nginx or SSL termination config |

---

## 15. AI Readiness Review

| Component | Status | Detail |
|:---|:---|:---|
| Provider abstraction | Ready | Disabled/Ollama factory pattern works |
| Ollama client | Ready | HTTP client with retry + stream support |
| Model management | Ready | Switch/health/availability endpoints exist |
| Conversation sessions | Ready | MongoDB-backed session + message history |
| Conversation memory | Ready | Last 6 messages enrichment |
| Prompt templates | Ready | Versioned system prompt framework |
| Platform knowledge base | Ready | Static + DB-backed hybrid lookup |
| PDF parsing (pdf-parse) | NOT DONE | Hardcoded fake text in ingestor |
| OCR (Tesseract) | NOT DONE | Placeholder function only |
| Real embeddings (BAAI/bge) | NOT DONE | Character-hash algorithm used instead |
| FAISS vector index | NOT DONE | Not installed or referenced |
| BM25 keyword scoring | NOT DONE | Only substring includes() used |
| Hybrid retrieval (FAISS+BM25) | NOT DONE | Conceptually present but not implemented |
| RAG pipeline (real) | NOT DONE | Uses fake chunks, answers are generic |
| Study Notes generation | Ready (needs real chunks) | LLM call exists, context is fake |
| Quiz generation | Ready (needs real chunks) | LLM call exists, context is fake |
| Flashcard generation | Ready (needs real chunks) | LLM call exists, context is fake |
| Exam plan generation | Ready (needs real chunks) | LLM call exists, context is fake |
| Topic analysis | Ready (needs real chunks) | LLM call exists, context is fake |
| AI Copilot profile | Ready | Progress tracking, quiz history, recommendations |
| AI feedback | Ready | Score + comment collection |
| Vector rebuild (admin) | Working with fake data | Rebuilds chunks but from mocked text |
| SSE streaming | Bug present | Undeclared import crash (BUG-001) |

**AI Readiness Verdict**: The architecture and service contracts are excellent. The LLM integration (Ollama) is properly wired. However, the data pipeline is entirely mocked — the AI cannot actually answer questions from real PDF content. The gap between the current state and a functional AI study assistant is: real PDF parsing + real embeddings. Everything else is already in place.

---

## 16. Implementation Priorities

### Priority 1 — Critical Bug Fixes (Do This First)

| Task ID | File | Description | Time |
|:---|:---|:---|:---|
| ~~P1-001~~ | ~~server/routes/ai.js~~ | ~~Fix missing imports for searchSimilarity and getPlatformResponse in stream handler~~ | ~~30 min~~ | ✅ COMPLETED |
| ~~P1-002~~ | ~~server/routes/ai.js~~ | ~~Fix AI health endpoint — remove Gemini references, report Ollama status~~ | ~~15 min~~ | ✅ COMPLETED |
| ~~P1-003~~ | ~~server/routes/ai.js~~ | ~~Remove duplicate route handlers (/conversation vs /conversations)~~ | ~~30 min~~ | ✅ COMPLETED |
| ~~P1-004~~ | ~~server/routes/paper.js~~ | ~~Remove console.log(req.body) and console.log(req.file) debug statements~~ | ~~5 min~~ | ✅ COMPLETED |
| ~~P1-005~~ | ~~server/routes/paper.js~~ | ~~Move GET /top-papers above GET /:id catch-all~~ | ~~5 min~~ | ✅ COMPLETED |
| ~~P1-006~~ | ~~server/routes/paper.js~~ | ~~Remove duplicate DELETE /admin/reject/:id (second definition at line 1165)~~ | ~~5 min~~ | ✅ COMPLETED |
| ~~P1-007~~ | ~~server/server.js~~ | ~~Remove GEMINI_API_KEY check from startup validation~~ | ~~5 min~~ | ✅ COMPLETED |
| ~~P1-008~~ | ~~client/src/components/ai/ChatWidget.jsx~~ | ~~Fix hooks rule violation — move early return after all hooks~~ | ~~20 min~~ | ✅ COMPLETED |
| ~~P1-009~~ | ~~server/models/Transaction.js~~ | ~~Standardize type enum — decide on "purchased" or "purchase", not both~~ | ~~30 min~~ | ✅ COMPLETED |

Dependencies: None — these are all isolated fixes.
Estimated Total Time: ~2.5 hours

### Priority 2 — Core AI Pipeline (Make AI Actually Work)

| Task ID | File | Description | Complexity | Time |
|:---|:---|:---|:---|:---|
| ~~P2-001~~ | ~~server/services/ai/ingestor.js~~ | ~~Replace hardcoded text with real pdf-parse PDF extraction~~ | ~~Medium~~ | ~~4 hrs~~ | ✅ COMPLETED |
| P2-002 | server/services/ai/ingestor.js | Implement OCR fallback with tesseract.js for scanned PDFs | High | 8 hrs |
| P2-003 | server/services/ai/vectorSearch.js | Replace char-hash embedding with Ollama embedding API (/api/embeddings) | Medium | 3 hrs |
| P2-004 | server/services/ai/vectorSearch.js | Implement real BM25 scoring using wink-bm25-text-ranker or similar | Medium | 4 hrs |
| P2-005 | server/services/ai/vectorSearch.js | Implement hybrid retrieval fusion (weighted combination of semantic + BM25 scores) | Medium | 3 hrs |
| ~~P2-006~~ | ~~server/package.json~~ | ~~Add dependencies: pdf-parse, tesseract.js, wink-bm25-text-ranker~~ | ~~Low~~ | ~~30 min~~ | ✅ COMPLETED (pdf-parse added; others deferred to P2-002/P2-004) |
| ~~P2-007~~ | ~~server/services/ai/ingestor.js~~ | ~~Support configurable chunk size and overlap for better retrieval~~ | ~~Low~~ | ~~1 hr~~ | ✅ COMPLETED (PDF_CHUNK_SIZE_WORDS + PDF_CHUNK_OVERLAP_WORDS env vars) |
| P2-008 | server/routes/ai.js | Add AI_PROVIDER env to /ai/status endpoint output | Low | 30 min |

Dependencies: Requires Ollama running locally with mistral and nomic-embed-text models pulled.
Estimated Total Time: ~24 hours

### Priority 3 — Payment Integration

| Task ID | File | Description | Complexity | Time |
|:---|:---|:---|:---|:---|
| P3-001 | server/routes/coin.js | Integrate Razorpay SDK (or any real payment gateway) | Medium | 3 hrs |
| P3-002 | server/routes/coin.js | Add order creation endpoint (POST /coins/create-order) | Medium | 2 hrs |
| P3-003 | server/routes/coin.js | Add webhook handler for payment verification | Medium | 4 hrs |
| P3-004 | server/routes/coin.js | Only credit coins after cryptographically verified payment | Low | 1 hr |
| P3-005 | client/src/pages/Wallet.jsx | Wire Razorpay checkout SDK to frontend | Medium | 4 hrs |

Dependencies: Razorpay account + test API keys.
Estimated Total Time: ~14 hours

### Priority 4 — Architecture and Quality

| Task ID | File | Description | Complexity | Time |
|:---|:---|:---|:---|:---|
| P4-001 | server/routes/paper.js | Split into paperCrud.js, paperAdmin.js, paperInteraction.js with controllers | High | 6 hrs |
| P4-002 | server/ | Add Winston structured logger with log levels and file rotation | Medium | 3 hrs |
| P4-003 | server/config/constants.js | Extract coin costs, rank thresholds, badge definitions into a constants file | Low | 2 hrs |
| P4-004 | client/src/pages/*.jsx | Migrate all pages from useEffect/useState to TanStack React Query | High | 12 hrs |
| P4-005 | server/models/User.js | Change lastActiveDate from String to Date type | Low | 1 hr |
| P4-006 | client/src/api/axios.js | Store access token in memory only, rely on HttpOnly cookie for refresh | Medium | 4 hrs |
| P4-007 | server/ | Add email verification flow with Nodemailer | High | 8 hrs |
| P4-008 | server/routes/auth.js | Add /forgot-password and /reset-password endpoints | Medium | 4 hrs |
| P4-009 | client/src/pages/ | Build dedicated AI Study page with quiz, flashcard, and exam planner UI | High | 12 hrs |
| P4-010 | server/ + client/ | Write backend test suite (Jest + Supertest) | High | 20 hrs |
| P4-011 | .github/workflows/ | CI/CD GitHub Actions workflow | Medium | 4 hrs |
| P4-012 | root/ | Docker + docker-compose for local dev | Medium | 4 hrs |

Estimated Total Time: ~80 hours

---

## 17. Enterprise AI Roadmap

### Phase 1: Fix the Data Pipeline (Foundation)

Objective: Make the AI system read actual PDF content instead of fake text.

Stack:
- pdf-parse — Extract text from PDF files served from Cloudinary URLs
- tesseract.js — OCR fallback for scanned/image-based PDFs
- Chunking: Recursive character splitting (~500 tokens, 50 token overlap)

Implementation:
1. Download PDF from Cloudinary URL using fetch or axios
2. Pass buffer to pdf-parse to extract full text
3. If text is empty or very short, trigger tesseract.js OCR on PDF pages
4. Split text into chunks using recursive algorithm
5. Store cleaned chunks in AIChatChunk collection

Acceptance Criteria: A newly approved paper's chunks contain real text from the PDF.

### Phase 2: Real Semantic Embeddings

Objective: Replace the fake char-hash embedding with a real dense vector model.

Stack:
- Ollama embedding endpoint: POST /api/embeddings with model nomic-embed-text or BAAI/bge-small-en-v1.5 (if available via Ollama)
- Fallback: HTTP POST to a local embedding service

Provider Configuration:
- EMBEDDING_PROVIDER=ollama (or "disabled")
- EMBEDDING_MODEL=nomic-embed-text (or bge-small-en-v1.5)
- OLLAMA_URL=http://localhost:11434

Implementation:
1. Update generateEmbedding() in vectorSearch.js to call POST /api/embeddings
2. Store 768-dimensional (bge-small) or 1024-dimensional vectors in AIChatChunk.embedding
3. Update embeddingVersion field to track model changes
4. Admin "Rebuild Index" endpoint reprocesses all papers with new model

### Phase 3: Hybrid Retrieval (Semantic + BM25)

Objective: Replace the fake search with proper hybrid retrieval.

Stack:
- wink-bm25-text-ranker or flexsearch for BM25 scoring
- Cosine similarity for semantic scoring (already implemented, fix embedding source)
- Reciprocal Rank Fusion (RRF) to combine scores

Implementation:
1. Build in-memory BM25 index from all AIChatChunk documents at startup
2. On query: run semantic search + BM25 search separately
3. Apply RRF: score = 0.6 x semantic_rank_score + 0.4 x bm25_rank_score
4. Return top-K results

### Phase 4: FAISS In-Memory Vector Index (Optional Optimization)

Objective: Accelerate semantic search when chunk count becomes large (more than 10,000 chunks).

Stack:
- faiss-node npm package (bindings to Facebook FAISS)
- Flat L2 index for exact search (up to ~50k vectors)
- IVF index for approximate search at scale

Implementation:
1. At server startup, load all AIChatChunk.embedding vectors from MongoDB
2. Build FAISS flat index in memory
3. On query, search FAISS index for top-K candidates by vector similarity
4. Fetch corresponding chunk documents from MongoDB for the matched IDs
5. Rerank with BM25 + RRF

Note: FAISS is not needed until more than 5,000 chunks. For early deployment, MongoDB-loaded cosine similarity is acceptable.

Provider Configuration: VECTOR_STORE=mongodb ("mongodb" = load all) or "faiss" (in-memory index)

### Phase 5: VPS Migration Path

The system is architected for zero-code changes on infrastructure migration. Only environment variables change:

Development (local): AI_PROVIDER=ollama, OLLAMA_URL=http://localhost:11434, OLLAMA_MODEL=mistral, EMBEDDING_MODEL=nomic-embed-text
VPS (self-hosted Ollama on remote server): AI_PROVIDER=ollama, OLLAMA_URL=http://your-vps-ip:11434, OLLAMA_MODEL=mistral, EMBEDDING_MODEL=nomic-embed-text
Disabled (maintenance mode): AI_PROVIDER=disabled

No code changes required. The provider factory in providers.js handles all switching.

### Supported Models (No API Key Required)

| Purpose | Model | Via |
|:---|:---|:---|
| Chat / LLM | mistral | Ollama |
| Chat / LLM (lighter) | phi3 | Ollama |
| Embeddings | nomic-embed-text | Ollama |
| Embeddings (alternative) | BAAI/bge-small-en-v1.5 | Ollama (if pulled) |

---

## 18. Testing Roadmap

| Layer | Framework | Priority | What to Test |
|:---|:---|:---|:---|
| Backend Unit Tests | Jest + Supertest | High | All route handlers, coinManager, badgeService, AI services |
| Frontend Unit Tests | Vitest + React Testing Library | Medium | AuthContext, key components |
| Integration Tests | Jest + MongoDB Memory Server | High | Auth flows, paper lifecycle, coin economy |
| E2E Tests | Playwright | Low | Critical user journeys (register — upload — approve — download) |
| AI Service Tests | Jest | High | Ingestor, vectorSearch, RAG pipeline |
| Load Testing | k6 | Low | Papers endpoint, AI chat endpoint |

### Minimum Test Coverage Targets

| Module | Target Coverage |
|:---|:---|
| Auth routes | 90% |
| Paper routes | 85% |
| Coin economy | 95% |
| Badge service | 80% |
| AI ingestor | 80% |
| Frontend components | 60% |

---

## 19. Deployment Roadmap

### Phase 1: Development (Current)
- Backend: Node.js directly on local machine
- Frontend: Vite dev server
- DB: MongoDB Atlas (shared cluster)
- AI: Ollama on local machine

### Phase 2: Staging Deployment
- Backend: Railway or Render (free tier)
- Frontend: Vercel (already configured)
- DB: MongoDB Atlas (shared cluster)
- AI: Ollama disabled (AI_PROVIDER=disabled) — Ollama cannot run on free tiers

### Phase 3: Production Deployment (Self-Hosted VPS)
- Backend: VPS (e.g., DigitalOcean, Hetzner) with PM2 process manager
- Frontend: Vercel or Cloudflare Pages
- DB: MongoDB Atlas (M10+ dedicated cluster)
- AI: Ollama on the same VPS (minimum 8GB RAM recommended for mistral)
- Reverse Proxy: Nginx with SSL termination (Let's Encrypt)

### Required Infrastructure Files (To Create)
- Dockerfile for backend
- docker-compose.yml for local development with Ollama
- nginx.conf template
- ecosystem.config.js for PM2
- .github/workflows/deploy.yml for CI/CD
- server/.env.production.example with all required keys

---

## 20. Future Improvements

| Feature | Description | Priority |
|:---|:---|:---|
| Real-time notifications | WebSocket or Server-Sent Events for approval/badge notifications | Medium |
| Avatar upload | Cloudinary image upload for profile pictures | Low |
| Email verification | Nodemailer-based verification on registration | Medium |
| Password reset | Time-limited token-based reset flow | Medium |
| Admin analytics dashboard | Extended metrics with time-series charts | Low |
| Paper tagging system | Free-text tags on papers for better discovery | Medium |
| Study groups / rooms | Collaborative study sessions | Low |
| AI-powered paper search | Use embeddings for semantic paper discovery | High |
| Multilingual support | i18n for non-English user base | Low |
| Mobile app | React Native port | Low |
| Advanced admin audit log | Persistent, filterable admin action history | Medium |
| Subscription model | Replace coin packages with monthly subscriptions | Low |
| API documentation | OpenAPI/Swagger spec for all endpoints | Medium |
| CLI tool | Admin CLI for bulk operations | Low |

---

## 21. Final Project Score

Scores are based on direct code inspection, not aspirational status.

| Dimension | Score | Notes |
|:---|:---|:---|
| Code Organization | 7/10 | Good separation of concerns; routes are too large |
| Security | 6/10 | Good basics; token storage and payment stub are risks |
| Database Design | 8/10 | Well-indexed, proper relations, one type inconsistency |
| API Design | 7/10 | Consistent REST, some duplicate routes, no Swagger |
| Error Handling | 8/10 | Good error middleware; some routes skip error propagation |
| Authentication | 7/10 | JWT refresh works; HttpOnly cookie undermined by localStorage |
| Frontend Quality | 6/10 | Good routing; React Query underutilized; no AI pages |
| AI Architecture | 8/10 | Excellent provider pattern; data pipeline is the gap |
| AI Implementation | 3/10 | Infrastructure ready; core pipeline is mocked |
| Testing | 0/10 | Zero tests of any kind |
| Deployment Readiness | 3/10 | Client Vercel only; backend has no deployment config |
| Documentation | 5/10 | README exists; no API docs, no developer guide |

**Overall Score: 6.1 / 10**

---

## 22. Production Readiness Score

| Criterion | Status | Weight |
|:---|:---|:---|
| Zero known crash-level bugs | FAIL (BUG-001 crashes on stream) | Critical |
| All API endpoints functional | FAIL (stream, adminStats.js unmounted) | Critical |
| Real payment processing | FAIL (stub) | High |
| Structured logging | FAIL (Morgan only) | Medium |
| Environment separation | FAIL (no staging/prod config) | High |
| Server deployment config | FAIL (missing) | High |
| Test coverage | FAIL (0%) | High |
| No secrets in .env committed | FAIL (credentials present) | Critical |
| Email verification | FAIL | Medium |
| AI pipeline on real data | FAIL | High |
| Rate limiting complete | PARTIAL (stream may be uncovered) | Medium |
| Database connection resilience | PARTIAL (no retry) | Medium |

**Production Readiness Score: 2 / 10**

The application cannot go to production in its current state due to: a crash-level bug in the AI streaming endpoint, a fake payment flow that would allow coin theft, and real credentials committed to the repository.

---

## 23. Enterprise Readiness Score

| Criterion | Status |
|:---|:---|
| Scalable architecture | PARTIAL (no horizontal scaling support) |
| Automated CI/CD | MISSING |
| Comprehensive test suite | MISSING |
| API versioning strategy | PARTIAL (v1 only) |
| SLA-grade monitoring | MISSING |
| Audit trail | PARTIAL (Activity model, not persistent for admin actions) |
| Disaster recovery plan | MISSING |
| Load testing completed | MISSING |
| Security audit | NOT DONE |
| Documentation | PARTIAL (README only) |
| Runbook / operational guide | MISSING |
| Multi-environment config | MISSING |

**Enterprise Readiness Score: 1.5 / 10**

The project is a well-structured development prototype. Significant operational infrastructure must be built before enterprise deployment.

---

*End of StudyTogether Enterprise Implementation Roadmap v2.0*
*Audit Date: 2026-07-11 | All findings based on direct code inspection of every file in the project.*
