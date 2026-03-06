import { useEffect, useState } from "react";
import Skeleton from "../components/Skeleton";
import { useAuth } from "../context/AuthContext";
import { Link } from "react-router-dom";

const Dashboard = () => {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 600);

    return () => clearTimeout(timer);
  }, []);

  /* ================= Skeleton ================= */

  if (loading) {
    return (
      <div className="min-h-screen p-8 space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 p-8 transition-colors duration-300">
      {/* Welcome */}

      <div className="mb-10 fade-in">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white">
          Welcome, {user?.name} 👋
        </h1>

        <p className="text-gray-500 dark:text-gray-400 mt-2">
          Here’s your dashboard overview
        </p>
      </div>

      {/* Dashboard Cards */}

      <div className="grid md:grid-cols-3 gap-6">
        {/* Papers */}

        <Link to="/papers" className="card hover-lift text-center">
          <div className="text-4xl">📚</div>

          <h3 className="text-xl font-semibold mt-3">Browse Papers</h3>

          <p className="text-gray-500 dark:text-gray-400 mt-2">
            View and download study materials.
          </p>
        </Link>

        {/* Profile */}

        <Link to="/profile" className="card hover-lift text-center">
          <div className="text-4xl">👤</div>

          <h3 className="text-xl font-semibold mt-3">Profile</h3>

          <p className="text-gray-500 dark:text-gray-400 mt-2">
            Update your account information.
          </p>
        </Link>

        {/* Admin Panel */}

        {user?.role === "admin" && (
          <Link to="/admin" className="card hover-lift text-center">
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
