import { useMemo, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";

/* ✅ FINAL WORKER (V5 COMPATIBLE) */
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

const PDFViewer = ({ file }) => {
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.2);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  /* ================= FIX: CLOUDINARY URL TRANSFORM ================= */

  const safeFile = useMemo(() => {
    if (!file) return "";
    return file;
  }, [file]);
  console.log("Viewer file 👉", file);

  const [prevFile, setPrevFile] = useState(safeFile);
  if (prevFile !== safeFile) {
    setPrevFile(safeFile);
    setNumPages(null);
    setPageNumber(1);
    setScale(1.2);
    setLoading(true);
    setError("");
  }

  /* ================= LOAD SUCCESS ================= */

  const onLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
    setPageNumber(1);
    setLoading(false);
  };

  /* ================= LOAD ERROR ================= */

  const onLoadError = (err) => {
    console.error("PDF load error:", err);
    setError("Failed to load PDF file.");
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
      {loading && (
        <p className="text-gray-500 dark:text-gray-300 mb-4">Loading PDF...</p>
      )}

      {/* ERROR */}
      {error && <p className="text-red-500 mb-4 text-center">{error}</p>}

      {/* CONTROLS */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <button
          disabled={pageNumber <= 1}
          onClick={prevPage}
          className="bg-gray-300 dark:bg-gray-700 dark:text-gray-100 hover:bg-gray-400 dark:hover:bg-gray-600 px-3 py-1 rounded disabled:opacity-50"
        >
          Prev
        </button>

        <span className="text-gray-700 dark:text-gray-200">
          Page {pageNumber} / {numPages || "--"}
        </span>

        <button
          disabled={numPages && pageNumber >= numPages}
          onClick={nextPage}
          className="bg-gray-300 dark:bg-gray-700 dark:text-gray-100 hover:bg-gray-400 dark:hover:bg-gray-600 px-3 py-1 rounded disabled:opacity-50"
        >
          Next
        </button>

        <button
          onClick={zoomOut}
          className="bg-gray-300 dark:bg-gray-700 dark:text-gray-100 hover:bg-gray-400 dark:hover:bg-gray-600 px-3 py-1 rounded"
        >
          -
        </button>

        <button
          onClick={zoomIn}
          className="bg-gray-300 dark:bg-gray-700 dark:text-gray-100 hover:bg-gray-400 dark:hover:bg-gray-600 px-3 py-1 rounded"
        >
          +
        </button>
      </div>

      {/* PDF VIEW */}
      <div className="overflow-auto border border-gray-200 dark:border-gray-700 rounded-lg shadow max-h-[70vh] w-full flex justify-center bg-white dark:bg-gray-900">
        {!error ? (
          <Document
            file={safeFile} // ✅ FIXED (direct URL only)
            onLoadSuccess={onLoadSuccess}
            onLoadError={onLoadError}
            onSourceError={onLoadError}
            loading=""
          >
            <Page pageNumber={pageNumber} scale={scale} />
          </Document>
        ) : (
          <iframe
            src={safeFile}
            title="PDF preview fallback"
            className="w-full h-[68vh]"
          />
        )}
      </div>
    </div>
  );
};

export default PDFViewer;
