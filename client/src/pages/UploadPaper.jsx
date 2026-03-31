import { useState, useEffect } from "react";
import { uploadPaper } from "../api/paper";
import api from "../api/axios";
import useAuth from "../hooks/useAuth";
import toast from "react-hot-toast";

const UploadPaper = () => {
  const { user } = useAuth();

  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [semester, setSemester] = useState("");
  const [file, setFile] = useState(null);

  const [loading, setLoading] = useState(false);

  const [limitReached, setLimitReached] = useState(false);

  const [stats, setStats] = useState({
    approved: 0,
    pending: 0,
    total: 0,
  });

  /* ================= LOAD USER STATS ================= */

  useEffect(() => {
    const loadUserStats = async () => {
      try {
        const res = await api.get("/users/my-papers");

        const data = res.data;

        const approved = data.approved || 0;
        const pending = data.pending || 0;
        const total = approved + pending;

        setStats({ approved, pending, total });

        if (user?.role !== "admin" && total >= 2) {
          setLimitReached(true);
        }
      } catch {
        console.error("Failed to load user papers");
      }
    };

    if (user) loadUserStats();
  }, [user]);

  /* ================= NORMALIZE SUBJECT ================= */

  const normalizeSubject = (value) => {
    const map = {
      "data structure": "Data Structure",
      "operating system": "Operating System",
      dbms: "DBMS",
      "computer network": "Computer Network",
      "software engineering": "Software Engineering",
      "artificial intelligence": "Artificial Intelligence",
    };

    return map[value?.toLowerCase()] || value;
  };

  /* ================= SUBMIT ================= */

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!title.trim()) return toast.error("Title required");
    if (!subject) return toast.error("Select subject");
    if (!semester) return toast.error("Select semester");
    if (!file) return toast.error("PDF required");

    if (limitReached && user?.role !== "admin") {
      return toast.error("Upload limit reached (max 2 papers)");
    }

    const formData = new FormData();

    formData.append("title", title.trim());
    formData.append("subject", normalizeSubject(subject));
    formData.append("semester", Number(semester));
    formData.append("pdf", file);

    try {
      setLoading(true);

      await uploadPaper(formData);

      toast.success(
        user?.role === "admin"
          ? "Paper uploaded successfully ✅"
          : "Paper submitted for admin approval ⏳",
      );

      /* RESET FORM */
      setTitle("");
      setSubject("");
      setSemester("");
      setFile(null);

      /* UPDATE STATS */
      if (user?.role !== "admin") {
        setStats((prev) => {
          const newTotal = prev.total + 1;

          if (newTotal >= 2) setLimitReached(true);

          return {
            ...prev,
            pending: prev.pending + 1,
            total: newTotal,
          };
        });
      }
    } catch (err) {
      const message = err?.message || "Upload failed";

      if (message.toLowerCase().includes("limit")) {
        setLimitReached(true);
      }

      toast.error(message);
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

        {/* STATS */}
        {user?.role !== "admin" && (
          <div className="flex gap-4 text-sm mb-6">
            <span className="text-green-500">Approved: {stats.approved}</span>
            <span className="text-yellow-500">Pending: {stats.pending}</span>
            <span>Used: {stats.total} / 2</span>
          </div>
        )}

        {/* LIMIT */}
        {limitReached && user?.role !== "admin" && (
          <div className="bg-red-100 text-red-600 p-3 rounded mb-6 text-center">
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

          <select
            className="input"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            disabled={limitReached && user?.role !== "admin"}
          >
            <option value="">Select Subject</option>
            <option value="Data Structure">Data Structure</option>
            <option value="Operating System">Operating System</option>
            <option value="DBMS">DBMS</option>
            <option value="Computer Network">Computer Network</option>
            <option value="Software Engineering">Software Engineering</option>
            <option value="Artificial Intelligence">
              Artificial Intelligence
            </option>
          </select>

          <select
            className="input"
            value={semester}
            onChange={(e) => setSemester(e.target.value)}
            disabled={limitReached && user?.role !== "admin"}
          >
            <option value="">Select Semester</option>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
              <option key={s} value={s}>
                Semester {s}
              </option>
            ))}
          </select>

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
