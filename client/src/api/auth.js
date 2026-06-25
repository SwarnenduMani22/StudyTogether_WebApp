import api from "./axios";

/* ================= REGISTER ================= */

export const registerUser = async (userData) => {
  try {
    const res = await api.post("/auth/register", userData);

    return res.data;
  } catch (error) {
    throw error.message || "Registration failed";
  }
};

/* ================= LOGIN ================= */

export const loginUser = async (credentials) => {
  try {
    const res = await api.post("/auth/login", credentials);

    // 🔥 FIXED: correct destructuring
    const {
      accessToken,
      refreshToken,
      user,
      token, // fallback (keep your original structure safe)
    } = res.data;

    // 🔥 FIXED: support both token & accessToken
    if (accessToken || token) {
      localStorage.setItem("accessToken", accessToken || token);

      if (refreshToken) {
        localStorage.setItem("refreshToken", refreshToken);
      }

      localStorage.setItem("user", JSON.stringify(user));
    }

    return res.data;
  } catch (error) {
    throw error.message || "Login failed";
  }
};

/* ================= LOGOUT ================= */

export const logout = async () => {
  try {
    await api.post("/auth/logout"); // 🔥 backend call
  } catch (error) {
    console.error("Logout API error:", error);
  }

  // 🔥 FIXED: avoid crash if not defined
  try {
    if (typeof setUser === "function") setUser(null);
    if (typeof setToken === "function") setToken(null);
  } catch {}

  localStorage.removeItem("user");
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");

  delete api.defaults.headers.common["Authorization"];

  window.location.href = "/login";
};

/* ================= GET PROFILE ================= */

export const getProfile = async () => {
  try {
    const res = await api.get("/users/profile");

    return res.data;
  } catch (error) {
    throw error.message || "Failed to fetch profile";
  }
};

/* ================= UPDATE PROFILE ================= */

export const updateProfile = async (data) => {
  try {
    const res = await api.put("/users/update", data);

    const user = res.data?.user;

    if (user) {
      localStorage.setItem("user", JSON.stringify(user));
    }

    return res.data;
  } catch (error) {
    throw error.message || "Profile update failed";
  }
};
