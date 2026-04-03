# 📚 StudyTogether – Full Stack MERN Web App

A modern **production-ready full-stack web application** where students can **upload, discover, and manage study materials (PDFs)** with secure authentication, admin moderation, and real-time engagement features.

---

# 🚀 Live Demo

- 🌐 **Frontend:** [https://study-together-web-app.vercel.app](https://study-together-web-app.vercel.app)
- 🔗 **Backend API:** [https://studytogether-backend-xt0f.onrender.com/api/v1/health](https://studytogether-backend-xt0f.onrender.com/api/v1/health)

---

# 🛠 Tech Stack

## 🌐 Frontend

- React.js (Vite)
- Tailwind CSS
- React Router DOM
- Axios

## ⚙️ Backend

- Node.js
- Express.js
- MongoDB (Mongoose)

## 🔐 Authentication & Security

- JWT (Access + Refresh Tokens)
- Helmet (Security headers)
- Express Rate Limiting
- CORS Protection

## ☁️ File Storage

- Multer (Upload handling)
- Cloudinary (PDF storage & delivery)

---

# ✨ Core Features

## 🔐 Authentication System

- User Registration & Login
- JWT-based Authentication
- Refresh Token Mechanism

## 👤 User Features

- Profile Management
- Bookmark Papers
- Upload Papers (User & Admin)

## 📄 Paper Management

- Upload PDF Files (Cloudinary)
- Search & Filter (Subject, Semester)
- Pagination
- PDF Preview (React-PDF)
- Download Papers

## ⭐ Engagement System

- View Counter
- Download Counter
- Rating System (1–5 ⭐)
- Trending Papers Algorithm

## 🛡 Admin Panel

- Approve / Reject Papers
- Delete Papers (DB + Cloudinary sync)
- Manage Users
- View Platform Analytics

---

# 🧠 Smart System Design

- Duplicate Paper Detection
- Upload Limit (Max 2 pending papers per user)
- Role-Based Access Control (RBAC)
- Secure File Validation (PDF only + size limit)
- Centralized Error Handling

---

# 📂 Project Structure

```bash
StudyTogether/
│
├── client/                 # React Frontend (Vite)
│   ├── src/
│   ├── components/
│   ├── pages/
│   └── package.json
│
├── server/                 # Node + Express Backend
│   ├── models/
│   ├── routes/
│   ├── middleware/
│   ├── config/
│   └── server.js
│
├── .gitignore
├── README.md
└── package.json
```

---

# ⚙️ Environment Variables

## 🔐 Backend (`server/.env`)

```env
PORT=5000
MONGODB_URI=your_mongodb_uri

JWT_SECRET=your_secret
JWT_REFRESH_SECRET=your_refresh_secret

CLIENT_URL=http://localhost:5173

CLOUD_NAME=your_cloudinary_name
API_KEY=your_api_key
API_SECRET=your_api_secret
```

---

## 🌐 Frontend (`client/.env`)

```env
VITE_API_URL=http://localhost:5000/api/v1
```

---

# 🧪 API Endpoints (Sample)

| Method | Endpoint               | Description         |
| ------ | ---------------------- | ------------------- |
| POST   | `/auth/register`       | Register user       |
| POST   | `/auth/login`          | Login user          |
| GET    | `/papers`              | Get all papers      |
| POST   | `/papers/upload`       | Upload paper        |
| POST   | `/papers/:id/view`     | Increment views     |
| POST   | `/papers/:id/download` | Increment downloads |

---

# 🚀 Installation & Setup

## 🔧 Clone Repository

```bash
git clone https://github.com/SwarnenduMani22/StudyTogether_WebApp.git
cd StudyTogether_WebApp
```

---

## ▶️ Backend Setup

```bash
cd server
npm install
npm run dev
```

---

## ▶️ Frontend Setup

```bash
cd client
npm install
npm run dev
```

---

# 🌍 Deployment

## 🔹 Backend (Render)

- Root Directory: `server`
- Add Environment Variables
- Deploy

## 🔹 Frontend (Vercel)

- Root Directory: `client`
- Add `VITE_API_URL`
- Deploy

---

# 📸 Screenshots (Coming Soon)

- Home Page
- Papers Listing
- Admin Dashboard
- Upload Interface

---

# 🧑‍💻 Author

**Swarnendu Mani**

- GitHub: [https://github.com/SwarnenduMani22](https://github.com/SwarnenduMani22)

---

# 🎯 Future Improvements

- 🔔 Notification System
- 💬 Comments & Discussion
- 📱 Mobile Optimization
- 🌍 Multi-language Support

---

# ⭐ Final Thoughts

This project demonstrates:

✔ Full-stack MERN development
✔ Secure authentication system
✔ Cloud file handling (Cloudinary)
✔ Scalable backend architecture
✔ Production deployment (Vercel + Render)
