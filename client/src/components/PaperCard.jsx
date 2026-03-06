import { useState } from "react";
import { incrementView } from "../api/paper";
import api from "../api/axios";
import PDFModal from "./PDFModel";

const PaperCard = ({ paper }) => {
  const [preview, setPreview] = useState(false);

  /* ================= Preview ================= */

  const handlePreview = async () => {
    try {
      await incrementView(paper._id);
    } catch {}

    setPreview(true);
  };

  /* ================= Download ================= */

  const handleDownload = async () => {
    try {
      await api.post(`/papers/${paper._id}/download`);
    } catch {}
  };

  return (
    <>
      <div className="card hover-lift">
        {/* Title */}

        <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
          {paper.title}
        </h3>

        {/* Info */}

        <p className="text-sm text-gray-500 mt-2">📚 {paper.subject}</p>

        <p className="text-sm text-gray-500">🎓 Semester {paper.semester}</p>

        {/* Stats */}

        <div className="flex gap-4 text-xs text-gray-400 mt-2">
          <span>👁 {paper.views || 0}</span>
          <span>⬇ {paper.downloads || 0}</span>
        </div>

        {/* Buttons */}

        <div className="flex gap-3 mt-4">
          <button
            onClick={handlePreview}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded text-sm transition"
          >
            Preview
          </button>

          <a
            href={paper.pdfLink}
            target="_blank"
            rel="noreferrer"
            onClick={handleDownload}
            className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-sm transition"
          >
            Download
          </a>
        </div>
      </div>

      {/* ================= PDF Modal ================= */}

      {preview && (
        <PDFModal pdfLink={paper.pdfLink} onClose={() => setPreview(false)} />
      )}
    </>
  );
};

export default PaperCard;
