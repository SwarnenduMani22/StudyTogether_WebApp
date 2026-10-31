import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { grantUserCoins } from "../../api/admin";

const CoinGrantModal = ({ user, isOpen, onClose, onSuccess }) => {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState("");

  // Generate a key when modal opens, but KEEP it across retries of the same operation
  useEffect(() => {
    if (isOpen && user) {
      setAmount("");
      setReason("");
      setConfirmed(false);
      setError("");
      setLoading(false);
      // Generate a new idempotency key for this modal session
      const key = `grant_${user._id}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      setIdempotencyKey(key);
    }
  }, [isOpen, user]);

  if (!isOpen || !user) return null;

  const numAmount = parseInt(amount, 10);
  const isValidAmount =
    Number.isInteger(numAmount) && numAmount > 0 && numAmount <= 10000;
  const currentCoins = user.coins || 0;
  const projectedBalance = isValidAmount ? currentCoins + numAmount : currentCoins;

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!isValidAmount) {
      setError("Please enter a valid amount between 1 and 10,000 coins.");
      return;
    }

    if (!reason.trim()) {
      setError("Reason is required for audit logs.");
      return;
    }

    if (!confirmed) {
      setError("Please check the confirmation box before granting coins.");
      return;
    }

    try {
      setLoading(true);
      setError("");

      // Pass the persistent idempotencyKey
      const res = await grantUserCoins(user._id, {
        amount: numAmount,
        reason: reason.trim(),
        idempotencyKey,
      });

      if (res?.duplicate) {
        toast.success(
          res?.message ||
            `Coins previously granted (${numAmount} coins). Idempotency protected.`,
          { icon: "ℹ️" },
        );
      } else {
        toast.success(res?.message || `Successfully granted ${numAmount} coins!`);
      }

      if (onSuccess) {
        onSuccess({
          user: {
            ...user,
            coins: res?.coins ?? projectedBalance,
          },
          transaction: res?.transaction,
          duplicate: res?.duplicate,
        });
      }

      onClose();
    } catch (err) {
      console.error("Coin grant error:", err);
      // NOTE: We intentionally DO NOT generate a new idempotencyKey here!
      // This allows the user to retry the exact same grant safely without risk of double-crediting.
      const msg =
        err?.response?.data?.error || err?.message || "Failed to grant coins";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-lg shadow-2xl border border-gray-200 dark:border-gray-700 fade-in">
        {/* Header */}
        <div className="flex items-center justify-between border-b dark:border-gray-700 pb-3 mb-4">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            🪙 Manual Coin Grant
          </h3>
          <button
            onClick={onClose}
            disabled={loading}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-lg font-bold"
          >
            ✕
          </button>
        </div>

        {/* Disabled Account Check */}
        {user.isActive === false || user.status === "disabled" ? (
          <div className="p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 mb-4">
            <p className="font-semibold">Disabled Account</p>
            <p className="text-sm mt-1">
              Coins cannot be granted to a disabled account. Please enable the
              account first before granting coins.
            </p>
            <div className="mt-4 flex justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 border rounded-lg text-sm"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Target User Summary Card */}
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 border border-gray-200 dark:border-gray-600 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Target User:</span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {user.name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Email:</span>
                <span className="text-gray-700 dark:text-gray-300 font-mono text-xs">
                  {user.email}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500 dark:text-gray-400">Current Balance:</span>
                <span className="font-bold text-yellow-600 dark:text-yellow-400">
                  {currentCoins} 🪙
                </span>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-300 text-xs font-medium">
                {error}
                <div className="mt-1 text-gray-500 dark:text-gray-400 text-[11px]">
                  (Idempotency key retained for safe retry)
                </div>
              </div>
            )}

            {/* Grant Amount Input */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Coins to Grant <span className="text-red-500">*</span>
                </label>
                <span className="text-xs text-gray-400">Max: 10,000</span>
              </div>
              <input
                type="number"
                min="1"
                max="10000"
                step="1"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Enter coin amount (e.g. 100)"
                className="input w-full text-base font-semibold"
                disabled={loading}
              />
              {/* Quick Select Buttons */}
              <div className="flex gap-2 mt-2">
                {[50, 100, 250, 500, 1000].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    disabled={loading}
                    onClick={() => setAmount(String(preset))}
                    className="text-xs px-2.5 py-1 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded border dark:border-gray-600 transition"
                  >
                    +{preset}
                  </button>
                ))}
              </div>
            </div>

            {/* Grant Reason Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Reason for Grant <span className="text-red-500">*</span>
              </label>
              <textarea
                required
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Community contribution reward, platform testing reward..."
                className="input w-full text-sm"
                disabled={loading}
              />
              <span className="text-xs text-gray-400">
                Visible to the user in their transaction history.
              </span>
            </div>

            {/* Summary Preview Box */}
            {isValidAmount && (
              <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg text-xs space-y-1">
                <div className="font-semibold text-indigo-900 dark:text-indigo-300">
                  Transaction Preview:
                </div>
                <div className="flex justify-between text-indigo-800 dark:text-indigo-200">
                  <span>Grant Amount:</span>
                  <span className="font-bold">+{numAmount} 🪙</span>
                </div>
                <div className="flex justify-between text-indigo-800 dark:text-indigo-200 border-t border-indigo-200 dark:border-indigo-800 pt-1">
                  <span>Projected New Balance:</span>
                  <span className="font-bold">{projectedBalance} 🪙</span>
                </div>
              </div>
            )}

            {/* Explicit Confirmation Checkbox */}
            <div className="flex items-start gap-2 pt-1">
              <input
                type="checkbox"
                id="confirmCoinGrant"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                disabled={loading}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <label
                htmlFor="confirmCoinGrant"
                className="text-xs text-gray-700 dark:text-gray-300 cursor-pointer"
              >
                I confirm granting{" "}
                <strong>{isValidAmount ? numAmount : "..."} coins</strong> to{" "}
                <strong>{user.name}</strong>.
              </label>
            </div>

            {/* Idempotency Audit Badge */}
            <div className="text-[10px] text-gray-400 font-mono truncate">
              Key: {idempotencyKey}
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-3 border-t dark:border-gray-700">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !confirmed || !isValidAmount || !reason.trim()}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold shadow disabled:opacity-50 transition"
              >
                {loading
                  ? "Processing..."
                  : error
                    ? "Retry Grant 🪙"
                    : "Confirm & Grant 🪙"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default CoinGrantModal;
