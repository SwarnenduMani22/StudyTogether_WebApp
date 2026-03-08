import { useContext } from "react";
import { AuthContext } from "../context/AuthContext";

/* ================= CUSTOM AUTH HOOK ================= */

const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
};

export default useAuth;
