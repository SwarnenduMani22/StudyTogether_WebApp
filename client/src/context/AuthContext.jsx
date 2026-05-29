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
      const storedUser = sessionStorage.getItem("user");
      const storedToken = sessionStorage.getItem("accessToken");

      if (storedUser && storedToken) {
        const parsedUser = JSON.parse(storedUser);

        setUser(parsedUser);
        setToken(storedToken);

        api.defaults.headers.common["Authorization"] = `Bearer ${storedToken}`;
      }
    } catch (error) {
      console.error("Auth load error:", error);

      sessionStorage.removeItem("user");
      sessionStorage.removeItem("accessToken");
      sessionStorage.removeItem("refreshToken");
    } finally {
      setLoading(false);
    }
  }, []);

  /* ================= LOGIN ================= */

  const login = (userData, tokenData) => {
    if (!userData || !tokenData) return;

    setUser(userData);
    setToken(tokenData);

    sessionStorage.setItem("user", JSON.stringify(userData));
    sessionStorage.setItem("accessToken", tokenData);

    api.defaults.headers.common["Authorization"] = `Bearer ${tokenData}`;
  };

  /* ================= LOGOUT ================= */

  const logout = () => {
    setUser(null);
    setToken(null);

    sessionStorage.removeItem("user");
    sessionStorage.removeItem("accessToken");
    sessionStorage.removeItem("refreshToken");

    delete api.defaults.headers.common["Authorization"];

    window.location.replace("/login");
  };
  /* ================= UPDATE USER ================= */

  const updateUser = (updatedUser) => {
    if (!updatedUser) return;

    setUser(updatedUser);

    sessionStorage.setItem("user", JSON.stringify(updatedUser));
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
