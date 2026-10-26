import User from "../models/User.js";
import Transaction from "../models/Transaction.js";
import Payment from "../models/Payment.js";

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
    { returnDocument: "after" }
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
  idempotencyKey = null,
) => {
  const userId = user._id || user;
  const key =
    idempotencyKey || (transactionId ? `purchase_tx_${transactionId}` : null);

  if (key) {
    const existingTx = await Transaction.findOne({ idempotencyKey: key });
    if (
      existingTx &&
      existingTx.status === "completed" &&
      existingTx.balanceApplied
    ) {
      const currentUser = await User.findById(userId).select("coins");
      if (user && typeof user.coins === "number" && currentUser) {
        user.coins = currentUser.coins;
      }
      return {
        duplicate: true,
        transaction: existingTx,
        coins: currentUser?.coins,
      };
    }
  }

  let transaction;
  if (key) {
    try {
      transaction = await Transaction.create({
        user: userId,
        amount,
        type: "purchased",
        reason:
          (packageName || "Coin Purchase") +
          (transactionId ? ` (Tx: ${transactionId})` : ""),
        idempotencyKey: key,
        status: "pending",
        balanceApplied: false,
      });
    } catch (err) {
      if (err.code === 11000) {
        const concurrentTx = await Transaction.findOne({ idempotencyKey: key });
        if (concurrentTx && concurrentTx.balanceApplied) {
          const currentUser = await User.findById(userId).select("coins");
          if (user && typeof user.coins === "number" && currentUser) {
            user.coins = currentUser.coins;
          }
          return {
            duplicate: true,
            transaction: concurrentTx,
            coins: currentUser?.coins,
          };
        }
        transaction = concurrentTx;
      } else {
        throw err;
      }
    }
  }

  const updatedUser = await User.findOneAndUpdate(
    { _id: userId },
    { $inc: { coins: amount } },
    { returnDocument: "after" }
  );

  if (transaction) {
    transaction.status = "completed";
    transaction.balanceApplied = true;
    await transaction.save();
  } else if (!key) {
    transaction = await Transaction.create({
      user: userId,
      amount,
      type: "purchased",
      reason:
        (packageName || "Coin Purchase") +
        (transactionId ? ` (Tx: ${transactionId})` : ""),
      status: "completed",
      balanceApplied: true,
    });
  }

  if (user && typeof user.coins === "number" && updatedUser) {
    user.coins = updatedUser.coins;
  }

  return { duplicate: false, transaction, coins: updatedUser?.coins };
};

