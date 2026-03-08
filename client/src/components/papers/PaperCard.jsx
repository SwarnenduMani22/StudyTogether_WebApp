import { useState } from "react";
import {
  incrementView,
  incrementDownload,
  deletePaper,
  updatePaper,
  ratePaper,
  toggleBookmark,
} from "../../api/paper";

import PDFModal from "./PDFModal";
import useAuth from "../../hooks/useAuth";
import toast from "react-hot-toast";

const PaperCard = ({ paper }) => {
  const { user } = useAuth();

  const [preview, setPreview] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [editing, setEditing] = useState(false);

  const [views, setViews] = useState(paper?.views || 0);
  const [downloads, setDownloads] = useState(paper?.downloads || 0);

  const [title, setTitle] = useState(paper?.title || "");
  const [subject, setSubject] = useState(paper?.subject || "");
  const [semester, setSemester] = useState(paper?.semester || "");

  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [bookmarked, setBookmarked] = useState(paper?.bookmarked || false);
  const [avgRating, setAvgRating] = useState(
    Number(paper?.averageRating || 0).toFixed(1),
  );

  if (!paper) return null;

  /* ================= SAFE PDF URL ================= */

  const pdfUrl = paper?.pdfLink?.startsWith("http")
    ? paper.pdfLink
    : `${import.meta.env.VITE_API_BASE || "http://localhost:5000"}${paper.pdfLink}`;

  /* ================= PREVIEW ================= */

  const handlePreview = async () => {
    try {
      setPreviewLoading(true);

      await incrementView(paper._id);
      setViews((prev) => prev + 1);

      setPreview(true);
    } catch (error) {
      console.error("Preview failed:", error);
    } finally {
      setPreviewLoading(false);
    }
  };

  /* ================= DOWNLOAD ================= */

  const handleDownload = async () => {
    try {
      await incrementDownload(paper._id);
      setDownloads((prev) => prev + 1);
    } catch (error) {
      console.error("Download counter failed:", error);
    }
  };

  /* ================= DELETE ================= */

  const handleDelete = async () => {
    if (!user || user.role !== "admin") return;

    const confirmDelete = window.confirm(
      "Are you sure you want to delete this paper?",
    );

    if (!confirmDelete) return;

    try {
      setDeleting(true);

      await deletePaper(paper._id);

      toast.success("Paper deleted successfully");
    } catch (error) {
      console.error("Delete failed:", error);
      toast.error("Failed to delete paper");
    } finally {
      setDeleting(false);
    }
  };

  /* ================= UPDATE ================= */

  const handleUpdate = async () => {
    try {
      setLoading(true);

      await updatePaper(paper._id, {
        title,
        subject,
        semester,
      });

      toast.success("Paper updated successfully");

      setEditing(false);
    } catch (error) {
      console.error(error);
      toast.error("Update failed");
    } finally {
      setLoading(false);
    }
  };

  /* ================= RATING ================= */

  const handleRating = async (value) => {
    if (!user) {
      toast.error("Login required to rate");
      return;
    }

    try {
      await ratePaper(paper._id, value);

      const newAvg = ((Number(avgRating) + value) / 2).toFixed(1);
      setAvgRating(newAvg);

      toast.success("Rating submitted ⭐");
    } catch {
      toast.error("Rating failed");
    }
  };

  /* ================= BOOKMARK ================= */

  const handleBookmark = async () => {
    if (!user) {
      toast.error("Login required");
      return;
    }

    try {
      const res = await toggleBookmark(paper._id);

      setBookmarked(res.bookmarked);

      if (res.bookmarked) {
        toast.success("Added to bookmarks ⭐");
      } else {
        toast.success("Bookmark removed");
      }
    } catch {
      toast.error("Bookmark failed");
    }
  };

  return (
    <>
      <div className="card hover:shadow-xl transition duration-200">
        {/* TITLE */}

        <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
          {paper.title}
        </h3>

        {/* SUBJECT */}

        <p className="text-sm text-gray-500 mt-2">📚 {paper.subject}</p>

        {/* SEMESTER */}

        <p className="text-sm text-gray-500">🎓 Semester {paper.semester}</p>

        {/* UPLOADER */}

        {paper.uploadedBy?.name && (
          <p className="text-xs text-gray-400 mt-1">
            Uploaded by: {paper.uploadedBy.name}
          </p>
        )}

        {/* ⭐ AVERAGE RATING */}

        <div className="mt-2 text-yellow-500 font-semibold text-sm">
          ⭐ {avgRating} / 5
        </div>

        {/* STATS */}

        <div className="flex gap-4 text-xs text-gray-400 mt-3">
          <span>👁 {views}</span>
          <span>⬇ {downloads}</span>
        </div>

        {/* ACTION BUTTONS */}

        <div className="flex flex-wrap gap-3 mt-4">
          <button
            onClick={handlePreview}
            disabled={previewLoading}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded text-sm"
          >
            {previewLoading ? "Loading..." : "Preview"}
          </button>

          <a
            href={pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleDownload}
            className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-sm"
          >
            Download
          </a>

          <button
            onClick={handleBookmark}
            className="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1 rounded text-sm"
          >
            {bookmarked ? "⭐ Saved" : "🔖 Save"}
          </button>

          {user?.role === "admin" && (
            <>
              <button
                onClick={() => setEditing(true)}
                className="bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-1 rounded text-sm"
              >
                Edit
              </button>

              <button
                onClick={handleDelete}
                disabled={deleting}
                className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm"
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </>
          )}
        </div>

        {/* RATING BUTTONS */}

        <div className="flex gap-1 mt-3">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onClick={() => handleRating(star)}
              className="text-yellow-400 text-lg hover:scale-110"
            >
              ⭐
            </button>
          ))}
        </div>
      </div>

      {/* EDIT MODAL */}

      {editing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 p-6 rounded-lg w-96">
            <h2 className="text-xl font-bold mb-4">Edit Paper</h2>

            <input
              className="input mb-3 w-full"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title"
            />

            <input
              className="input mb-3 w-full"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject"
            />

            <input
              className="input mb-4 w-full"
              value={semester}
              onChange={(e) => setSemester(e.target.value)}
              placeholder="Semester"
            />

            <div className="flex gap-3">
              <button
                onClick={handleUpdate}
                disabled={loading}
                className="bg-indigo-600 text-white px-4 py-2 rounded"
              >
                {loading ? "Updating..." : "Update"}
              </button>

              <button
                onClick={() => setEditing(false)}
                className="bg-gray-400 text-white px-4 py-2 rounded"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PDF MODAL */}

      {preview && (
        <PDFModal pdfLink={pdfUrl} onClose={() => setPreview(false)} />
      )}
    </>
  );
};

export default PaperCard;
