import { Navigate } from "react-router-dom";
import useAuth from "../hooks/useAuth";

/* ================= ADMIN ROUTE ================= */

const AdminRoute = ({ children }) => {
  const { user, loading } = useAuth();

  /* Wait until auth loads */

  if (loading) {
    return null;
  }

  /* Not logged in */

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  /* Not admin */

  if (user.role !== "admin") {
    return <Navigate to="/" replace />;
  }

  /* Allow access */

  return children;
};

export default AdminRoute;
