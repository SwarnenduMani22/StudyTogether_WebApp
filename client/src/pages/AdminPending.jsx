import { useEffect, useState } from "react";
import api from "../api/axios";
import toast from "react-hot-toast";
import PDFModal from "../components/papers/PDFModal";

const AdminPending = () => {
  const [papers, setPapers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [error, setError] = useState("");

  const [previewPdf, setPreviewPdf] = useState(null);

  /* ================= FETCH PENDING ================= */

  const fetchPending = async () => {
    try {
      setLoading(true);
      setError("");

      const res = await api.get("/papers/admin/pending");

      const data = res?.data || [];

      setPapers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Fetch pending error:", err);
      setError("Failed to load pending papers");
      setPapers([]);
    } finally {
      setLoading(false);
    }
  };

  /* ================= APPROVE ================= */

  const approvePaper = async (id) => {
    try {
      setProcessingId(id);

      await api.put(`/papers/admin/approve/${id}`);

      toast.success("Paper approved successfully");

      setPapers((prev) => prev.filter((p) => p._id !== id));
    } catch (err) {
      toast.error(err.response?.data?.error || "Approval failed");
    } finally {
      setProcessingId(null);
    }
  };

  /* ================= REJECT ================= */

  const rejectPaper = async (id) => {
    try {
      setProcessingId(id);

      await api.delete(`/papers/admin/reject/${id}`);

      toast.success("Paper rejected");

      setPapers((prev) => prev.filter((p) => p._id !== id));
    } catch (err) {
      toast.error(err.response?.data?.error || "Reject failed");
    } finally {
      setProcessingId(null);
    }
  };

  /* ================= LOAD ================= */

  useEffect(() => {
    fetchPending();
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 p-8">
      <div className="max-w-5xl mx-auto space-y-6 fade-in">
        {/* TITLE */}

        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
            Pending Papers ⏳
          </h1>

          <button
            onClick={fetchPending}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded text-sm"
          >
            Refresh
          </button>
        </div>

        {/* ERROR */}

        {error && <p className="text-red-500 text-center">{error}</p>}

        {/* LOADING */}

        {loading && (
          <p className="text-center text-gray-500">Loading pending papers...</p>
        )}

        {/* EMPTY */}

        {!loading && papers.length === 0 && !error && (
          <p className="text-center text-gray-500">No pending papers 🎉</p>
        )}

        {/* LIST */}

        {!loading &&
          papers.map((paper) => {
            const pdfUrl = paper.pdfLink?.startsWith("http")
              ? paper.pdfLink
              : `http://localhost:5000${paper.pdfLink}`;

            return (
              <div
                key={paper._id}
                className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md flex flex-col md:flex-row md:items-center md:justify-between gap-4"
              >
                {/* INFO */}

                <div>
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
                    {paper.title}
                  </h3>

                  <p className="text-gray-500 text-sm">
                    📚 {paper.subject} • Semester {paper.semester}
                  </p>

                  {paper.uploadedBy && (
                    <p className="text-xs text-gray-400 mt-1">
                      Uploaded by: {paper.uploadedBy.name}
                    </p>
                  )}
                </div>

                {/* ACTIONS */}

                <div className="flex gap-3 flex-wrap">
                  {/* PREVIEW */}

                  <button
                    onClick={() => setPreviewPdf(pdfUrl)}
                    className="bg-indigo-500 hover:bg-indigo-600 text-white px-3 py-1 rounded text-sm"
                  >
                    Preview
                  </button>

                  {/* DOWNLOAD */}

                  <a
                    href={pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm"
                  >
                    Download
                  </a>

                  {/* APPROVE */}

                  <button
                    onClick={() => approvePaper(paper._id)}
                    disabled={processingId === paper._id}
                    className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-sm disabled:opacity-50"
                  >
                    {processingId === paper._id ? "Approving..." : "Approve"}
                  </button>

                  {/* REJECT */}

                  <button
                    onClick={() => rejectPaper(paper._id)}
                    disabled={processingId === paper._id}
                    className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              </div>
            );
          })}
      </div>

      {/* PDF PREVIEW */}

      {previewPdf && (
        <PDFModal pdfLink={previewPdf} onClose={() => setPreviewPdf(null)} />
      )}
    </div>
  );
};

export default AdminPending;
