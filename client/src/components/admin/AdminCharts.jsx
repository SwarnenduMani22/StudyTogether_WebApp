import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from "recharts";

/* ================= COLORS ================= */

const COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#06b6d4", "#ef4444"];

const AdminCharts = ({ stats = {} }) => {
  /* ================= SAFE DATA ================= */

  const data = useMemo(() => {
    return [
      { name: "Users", value: stats?.users || 0 },
      { name: "Admins", value: stats?.admins || 0 },
      { name: "Papers", value: stats?.papers || 0 },
      { name: "Views", value: stats?.views || 0 },
      { name: "Downloads", value: stats?.downloads || 0 },
    ];
  }, [stats]);

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
      {/* ================= HEADER ================= */}

      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-semibold text-gray-800 dark:text-white">
          Platform Analytics 📊
        </h3>

        <span className="text-sm text-gray-500 dark:text-gray-400">
          Live Statistics
        </span>
      </div>

      {/* ================= CHART ================= */}

      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={data} barSize={55}>
          <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />

          <XAxis dataKey="name" stroke="#9ca3af" tick={{ fill: "#9ca3af" }} />

          <YAxis
            stroke="#9ca3af"
            tick={{ fill: "#9ca3af" }}
            allowDecimals={false}
          />

          {/* ================= TOOLTIP ================= */}

          <Tooltip
            cursor={{ fill: "rgba(99,102,241,0.1)" }}
            contentStyle={{
              backgroundColor: "#111827",
              borderRadius: "8px",
              border: "none",
              color: "#fff",
            }}
            labelStyle={{
              color: "#9ca3af",
              fontWeight: "500",
            }}
          />

          {/* ================= BARS ================= */}

          <Bar dataKey="value" radius={[8, 8, 0, 0]} animationDuration={700}>
            {data.map((entry, index) => (
              <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* ================= SUMMARY ================= */}

      <div className="grid grid-cols-5 gap-4 mt-6 text-center">
        <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg">
          <p className="text-sm text-gray-500 dark:text-gray-300">Users</p>
          <p className="text-lg font-bold text-indigo-600">
            {stats?.users || 0}
          </p>
        </div>

        <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg">
          <p className="text-sm text-gray-500 dark:text-gray-300">Admins</p>
          <p className="text-lg font-bold text-green-500">
            {stats?.admins || 0}
          </p>
        </div>

        <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg">
          <p className="text-sm text-gray-500 dark:text-gray-300">Papers</p>
          <p className="text-lg font-bold text-yellow-500">
            {stats?.papers || 0}
          </p>
        </div>

        <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg">
          <p className="text-sm text-gray-500 dark:text-gray-300">Views</p>
          <p className="text-lg font-bold text-cyan-500">{stats?.views || 0}</p>
        </div>

        <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg">
          <p className="text-sm text-gray-500 dark:text-gray-300">Downloads</p>
          <p className="text-lg font-bold text-red-500">
            {stats?.downloads || 0}
          </p>
        </div>
      </div>
    </div>
  );
};

export default AdminCharts;
