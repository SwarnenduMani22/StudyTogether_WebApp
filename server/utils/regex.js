export const escapeRegex = (value = "") => {
  if (typeof value !== "string") return "";
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

export default escapeRegex;
