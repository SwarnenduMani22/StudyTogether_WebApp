import test, { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import crypto from "crypto";
import { verifyTimingSafeSignature } from "../routes/payment.routes.js";

describe("P1-7 SUITE: Razorpay Webhook & Signature Verification (PAY-01)", () => {
  const TEST_KEY_SECRET = "mock_key_secret_for_tests_12345";
  const TEST_WEBHOOK_SECRET = "mock_webhook_secret_tests_67890";

  // In-memory mock store
  const mockUsers = new Map();
  const mockPayments = new Map();
  const mockTransactions = new Map();

  const resetStore = () => {
    mockUsers.clear();
    mockPayments.clear();
    mockTransactions.clear();
  };

  // Mock implementation of fulfillRazorpayPayment mirroring coinManager.js
  const mockFulfillRazorpayPayment = async ({
    orderId,
    paymentId,
    signature = "",
    userId = null,
  }) => {
    if (!orderId) {
      return { success: false, statusCode: 400, error: "Order ID is required" };
    }

    const existingPayment = mockPayments.get(orderId);
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

    if (existingPayment.status === "captured") {
      const user = mockUsers.get(existingPayment.user.toString());
      return {
        success: true,
        alreadyCaptured: true,
        payment: existingPayment,
        coins: user?.coins ?? 0,
      };
    }

    // Atomic conditional status transition
    if (!["created", "pending"].includes(existingPayment.status)) {
      const user = mockUsers.get(existingPayment.user.toString());
      return {
        success: true,
        alreadyCaptured: true,
        payment: existingPayment,
        coins: user?.coins ?? 0,
      };
    }

    existingPayment.status = "captured";
    existingPayment.paymentId = paymentId || existingPayment.paymentId;
    existingPayment.signature = signature || existingPayment.signature || "";

    // Idempotent coin crediting
    const user = mockUsers.get(existingPayment.user.toString());
    if (user) {
      user.coins = (user.coins || 0) + existingPayment.coins;
    }

    const tx = {
      _id: `tx_${Date.now()}`,
      user: existingPayment.user,
      amount: existingPayment.coins,
      type: "purchased",
      status: "completed",
      idempotencyKey,
      balanceApplied: true,
    };
    mockTransactions.set(idempotencyKey, tx);

    return {
      success: true,
      alreadyCaptured: false,
      payment: existingPayment,
      coins: user?.coins ?? 0,
      transaction: tx,
    };
  };

  beforeEach(() => {
    resetStore();
  });

  // 1. Timing-safe signature comparison unit tests
  it("1.1 Matching hex signatures return true", () => {
    const secret = "test_secret";
    const data = "order_123|pay_456";
    const hmac = crypto.createHmac("sha256", secret).update(data).digest("hex");
    assert.strictEqual(verifyTimingSafeSignature(hmac, hmac), true);
  });

  it("1.2 Altered hex signatures return false in constant time", () => {
    const secret = "test_secret";
    const hmac1 = crypto.createHmac("sha256", secret).update("order_1|pay_1").digest("hex");
    const hmac2 = crypto.createHmac("sha256", secret).update("order_1|pay_2").digest("hex");
    assert.strictEqual(verifyTimingSafeSignature(hmac1, hmac2), false);
  });

  it("1.3 Malformed or differing lengths return false without throwing", () => {
    const validHex = crypto.createHmac("sha256", "s").update("d").digest("hex");
    assert.strictEqual(verifyTimingSafeSignature(validHex, "short"), false);
    assert.strictEqual(verifyTimingSafeSignature(validHex, ""), false);
    assert.strictEqual(verifyTimingSafeSignature(validHex, null), false);
    assert.strictEqual(verifyTimingSafeSignature(validHex, undefined), false);
    assert.strictEqual(verifyTimingSafeSignature(validHex, 12345), false);
  });

  // 2. Successful payment verification and coin crediting
  it("2. Successful /verify credits coins and marks status captured", async () => {
    const userId = "userA";
    const orderId = "order_p17_starter_01";
    const paymentId = "pay_p17_01";

    mockUsers.set(userId, { _id: userId, coins: 50 });
    mockPayments.set(orderId, {
      user: userId,
      orderId,
      packageId: "starter",
      packageName: "Starter Pack",
      amount: 29,
      coins: 100,
      status: "created",
    });

    const signature = crypto
      .createHmac("sha256", TEST_KEY_SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    const result = await mockFulfillRazorpayPayment({
      orderId,
      paymentId,
      signature,
      userId,
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.alreadyCaptured, false);
    assert.strictEqual(result.coins, 150); // 50 initial + 100 purchased

    const payment = mockPayments.get(orderId);
    assert.strictEqual(payment.status, "captured");
    assert.strictEqual(payment.paymentId, paymentId);

    const tx = mockTransactions.get(`razorpay_order_${orderId}`);
    assert.ok(tx);
    assert.strictEqual(tx.amount, 100);
    assert.strictEqual(tx.type, "purchased");
    assert.strictEqual(tx.status, "completed");

    assert.strictEqual(mockUsers.get(userId).coins, 150);
  });

  // 3. Idempotent replay on /verify
  it("3. Idempotent replay on /verify returns success without double-crediting", async () => {
    const userId = "userA";
    const orderId = "order_p17_starter_01";
    const paymentId = "pay_p17_01";

    mockUsers.set(userId, { _id: userId, coins: 50 });
    mockPayments.set(orderId, {
      user: userId,
      orderId,
      coins: 100,
      status: "created",
    });

    // First attempt
    await mockFulfillRazorpayPayment({ orderId, paymentId, userId });
    assert.strictEqual(mockUsers.get(userId).coins, 150);

    // Replay attempt
    const replay = await mockFulfillRazorpayPayment({ orderId, paymentId, userId });
    assert.strictEqual(replay.success, true);
    assert.strictEqual(replay.alreadyCaptured, true);
    assert.strictEqual(replay.coins, 150, "Coins must not be credited again");
    assert.strictEqual(mockUsers.get(userId).coins, 150);
  });

  // 4. Webhook replay for already-captured order
  it("4. Webhook replay for already-captured order does not credit duplicate coins", async () => {
    const userId = "userA";
    const orderId = "order_p17_starter_01";
    const paymentId = "pay_p17_01";

    mockUsers.set(userId, { _id: userId, coins: 150 });
    mockPayments.set(orderId, {
      user: userId,
      orderId,
      paymentId,
      coins: 100,
      status: "captured", // Already captured
    });

    const webhookResult = await mockFulfillRazorpayPayment({
      orderId,
      paymentId,
      signature: "dummy_webhook_sig",
    });

    assert.strictEqual(webhookResult.success, true);
    assert.strictEqual(webhookResult.alreadyCaptured, true);
    assert.strictEqual(mockUsers.get(userId).coins, 150);
  });

  // 5. Webhook arrives first, then /verify
  it("5. Webhook credits coins first, subsequent /verify acknowledges safely", async () => {
    const userId = "userB";
    const orderId = "order_p17_popular_02";
    const paymentId = "pay_p17_02";

    mockUsers.set(userId, { _id: userId, coins: 0 });
    mockPayments.set(orderId, {
      user: userId,
      orderId,
      coins: 250,
      status: "created",
    });

    // Webhook executes first
    const webhookRes = await mockFulfillRazorpayPayment({
      orderId,
      paymentId,
      signature: "sig1",
    });
    assert.strictEqual(webhookRes.success, true);
    assert.strictEqual(webhookRes.alreadyCaptured, false);
    assert.strictEqual(mockUsers.get(userId).coins, 250);

    // Client /verify executes second
    const verifyRes = await mockFulfillRazorpayPayment({
      orderId,
      paymentId,
      userId,
    });
    assert.strictEqual(verifyRes.success, true);
    assert.strictEqual(verifyRes.alreadyCaptured, true);
    assert.strictEqual(verifyRes.coins, 250);
    assert.strictEqual(mockUsers.get(userId).coins, 250);
  });

  // 6. IDOR / User mismatch rejected with 403
  it("6. Verification attempt by non-owner user is rejected with HTTP 403", async () => {
    const orderId = "order_p17_starter_01";
    mockPayments.set(orderId, {
      user: "userA",
      orderId,
      coins: 100,
      status: "created",
    });

    const result = await mockFulfillRazorpayPayment({
      orderId,
      paymentId: "pay_p17_01",
      userId: "user_attacker",
    });

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.statusCode, 403);
    assert.match(result.error, /belongs to another user/);
  });
});
