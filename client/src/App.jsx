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
import { useState, useEffect, useRef } from "react";

/* 🔐 Normal Protected Route */
function ProtectedRoute({ children }) {
  const token = localStorage.getItem("token");
  return token ? children : <Navigate to="/login" replace />;
}

/* 🔒 Admin Only Route */
function AdminRoute({ children }) {
  const user = JSON.parse(localStorage.getItem("user"));

  if (!user) return <Navigate to="/login" replace />;
  return user.role === "admin" ? (
    children
  ) : (
    <Navigate to="/dashboard" replace />
  );
}

function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const dropdownRef = useRef(null);

  const [open, setOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(
    localStorage.getItem("theme") === "dark",
  );

  const user = JSON.parse(localStorage.getItem("user"));

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/");
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

  /* 👇 Close dropdown on outside click */
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <header className="max-w-5xl mx-auto flex items-center justify-between mb-8">
      {/* 🔥 SMART BRAND LOGIC */}
      {location.pathname === "/login" || location.pathname === "/register" ? (
        <Link to="/" className="brand hover:opacity-80 transition">
          StudyTogether
        </Link>
      ) : location.pathname === "/" || location.pathname === "/dashboard" ? (
        <div className="brand">StudyTogether</div>
      ) : (
        <Link to="/dashboard" className="brand hover:opacity-80 transition">
          StudyTogether
        </Link>
      )}

      {/* Right Section */}
      <nav className="flex items-center space-x-4">
        {location.pathname !== "/dashboard" &&
        location.pathname !== "/profile" &&
        location.pathname !== "/admin" ? (
          <>
            <Link
              to="/login"
              className="text-sm text-indigo-600 hover:underline"
            >
              Login
            </Link>
            <Link
              to="/register"
              className="text-sm text-indigo-600 hover:underline"
            >
              Register
            </Link>
          </>
        ) : (
          <div className="flex items-center space-x-3">
            {/* 🌙 Theme Button */}
            <button
              onClick={toggleTheme}
              className="w-10 h-10 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center"
            >
              {darkMode ? "☀️" : "🌙"}
            </button>

            {/* 👤 Profile Dropdown */}
            <div ref={dropdownRef} className="relative">
              <button
                onClick={() => setOpen(!open)}
                className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold"
              >
                {user?.name?.charAt(0).toUpperCase() || "U"}
              </button>

              {open && (
                <div className="absolute right-0 mt-2 w-44 bg-white dark:bg-gray-800 shadow-lg rounded-lg border dark:border-gray-700">
                  {/* Admin Button */}
                  {user?.role === "admin" && (
                    <button
                      onClick={() => {
                        setOpen(false);
                        navigate("/admin");
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm text-indigo-600"
                    >
                      Admin Panel
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setOpen(false);
                      navigate("/profile");
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm"
                  >
                    Profile
                  </button>

                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-red-600 text-sm"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6 transition-colors duration-300">
        <Navbar />

        <main className="max-w-5xl mx-auto">
          <Routes>
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
              path="/admin"
              element={
                <AdminRoute>
                  <Admin />
                </AdminRoute>
              }
            />

            <Route
              path="/"
              element={
                <div className="text-center">
                  <h1 className="text-3xl font-semibold">
                    Welcome to StudyTogether
                  </h1>
                  <p className="mt-4 text-gray-600 dark:text-gray-300">
                    Please login or register to continue.
                  </p>
                </div>
              }
            />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
