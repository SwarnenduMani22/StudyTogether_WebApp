import { useState, useEffect } from "react";
import { uploadPaper } from "../api/paper";
import api from "../api/axios";
import toast from "react-hot-toast";

const UploadPaper = () => {
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [semester, setSemester] = useState("");
  const [file, setFile] = useState(null);

  const [loading, setLoading] = useState(false);

  /* ================= USER LIMIT ================= */

  const [limitReached, setLimitReached] = useState(false);

  const [stats, setStats] = useState({
    approved: 0,
    pending: 0,
    total: 0,
  });

  /* ================= LOAD USER PAPERS ================= */

  useEffect(() => {
    const loadUserStats = async () => {
      try {
        const res = await api.get("/users/my-papers");

        const data = res.data;

        const approved = data.approved || 0;
        const pending = data.pending || 0;

        const total = approved + pending;

        setStats({
          approved,
          pending,
          total,
        });

        if (total >= 2) {
          setLimitReached(true);
        }
      } catch (error) {
        console.error("Failed to load user papers");
      }
    };

    loadUserStats();
  }, []);

  /* ================= SUBMIT ================= */

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (limitReached) {
      return toast.error("Upload limit reached (max 2 papers)");
    }

    if (!file) {
      return toast.error("PDF required");
    }

    const formData = new FormData();

    formData.append("title", title);
    formData.append("subject", subject);
    formData.append("semester", semester);
    formData.append("pdf", file);

    try {
      setLoading(true);

      await uploadPaper(formData);

      toast.success("Paper uploaded for admin approval");

      setTitle("");
      setSubject("");
      setSemester("");
      setFile(null);
    } catch (err) {
      toast.error(err?.response?.data?.error || "Upload failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-xl mx-auto card">
        <h2 className="text-2xl font-bold mb-6">Upload Paper</h2>

        {/* USER UPLOAD STATUS */}

        <div className="flex gap-4 text-sm mb-6">
          <span className="text-green-500">Approved: {stats.approved}</span>

          <span className="text-yellow-500">Pending: {stats.pending}</span>

          <span>Used: {stats.total} / 2</span>
        </div>

        {/* LIMIT WARNING */}

        {limitReached && (
          <div className="bg-red-100 text-red-600 p-3 rounded mb-6">
            Upload limit reached (Max 2 papers)
          </div>
        )}

        {/* FORM */}

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            className="input"
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={limitReached}
          />

          <input
            className="input"
            placeholder="Subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            disabled={limitReached}
          />

          <input
            className="input"
            placeholder="Semester"
            value={semester}
            onChange={(e) => setSemester(e.target.value)}
            disabled={limitReached}
          />

          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setFile(e.target.files[0])}
            disabled={limitReached}
          />

          <button
            disabled={loading || limitReached}
            className="btn-primary w-full"
          >
            {loading ? "Uploading..." : "Upload Paper"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default UploadPaper;
