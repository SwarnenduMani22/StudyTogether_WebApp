import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";

import {
  getPaper,
  incrementView,
  incrementDownload,
  addComment,
  deleteComment,
  ratePaper,
} from "../api/paper";

import api from "../api/axios";
import resolvePdfUrl from "../utils/resolvePdfUrl";
import PDFModal from "../components/papers/PDFModal";
import Skeleton from "../components/common/Skeleton";
import PaperCard from "../components/papers/PaperCard";

import toast from "react-hot-toast";
import useAuth from "../hooks/useAuth";
const PaperDetails = () => {
  const { id } = useParams();
  const { user, updateUser } = useAuth();

  const [paper, setPaper] = useState(null);
  const [relatedPapers, setRelatedPapers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [views, setViews] = useState(0);
  const [downloads, setDownloads] = useState(0);
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [preview, setPreview] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);

  /* ================= FETCH PAPER ================= */

  const fetchPaper = useCallback(async () => {
    try {
      setLoading(true);

      const [res, relatedRes] = await Promise.all([
        getPaper(id),
        api.get(`/papers/${id}/related`).catch(() => ({ data: { papers: [] } }))
      ]);

      setPaper(res.data?.paper || res);
      setRelatedPapers(relatedRes?.data?.related || []);
    } catch (err) {
      console.error(err);
      setError("Failed to load paper details");
      toast.error("Failed to load paper details");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) fetchPaper();
  }, [id, fetchPaper]);

  /* ================= PDF URL ================= */

  const pdfUrl = resolvePdfUrl(paper?.pdfLink);
  const isAdmin = user?.role === "admin";

  const isOwner = paper?.uploadedBy?._id?.toString() === user?._id?.toString();

  const alreadyPreviewed = user?.previewedPapers?.some(
    (id) => id.toString() === paper?._id,
  );

  const alreadyDownloaded = user?.downloadedPapers?.some(
    (id) => id.toString() === paper?._id,
  );
  const previewCost =
    isAdmin || isOwner || alreadyPreviewed ? "Free" : "-10 🪙";

  const downloadCost = alreadyDownloaded
    ? "Free"
    : alreadyPreviewed
      ? "-30 🪙"
      : isAdmin || isOwner
        ? "Free"
        : "-40 🪙";

  /* ================= PREVIEW ================= */

  const handlePreview = async () => {
    if (!pdfUrl) return;

    try {
      setPreviewLoading(true);

      const response = await incrementView(id);

      setViews(response.views);

      if (response?.coins !== undefined && user) {
        updateUser({
          ...user,
          coins: response.coins,
        });
      }

      toast.success(
        previewCost === "Free"
          ? "Free preview opened"
          : `10 coins used for preview`,
      );

      setPreview(true);
    } catch (err) {
      console.error("View counter failed:", err);

      toast.error(err?.response?.data?.error || "Preview failed");
    } finally {
      setPreviewLoading(false);
    }
  };
  const [comment, setComment] = useState("");
  const [commentLoading, setCommentLoading] = useState(false);

  const [ratingLoading, setRatingLoading] = useState(false);
  /* ================= DOWNLOAD ================= */

  const handleDownload = async () => {
    if (!pdfUrl) return;

    try {
      setDownloadLoading(true);
      const response = await incrementDownload(id);

      setDownloads((prev) => prev + 1);

      if (response?.coins !== undefined && user) {
        updateUser({
          ...user,
          coins: response.coins,
        });
      }

      toast.success(
        downloadCost === "Free"
          ? "Free download started"
          : `${downloadCost.replace("-", "")} used`,
      );

      window.open(resolvePdfUrl(response?.pdfLink) || pdfUrl, "_blank");
    } catch (err) {
      console.error("Download counter failed:", err);

      toast.error(err?.response?.data?.error || "Download failed");
    } finally {
      setDownloadLoading(false);
    }
  };
  /* ================= COMMENT ================= */

  const handleComment = async () => {
    const text = comment.trim();

    if (text.length < 2 || text.length > 500) {
      return toast.error("Comment cannot be empty");
    }

    try {
      setCommentLoading(true);

      const res = await addComment(id, comment);

      setPaper((prev) => ({
        ...prev,
        comments: res?.comments || prev.comments,
      }));

      setComment("");

      toast.success("Comment added");
    } catch (error) {
      toast.error(error?.response?.data?.error || "Failed to add comment");
    } finally {
      setCommentLoading(false);
    }
  };

  /* ================= DELETE COMMENT ================= */

  const handleDeleteComment = async (commentId) => {
    try {
      await deleteComment(id, commentId);

      setPaper((prev) => ({
        ...prev,
        comments: (prev.comments || []).filter((c) => c._id !== commentId),
      }));

      toast.success("Comment deleted");
    } catch (error) {
      toast.error(error?.response?.data?.error || "Failed to delete comment");
    }
  };

  /* ================= RATE ================= */

  const handleRating = async (value) => {
    try {
      setRatingLoading(true);

      const res = await ratePaper(id, value);

      setPaper((prev) => ({
        ...prev,
        averageRating: res.averageRating,
      }));

      toast.success("Rating submitted");
    } catch (error) {
      toast.error(error?.response?.data?.error || "Rating failed");
    } finally {
      setRatingLoading(false);
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
            Uploaded by{" "}
            <Link
              to={`/profile/${paper.uploadedBy._id}`}
              className="text-indigo-600 hover:underline font-semibold"
            >
              {paper.uploadedBy.name}
            </Link>
          </p>
        )}

        {/* ================= STATS ================= */}

        <div className="flex gap-4 text-sm text-gray-500 mb-6">
          <span>👁 {views}</span>
          <span>⬇ {downloads}</span>
        </div>
        {/* ================= RATING ================= */}

        <div className="mt-6">
          <h3 className="font-semibold mb-2 dark:text-white">Rating ⭐</h3>

          <div className="flex items-center gap-3">
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  disabled={ratingLoading}
                  onClick={() => handleRating(star)}
                  className="text-2xl hover:scale-110 transition"
                >
                  ⭐
                </button>
              ))}
            </div>

            <span className="text-sm text-gray-500">
              Average: {paper.averageRating || 0}
            </span>
          </div>
        </div>
        {/* ================= ACTION BUTTONS ================= */}

        <div className="flex gap-3">
          <button
            onClick={handlePreview}
            disabled={previewLoading || !pdfUrl}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded disabled:opacity-50"
          >
            {previewLoading ? "Loading..." : `Preview (${previewCost})`}
          </button>

          <button
            onClick={handleDownload}
            disabled={!pdfUrl || downloadLoading}
            className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded disabled:opacity-50"
          >
            {downloadLoading ? "Downloading..." : `Download (${downloadCost})`}
          </button>
        </div>
      </div>
      {/* ================= COMMENTS ================= */}

      <div className="max-w-3xl mx-auto card mt-8">
        <h2 className="text-xl font-bold mb-4 dark:text-white">
          Comments ({paper.comments?.length || 0})
        </h2>

        {/* ADD COMMENT */}

        <div className="flex gap-2 mb-6">
          <input
            type="text"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleComment();
              }
            }}
            placeholder="Write a comment..."
            className="input flex-1"
          />

          <button
            onClick={handleComment}
            disabled={commentLoading}
            className="btn-primary"
          >
            {commentLoading ? "Posting..." : "Post"}
          </button>
        </div>

        {/* COMMENT LIST */}

        <div className="space-y-3">
          {paper.comments?.map((c) => (
            <div
              key={c._id}
              className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg"
            >
              <div className="flex justify-between items-center mb-2">
                <div>
                  <Link
                    to={`/profile/${c.user?._id}`}
                    className="font-semibold text-gray-800 dark:text-white hover:text-indigo-600 transition"
                  >
                    {c.user?.name || "User"}
                  </Link>

                  <p className="text-xs text-gray-500">
                    {new Date(c.createdAt).toLocaleString()}
                  </p>
                </div>

                {(user?._id?.toString() === c.user?._id?.toString() ||
                  user?.role === "admin") && (
                  <button
                    onClick={() => handleDeleteComment(c._id)}
                    className="text-red-500 text-sm hover:text-red-700"
                  >
                    Delete
                  </button>
                )}
              </div>

              <p className="text-gray-700 dark:text-gray-300">{c.text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ================= RELATED PAPERS ================= */}

      {relatedPapers?.length > 0 && (
        <div className="max-w-3xl mx-auto mt-12">
          <h2 className="text-2xl font-bold mb-6 text-gray-800 dark:text-white">
            Related Papers 📑
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            {relatedPapers.map((relatedPaper) => (
              <PaperCard key={relatedPaper._id} paper={relatedPaper} />
            ))}
          </div>
        </div>
      )}

      {/* ================= PDF MODAL ================= */}

      {preview && (
        <PDFModal pdfLink={pdfUrl} onClose={() => setPreview(false)} />
      )}
    </div>
  );
};

export default PaperDetails;
