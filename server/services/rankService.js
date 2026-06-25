export const calculateUserRank = (coins, approvedUploads = 0) => {
  if (coins >= 500 && approvedUploads >= 20) return "Legend";
  if (coins >= 250 && approvedUploads >= 10) return "Expert";
  if (coins >= 100 && approvedUploads >= 5) return "Scholar";
  if (coins >= 50 && approvedUploads >= 1) return "Explorer";
  return "Beginner";
};
