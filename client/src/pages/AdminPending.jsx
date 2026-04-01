import { useEffect, useState } from "react";
import api from "../api/axios";
import toast from "react-hot-toast";
import PDFModal from "../components/papers/PDFModal";
import resolvePdfUrl from "../utils/resolvePdfUrl";

const AdminPending = () => {
  const [papers, setPapers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [error, setError] = useState("");

  const [previewPdf, setPreviewPdf] = useState(null);

  const fetchPending = async () => {
    try {
      setLoading(true);
      setError("");

      const res = await api.get("/papers/admin/pending");
      setPapers(res.data || []);
    } catch {
      setError("Failed to load pending papers");
    } finally {
      setLoading(false);
    }
  };

  const approvePaper = async (id) => {
    try {
      setProcessingId(id);

      await api.put(`/papers/admin/approve/${id}`);

      toast.success("Approved");
      setPapers((prev) => prev.filter((p) => p._id !== id));
    } catch {
      toast.error("Approval failed");
    } finally {
      setProcessingId(null);
    }
  };

  const rejectPaper = async (id) => {
    try {
      setProcessingId(id);

      await api.delete(`/papers/admin/reject/${id}`);

      toast.success("Rejected");
      setPapers((prev) => prev.filter((p) => p._id !== id));
    } catch {
      toast.error("Reject failed");
    } finally {
      setProcessingId(null);
    }
  };

  useEffect(() => {
    fetchPending();
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl sm:text-3xl font-bold mb-6 text-gray-900 dark:text-gray-100">
          Pending Papers
        </h1>

        {loading && (
          <p className="text-gray-600 dark:text-gray-300">Loading...</p>
        )}

        {error && <p className="text-red-500">{error}</p>}

        {!loading && papers.length === 0 && (
          <p className="text-gray-600 dark:text-gray-300">No pending papers</p>
        )}

        {papers.map((paper) => {
          const rawPdfLink = paper?.pdfLink || "";
          const pdfUrl = resolvePdfUrl(rawPdfLink);

          const isProcessing = processingId === paper._id;

          return (
            <div
              key={paper._id}
              className="mb-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm p-5"
            >
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                {paper.title}
              </h3>
              <p className="mt-1 text-gray-600 dark:text-gray-300">
                {paper.subject} • Sem {paper.semester}
              </p>

              <div className="flex flex-wrap gap-3 mt-4">
                <button
                  onClick={() => setPreviewPdf(pdfUrl)}
                  disabled={isProcessing || !pdfUrl}
                  className="px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  Preview
                </button>

                <button
                  onClick={() => approvePaper(paper._id)}
                  disabled={isProcessing}
                  className="px-4 py-2 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  {isProcessing ? "Processing..." : "Approve"}
                </button>

                <button
                  onClick={() => rejectPaper(paper._id)}
                  disabled={isProcessing}
                  className="px-4 py-2 rounded-md bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  {isProcessing ? "Processing..." : "Reject"}
                </button>
              </div>
            </div>
          );
        })}

        {previewPdf && (
          <PDFModal pdfLink={previewPdf} onClose={() => setPreviewPdf(null)} />
        )}
      </div>
    </div>
  );
};

export default AdminPending;
