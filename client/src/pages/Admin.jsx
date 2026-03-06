import { useEffect, useState } from "react";
import api from "../api/axios";
import Skeleton from "../components/Skeleton";
import AdminCharts from "../components/AdminCharts";
import { useAuth } from "../context/AuthContext";

const Admin = () => {
  const { user: loggedInUser } = useAuth();

  const [users, setUsers] = useState([]);

  const [stats, setStats] = useState({
    users: 0,
    admins: 0,
    papers: 0,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  /* ================= FETCH USERS ================= */

  const fetchUsers = async () => {
    try {
      const res = await api.get("/admin/users");
      setUsers(res.data);
    } catch {
      setError("Failed to load users");
    }
  };

  /* ================= FETCH STATS ================= */

  const fetchStats = async () => {
    try {
      const res = await api.get("/admin/stats");
      setStats(res.data);
    } catch {
      setError("Failed to load stats");
    }
  };

  /* ================= LOAD DASHBOARD ================= */

  const loadDashboard = async () => {
    setLoading(true);
    setError("");

    await Promise.all([fetchUsers(), fetchStats()]);

    setLoading(false);
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  /* ================= DELETE USER ================= */

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this user?")) return;

    try {
      await api.delete(`/admin/users/${id}`);

      setUsers((prev) => prev.filter((u) => u._id !== id));

      setStats((prev) => ({
        ...prev,
        users: prev.users - 1,
      }));
    } catch (error) {
      alert(error.response?.data?.error || "Delete failed");
    }
  };

  /* ================= CHANGE ROLE ================= */

  const handleRoleChange = async (id, newRole) => {
    try {
      await api.put(`/admin/users/${id}/role`, { role: newRole });

      setUsers((prev) =>
        prev.map((u) => (u._id === id ? { ...u, role: newRole } : u)),
      );
    } catch (error) {
      alert(error.response?.data?.error || "Role update failed");
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 p-8">
      <div className="max-w-6xl mx-auto space-y-10 fade-in">
        {/* ================= TITLE ================= */}

        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold text-gray-800 dark:text-white">
            Admin Dashboard 👑
          </h2>

          <button
            onClick={loadDashboard}
            className="btn-primary w-auto px-4 py-2 text-sm"
          >
            Refresh
          </button>
        </div>

        {/* ================= ERROR ================= */}

        {error && <p className="text-red-500 font-medium">{error}</p>}

        {/* ================= ANALYTICS CARDS ================= */}

        <div className="grid md:grid-cols-3 gap-6">
          <div className="card">
            <p className="text-gray-500">Total Users</p>
            <h3 className="text-3xl font-bold">{stats.users}</h3>
          </div>

          <div className="card">
            <p className="text-gray-500">Admins</p>
            <h3 className="text-3xl font-bold">{stats.admins}</h3>
          </div>

          <div className="card">
            <p className="text-gray-500">Total Papers</p>
            <h3 className="text-3xl font-bold">{stats.papers}</h3>
          </div>
        </div>

        {/* ================= CHART ================= */}

        <AdminCharts stats={stats} />

        {/* ================= USER MANAGEMENT ================= */}

        <div className="card">
          <h3 className="text-xl font-semibold mb-6">User Management</h3>

          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : users.length === 0 ? (
            <p className="text-gray-500">No users found</p>
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
                  {users.map((user) => (
                    <tr key={user._id} className="border-b">
                      <td className="p-3">{user.name}</td>

                      <td className="p-3">{user.email}</td>

                      <td className="p-3">
                        {loggedInUser?._id !== user._id ? (
                          <select
                            value={user.role}
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
                            onClick={() => handleDelete(user._id)}
                            className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded"
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
