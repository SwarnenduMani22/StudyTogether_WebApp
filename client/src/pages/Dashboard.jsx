import { useEffect, useState } from "react";

const Dashboard = () => {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 p-8 transition-colors duration-300">
      {/* Welcome Section */}
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white">
          Welcome, {user?.name || "User"} 👋
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-2">
          Here’s your dashboard overview
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md hover:shadow-lg transition">
          <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300">
            Total Papers
          </h2>
          <p className="text-3xl font-bold text-indigo-600 dark:text-indigo-400 mt-3">
            120
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md hover:shadow-lg transition">
          <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300">
            Uploaded Papers
          </h2>
          <p className="text-3xl font-bold text-green-600 mt-3">15</p>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md hover:shadow-lg transition">
          <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300">
            Coins
          </h2>
          <p className="text-3xl font-bold text-yellow-500 mt-3">350</p>
        </div>
      </div>

      {/* Quick Actions Section */}
      <div className="mt-12 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
        <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">
          Quick Actions
        </h2>

        <div className="flex flex-wrap gap-4">
          <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition">
            Upload Paper
          </button>

          <button className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition">
            View Papers
          </button>

          <button className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition">
            Profile
          </button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
