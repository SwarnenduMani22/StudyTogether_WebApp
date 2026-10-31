# StudyTogether — Project Stabilization & Feature Development Guide

> **Document Type**: Local Execution, Architectural Reference & Feature Development Roadmap
> **Workspace**: `C:\Users\SWARNENDU\Downloads\StudyTogether`
> **Target Environment**: Local Development (Node.js 20+, MongoDB, Cloudinary, Razorpay, Vite)
> **Document Status**: Ready for Implementation

---

## 1. Executive Summary & Existing Feature Inventory

**StudyTogether** is an academic resource-sharing and gamified student economy platform built on the MERN stack (React 19, Node.js / Express 5, MongoDB) with a dedicated AI Copilot microservice (Express 5, Ollama, Vector embeddings).

### 1.1 Core Implemented Features

#### Academic Paper Management
- **PDF Uploading** ([`client/src/pages/UploadPaper.jsx`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/client/src/pages/UploadPaper.jsx)): Upload academic papers categorized by Subject (*Data Structure, DBMS, OS, Computer Network, Software Engineering, Artificial Intelligence*) and Semester (1–8).
- **Drafts & Submissions**: Students can save work as drafts or submit papers to an administrator moderation queue. Non-admin users are restricted to a maximum of 2 pending uploads.
- **Paper Search & Catalog** ([`client/src/pages/Papers.jsx`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/client/src/pages/Papers.jsx)): Full-text search with regex sanitization, multi-filter dropdowns, and sorting (newest, views, downloads) with infinite scrolling.
- **In-Browser PDF Viewer** ([`client/src/components/papers/PDFViewer.jsx`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/client/src/components/papers/PDFViewer.jsx)): Integrated PDF viewing modal rendered via `react-pdf` and `pdfjs-dist`.
- **My Papers & Bookmarks** ([`client/src/pages/MyPapers.jsx`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/client/src/pages/MyPapers.jsx), [`client/src/pages/Bookmarks.jsx`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/client/src/pages/Bookmarks.jsx)): Management dashboard to edit drafts, delete submissions, and view saved bookmarks.

#### Gamified Virtual Economy ("Study Coins")
- **Initial Grant**: 50 complimentary coins credited to every new student upon registration.
- **Paper Unlocking Costs**:
  - **Preview Access**: 10 coins (free for the author and administrators).
  - **Download Access**: 40 coins (discounted to 30 coins if previously previewed).
- **Contributor Earnings**: Authors receive 30 coins reward upon admin approval of their submitted paper.
- **Coin Wallet** ([`client/src/pages/Wallet.jsx`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/client/src/pages/Wallet.jsx)): Interface for purchasing coin packages (*Starter: 100 coins for ₹29; Popular: 250 coins for ₹59; Premium: 500 coins for ₹99*), Razorpay checkout modal, and transaction history ledger.

#### Social & Gamification Mechanics
- **Ratings**: 1-to-5 star rating modal with live calculation of average rating and popularity score.
- **Rank & Badge Progression** ([`server/services/rankService.js`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/services/rankService.js), [`server/services/badgeService.js`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/services/badgeService.js)): Dynamic tier progression (*Beginner -> Explorer -> Scholar -> Expert -> Legend*) calculated from coins and approved uploads.
- **Leaderboard** ([`client/src/pages/Leaderboard.jsx`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/client/src/pages/Leaderboard.jsx)): Public ranking of top student contributors.
- **Activity Logging** ([`server/services/activityService.js`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/services/activityService.js)): User activity feed tracking uploads, rank advancements, and earned badges.

#### Administration & Moderation
- **Admin Dashboard** ([`client/src/pages/Admin.jsx`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/client/src/pages/Admin.jsx), [`AdminPending.jsx`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/client/src/pages/AdminPending.jsx)): High-level metrics (total users, papers, pending queue, revenue), pending approval queue (approve/reject), and user management (role change, deletion).

