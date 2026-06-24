const PurchaseModal = ({ pkg, onClose, onConfirm }) => {
  if (!pkg) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-900 rounded-xl p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">Confirm Purchase</h2>

        <div className="space-y-2 mb-6">
          <p>
            <strong>Package:</strong> {pkg.name}
          </p>

          <p>
            <strong>Coins:</strong> {pkg.coins} 🪙
          </p>

          <p>
            <strong>Price:</strong> ₹{pkg.price}
          </p>
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 border rounded-lg py-2">
            Cancel
          </button>

          <button
            onClick={() => onConfirm(pkg)}
            className="flex-1 bg-indigo-600 text-white rounded-lg py-2"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
};

export default PurchaseModal;
