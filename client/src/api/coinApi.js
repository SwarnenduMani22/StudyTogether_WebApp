import api from "./axios";

export const getCoinOverview = async (page = 1, type = "all", limit = 10) => {
  const response = await api.get(
    `/users/coin-overview?page=${page}&type=${type}&limit=${limit}`,
  );
  return response.data;
};

export const getCoinPackages = async () => {
  const response = await api.get("/coins/packages");
  return response.data;
};

export const createOrder = async (packageId) => {
  const response = await api.post("/payment/create-order", {
    packageId,
  });

  return response.data;
};
export const verifyPayment = async (data) => {
  const response = await api.post("/payment/verify", data);

  return response.data;
};
export const getPaymentHistory = async () => {
  const response = await api.get("/payment/history");

  return response.data;
};
