import api from "./axios";

/* =====================================================
HELPER
===================================================== */

const validateId = (id) => {
  if (!id) {
    throw new Error("Paper ID required");
  }
};

/* =====================================================
GET PAPERS
===================================================== */

export const getPapers = async ({
  page = 1,
  search = "",
  semester = "",
  subject = "",
  sort = "new",
} = {}) => {
  const res = await api.get("/papers", {
    params: { page, search, semester, subject, sort },
  });

  return res.data;
};

/* =====================================================
GET SINGLE PAPER
===================================================== */

export const getPaper = async (id) => {
  validateId(id);

  const res = await api.get(`/papers/${id}`);

  return res.data.paper;
};

/* =====================================================
UPLOAD PAPER
===================================================== */

export const uploadPaper = async (formData, onUploadProgress) => {
  if (!formData) {
    throw new Error("Upload data required");
  }

  const res = await api.post("/papers/upload", formData, {
    ...(onUploadProgress && { onUploadProgress }),
  });

  return res.data;
};

/* =====================================================
UPDATE PAPER
===================================================== */

export const updatePaper = async (id, data) => {
  validateId(id);

  if (!data) {
    throw new Error("Update data required");
  }

  const res = await api.put(`/papers/${id}`, data);

  return res.data;
};

/* =====================================================
DELETE PAPER
===================================================== */

export const deletePaper = async (id) => {
  validateId(id);

  const res = await api.delete(`/papers/admin/reject/${id}`);

  return res.data;
};

/* =====================================================
TRENDING PAPERS
===================================================== */

export const getTrendingPapers = async () => {
  const res = await api.get("/papers/trending");

  return res.data;
};

/* =====================================================
RATE PAPER ⭐ (FIXED)
===================================================== */

export const ratePaper = async (id, rating) => {
  validateId(id);

  if (typeof rating !== "number" || rating < 1 || rating > 5) {
    throw new Error("Rating must be between 1 and 5");
  }

  const res = await api.post(`/papers/${id}/rate`, { rating });

  return res.data;
};

/* =====================================================
BOOKMARK PAPER 🔖
===================================================== */

export const toggleBookmark = async (id) => {
  validateId(id);

  const res = await api.post(`/users/bookmark/${id}`);

  return res.data;
};

/* =====================================================
GET USER BOOKMARKS
===================================================== */

export const getBookmarks = async () => {
  const res = await api.get("/users/profile");

  return res.data?.user?.bookmarks || res.data?.bookmarks || [];
};

/* =====================================================
VIEW COUNTER
===================================================== */

export const incrementView = async (id) => {
  validateId(id);

  const res = await api.post(`/papers/${id}/view`);

  return res.data;
};

/* =====================================================
DOWNLOAD COUNTER
===================================================== */

export const incrementDownload = async (id) => {
  validateId(id);

  const res = await api.post(`/papers/${id}/download`);

  return res.data;
};

/* =====================================================
USER PAPERS
===================================================== */

export const getMyPapers = async () => {
  const res = await api.get("/users/my-papers");

  return res.data;
};
/* =====================================================
ADD COMMENT
===================================================== */

export const addComment = async (id, text) => {
  validateId(id);

  const res = await api.post(`/papers/${id}/comment`, {
    text,
  });

  return res.data;
};

/* =====================================================
DELETE COMMENT
===================================================== */

export const deleteComment = async (paperId, commentId) => {
  validateId(paperId);

  if (!commentId) {
    throw new Error("Comment ID required");
  }

  const res = await api.delete(`/papers/${paperId}/comment/${commentId}`);

  return res.data;
};