#### AI Copilot & Learning Tools *(Untouched / Preserved)*
- Real-time study assistant widget ([`client/src/components/ai/ChatWidget.jsx`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/client/src/components/ai/ChatWidget.jsx)), hybrid BM25 + semantic vector search, AI study notes, quizzes, flashcards, exam preparation plans, and topic analysis.

---

## 2. System Architecture & Interconnections

```
                       +-------------------------------------------------+
                       |              React 19 Client (SPA)              |
                       |          Vite Dev Server (Port 5173)            |
                       +-------------------------------------------------+
                                       |                     |
                HTTP/1.1 (/api/v1/...) |                     | HTTP / SSE (/api/v1/ai/...)
             Direct / Proxied requests v                     v [Vite dev proxy]
      +-----------------------------------+       +-----------------------------------+
      |        Main Backend Server        |       |          AI Microservice          |
      |      Express 5 (Port 5000)        |       |      Express 5 (Port 5001)       |
      +-----------------------------------+       +-----------------------------------+
         |         |          |                              |             |
         v         v          v                              v             v
    +---------+ +------+ +----------+                  +-----------+ +-----------+
    | MongoDB | |Cloud-| | Razorpay |                  |  MongoDB  | |   Local   |
    | Atlas / | |inary | | Payment  |                  | (Shared)  | |  Ollama   |
    | Local   | |Storage| | Gateway  |                  +-----------+ | (:11434)  |
    +---------+ +------+ +----------+                                +-----------+
```

### Subsystems Breakdown
1. **Frontend Client (`client/`)**:
   - Port: `5173`
   - Framework: React 19, Vite 7, Tailwind CSS 3, React Router v7.
   - API Gateways:
     - [`client/src/api/axios.js`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/client/src/api/axios.js) -> connects to Main Server (`http://localhost:5000/api/v1`).
     - [`client/src/api/aiAxios.js`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/client/src/api/aiAxios.js) -> connects to AI Microservice (`http://localhost:5001/api/v1`).
2. **Main Backend Server (`server/`)**:
   - Port: `5000`
   - Framework: Express 5, Mongoose 9.
   - Responsibilities: Auth (JWT + Cookies), Paper CRUD & Cloudinary uploads, Coin accounting, Razorpay checkout, Admin moderation.
3. **AI Copilot Microservice (`ai/`)**:
   - Port: `5001`
   - Framework: Express 5, Mongoose 9, Ollama client.
   - Responsibilities: PDF text extraction (`pdf-parse`, OCR), Word chunking, Vector similarity search, LLM response streaming.

---

## 3. Database & External Service Requirements

| Service | Requirement Level | Setup Details |
| :--- | :--- | :--- |
| **MongoDB** | **Mandatory** | Connection string required in root `.env` (`MONGODB_URI`). Can use local (`mongodb://127.0.0.1:27017/studytogether`) or free MongoDB Atlas cluster. |
| **Cloudinary** | **Required for Uploads** | Free Cloudinary credentials (`CLOUD_NAME`, `API_KEY`, `API_SECRET`) needed for uploading PDFs to Cloudinary raw storage. |
| **Razorpay** | **Optional for Dev** | Test Key ID & Secret needed for the checkout modal. (In local dev, coins can also be credited via the wallet purchase route). |
| **Ollama** | **Optional for Core Web** | Only required if testing local AI document embeddings (`nomic-embed-text`) and chat generation (`mistral`) on port 11434. |

---

## 4. Local Setup Instructions & Environment Configuration

### Step 1: Install Dependencies in All Folders

Execute in PowerShell / Terminal:
```bash
# 1. Install root workspace packages
npm install

# 2. Install server packages
cd server
npm install
cd ..

# 3. Install client packages
cd client
npm install
cd ..

# 4. Install AI service packages
cd ai
npm install
cd ..
```

---

### Step 2: Create Environment Configuration Files

