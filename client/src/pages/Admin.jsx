import { useEffect, useState, useCallback } from "react";
import api from "../api/axios";
import Skeleton from "../components/common/Skeleton";
import AdminCharts from "../components/admin/AdminCharts";
import useAuth from "../hooks/useAuth";
import toast from "react-hot-toast";
import {
  getPaymentAnalytics,
  getPackageSales,
  getPaymentList,
} from "../api/admin";

const Admin = () => {
  const { user: loggedInUser } = useAuth();

  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");

  const [stats, setStats] = useState({
    users: 0,
    admins: 0,
    papers: 0,
    views: 0,
    downloads: 0,
    pending: 0,
    approved: 0,
  });

  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [topContributors, setTopContributors] = useState([]);
  const [topCoinHolders, setTopCoinHolders] = useState([]);

  const [coinAnalytics, setCoinAnalytics] = useState({
    totalCoinsInSystem: 0,
    totalCoinsPurchased: 0,
    totalCoinsSpent: 0,
    totalTransactions: 0,
  });
  const [paymentAnalytics, setPaymentAnalytics] = useState({
    revenue: 0,
    totalPayments: 0,
    totalCoins: 0,
  });
  const [packageSales, setPackageSales] = useState([]);
  const [paymentList, setPaymentList] = useState([]);
  const [paymentSearch, setPaymentSearch] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("all");
  const [paymentPage, setPaymentPage] = useState(1);
  const [paymentTotalPages, setPaymentTotalPages] = useState(1);
  /* ================= FETCH USERS ================= */

  const fetchUsers = useCallback(async () => {
    try {
      const res = await api.get("/admin/users");

      const usersData = res?.data?.users || res?.data || [];

      setUsers(Array.isArray(usersData) ? usersData : []);
    } catch (err) {
      console.error("Fetch users error:", err);
      toast.error("Failed to load users");
      setUsers([]);
    }
  }, []);

  /* ================= FETCH STATS ================= */

  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get("/admin/stats");

      const data = res?.data || {};

      setStats({
        users: data.users || 0,
        admins: data.admins || 0,
        papers: data.papers || 0,
        views: data.views || 0,
        downloads: data.downloads || 0,
        pending: data.pending || 0,
        approved: data.approved || 0,
      });
    } catch (err) {
      console.error("Fetch stats error:", err);
      toast.error("Failed to load dashboard stats");
    }
  }, []);

  const fetchTopContributors = useCallback(async () => {
    try {
      const res = await api.get("/admin/top-contributors");

      setTopContributors(res.data?.contributors || []);
    } catch (error) {
      console.error(error);
    }
  }, []);

  const fetchTopCoinHolders = useCallback(async () => {
    try {
      const res = await api.get("/admin/top-coin-holders");

      setTopCoinHolders(res.data?.users || []);
    } catch (error) {
      console.error(error);
    }
  }, []);

  const fetchCoinAnalytics = useCallback(async () => {
    try {
      const res = await api.get("/admin/coin-analytics");

      setCoinAnalytics({
        totalCoinsInSystem: res.data?.totalCoinsInSystem || 0,
        totalCoinsPurchased: res.data?.totalCoinsPurchased || 0,
        totalCoinsSpent: res.data?.totalCoinsSpent || 0,
        totalTransactions: res.data?.totalTransactions || 0,
      });
    } catch (error) {
      console.error(error);
    }
  }, []);
  const fetchPaymentAnalytics = useCallback(async () => {
    try {
      const res = await getPaymentAnalytics();

      setPaymentAnalytics(res.analytics);
    } catch (error) {
      console.error(error);
    }
  }, []);
  const fetchPackageSales = useCallback(async () => {
    try {
      const data = await getPackageSales();

      setPackageSales(data.sales);
    } catch (error) {
      console.error(error);
    }
  }, []);

  const fetchPaymentList = useCallback(async () => {
    try {
      const data = await getPaymentList({
        page: paymentPage,
        search: paymentSearch,
        status: paymentStatus,
      });

      setPaymentList(data.payments || []);
      setPaymentTotalPages(data.totalPages || 1);
    } catch (error) {
      console.error(error);
    }
  }, [paymentPage, paymentSearch, paymentStatus]);

  /* ================= LOAD DASHBOARD ================= */

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      await Promise.all([
        fetchUsers(),
        fetchStats(),
        fetchTopContributors(),
        fetchTopCoinHolders(),
        fetchCoinAnalytics(),
        fetchPaymentAnalytics(),
        fetchPackageSales(),
        fetchPaymentList(),
      ]);
    } catch (err) {
      console.error("Dashboard load error:", err);
      setError("Failed to load admin dashboard");
    } finally {
      setLoading(false);
    }
  }, [
    fetchUsers,
    fetchStats,
    fetchTopContributors,
    fetchTopCoinHolders,
    fetchCoinAnalytics,
    fetchPaymentAnalytics,
    fetchPackageSales,
    fetchPaymentList,
  ]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);
  useEffect(() => {
    fetchPaymentList();
  }, [fetchPaymentList]);
  /* ================= DELETE USER ================= */

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this user?")) return;

    try {
      setProcessing(true);

      await api.delete(`/admin/users/${id}`);

      await Promise.all([fetchUsers(), fetchStats(), fetchTopCoinHolders()]);
      toast.success("User deleted");
    } catch (error) {
      console.error(error);
      toast.error(error?.response?.data?.error || "Delete failed");
    } finally {
      setProcessing(false);
    }
  };

  /* ================= CHANGE ROLE ================= */

  const handleRoleChange = async (id, newRole) => {
    try {
      setProcessing(true);

      await api.put(`/admin/users/${id}/role`, { role: newRole });

      await Promise.all([fetchUsers(), fetchStats(), fetchTopContributors()]);

      toast.success("Role updated");
    } catch (error) {
      console.error(error);
      toast.error(error?.response?.data?.error || "Role update failed");
    } finally {
      setProcessing(false);
    }
  };

  /* ================= SEARCH FILTER ================= */

  const filteredUsers = users.filter((u) => {
    const text = search.toLowerCase();

    return (
      u?.name?.toLowerCase()?.includes(text) ||
      u?.email?.toLowerCase()?.includes(text)
    );
  });

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 p-8">
      <div className="max-w-7xl mx-auto space-y-10 fade-in">
        {/* TITLE */}

        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold text-gray-800 dark:text-white">
            Admin Dashboard 👑
          </h2>

          <button
            disabled={loading}
            onClick={loadDashboard}
            className="btn-primary w-auto px-4 py-2 text-sm disabled:opacity-50"
          >
            Refresh
          </button>
        </div>

        {/* ERROR */}

        {error && (
          <p className="text-red-500 font-medium text-center">{error}</p>
        )}

        <AdminCharts stats={stats} />
        <div className="grid md:grid-cols-3 gap-6 mt-6">
          <div className="card text-center">
            <p className="text-gray-500">💰 Total Revenue</p>

            <h3 className="text-2xl font-bold text-green-600">
              ₹{paymentAnalytics.revenue}
            </h3>
          </div>

          <div className="card text-center">
            <p className="text-gray-500">💳 Successful Payments</p>

            <h3 className="text-2xl font-bold text-blue-600">
              {paymentAnalytics.totalPayments}
            </h3>
          </div>

          <div className="card text-center">
            <p className="text-gray-500">🪙 Coins Sold</p>

            <h3 className="text-2xl font-bold text-yellow-500">
              {paymentAnalytics.totalCoins}
            </h3>
          </div>
        </div>
        <div className="grid md:grid-cols-4 gap-6">
          <div className="card text-center">
            <p className="text-gray-500">Coins In System</p>
            <h3 className="text-2xl font-bold text-yellow-500">
              {coinAnalytics.totalCoinsInSystem}
            </h3>
          </div>

          <div className="card text-center">
            <p className="text-gray-500">Coins Purchased</p>
            <h3 className="text-2xl font-bold text-green-500">
              {coinAnalytics.totalCoinsPurchased}
            </h3>
          </div>

          <div className="card text-center">
            <p className="text-gray-500">Coins Spent</p>
            <h3 className="text-2xl font-bold text-red-500">
              {coinAnalytics.totalCoinsSpent}
            </h3>
          </div>

          <div className="card text-center">
            <p className="text-gray-500">Transactions</p>
            <h3 className="text-2xl font-bold">
              {coinAnalytics.totalTransactions}
            </h3>
          </div>
        </div>
        <div className="card">
          <h3 className="text-xl font-semibold mb-4">Top Contributors 🏆</h3>

          {topContributors.length === 0 ? (
            <p className="text-center text-gray-500 py-4">
              No contributor data available
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="p-3 text-left">Name</th>
                    <th className="p-3 text-left">Email</th>
                    <th className="p-3 text-left">Uploads</th>
                  </tr>
                </thead>

                <tbody>
                  {topContributors.map((user) => (
                    <tr key={user._id} className="border-b">
                      <td className="p-3">{user.name}</td>
                      <td className="p-3">{user.email}</td>
                      <td className="p-3 font-bold">{user.totalUploads}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="card">
          <h3 className="text-xl font-semibold mb-4">Top Coin Holders 💰</h3>

          {topCoinHolders.length === 0 ? (
            <p className="text-center text-gray-500 py-4">
              No coin holder data available
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="p-3 text-left">Name</th>
                    <th className="p-3 text-left">Email</th>
                    <th className="p-3 text-left">Coins</th>
                  </tr>
                </thead>

                <tbody>
                  {topCoinHolders.map((user) => (
                    <tr key={user._id} className="border-b">
                      <td className="p-3">{user.name}</td>
                      <td className="p-3">{user.email}</td>
                      <td className="p-3 font-bold text-yellow-500">
                        {user.coins}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card">
          <h3 className="text-xl font-semibold mb-4">Package Sales 📦</h3>

          {packageSales.length === 0 ? (
            <p className="text-center text-gray-500 py-4">
              No package sales available
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="p-3 text-left">Package</th>
                    <th className="p-3 text-left">Sales</th>
                    <th className="p-3 text-left">Revenue</th>
                    <th className="p-3 text-left">Coins Sold</th>
                  </tr>
                </thead>

                <tbody>
                  {packageSales.map((item) => (
                    <tr key={item._id} className="border-b">
                      <td className="p-3">{item._id}</td>
                      <td className="p-3">{item.totalSales}</td>
                      <td className="p-3 font-bold text-green-600">
                        ₹{item.revenue}
                      </td>
                      <td className="p-3">{item.coins}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card">
          <input
            className="input mb-4"
            placeholder="Search Name / Email / Payment ID / Order ID"
            value={paymentSearch}
            onChange={(e) => {
              setPaymentSearch(e.target.value);
              setPaymentPage(1);
            }}
          />{" "}
          <select
            className="input mb-4 ml-3"
            value={paymentStatus}
            onChange={(e) => {
              setPaymentStatus(e.target.value);
              setPaymentPage(1);
            }}
          >
            {" "}
            <option value="all">All</option>
            <option value="created">Created</option>
            <option value="captured">Captured</option>
            <option value="failed">Failed</option>
            <option value="refunded">Refunded</option>
          </select>
          <h3 className="text-xl font-semibold mb-4">Payment List 💳</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Package</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>

              <tbody>
                {paymentList.map((payment) => (
                  <tr key={payment._id}>
                    <td>{payment.user?.name}</td>
                    <td>{payment.packageName}</td>
                    <td>₹{payment.amount}</td>
                    <td>
                      <span
                        className={`px-2 py-1 rounded text-white
      ${
        payment.status === "captured"
          ? "bg-green-500"
          : payment.status === "failed"
            ? "bg-red-500"
            : payment.status === "created"
              ? "bg-yellow-500"
              : "bg-gray-500"
      }`}
                      >
                        {payment.status}
                      </span>
                    </td>
                    <td>{new Date(payment.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-center items-center gap-4 mt-6">
            <button
              disabled={paymentPage === 1}
              onClick={() => setPaymentPage((p) => p - 1)}
              className="btn"
            >
              Previous
            </button>

            <span>
              Page {paymentPage} of {paymentTotalPages}
            </span>

            <button
              disabled={paymentPage === paymentTotalPages}
              onClick={() => setPaymentPage((p) => p + 1)}
              className="btn"
            >
              Next
            </button>
          </div>
        </div>

        {/* ================= USER MANAGEMENT ================= */}

        <div className="card">
          <h3 className="text-xl font-semibold mb-4">User Management</h3>

          {/* SEARCH */}

          <input
            type="text"
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input mb-6 w-full md:w-80"
          />

          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <p className="text-gray-500 text-center">No users found</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-200 dark:bg-gray-700">
                    <th className="p-3 text-left">Name</th>
                    <th className="p-3 text-left">Email</th>
                    <th className="p-3 text-left">Role</th>
                    <th className="p-3 text-left">Action</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredUsers.map((user) => (
                    <tr key={user._id} className="border-b">
                      <td className="p-3">{user.name}</td>

                      <td className="p-3">{user.email}</td>

                      <td className="p-3">
                        {loggedInUser?._id !== user._id ? (
                          <select
                            value={user.role}
                            disabled={processing}
                            onChange={(e) =>
                              handleRoleChange(user._id, e.target.value)
                            }
                            className="input py-1"
                          >
                            <option value="user">User</option>
                            <option value="admin">Admin</option>
                          </select>
                        ) : (
                          <span className="capitalize font-medium">
                            {user.role}
                          </span>
                        )}
                      </td>

                      <td className="p-3">
                        {loggedInUser?._id !== user._id && (
                          <button
                            disabled={processing}
                            onClick={() => handleDelete(user._id)}
                            className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded disabled:opacity-50"
                          >
                            Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Admin;
