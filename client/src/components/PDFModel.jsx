import { useEffect } from "react";

const PDFModal = ({ pdfLink, onClose }) => {
  /* ================= ESC Close ================= */

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKey);

    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 fade-in"
      onClick={onClose}
    >
      {/* Modal */}

      <div
        className="bg-white dark:bg-gray-900 w-[95%] md:w-5/6 h-[90%] rounded-xl shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}

        <div className="flex items-center justify-between px-4 py-3 border-b dark:border-gray-700">
          <h2 className="font-semibold text-gray-800 dark:text-white">
            Paper Preview
          </h2>

          <button
            onClick={onClose}
            className="text-lg hover:text-red-500 transition"
          >
            ✕
          </button>
        </div>

        {/* PDF */}

        <iframe
          src={pdfLink}
          title="PDF Preview"
          className="w-full h-[calc(100%-50px)]"
        />
      </div>
    </div>
  );
};

export default PDFModal;
