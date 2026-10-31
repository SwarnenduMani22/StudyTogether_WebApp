import test from "node:test";
import assert from "node:assert";
import { calculateUserRank } from "../services/rankService.js";
import { COIN_PACKAGES } from "../config/coinpackages.js";

test("calculateUserRank returns correct rank tiers based on coins and approved uploads", () => {
  // Beginner tier
  assert.strictEqual(calculateUserRank(0, 0), "Beginner");
  assert.strictEqual(calculateUserRank(49, 0), "Beginner");
  assert.strictEqual(calculateUserRank(50, 0), "Beginner"); // needs >= 1 upload

  // Explorer tier: coins >= 50 && approvedUploads >= 1
  assert.strictEqual(calculateUserRank(50, 1), "Explorer");
  assert.strictEqual(calculateUserRank(99, 4), "Explorer");

  // Scholar tier: coins >= 100 && approvedUploads >= 5
  assert.strictEqual(calculateUserRank(100, 5), "Scholar");
  assert.strictEqual(calculateUserRank(249, 9), "Scholar");

  // Expert tier: coins >= 250 && approvedUploads >= 10
  assert.strictEqual(calculateUserRank(250, 10), "Expert");
  assert.strictEqual(calculateUserRank(499, 19), "Expert");

  // Legend tier: coins >= 500 && approvedUploads >= 20
  assert.strictEqual(calculateUserRank(500, 20), "Legend");
  assert.strictEqual(calculateUserRank(1000, 50), "Legend");
});

test("COIN_PACKAGES contains valid package configurations and prices", () => {
  assert.ok(COIN_PACKAGES.starter, "starter package exists");
  assert.strictEqual(COIN_PACKAGES.starter.coins, 100);
  assert.strictEqual(COIN_PACKAGES.starter.price, 29);

  assert.ok(COIN_PACKAGES.popular, "popular package exists");
  assert.strictEqual(COIN_PACKAGES.popular.coins, 250);
  assert.strictEqual(COIN_PACKAGES.popular.price, 59);

  assert.ok(COIN_PACKAGES.premium, "premium package exists");
  assert.strictEqual(COIN_PACKAGES.premium.coins, 500);
  assert.strictEqual(COIN_PACKAGES.premium.price, 99);
});
