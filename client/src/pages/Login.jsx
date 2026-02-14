import { useState } from "react";
import api from "../api/axios";
import { useNavigate, Link } from "react-router-dom";

const Login = () => {
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await api.post("/auth/login", form);

      localStorage.setItem("token", res.data.token);
      localStorage.setItem("user", JSON.stringify(res.data.user));

      navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.error || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center 
                    bg-gradient-to-br 
                    from-blue-500 to-indigo-600 
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
          Welcome Back 👋
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

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            required
            className="w-full p-3 border rounded-lg 
                       bg-white dark:bg-gray-700 
                       border-gray-300 dark:border-gray-600
                       text-gray-900 dark:text-white
                       focus:outline-none focus:ring-2 
                       focus:ring-blue-500 transition"
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />

          <input
            type="password"
            placeholder="Password"
            required
            className="w-full p-3 border rounded-lg 
                       bg-white dark:bg-gray-700 
                       border-gray-300 dark:border-gray-600
                       text-gray-900 dark:text-white
                       focus:outline-none focus:ring-2 
                       focus:ring-blue-500 transition"
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />

          <button
            disabled={loading}
            className={`w-full py-3 rounded-lg text-white transition ${
              loading
                ? "bg-blue-400 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        <p
          className="text-center mt-4 text-sm 
                      text-gray-600 dark:text-gray-400"
        >
          Don't have an account?{" "}
          <Link
            to="/register"
            className="text-blue-600 dark:text-blue-400 
                       font-semibold hover:underline"
          >
            Register
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
