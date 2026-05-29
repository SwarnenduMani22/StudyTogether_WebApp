import api from "./axios";

/* =====================================================
USER DASHBOARD STATS
===================================================== */

export const getUserStats = async () => {
  const res = await api.get("/users/stats");

  return res.data;
};

/* =====================================================
GET PROFILE
===================================================== */

export const getProfile = async () => {
  const res = await api.get("/users/profile");

  return res.data;
};

/* =====================================================
UPDATE PROFILE
===================================================== */

export const updateProfile = async (data) => {
  const res = await api.put("/users/update", data);

  return res.data;
};

/* =====================================================
DELETE ACCOUNT
===================================================== */

export const deleteAccount = async () => {
  const res = await api.delete("/users/delete");

  return res.data;
};

/* =====================================================
TOGGLE BOOKMARK
===================================================== */

export const toggleBookmark = async (paperId) => {
  const res = await api.post(`/users/bookmark/${paperId}`);

  return res.data;
};

/* =====================================================
LEADERBOARD
===================================================== */

export const getLeaderboard = async () => {
  const res = await api.get("/users/leaderboard");

  return res.data;
};
