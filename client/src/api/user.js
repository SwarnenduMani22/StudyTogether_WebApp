import api from "./axios";

/* ================= USER DASHBOARD STATS ================= */

export const getUserStats = async () => {
  const res = await api.get("/users/stats");
  return res.data;
};