#### A. Unified Backend & AI Configuration: Create root `.env`
Copy the repository template `.env.example` to `.env` in the project root:
```bash
cp .env.example .env
```
Both the Main Backend Server (`server/config/env.js`) and the AI Copilot Microservice (`ai/server.js`) resolve and load configuration directly from this root `.env` file:
```env
# Server Runtime
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173

# Database (Shared across Backend and AI Microservice)
MONGODB_URI=mongodb://localhost:27017/studytogether

# Authentication Keys (Replace with your own 32+ character random strings)
JWT_SECRET=studytogether_dev_jwt_secret_key_2026_secure
JWT_REFRESH_SECRET=studytogether_dev_refresh_jwt_secret_key_2026_secure

# Inter-Service Communication (Backend <-> AI Microservice)
INTERNAL_SERVICE_KEY=your_internal_service_key_secret_here
AI_SERVICE_URL=http://localhost:5001

# Cloudinary Storage (Required for PDF uploading)
CLOUD_NAME=your_cloudinary_cloud_name
API_KEY=your_cloudinary_api_key
API_SECRET=your_cloudinary_api_secret

# Razorpay Test Credentials (Optional for local development)
RAZORPAY_KEY_ID=rzp_test_your_key_id
RAZORPAY_KEY_SECRET=your_razorpay_secret
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret

# AI Microservice Configuration
AI_PORT=5001
CORS_ORIGIN=http://localhost:5173

# LLM Model Provider
AI_PROVIDER=ollama
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=mistral
EMBEDDING_MODEL=nomic-embed-text
```

#### B. Frontend Configuration: Create `client/.env` (Optional)
Vite defaults to `http://localhost:5000/api/v1` and `http://localhost:5001/api/v1` automatically. To override:
```env
VITE_API_URL=http://localhost:5000/api/v1
VITE_AI_API_URL=http://localhost:5001/api/v1
```

---

### Step 3: Run the Application Locally

#### Option 1: Full-Stack Mode (Concurrent All-in-One — Recommended)
From the project root:
```bash
npm run dev:all
```
Concurrently launches:
- Frontend UI: `http://localhost:5173`
- Backend API: `http://localhost:5000`
- AI Copilot API: `http://localhost:5001`

#### Option 2: Standard Web Platform (Client + Main Server)
From the project root:
```bash
npm run dev
```
- Frontend UI: `http://localhost:5173`
- Backend API: `http://localhost:5000`

#### Option 3: Independent Terminal Processes
Run each process in an independent terminal window:
- **Terminal 1**: `cd server && npm run dev`
- **Terminal 2**: `cd client && npm run dev`
- **Terminal 3**: `npm run ai` or `cd ai && npm run dev`
- **Terminal 4 (Optional)**: `ollama serve` (if running local AI)

#### Automated Test Execution
Run all backend and AI microservice tests from the project root:
```bash
npm test
```
To run frontend linting and production build verification:
```bash
cd client && npm run lint && npm run build
```

---

## 5. Current Blockers & Configuration Notes

