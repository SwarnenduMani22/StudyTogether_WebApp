import api from "./axios";

export const getCoinOverview = async () => {
  const response = await api.get("/users/coin-overview");
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
