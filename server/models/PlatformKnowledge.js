import mongoose from "mongoose";

const PlatformKnowledgeSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    category: { type: String, required: true },
    keywords: [{ type: String }],
    content: { type: String, required: true },
    status: { type: String, enum: ["draft", "published", "archived"], default: "draft" },
    version: { type: Number, default: 1 },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

PlatformKnowledgeSchema.index({ category: 1 });
PlatformKnowledgeSchema.index({ status: 1 });

export default mongoose.model("PlatformKnowledge", PlatformKnowledgeSchema);
