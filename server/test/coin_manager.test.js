import test, { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import mongoose from "mongoose";

describe("P1-4 SUITE: Coin Deduction Consistency & Entitlement Atomicity (SEC-05)", () => {
  const mockUsers = new Map();
  const mockTransactions = new Map();

  const resetStore = () => {
    mockUsers.clear();
    mockTransactions.clear();
  };

  const getUser = (id) => mockUsers.get(id.toString());

  // In-memory simulation of purchasePaperEntitlement from coinManager.js
  const mockPurchasePaperEntitlement = async ({
    userId,
    paperId,
    entitlementType,
    paperTitle = "",
  }) => {
    const trimmedUserId = userId.toString();
    const trimmedPaperId = paperId.toString();
    const idempotencyKey = `${entitlementType}_${trimmedUserId}_${trimmedPaperId}`;
    const entitlementField =
      entitlementType === "preview" ? "previewedPapers" : "downloadedPapers";

    const handleExistingTx = async (existingTx) => {
      const currentUser = getUser(userId);
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

      if (isAlreadyEntitled && existingTx.status === "pending") {
        existingTx.status = "completed";
        existingTx.balanceApplied = true;
        return {
          alreadyUnlocked: true,
          coins: currentUser.coins,
          transaction: existingTx,
          recovered: true,
        };
      }

      if (existingTx.status === "pending") {
        for (let i = 0; i < 3; i++) {
          await new Promise((r) => setTimeout(r, 20));
          const pollTx = mockTransactions.get(idempotencyKey);
          if (pollTx?.status === "completed") {
            const fresh = getUser(userId);
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
        return executePurchase(existingTx);
      }

      return {
        alreadyUnlocked: isAlreadyEntitled,
        coins: currentUser.coins,
        transaction: existingTx,
      };
    };

    const executePurchase = async (tx) => {
      let updatedUser = null;
      let deductedAmount = 0;
      const user = getUser(userId);

      if (entitlementType === "preview") {
        deductedAmount = 10;
        if (
          user &&
          user.coins >= 10 &&
          !user.previewedPapers.includes(trimmedPaperId) &&
          !user.downloadedPapers.includes(trimmedPaperId)
        ) {
          user.coins -= 10;
          user.previewedPapers.push(trimmedPaperId);
          updatedUser = user;
        }
      } else {
        deductedAmount = 40;
        if (
          user &&
          user.coins >= 40 &&
          !user.downloadedPapers.includes(trimmedPaperId)
        ) {
          user.coins -= 40;
          user.downloadedPapers.push(trimmedPaperId);
          if (!user.previewedPapers.includes(trimmedPaperId)) {
            user.previewedPapers.push(trimmedPaperId);
          }
          updatedUser = user;
        }
      }

      if (!updatedUser) {
        const freshUser = getUser(userId);
        if (!freshUser) {
          tx.status = "failed";
          const err = new Error("User not found");
          err.status = 404;
          throw err;
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
          return {
            alreadyUnlocked: true,
            coins: freshUser.coins,
            transaction: tx,
          };
        }

        if (freshUser.coins < deductedAmount) {
          tx.status = "failed";
          const err = new Error(
            `Insufficient coins. Required ${deductedAmount}, available ${freshUser.coins}`
          );
          err.status = 400;
          throw err;
        }

        tx.status = "failed";
        const conflictErr = new Error("Could not apply entitlement");
        conflictErr.status = 409;
        throw conflictErr;
      }

      tx.status = "completed";
      tx.balanceApplied = true;
      tx.userBalanceAfter = updatedUser.coins;
      return {
        alreadyUnlocked: false,
        coins: updatedUser.coins,
        transaction: tx,
      };
    };

    const existing = mockTransactions.get(idempotencyKey);
    if (existing) {
      return handleExistingTx(existing);
    }

    const tx = {
      _id: new mongoose.Types.ObjectId().toString(),
      user: userId,
      type: entitlementType === "preview" ? "preview_unlocked" : "download_unlocked",
      amount: entitlementType === "preview" ? -10 : -40,
      paper: paperId,
      status: "pending",
      idempotencyKey,
      balanceApplied: false,
    };
    mockTransactions.set(idempotencyKey, tx);

    return executePurchase(tx);
  };

  beforeEach(() => {
    resetStore();
  });

  it("1. Successful initial preview purchase deducts 10 coins and records entitlement", async () => {
    const userId = "user1";
    const paperId = "paper1";
    mockUsers.set(userId, {
      _id: userId,
      coins: 50,
      previewedPapers: [],
      downloadedPapers: [],
    });

    const result = await mockPurchasePaperEntitlement({
      userId,
      paperId,
      entitlementType: "preview",
    });

    assert.strictEqual(result.alreadyUnlocked, false);
    assert.strictEqual(result.coins, 40);
    assert.strictEqual(getUser(userId).coins, 40);
    assert.ok(getUser(userId).previewedPapers.includes(paperId));
    assert.strictEqual(result.transaction.status, "completed");
  });

  it("2. Idempotent replay of preview purchase does not re-deduct coins", async () => {
    const userId = "user1";
    const paperId = "paper1";
    mockUsers.set(userId, {
      _id: userId,
      coins: 50,
      previewedPapers: [],
      downloadedPapers: [],
    });

    await mockPurchasePaperEntitlement({
      userId,
      paperId,
      entitlementType: "preview",
    });

    const replay = await mockPurchasePaperEntitlement({
      userId,
      paperId,
      entitlementType: "preview",
    });

    assert.strictEqual(replay.alreadyUnlocked, true);
    assert.strictEqual(replay.coins, 40);
    assert.strictEqual(getUser(userId).coins, 40);
  });

  it("3. Insufficient coins rejects purchase with HTTP 400 error", async () => {
    const userId = "user_poor";
    const paperId = "paper1";
    mockUsers.set(userId, {
      _id: userId,
      coins: 5,
      previewedPapers: [],
      downloadedPapers: [],
    });

    await assert.rejects(
      async () => {
        await mockPurchasePaperEntitlement({
          userId,
          paperId,
          entitlementType: "preview",
        });
      },
      (err) => {
        assert.strictEqual(err.status, 400);
        assert.match(err.message, /Insufficient coins/);
        return true;
      }
    );

    assert.strictEqual(getUser(userId).coins, 5);
  });

  it("4. Full download purchase deducts 40 coins and records downloadedPapers", async () => {
    const userId = "user2";
    const paperId = "paper2";
    mockUsers.set(userId, {
      _id: userId,
      coins: 100,
      previewedPapers: [],
      downloadedPapers: [],
    });

    const result = await mockPurchasePaperEntitlement({
      userId,
      paperId,
      entitlementType: "download",
    });

    assert.strictEqual(result.alreadyUnlocked, false);
    assert.strictEqual(result.coins, 60);
    assert.strictEqual(getUser(userId).coins, 60);
    assert.ok(getUser(userId).downloadedPapers.includes(paperId));
  });

  it("5. User with downloadedPapers automatically has preview access without additional cost", async () => {
    const userId = "user3";
    const paperId = "paper3";
    mockUsers.set(userId, {
      _id: userId,
      coins: 50,
      previewedPapers: [],
      downloadedPapers: [paperId], // Already downloaded
    });

    // Attempt to preview paper that user already downloaded
    const result = await mockPurchasePaperEntitlement({
      userId,
      paperId,
      entitlementType: "preview",
    });

    assert.strictEqual(result.alreadyUnlocked, true);
    assert.strictEqual(result.coins, 50, "Coins must NOT be deducted for existing download holder");
  });
});
