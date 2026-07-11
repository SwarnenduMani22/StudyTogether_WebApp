import api from "./axios";

export const getCoinOverview = async (page = 1, type = "all", limit = 10) => {
  const response = await api.get(`/users/coin-overview?page=${page}&type=${type}&limit=${limit}`);
  return response.data;
};

export const getCoinPackages = async () => {
  const response = await api.get("/coins/packages");
  return response.data;
};

export const purchaseCoins = async (packageId) => {
  const response = await api.post("/coins/purchase", {
    packageId,
  });

  return response.data;
};
