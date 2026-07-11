import User from "../models/User.js";
import Paper from "../models/Paper.js";
import { calculateUserRank } from "./rankService.js";
import { logActivity } from "./activityService.js";

export const generateBadgesAndRank = async (userId) => {
  const user = await User.findById(userId);
  if (!user) return;

  const oldRank = user.rank;
  const oldBadges = user.badges || [];

  const todayStr = new Date().toISOString().split("T")[0];
  if (!user.lastActiveDate) {
    user.dailyStreak = 1;
    user.lastActiveDate = todayStr;
  } else if (user.lastActiveDate !== todayStr) {
    const today = new Date(todayStr);
    const lastActive = new Date(user.lastActiveDate);
    const diffTime = today.getTime() - lastActive.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      user.dailyStreak = (user.dailyStreak || 0) + 1;
    } else {
      user.dailyStreak = 1;
    }
    user.lastActiveDate = todayStr;
  }

  const totalUploads = await Paper.countDocuments({ uploadedBy: user._id });
  const approvedUploads = await Paper.countDocuments({ uploadedBy: user._id, status: "approved" });
  const ratingsGiven = await Paper.countDocuments({ "ratings.user": user._id });
  const commentsGiven = await Paper.countDocuments({ "comments.user": user._id });
  const downloadedCount = user.downloadedPapers ? user.downloadedPapers.length : 0;

  const badges = [];
  if (totalUploads >= 1) badges.push("🥇 First Upload");
  if (totalUploads >= 5) badges.push("📚 Contributor");
  if (approvedUploads >= 10) badges.push("🔥 Top Uploader");
  if (user.coins >= 100) badges.push("🪙 100 Coins Club");
  if (user.coins >= 250) badges.push("⭐ Rising Scholar");
  if (ratingsGiven >= 10) badges.push("📝 Active Reviewer");
  if (commentsGiven >= 10) badges.push("🗣️ Helpful Peer");
  if (downloadedCount >= 20) badges.push("📥 Voracious Reader");
  if (user.dailyStreak >= 3) badges.push("⚡ 3-Day Streak");
  if (user.dailyStreak >= 7) badges.push("🔥 7-Day Streak");

  const newRank = calculateUserRank(user.coins, approvedUploads);

  user.totalUploads = totalUploads;
  user.approvedUploads = approvedUploads;
  user.badges = badges;
  user.rank = newRank;
  await user.save();

  // Log activity
  if (oldRank && oldRank !== newRank && oldRank !== "Beginner") {
    await logActivity(user._id, "rank_up", `${user.name} reached ${newRank} Rank!`, user._id, "User");
  }

  const newBadges = badges.filter(b => !oldBadges.includes(b));
  for (const b of newBadges) {
    await logActivity(user._id, "badge_earned", `${user.name} earned the ${b} badge!`, user._id, "User");
  }
};
