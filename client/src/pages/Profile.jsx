import { useState } from "react";
import api from "../api/axios";
import { useNavigate } from "react-router-dom";

const Profile = () => {
  const navigate = useNavigate();
  const storedUser = JSON.parse(localStorage.getItem("user"));

  if (!storedUser?._id) {
    return (
      <div className="min-h-screen flex items-center justify-center text-red-500">
        User not found. Please login again.
      </div>
    );
  }

  const [form, setForm] = useState({
    name: storedUser.name || "",
    password: "",
  });

  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [loading, setLoading] = useState(false);

  /* ================= UPDATE PROFILE ================= */
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

      localStorage.setItem("user", JSON.stringify(res.data));

      setMessage("✅ Profile updated successfully!");
      setForm({ ...form, password: "" });
    } catch (err) {
      setIsError(true);
      setMessage(err.response?.data?.error || "❌ Update failed!");
    } finally {
      setLoading(false);
    }
  };

  /* ================= DELETE ACCOUNT ================= */
  const handleDeleteAccount = async () => {
    const confirmDelete = window.confirm(
      "Are you sure you want to delete your account?",
    );
    if (!confirmDelete) return;

    try {
      await api.delete("/users/delete");

      localStorage.removeItem("token");
      localStorage.removeItem("user");

      navigate("/");
    } catch (error) {
      alert(error.response?.data?.error || "Delete failed");
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 p-8 transition-colors duration-300">
      <div className="max-w-lg mx-auto bg-white dark:bg-gray-800 shadow-xl rounded-xl p-6 border border-gray-200 dark:border-gray-700">
        <h2 className="text-2xl font-bold mb-6 text-gray-800 dark:text-white">
          Update Profile
        </h2>

        {message && (
          <div
            className={`mb-4 text-sm font-medium ${
              isError ? "text-red-500" : "text-indigo-600 dark:text-indigo-400"
            }`}
          >
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label className="block mb-1 text-sm text-gray-600 dark:text-gray-300">
              Name
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 border rounded-md 
                         bg-white dark:bg-gray-700 
                         border-gray-300 dark:border-gray-600 
                         text-gray-900 dark:text-white"
              required
            />
          </div>

          {/* Email */}
          <div>
            <label className="block mb-1 text-sm text-gray-600 dark:text-gray-300">
              Email
            </label>
            <input
              type="email"
              value={storedUser.email}
              disabled
              className="w-full px-3 py-2 border rounded-md 
                         bg-gray-100 dark:bg-gray-700 
                         text-gray-500 cursor-not-allowed"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block mb-1 text-sm text-gray-600 dark:text-gray-300">
              New Password (Optional)
            </label>
            <input
              type="password"
              placeholder="Enter new password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full px-3 py-2 border rounded-md 
                         bg-white dark:bg-gray-700 
                         border-gray-300 dark:border-gray-600 
                         text-gray-900 dark:text-white"
            />
          </div>

          <button
            disabled={loading}
            className={`w-full py-2 rounded-md text-white transition ${
              loading
                ? "bg-indigo-400 cursor-not-allowed"
                : "bg-indigo-600 hover:bg-indigo-700"
            }`}
          >
            {loading ? "Saving..." : "Save Changes"}
          </button>
        </form>

        {/* Delete Account */}
        <div className="mt-6 border-t pt-4">
          <button
            onClick={handleDeleteAccount}
            className="w-full bg-red-500 hover:bg-red-600 text-white py-2 rounded-md transition"
          >
            Delete My Account
          </button>
        </div>
      </div>
    </div>
  );
};

export default Profile;
