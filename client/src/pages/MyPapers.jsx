import { useEffect, useState } from "react";
import api from "../api/axios";
import resolvePdfUrl from "../utils/resolvePdfUrl";

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

  const [editingPaper, setEditingPaper] = useState(null);
  const [editForm, setEditForm] = useState({
    title: "",
    subject: "",
    semester: "",
    file: null,
  });
  const [editLoading, setEditLoading] = useState(false);

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

  /* ================= HANDLERS ================= */

  const handleEditClick = (paper) => {
    setEditingPaper(paper);
    setEditForm({
      title: paper.title,
      subject: paper.subject,
      semester: paper.semester,
      file: null,
    });
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editForm.title.trim()) return toast.error("Title is required");
    if (!editForm.subject) return toast.error("Subject is required");
    if (!editForm.semester) return toast.error("Semester is required");

    setEditLoading(true);
    try {
      const formData = new FormData();
      formData.append("title", editForm.title.trim());
      formData.append("subject", editForm.subject);
      formData.append("semester", Number(editForm.semester));
      if (editForm.file) {
        formData.append("pdf", editForm.file);
      }

      await api.put(`/papers/${editingPaper._id}`, formData);
      toast.success("Paper updated successfully ✅");
      setEditingPaper(null);
      fetchMyPapers();
    } catch (err) {
      console.error(err);
      toast.error(err?.response?.data?.error || "Failed to update paper");
    } finally {
      setEditLoading(false);
    }
  };

  const handlePublish = async (paperId) => {
    const confirmPublish = window.confirm("Are you sure you want to publish this draft for admin review?");
    if (!confirmPublish) return;

    try {
      await api.put(`/papers/${paperId}`, { isDraft: false });
      toast.success("Draft published successfully for review ⏳");
      fetchMyPapers();
    } catch (err) {
      console.error(err);
      toast.error(err?.response?.data?.error || "Failed to publish draft");
    }
  };

  const handleDelete = async (paperId) => {
    const confirmDelete = window.confirm("Are you sure you want to delete this paper?");
    if (!confirmDelete) return;

    try {
      await api.delete(`/papers/${paperId}`);
      toast.success("Paper deleted successfully");
      fetchMyPapers();
    } catch (err) {
      console.error(err);
      toast.error(err?.response?.data?.error || "Failed to delete paper");
    }
  };

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
              className="card flex flex-col sm:flex-row justify-between sm:items-center gap-4"
            >
              <div>
                <h3 className="font-semibold text-gray-800 dark:text-white">
                  {paper.title}
                </h3>

                <p className="text-sm text-gray-500">
                  {paper.subject} • Semester {paper.semester}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {paper.status !== "draft" ? (
                  <a
                    href={resolvePdfUrl(paper.pdfLink)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded text-sm"
                  >
                    Preview
                  </a>
                ) : (
                  <>
                    <button
                      onClick={() => handlePublish(paper._id)}
                      className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm"
                    >
                      Publish
                    </button>
                    <button
                      onClick={() => handleEditClick(paper)}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(paper._id)}
                      className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm"
                    >
                      Delete
                    </button>
                  </>
                )}

                <span
                  className={`px-3 py-1 rounded text-sm capitalize
                  ${
                    paper.status === "approved"
                      ? "bg-green-100 text-green-600"
                      : paper.status === "pending"
                      ? "bg-yellow-100 text-yellow-600"
                      : "bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                  }`}
                >
                  {paper.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ================= EDIT MODAL ================= */}
      {editingPaper && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <h3 className="text-xl font-bold mb-4 text-gray-800 dark:text-white">
              Edit Draft Paper
            </h3>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Title
                </label>
                <input
                  className="input w-full"
                  placeholder="Paper Title"
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Subject
                </label>
                <select
                  className="input w-full"
                  value={editForm.subject}
                  onChange={(e) => setEditForm({ ...editForm, subject: e.target.value })}
                >
                  <option value="Data Structure">Data Structure</option>
                  <option value="Operating System">Operating System</option>
                  <option value="DBMS">DBMS</option>
                  <option value="Computer Network">Computer Network</option>
                  <option value="Software Engineering">Software Engineering</option>
                  <option value="Artificial Intelligence">Artificial Intelligence</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Semester
                </label>
                <select
                  className="input w-full"
                  value={editForm.semester}
                  onChange={(e) => setEditForm({ ...editForm, semester: Number(e.target.value) })}
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                    <option key={s} value={s}>
                      Semester {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                  PDF File (optional)
                </label>
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={(e) => setEditForm({ ...editForm, file: e.target.files?.[0] || null })}
                  className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                />
                {editForm.file && <p className="text-xs text-gray-500 mt-1">{editForm.file.name}</p>}
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={editLoading}
                  className="btn-primary flex-1"
                >
                  {editLoading ? "Saving..." : "Save Changes"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingPaper(null)}
                  disabled={editLoading}
                  className="bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-white font-semibold py-2 px-4 rounded-xl flex-1 transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyPapers;
