import { useEffect, useState } from "react";
import api from "../api/axios";

import Skeleton from "../components/common/Skeleton";
import toast from "react-hot-toast";

const MyPapers = () => {
  const [papers, setPapers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [stats, setStats] = useState({
    total: 0,
    approved: 0,
    pending: 0,
  });

  /* ================= FETCH USER PAPERS ================= */

  const fetchMyPapers = async () => {
    try {
      setLoading(true);
      setError("");

      const res = await api.get("/users/my-papers");

      const data = res?.data || {};

      setPapers(data.papers || []);

      setStats({
        total: data.total || 0,
        approved: data.approved || 0,
        pending: data.pending || 0,
      });
    } catch (error) {
      console.error("My papers error:", error);

      setError("Failed to load your papers");
      toast.error("Failed to load papers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyPapers();
  }, []);

  /* ================= LOADING ================= */

  if (loading) {
    return (
      <div className="p-8 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  /* ================= ERROR ================= */

  if (error) {
    return <div className="p-8 text-center text-red-500">{error}</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 p-8">
      <div className="max-w-5xl mx-auto">
        {/* ================= HEADER ================= */}

        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800 dark:text-white">
            My Uploaded Papers
          </h1>

          <button
            onClick={fetchMyPapers}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded text-sm"
          >
            Refresh
          </button>
        </div>

        {/* ================= STATS ================= */}

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <div className="card text-center">
            <p className="text-gray-500">Total</p>
            <h2 className="text-2xl font-bold">{stats.total}</h2>
          </div>

          <div className="card text-center">
            <p className="text-gray-500">Approved</p>
            <h2 className="text-2xl font-bold text-green-500">
              {stats.approved}
            </h2>
          </div>

          <div className="card text-center">
            <p className="text-gray-500">Pending</p>
            <h2 className="text-2xl font-bold text-yellow-500">
              {stats.pending}
            </h2>
          </div>
        </div>

        {/* ================= PAPERS LIST ================= */}

        <div className="space-y-4">
          {papers.length === 0 && (
            <div className="text-center text-gray-500 dark:text-gray-400">
              You have not uploaded any papers yet.
            </div>
          )}

          {papers.map((paper) => (
            <div
              key={paper._id}
              className="card flex justify-between items-center"
            >
              <div>
                <h3 className="font-semibold text-gray-800 dark:text-white">
                  {paper.title}
                </h3>

                <p className="text-sm text-gray-500">
                  {paper.subject} • Semester {paper.semester}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <a
                  href={paper.pdfLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded text-sm"
                >
                  Preview
                </a>

                <span
                  className={`px-3 py-1 rounded text-sm
                  ${
                    paper.status === "approved"
                      ? "bg-green-100 text-green-600"
                      : "bg-yellow-100 text-yellow-600"
                  }`}
                >
                  {paper.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MyPapers;
