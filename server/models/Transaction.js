import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  type: {
    type: String,
    enum: ["earned", "spent", "purchased", "refund", "bonus"],
    required: true,
  },
  reason: {
    type: String,
    required: true,
  },
  paperId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Paper",
  },
  paperTitle: {
    type: String,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

transactionSchema.index({ user: 1, createdAt: -1 });

export default mongoose.model("Transaction", transactionSchema);
