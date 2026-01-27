import { useState } from "react";
import { useParams } from "react-router-dom";
import { trpc } from "@/lib/trpc";
import { useOffline } from "@/hooks/use-offline";
import { queueWeighing } from "@/lib/offline";

export function WeighingPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const { isOnline, pending } = useOffline();

  const orderQuery = trpc.orders.get.useQuery({ id: orderId! }, { enabled: !!orderId });
  const weighMutation = trpc.orders.weigh.useMutation();

  const [weights, setWeights] = useState<Record<string, number>>({});
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [persistFlags, setPersistFlags] = useState<Record<string, boolean>>({});

  const handleWeigh = async (orderItemId: string) => {
    const actualWeight = weights[orderItemId];
    const finalPrice = prices[orderItemId];
    const persistPrice = persistFlags[orderItemId] || false;

    if (!actualWeight || actualWeight <= 0) {
      alert("Please enter a valid weight");
      return;
    }

    try {
      if (isOnline) {
        await weighMutation.mutateAsync({
          orderItemId,
          actualWeight,
          finalPrice,
          persistPrice,
        });
        alert("Weight saved!");
        orderQuery.refetch();
      } else {
        await queueWeighing({
          orderItemId,
          actualWeight,
          finalPrice,
          persistPrice,
        });
        alert("Weight queued for sync when online");
      }
    } catch (error) {
      alert("Failed to save weight: " + (error instanceof Error ? error.message : "Unknown error"));
    }
  };

  if (orderQuery.isLoading) return <p>Loading order...</p>;
  if (orderQuery.error) return <p className="text-red-600">Error loading order</p>;
  if (!orderQuery.data) return <p>Order not found</p>;

  const order = orderQuery.data;
  const weightItems = order.items.filter((item) => item.productOption.unitType === "WEIGHT");

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">Weighing Station</h1>
            <div className="flex items-center space-x-4">
              {!isOnline && <span className="text-red-600 text-sm">Offline</span>}
              {pending > 0 && (
                <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded text-sm">
                  {pending} pending sync
                </span>
              )}
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="font-semibold text-lg">Order: {order.orderNumber}</h2>
          <p className="text-sm text-gray-600">Status: {order.status}</p>
        </div>

        <div className="space-y-6">
          {weightItems.map((item) => (
            <div key={item.id} className="bg-white rounded-lg shadow p-6">
              <h3 className="font-semibold">{item.productOption.product.name}</h3>
              <p className="text-sm text-gray-600">{item.productOption.name}</p>
              <p className="text-sm text-gray-600">Requested: {item.requestedQty} kg</p>

              {item.actualWeight ? (
                <div className="mt-4 p-4 bg-green-50 rounded">
                  <p className="text-green-800 font-medium">
                    Weighed: {item.actualWeight} kg
                  </p>
                  <p className="text-sm text-green-700">
                    Price: R$ {item.finalPrice ? (item.finalPrice / 100).toFixed(2) : "N/A"} /kg
                  </p>
                </div>
              ) : (
                <div className="mt-4 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Actual Weight (kg)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={weights[item.id] || ""}
                      onChange={(e) =>
                        setWeights({ ...weights, [item.id]: parseFloat(e.target.value) })
                      }
                      className="mt-1 block w-full px-4 py-3 text-lg border border-gray-300 rounded-md"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Price Override (optional, R$ per kg)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={prices[item.id] || ""}
                      onChange={(e) =>
                        setPrices({ ...prices, [item.id]: parseFloat(e.target.value) * 100 })
                      }
                      className="mt-1 block w-full px-4 py-3 text-lg border border-gray-300 rounded-md"
                    />
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id={`persist-${item.id}`}
                      checked={persistFlags[item.id] || false}
                      onChange={(e) =>
                        setPersistFlags({ ...persistFlags, [item.id]: e.target.checked })
                      }
                      className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                    />
                    <label
                      htmlFor={`persist-${item.id}`}
                      className="ml-2 text-sm text-gray-700"
                    >
                      Save price for customer
                    </label>
                  </div>

                  <button
                    onClick={() => handleWeigh(item.id)}
                    className="w-full bg-primary text-white px-6 py-3 rounded-md hover:bg-primary/90 text-lg"
                  >
                    Save Weight
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
