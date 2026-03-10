import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";

import { useState, useEffect, useRef } from "react";
import { Toaster } from "react-hot-toast";

import { useAuth } from "./context/AuthContext";

/* ================= PAGES ================= */

import Register from "./pages/Register";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Profile from "./pages/Profile";
import Admin from "./pages/Admin";
import Papers from "./pages/Papers";
import AdminPending from "./pages/AdminPending";
import PaperDetails from "./pages/PaperDetails";
import Home from "./pages/Home";
import MyPapers from "./pages/MyPapers";
import Bookmarks from "./pages/Bookmarks";
import UploadPaper from "./pages/UploadPaper";

/* ================= COMPONENTS ================= */

import ErrorBoundary from "./components/common/ErrorBoundary";

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

function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const dropdownRef = useRef(null);

  const { user, logout } = useAuth();

  const [open, setOpen] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);

  /* ================= DARK MODE ================= */

  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem("theme");
    if (saved) return saved === "dark";
    return true;
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [darkMode]);

  const toggleTheme = () => {
    const next = !darkMode;

    setDarkMode(next);

    localStorage.setItem("theme", next ? "dark" : "light");
  };

  /* ================= LOGOUT ================= */

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  /* ================= CLOSE DROPDOWN ================= */

  useEffect(() => {
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClick);

    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    setMobileMenu(false);
  }, [location.pathname]);

  const hideDashboardLink = ["/login", "/register"].includes(location.pathname);

  return (
    <header className="sticky top-0 z-50 bg-white dark:bg-gray-900 shadow-sm">
      <div className="max-w-6xl mx-auto flex items-center justify-between p-4">
        {/* BRAND */}

        <Link to={hideDashboardLink ? "/" : "/dashboard"} className="brand">
          StudyTogether
        </Link>

        {/* MOBILE BUTTON */}

        <button
          className="md:hidden text-2xl"
          onClick={() => setMobileMenu(!mobileMenu)}
        >
          ☰
        </button>

        {/* DESKTOP NAV */}

        <nav className="hidden md:flex items-center space-x-4">
          {!user ? (
            <>
              <Link to="/login" className="text-indigo-600">
                Login
              </Link>

              <Link to="/register" className="text-indigo-600">
                Register
              </Link>
            </>
          ) : (
            <div className="flex items-center space-x-3">
              {/* THEME */}

              <button
                onClick={toggleTheme}
                className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-lg"
              >
                {darkMode ? "☀️" : "🌙"}
              </button>

              {/* PROFILE */}

              <div ref={dropdownRef} className="relative">
                <button
                  onClick={() => setOpen(!open)}
                  className="w-10 h-10 rounded-full bg-indigo-600 text-white"
                >
                  {user?.name?.charAt(0)?.toUpperCase() || "U"}
                </button>

                {open && (
                  <div className="absolute right-0 mt-2 w-44 bg-white dark:bg-gray-800 shadow-lg rounded-lg">
                    <button
                      onClick={() => navigate("/profile")}
                      className="block w-full text-left px-4 py-2"
                    >
                      Profile
                    </button>
                    <button
                      onClick={() => navigate("/papers")}
                      className="block w-full text-left px-4 py-2"
                    >
                      Papers
                    </button>

                    <button
                      onClick={() => navigate("/my-papers")}
                      className="block w-full text-left px-4 py-2"
                    >
                      My Papers
                    </button>

                    <button
                      onClick={() => navigate("/upload-paper")}
                      className="block w-full text-left px-4 py-2"
                    >
                      Upload Paper
                    </button>

                    {/* USER ONLY */}

                    {user?.role !== "admin" && (
                      <button
                        onClick={() => navigate("/bookmarks")}
                        className="block w-full text-left px-4 py-2"
                      >
                        Bookmarks
                      </button>
                    )}

                    {/* ADMIN ONLY */}

                    {user?.role === "admin" && (
                      <>
                        <button
                          onClick={() => navigate("/admin")}
                          className="block w-full text-left px-4 py-2 text-indigo-600"
                        >
                          Admin Panel
                        </button>

                        <button
                          onClick={() => navigate("/admin/pending")}
                          className="block w-full text-left px-4 py-2"
                        >
                          Pending Papers
                        </button>
                      </>
                    )}

                    <button
                      onClick={handleLogout}
                      className="block w-full text-left px-4 py-2 text-red-500"
                    >
                      Logout
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}

/* ================= APP ================= */

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <ScrollToTop />

        <Toaster position="top-right" />

        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
          <Navbar />

          <main className="max-w-6xl mx-auto p-6">
            <Routes>
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <Home />
                  </ProtectedRoute>
                }
              />

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

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
