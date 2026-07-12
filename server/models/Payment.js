import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    orderId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    paymentId: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },

    signature: {
      type: String,
      default: "",
    },

    packageId: {
      type: String,
      required: true,
    },

    packageName: {
      type: String,
      required: true,
    },

    amount: {
      type: Number,
      required: true,
    },

    coins: {
      type: Number,
      required: true,
    },

    currency: {
      type: String,
      default: "INR",
    },

    provider: {
      type: String,
      default: "razorpay",
    },

    status: {
      type: String,
      enum: [
        "created",
        "pending",
        "captured",
        "failed",
        "cancelled",
        "refunded",
      ],
      default: "created",
    },

    metadata: {
      type: Object,
      default: {},
    },
  },
  {
    timestamps: true,
  },
);

export default mongoose.model("Payment", paymentSchema);
