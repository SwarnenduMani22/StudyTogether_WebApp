# 📚 StudyTogether

A modern full-stack MERN platform where students can upload, discover, rate, bookmark, and download academic study materials while earning rewards through a community-driven contribution system.

---

## 🚀 Live Demo

### Frontend

https://study-together-web-app.vercel.app

### Backend API

https://studytogether-backend-xt0f.onrender.com/api/v1/health

---

# ✨ Features

## 🔐 Authentication & Authorization

- User Registration
- User Login
- JWT Authentication
- Refresh Token System
- Protected Routes
- Role-Based Access Control (RBAC)
- Admin & User Roles

---

## 📄 Paper Management

- Upload PDF Papers
- Cloudinary PDF Storage
- PDF Preview System
- PDF Download System
- Search Papers
- Subject Filtering
- Semester Filtering
- Pagination
- Duplicate Paper Prevention

---

## 🪙 Coin Economy System

### Earn Coins

- +30 Coins when a paper gets approved

### Spend Coins

- Preview Paper → 10 Coins
- Download Paper → 40 Coins
- Download After Preview → 30 Coins

### Free Access

- Admins
- Paper Owners
- Previously Purchased Papers

---

## 🏆 Gamification System

### Badges

- 🥇 First Upload
- 📚 Contributor
- 🔥 Top Uploader
- 🪙 100 Coins Club
- ⭐ Rising Scholar

### Leaderboard

Ranks users by:

1. Coins
2. Approved Uploads
3. Total Uploads

---

## ⭐ Community Features

- Paper Rating System
- Average Rating Calculation
- Comments System
- Delete Own Comments
- Admin Comment Moderation
- Bookmark Papers

---

## 👤 User Dashboard

- Profile Management
- Update Name
- Update Password
- My Uploads
- Approved Papers Count
- Pending Papers Count
- Bookmark Collection
- Coin History

---

## 🛡️ Admin Features

### Paper Moderation

- View Pending Papers
- Preview Submitted PDFs
- Approve/Reject Papers
- Bulk Approve/Reject Papers
- Cloudinary File Cleanup Automation

### User Management

- User Monitoring
- Change User Roles
- Advanced Analytics Dashboard (Recharts)
- Live System Metrics (DB Size, Daily Active Users)

---

## 🌙 User Experience

- Responsive Design
- Dark Mode Support
- Infinite Scrolling (No pagination clicks)
- Animated Loading Skeletons
- Toast Notifications
- Error Handling & Global Interceptors
- Mobile Friendly UI

---

# 🛠 Tech Stack

## Frontend

- React.js 19
- Vite
- Tailwind CSS
- React Router DOM
- TanStack React Query (State Management & Caching)
- React Infinite Scroll Component
- Recharts (Admin Analytics)
- Axios
- React Hot Toast

## Backend

- Node.js
- Express.js
- MongoDB
- Mongoose
- Morgan (Logging)

## Authentication

- JWT Access Tokens
- JWT Refresh Tokens (Database Persisted)
- bcryptjs

## Storage

- Cloudinary
- Multer
- Multer Cloudinary Storage

---

# 📂 Project Structure

```bash
StudyTogether/
│
├── client/
│   ├── src/
│   │   ├── api/
│   │   ├── components/
│   │   ├── context/
│   │   ├── hooks/
│   │   ├── pages/
│   │   ├── routes/
│   │   ├── utils/
│   │   └── App.jsx
│
├── server/
│   ├── config/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── .env
│   └── server.js
│
└── README.md
```

---

# ⚙️ Environment Variables

## Backend (.env)

```env
PORT=5000

MONGODB_URI=your_mongodb_uri

JWT_SECRET=your_jwt_secret
JWT_REFRESH_SECRET=your_refresh_secret

CLIENT_URL=http://localhost:5173

CLOUD_NAME=your_cloudinary_name
API_KEY=your_cloudinary_api_key
API_SECRET=your_cloudinary_api_secret
```

## Frontend (.env)

```env
VITE_API_URL=http://localhost:5000/api/v1
```

---

# 🚀 Installation

## Clone Repository

```bash
git clone https://github.com/your-username/studytogether.git
cd studytogether
```

## Backend

```bash
cd server

npm install

npm run dev
```

## Frontend

```bash
cd client

npm install

npm run dev
```

---

# 🔗 Main API Endpoints

| Method | Endpoint                  | Description    |
| ------ | ------------------------- | -------------- |
| POST   | /auth/register            | Register User  |
| POST   | /auth/login               | Login User     |
| POST   | /auth/refresh             | Refresh Token  |
| GET    | /papers                   | Get Papers     |
| POST   | /papers/upload            | Upload Paper   |
| POST   | /papers/:id/view          | Preview Paper  |
| POST   | /papers/:id/download      | Download Paper |
| POST   | /papers/:id/rate          | Rate Paper     |
| POST   | /papers/:id/comment       | Add Comment    |
| PUT    | /papers/admin/approve/:id | Approve Paper  |
| DELETE | /papers/admin/reject/:id  | Reject Paper   |

---

# 🔒 Security Features

- JWT Authentication
- Database-Persisted Refresh Token Flow
- Password Hashing (bcrypt)
- Protected API Routes
- Admin Authorization Middleware
- PDF Validation
- File Size Limiting
- Duplicate Upload Prevention
- Atomic MongoDB Transactions (Prevent Race Conditions)
- NoSQL Injection Sanitization (`express-mongo-sanitize`)
- Strict Rate Limiting (`express-rate-limit`)
- HTTP Header Security (`helmet`)

---

# 🎯 Future Improvements

- Real-Time Notifications
- AI-Based Paper Recommendations
- Email Verification
- Password Reset System
- Mobile App Version

---

# 👨‍💻 Author

**Swarnendu Mani**

GitHub:
https://github.com/SwarnenduMani22

---

# ⭐ Support

If you like this project, consider giving it a star on GitHub.
