import mongoose from "mongoose";

const platformKnowledgeSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
    },
    keywords: {
      type: [String],
      default: [],
    },
    content: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "draft",
    },
    version: {
      type: Number,
      default: 1,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const PlatformKnowledge = mongoose.model("PlatformKnowledge", platformKnowledgeSchema);

export default PlatformKnowledge;
