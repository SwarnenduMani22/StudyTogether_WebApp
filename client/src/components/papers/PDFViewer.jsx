import { useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";

/* ================= PDF WORKER ================= */

pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

const PDFViewer = ({ file }) => {
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.2);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  /* ================= LOAD SUCCESS ================= */

  const onLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
    setPageNumber(1);
    setLoading(false);
  };

  /* ================= LOAD ERROR ================= */

  const onLoadError = (err) => {
    console.error("PDF load error:", err);
    setError("Failed to load PDF");
    setLoading(false);
  };

  /* ================= NAVIGATION ================= */

  const prevPage = () => {
    if (pageNumber > 1) setPageNumber((p) => p - 1);
  };

  const nextPage = () => {
    if (numPages && pageNumber < numPages) {
      setPageNumber((p) => p + 1);
    }
  };

  /* ================= ZOOM ================= */

  const zoomIn = () => setScale((s) => s + 0.2);

  const zoomOut = () => {
    if (scale > 0.6) setScale((s) => s - 0.2);
  };

  return (
    <div className="flex flex-col items-center w-full">
      {/* LOADING */}

      {loading && <p className="text-gray-500 mb-4">Loading PDF...</p>}

      {/* ERROR */}

      {error && <p className="text-red-500 mb-4">{error}</p>}

      {/* CONTROLS */}

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <button
          disabled={pageNumber <= 1}
          onClick={prevPage}
          className="bg-gray-300 hover:bg-gray-400 px-3 py-1 rounded disabled:opacity-50"
        >
          Prev
        </button>

        <span className="text-gray-700">
          Page {pageNumber} / {numPages || "--"}
        </span>

        <button
          disabled={numPages && pageNumber >= numPages}
          onClick={nextPage}
          className="bg-gray-300 hover:bg-gray-400 px-3 py-1 rounded disabled:opacity-50"
        >
          Next
        </button>

        <button
          onClick={zoomOut}
          className="bg-gray-300 hover:bg-gray-400 px-3 py-1 rounded"
        >
          -
        </button>

        <button
          onClick={zoomIn}
          className="bg-gray-300 hover:bg-gray-400 px-3 py-1 rounded"
        >
          +
        </button>
      </div>

      {/* PDF VIEW */}

      <div className="overflow-auto border rounded-lg shadow max-h-[70vh]">
        <Document
          file={file}
          onLoadSuccess={onLoadSuccess}
          onLoadError={onLoadError}
          loading=""
        >
          <Page pageNumber={pageNumber} scale={scale} />
        </Document>
      </div>
    </div>
  );
};

export default PDFViewer;
