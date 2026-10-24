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
    enum: ["earned", "spent", "purchased", "refund", "bonus", "grant"],
    required: true,
  },
  reason: {
    type: String,
    required: true,
  },
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  idempotencyKey: {
    type: String,
  },
  status: {
    type: String,
    enum: ["completed", "pending", "failed"],
    default: "completed",
  },
  balanceApplied: {
    type: Boolean,
    default: false,
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
transactionSchema.index({ idempotencyKey: 1 }, { unique: true, sparse: true });

export default mongoose.model("Transaction", transactionSchema);
