import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

import api from "../api/axios";
import useAuth from "../hooks/useAuth";

import Skeleton from "../components/common/Skeleton";
import toast from "react-hot-toast";

const Profile = () => {
  const navigate = useNavigate();

  const { user, setUser } = useAuth();

  const [form, setForm] = useState({
    name: user?.name || "",
    password: "",
  });

  const [loading, setLoading] = useState(false);

  /* ================= USER PAPERS ================= */

  const [myPapers, setMyPapers] = useState([]);
  const [paperStats, setPaperStats] = useState({
    approved: 0,
    pending: 0,
    total: 0,
  });

  const [bookmarksCount, setBookmarksCount] = useState(0);
  const [paperLoading, setPaperLoading] = useState(true);

  /* ================= LOAD USER DATA ================= */

  const fetchProfileData = async () => {
    try {
      setPaperLoading(true);

      const [papersRes, profileRes] = await Promise.all([
        api.get("/users/my-papers"),
        api.get("/users/profile"),
      ]);

      const papersData = papersRes?.data || {};
      const profileData = profileRes?.data || {};

      setMyPapers(papersData.papers || []);

      setPaperStats({
        approved: papersData.approved || 0,
        pending: papersData.pending || 0,
        total: papersData.total || 0,
      });

      setBookmarksCount(profileData?.bookmarks?.length || 0);
    } catch (error) {
      console.error("Profile load failed:", error);
    } finally {
      setPaperLoading(false);
    }
  };

  useEffect(() => {
    if (user?._id) {
      fetchProfileData();
    }
  }, [user?._id]);

  /* ================= LOADING STATE ================= */

  if (!user?._id) {
    return (
      <div className="p-8 space-y-3">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  /* ================= HANDLE INPUT ================= */

  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  /* ================= UPDATE PROFILE ================= */

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (form.name.trim().length < 3) {
      return toast.error("Name must be at least 3 characters");
    }

    if (form.password && form.password.length < 6) {
      return toast.error("Password must be at least 6 characters");
    }

    setLoading(true);

    try {
      const res = await api.put("/users/update", {
        name: form.name.trim(),
        password: form.password,
      });

      const updatedUser = res?.data?.user;

      setUser(updatedUser);

      sessionStorage.setItem("user", JSON.stringify(updatedUser));

      toast.success("Profile updated successfully");

      setForm((prev) => ({
        ...prev,
        password: "",
      }));
    } catch (err) {
      const message =
        err?.response?.data?.error || err?.message || "Update failed";

      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  /* ================= DELETE ACCOUNT ================= */

  const handleDelete = async () => {
    const confirmDelete = window.confirm(
      "Are you sure you want to delete your account?",
    );

    if (!confirmDelete) return;

    try {
      await api.delete("/users/delete");

      sessionStorage.clear();

      toast.success("Account deleted");

      navigate("/");
    } catch {
      toast.error("Failed to delete account");
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 p-8">
      <div className="max-w-lg mx-auto card">
        <h2 className="text-2xl font-bold mb-6 text-gray-800 dark:text-white">
          Update Profile
        </h2>

        {/* ================= PROFILE FORM ================= */}

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            name="name"
            value={form.name}
            onChange={handleChange}
            disabled={loading}
            className="input"
            placeholder="Full Name"
          />

          <input
            value={user.email}
            disabled
            className="input opacity-70 cursor-not-allowed"
          />

          <input
            name="password"
            type="password"
            placeholder="New Password (optional)"
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
            {loading ? "Saving..." : "Save Changes"}
          </button>
        </form>

        {/* ================= DELETE ACCOUNT ================= */}

        <div className="mt-6 border-t pt-4">
          <button
            onClick={handleDelete}
            className="w-full bg-red-500 hover:bg-red-600 text-white py-2 rounded-md"
          >
            Delete Account
          </button>
        </div>

        {/* ================= USER STATS ================= */}

        <div className="mt-8 border-t pt-6">
          <h3 className="text-lg font-semibold mb-3 text-gray-800 dark:text-white">
            My Activity
          </h3>

          <div className="grid grid-cols-2 gap-4 text-sm mb-4">
            <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded">
              Uploaded Papers
              <div className="font-bold">{paperStats.total}</div>
            </div>

            <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded">
              Bookmarks
              <div className="font-bold">{bookmarksCount}</div>
            </div>

            <div className="bg-green-100 dark:bg-green-900 p-3 rounded">
              Approved
              <div className="font-bold">{paperStats.approved}</div>
            </div>

            <div className="bg-yellow-100 dark:bg-yellow-900 p-3 rounded">
              Pending
              <div className="font-bold">{paperStats.pending}</div>
            </div>
          </div>

          {/* ================= PAPER LIST ================= */}

          {paperLoading && (
            <p className="text-gray-500 text-sm">Loading papers...</p>
          )}

          {!paperLoading && myPapers.length === 0 && (
            <p className="text-gray-500 text-sm">No uploaded papers</p>
          )}

          <div className="space-y-2">
            {myPapers.map((p) => (
              <div
                key={p._id}
                className="flex justify-between bg-gray-100 dark:bg-gray-800 p-3 rounded"
              >
                <span>{p.title}</span>

                <span
                  className={`text-xs px-2 py-1 rounded
                  ${
                    p.status === "approved"
                      ? "bg-green-200 text-green-700"
                      : "bg-yellow-200 text-yellow-700"
                  }`}
                >
                  {p.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
