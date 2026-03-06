import api from "./axios";

/* ================= GET PAPERS ================= */

export const getPapers = ({
  page = 1,
  search = "",
  semester = "all",
  subject = "all",
} = {}) => {
  return api.get(
    `/papers?page=${page}&search=${search}&semester=${semester}&subject=${subject}`,
  );
};

/* ================= UPLOAD PAPER ================= */

export const uploadPaper = (data) => {
  return api.post("/papers/upload", data, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
};

/* ================= DELETE PAPER ================= */

export const deletePaper = (id) => {
  return api.delete(`/papers/${id}`);
};

/* ================= VIEW COUNTER ================= */

export const incrementView = (id) => {
  return api.post(`/papers/${id}/view`);
};

/* ================= DOWNLOAD COUNTER ================= */

export const incrementDownload = (id) => {
  return api.post(`/papers/${id}/download`);
};
