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

    if (!title.trim()) {
      return toast.error("Title required");
    }

    if (!subject) {
      return toast.error("Select subject");
    }

    if (!semester) {
      return toast.error("Select semester");
    }

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

      if (user?.role === "admin") {
        toast.success("Paper uploaded successfully ✅");
      } else {
        toast.success("Paper submitted for admin approval ⏳");
      }

      /* reset form */

      setTitle("");
      setSubject("");
      setSemester("");
      setFile(null);

      /* update stats */

      if (user?.role !== "admin") {
        setStats((prev) => ({
          ...prev,
          pending: prev.pending + 1,
          total: prev.total + 1,
        }));
      }
    } catch (err) {
      const message = err?.response?.data?.error;

      if (message) {
        toast.error(message);
      } else {
        toast.error("Upload failed. Try again.");
      }
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

        {/* USER STATS */}

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
          {/* TITLE */}

          <input
            className="input"
            placeholder="Paper Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={limitReached && user?.role !== "admin"}
          />

          {/* SUBJECT */}

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

          {/* SEMESTER */}

          <select
            className="input"
            value={semester}
            onChange={(e) => setSemester(e.target.value)}
            disabled={limitReached && user?.role !== "admin"}
          >
            <option value="">Select Semester</option>
            <option value="1">Semester 1</option>
            <option value="2">Semester 2</option>
            <option value="3">Semester 3</option>
            <option value="4">Semester 4</option>
            <option value="5">Semester 5</option>
            <option value="6">Semester 6</option>
            <option value="7">Semester 7</option>
            <option value="8">Semester 8</option>
          </select>

          {/* FILE */}

          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setFile(e.target.files[0])}
            disabled={limitReached && user?.role !== "admin"}
          />

          {/* BUTTON */}

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
