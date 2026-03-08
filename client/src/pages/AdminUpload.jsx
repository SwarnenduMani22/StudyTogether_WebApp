import { useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import { uploadPaper } from "../api/paper";

const AdminUpload = () => {
  const fileRef = useRef(null);

  const [form, setForm] = useState({
    title: "",
    subject: "",
    semester: "",
  });

  const [file, setFile] = useState(null);

  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  /* ================= DROPZONE ================= */

  const { getRootProps, getInputProps } = useDropzone({
    accept: {
      "application/pdf": [],
    },
    multiple: false,
    onDrop: (acceptedFiles) => {
      const selected = acceptedFiles[0];

      if (!selected) return;

      /* FILE TYPE VALIDATION */

      if (selected.type !== "application/pdf") {
        setIsError(true);
        setMessage("Only PDF files allowed");
        return;
      }

      /* FILE SIZE VALIDATION */

      if (selected.size > 10 * 1024 * 1024) {
        setIsError(true);
        setMessage("File size must be under 10MB");
        return;
      }

      setFile(selected);
      setIsError(false);
      setMessage("");
    },
  });

  /* ================= HANDLE SUBMIT ================= */

  const handleSubmit = async (e) => {
    e.preventDefault();

    setMessage("");
    setIsError(false);

    if (!form.title.trim()) {
      setIsError(true);
      return setMessage("Title is required");
    }

    if (!form.subject) {
      setIsError(true);
      return setMessage("Please select subject");
    }

    if (!form.semester) {
      setIsError(true);
      return setMessage("Please select semester");
    }

    if (!file) {
      setIsError(true);
      return setMessage("Please upload a PDF file");
    }

    const data = new FormData();

    data.append("title", form.title.trim());
    data.append("subject", form.subject);
    data.append("semester", form.semester);
    data.append("pdf", file);

    setLoading(true);
    setProgress(0);

    try {
      await uploadPaper(data, (progressEvent) => {
        if (!progressEvent.total) return;

        const percent = Math.round(
          (progressEvent.loaded * 100) / progressEvent.total,
        );

        setProgress(percent);
      });

      setMessage("✅ Paper uploaded successfully!");

      /* RESET FORM */

      setForm({
        title: "",
        subject: "",
        semester: "",
      });

      setFile(null);
      setProgress(0);

      if (fileRef.current) {
        fileRef.current.value = "";
      }
    } catch (err) {
      console.error(err);

      setIsError(true);
      setMessage(
        err.response?.data?.error || "Upload failed. Please try again.",
      );
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

        {/* MESSAGE */}

        {message && (
          <div
            className={`mb-4 text-sm ${
              isError ? "text-red-500" : "text-green-500"
            }`}
          >
            {message}
          </div>
        )}

        {/* FORM */}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* TITLE */}

          <input
            placeholder="Paper Title"
            value={form.title}
            required
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="input"
          />

          {/* SUBJECT */}

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

          {/* SEMESTER */}

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

          {/* DRAG DROP PDF */}

          <div
            {...getRootProps()}
            className="border-2 border-dashed border-gray-300 p-6 text-center rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <input {...getInputProps()} />

            {file ? (
              <p className="text-green-600 font-medium">📄 {file.name}</p>
            ) : (
              <p className="text-gray-500">
                Drag & Drop PDF here <br />
                or click to select
              </p>
            )}
          </div>

          {/* PROGRESS BAR */}

          {loading && (
            <>
              <div className="w-full bg-gray-200 rounded h-3">
                <div
                  className="bg-indigo-600 h-3 rounded transition-all duration-300"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>

              <p className="text-sm text-gray-500">Uploading {progress}%</p>
            </>
          )}

          {/* BUTTON */}

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
