import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";

import api from "../api/axios";
import useAuth from "../hooks/useAuth";

import toast from "react-hot-toast";

const Login = () => {
  const { login } = useAuth();

  const navigate = useNavigate();

  const [form, setForm] = useState({
    email: "",
    password: "",
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  /* ================= HANDLE INPUT ================= */

  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  /* ================= SUBMIT ================= */

  const handleSubmit = async (e) => {
    e.preventDefault();

    setError("");
    setLoading(true);

    try {
      const res = await api.post("/auth/login", {
        email: form.email.trim(),
        password: form.password,
      });

      const user = res?.data?.user;
      const accessToken = res?.data?.accessToken;

      if (!user || !accessToken) {
        throw new Error("Invalid server response");
      }

      login(user, accessToken); // context login

      toast.success("Login successful 🎉");

      navigate("/papers");
    } catch (err) {
      const message =
        err?.response?.data?.error || err?.message || "Login failed";

      setError(message);

      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="
      min-h-screen flex items-center justify-center
      bg-gradient-to-br
      from-blue-500 to-indigo-600
      dark:from-gray-900 dark:to-gray-800
      p-4
      "
    >
      <div
        className="
        w-full max-w-md p-8 rounded-2xl shadow-xl
        bg-white/90 dark:bg-gray-800/90
        backdrop-blur-md
        border border-gray-200 dark:border-gray-700
        "
      >
        <h2 className="text-2xl font-bold text-center mb-6 text-gray-800 dark:text-white">
          Welcome Back 👋
        </h2>

        {/* ERROR MESSAGE */}

        {error && (
          <div className="bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 text-sm p-3 rounded mb-4">
            {error}
          </div>
        )}

        {/* FORM */}

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            name="email"
            type="email"
            placeholder="Email"
            required
            value={form.email}
            onChange={handleChange}
            disabled={loading}
            className="input"
          />

          <input
            name="password"
            type="password"
            placeholder="Password"
            required
            value={form.password}
            onChange={handleChange}
            disabled={loading}
            className="input"
          />

          <button
            type="submit"
            disabled={loading}
            className={`btn-primary w-full ${
              loading ? "opacity-60 cursor-not-allowed" : ""
            }`}
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        {/* REGISTER LINK */}

        <p className="text-center mt-4 text-sm text-gray-600 dark:text-gray-400">
          Don't have an account?{" "}
          <Link
            to="/register"
            className="text-blue-600 dark:text-blue-400 font-semibold hover:underline"
          >
            Register
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
