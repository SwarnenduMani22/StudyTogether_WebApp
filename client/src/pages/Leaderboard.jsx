import { useEffect, useState } from "react";
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
    <div className="max-w-4xl mx-auto">
      {" "}
      <div className="mb-8">
        {" "}
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white">
          🏆 Leaderboard{" "}
        </h1>
        <p className="text-gray-500 mt-2">Top contributors on the platform</p>
      </div>
      <div className="space-y-4">
        {leaders.map((user, index) => (
          <div
            key={user._id || index}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-5 flex items-center justify-between"
          >
            <div className="flex items-center gap-4">
              <div className="text-3xl font-bold">{getRankBadge(index)}</div>

              <div>
                <h2 className="text-lg font-semibold text-gray-800 dark:text-white">
                  {user.name}
                </h2>

                <p className="text-sm text-gray-500">
                  {user.approvedUploads} approved uploads
                </p>
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
        ))}
      </div>
    </div>
  );
}
