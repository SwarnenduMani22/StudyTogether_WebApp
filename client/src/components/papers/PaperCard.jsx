import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

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
import resolvePdfUrl from "../../utils/resolvePdfUrl";

const PaperCard = ({ paper, onDelete }) => {
  const { user } = useAuth();
  const navigate = useNavigate();

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

  const [bookmarked, setBookmarked] = useState(false);

  const [avgRating, setAvgRating] = useState(
    Number(paper?.averageRating || 0).toFixed(1),
  );

  const [hasRated, setHasRated] = useState(false);
  const [previewPdfUrl, setPreviewPdfUrl] = useState("");

  /* ================= SYNC BOOKMARK ================= */

  useEffect(() => {
    if (paper?.isBookmarked !== undefined) {
      setBookmarked(paper.isBookmarked);
    }
  }, [paper]);

  if (!paper) return null;

  /* ================= OWNERSHIP / PERMISSIONS ================= */

  const uploadedById = paper?.uploadedBy?._id || paper?.uploadedBy;
  const isOwner = Boolean(
    user?._id && uploadedById && String(uploadedById) === String(user._id)
  );
  const isAdmin = user?.role === "admin";
  const canDelete = isOwner || isAdmin;

  /* ================= AUTH CHECK ================= */

  const requireLogin = () => {
    if (!user) {
      toast.error("Please login first 🔒");
      navigate("/login");
      return false;
    }
    return true;
  };

  /* ================= PREVIEW ================= */

  const handlePreview = async () => {
    if (!requireLogin()) return;

    try {
      setPreviewLoading(true);

      const res = await incrementView(paper._id);
      setViews((prev) => prev + 1);

      const authorizedUrl = resolvePdfUrl(res?.pdfLink);
      if (authorizedUrl) {
        setPreviewPdfUrl(authorizedUrl);
        setPreview(true);
      } else {
        toast.error("Unable to load preview URL");
      }
    } catch (error) {
      console.error("Preview failed:", error);
      toast.error(error?.response?.data?.error || "Preview failed");
    } finally {
      setPreviewLoading(false);
    }
  };

  /* ================= DOWNLOAD ================= */

  const handleDownload = async () => {
    if (!requireLogin()) return;

    try {
      const res = await incrementDownload(paper._id);
      setDownloads((prev) => prev + 1);

      const authorizedUrl = resolvePdfUrl(res?.pdfLink);
      if (authorizedUrl) {
        window.open(authorizedUrl, "_blank");
      } else {
        toast.error("Unable to load download URL");
      }
    } catch (error) {
      console.error("Download failed:", error);
      toast.error(error?.response?.data?.error || "Download failed");
    }
  };

  /* ================= DELETE ================= */

  const handleDelete = async () => {
    if (!canDelete) return;

    if (!window.confirm("Are you sure you want to delete this paper?")) return;

    try {
      setDeleting(true);

      await deletePaper(paper._id);

      toast.success("Paper deleted successfully");

      if (onDelete) onDelete();
    } catch (error) {
      toast.error(error?.response?.data?.error || "Failed to delete paper");
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
    } catch {
      toast.error("Update failed");
    } finally {
      setLoading(false);
    }
  };

  /* ================= RATING ================= */

  const handleRating = async (value) => {
    if (!requireLogin()) return;

    if (hasRated) {
      toast.error("You already rated this paper");
      return;
    }

    try {
      const res = await ratePaper(paper._id, value);

      setHasRated(true);

      if (res?.averageRating) {
        setAvgRating(res.averageRating.toFixed(1));
      }

      toast.success("Rating submitted ⭐");
    } catch (err) {
      toast.error(err?.message || "Rating failed");
    }
  };

  /* ================= BOOKMARK ================= */

  const handleBookmark = async () => {
    if (!requireLogin()) return;

    try {
      const res = await toggleBookmark(paper._id);

      setBookmarked(res.bookmarked);

      toast.success(
        res.bookmarked ? "Added to bookmarks ⭐" : "Bookmark removed",
      );
    } catch {
      toast.error("Bookmark failed");
    }
  };

  return (
    <>
      <div className="card hover:shadow-xl transition duration-200">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
          {paper.title}
        </h3>

        <p className="text-sm text-gray-500 mt-2">📚 {paper.subject}</p>
        <p className="text-sm text-gray-500">🎓 Semester {paper.semester}</p>

        {paper.uploadedBy?.name && (
          <p className="text-xs text-gray-400 mt-1">
            Uploaded by: {paper.uploadedBy.name}
          </p>
        )}

        <div className="mt-2 text-yellow-500 font-semibold text-sm">
          ⭐ {avgRating} / 5
        </div>

        <div className="flex gap-4 text-xs text-gray-400 mt-3">
          <span>👁 {views}</span>
          <span>⬇ {downloads}</span>
        </div>

        {/* BUTTONS */}
        <div className="flex flex-wrap gap-3 mt-4">
          <button
            onClick={handlePreview}
            disabled={previewLoading}
            className="bg-indigo-600 text-white px-3 py-1 rounded text-sm"
          >
            {previewLoading
              ? "Loading..."
              : user
                ? "Preview"
                : "Login to Preview 🔒"}
          </button>

          <button
            onClick={handleDownload}
            className="bg-green-500 text-white px-3 py-1 rounded text-sm"
          >
            {user ? "Download" : "Login to Download 🔒"}
          </button>

          <button
            onClick={handleBookmark}
            className="bg-yellow-500 text-white px-3 py-1 rounded text-sm"
          >
            {bookmarked ? "⭐ Saved" : "🔖 Save"}
          </button>

          {canDelete && (
            <>
              {isAdmin && (
                <button
                  onClick={() => setEditing(true)}
                  className="bg-yellow-600 text-white px-3 py-1 rounded text-sm"
                >
                  Edit
                </button>
              )}

              <button
                onClick={handleDelete}
                disabled={deleting}
                className="bg-red-500 text-white px-3 py-1 rounded text-sm"
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </>
          )}
        </div>

        {/* RATE */}
        <div className="flex gap-1 mt-3">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onClick={() => handleRating(star)}
              disabled={hasRated}
              className="text-yellow-400 text-lg hover:scale-110 disabled:opacity-40"
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
            />

            <input
              className="input mb-3 w-full"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />

            <input
              className="input mb-4 w-full"
              value={semester}
              onChange={(e) => setSemester(e.target.value)}
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

      {preview && previewPdfUrl && (
        <PDFModal pdfLink={previewPdfUrl} onClose={() => { setPreview(false); setPreviewPdfUrl(""); }} />
      )}
    </>
  );
};

export default PaperCard;
