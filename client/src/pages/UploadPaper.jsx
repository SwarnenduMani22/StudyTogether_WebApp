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
  const [isDraftSaving, setIsDraftSaving] = useState(false);
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

        setStats({
          approved,
          pending,
          total: pending,
        });

        setLimitReached(pending >= 2);
      } catch {
        console.error("Failed to load user papers");
      }
    };

    if (user) loadUserStats();
  }, [user]);

  /* ================= AUTO REFRESH (FIXED) ================= */

  useEffect(() => {
    const interval = setInterval(() => {
      if (user) {
        api.get("/users/my-papers").then((res) => {
          const approved = res.data.approved || 0;
          const pending = res.data.pending || 0;

          setStats({
            approved,
            pending,
            total: pending,
          });

          setLimitReached(pending >= 2);
        });
      }
    }, 5000);

    return () => clearInterval(interval);
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

  const handleSubmit = async (e, isDraftSubmit = false) => {
    e.preventDefault();

    if (!title.trim()) return toast.error("Title required");
    if (!subject) return toast.error("Select subject");
    if (!semester) return toast.error("Select semester");
    if (!file) return toast.error("PDF required");

    if (!isDraftSubmit && limitReached && user?.role !== "admin") {
      return toast.error("Upload limit reached (max 2 pending papers)");
    }

    const formData = new FormData();

    formData.append("title", title.trim());
    formData.append("subject", normalizeSubject(subject));
    formData.append("semester", Number(semester));
    formData.append("pdf", file);
    if (isDraftSubmit) {
      formData.append("isDraft", "true");
    }

    try {
      setLoading(true);
      setIsDraftSaving(isDraftSubmit);
      for (const pair of formData.entries()) {
        console.log(pair[0], pair[1]);
      }
      await uploadPaper(formData);

      toast.success(
        isDraftSubmit
          ? "Draft saved successfully ✅"
          : user?.role === "admin"
            ? "Paper uploaded successfully ✅"
            : "Paper submitted for admin approval ⏳",
      );

      setTitle("");
      setSubject("");
      setSemester("");
      setFile(null);

      if (!isDraftSubmit && user?.role !== "admin") {
        setStats((prev) => {
          const newPending = prev.pending + 1;

          if (newPending >= 2) setLimitReached(true);

          return {
            ...prev,
            pending: newPending,
            total: newPending,
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
      setIsDraftSaving(false);
    }
  };

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-xl mx-auto card">
        <h2 className="text-2xl font-bold mb-2">
          {user?.role === "admin" ? "Admin Upload Paper" : "Upload Paper"}
        </h2>

        <p className="text-gray-500 text-sm mb-6">
          {user?.role === "admin"
            ? "Admin uploads are instantly approved."
            : "Your upload will be reviewed by admin."}
        </p>

        {user?.role !== "admin" && (
          <div className="flex gap-4 text-sm mb-6">
            <span className="text-green-500">Approved: {stats.approved}</span>
            <span className="text-yellow-500">Pending: {stats.pending}</span>
            <span>Used: {stats.pending} / 2</span>
          </div>
        )}

        {user?.role !== "admin" && (
          <p className="text-green-400 mb-4 text-sm">
            You can upload {Math.max(2 - stats.pending, 0)} more paper(s)
          </p>
        )}

        {limitReached && user?.role !== "admin" && (
          <div className="bg-red-100 text-red-600 p-3 rounded mb-6 text-center">
            Upload limit reached (Max 2 pending papers). You can still save drafts.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            className="input"
            placeholder="Paper Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={loading}
          />

          <select
            className="input"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            disabled={loading}
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
            disabled={loading}
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
            accept=".pdf,application/pdf"
            onChange={(e) => {
              console.log(e.target.files);
              setFile(e.target.files?.[0] || null);
            }}
            disabled={loading}
          />
          <p>{file?.name}</p>
          <div className="flex gap-4">
            <button
              type="submit"
              onClick={(e) => { e.preventDefault(); handleSubmit(e, false); }}
              disabled={loading || (limitReached && user?.role !== "admin")}
              className="btn-primary flex-1"
            >
              {loading && !isDraftSaving
                ? "Uploading..."
                : user?.role === "admin"
                  ? "Upload Paper"
                  : "Submit for Approval"}
            </button>
            {user?.role !== "admin" && (
              <button
                type="button"
                onClick={(e) => handleSubmit(e, true)}
                disabled={loading}
                className="bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2 px-4 rounded-xl flex-1 transition"
              >
                {loading && isDraftSaving ? "Saving..." : "Save Draft"}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default UploadPaper;
