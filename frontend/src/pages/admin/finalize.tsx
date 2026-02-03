import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { trpc } from "@/lib/trpc";
import { useToast } from "@/components/toast";
import { OrderItemSkeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Download, ArrowLeft } from "lucide-react";

export function FinalizePage() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const orderQuery = trpc.orders.get.useQuery({ id: orderId! }, { enabled: !!orderId });
  const finalizeMutation = trpc.orders.finalize.useMutation();

  const handleFinalize = async () => {
    if (!orderId) return;

    setShowConfirmDialog(false);

    try {
      await finalizeMutation.mutateAsync({ id: orderId });
      showToast("Pedido finalizado com sucesso!", "success");
      orderQuery.refetch();
    } catch (error) {
      showToast(
        "Falha ao finalizar: " + (error instanceof Error ? error.message : "Erro desconhecido"),
        "error"
      );
    }
  };

  if (orderQuery.isLoading) {
    return (
      <div className="min-h-screen bg-muted">
        <nav className="bg-white shadow-sm sticky top-0 z-40">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <h1 className="text-xl md:text-2xl font-bold text-foreground">Finalizar Pedido</h1>
          </div>
        </nav>
        <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">
          <OrderItemSkeleton />
          <OrderItemSkeleton />
          <OrderItemSkeleton />
        </div>
      </div>
    );
  }

  if (orderQuery.error) {
    return <div className="p-8 text-center text-destructive">Erro ao carregar pedido</div>;
  }

  if (!orderQuery.data) {
    return <div className="p-8 text-center">Pedido não encontrado</div>;
  }

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
    <div className="min-h-screen bg-muted">
      {/* Sticky header */}
      <nav className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl md:text-2xl font-bold text-foreground">Finalizar Pedido</h1>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Order info */}
        <div className="bg-white rounded-xl shadow-sm p-5 md:p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-lg md:text-xl">Pedido: {order.orderNumber}</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Status:{" "}
                <span
                  className={`font-medium ${
                    isFinalized ? "text-success" : "text-primary"
                  }`}
                >
                  {order.status === "SENT" ? "Enviado" : order.status === "IN_SEPARATION" ? "Em Separação" : order.status === "FINALIZED" ? "Finalizado" : order.status}
                </span>
              </p>
            </div>
            {isFinalized && (
              <Badge className="bg-success/10 text-success hover:bg-green-100">
                Finalizado
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Cliente: <span className="font-medium">{order.customer.account.name}</span>
          </p>
        </div>

        {/* Warning for unweighed items */}
        {!allWeighed && !isFinalized && (
          <div className="bg-warning/10 border-2 border-warning/20 rounded-xl p-4 mb-6 flex items-start gap-3">
            <svg className="w-6 h-6 text-warning flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            <div className="flex-1">
              <p className="text-sm font-medium text-warning">
                Nem todos os itens por peso foram pesados
              </p>
              <p className="text-xs text-warning mt-1">
                Por favor, complete a pesagem antes de finalizar este pedido
              </p>
            </div>
          </div>
        )}

        {/* Order summary */}
        <div className="bg-white rounded-xl shadow-sm p-5 md:p-6 mb-6">
          <h3 className="font-semibold text-lg mb-4">Resumo do Pedido</h3>

          <div className="space-y-3">
            {order.items.map((item) => {
              let itemTotal = 0;
              if (item.productOption.unitType === "FIXED" && item.finalPrice) {
                itemTotal = item.finalPrice;
              } else if (item.actualWeight && item.finalPrice) {
                itemTotal = item.actualWeight * item.finalPrice;
              }

              const isWeighed = item.productOption.unitType === "FIXED" || item.actualWeight !== null;

              return (
                <div
                  key={item.id}
                  className={`flex flex-col sm:flex-row sm:justify-between gap-2 p-3 rounded-lg ${
                    !isWeighed ? "bg-yellow-50" : ""
                  }`}
                >
                  <div className="flex-1">
                    <p className="font-medium text-sm">
                      {item.productOption.product.name} - {item.productOption.name}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {item.productOption.unitType === "FIXED"
                        ? `Qtd: ${item.requestedQty}`
                        : item.actualWeight
                        ? `Peso: ${item.actualWeight} kg`
                        : "⚠️ Ainda não pesado"}
                    </p>
                  </div>
                  <span className="font-semibold text-primary text-base">
                    R$ {(itemTotal / 100).toFixed(2)}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="border-t-2 mt-6 pt-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Itens Fixos:</span>
              <span className="font-medium">R$ {(fixedTotal / 100).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Itens por Peso:</span>
              <span className="font-medium">R$ {(weightTotal / 100).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xl md:text-2xl font-bold text-primary pt-2 border-t">
              <span>TOTAL:</span>
              <span>R$ {(grandTotal / 100).toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="space-y-4">
          {!isFinalized ? (
            <Button
              onClick={() => setShowConfirmDialog(true)}
              disabled={!allWeighed || finalizeMutation.isPending}
              className="w-full px-6 py-7 rounded-xl text-lg md:text-xl font-semibold shadow-lg"
              size="lg"
            >
              {finalizeMutation.isPending
                ? "Finalizando..."
                : allWeighed
                ? "Finalizar Pedido"
                : "Complete a Pesagem Primeiro"}
            </Button>
          ) : (
            <Button
              asChild
              className="w-full px-6 py-7 rounded-xl text-lg md:text-xl font-semibold shadow-lg bg-success hover:bg-success"
              size="lg"
            >
              <a
                href={`/api/delivery-note/${order.id}.pdf`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Download className="h-6 w-6" />
                Baixar PDF
              </a>
            </Button>
          )}
        </div>
      </div>

      {/* Confirmation dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-warning/10 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-warning" />
              </div>
              <DialogTitle className="text-xl">Confirmar Finalização</DialogTitle>
            </div>
            <DialogDescription className="text-base">
              Tem certeza que deseja finalizar este pedido? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-3 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => setShowConfirmDialog(false)}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleFinalize}
              className="flex-1"
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
