import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { OrderStatusTimeline } from "@/components/order-status-timeline";
import { ShoppingCart, Package } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useCart } from "@/hooks/use-cart";
import { toast } from "sonner";

interface OrderDetailsDialogProps {
  orderId: string | null;
  onClose: () => void;
}

export function OrderDetailsDialog({ orderId, onClose }: OrderDetailsDialogProps) {
  const { data: order, isLoading } = trpc.orders.get.useQuery(
    { id: orderId! },
    { enabled: !!orderId }
  );
  const { addItem } = useCart();

  const handleReorder = () => {
    if (!order) return;

    let itemsAdded = 0;
    order.items.forEach((item) => {
      // Only add items that have finalPrice (FIXED items or weighed WEIGHT items)
      if (item.finalPrice) {
        addItem({
          productOptionId: item.productOptionId,
          productName: item.productOption.product.name,
          optionName: item.productOption.name,
          unitType: item.productOption.unitType,
          requestedQty: item.requestedQty,
          price: item.finalPrice, // Price is already in cents
        });
        itemsAdded++;
      }
    });

    if (itemsAdded > 0) {
      toast.success(`Added ${itemsAdded} item${itemsAdded > 1 ? "s" : ""} to cart`, {
        description: "You can review and adjust quantities in your cart",
        duration: 3000,
      });
      onClose();
    } else {
      toast.error("No items available to reorder", {
        description: "This order has no items with final prices",
        duration: 3000,
      });
    }
  };

  const calculateTotal = () => {
    if (!order) return 0;
    return order.items.reduce((sum, item) => {
      if (item.productOption.unitType === "FIXED" && item.finalPrice) {
        return sum + item.finalPrice;
      } else if (item.productOption.unitType === "WEIGHT" && item.actualWeight && item.finalPrice) {
        return sum + item.actualWeight * item.finalPrice;
      }
      return sum;
    }, 0);
  };

  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(cents / 100);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "DRAFT":
        return "bg-gray-100 text-gray-800";
      case "SENT":
        return "bg-blue-100 text-blue-800";
      case "IN_SEPARATION":
        return "bg-yellow-100 text-yellow-800";
      case "FINALIZED":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <Dialog open={!!orderId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Order Details</span>
            {order && (
              <Badge className={getStatusColor(order.status)}>
                {order.status}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-4 py-8">
            <div className="h-4 bg-gray-200 rounded animate-pulse w-1/2"></div>
            <div className="h-4 bg-gray-200 rounded animate-pulse w-1/3"></div>
            <Separator />
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 bg-gray-200 rounded animate-pulse"></div>
              ))}
            </div>
          </div>
        ) : order ? (
          <div className="space-y-6">
            {/* Status Timeline */}
            <div className="bg-gray-50 rounded-lg p-4">
              <OrderStatusTimeline status={order.status as any} />
            </div>

            {/* Order Info */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Order Number</p>
                <p className="font-medium">{order.orderNumber}</p>
              </div>
              <div>
                <p className="text-gray-500">Created</p>
                <p className="font-medium">
                  {new Date(order.createdAt).toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
              <div className="col-span-2">
                <p className="text-gray-500">Created by</p>
                <p className="font-medium">
                  {order.createdByUser?.name || order.createdByUser?.email || "Unknown"}
                </p>
              </div>
              {order.sentAt && (
                <div>
                  <p className="text-gray-500">Sent</p>
                  <p className="font-medium">
                    {new Date(order.sentAt).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              )}
              {order.finalizedAt && (
                <div>
                  <p className="text-gray-500">Finalized</p>
                  <p className="font-medium">
                    {new Date(order.finalizedAt).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              )}
            </div>

            {order.notes && (
              <div>
                <p className="text-sm text-gray-500 mb-1">Notes</p>
                <p className="text-sm bg-gray-50 p-3 rounded">{order.notes}</p>
              </div>
            )}

            <Separator />

            {/* Order Items */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Package className="h-5 w-5 text-gray-600" />
                <h3 className="font-medium">Items ({order.items.length})</h3>
              </div>

              <div className="space-y-3">
                {order.items.map((item) => (
                  <div
                    key={item.id}
                    className="border rounded-lg p-4 bg-gray-50"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <p className="font-medium text-sm">
                          {item.productOption.product.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {item.productOption.name}
                        </p>
                      </div>
                      <Badge
                        variant={item.productOption.unitType === "FIXED" ? "secondary" : "outline"}
                        className="text-xs"
                      >
                        {item.productOption.unitType}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-gray-500">Requested:</span>
                        <span className="ml-1 font-medium">
                          {item.requestedQty}
                          {item.productOption.unitType === "WEIGHT" ? " kg" : " un"}
                        </span>
                      </div>

                      {item.productOption.unitType === "WEIGHT" && item.actualWeight && (
                        <div>
                          <span className="text-gray-500">Actual:</span>
                          <span className="ml-1 font-medium text-green-700">
                            {item.actualWeight} kg
                          </span>
                        </div>
                      )}

                      {item.finalPrice && (
                        <>
                          <div>
                            <span className="text-gray-500">Price:</span>
                            <span className="ml-1 font-medium">
                              {formatPrice(item.finalPrice)}
                              {item.productOption.unitType === "WEIGHT" ? "/kg" : ""}
                            </span>
                          </div>

                          <div>
                            <span className="text-gray-500">Total:</span>
                            <span className="ml-1 font-medium text-blue-700">
                              {item.productOption.unitType === "FIXED"
                                ? formatPrice(item.finalPrice)
                                : item.actualWeight
                                ? formatPrice(item.actualWeight * item.finalPrice)
                                : "Pending"}
                            </span>
                          </div>
                        </>
                      )}
                    </div>

                    {item.notes && (
                      <p className="text-xs text-gray-600 mt-2 italic">{item.notes}</p>
                    )}

                    {item.isExtra && (
                      <Badge variant="outline" className="mt-2 text-xs">
                        Extra Item
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Total */}
            <div className="flex justify-between items-center text-lg font-semibold">
              <span>Total</span>
              <span className="text-blue-700">{formatPrice(calculateTotal())}</span>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Button
                onClick={handleReorder}
                className="flex-1"
                variant="default"
              >
                <ShoppingCart className="mr-2 h-4 w-4" />
                Reorder
              </Button>
              <Button
                onClick={onClose}
                variant="outline"
                className="flex-1"
              >
                Close
              </Button>
            </div>

            {order.status === "FINALIZED" && (
              <a
                href={`http://localhost:3001/api/delivery-note/${order.id}.pdf`}
                target="_blank"
                rel="noopener noreferrer"
                className="block"
              >
                <Button variant="secondary" className="w-full">
                  Download PDF
                </Button>
              </a>
            )}
          </div>
        ) : (
          <div className="py-8 text-center text-gray-500">
            Order not found
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
