import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import { getPaper, incrementView, incrementDownload } from "../api/paper";

import PDFModal from "../components/papers/PDFModal";
import Skeleton from "../components/common/Skeleton";

import toast from "react-hot-toast";

const PaperDetails = () => {
  const { id } = useParams();

  const [paper, setPaper] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [views, setViews] = useState(0);
  const [downloads, setDownloads] = useState(0);

  const [preview, setPreview] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);

  /* ================= FETCH PAPER ================= */

  useEffect(() => {
    const fetchPaper = async () => {
      try {
        setLoading(true);
        setError("");

        const data = await getPaper(id);

        if (!data) {
          setError("Paper not found");
          return;
        }

        setPaper(data);

        setViews(data.views || 0);
        setDownloads(data.downloads || 0);
      } catch (err) {
        console.error("Fetch paper error:", err);
        setError("Failed to load paper");
        toast.error("Failed to load paper");
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchPaper();
  }, [id]);

  /* ================= PDF URL ================= */

  const BASE_URL = "http://localhost:5000";

  const pdfUrl = paper?.pdfLink ? `${BASE_URL}${paper.pdfLink}` : "";
  /* ================= PREVIEW ================= */

  const handlePreview = async () => {
    if (!pdfUrl) return;

    try {
      setPreviewLoading(true);

      await incrementView(id);

      setViews((prev) => prev + 1);

      setPreview(true);
    } catch (err) {
      console.error("View counter failed:", err);
    } finally {
      setPreviewLoading(false);
    }
  };

  /* ================= DOWNLOAD ================= */

  const handleDownload = async () => {
    if (!pdfUrl) return;

    try {
      await incrementDownload(id);

      setDownloads((prev) => prev + 1);

      window.open(pdfUrl, "_blank");
    } catch (err) {
      console.error("Download counter failed:", err);
    }
  };

  /* ================= LOADING ================= */

  if (loading) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  /* ================= ERROR ================= */

  if (error) {
    return (
      <div className="p-8 text-center text-red-500 font-medium">{error}</div>
    );
  }

  /* ================= EMPTY ================= */

  if (!paper) {
    return <div className="p-8 text-center text-gray-500">Paper not found</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 p-8">
      <div className="max-w-3xl mx-auto card">
        {/* ================= TITLE ================= */}

        <h1 className="text-2xl font-bold mb-4 text-gray-800 dark:text-white">
          {paper.title}
        </h1>

        {/* ================= INFO ================= */}

        <p className="text-gray-500 mb-2">📚 {paper.subject}</p>

        <p className="text-gray-500 mb-2">🎓 Semester {paper.semester}</p>

        {paper.uploadedBy && (
          <p className="text-gray-400 text-sm mb-4">
            Uploaded by {paper.uploadedBy.name}
          </p>
        )}

        {/* ================= STATS ================= */}

        <div className="flex gap-4 text-sm text-gray-500 mb-6">
          <span>👁 {views}</span>
          <span>⬇ {downloads}</span>
        </div>

        {/* ================= ACTION BUTTONS ================= */}

        <div className="flex gap-3">
          <button
            onClick={handlePreview}
            disabled={previewLoading || !pdfUrl}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded disabled:opacity-50"
          >
            {previewLoading ? "Loading..." : "Preview"}
          </button>

          <button
            onClick={handleDownload}
            disabled={!pdfUrl}
            className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded disabled:opacity-50"
          >
            Download
          </button>
        </div>
      </div>

      {/* ================= PDF MODAL ================= */}

      {preview && (
        <PDFModal pdfLink={pdfUrl} onClose={() => setPreview(false)} />
      )}
    </div>
  );
};

export default PaperDetails;
