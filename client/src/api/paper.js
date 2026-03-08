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
(Search + Filter + Pagination + Sort)
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

  return res.data;
};

/* =====================================================
UPLOAD PAPER
(Admin + User)
===================================================== */

export const uploadPaper = async (formData, onUploadProgress) => {
  if (!formData) {
    throw new Error("Upload data required");
  }

  const res = await api.post("/papers/upload", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
    ...(onUploadProgress && { onUploadProgress }),
  });

  return res.data;
};

/* =====================================================
UPDATE PAPER (ADMIN)
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
DELETE PAPER (ADMIN)
===================================================== */

export const deletePaper = async (id) => {
  validateId(id);

  const res = await api.delete(`/papers/${id}`);

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
RATE PAPER ⭐
===================================================== */

export const ratePaper = async (id, rating) => {
  validateId(id);

  if (!rating) {
    throw new Error("Rating required");
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

  return res.data?.bookmarks || [];
};

/* =====================================================
VIEW COUNTER
===================================================== */

export const incrementView = async (id) => {
  validateId(id);

  await api.post(`/papers/${id}/view`);
};

/* =====================================================
DOWNLOAD COUNTER
===================================================== */

export const incrementDownload = async (id) => {
  validateId(id);

  await api.post(`/papers/${id}/download`);
};

/* =====================================================
USER UPLOADED PAPERS
===================================================== */

export const getMyPapers = async () => {
  const res = await api.get("/users/my-papers");

  return res.data;
};
