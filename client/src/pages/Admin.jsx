import { useEffect, useState, useCallback } from "react";
import api from "../api/axios";
import Skeleton from "../components/common/Skeleton";
import AdminCharts from "../components/admin/AdminCharts";
import useAuth from "../hooks/useAuth";
import toast from "react-hot-toast";

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
  });

  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");

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
      });
    } catch (err) {
      console.error("Fetch stats error:", err);
      toast.error("Failed to load dashboard stats");
    }
  }, []);

  /* ================= LOAD DASHBOARD ================= */

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      await Promise.all([fetchUsers(), fetchStats()]);
    } catch (err) {
      console.error("Dashboard load error:", err);
      setError("Failed to load admin dashboard");
    } finally {
      setLoading(false);
    }
  }, [fetchUsers, fetchStats]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  /* ================= DELETE USER ================= */

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this user?")) return;

    try {
      setProcessing(true);

      await api.delete(`/admin/users/${id}`);

      setUsers((prev) => prev.filter((u) => u._id !== id));

      setStats((prev) => ({
        ...prev,
        users: Math.max(prev.users - 1, 0),
      }));

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

      setUsers((prev) =>
        prev.map((u) => (u._id === id ? { ...u, role: newRole } : u)),
      );

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
      <div className="max-w-6xl mx-auto space-y-10 fade-in">
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

        {/* ================= STATS ================= */}

        <div className="grid md:grid-cols-5 gap-6">
          <div className="card text-center">
            <p className="text-gray-500">Users</p>
            <h3 className="text-3xl font-bold">{stats.users}</h3>
          </div>

          <div className="card text-center">
            <p className="text-gray-500">Admins</p>
            <h3 className="text-3xl font-bold">{stats.admins}</h3>
          </div>

          <div className="card text-center">
            <p className="text-gray-500">Papers</p>
            <h3 className="text-3xl font-bold">{stats.papers}</h3>
          </div>

          <div className="card text-center">
            <p className="text-gray-500">Views</p>
            <h3 className="text-3xl font-bold">{stats.views}</h3>
          </div>

          <div className="card text-center">
            <p className="text-gray-500">Downloads</p>
            <h3 className="text-3xl font-bold">{stats.downloads}</h3>
          </div>
        </div>

        {/* ================= CHARTS ================= */}

        <AdminCharts stats={stats} />

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
