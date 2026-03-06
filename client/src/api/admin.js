import api from "./axios";

/* ================= ADMIN STATS ================= */

export const getAdminStats = () => {
  return api.get("/admin/stats");
};
