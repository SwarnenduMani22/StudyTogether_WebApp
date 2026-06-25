import mongoose from "mongoose";

const activitySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  actionType: {
    type: String,
    enum: ["upload", "rank_up", "badge_earned", "milestone"],
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  targetId: {
    type: mongoose.Schema.Types.ObjectId,
  },
  targetModel: {
    type: String,
    enum: ["Paper", "User"],
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 2592000 // Automatically delete after 30 days
  }
});

// Index for efficient querying by date and user
activitySchema.index({ createdAt: -1 });
activitySchema.index({ user: 1, createdAt: -1 });

export default mongoose.model("Activity", activitySchema);
