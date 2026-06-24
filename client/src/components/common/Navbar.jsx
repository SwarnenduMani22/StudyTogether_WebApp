import { Link, useLocation, useNavigate } from "react-router-dom";

import { useState, useEffect, useRef } from "react";

import useAuth from "../../hooks/useAuth";
export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const dropdownRef = useRef(null);

  const { user, logout } = useAuth();

  const [open, setOpen] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);

  /* ================= DARK MODE ================= */

  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem("theme");

    if (saved) {
      return saved === "dark";
    }

    return window.matchMedia("(prefers-color-scheme: dark)").matches;
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
    setOpen(false);
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
              {/* COINS */}

              <button
                onClick={() => navigate("/wallet")}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700 hover:scale-105 transition"
              >
                <span className="text-lg">🪙</span>

                <span className="font-semibold text-yellow-700 dark:text-yellow-300">
                  {user?.coins || 0}
                </span>
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
                    <button
                      onClick={() => navigate("/leaderboard")}
                      className="block w-full text-left px-4 py-2"
                    >
                      Leaderboard
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
      {/* MOBILE MENU */}

      {mobileMenu && (
        <div className="md:hidden border-t dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-4 space-y-3">
          {!user ? (
            <>
              <Link
                to="/login"
                onClick={() => setMobileMenu(false)}
                className="block"
              >
                Login
              </Link>

              <Link
                to="/register"
                onClick={() => setMobileMenu(false)}
                className="block"
              >
                Register
              </Link>
            </>
          ) : (
            <>
              <Link
                to="/profile"
                onClick={() => setMobileMenu(false)}
                className="block"
              >
                Profile
              </Link>

              <Link
                to="/papers"
                onClick={() => setMobileMenu(false)}
                className="block"
              >
                Papers
              </Link>

              <Link
                to="/my-papers"
                onClick={() => setMobileMenu(false)}
                className="block"
              >
                My Papers
              </Link>

              <Link
                to="/upload-paper"
                onClick={() => setMobileMenu(false)}
                className="block"
              >
                Upload Paper
              </Link>
              {user?.role !== "admin" && (
                <Link
                  to="/bookmarks"
                  onClick={() => setMobileMenu(false)}
                  className="block"
                >
                  Bookmarks
                </Link>
              )}
              <Link
                to="/leaderboard"
                onClick={() => setMobileMenu(false)}
                className="block"
              >
                Leaderboard
              </Link>

              {user?.role === "admin" && (
                <>
                  <Link
                    to="/admin"
                    onClick={() => setMobileMenu(false)}
                    className="block text-indigo-600"
                  >
                    Admin Panel
                  </Link>

                  <Link
                    to="/admin/pending"
                    onClick={() => setMobileMenu(false)}
                    className="block"
                  >
                    Pending Papers
                  </Link>
                </>
              )}

              <button
                onClick={() => {
                  setMobileMenu(false);
                  handleLogout();
                }}
                className="block text-red-500"
              >
                Logout
              </button>
            </>
          )}
        </div>
      )}
    </header>
  );
}
