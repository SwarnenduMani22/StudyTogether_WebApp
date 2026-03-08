import { createContext, useContext, useEffect, useState } from "react";
import api from "../api/axios";

const AuthContext = createContext();

/* ================= PROVIDER ================= */

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  /* ================= LOAD AUTH ================= */

  useEffect(() => {
    try {
      const storedUser = sessionStorage.getItem("user");
      const storedToken = sessionStorage.getItem("token");

      if (storedUser && storedToken) {
        const parsedUser = JSON.parse(storedUser);

        setUser(parsedUser);
        setToken(storedToken);

        api.defaults.headers.common["Authorization"] = `Bearer ${storedToken}`;
      }
    } catch (error) {
      console.error("Auth load error:", error);

      /* corrupted storage fix */

      sessionStorage.removeItem("user");
      sessionStorage.removeItem("token");
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
    sessionStorage.setItem("token", tokenData);

    api.defaults.headers.common["Authorization"] = `Bearer ${tokenData}`;
  };

  /* ================= LOGOUT ================= */

  const logout = () => {
    setUser(null);
    setToken(null);

    sessionStorage.removeItem("user");
    sessionStorage.removeItem("token");

    delete api.defaults.headers.common["Authorization"];

    window.location.href = "/login";
  };

  /* ================= CONTEXT VALUE ================= */

  const value = {
    user,
    token,
    loading,
    login,
    logout,
    setUser,
    isAuthenticated: !!user,
    isAdmin: user?.role === "admin",
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

/* ================= CUSTOM HOOK ================= */
export { AuthContext };
export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
};
