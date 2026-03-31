import { useEffect, useState } from "react";

import api from "../api/axios";
import useAuth from "../hooks/useAuth";

import PaperCard from "../components/papers/PaperCard";
import Skeleton from "../components/common/Skeleton";

import toast from "react-hot-toast";

const Bookmarks = () => {
  const { user } = useAuth();

  const [papers, setPapers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  /* ================= FETCH BOOKMARKS ================= */

  const fetchBookmarks = async () => {
    try {
      setLoading(true);
      setError("");

      const res = await api.get("/users/profile");

      const bookmarks = res?.data?.user?.bookmarks || [];

      setPapers(Array.isArray(bookmarks) ? bookmarks : []);
    } catch (err) {
      console.error("Bookmark fetch error:", err);

      setError("Failed to load bookmarks");

      toast.error("Failed to load bookmarks");
    } finally {
      setLoading(false);
    }
  };

  /* ================= LOAD DATA ================= */

  useEffect(() => {
    if (user?._id) {
      fetchBookmarks();
    }
  }, [user?._id]);

  /* ================= LOADING ================= */

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 p-8">
        <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-6">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    );
  }

  /* ================= ERROR ================= */

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 p-8 text-center">
        <p className="text-red-500 font-medium">{error}</p>

        <button
          onClick={fetchBookmarks}
          className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded"
        >
          Retry
        </button>
      </div>
    );
  }

  /* ================= EMPTY ================= */

  if (!papers || papers.length === 0) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 p-8">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-4">
            Saved Papers 🔖
          </h1>

          <p className="text-gray-500 dark:text-gray-400">
            You have not bookmarked any papers yet.
          </p>
        </div>
      </div>
    );
  }

  /* ================= RENDER ================= */

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-gray-800 dark:text-white">
            Saved Papers 🔖
          </h1>

          <button
            onClick={fetchBookmarks}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded text-sm"
          >
            Refresh
          </button>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {papers.map((paper) => (
            <PaperCard key={paper._id} paper={paper} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default Bookmarks;
