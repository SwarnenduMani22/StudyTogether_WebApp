import { useState } from "react";
import api from "../api/axios";
import { useNavigate } from "react-router-dom";
import Skeleton from "../components/Skeleton";
import { useAuth } from "../context/AuthContext";

const Profile = () => {
  const navigate = useNavigate();
  const { user, setUser } = useAuth();

  if (!user?._id) {
    return (
      <div className="p-8 space-y-3">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  const [form, setForm] = useState({
    name: user.name || "",
    password: "",
  });

  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
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

    setMessage("");
    setIsError(false);

    if (form.name.trim().length < 3) {
      setIsError(true);
      setMessage("Name must be at least 3 characters");
      return;
    }

    if (form.password && form.password.length < 6) {
      setIsError(true);
      setMessage("Password must be at least 6 characters");
      return;
    }

    setLoading(true);

    try {
      const res = await api.put("/users/update", form);

      setUser(res.data);
      localStorage.setItem("user", JSON.stringify(res.data));

      setMessage("✅ Profile updated successfully!");
      setForm({ ...form, password: "" });
    } catch (err) {
      setIsError(true);
      setMessage(err.response?.data?.error || "Update failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 p-8 transition-colors duration-300">
      <div className="max-w-lg mx-auto card fade-in">
        <h2 className="text-2xl font-bold mb-6 text-gray-800 dark:text-white">
          Update Profile
        </h2>

        {/* Message */}
        {message && (
          <div
            className={`mb-4 text-sm font-medium ${
              isError ? "text-red-500" : "text-green-500"
            }`}
          >
            {message}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <input
            name="name"
            value={form.name}
            onChange={handleChange}
            className="input"
            placeholder="Full Name"
          />

          {/* Email */}
          <input
            value={user.email}
            disabled
            className="input opacity-70 cursor-not-allowed"
          />

          {/* Password */}
          <input
            name="password"
            type="password"
            placeholder="New Password (optional)"
            value={form.password}
            onChange={handleChange}
            className="input"
          />

          {/* Button */}
          <button
            disabled={loading}
            className={`btn-primary ${
              loading ? "opacity-60 cursor-not-allowed" : ""
            }`}
          >
            {loading ? "Saving..." : "Save Changes"}
          </button>
        </form>

        {/* Delete Account */}
        <div className="mt-6 border-t pt-4">
          <button
            onClick={() => navigate("/")}
            className="w-full bg-red-500 hover:bg-red-600 text-white py-2 rounded-md transition"
          >
            Delete Account
          </button>
        </div>
      </div>
    </div>
  );
};

export default Profile;
