import api from "./axios";

/* ================= HELPER ================= */

const validateId = (id) => {
  if (!id) {
    throw new Error("ID required");
  }
};

/* =====================================================
ADMIN DASHBOARD STATS
===================================================== */

export const getAdminStats = async () => {
  const res = await api.get("/admin/stats");

  return res.data;
};

/* =====================================================
GET ALL USERS (ADMIN)
Search + Pagination
===================================================== */

export const getUsers = async ({ page = 1, search = "" } = {}) => {
  const res = await api.get("/admin/users", {
    params: { page, search },
  });

  return res.data;
};

/* =====================================================
DELETE USER (ADMIN)
===================================================== */

export const deleteUser = async (id) => {
  validateId(id);

  const res = await api.delete(`/admin/users/${id}`);

  return res.data;
};

/* =====================================================
CHANGE USER ROLE (ADMIN)
===================================================== */

export const changeUserRole = async (id, role) => {
  validateId(id);

  if (!role) {
    throw new Error("Role required");
  }

  const res = await api.put(`/admin/users/${id}/role`, { role });

  return res.data;
};

/* =====================================================
UPDATE USER ACCOUNT STATUS (ADMIN)
===================================================== */

export const updateUserStatus = async (id, { status, reason }) => {
  validateId(id);

  if (!status || !reason) {
    throw new Error("Status and reason are required");
  }

  const res = await api.put(`/admin/users/${id}/status`, { status, reason });

  return res.data;
};

/* =====================================================
GRANT COINS TO USER (ADMIN)
===================================================== */

export const grantUserCoins = async (id, { amount, reason, idempotencyKey }) => {
  validateId(id);

  if (!amount || !reason || !idempotencyKey) {
    throw new Error("Amount, reason, and idempotencyKey are required");
  }

  const res = await api.post(`/admin/users/${id}/grant-coins`, {
    amount: Number(amount),
    reason,
    idempotencyKey,
  });

  return res.data;
};

/* =====================================================
GET PENDING PAPERS (ADMIN APPROVAL)
===================================================== */

export const getPendingPapers = async () => {
  const res = await api.get("/papers/admin/pending");

  return res.data;
};

/* =====================================================
APPROVE PAPER (ADMIN)
===================================================== */

export const approvePaper = async (id) => {
  validateId(id);

  const res = await api.put(`/papers/admin/approve/${id}`);

  return res.data;
};

export const getPaymentAnalytics = async () => {
  const response = await api.get("/payment/admin/analytics");

  return response.data;
};
export const getPackageSales = async () => {
  const response = await api.get("/payment/admin/package-sales");

  return response.data;
};
export const getPaymentList = async ({
  page = 1,
  limit = 10,
  search = "",
  status = "all",
} = {}) => {
  const response = await api.get("/payment/admin/list", {
    params: {
      page,
      limit,
      search,
      status,
    },
  });

  return response.data;
};
