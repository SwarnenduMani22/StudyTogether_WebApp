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
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Pending Papers</h1>

      {loading && <p>Loading...</p>}

      {error && <p className="text-red-500">{error}</p>}

      {!loading && papers.length === 0 && <p>No pending papers</p>}

      {papers.map((paper) => {
        const rawPdfLink = paper?.pdfLink || "";
        const pdfUrl = rawPdfLink.startsWith("http")
          ? rawPdfLink
          : `${import.meta.env.VITE_API_URL?.replace("/api/v1", "") || "http://localhost:5000"}${rawPdfLink}`;

        const isProcessing = processingId === paper._id;

        return (
          <div key={paper._id} className="card mb-4">
            <h3>{paper.title}</h3>
            <p>
              {paper.subject} • Sem {paper.semester}
            </p>

            <div className="flex gap-3 mt-3">
              <button
                onClick={() => setPreviewPdf(pdfUrl)}
                disabled={isProcessing || !rawPdfLink}
              >
                Preview
              </button>

              <button
                onClick={() => approvePaper(paper._id)}
                disabled={isProcessing}
              >
                {isProcessing ? "Processing..." : "Approve"}
              </button>

              <button
                onClick={() => rejectPaper(paper._id)}
                disabled={isProcessing}
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
  );
};

export default AdminPending;
