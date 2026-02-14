import { useState } from "react";
import api from "../api/axios";
import { Link, useNavigate } from "react-router-dom";

const Register = () => {
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
  });

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      await api.post("/auth/register", form);

      setSuccess("Registration successful! Redirecting...");

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
                 transition-colors duration-300"
    >
      <div
        className="w-96 p-8 rounded-2xl shadow-xl 
                   bg-white/90 dark:bg-gray-800/90 
                   backdrop-blur-md
                   border border-gray-200 dark:border-gray-700"
      >
        <h2
          className="text-2xl font-bold text-center mb-6 
                     text-gray-800 dark:text-white"
        >
          Create Account 🚀
        </h2>

        {error && (
          <div
            className="bg-red-100 dark:bg-red-900/40 
                       text-red-600 dark:text-red-400 
                       text-sm p-2 rounded mb-4"
          >
            {error}
          </div>
        )}

        {success && (
          <div
            className="bg-green-100 dark:bg-green-900/40 
                       text-green-600 dark:text-green-400 
                       text-sm p-2 rounded mb-4"
          >
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            required
            placeholder="Full Name"
            className="w-full p-3 border rounded-lg
                       bg-white dark:bg-gray-700
                       border-gray-300 dark:border-gray-600
                       text-gray-900 dark:text-white
                       focus:outline-none focus:ring-2
                       focus:ring-purple-500 transition"
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />

          <input
            required
            type="email"
            placeholder="Email"
            className="w-full p-3 border rounded-lg
                       bg-white dark:bg-gray-700
                       border-gray-300 dark:border-gray-600
                       text-gray-900 dark:text-white
                       focus:outline-none focus:ring-2
                       focus:ring-purple-500 transition"
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />

          <input
            required
            type="password"
            placeholder="Password"
            className="w-full p-3 border rounded-lg
                       bg-white dark:bg-gray-700
                       border-gray-300 dark:border-gray-600
                       text-gray-900 dark:text-white
                       focus:outline-none focus:ring-2
                       focus:ring-purple-500 transition"
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />

          <button
            disabled={loading}
            className={`w-full py-3 rounded-lg text-white transition ${
              loading
                ? "bg-purple-400 cursor-not-allowed"
                : "bg-purple-600 hover:bg-purple-700"
            }`}
          >
            {loading ? "Creating Account..." : "Register"}
          </button>
        </form>

        <p
          className="text-center mt-4 text-sm 
                      text-gray-600 dark:text-gray-400"
        >
          Already have an account?{" "}
          <Link
            to="/login"
            className="text-purple-600 dark:text-purple-400 
                       font-semibold hover:underline"
          >
            Login
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Register;
