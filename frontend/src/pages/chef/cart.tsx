import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { trpc } from "@/lib/trpc";
import { useCart } from "@/hooks/use-cart";

export function CartPage() {
  const { items, updateQuantity, removeItem, clear, subtotal } = useCart();
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const createOrderMutation = trpc.orders.create.useMutation();

  const handleSubmit = async () => {
    if (items.length === 0) return;

    setSubmitting(true);
    try {
      const order = await createOrderMutation.mutateAsync({
        notes: "Order from web app",
        items: items.map((item) => ({
          productOptionId: item.productOptionId,
          requestedQty: item.requestedQty,
          isExtra: false,
        })),
      });

      clear();
      alert(`Order created: ${order.orderNumber}`);
      navigate("/chef/orders");
    } catch (error) {
      alert("Failed to create order: " + (error instanceof Error ? error.message : "Unknown error"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <h1 className="text-2xl font-bold text-gray-900">Shopping Cart</h1>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {items.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600">Your cart is empty</p>
            <button
              onClick={() => navigate("/chef/catalog")}
              className="mt-4 bg-primary text-white px-6 py-2 rounded-md hover:bg-primary/90"
            >
              Browse Products
            </button>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-lg shadow divide-y">
              {items.map((item) => (
                <div key={item.productOptionId} className="p-6 flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold">{item.productName}</h3>
                    <p className="text-sm text-gray-600">{item.optionName}</p>
                    <p className="text-sm font-medium text-primary mt-1">
                      R$ {(item.price / 100).toFixed(2)}
                    </p>
                  </div>
                  <div className="flex items-center space-x-4">
                    <input
                      type="number"
                      min="1"
                      step="0.1"
                      value={item.requestedQty}
                      onChange={(e) =>
                        updateQuantity(item.productOptionId, parseFloat(e.target.value))
                      }
                      className="w-24 px-3 py-1 border rounded"
                    />
                    <button
                      onClick={() => removeItem(item.productOptionId)}
                      className="text-red-600 hover:text-red-800"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-center mb-4">
                <span className="text-lg font-semibold">Subtotal:</span>
                <span className="text-2xl font-bold text-primary">
                  R$ {(subtotal / 100).toFixed(2)}
                </span>
              </div>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full bg-primary text-white px-6 py-3 rounded-md hover:bg-primary/90 disabled:opacity-50"
              >
                {submitting ? "Submitting..." : "Send Order"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
