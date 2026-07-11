import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import api from "../api/axios";
import toast from "react-hot-toast";

const Register = () => {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
  });

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
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
    setSuccess("");

    const trimmedName = form.name.trim();

    if (trimmedName.length < 3) {
      return setError("Name must be at least 3 characters");
    }

    if (form.password.length < 8) {
      return setError("Password must be at least 8 characters");
    }

    setLoading(true);

    try {
      await api.post("/auth/register", {
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
      });

      setSuccess("Registration successful! Redirecting...");

      toast.success("Account created 🎉");

      setForm({
        name: "",
        email: "",
        password: "",
      });

      setTimeout(() => {
        navigate("/login");
      }, 1500);
    } catch (err) {
      const message =
        err?.response?.data?.error || err?.message || "Registration failed";

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
      from-purple-500 to-pink-600
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
          Create Account 🚀
        </h2>

        {/* ERROR */}

        {error && (
          <div className="bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 text-sm p-3 rounded mb-4">
            {error}
          </div>
        )}

        {/* SUCCESS */}

        {success && (
          <div className="bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400 text-sm p-3 rounded mb-4">
            {success}
          </div>
        )}

        {/* FORM */}

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            name="name"
            value={form.name}
            required
            placeholder="Full Name"
            onChange={handleChange}
            disabled={loading}
            className="input"
          />

          <input
            name="email"
            type="email"
            value={form.email}
            required
            placeholder="Email"
            onChange={handleChange}
            disabled={loading}
            className="input"
          />

          <input
            name="password"
            type="password"
            value={form.password}
            required
            placeholder="Password"
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
            {loading ? "Creating Account..." : "Register"}
          </button>
        </form>

        {/* LOGIN LINK */}

        <p className="text-center mt-4 text-sm text-gray-600 dark:text-gray-400">
          Already have an account?{" "}
          <Link
            to="/login"
            className="text-purple-600 dark:text-purple-400 font-semibold hover:underline"
          >
            Login
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Register;
