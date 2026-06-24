const CoinPackageCard = ({ pkg, onBuy }) => {
  return (
    <div
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
        onClick={() => onBuy(pkg)}
        className="mt-3 w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded"
      >
        Buy Now
      </button>
    </div>
  );
};

export default CoinPackageCard;
