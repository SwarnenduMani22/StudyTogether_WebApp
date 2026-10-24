import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { updateUserStatus } from "../../api/admin";

const AccountStatusModal = ({
  user,
  currentAdmin,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isCurrentActive =
    user?.isActive !== false && user?.status !== "disabled";
  const targetAction = isCurrentActive ? "disabled" : "active";
  const actionLabel = isCurrentActive ? "Disable" : "Enable";
  const isSelf = currentAdmin?._id === user?._id;

  useEffect(() => {
    if (isOpen) {
      setReason("");
      setConfirmed(false);
      setError("");
      setLoading(false);
    }
  }, [isOpen, user]);

  if (!isOpen || !user) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSelf && targetAction === "disabled") {
      setError("You cannot disable your own account");
      return;
    }
    if (!reason.trim()) {
      setError("Please provide a reason for this action");
      return;
    }
    if (!confirmed) {
      setError("Please confirm before proceeding");
      return;
    }

    try {
      setLoading(true);
      setError("");
      const res = await updateUserStatus(user._id, {
        status: targetAction,
        reason: reason.trim(),
      });

      toast.success(
        res?.message ||
          `Account ${targetAction === "disabled" ? "disabled" : "enabled"} successfully`,
      );
      if (onSuccess) {
        onSuccess(
          res?.user || {
            ...user,
            isActive: targetAction === "active",
            status: targetAction,
          },
        );
      }
      onClose();
    } catch (err) {
      console.error("Account status update error:", err);
      const msg =
        err?.response?.data?.error ||
        err?.message ||
        "Failed to update account status";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-lg shadow-2xl border border-gray-200 dark:border-gray-700 fade-in">
        <div className="flex items-center justify-between border-b dark:border-gray-700 pb-3 mb-4">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            {isCurrentActive
              ? "⚠️ Disable User Account"
              : "✅ Enable User Account"}
          </h3>
          <button
            onClick={onClose}
            disabled={loading}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-lg font-bold"
          >
            ✕
          </button>
        </div>

        {isSelf && targetAction === "disabled" ? (
          <div className="p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 mb-4">
            <p className="font-semibold">Action Not Allowed</p>
            <p className="text-sm mt-1">
              You cannot disable your own administrator account. Another admin
              must perform this action if required.
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
                <span className="text-gray-500 dark:text-gray-400">
                  Target User:
                </span>
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
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Role:</span>
                <span className="capitalize font-medium text-gray-800 dark:text-gray-200">
                  {user.role}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500 dark:text-gray-400">
                  Current Status:
                </span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    isCurrentActive
                      ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
                      : "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"
                  }`}
                >
                  {isCurrentActive ? "Active" : "Disabled"}
                </span>
              </div>
            </div>

            {/* Warning when disabling */}
            {isCurrentActive && (
              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-amber-800 dark:text-amber-200 text-xs">
                ⚠️ Disabling this account immediately revokes all active refresh
                tokens, blocks future logins, and denies access to all protected
                API routes in real-time.
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-300 text-xs font-medium">
                {error}
              </div>
            )}

            {/* Reason Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Reason for {actionLabel}ing Account{" "}
                <span className="text-red-500">*</span>
              </label>
              <textarea
                required
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={`Provide the administrative reason to ${actionLabel.toLowerCase()} this account...`}
                className="input w-full text-sm"
                disabled={loading}
              />
              <span className="text-xs text-gray-400">
                Required for administrative audit log.
              </span>
            </div>

            {/* Explicit Confirmation Checkbox */}
            <div className="flex items-start gap-2 pt-2">
              <input
                type="checkbox"
                id="confirmStatusChange"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                disabled={loading}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <label
                htmlFor="confirmStatusChange"
                className="text-xs text-gray-700 dark:text-gray-300 cursor-pointer"
              >
                I explicitly confirm that I want to{" "}
                <strong>{actionLabel.toLowerCase()}</strong> the account of{" "}
                <strong>{user.name}</strong>.
              </label>
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
                disabled={loading || !confirmed || !reason.trim()}
                className={`px-4 py-2 rounded-lg text-sm font-semibold text-white shadow disabled:opacity-50 transition ${
                  isCurrentActive
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-green-600 hover:bg-green-700"
                }`}
              >
                {loading ? "Processing..." : `Confirm ${actionLabel}`}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default AccountStatusModal;
