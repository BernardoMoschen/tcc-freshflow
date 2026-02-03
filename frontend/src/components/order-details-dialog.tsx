import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { OrderDetailsSkeleton } from "@/components/ui/skeleton";
import { OrderStatusTimeline } from "@/components/order-status-timeline";
import { OrderActivityTimeline } from "@/components/order-activity-timeline";
import { ShoppingCart, Package, XCircle, Trash2, History } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useCart } from "@/hooks/use-cart";
import { toast } from "sonner";
import { useState } from "react";

interface OrderDetailsDialogProps {
  orderId: string | null;
  onClose: () => void;
}

export function OrderDetailsDialog({ orderId, onClose }: OrderDetailsDialogProps) {
  const [isEditing, setIsEditing] = useState(false);
  const utils = trpc.useUtils();

  const { data: order, isLoading } = trpc.orders.get.useQuery(
    { id: orderId! },
    { enabled: !!orderId }
  );
  const { addItem } = useCart();

  const cancelOrderMutation = trpc.orders.cancel.useMutation({
    onSuccess: () => {
      toast.success("Pedido cancelado com sucesso");
      utils.orders.list.invalidate();
      onClose();
    },
    onError: (error) => {
      toast.error("Falha ao cancelar pedido", { description: error.message });
    },
  });

  const removeItemMutation = trpc.orders.removeItem.useMutation({
    onSuccess: () => {
      toast.success("Item removido do pedido");
      utils.orders.get.invalidate();
      utils.orders.list.invalidate();
    },
    onError: (error) => {
      toast.error("Falha ao remover item", { description: error.message });
    },
  });

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
      toast.success(`${itemsAdded} item${itemsAdded > 1 ? "s" : ""} adicionado${itemsAdded > 1 ? "s" : ""} ao carrinho`, {
        description: "Você pode revisar e ajustar quantidades no seu carrinho",
        duration: 3000,
      });
      onClose();
    } else {
      toast.error("Nenhum item disponível para repedir", {
        description: "Este pedido não possui itens com preços finais",
        duration: 3000,
      });
    }
  };

  const handleCancelOrder = () => {
    if (!order) return;

    const reason = prompt(
      "Por favor, forneça um motivo para o cancelamento (opcional):"
    );

    if (reason === null) return; // User clicked cancel

    if (
      confirm(
        `Tem certeza que deseja cancelar o pedido ${order.orderNumber}? ${
          order.status === "FINALIZED"
            ? "O estoque será restaurado."
            : "Esta ação não pode ser desfeita."
        }`
      )
    ) {
      cancelOrderMutation.mutate({
        id: order.id,
        reason: reason || undefined,
      });
    }
  };

  const handleRemoveItem = (itemId: string, itemName: string) => {
    if (
      confirm(
        `Remover ${itemName} deste pedido? Esta ação não pode ser desfeita.`
      )
    ) {
      removeItemMutation.mutate({ orderItemId: itemId });
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
        return "bg-secondary text-secondary-foreground";
      case "SENT":
        return "bg-primary/10 text-primary";
      case "IN_SEPARATION":
        return "bg-warning/10 text-warning";
      case "FINALIZED":
        return "bg-success/10 text-success";
      default:
        return "bg-secondary text-secondary-foreground";
    }
  };

  return (
    <Dialog open={!!orderId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Detalhes do Pedido</span>
            {order && (
              <Badge className={getStatusColor(order.status)}>
                {order.status === "SENT" ? "Enviado" : order.status === "IN_SEPARATION" ? "Em Separação" : order.status === "FINALIZED" ? "Finalizado" : order.status}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <OrderDetailsSkeleton />
        ) : order ? (
          <div className="space-y-6">
            {/* Status Timeline */}
            <div className="bg-muted rounded-lg p-4">
              <OrderStatusTimeline status={order.status as any} />
            </div>

            {/* Order Info */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Número do Pedido</p>
                <p className="font-medium">{order.orderNumber}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Criado</p>
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
                <p className="text-muted-foreground">Criado por</p>
                <p className="font-medium">
                  {order.createdByUser?.name || order.createdByUser?.email || "Desconhecido"}
                </p>
              </div>
              {order.sentAt && (
                <div>
                  <p className="text-muted-foreground">Enviado</p>
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
                  <p className="text-muted-foreground">Finalizado</p>
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
                <p className="text-sm text-muted-foreground mb-1">Observações</p>
                <p className="text-sm bg-muted p-3 rounded">{order.notes}</p>
              </div>
            )}

            <Separator />

            {/* Order Items */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Package className="h-5 w-5 text-muted-foreground" />
                <h3 className="font-medium">Itens ({order.items.length})</h3>
              </div>

              <div className="space-y-3">
                {order.items.map((item) => (
                  <div
                    key={item.id}
                    className="border rounded-lg p-4 bg-muted"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <p className="font-medium text-sm">
                          {item.productOption.product.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {item.productOption.name}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={item.productOption.unitType === "FIXED" ? "secondary" : "outline"}
                          className="text-xs"
                        >
                          {item.productOption.unitType}
                        </Badge>
                        {order.status !== "FINALIZED" && isEditing && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              handleRemoveItem(
                                item.id,
                                `${item.productOption.product.name} - ${item.productOption.name}`
                              )
                            }
                            className="text-destructive hover:text-destructive hover:bg-destructive/10 h-6 w-6 p-0"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Solicitado:</span>
                        <span className="ml-1 font-medium">
                          {item.requestedQty}
                          {item.productOption.unitType === "WEIGHT" ? " kg" : " un"}
                        </span>
                      </div>

                      {item.productOption.unitType === "WEIGHT" && item.actualWeight && (
                        <div>
                          <span className="text-muted-foreground">Real:</span>
                          <span className="ml-1 font-medium text-success">
                            {item.actualWeight} kg
                          </span>
                        </div>
                      )}

                      {item.finalPrice && (
                        <>
                          <div>
                            <span className="text-muted-foreground">Preço:</span>
                            <span className="ml-1 font-medium">
                              {formatPrice(item.finalPrice)}
                              {item.productOption.unitType === "WEIGHT" ? "/kg" : ""}
                            </span>
                          </div>

                          <div>
                            <span className="text-muted-foreground">Total:</span>
                            <span className="ml-1 font-medium text-primary">
                              {item.productOption.unitType === "FIXED"
                                ? formatPrice(item.finalPrice)
                                : item.actualWeight
                                ? formatPrice(item.actualWeight * item.finalPrice)
                                : "Pendente"}
                            </span>
                          </div>
                        </>
                      )}
                    </div>

                    {item.notes && (
                      <p className="text-xs text-muted-foreground mt-2 italic">{item.notes}</p>
                    )}

                    {item.isExtra && (
                      <Badge variant="outline" className="mt-2 text-xs">
                        Item Extra
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
              <span className="text-primary">{formatPrice(calculateTotal())}</span>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-3">
              <div className="flex gap-3">
                <Button
                  onClick={handleReorder}
                  className="flex-1"
                  variant="default"
                >
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  Repedir
                </Button>

                {order.status !== "FINALIZED" && (
                  <Button
                    onClick={() => setIsEditing(!isEditing)}
                    variant="outline"
                    className="flex-1"
                  >
                    {isEditing ? "Concluir Edição" : "Editar Itens"}
                  </Button>
                )}

                <Button
                  onClick={onClose}
                  variant="outline"
                  className="flex-1"
                >
                  Fechar
                </Button>
              </div>

              {order.status !== "DRAFT" && (
                <Button
                  onClick={handleCancelOrder}
                  variant="destructive"
                  className="w-full"
                  disabled={cancelOrderMutation.isPending}
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Cancelar Pedido
                </Button>
              )}
            </div>

            {order.status === "FINALIZED" && (
              <a
                href={`http://localhost:3001/api/delivery-note/${order.id}.pdf`}
                target="_blank"
                rel="noopener noreferrer"
                className="block"
              >
                <Button variant="secondary" className="w-full">
                  Baixar PDF
                </Button>
              </a>
            )}

            {/* Activity Timeline */}
            <div className="mt-8">
              <Separator className="mb-6" />
              <div className="flex items-center gap-2 mb-6">
                <History className="h-5 w-5 text-muted-foreground" />
                <h3 className="text-lg font-semibold text-card-foreground">Histórico do Pedido</h3>
              </div>
              <OrderActivityTimeline orderId={order.id} />
            </div>
          </div>
        ) : (
          <div className="py-8 text-center text-muted-foreground">
            Pedido não encontrado
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
