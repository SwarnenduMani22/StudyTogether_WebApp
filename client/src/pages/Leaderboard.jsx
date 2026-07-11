import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";

import Skeleton from "../components/common/Skeleton";
import toast from "react-hot-toast";

export default function Leaderboard() {
  const [leaders, setLeaders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const res = await api.get("/users/leaderboard");

        setLeaders(res.data.leaderboard || []);
      } catch (error) {
        console.error("Leaderboard error:", error);

        toast.error("Failed to load leaderboard");
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, []);

  const getRankBadge = (index) => {
    if (index === 0) return "🥇";
    if (index === 1) return "🥈";
    if (index === 2) return "🥉";

    return `#${index + 1}`;
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        {" "}
        <Skeleton className="h-32 w-full rounded-xl" />{" "}
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      {" "}
      <div className="mb-8">
        {" "}
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white">
          🏆 Leaderboard{" "}
        </h1>
        <p className="text-gray-500 mt-2">Top contributors on the platform</p>
      </div>
      <div className="space-y-4">
        {leaders.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 text-center">
            No leaderboard data available
          </div>
        ) : (
          leaders.map((user, index) => (
            <div
              key={user._id || index}
              className={`rounded-xl shadow-sm p-5 flex items-center justify-between
${
  index === 0
    ? "bg-yellow-50 border border-yellow-300"
    : index === 1
      ? "bg-gray-50 border border-gray-300"
      : index === 2
        ? "bg-orange-50 border border-orange-300"
        : "bg-white dark:bg-gray-800"
}`}
            >
              <div className="flex items-center gap-4">
                <div className="text-3xl font-bold">{getRankBadge(index)}</div>

                <div>
                  <Link
                    to={`/profile/${user._id}`}
                    className="text-lg font-semibold text-gray-800 dark:text-white hover:text-indigo-600 transition"
                  >
                    {user.name}
                  </Link>

                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        user.rank === "Legend"
                          ? "bg-purple-100 text-purple-700"
                          : user.rank === "Expert"
                            ? "bg-yellow-100 text-yellow-700"
                            : user.rank === "Scholar"
                              ? "bg-blue-100 text-blue-700"
                              : user.rank === "Explorer"
                                ? "bg-green-100 text-green-700"
                                : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {user.rank}
                    </span>

                    <span className="text-sm text-gray-500">
                      {user.approvedUploads} approved uploads
                    </span>
                  </div>
                </div>
              </div>

              <div className="text-right">
                <div className="text-xl font-bold text-yellow-500">
                  🪙 {user.coins}
                </div>

                <p className="text-sm text-gray-500">
                  {user.totalUploads} uploads
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
