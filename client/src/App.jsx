import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";

import Register from "./pages/Register";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Profile from "./pages/Profile";
import Admin from "./pages/Admin";
import Papers from "./pages/Papers";
import AdminUpload from "./pages/AdminUpload";
import Home from "./pages/Home";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "./context/AuthContext";

/* ================= SCROLL TO TOP ================= */
function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

/* ================= Protected Route ================= */
function ProtectedRoute({ children }) {
  const { token } = useAuth();
  return token ? children : <Navigate to="/login" replace />;
}

/* ================= Admin Route ================= */
function AdminRoute({ children }) {
  const { user } = useAuth();

  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "admin") return <Navigate to="/dashboard" replace />;

  return children;
}

/* ================= Navbar ================= */
function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const dropdownRef = useRef(null);

  const { user, logout } = useAuth();

  const [open, setOpen] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);

  const [darkMode, setDarkMode] = useState(
    localStorage.getItem("theme") === "dark",
  );

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const toggleTheme = () => {
    if (darkMode) {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    } else {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    }

    setDarkMode(!darkMode);
  };

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const hideDashboardLink = ["/login", "/register"].includes(location.pathname);

  return (
    <header className="sticky top-0 z-50 bg-white dark:bg-gray-900 max-w-6xl mx-auto flex items-center justify-between mb-8 p-4">
      {/* Brand */}
      {hideDashboardLink ? (
        <Link to="/" className="brand">
          StudyTogether
        </Link>
      ) : (
        <Link to="/dashboard" className="brand">
          StudyTogether
        </Link>
      )}

      {/* Mobile Menu Button */}
      <button
        className="md:hidden text-2xl"
        onClick={() => setMobileMenu(!mobileMenu)}
      >
        ☰
      </button>

      {/* Desktop Menu */}
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
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-lg"
            >
              {darkMode ? "☀️" : "🌙"}
            </button>

            {/* Profile Dropdown */}
            <div ref={dropdownRef} className="relative">
              <button
                onClick={() => setOpen(!open)}
                className="w-10 h-10 rounded-full bg-indigo-600 text-white"
              >
                {user?.name?.charAt(0)?.toUpperCase() || "U"}
              </button>

              {open && (
                <div className="absolute right-0 mt-2 w-44 bg-white dark:bg-gray-800 shadow-lg rounded-lg">
                  {user?.role === "admin" && (
                    <button
                      onClick={() => navigate("/admin")}
                      className="block w-full text-left px-4 py-2 text-indigo-600"
                    >
                      Admin Panel
                    </button>
                  )}

                  <button
                    onClick={() => navigate("/papers")}
                    className="block w-full text-left px-4 py-2"
                  >
                    Papers
                  </button>

                  {user?.role === "admin" && (
                    <button
                      onClick={() => navigate("/upload")}
                      className="block w-full text-left px-4 py-2"
                    >
                      Upload Paper
                    </button>
                  )}

                  <button
                    onClick={() => navigate("/profile")}
                    className="block w-full text-left px-4 py-2"
                  >
                    Profile
                  </button>

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

      {/* Mobile Menu */}
      {mobileMenu && user && (
        <div className="absolute top-16 right-4 bg-white dark:bg-gray-800 shadow-lg rounded-lg p-4 md:hidden space-y-3">
          <button
            onClick={() => navigate("/papers")}
            className="block w-full text-left"
          >
            Papers
          </button>

          <button
            onClick={() => navigate("/profile")}
            className="block w-full text-left"
          >
            Profile
          </button>

          {user.role === "admin" && (
            <>
              <button
                onClick={() => navigate("/admin")}
                className="block w-full text-left"
              >
                Admin Panel
              </button>

              <button
                onClick={() => navigate("/upload")}
                className="block w-full text-left"
              >
                Upload Paper
              </button>
            </>
          )}

          <button
            onClick={handleLogout}
            className="block w-full text-left text-red-500"
          >
            Logout
          </button>
        </div>
      )}
    </header>
  );
}

/* ================= APP ================= */
export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />

      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
        <Navbar />

        <main className="max-w-6xl mx-auto">
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
              path="/papers"
              element={
                <ProtectedRoute>
                  <Papers />
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
              path="/upload"
              element={
                <AdminRoute>
                  <AdminUpload />
                </AdminRoute>
              }
            />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
