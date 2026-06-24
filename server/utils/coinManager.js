export const addCoins = async (
  user,
  amount,
  reason,
  paper = null,
  paperTitle = null,
) => {
  user.coins += amount;

  user.coinHistory.push({
    type: "earned",
    amount,
    reason,
    paper,
    paperTitle,
  });

  await user.save();
};

export const spendCoins = async (
  user,
  amount,
  reason,
  paper = null,
  paperTitle = null,
) => {
  if (user.coins < amount) {
    throw new Error("Insufficient coins");
  }

  user.coins -= amount;

  user.coinHistory.push({
    type: "spent",
    amount,
    reason,
    paper,
    paperTitle,
  });

  await user.save();
};

export const purchaseCoins = async (
  user,
  amount,
  packageName,
  transactionId,
) => {
  user.coins += amount;

  user.coinHistory.push({
    type: "purchase",
    amount,
    reason: "Coin Purchase",
    packageName,
    transactionId,
  });

  await user.save();
};
