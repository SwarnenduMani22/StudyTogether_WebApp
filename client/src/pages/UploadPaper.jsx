import { useState, useEffect } from "react";
import { uploadPaper } from "../api/paper";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";

const UploadPaper = () => {
  const { user } = useAuth();

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

        /* Admin unlimited */

        if (user?.role !== "admin" && total >= 2) {
          setLimitReached(true);
        }
      } catch (error) {
        console.error("Failed to load user papers");
      }
    };

    loadUserStats();
  }, [user]);

  /* ================= SUBMIT ================= */

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!file) {
      return toast.error("PDF required");
    }

    if (limitReached && user?.role !== "admin") {
      return toast.error("Upload limit reached (max 2 papers)");
    }

    const formData = new FormData();

    formData.append("title", title);
    formData.append("subject", subject);
    formData.append("semester", semester);
    formData.append("pdf", file);

    try {
      setLoading(true);

      await uploadPaper(formData);

      /* success message */

      if (user?.role === "admin") {
        toast.success("Paper uploaded successfully ✅");
      } else {
        toast.success("Paper uploaded for admin approval ⏳");
      }

      /* reset */

      setTitle("");
      setSubject("");
      setSemester("");
      setFile(null);

      /* refresh stats */

      if (user?.role !== "admin") {
        setStats((prev) => ({
          ...prev,
          pending: prev.pending + 1,
          total: prev.total + 1,
        }));
      }
    } catch (err) {
      toast.error(err?.response?.data?.error || "Upload failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-xl mx-auto card">
        {/* TITLE */}

        <h2 className="text-2xl font-bold mb-2">
          {user?.role === "admin" ? "Admin Upload Paper" : "Upload Paper"}
        </h2>

        <p className="text-gray-500 text-sm mb-6">
          {user?.role === "admin"
            ? "Admin uploads are instantly approved."
            : "Your upload will be reviewed by admin."}
        </p>

        {/* USER UPLOAD STATUS */}

        {user?.role !== "admin" && (
          <div className="flex gap-4 text-sm mb-6">
            <span className="text-green-500">Approved: {stats.approved}</span>

            <span className="text-yellow-500">Pending: {stats.pending}</span>

            <span>Used: {stats.total} / 2</span>
          </div>
        )}

        {/* LIMIT WARNING */}

        {limitReached && user?.role !== "admin" && (
          <div className="bg-red-100 text-red-600 p-3 rounded mb-6">
            Upload limit reached (Max 2 papers)
          </div>
        )}

        {/* FORM */}

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            className="input"
            placeholder="Paper Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={limitReached && user?.role !== "admin"}
          />

          <input
            className="input"
            placeholder="Subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            disabled={limitReached && user?.role !== "admin"}
          />

          <input
            className="input"
            placeholder="Semester"
            value={semester}
            onChange={(e) => setSemester(e.target.value)}
            disabled={limitReached && user?.role !== "admin"}
          />

          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setFile(e.target.files[0])}
            disabled={limitReached && user?.role !== "admin"}
          />

          <button
            disabled={loading || (limitReached && user?.role !== "admin")}
            className="btn-primary w-full"
          >
            {loading
              ? "Uploading..."
              : user?.role === "admin"
                ? "Upload Paper"
                : "Submit for Approval"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default UploadPaper;