export const fulfillRazorpayPayment = async ({
  orderId,
  paymentId,
  signature = "",
  userId = null,
}) => {
  if (!orderId) {
    return { success: false, statusCode: 400, error: "Order ID is required" };
  }

  const existingPayment = await Payment.findOne({ orderId });
  if (!existingPayment) {
    return {
      success: false,
      statusCode: 404,
      error: "Payment record not found",
    };
  }

  if (userId && existingPayment.user.toString() !== userId.toString()) {
    return {
      success: false,
      statusCode: 403,
      error: "Unauthorized: payment order belongs to another user",
    };
  }

  const idempotencyKey = `razorpay_order_${orderId}`;

  // If already captured, return safe replay without re-crediting
  if (existingPayment.status === "captured") {
    const user = await User.findById(existingPayment.user).select("coins");
    return {
      success: true,
      alreadyCaptured: true,
      payment: existingPayment,
      coins: user?.coins ?? 0,
    };
  }

  // Atomic conditional status transition: only one caller can transition from created/pending to captured
  const updatedPayment = await Payment.findOneAndUpdate(
    {
      orderId,
      status: { $in: ["created", "pending"] },
    },
    {
      $set: {
        status: "captured",
        paymentId: paymentId || existingPayment.paymentId,
        signature: signature || existingPayment.signature || "",
      },
    },
    { returnDocument: "after" }
  );

  if (!updatedPayment) {
    const recheckPayment = await Payment.findOne({ orderId });
    const user = await User.findById(
      recheckPayment?.user || existingPayment.user
    ).select("coins");
    return {
      success: true,
      alreadyCaptured: true,
      payment: recheckPayment,
      coins: user?.coins ?? 0,
    };
  }

  // Idempotently apply coin credit using the established idempotencyKey
  const creditResult = await purchaseCoins(
    updatedPayment.user,
    updatedPayment.coins,
    updatedPayment.packageName,
    paymentId || orderId,
    idempotencyKey
  );

  return {
    success: true,
    alreadyCaptured: false,
    payment: updatedPayment,
    coins: creditResult.coins,
    transaction: creditResult.transaction,
  };
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

/* ==========================================
PURCHASE PAPER ENTITLEMENT (ATOMIC & IDEMPOTENT)
========================================== */

export const purchasePaperEntitlement = async ({
  userId,
  paperId,
  entitlementType, // "preview" | "download"
  paperTitle = "",
}) => {
  const trimmedUserId = userId.toString();
  const trimmedPaperId = paperId.toString();
  const idempotencyKey = `${entitlementType}_${trimmedUserId}_${trimmedPaperId}`;
  const entitlementField =
    entitlementType === "preview" ? "previewedPapers" : "downloadedPapers";

  const executePurchase = async (tx) => {
    let updatedUser = null;
    let deductedAmount = 0;

    if (entitlementType === "preview") {
      deductedAmount = 10;
      updatedUser = await User.findOneAndUpdate(
        {
          _id: userId,
          coins: { $gte: 10 },
          previewedPapers: { $ne: paperId },
          downloadedPapers: { $ne: paperId },
        },
        {
          $inc: { coins: -10 },
          $addToSet: { previewedPapers: paperId },
        },
        { returnDocument: "after" }
      );
    } else {
      // Download Attempt 1 (Discounted Previewed: 30 coins)
      deductedAmount = 30;
      updatedUser = await User.findOneAndUpdate(
        {
          _id: userId,
          coins: { $gte: 30 },
          previewedPapers: paperId,
          downloadedPapers: { $ne: paperId },
        },
        {
          $inc: { coins: -30 },
          $addToSet: { downloadedPapers: paperId },
        },
        { returnDocument: "after" }
      );

      // Download Attempt 2 (Direct Download: 40 coins)
      if (!updatedUser) {
        deductedAmount = 40;
        updatedUser = await User.findOneAndUpdate(
          {
            _id: userId,
            coins: { $gte: 40 },
            previewedPapers: { $ne: paperId },
            downloadedPapers: { $ne: paperId },
          },
          {
            $inc: { coins: -40 },
            $addToSet: { downloadedPapers: paperId, previewedPapers: paperId },
          },
          { returnDocument: "after" }
        );
      }
    }

    if (updatedUser) {
      tx.amount = deductedAmount;
      tx.status = "completed";
      tx.balanceApplied = true;
      await tx.save();

      return {
        alreadyUnlocked: false,
        coins: updatedUser.coins,
        transaction: tx,
      };
    }

    // Atomic update matched 0 documents — identify reason
    const freshUser = await User.findById(userId)
      .select("coins previewedPapers downloadedPapers")
      .lean();

    if (!freshUser) {
      tx.status = "failed";
      await tx.save();
      const error = new Error("User not found");
      error.status = 404;
      throw error;
    }

    const isNowEntitled =
      freshUser[entitlementField]?.some(
        (id) => id.toString() === trimmedPaperId
      ) ||
      (entitlementType === "preview" &&
        freshUser.downloadedPapers?.some(
          (id) => id.toString() === trimmedPaperId
        ));

    if (isNowEntitled) {
      tx.status = "failed";
      tx.reason = (tx.reason || "") + " (Superseded by concurrent purchase)";
      await tx.save();
      return {
        alreadyUnlocked: true,
        coins: freshUser.coins,
        transaction: tx,
      };
    }

    tx.status = "failed";
    tx.reason = "Insufficient coins";
    await tx.save();

    const coinErr = new Error("INSUFFICIENT_COINS");
    coinErr.status = 400;
    throw coinErr;
  };

  const handleExistingTx = async (existingTx) => {
    const currentUser = await User.findById(userId)
      .select("coins previewedPapers downloadedPapers")
      .lean();

    if (!currentUser) {
      const error = new Error("User not found");
      error.status = 404;
      throw error;
    }

    const isAlreadyEntitled =
      currentUser[entitlementField]?.some(
        (id) => id.toString() === trimmedPaperId
      ) ||
      (entitlementType === "preview" &&
        currentUser.downloadedPapers?.some(
          (id) => id.toString() === trimmedPaperId
        ));

    // Case 1: Transaction completed AND balance applied / entitled -> Safe replay
    if (
      existingTx.status === "completed" &&
      (existingTx.balanceApplied || isAlreadyEntitled)
    ) {
      return {
        alreadyUnlocked: true,
        coins: currentUser.coins,
        transaction: existingTx,
      };
    }

    // Case 2: Process crashed after User update, before transaction was marked completed
    if (isAlreadyEntitled && existingTx.status === "pending") {
      existingTx.status = "completed";
      existingTx.balanceApplied = true;
      await existingTx.save();
      return {
        alreadyUnlocked: true,
        coins: currentUser.coins,
        transaction: existingTx,
        recovered: true,
      };
    }

    // Case 3: Concurrent in-flight request
    if (existingTx.status === "pending") {
      // Bounded poll (up to 300ms) for in-flight winner
      for (let i = 0; i < 3; i++) {
        await new Promise((r) => setTimeout(r, 100));
        const pollTx = await Transaction.findById(existingTx._id).lean();
        if (pollTx?.status === "completed") {
          const fresh = await User.findById(userId).select("coins").lean();
          return {
            alreadyUnlocked: true,
            coins: fresh?.coins ?? currentUser.coins,
            transaction: pollTx,
          };
        }
      }
      const inProgressError = new Error(
        "Purchase is currently in progress. Please retry shortly."
      );
      inProgressError.code = "IDEMPOTENCY_IN_PROGRESS";
      inProgressError.status = 409;
      throw inProgressError;
    }

    // Case 4: Previous attempt failed (e.g. was insufficient coins before user funded account)
    if (existingTx.status === "failed") {
      if (isAlreadyEntitled) {
        return {
          alreadyUnlocked: true,
          coins: currentUser.coins,
          transaction: existingTx,
        };
      }
      existingTx.status = "pending";
      existingTx.balanceApplied = false;
      await existingTx.save();
      return executePurchase(existingTx);
    }

    return {
      alreadyUnlocked: isAlreadyEntitled,
      coins: currentUser.coins,
      transaction: existingTx,
    };
  };

  // 1. Check for existing transaction with deterministic key
  const existingTx = await Transaction.findOne({ idempotencyKey });
  if (existingTx) {
    return await handleExistingTx(existingTx);
  }

  // 2. Insert Transaction record with status "pending" (protected by unique index on idempotencyKey)
  let transaction;
  try {
    transaction = await Transaction.create({
      user: userId,
      amount: 0,
      type: "spent",
      reason: entitlementType === "preview" ? "Preview Paper" : "Download Paper",
      paperId,
      paperTitle,
      idempotencyKey,
      status: "pending",
      balanceApplied: false,
    });
  } catch (err) {
    if (err.code === 11000) {
      const concurrentTx = await Transaction.findOne({ idempotencyKey });
      if (concurrentTx) {
        return await handleExistingTx(concurrentTx);
      }
    }
    throw err;
  }

  // 3. Execute atomic conditional purchase
  return await executePurchase(transaction);
};
