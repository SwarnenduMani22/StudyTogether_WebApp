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
    reason: (packageName || "Coin Purchase") + (transactionId ? ` (Tx: ${transactionId})` : ""),
  });

  user.coins += amount; // Sync memory object
};

export const grantCoins = async (
  user,
  amount,
  reason,
  adminId = null,
  idempotencyKey = null,
) => {
  const userId = user._id || user;
  const trimmedKey = idempotencyKey ? idempotencyKey.trim() : null;

  // Helper to verify parameter match
  const verifyMatch = (existingTx) => {
    return (
      existingTx.user.toString() === userId.toString() &&
      existingTx.amount === amount &&
      existingTx.reason === reason
    );
  };

  // Helper to handle existing transaction
  const handleExistingTx = async (existingTx) => {
    if (!verifyMatch(existingTx)) {
      const error = new Error(
        "Idempotency key conflict: This key was already used with different parameters"
      );
      error.code = "IDEMPOTENCY_CONFLICT";
      error.statusCode = 409;
      throw error;
    }

    const currentUser = await User.findById(userId);
    if (!currentUser) {
      const error = new Error("User not found");
      error.statusCode = 404;
      throw error;
    }

    // Check if the balance was already applied to the user document
    const isAlreadyApplied =
      Array.isArray(currentUser.appliedGrants) &&
      currentUser.appliedGrants.some((g) => g.idempotencyKey === trimmedKey);

    // Case 1: Transaction completed AND balance applied -> Safe replay
    if (existingTx.status === "completed" && (isAlreadyApplied || existingTx.balanceApplied)) {
      if (user && typeof user.coins === "number") {
        user.coins = currentUser.coins;
      }
      return {
        updatedUser: currentUser,
        transaction: existingTx,
        duplicate: true,
      };
    }

    // Case 2: Balance was already applied, but transaction was interrupted before being marked completed
    if (isAlreadyApplied) {
      existingTx.status = "completed";
      existingTx.balanceApplied = true;
      await existingTx.save();

      if (user && typeof user.coins === "number") {
        user.coins = currentUser.coins;
      }
      return {
        updatedUser: currentUser,
        transaction: existingTx,
        duplicate: true,
        recovered: true,
      };
    }

    // Case 3: Concurrent in-flight request
    // If transaction is still "pending" and balance hasn't been applied, another request is in progress
    if (existingTx.status === "pending") {
      const error = new Error(
        "A grant request with this idempotency key is currently in progress. Please retry shortly."
      );
      error.code = "IDEMPOTENCY_IN_PROGRESS";
      error.statusCode = 409;
      throw error;
    }

    // Case 4: Failed / interrupted attempt where balance was NOT applied -> Safe retry recovery
    if (existingTx.status === "failed") {
      const updatedUser = await User.findOneAndUpdate(
        {
          _id: userId,
          "appliedGrants.idempotencyKey": { $ne: trimmedKey },
        },
        {
          $inc: { coins: amount },
          $push: {
            appliedGrants: {
              $each: [{ idempotencyKey: trimmedKey, amount, appliedAt: new Date() }],
              $slice: -100,
            },
          },
        },
        { returnDocument: "after", new: true }
      );

      const finalUser = updatedUser || (await User.findById(userId));

      existingTx.status = "completed";
      existingTx.balanceApplied = true;
      await existingTx.save();

      if (user && typeof user.coins === "number") {
        user.coins = finalUser.coins;
      }

      return {
        updatedUser: finalUser,
        transaction: existingTx,
        duplicate: false,
        recovered: true,
      };
    }

    // Fallback: mark completed
    existingTx.status = "completed";
    existingTx.balanceApplied = true;
    await existingTx.save();

    return {
      updatedUser: currentUser,
      transaction: existingTx,
      duplicate: true,
    };
  };

  // 1. Check for existing transaction if idempotencyKey provided
  if (trimmedKey) {
    const existingTx = await Transaction.findOne({ idempotencyKey: trimmedKey });
    if (existingTx) {
      return await handleExistingTx(existingTx);
    }
  }

  // 2. Insert transaction record first with status "pending" (protected by unique index on idempotencyKey)
  const txData = {
    user: userId,
    amount,
    type: "grant",
    reason,
    status: "pending",
    balanceApplied: false,
  };

  if (adminId) txData.performedBy = adminId;
  if (trimmedKey) txData.idempotencyKey = trimmedKey;

  let transaction;
  try {
    transaction = await Transaction.create(txData);
  } catch (err) {
    if (err.code === 11000 && trimmedKey) {
      // Caught race condition on unique idempotencyKey index
      const existingTx = await Transaction.findOne({ idempotencyKey: trimmedKey });
      if (existingTx) {
        return await handleExistingTx(existingTx);
      }
    }
    throw err;
  }

  // 3. Atomically increment the user's coin balance AND record the idempotencyKey
  let updatedUser;
  try {
    const updateQuery = {
      $inc: { coins: amount },
    };

    const filter = { _id: userId };

    if (trimmedKey) {
      filter["appliedGrants.idempotencyKey"] = { $ne: trimmedKey };
      updateQuery.$push = {
        appliedGrants: {
          $each: [{ idempotencyKey: trimmedKey, amount, appliedAt: new Date() }],
          $slice: -100,
        },
      };
    }

    updatedUser = await User.findOneAndUpdate(
      filter,
      updateQuery,
      { returnDocument: "after", new: true }
    );

    if (!updatedUser) {
      const existingUser = await User.findById(userId);
      if (
        trimmedKey &&
        existingUser?.appliedGrants?.some((g) => g.idempotencyKey === trimmedKey)
      ) {
        updatedUser = existingUser;
      } else {
        throw new Error("Failed to update user coin balance");
      }
    }
  } catch (err) {
    // If balance update failed, mark transaction as failed
    await Transaction.findByIdAndUpdate(transaction._id, {
      status: "failed",
      balanceApplied: false,
    });
    throw err;
  }

  // 4. Mark transaction completed and balanceApplied = true
  await Transaction.findByIdAndUpdate(transaction._id, {
    status: "completed",
    balanceApplied: true,
  });
  transaction.status = "completed";
  transaction.balanceApplied = true;

  if (user && typeof user.coins === "number") {
    user.coins = updatedUser.coins;
  }

  return { updatedUser, transaction, duplicate: false };
};
