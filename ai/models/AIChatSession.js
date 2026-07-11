import mongoose from "mongoose";

const AIChatSessionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    domain: { type: String, enum: ["platform", "study"], required: true },
    paper: { type: mongoose.Schema.Types.ObjectId, ref: "Paper", required: false },
    title: { type: String, default: "New Conversation" },
    messages: [
      {
        sender: { type: String, enum: ["user", "assistant"], required: true },
        content: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
        citations: [
          {
            chunkId: String,
            pageNumber: Number,
            textSnippet: String,
          },
        ],
      },
    ],
  },
  { timestamps: true }
);

// TTL index to automatically remove old chat sessions after configured seconds (default 30 days)
const SESSION_TTL_SECONDS = parseInt(process.env.SESSION_TTL_SECONDS || "2592000", 10);
AIChatSessionSchema.index({ updatedAt: 1 }, { expireAfterSeconds: SESSION_TTL_SECONDS });

export default mongoose.model("AIChatSession", AIChatSessionSchema);
