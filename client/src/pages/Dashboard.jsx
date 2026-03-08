import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import Skeleton from "../components/common/Skeleton";
import { useAuth } from "../context/AuthContext";
import { getUserStats } from "../api/user";

const Dashboard = () => {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);

  const [stats, setStats] = useState({
    uploaded: 0,
    approved: 0,
    pending: 0,
  });

  /* ================= FETCH STATS ================= */

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await getUserStats();
        setStats(data);
      } catch (error) {
        console.error("Dashboard stats error:", error);
      } finally {
        setTimeout(() => {
          setLoading(false);
        }, 500);
      }
    };

    fetchStats();
  }, []);

  /* ================= Skeleton ================= */

  if (loading) {
    return (
      <div className="min-h-screen p-8 space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-6 w-40" />

        <div className="grid md:grid-cols-3 gap-6">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>

        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 p-8 transition-colors duration-300">
      {/* ================= WELCOME ================= */}

      <div className="mb-10 fade-in">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white">
          Welcome, {user?.name} 👋
        </h1>

        <p className="text-gray-500 dark:text-gray-400 mt-2">
          Here’s your dashboard overview
        </p>
      </div>

      {/* ================= USER STATS ================= */}

      <div className="grid md:grid-cols-3 gap-6 mb-10">
        {/* Uploaded */}

        <div className="card text-center">
          <p className="text-gray-500 dark:text-gray-400">Uploaded Papers</p>

          <h2 className="text-3xl font-bold text-indigo-600">
            {stats.uploaded}
          </h2>
        </div>

        {/* Approved */}

        <div className="card text-center">
          <p className="text-gray-500 dark:text-gray-400">Approved Papers</p>

          <h2 className="text-3xl font-bold text-green-500">
            {stats.approved}
          </h2>
        </div>

        {/* Pending */}

        <div className="card text-center">
          <p className="text-gray-500 dark:text-gray-400">Pending Papers</p>

          <h2 className="text-3xl font-bold text-yellow-500">
            {stats.pending}
          </h2>
        </div>
      </div>

      {/* ================= DASHBOARD NAVIGATION ================= */}

      <div className="grid md:grid-cols-3 gap-6">
        {/* Browse Papers */}

        <Link to="/papers" className="card hover-lift text-center transition">
          <div className="text-4xl">📚</div>

          <h3 className="text-xl font-semibold mt-3">Browse Papers</h3>

          <p className="text-gray-500 dark:text-gray-400 mt-2">
            View and download study materials.
          </p>
        </Link>

        {/* Profile */}

        <Link to="/profile" className="card hover-lift text-center transition">
          <div className="text-4xl">👤</div>

          <h3 className="text-xl font-semibold mt-3">Profile</h3>

          <p className="text-gray-500 dark:text-gray-400 mt-2">
            Update your account information.
          </p>
        </Link>

        {/* Admin Panel */}

        {user?.role === "admin" && (
          <Link to="/admin" className="card hover-lift text-center transition">
            <div className="text-4xl">👑</div>

            <h3 className="text-xl font-semibold mt-3">Admin Panel</h3>

            <p className="text-gray-500 dark:text-gray-400 mt-2">
              Manage users and uploaded papers.
            </p>
          </Link>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
