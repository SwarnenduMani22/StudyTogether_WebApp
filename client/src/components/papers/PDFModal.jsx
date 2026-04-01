import { useEffect } from "react";
import PDFViewer from "./PDFViewer";
import resolvePdfUrl from "../../utils/resolvePdfUrl";

const PDFModal = ({ pdfLink, onClose }) => {
  /* ================= SAFE PDF URL ================= */

  const pdfUrl = resolvePdfUrl(pdfLink);

  /* ================= ESC CLOSE ================= */

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose?.();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  /* ================= LOCK BODY SCROLL ================= */

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow || "auto";
    };
  }, []);

  /* ================= SAFETY ================= */

  if (!pdfUrl) return null;

  /* ================= RENDER ================= */

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      {/* MODAL */}

      <div
        className="bg-white dark:bg-gray-900 w-full md:w-5/6 h-[90vh] rounded-xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}

        <div className="flex items-center justify-between px-5 py-3 border-b dark:border-gray-700">
          <h2 className="font-semibold text-gray-800 dark:text-white">
            Paper Preview
          </h2>

          <button
            onClick={onClose}
            className="text-lg text-gray-500 hover:text-red-500 transition"
            aria-label="Close preview"
          >
            ✕
          </button>
        </div>

        {/* PDF VIEWER */}

        <div className="flex-1 overflow-auto flex items-center justify-center p-4">
          <PDFViewer file={pdfUrl} />
        </div>

        {/* FALLBACK */}

        <div className="text-center pb-4">
          <a
            href={pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:text-blue-600 underline"
          >
            Open PDF in new tab
          </a>
        </div>
      </div>
    </div>
  );
};

export default PDFModal;
