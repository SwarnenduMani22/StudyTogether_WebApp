import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";

import { lazy, Suspense, useEffect } from "react";
import { Toaster } from "react-hot-toast";

import useAuth from "./hooks/useAuth";

/* ================= PAGES ================= */

const Register = lazy(() => import("./pages/Register"));
const Login = lazy(() => import("./pages/Login"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Profile = lazy(() => import("./pages/Profile"));
const Admin = lazy(() => import("./pages/Admin"));
const Papers = lazy(() => import("./pages/Papers"));
const AdminPending = lazy(() => import("./pages/AdminPending"));
const PaperDetails = lazy(() => import("./pages/PaperDetails"));
const Home = lazy(() => import("./pages/Home"));
const MyPapers = lazy(() => import("./pages/MyPapers"));
const Bookmarks = lazy(() => import("./pages/Bookmarks"));
const UploadPaper = lazy(() => import("./pages/UploadPaper"));
const Leaderboard = lazy(() => import("./pages/Leaderboard"));
const Wallet = lazy(() => import("./pages/Wallet"));
const PublicProfile = lazy(() => import("./pages/PublicProfile"));
const AIAssistant = lazy(() => import("./pages/AIAssistant"));
/* ================= COMPONENTS ================= */

import ErrorBoundary from "./components/common/ErrorBoundary";
import Navbar from "./components/common/Navbar";
import ChatWidget from "./components/ai/ChatWidget";

/* ================= SCROLL ================= */

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

/* ================= PROTECTED ROUTE ================= */

function ProtectedRoute({ children }) {
  const { token, loading } = useAuth();

  if (loading) return null;

  return token ? children : <Navigate to="/login" replace />;
}

/* ================= ADMIN ROUTE ================= */

function AdminRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) return null;

  if (!user) return <Navigate to="/login" replace />;

  if (user.role !== "admin") return <Navigate to="/dashboard" replace />;

  return children;
}

/* ================= NAVBAR ================= */

function RouteFallback() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
    </div>
  );
}

/* ================= APP ================= */

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <ScrollToTop />

        <Toaster position="top-right" />
        <ChatWidget />

        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
          <Navbar />

          <main className="max-w-6xl mx-auto p-6">
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                <Route path="/" element={<Home />} />

                <Route path="/register" element={<Register />} />
                <Route path="/login" element={<Login />} />

                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute>
                      <Dashboard />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/profile"
                  element={
                    <ProtectedRoute>
                      <Profile />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/profile/:id"
                  element={
                    <ProtectedRoute>
                      <PublicProfile />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/wallet"
                  element={
                    <ProtectedRoute>
                      <Wallet />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/papers"
                  element={
                    <ProtectedRoute>
                      <Papers />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/my-papers"
                  element={
                    <ProtectedRoute>
                      <MyPapers />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/upload-paper"
                  element={
                    <ProtectedRoute>
                      <UploadPaper />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/bookmarks"
                  element={
                    <ProtectedRoute>
                      <Bookmarks />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/papers/:id"
                  element={
                    <ProtectedRoute>
                      <PaperDetails />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/admin"
                  element={
                    <AdminRoute>
                      <Admin />
                    </AdminRoute>
                  }
                />

                <Route
                  path="/admin/pending"
                  element={
                    <AdminRoute>
                      <AdminPending />
                    </AdminRoute>
                  }
                />
                <Route
                  path="/leaderboard"
                  element={
                    <ProtectedRoute>
                      {" "}
                      <Leaderboard />{" "}
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/assistant"
                  element={
                    <ProtectedRoute>
                      <AIAssistant />
                    </ProtectedRoute>
                  }
                />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </main>
        </div>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
