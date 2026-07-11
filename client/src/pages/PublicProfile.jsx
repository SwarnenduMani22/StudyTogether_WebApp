import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../api/axios";
import Skeleton from "../components/common/Skeleton";
import toast from "react-hot-toast";

const PublicProfile = () => {
  const { id } = useParams();
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPublicData = async () => {
      try {
        setLoading(true);
        const [profileRes, statsRes] = await Promise.all([
          api.get(`/users/public/${id}`),
          api.get(`/users/public/${id}/stats`),
        ]);

        setProfile(profileRes.data.user);
        setStats(statsRes.data.monthlyUploads || []);
      } catch (err) {
        console.error("Public profile fetch error:", err);
        toast.error("Failed to load public profile");
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchPublicData();
  }, [id]);

  const getRankStyle = (rank) => {
    switch (rank) {
      case "Legend":
        return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300";
      case "Expert":
        return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300";
      case "Scholar":
        return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300";
      case "Explorer":
        return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300";
      default:
        return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
    }
  };

  const getMonthName = (monthNum) => {
    const months = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    ];
    return months[monthNum - 1] || "Month";
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <Skeleton className="h-12 w-48 rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-4xl mx-auto p-6 text-center">
        <p className="text-gray-500 text-lg">User profile not found</p>
        <Link to="/leaderboard" className="text-indigo-600 hover:underline mt-4 inline-block">
          Back to Leaderboard
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 transition-colors duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-8 border-b pb-6 border-gray-250 dark:border-gray-850">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 dark:text-white flex items-center gap-3">
            <span>{profile.name}</span>
            <span
              className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${getRankStyle(profile.rank)}`}
            >
              {profile.rank}
            </span>
          </h1>
          <p className="text-gray-500 mt-1">StudyTogether Contributor Profile</p>
        </div>
        <Link
          to="/leaderboard"
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition"
        >
          Leaderboard
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-250 dark:border-yellow-900/30 p-5 rounded-2xl shadow-sm text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Coins</p>
          <p className="text-3xl font-extrabold text-yellow-600 mt-2">🪙 {profile.coins || 0}</p>
        </div>

        <div className="bg-green-50 dark:bg-green-900/10 border border-green-250 dark:border-green-900/30 p-5 rounded-2xl shadow-sm text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">Approved Uploads</p>
          <p className="text-3xl font-extrabold text-green-600 mt-2">
            ✅ {profile.approvedUploads || 0}
          </p>
        </div>

        <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-250 dark:border-gray-700 p-5 rounded-2xl shadow-sm text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Uploads</p>
          <p className="text-3xl font-extrabold text-gray-700 dark:text-gray-300 mt-2">
            📚 {profile.totalUploads || 0}
          </p>
        </div>
      </div>

      {/* Achievements Section */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 mb-8">
        <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-4">
          Achievements & Badges
        </h3>
        {!profile.badges || profile.badges.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-450 text-sm">No badges unlocked yet.</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {profile.badges.map((badge, idx) => (
              <div
                key={idx}
                className="px-4 py-2 rounded-full bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 text-sm font-medium border border-indigo-100 dark:border-indigo-900/30 shadow-sm"
              >
                {badge}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Monthly Stats Section */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-4">
          Monthly Contribution Activity
        </h3>
        {stats.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-450 text-sm">No recent activity logged.</p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-12 gap-2 text-sm font-medium text-gray-500 border-b pb-2">
              <div className="col-span-4">Month</div>
              <div className="col-span-8">Approved Contributions</div>
            </div>
            {stats.map((item, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-center text-sm">
                <div className="col-span-4 font-semibold text-gray-700 dark:text-gray-300">
                  {getMonthName(item._id)}
                </div>
                <div className="col-span-8 flex items-center gap-3">
                  <div className="flex-1 bg-gray-100 dark:bg-gray-700 h-4 rounded-full overflow-hidden">
                    <div
                      className="bg-indigo-600 h-full rounded-full"
                      style={{ width: `${Math.min(item.count * 10, 100)}%` }}
                    />
                  </div>
                  <span className="font-bold text-gray-800 dark:text-white">{item.count} papers</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PublicProfile;
