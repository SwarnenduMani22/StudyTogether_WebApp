import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

const AdminCharts = ({ stats }) => {
  const data = [
    {
      name: "Users",
      value: stats.users,
    },
    {
      name: "Admins",
      value: stats.admins,
    },
    {
      name: "Papers",
      value: stats.papers,
    },
  ];

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
      <h3 className="text-xl font-semibold mb-6 text-gray-800 dark:text-white">
        Platform Statistics 📊
      </h3>

      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          {/* Grid */}
          <CartesianGrid strokeDasharray="3 3" />

          {/* Axis */}
          <XAxis dataKey="name" />
          <YAxis />

          {/* Tooltip */}
          <Tooltip
            contentStyle={{
              backgroundColor: "#111827",
              border: "none",
              borderRadius: "6px",
              color: "#fff",
            }}
          />

          {/* Bars */}
          <Bar dataKey="value" fill="#6366f1" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default AdminCharts;
