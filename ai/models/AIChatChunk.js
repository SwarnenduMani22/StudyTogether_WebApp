import mongoose from "mongoose";

const AIChatChunkSchema = new mongoose.Schema(
  {
    paperId: { type: mongoose.Schema.Types.ObjectId, ref: "Paper", required: true },
    chunkId: { type: String, required: true, unique: true },
    pageNumber: { type: Number, required: true },
    subject: { type: String, required: true },
    semester: { type: Number, required: true },
    university: { type: String, default: "Default University" },
    chunkText: { type: String, required: true },
    position: { type: Number, required: true }, // Index of the chunk
    metadata: { type: Map, of: String },
    embedding: { type: [Number], required: false },
    embeddingVersion: { type: String, default: "v1" }
  },
  { timestamps: true }
);

AIChatChunkSchema.index({ paperId: 1 });
AIChatChunkSchema.index({ chunkId: 1 });

export default mongoose.model("AIChatChunk", AIChatChunkSchema);
