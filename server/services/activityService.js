import Activity from "../models/Activity.js";

export const logActivity = async (userId, actionType, description, targetId = null, targetModel = null) => {
  try {
    await Activity.create({
      user: userId,
      actionType,
      description,
      targetId,
      targetModel
    });
  } catch (err) {
    console.error("Failed to log activity:", err);
  }
};
