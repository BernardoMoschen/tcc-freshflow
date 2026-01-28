import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { trpc } from "@/lib/trpc";
import { useCart } from "@/hooks/use-cart";
import { PageLayout } from "@/components/page-layout";
import { useToast } from "@/components/toast";

export function CartPage() {
  const { items, updateQuantity, removeItem, clear, subtotal } = useCart();
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const { showToast } = useToast();

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
      showToast(`Order created: ${order.orderNumber}`, "success");
      navigate("/chef/orders");
    } catch (error) {
      showToast("Failed to create order: " + (error instanceof Error ? error.message : "Unknown error"), "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageLayout title="Shopping Cart">
      {items.length === 0 ? (
        <div className="text-center py-16">
          <svg
            className="mx-auto h-16 w-16 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
            />
          </svg>
          <p className="mt-4 text-lg text-gray-600">Your cart is empty</p>
          <button
            onClick={() => navigate("/chef/catalog")}
            className="mt-6 bg-primary text-white px-6 py-3 rounded-lg hover:bg-primary/90 font-medium transition-colors"
          >
            Browse Products
          </button>
        </div>
      ) : (
        <>
          {/* Cart items */}
          <div className="bg-white rounded-lg shadow-sm divide-y">
            {items.map((item) => (
              <div key={item.productOptionId} className="p-4 md:p-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="font-semibold text-base md:text-lg">{item.productName}</h3>
                    <p className="text-sm text-gray-600">{item.optionName}</p>
                    <p className="text-sm font-medium text-primary mt-1">
                      R$ {(item.price / 100).toFixed(2)}
                      {item.unitType === "WEIGHT" && " /kg"}
                    </p>
                  </div>

                  <div className="flex items-center justify-between md:justify-end gap-4">
                    <div className="flex items-center gap-2">
                      <label htmlFor={`qty-${item.productOptionId}`} className="text-sm font-medium text-gray-700">
                        Qty:
                      </label>
                      <input
                        id={`qty-${item.productOptionId}`}
                        type="number"
                        min="0.1"
                        step="0.1"
                        value={item.requestedQty}
                        onChange={(e) =>
                          updateQuantity(item.productOptionId, parseFloat(e.target.value) || 0.1)
                        }
                        className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                      />
                    </div>
                    <button
                      onClick={() => removeItem(item.productOptionId)}
                      className="text-red-600 hover:text-red-800 font-medium px-3 py-2 rounded-lg hover:bg-red-50 transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Order summary */}
          <div className="mt-6 bg-white rounded-lg shadow-sm p-6 sticky bottom-20 md:bottom-4">
            <div className="flex justify-between items-center mb-6">
              <span className="text-lg md:text-xl font-semibold">Subtotal:</span>
              <span className="text-2xl md:text-3xl font-bold text-primary">
                R$ {(subtotal / 100).toFixed(2)}
              </span>
            </div>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full bg-primary text-white px-6 py-4 rounded-lg hover:bg-primary/90 disabled:opacity-50 font-medium text-base transition-colors"
            >
              {submitting ? "Submitting..." : "Send Order"}
            </button>
            <p className="mt-3 text-xs text-center text-gray-600">
              Weight-based items will be priced after weighing
            </p>
          </div>
        </>
      )}
    </PageLayout>
  );
}
