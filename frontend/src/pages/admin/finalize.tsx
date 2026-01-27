import { useParams, useNavigate } from "react-router-dom";
import { trpc } from "@/lib/trpc";

export function FinalizePage() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();

  const orderQuery = trpc.orders.get.useQuery({ id: orderId! }, { enabled: !!orderId });
  const finalizeMutation = trpc.orders.finalize.useMutation();

  const handleFinalize = async () => {
    if (!orderId) return;

    if (!confirm("Are you sure you want to finalize this order? This action cannot be undone.")) {
      return;
    }

    try {
      await finalizeMutation.mutateAsync({ id: orderId });
      alert("Order finalized successfully!");
      orderQuery.refetch();
    } catch (error) {
      alert("Failed to finalize: " + (error instanceof Error ? error.message : "Unknown error"));
    }
  };

  if (orderQuery.isLoading) return <p>Loading order...</p>;
  if (orderQuery.error) return <p className="text-red-600">Error loading order</p>;
  if (!orderQuery.data) return <p>Order not found</p>;

  const order = orderQuery.data;
  const fixedItems = order.items.filter((item) => item.productOption.unitType === "FIXED");
  const weightItems = order.items.filter((item) => item.productOption.unitType === "WEIGHT");

  const fixedTotal = fixedItems.reduce((sum, item) => sum + (item.finalPrice || 0), 0);
  const weightTotal = weightItems.reduce(
    (sum, item) => sum + (item.actualWeight || 0) * (item.finalPrice || 0),
    0
  );
  const grandTotal = fixedTotal + weightTotal;

  const allWeighed = weightItems.every((item) => item.actualWeight !== null);
  const isFinalized = order.status === "FINALIZED";

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <h1 className="text-2xl font-bold text-gray-900">Finalize Order</h1>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="font-semibold text-lg">Order: {order.orderNumber}</h2>
          <p className="text-sm text-gray-600">Status: {order.status}</p>
          <p className="text-sm text-gray-600">Customer: {order.customer.account.name}</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h3 className="font-semibold mb-4">Order Summary</h3>

          <div className="space-y-2">
            {order.items.map((item) => {
              let itemTotal = 0;
              if (item.productOption.unitType === "FIXED" && item.finalPrice) {
                itemTotal = item.finalPrice;
              } else if (item.actualWeight && item.finalPrice) {
                itemTotal = item.actualWeight * item.finalPrice;
              }

              return (
                <div key={item.id} className="flex justify-between text-sm">
                  <span>
                    {item.productOption.product.name} - {item.productOption.name}
                    {item.actualWeight && ` (${item.actualWeight} kg)`}
                  </span>
                  <span className="font-medium">
                    R$ {(itemTotal / 100).toFixed(2)}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="border-t mt-4 pt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span>Subtotal Fixed:</span>
              <span>R$ {(fixedTotal / 100).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Subtotal Weighable:</span>
              <span>R$ {(weightTotal / 100).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold text-primary">
              <span>TOTAL:</span>
              <span>R$ {(grandTotal / 100).toFixed(2)}</span>
            </div>
          </div>
        </div>

        {!allWeighed && !isFinalized && (
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded mb-6">
            Warning: Not all weight items have been weighed. Please complete weighing before finalizing.
          </div>
        )}

        <div className="space-y-4">
          {!isFinalized ? (
            <button
              onClick={handleFinalize}
              disabled={!allWeighed}
              className="w-full bg-primary text-white px-6 py-3 rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {allWeighed ? "Finalize Order" : "Complete Weighing First"}
            </button>
          ) : (
            <a
              href={`/api/delivery-note/${order.id}.pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full bg-green-600 text-white px-6 py-3 rounded-md hover:bg-green-700 text-center"
            >
              Download PDF
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
