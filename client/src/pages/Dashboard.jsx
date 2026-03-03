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
    </div>
  );
};

export default Dashboard;
