import { useState } from "react";
import { uploadPaper } from "../api/paper";

const AdminUpload = () => {
  const [form, setForm] = useState({
    title: "",
    subject: "",
    semester: "",
  });

  const [file, setFile] = useState(null);

  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [loading, setLoading] = useState(false);

  /* ================= Handle Submit ================= */

  const handleSubmit = async (e) => {
    e.preventDefault();

    setMessage("");
    setIsError(false);

    if (!file) {
      setIsError(true);
      return setMessage("Please upload a PDF file");
    }

    if (file.type !== "application/pdf") {
      setIsError(true);
      return setMessage("Only PDF files allowed");
    }

    const data = new FormData();

    data.append("title", form.title);
    data.append("subject", form.subject);
    data.append("semester", form.semester);
    data.append("pdf", file);

    setLoading(true);

    try {
      await uploadPaper(data);

      setMessage("✅ Paper uploaded successfully!");

      setForm({
        title: "",
        subject: "",
        semester: "",
      });

      setFile(null);
    } catch {
      setIsError(true);
      setMessage("Upload failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 p-8">
      <div className="max-w-md mx-auto card fade-in">
        <h2 className="text-2xl font-bold mb-6 text-gray-800 dark:text-white">
          Upload Paper
        </h2>

        {/* Message */}

        {message && (
          <div
            className={`mb-4 text-sm ${
              isError ? "text-red-500" : "text-green-500"
            }`}
          >
            {message}
          </div>
        )}

        {/* Form */}

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            placeholder="Paper Title"
            value={form.title}
            required
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="input"
          />

          {/* Subject */}

          <select
            value={form.subject}
            required
            onChange={(e) => setForm({ ...form, subject: e.target.value })}
            className="input"
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

          {/* Semester */}

          <select
            value={form.semester}
            required
            onChange={(e) => setForm({ ...form, semester: e.target.value })}
            className="input"
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

          {/* File */}

          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setFile(e.target.files[0])}
            className="w-full"
          />

          {/* Button */}

          <button
            disabled={loading}
            className={`btn-primary ${
              loading ? "opacity-60 cursor-not-allowed" : ""
            }`}
          >
            {loading ? "Uploading..." : "Upload Paper"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AdminUpload;
