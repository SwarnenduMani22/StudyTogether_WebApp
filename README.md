# 📚 StudyTogether – Full Stack Web App

A modern **full-stack MERN-style web application** for students to **upload, explore, and manage study papers** with authentication, admin moderation, and real-time engagement features.

---

# 🚀 Live Demo (Add after deploy)

- 🌐 Frontend: `[https://your-app.vercel.app](https://study-together-web-app.vercel.app/)`
- 🔗 Backend API: `[https://your-app.onrender.com/api/v1](https://studytogether-backend-xt0f.onrender.com/api/v1/health)`

---

# 🛠 Tech Stack

## 🌐 Frontend

- **React.js (Vite)**
- **Tailwind CSS**
- **React Router**
- **Axios**

## ⚙️ Backend

- **Node.js**
- **Express.js**
- **MongoDB (Mongoose)**

## 🔐 Authentication & Security

- **JWT (Access + Refresh Token)**
- **Helmet**
- **Rate Limiting**
- **CORS**

## 📁 File Handling

- **Multer**
- **Cloudinary (PDF Storage)**

---

# ✨ Features

## 🔐 Authentication

- User Registration & Login
- Secure JWT Authentication
- Token Refresh System

## 👤 User System

- Profile Management
- Bookmark Papers
- Upload Papers (User/Admin)

## 📄 Study Papers

- Upload PDF Files (Cloudinary)
- Search & Filter (Subject, Semester)
- Pagination
- Preview & Download Papers

## ⭐ Engagement System

- View Count Tracking
- Download Count Tracking
- Rating System (1–5 ⭐)
- Trending Papers

## 🛡 Admin Panel

- Approve / Reject Papers
- Delete Papers (Cloudinary + DB sync)
- Manage Users
- Admin Statistics

---

# 🧠 Smart Features

- Duplicate Paper Detection
- Upload Limit (Max 2 pending papers for users)
- Role-Based Access Control (Admin/User)
- Secure File Validation (PDF only + size limit)
- Clean Error Handling System

---

# 📂 Project Structure

```bash
StudyTogether/
│
├── client/                 # Frontend (React + Vite)
│   ├── src/
│   ├── pages/
│   ├── components/
│   └── package.json
│
├── server/                 # Backend (Node + Express)
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

## 🔧 Clone Repo

```bash
git clone https://github.com/your-username/StudyTogether.git
cd StudyTogether
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

- Set root directory: `server`
- Add environment variables
- Deploy 🚀

## 🔹 Frontend (Vercel)

- Set root directory: `client`
- Add `VITE_API_URL`
- Deploy 🚀

---

# 📸 Screenshots (Add later)

- Home Page
- Paper Listing
- Admin Panel
- Upload Page

---

# 🧑‍💻 Author

**Swarnendu Mani**

- GitHub: [https://github.com/SwarnenduMani22](https://github.com/SwarnenduMani22)

---

# 🎯 Future Improvements

- 🔔 Notifications system
- 💬 Comments on papers
- 📱 Mobile optimization
- 🌍 Multi-language support

---

# ⭐ Final Note

This project demonstrates:

💼 Full-stack development
🔐 Secure authentication
📁 File handling & cloud integration
🛡 Production-ready backend architecture

---
