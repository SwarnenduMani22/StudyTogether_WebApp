import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import {
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  BookOpen,
} from "lucide-react";

import api from "../api/axios";
import toast from "react-hot-toast";
const getPasswordStrength = (password) => {
  if (!password) return null;

  let score = 0;

  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  const levels = [
    {
      text: "Weak",
      color: "bg-red-500",
      width: "w-1/3",
      textColor: "text-red-500",
    },
    {
      text: "Medium",
      color: "bg-yellow-500",
      width: "w-2/3",
      textColor: "text-yellow-500",
    },
    {
      text: "Strong",
      color: "bg-green-500",
      width: "w-full",
      textColor: "text-green-500",
    },
  ];

  return levels[Math.min(score - 1, 2)] ?? levels[0];
};
const Register = () => {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
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

  const passwordStrength = useMemo(
    () => getPasswordStrength(form.password),
    [form.password],
  );
  /* ================= SUBMIT ================= */

  const handleSubmit = async (e) => {
    e.preventDefault();

    setError("");
    setSuccess("");

    const trimmedName = form.name.trim();
    if (!agreeTerms) {
      return setError("Please accept the Terms & Privacy Policy.");
    }
    if (trimmedName.length < 3) {
      return setError("Name must be at least 3 characters");
    }

    if (form.password.length < 8) {
      return setError("Password must be at least 8 characters");
    }
    const strongPassword = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

    if (!strongPassword.test(form.password)) {
      return setError(
        "Password must contain at least one uppercase letter, one number and one special character.",
      );
    }
    if (form.password !== form.confirmPassword) {
      return setError("Passwords do not match");
    }

    setLoading(true);

    try {
      await api.post("/auth/register", {
        name: trimmedName,
        email: form.email.trim(),
        password: form.password,
      });

      toast.success("Account created 🎉");

      setSuccess("Registration successful! Redirecting...");

      setForm({
        name: "",
        email: "",
        password: "",
        confirmPassword: "",
      });
      setAgreeTerms(false);
      setShowPassword(false);
      setShowConfirmPassword(false);
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
      {/* Background Blur */}

      <div className="absolute -top-40 -left-32 h-[600px] w-[600px] rounded-full bg-blue-500/30 blur-[120px]" />

      <div className="absolute bottom-0 right-0 h-[600px] w-[600px] rounded-full bg-indigo-500/30 blur-[120px]" />

      {/* Main Card */}

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

        backdrop-blur-2xl

        shadow-2xl
        shadow-[0_25px_90px_rgba(37,99,235,.15)]
        dark:shadow-[0_25px_90px_rgba(0,0,0,.65)]
        "
      >
        {/* LEFT PANEL */}

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
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-md mb-8">
              <BookOpen size={32} />
            </div>

            <h1 className="text-5xl font-extrabold leading-tight">
              StudyTogether
            </h1>
          </div>
        </div>

        {/* RIGHT PANEL */}

        <div className="p-8 md:p-12 lg:p-16">
          <div className="max-w-lg mx-auto">
            <h2 className="text-4xl font-bold text-slate-800 dark:text-white">
              Create Account 🚀
            </h2>
            <p className="mt-2 text-slate-500 dark:text-slate-400">
              Join StudyTogether and start your smarter learning journey.
            </p>
            {error && (
              <div className="mt-6 rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">
                {error}
              </div>
            )}
            {success && (
              <div className="mt-6 rounded-xl border border-green-200 dark:border-green-500/30 bg-green-50 dark:bg-green-500/10 px-4 py-3 text-sm text-green-600 dark:text-green-300">
                {success}
              </div>
            )}
            <form onSubmit={handleSubmit} className="mt-8 space-y-6">
              {" "}
              {/* ================= NAME ================= */}
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Full Name
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

                  hover:border-blue-400

                  focus-within:border-blue-500
                  focus-within:ring-4
                  focus-within:ring-blue-500/20
                  "
                >
                  <User size={18} className="text-slate-400" />

                  <input
                    name="name"
                    maxLength={60}
                    value={form.name}
                    onChange={handleChange}
                    required
                    disabled={loading}
                    spellCheck={false}
                    autoComplete="name"
                    autoCorrect="off"
                    placeholder="Enter your full name"
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
              {/* ================= EMAIL ================= */}
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

                  transition-all
                  duration-300

                  hover:border-blue-400

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
                    autoCapitalize="none"
                    autoCorrect="off"
                    value={form.email}
                    onChange={handleChange}
                    required
                    disabled={loading}
                    spellCheck={false}
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
              {/* ================= PASSWORD ================= */}
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

                  hover:border-blue-400

                  focus-within:border-blue-500
                  focus-within:ring-4
                  focus-within:ring-blue-500/20
                  "
                >
                  <Lock size={18} className="text-slate-400" />

                  <input
                    name="password"
                    type={showPassword ? "text" : "password"}
                    minLength={8}
                    autoComplete="new-password"
                    value={form.password}
                    onChange={handleChange}
                    required
                    disabled={loading}
                    spellCheck={false}
                    placeholder="Create a password"
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
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-slate-500 hover:text-blue-600 transition"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>
              {passwordStrength && (
                <div className="mt-2">
                  <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700">
                    <div
                      className={`h-2 rounded-full transition-all duration-300 ${passwordStrength.width} ${passwordStrength.color}`}
                    />
                  </div>

                  <p className={`mt-1 text-xs ${passwordStrength.textColor}`}>
                    Password Strength : {passwordStrength.text}
                  </p>
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    Password should contain:
                  </p>

                  <ul className="mt-1 ml-5 list-disc text-xs text-slate-500 dark:text-slate-400 space-y-1">
                    <li>Minimum 8 characters</li>
                    <li>One uppercase letter</li>
                    <li>One number</li>
                    <li>One special character</li>
                  </ul>
                </div>
              )}
              {/* ================= CONFIRM PASSWORD ================= */}
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Confirm Password
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

                  hover:border-blue-400

                  focus-within:border-blue-500
                  focus-within:ring-4
                  focus-within:ring-blue-500/20
                  "
                >
                  <Lock size={18} className="text-slate-400" />

                  <input
                    name="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    minLength={8}
                    autoComplete="new-password"
                    value={form.confirmPassword}
                    onChange={handleChange}
                    required
                    disabled={loading}
                    spellCheck={false}
                    placeholder="Confirm your password"
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
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="text-slate-500 hover:text-blue-600 transition"
                  >
                    {showConfirmPassword ? (
                      <EyeOff size={20} />
                    ) : (
                      <Eye size={20} />
                    )}
                  </button>
                </div>
              </div>
              {form.confirmPassword.length > 0 && (
                <p
                  className={`mt-3 text-sm font-medium ${
                    form.password === form.confirmPassword
                      ? "text-green-500"
                      : "text-red-500"
                  }`}
                >
                  {form.password === form.confirmPassword
                    ? "✔ Passwords Match"
                    : "✖ Passwords Do Not Match"}
                </p>
              )}
              <div className="flex items-start gap-3">
                <input
                  id="agreeTerms"
                  type="checkbox"
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                  className="mt-1 h-4 w-4 accent-blue-600"
                />

                <label
                  htmlFor="agreeTerms"
                  className="text-sm text-slate-600 dark:text-slate-400"
                >
                  {" "}
                  I agree to the{" "}
                  <Link
                    to="/terms"
                    className="font-medium text-blue-600 hover:underline"
                  >
                    Terms
                  </Link>{" "}
                  and{" "}
                  <Link
                    to="/privacy"
                    className="font-medium text-blue-600 hover:underline"
                  >
                    Privacy Policy
                  </Link>
                </label>
              </div>
              {/* ================= CREATE ACCOUNT BUTTON ================= */}
              <button
                type="submit"
                disabled={loading || !agreeTerms}
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
                    Creating Account...
                  </>
                ) : (
                  <>
                    Create Account
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

            {/* ================= LOGIN LINK ================= */}
            <p
              className="
              mt-8

              text-center

              text-sm

              text-slate-600
              dark:text-slate-400
              "
            >
              Already have an account?{" "}
              <Link
                to="/login"
                className="
                font-semibold

                text-blue-600
                dark:text-blue-400

                hover:underline
                "
              >
                Login
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
