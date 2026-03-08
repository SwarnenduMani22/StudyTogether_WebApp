import { Navigate } from "react-router-dom";
import useAuth from "../hooks/useAuth";

/* ================= PROTECTED ROUTE ================= */

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();

  /* Wait for auth state */

  if (loading) {
    return null;
  }

  /* Not logged in */

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  /* Allow access */

  return children;
};

export default ProtectedRoute;
