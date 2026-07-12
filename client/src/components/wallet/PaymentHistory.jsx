const PaymentHistory = ({ payments = [] }) => {
  if (!payments.length) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow">
        <h2 className="text-xl font-semibold mb-4">💳 Payment History</h2>

        <p className="text-gray-500">No payment history found.</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow">
      <h2 className="text-xl font-semibold mb-5">💳 Payment History</h2>

      <div className="space-y-4">
        {payments.map((payment) => (
          <div
            key={payment._id}
            className="border rounded-xl p-4 flex justify-between items-center"
          >
            <div>
              <h3 className="font-semibold">{payment.packageName}</h3>

              <p className="text-sm text-gray-500">
                {new Date(payment.createdAt).toLocaleString()}
              </p>

              <p className="text-sm">Payment ID :{payment.paymentId || "--"}</p>
            </div>

            <div className="text-right">
              <p className="font-bold">₹{payment.amount}</p>

              <p className="text-green-500">+{payment.coins} 🪙</p>

              <span
                className={`text-xs px-2 py-1 rounded-full ${
                  payment.status === "captured"
                    ? "bg-green-100 text-green-700"
                    : payment.status === "failed"
                      ? "bg-red-100 text-red-700"
                      : "bg-yellow-100 text-yellow-700"
                }`}
              >
                {payment.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PaymentHistory;
