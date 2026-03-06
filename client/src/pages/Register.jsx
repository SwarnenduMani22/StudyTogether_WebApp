import { useState } from "react";
import api from "../api/axios";
import { Link, useNavigate } from "react-router-dom";

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

  /* ================= Handle Input ================= */

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  /* ================= Submit ================= */

  const handleSubmit = async (e) => {
    e.preventDefault();

    setError("");
    setSuccess("");

    if (form.password.length < 6) {
      return setError("Password must be at least 6 characters");
    }

    setLoading(true);

    try {
      await api.post("/auth/register", form);

      setSuccess("✅ Registration successful! Redirecting...");

      setForm({
        name: "",
        email: "",
        password: "",
      });

      setTimeout(() => {
        navigate("/login");
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.error || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center
      bg-gradient-to-br
      from-purple-500 to-pink-600
      dark:from-gray-900 dark:to-gray-800
      p-4"
    >
      <div
        className="w-full max-w-md p-8 rounded-2xl shadow-xl
        bg-white/90 dark:bg-gray-800/90
        backdrop-blur-md
        border border-gray-200 dark:border-gray-700
        fade-in"
      >
        <h2 className="text-2xl font-bold text-center mb-6 text-gray-800 dark:text-white">
          Create Account 🚀
        </h2>

        {/* Error */}
        {error && (
          <div className="bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 text-sm p-2 rounded mb-4">
            {error}
          </div>
        )}

        {/* Success */}
        {success && (
          <div className="bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400 text-sm p-2 rounded mb-4">
            {success}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            name="name"
            value={form.name}
            required
            placeholder="Full Name"
            className="input"
            onChange={handleChange}
          />

          <input
            name="email"
            type="email"
            value={form.email}
            required
            placeholder="Email"
            className="input"
            onChange={handleChange}
          />

          <input
            name="password"
            type="password"
            value={form.password}
            required
            placeholder="Password"
            className="input"
            onChange={handleChange}
          />

          <button
            disabled={loading}
            className={`btn-primary ${
              loading ? "opacity-60 cursor-not-allowed" : ""
            }`}
          >
            {loading ? "Creating Account..." : "Register"}
          </button>
        </form>

        {/* Login Link */}
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
