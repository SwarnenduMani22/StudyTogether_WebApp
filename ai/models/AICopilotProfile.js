import mongoose from "mongoose";

const AICopilotProfileSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    studiedPapers: [{ type: mongoose.Schema.Types.ObjectId, ref: "Paper" }],
    completedTopics: [{ type: String }],
    quizHistory: [
      {
        paperId: { type: mongoose.Schema.Types.ObjectId, ref: "Paper" },
        score: Number,
        totalQuestions: Number,
        createdAt: { type: Date, default: Date.now },
      },
    ],
    studyStreak: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.model("AICopilotProfile", AICopilotProfileSchema);
