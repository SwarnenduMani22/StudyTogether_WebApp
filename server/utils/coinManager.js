import User from "../models/User.js";
import Transaction from "../models/Transaction.js";

export const addCoins = async (
  user,
  amount,
  reason,
  paperId = null,
  paperTitle = null,
) => {
  await User.findOneAndUpdate(
    { _id: user._id },
    { $inc: { coins: amount } }
  );
  
  await Transaction.create({
    user: user._id,
    amount,
    type: "earned",
    reason,
    paperId,
    paperTitle,
  });

  user.coins += amount; // Sync memory object
};

export const spendCoins = async (
  user,
  amount,
  reason,
  paperId = null,
  paperTitle = null,
) => {
  const result = await User.findOneAndUpdate(
    { _id: user._id, coins: { $gte: amount } },
    { $inc: { coins: -amount } },
    { new: true }
  );

  if (!result) {
    throw new Error("Insufficient coins");
  }

  await Transaction.create({
    user: user._id,
    amount,
    type: "spent",
    reason,
    paperId,
    paperTitle,
  });

  user.coins -= amount; // Sync memory object
};

export const purchaseCoins = async (
  user,
  amount,
  packageName,
  transactionId,
) => {
  await User.findOneAndUpdate(
    { _id: user._id },
    { $inc: { coins: amount } }
  );

  await Transaction.create({
    user: user._id,
    amount,
    type: "purchased",
    reason: packageName || "Coin Purchase",
  });

  user.coins += amount; // Sync memory object
};
