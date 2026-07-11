import mongoose from "mongoose";

const AIFeedbackSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    conversationId: { type: mongoose.Schema.Types.ObjectId, ref: "AIChatSession", required: false },
    score: { type: Number, required: true }, // 1 (thumbs up) or -1 (thumbs down)
    comment: { type: String },
  },
  { timestamps: true }
);

export default mongoose.model("AIFeedback", AIFeedbackSchema);
