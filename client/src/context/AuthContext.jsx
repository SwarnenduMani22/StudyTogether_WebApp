import { useEffect, useState } from "react";
import api from "../api/axios";
import AuthContext from "./auth-context";
import Loader from "../components/common/Loader";
/* ================= PROVIDER ================= */

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  /* ================= LOAD AUTH ================= */

  useEffect(() => {
    try {
      const storedUser = localStorage.getItem("user");
      const storedToken = localStorage.getItem("accessToken");

      if (storedUser && storedToken) {
        const parsedUser = JSON.parse(storedUser);

        setUser(parsedUser);
        setToken(storedToken);

        api.defaults.headers.common["Authorization"] = `Bearer ${storedToken}`;
      }
    } catch (error) {
      console.error("Auth load error:", error);

      localStorage.removeItem("user");
      localStorage.removeItem("accessToken");
    } finally {
      setLoading(false);
    }
  }, []);

  /* ================= LOGIN ================= */

  const login = (userData, tokenData) => {
    if (!userData || !tokenData) return;

    setUser(userData);
    setToken(tokenData);

    localStorage.setItem("user", JSON.stringify(userData));
    localStorage.setItem("accessToken", tokenData);

    api.defaults.headers.common["Authorization"] = `Bearer ${tokenData}`;
  };

  /* ================= LOGOUT ================= */

  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } catch (error) {
      console.error("Logout API error:", error);
    } finally {
      setUser(null);
      setToken(null);

      localStorage.removeItem("user");
      localStorage.removeItem("accessToken");

      delete api.defaults.headers.common["Authorization"];

      window.location.replace("/login");
    }
  };
  /* ================= UPDATE USER ================= */

  const updateUser = (updatedUser) => {
    if (!updatedUser) return;

    setUser(updatedUser);

    localStorage.setItem("user", JSON.stringify(updatedUser));
  };

  /* ================= CONTEXT VALUE ================= */

  const value = {
    user,
    token,
    loading,
    login,
    logout,
    setUser,
    updateUser,
    isAuthenticated: !!user && !!token,
    isAdmin: user?.role === "admin",
  };

  if (loading) return <Loader />;

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
