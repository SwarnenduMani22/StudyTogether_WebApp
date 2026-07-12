import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Eye, EyeOff, Mail, Lock, ArrowRight, BookOpen } from "lucide-react";
//import { motion } from "framer-motion";

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

  const [showPassword, setShowPassword] = useState(false);

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

      login(user, accessToken);

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
      relative
      min-h-screen
      overflow-hidden
      bg-gradient-to-br
      
      from-slate-100
      via-blue-50
      to-indigo-100

      dark:from-slate-950
      dark:via-slate-900
      dark:to-black

      flex
      items-center
      justify-center
      px-4
      py-10
      "
    >
      {/* Background Blur Effect */}

      <div
        className="absolute -top-40 -left-32 h-[600px]
w-[600px] rounded-full bg-blue-500/30 blur-[120px]"
      />

      <div
        className="absolute bottom-0 right-0 h-[600px]
w-[600px] rounded-full bg-indigo-500/30 blur-[120px]"
      />

      {/* Main Container */}

      <div
        className="
        relative
        w-full
        max-w-7xl
xl:max-w-[1500px]
min-h-[780px]
        grid
        lg:grid-cols-2

        overflow-hidden

        rounded-3xl

        border
        border-white/20

        bg-white/70
dark:bg-slate-900/80

shadow-2xl
shadow-[0_25px_90px_rgba(37,99,235,.15)]
dark:shadow-[0_25px_90px_rgba(0,0,0,.65)]

        backdrop-blur-2xl

        shadow-2xl
        
        "
      >
        {/* ================= LEFT PANEL ================= */}

        <div
          className="
          hidden
          lg:flex

          flex-col
          justify-between

          p-14
          bg-gradient-to-br
from-blue-600
via-indigo-600
to-violet-700

          text-white
          "
        >
          <div>
            <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-white/20 backdrop-blur-md mb-8">
              <BookOpen size={32} />
            </div>

            <h1 className="text-5xl font-extrabold leading-tight">
              StudyTogether
            </h1>
          </div>
        </div>

        {/* ================= RIGHT PANEL ================= */}

        <div className="p-8 md:p-12 lg:p-16">
          <div className="max-w-lg mx-auto">
            <h2 className="text-4xl font-bold text-slate-800 dark:text-white">
              Welcome Back 👋
            </h2>

            <p className="mt-2 text-slate-500 dark:text-slate-400">
              Sign in to continue your learning journey.
            </p>

            {error && (
              <div
                className="
                mt-6
                rounded-xl
                border
                border-red-200
                dark:border-red-500/30

                bg-red-50
                dark:bg-red-500/10

                px-4
                py-3

                text-sm

                text-red-600
                dark:text-red-300
                "
              >
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-8 space-y-6">
              {/* EMAIL */}

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Email Address
                </label>

                <div
                  className="
flex
items-center
rounded-xl

border
border-slate-300
dark:border-slate-700

bg-white
dark:bg-slate-900

px-4
hover:border-blue-400
transition-all
duration-300

focus-within:border-blue-500
focus-within:ring-4
focus-within:ring-blue-500/20
"
                >
                  <Mail size={18} className="text-slate-400" />

                  <input
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    spellCheck={false}
                    disabled={loading}
                    value={form.email}
                    onChange={handleChange}
                    placeholder="Enter your email"
                    className="
                    w-full
                    bg-transparent
                    px-3
                    py-4
                    outline-none
                    text-slate-700
                    dark:text-white

                    placeholder:text-slate-400
                    "
                  />
                </div>
              </div>
              {/* PASSWORD */}

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Password
                </label>

                <div
                  className="
flex
items-center
rounded-xl

border
border-slate-300
dark:border-slate-700

bg-white
dark:bg-slate-900

px-4

transition-all
duration-300

focus-within:border-blue-500
focus-within:ring-4
focus-within:ring-blue-500/20
"
                >
                  <Lock size={18} className="text-slate-400" />

                  <input
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    spellCheck={false}
                    required
                    disabled={loading}
                    value={form.password}
                    onChange={handleChange}
                    placeholder="Enter your password"
                    className="
                    w-full
                    bg-transparent
                    px-3
                    py-4
                    outline-none

                    text-slate-700
                    dark:text-white

                    placeholder:text-slate-400
                    "
                  />

                  <button
                    type="button"
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                    onClick={() => setShowPassword(!showPassword)}
                    className="
                    text-slate-500
                    hover:text-blue-600
                    transition
                    "
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              {/* Remember + Forgot */}

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                  <input
                    type="checkbox"
                    className="
                    h-4
                    w-4
                    rounded
                    accent-blue-600
                    "
                  />
                  Remember Me
                </label>
              </div>

              {/* LOGIN BUTTON */}

              <button
                type="submit"
                disabled={loading}
                className="
                group

                flex
                items-center
                justify-center
                gap-2

                w-full

                rounded-2xl

                bg-gradient-to-r
                from-blue-600
                to-indigo-600

                py-4

                font-semibold
                text-white

                transition-all
                duration-300

                hover:scale-[1.02]
                hover:shadow-xl
hover:shadow-blue-500/30
hover:-translate-y-0.5
active:translate-y-0
                disabled:opacity-60
                disabled:cursor-not-allowed
                disabled:hover:scale-100
                "
              >
                {loading ? (
                  <>
                    <div
                      className="
                      h-5
                      w-5
                      rounded-full

                      border-2
                      border-white/40
                      border-t-white

                      animate-spin
                      "
                    />
                    Logging in...
                  </>
                ) : (
                  <>
                    Login
                    <ArrowRight
                      size={18}
                      className="
transition-transform
group-hover:translate-x-1
"
                    />
                  </>
                )}
              </button>
            </form>

            {/* Register */}

            <p
              className="
              mt-8
              text-center

              text-sm

              text-slate-600
              dark:text-slate-400
              "
            >
              Don't have an account?{" "}
              <Link
                to="/register"
                className="
                font-semibold

                text-blue-600
                dark:text-blue-400

                hover:underline
                "
              >
                Create Account
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