1. **Missing Root `.env` File & Startup Exit Guard**:
   - Root `.env` is not committed to git. Copy `.env.example` to `.env` in the repository root before starting services.
   - [`server/server.js#L28-L41`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/server.js#L28-L41) contains mandatory exit checks: if `MONGODB_URI`, `JWT_SECRET`, or `JWT_REFRESH_SECRET` are not set, the process prints an error and terminates (`process.exit(1)`).
2. **Template in `.env.example`**:
   - The canonical template is located at `.env.example` in the project root, containing all required environment keys for backend, frontend, and AI microservice.
3. **CORS Configuration via `CLIENT_URL`**:
   - [`server/server.js#L51`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/server.js#L51) reads `origin: process.env.CLIENT_URL`.
   - Ensure `CLIENT_URL=http://localhost:5173` is present in root `.env` to prevent browser CORS preflight errors with credentials.
4. **Full-Stack Execution**:
   - Root `package.json` contains `"dev:all"` to run `server`, `client`, and `ai` concurrently, as well as `"ai": "node ai/server.js"` to run the AI microservice independently.

---

## 6. Prioritized Useful Features for StudyTogether

These features integrate directly with existing database models and UI pages without breaking backward compatibility or altering AI code:

### Priority 1: User Experience & Paper Consumption (Frontend)
1. **Enhanced PDF Viewer Controls**:
   - Add zoom in/out, jump-to-page input, thumbnail rail, and full-screen toggle inside [`PDFViewer.jsx`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/client/src/components/papers/PDFViewer.jsx).
2. **"My Unlocked Papers" Tab**:
   - Add a dedicated view in [`Dashboard.jsx`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/client/src/pages/Dashboard.jsx) and [`Wallet.jsx`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/client/src/pages/Wallet.jsx) displaying papers the user has already unlocked, allowing instant re-reading and re-downloading without spending coins again.
3. **Multi-Sort & Tag Filtering**:
   - Add sorting by "Highest Rated" and "Most Bookmarked", with clickable subject badge tags on [`Papers.jsx`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/client/src/pages/Papers.jsx).

### Priority 2: Student Engagement & Gamification (Full-Stack)
4. **Daily Login & Study Streak Rewards**:
   - Automatically award a 5-coin daily bonus on first login each day, updating `lastLoginDate` and incrementing streak counts in [`server/models/User.js`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/server/models/User.js).
5. **Interactive Flashcard & Quiz UI**:
   - Provide an interactive 3D flip card component for flashcards and an interactive multi-choice quiz widget with instant scoring in [`client/src/pages/AIAssistant.jsx`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/client/src/pages/AIAssistant.jsx).
6. **In-App Toast Notification Center**:
   - Show notification history when papers are approved/rejected by an admin or when coins are earned.

### Priority 3: Administration & Reliability (Backend & Admin UI)
7. **Local Storage Upload Fallback Mode**:
   - If Cloudinary credentials are not configured in `.env`, fall back to saving uploaded PDFs in `server/uploads/` and serving them statically, allowing 100% offline local development without external accounts.
8. **Admin Bulk Paper Actions**:
   - Add multi-select checkboxes to [`AdminPending.jsx`](file:///C:/Users/SWARNENDU/Downloads/StudyTogether/client/src/pages/AdminPending.jsx) allowing admins to approve or reject multiple submissions simultaneously.
9. **Paper Flagging & Quality Reports**:
   - Allow students to report corrupt or incorrect PDFs with a reason, feeding into an admin review queue.

---

## 7. Phased Implementation Roadmap

```
+-------------------------------------------------------------------------------+
| Phase 1: Local Setup & Environment Standardization [COMPLETED]                |
| - Standardized root .env.example with complete backend & AI config keys       |
| - Configured root dev:all script for full-stack concurrent startup            |
| - Integrated automated test runner (npm test) across server/test/ & ai/test/  |
+-------------------------------------------------------------------------------+
                                       |
                                       v
+-------------------------------------------------------------------------------+
| Phase 2: PDF Viewer Controls & Unlocked Papers UX                             |
| - Add Zoom, Fullscreen, and Page Navigator to PDFViewer.jsx                   |
| - Add "Unlocked Papers" library in Student Dashboard / Wallet                 |
| - Add Highest Rated / Most Bookmarked sorting in Papers catalog               |
+-------------------------------------------------------------------------------+
                                       |
                                       v
+-------------------------------------------------------------------------------+
| Phase 3: Engagement & Social Features (Streaks & Moderation)                  |
| - Implement Daily Login Bonus in User Controller / Auth                       |
| - Add Bulk Approval tools in Admin Pending Papers view                        |
| - Add Paper Flagging / Report modal for corrupt uploads                       |
+-------------------------------------------------------------------------------+
```

---

## 8. Development Rules & Safeguards

- **No Deletions**: Existing models, routes, components, and controllers must be preserved.
- **AI Preservation**: AI microservice (`ai/`) code and models remain untouched.
- **Incremental Steps**: Each proposed change is documented with exact file paths, lines affected, and verified locally before proceeding.
- **Backward Compatibility**: New fields in schemas will have default fallbacks so existing documents continue to work seamlessly.
