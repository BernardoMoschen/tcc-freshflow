import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { trpc } from "@/lib/trpc";
import { useCart } from "@/hooks/use-cart";
import { PageLayout } from "@/components/page-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Calendar, MessageSquare, Trash2 } from "lucide-react";

export function CartPage() {
  const { items, updateQuantity, updateNotes, removeItem, subtotal, draftOrderId } = useCart();
  const [submitting, setSubmitting] = useState(false);
  const [orderNotes, setOrderNotes] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const navigate = useNavigate();

  const submitDraftMutation = trpc.orders.submitDraft.useMutation();

  // Set default delivery date to tomorrow
  useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setDeliveryDate(tomorrow.toISOString().split("T")[0]);
  });

  const handleSubmit = async () => {
    if (items.length === 0) {
      toast.error("Cart is empty");
      return;
    }

    if (!draftOrderId) {
      toast.error("Draft order not found");
      return;
    }

    setSubmitting(true);
    try {
      const order = await submitDraftMutation.mutateAsync({
        orderId: draftOrderId,
      });

      toast.success(`Order submitted: ${order.orderNumber}`, {
        description: deliveryDate
          ? `Scheduled for ${new Date(deliveryDate).toLocaleDateString("pt-BR")}`
          : undefined,
      });
      navigate("/chef/orders");
    } catch (error) {
      toast.error("Failed to submit order", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Quick date buttons
  const getQuickDate = (daysFromNow: number) => {
    const date = new Date();
    date.setDate(date.getDate() + daysFromNow);
    return date.toISOString().split("T")[0];
  };

  const formatDateLabel = (daysFromNow: number) => {
    if (daysFromNow === 0) return "Today";
    if (daysFromNow === 1) return "Tomorrow";
    const date = new Date();
    date.setDate(date.getDate() + daysFromNow);
    return date.toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short" });
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
          <Button onClick={() => navigate("/chef/catalog")} className="mt-6">
            Browse Products
          </Button>
        </div>
      ) : (
        <>
          {/* Cart items */}
          <div className="space-y-4 mb-6">
            {items.map((item) => (
              <div key={item.productOptionId} className="bg-white rounded-lg shadow-sm p-4 md:p-6">
                <div className="flex flex-col gap-4">
                  {/* Item header */}
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1">
                      <h3 className="font-semibold text-base md:text-lg">{item.productName}</h3>
                      <p className="text-sm text-gray-600">{item.optionName}</p>
                      <p className="text-sm font-medium text-primary mt-1">
                        R$ {(item.price / 100).toFixed(2)}
                        {item.unitType === "WEIGHT" && " /kg"}
                      </p>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeItem(item.productOptionId)}
                      className="text-red-600 hover:text-red-800 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Quantity controls */}
                  <div className="flex items-center gap-3">
                    <Label htmlFor={`qty-${item.productOptionId}`} className="text-sm font-medium">
                      Quantity:
                    </Label>
                    <Input
                      id={`qty-${item.productOptionId}`}
                      type="number"
                      min="0.1"
                      step="0.1"
                      value={item.requestedQty}
                      onChange={(e) =>
                        updateQuantity(item.productOptionId, parseFloat(e.target.value) || 0.1)
                      }
                      className="w-24"
                    />
                    <span className="text-sm text-gray-600">
                      {item.unitType === "WEIGHT" ? "kg" : "units"}
                    </span>
                    <div className="ml-auto text-right">
                      <span className="text-sm text-gray-500">Subtotal: </span>
                      <span className="font-semibold text-primary">
                        R$ {((item.price * item.requestedQty) / 100).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Item notes */}
                  <div className="space-y-2">
                    <Label
                      htmlFor={`notes-${item.productOptionId}`}
                      className="text-xs text-gray-600 flex items-center gap-1"
                    >
                      <MessageSquare className="h-3 w-3" />
                      Special instructions (optional)
                    </Label>
                    <Textarea
                      id={`notes-${item.productOptionId}`}
                      placeholder={`E.g., "Cut in half", "Extra fresh", "No substitutions"...`}
                      value={item.notes || ""}
                      onChange={(e) => updateNotes(item.productOptionId, e.target.value)}
                      className="text-sm resize-none"
                      rows={2}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Order details section */}
          <div className="bg-white rounded-lg shadow-sm p-6 space-y-6 mb-6">
            <h3 className="font-semibold text-lg">Order Details</h3>

            {/* Delivery Date */}
            <div className="space-y-3">
              <Label htmlFor="deliveryDate" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Delivery Date
              </Label>

              {/* Quick date buttons */}
              <div className="flex flex-wrap gap-2">
                {[0, 1, 2, 3].map((days) => (
                  <Button
                    key={days}
                    type="button"
                    variant={deliveryDate === getQuickDate(days) ? "default" : "outline"}
                    size="sm"
                    onClick={() => setDeliveryDate(getQuickDate(days))}
                  >
                    {formatDateLabel(days)}
                  </Button>
                ))}
              </div>

              {/* Date picker */}
              <Input
                id="deliveryDate"
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
                className="w-full"
              />
            </div>

            {/* Overall Order Notes */}
            <div className="space-y-2">
              <Label htmlFor="orderNotes" className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Order Notes (optional)
              </Label>
              <Textarea
                id="orderNotes"
                placeholder='E.g., "Deliver to back door", "Call before delivery", "Urgent order"...'
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value)}
                className="resize-none"
                rows={3}
              />
            </div>
          </div>

          {/* Order summary - sticky on mobile */}
          <div className="bg-white rounded-lg shadow-sm p-6 sticky bottom-20 md:bottom-4">
            <div className="flex justify-between items-center mb-6">
              <span className="text-lg md:text-xl font-semibold">Subtotal:</span>
              <span className="text-2xl md:text-3xl font-bold text-primary">
                R$ {(subtotal / 100).toFixed(2)}
              </span>
            </div>
            <Button onClick={handleSubmit} disabled={submitting} className="w-full" size="lg">
              {submitting ? "Submitting..." : "Send Order"}
            </Button>
            <p className="mt-3 text-xs text-center text-gray-600">
              Weight-based items will be priced after weighing
            </p>
          </div>
        </>
      )}
    </PageLayout>
  );
}
