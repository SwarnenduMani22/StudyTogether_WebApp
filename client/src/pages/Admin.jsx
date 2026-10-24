import { useEffect, useState, useCallback } from "react";
import api from "../api/axios";
import Skeleton from "../components/common/Skeleton";
import AdminCharts from "../components/admin/AdminCharts";
import AccountStatusModal from "../components/admin/AccountStatusModal";
import CoinGrantModal from "../components/admin/CoinGrantModal";
import useAuth from "../hooks/useAuth";
import toast from "react-hot-toast";
import {
  getPaymentAnalytics,
  getPackageSales,
  getPaymentList,
} from "../api/admin";

const Admin = () => {
  const { user: loggedInUser, updateUser } = useAuth();

  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [statusModalUser, setStatusModalUser] = useState(null);
  const [coinGrantUser, setCoinGrantUser] = useState(null);

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
                    <th className="p-3 text-left">Status</th>
                    <th className="p-3 text-left">Coins</th>
                    <th className="p-3 text-left">Action</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredUsers.map((user) => {
                    const isActive =
                      user.isActive !== false && user.status !== "disabled";
                    const isSelf = loggedInUser?._id === user._id;

                    return (
                      <tr
                        key={user._id}
                        className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition"
                      >
                        <td className="p-3 font-medium">{user.name}</td>

                        <td className="p-3 text-gray-600 dark:text-gray-300 font-mono text-xs">
                          {user.email}
                        </td>

                        <td className="p-3">
                          {!isSelf ? (
                            <select
                              value={user.role}
                              disabled={processing}
                              onChange={(e) =>
                                handleRoleChange(user._id, e.target.value)
                              }
                              className="input py-1 text-xs"
                            >
                              <option value="user">User</option>
                              <option value="admin">Admin</option>
                            </select>
                          ) : (
                            <span className="capitalize font-medium text-xs bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded">
                              {user.role} (You)
                            </span>
                          )}
                        </td>

                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-semibold inline-block ${
                              isActive
                                ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
                                : "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"
                            }`}
                            title={
                              user.disabledReason ||
                              (isActive ? "Account active" : "Account disabled")
                            }
                          >
                            {isActive ? "Active" : "Disabled"}
                          </span>
                        </td>

                        <td className="p-3">
                          <span className="font-bold text-yellow-600 dark:text-yellow-400 text-sm">
                            {user.coins || 0} 🪙
                          </span>
                        </td>

                        <td className="p-3">
                          <div className="flex flex-wrap items-center gap-2">
                            {/* Coin Grant Button */}
                            <button
                              disabled={processing || !isActive}
                              onClick={() => setCoinGrantUser(user)}
                              title={
                                !isActive
                                  ? "Cannot grant coins to disabled user"
                                  : "Grant custom coins"
                              }
                              className="bg-amber-500 hover:bg-amber-600 text-white px-2.5 py-1 text-xs rounded shadow-sm disabled:opacity-40 transition font-medium"
                            >
                              🪙 Grant Coins
                            </button>

                            {/* Enable / Disable Button */}
                            {isSelf ? (
                              <button
                                disabled
                                title="You cannot disable your own account"
                                className="bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed px-2.5 py-1 text-xs rounded font-medium"
                              >
                                Disable
                              </button>
                            ) : (
                              <button
                                disabled={processing}
                                onClick={() => setStatusModalUser(user)}
                                className={`text-white px-2.5 py-1 text-xs rounded shadow-sm disabled:opacity-50 transition font-medium ${
                                  isActive
                                    ? "bg-orange-500 hover:bg-orange-600"
                                    : "bg-green-600 hover:bg-green-700"
                                }`}
                              >
                                {isActive ? "Disable" : "Enable"}
                              </button>
                            )}

                            {/* Delete Button */}
                            {!isSelf && (
                              <button
                                disabled={processing}
                                onClick={() => handleDelete(user._id)}
                                className="bg-red-500 hover:bg-red-600 text-white px-2.5 py-1 text-xs rounded shadow-sm disabled:opacity-50 transition font-medium"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* MODALS */}
        <AccountStatusModal
          user={statusModalUser}
          currentAdmin={loggedInUser}
          isOpen={!!statusModalUser}
          onClose={() => setStatusModalUser(null)}
          onSuccess={(updatedUser) => {
            setUsers((prev) =>
              prev.map((u) =>
                u._id === updatedUser._id ? { ...u, ...updatedUser } : u,
              ),
            );
            fetchStats();
          }}
        />

        <CoinGrantModal
          user={coinGrantUser}
          isOpen={!!coinGrantUser}
          onClose={() => setCoinGrantUser(null)}
          onSuccess={({ user: updatedUser }) => {
            setUsers((prev) =>
              prev.map((u) =>
                u._id === updatedUser._id
                  ? { ...u, coins: updatedUser.coins }
                  : u,
              ),
            );
            fetchTopCoinHolders();
            fetchCoinAnalytics();
            if (loggedInUser?._id === updatedUser._id && updateUser) {
              updateUser({ ...loggedInUser, coins: updatedUser.coins });
            }
          }}
        />
      </div>
    </div>
  );
};

export default Admin;
