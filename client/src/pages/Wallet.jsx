import { useEffect, useState } from "react";
import { getCoinOverview, purchaseCoins } from "../api/coinApi";
import useAuth from "../hooks/useAuth";
import toast from "react-hot-toast";
import coinPackages from "../data/coinPackages";
import PurchaseModal from "../components/wallet/PurchaseModel";

const Wallet = () => {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [filter, setFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);

  const TRANSACTIONS_PER_PAGE = 10;
  const { user, updateUser } = useAuth();
  const handleBuy = (pkg) => {
    setSelectedPackage(pkg);

    console.log("Selected Package:", pkg);
  };
  const handleCloseModal = () => {
    setSelectedPackage(null);
  };

  const handleConfirmPurchase = async (pkg) => {
    try {
      const packageMap = {
        1: "starter",
        2: "popular",
        3: "premium",
      };

      const packageId = packageMap[pkg.id];

      const response = await purchaseCoins(packageId);

      toast.success(`${response.coinsAdded} coins added successfully`);

      setSelectedPackage(null);

      const updatedOverview = await getCoinOverview(currentPage, filter, TRANSACTIONS_PER_PAGE);

      setOverview(updatedOverview);

      updateUser({
        ...user,
        coins: updatedOverview.currentBalance,
      });
    } catch (error) {
      console.error(error);

      toast.error(error?.response?.data?.error || "Purchase failed");
    }
  };
  const loadWallet = async (page = 1, type = "all") => {
    try {
      const data = await getCoinOverview(page, type, TRANSACTIONS_PER_PAGE);
      setOverview(data);
    } catch (error) {
      console.error("Wallet load failed:", error);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    loadWallet(currentPage, filter);
  }, [currentPage, filter]);

  if (loading) {
    return <div>Loading wallet...</div>;
  }
  const paginatedTransactions = overview?.transactions || [];

  const totalPages = overview?.totalPages || 1;
  return (
    <div className="max-w-6xl mx-auto">
      {/* Stats Cards */}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-yellow-100 dark:bg-yellow-900 p-4 rounded-lg">
          <p className="text-sm">🪙 Current Balance</p>
          <p className="text-2xl font-bold">{overview?.currentBalance || 0}</p>
        </div>

        <div className="bg-green-100 dark:bg-green-900 p-4 rounded-lg">
          <p className="text-sm">📈 Total Earned</p>
          <p className="text-2xl font-bold">{overview?.totalEarned || 0}</p>
        </div>

        <div className="bg-red-100 dark:bg-red-900 p-4 rounded-lg">
          <p className="text-sm">📉 Total Spent</p>
          <p className="text-2xl font-bold">{overview?.totalSpent || 0}</p>
        </div>

        <div className="bg-blue-100 dark:bg-blue-900 p-4 rounded-lg">
          <p className="text-sm">💳 Total Purchased</p>
          <p className="text-2xl font-bold">{overview?.totalPurchased || 0}</p>
        </div>
      </div>
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Buy Coins</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {coinPackages.map((pkg) => (
            <div
              key={pkg.id}
              className={`p-4 rounded-lg ${
                pkg.popular
                  ? "border-2 border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20"
                  : "bg-gray-100 dark:bg-gray-800"
              }`}
            >
              {pkg.popular && (
                <span className="text-xs bg-indigo-600 text-white px-2 py-1 rounded">
                  MOST POPULAR
                </span>
              )}

              <h3 className="font-semibold mt-2">{pkg.name}</h3>

              <p className="text-2xl font-bold">{pkg.coins} 🪙</p>

              <p className="text-sm text-gray-500">₹{pkg.price}</p>

              <button
                onClick={() => handleBuy(pkg)}
                className="mt-3 w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded"
              >
                Buy Now
              </button>
            </div>
          ))}
        </div>
      </div>
      {/* Transaction History */}

      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">Transaction History</h2>

        <div className="flex flex-wrap gap-2 mb-4">
          {["all", "earned", "spent", "purchase", "bonus", "refund"].map(
            (type) => (
              <button
                key={type}
                onClick={() => {
                  setFilter(type);
                  setCurrentPage(1);
                }}
                className={`px-3 py-1 rounded capitalize ${
                  filter === type
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-200 dark:bg-gray-700"
                }`}
              >
                {type}
              </button>
            ),
          )}
        </div>

        {!overview?.transactions?.length ? (
          <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4">
            No transactions found
          </div>
        ) : (
          <div className="space-y-3">
            {paginatedTransactions.length === 0 ? (
              <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 text-center">
                No transactions found for this filter
              </div>
            ) : (
              paginatedTransactions.map((item, index) => (
                <div
                  key={index}
                  className="flex justify-between items-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 shadow-sm hover:shadow-md transition"
                >
                  <div>
                    <p className="font-medium">{item.reason}</p>

                    <p className="text-xs text-gray-500 capitalize">
                      {item.type === "earned" && "🟢 Earned"}
                      {item.type === "spent" && "🔴 Spent"}
                      {item.type === "purchase" && "💳 Purchase"}
                      {item.type === "bonus" && "🎁 Bonus"}
                      {item.type === "refund" && "↩ Refund"}
                    </p>

                    {item.paperTitle && (
                      <p className="text-sm text-gray-500">{item.paperTitle}</p>
                    )}

                    <p className="text-xs text-gray-400">
                      {new Date(item.createdAt).toLocaleString()}
                    </p>
                  </div>

                  <div
                    className={`font-bold text-lg ${
                      ["earned", "bonus", "purchase", "purchased", "refund"].includes(item.type)
                        ? "text-green-500"
                        : "text-red-500"
                    }`}
                  >
                    {["earned", "bonus", "purchase", "purchased", "refund"].includes(item.type)
                      ? "+"
                      : "-"}
                    {item.amount} 🪙
                  </div>
                </div>
              ))
            )}
          </div>
        )}
        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-4 mt-6">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => p - 1)}
              className="px-4 py-2 rounded bg-gray-200 dark:bg-gray-700 disabled:opacity-50"
            >
              Previous
            </button>

            <span>
              Page {currentPage} of {totalPages}
            </span>

            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => p + 1)}
              className="px-4 py-2 rounded bg-gray-200 dark:bg-gray-700 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}
      </div>
      <PurchaseModal
        pkg={selectedPackage}
        onClose={handleCloseModal}
        onConfirm={handleConfirmPurchase}
      />
    </div>
  );
};

export default Wallet;
