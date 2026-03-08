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

    const { token, user } = res.data;

    if (token) {
      sessionStorage.setItem("token", token);
      sessionStorage.setItem("user", JSON.stringify(user));
    }

    return res.data;
  } catch (error) {
    throw error.message || "Login failed";
  }
};

/* ================= LOGOUT ================= */

export const logoutUser = () => {
  sessionStorage.removeItem("token");
  sessionStorage.removeItem("user");

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
      sessionStorage.setItem("user", JSON.stringify(user));
    }

    return res.data;
  } catch (error) {
    throw error.message || "Profile update failed";
  }
};
