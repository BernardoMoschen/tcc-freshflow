import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { trpc } from "@/lib/trpc";
import { useOffline } from "@/hooks/use-offline";
import { queueWeighing } from "@/lib/offline";
import { useToast } from "@/components/toast";
import { OrderItemSkeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  CheckCircle,
  Scale,
  X,
  AlertCircle,
  Info,
} from "lucide-react";

export function WeighingPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { isOnline, pending } = useOffline();
  const { showToast } = useToast();

  const orderQuery = trpc.orders.get.useQuery({ id: orderId! }, { enabled: !!orderId });
  const weighMutation = trpc.orders.weigh.useMutation();

  const [weights, setWeights] = useState<Record<string, number>>({});
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [persistFlags, setPersistFlags] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [photos, setPhotos] = useState<Record<string, string>>({});

  // Calculate weight variance and warnings
  const getWeightWarning = (requestedQty: number, actualWeight: number) => {
    if (!actualWeight || actualWeight <= 0) return null;

    const variance = ((actualWeight - requestedQty) / requestedQty) * 100;
    const absoluteVariance = Math.abs(variance);

    if (actualWeight === 0) {
      return {
        type: "error" as const,
        icon: AlertTriangle,
        message: "Peso não pode ser zero",
        color: "bg-destructive/10 border-destructive/30 text-destructive",
      };
    }

    if (actualWeight < 0) {
      return {
        type: "error" as const,
        icon: AlertTriangle,
        message: "Peso não pode ser negativo",
        color: "bg-destructive/10 border-destructive/30 text-destructive",
      };
    }

    if (actualWeight > 999) {
      return {
        type: "error" as const,
        icon: AlertTriangle,
        message: "Peso parece muito alto. Verifique se está em kg.",
        color: "bg-destructive/10 border-destructive/30 text-destructive",
      };
    }

    // Critical variance (>50% difference)
    if (absoluteVariance > 50) {
      return {
        type: "critical" as const,
        icon: AlertTriangle,
        message: `ATENÇÃO: Diferença de ${variance.toFixed(1)}% do solicitado!`,
        details: variance > 0
          ? `Peso ${variance.toFixed(1)}% MAIOR que o solicitado`
          : `Peso ${Math.abs(variance).toFixed(1)}% MENOR que o solicitado`,
        color: "bg-destructive/10 border-destructive/30 text-destructive",
        requiresNote: true,
      };
    }

    // High variance (25-50% difference)
    if (absoluteVariance > 25) {
      return {
        type: "warning" as const,
        icon: AlertCircle,
        message: `Diferença de ${variance.toFixed(1)}% do solicitado`,
        details: variance > 0
          ? `${variance.toFixed(1)}% a mais`
          : `${Math.abs(variance).toFixed(1)}% a menos`,
        color: "bg-warning/10 border-warning/30 text-warning",
        requiresNote: true,
      };
    }

    // Moderate variance (10-25% difference)
    if (absoluteVariance > 10) {
      return {
        type: "info" as const,
        icon: Info,
        message: `Diferença de ${variance.toFixed(1)}%`,
        details: `${Math.abs(actualWeight - requestedQty).toFixed(2)}kg ${variance > 0 ? "a mais" : "a menos"}`,
        color: "bg-primary/10 border-primary/30 text-primary",
      };
    }

    // Small variance (< 10%) - OK
    if (absoluteVariance <= 10) {
      return {
        type: "ok" as const,
        icon: CheckCircle,
        message: "Peso dentro do esperado",
        details: `Variação: ${variance > 0 ? "+" : ""}${variance.toFixed(1)}%`,
        color: "bg-success/10 border-success/30 text-success",
      };
    }

    return null;
  };

  const handlePhotoCapture = (itemId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Convert to base64 for preview and storage
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotos({ ...photos, [itemId]: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const removePhoto = (itemId: string) => {
    const newPhotos = { ...photos };
    delete newPhotos[itemId];
    setPhotos(newPhotos);
  };

  const handleWeigh = async (orderItemId: string, requestedQty: number) => {
    const actualWeight = weights[orderItemId];
    const finalPrice = prices[orderItemId];
    const persistPrice = persistFlags[orderItemId] || false;
    const itemNotes = notes[orderItemId];
    const photoUrl = photos[orderItemId];

    if (!actualWeight || actualWeight <= 0) {
      showToast("Por favor, insira um peso válido", "warning");
      return;
    }

    const warning = getWeightWarning(requestedQty, actualWeight);

    // Block if critical errors
    if (warning?.type === "error") {
      showToast(warning.message, "error");
      return;
    }

    // Require note for large variance
    if (warning?.requiresNote && !itemNotes?.trim()) {
      showToast("Por favor, adicione uma observação explicando a diferença de peso", "warning");
      return;
    }

    // Require photo for large variance
    if (warning?.type === "critical" && !photoUrl) {
      showToast("Por favor, tire uma foto da balança para comprovar o peso", "warning");
      return;
    }

    try {
      if (isOnline) {
        await weighMutation.mutateAsync({
          orderItemId,
          actualWeight,
          finalPrice,
          persistPrice,
          notes: itemNotes,
          photoUrl,
        });
        showToast("Peso salvo com sucesso!", "success");
        orderQuery.refetch();
        // Clear the inputs for this item
        setWeights((prev) => ({ ...prev, [orderItemId]: 0 }));
        setPrices((prev) => ({ ...prev, [orderItemId]: 0 }));
        setPersistFlags((prev) => ({ ...prev, [orderItemId]: false }));
        setNotes((prev) => ({ ...prev, [orderItemId]: "" }));
        setPhotos((prev) => {
          const newPhotos = { ...prev };
          delete newPhotos[orderItemId];
          return newPhotos;
        });
      } else {
        await queueWeighing({
          orderItemId,
          actualWeight,
          finalPrice,
          persistPrice,
          notes: itemNotes,
          photoUrl,
        });
        showToast("Peso na fila para sincronização quando online", "info");
      }
    } catch (error) {
      showToast(
        "Falha ao salvar peso: " + (error instanceof Error ? error.message : "Erro desconhecido"),
        "error"
      );
    }
  };

  if (orderQuery.isLoading) {
    return (
      <div className="min-h-screen bg-muted">
        <nav className="bg-card shadow-sm sticky top-0 z-40">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <h1 className="text-xl md:text-2xl font-bold text-foreground">Estação de Pesagem</h1>
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
  if (orderQuery.error) return <div className="p-8 text-center text-destructive">Erro ao carregar pedido</div>;
  if (!orderQuery.data) return <div className="p-8 text-center">Pedido não encontrado</div>;

  const order = orderQuery.data;
  const weightItems = order.items.filter((item: any) => item.productOption.unitType === "WEIGHT");

  // Validate order status - only allow weighing for IN_SEPARATION status
  if (order.status !== "IN_SEPARATION") {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-card rounded-xl shadow-lg p-8 text-center">
          <AlertTriangle className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-foreground mb-2">
            Pesagem Não Disponível
          </h2>
          <p className="text-muted-foreground mb-6">
            {order.status === "SENT" && (
              <>
                Este pedido está com status <strong>"Enviado"</strong>.
                <br />
                Mova o pedido para <strong>"Em Separação"</strong> antes de pesar.
              </>
            )}
            {order.status === "FINALIZED" && (
              <>
                Este pedido já foi <strong>finalizado</strong>.
                <br />
                Não é possível pesar itens de pedidos finalizados.
              </>
            )}
            {order.status === "DRAFT" && (
              <>
                Este pedido ainda é um <strong>rascunho</strong>.
                <br />
                Aguarde o cliente enviar o pedido.
              </>
            )}
          </p>
          <div className="space-y-3">
            <Button
              onClick={() => navigate("/admin/orders")}
              className="w-full"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar para Pedidos
            </Button>
            {order.status === "SENT" && (
              <p className="text-sm text-muted-foreground">
                Para habilitar pesagem, mova o pedido para "Em Separação" na lista de pedidos
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted">
      {/* Sticky header with status indicators */}
      <nav className="bg-card shadow-sm sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/admin/orders")}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar
              </Button>
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-foreground flex items-center gap-2">
                  <Scale className="h-6 w-6" />
                  Estação de Pesagem
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {!isOnline && (
                <span className="flex items-center gap-2 text-destructive text-sm font-medium px-3 py-2 bg-red-50 rounded-lg">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  Offline
                </span>
              )}
              {pending > 0 && (
                <span className="bg-yellow-100 text-yellow-800 px-3 py-2 rounded-lg text-sm font-medium">
                  {pending} pendente(s)
                </span>
              )}
              {isOnline && pending === 0 && (
                <span className="flex items-center gap-2 text-green-600 text-sm font-medium">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Online
                </span>
              )}
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Order info */}
        <div className="bg-card rounded-xl shadow-sm p-5 md:p-6 mb-6">
          <h2 className="font-semibold text-lg md:text-xl mb-2">Pedido: {order.orderNumber}</h2>
          <p className="text-sm text-muted-foreground">
            Status: <span className="font-medium text-primary">{order.status === "SENT" ? "Enviado" : order.status === "IN_SEPARATION" ? "Em Separação" : order.status === "FINALIZED" ? "Finalizado" : order.status}</span>
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Itens para pesar: <span className="font-medium">{weightItems.length}</span>
          </p>
        </div>

        {/* Weight items */}
        {weightItems.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground bg-card rounded-xl shadow-sm">
            <Scale className="h-16 w-16 mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-medium">Nenhum item por peso neste pedido</p>
            <p className="text-sm mt-2">Todos os itens são de quantidade fixa</p>
          </div>
        ) : (
          <div className="space-y-5">
            {weightItems.map((item: any) => {
              const currentWeight = weights[item.id];
              const warning = currentWeight ? getWeightWarning(item.requestedQty, currentWeight) : null;

              return (
                <div key={item.id} className="bg-card rounded-xl shadow-sm p-5 md:p-6">
                  <div className="mb-4">
                    <h3 className="font-semibold text-lg md:text-xl">{item.productOption.product.name}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{item.productOption.name}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Solicitado: <span className="font-medium text-primary">{item.requestedQty} kg</span>
                    </p>
                  </div>

                  {item.actualWeight ? (
                    <div className="p-5 bg-success/10 rounded-xl border-2 border-success/20">
                      <div className="flex items-center gap-2 text-success font-semibold text-lg mb-2">
                        <CheckCircle className="w-6 h-6" />
                        Pesado: {item.actualWeight} kg
                      </div>
                      <p className="text-sm text-success">
                        Preço: R$ {item.finalPrice ? (item.finalPrice / 100).toFixed(2) : "N/D"} /kg
                      </p>
                      {item.notes && (
                        <div className="mt-3 pt-3 border-t border-success/20">
                          <p className="text-xs text-success font-medium">Observações:</p>
                          <p className="text-sm text-success mt-1">{item.notes}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-5">
                      {/* Weight variance warning */}
                      {warning && (
                        <div className={`p-4 rounded-xl border-2 ${warning.color}`}>
                          <div className="flex items-start gap-3">
                            <warning.icon className="h-5 w-5 flex-shrink-0 mt-0.5" />
                            <div className="flex-1">
                              <p className="font-semibold">{warning.message}</p>
                              {warning.details && (
                                <p className="text-sm mt-1">{warning.details}</p>
                              )}
                              {warning.requiresNote && (
                                <p className="text-sm mt-2 font-medium">
                                  ⚠️ {warning.type === "critical" ? "Foto e observação obrigatórias" : "Observação recomendada"}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Weight input */}
                      <div>
                        <label htmlFor={`weight-${item.id}`} className="block text-base font-medium text-card-foreground mb-2">
                          Peso Real (kg) *
                        </label>
                        <input
                          id={`weight-${item.id}`}
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          min="0"
                          value={weights[item.id] || ""}
                          onChange={(e) =>
                            setWeights({ ...weights, [item.id]: parseFloat(e.target.value) })
                          }
                          className="block w-full px-5 py-4 text-xl border-2 border-border rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent"
                          placeholder="0.00"
                        />
                      </div>

                      {/* Photo upload */}
                      <div>
                        <label className="block text-base font-medium text-card-foreground mb-2">
                          Foto da Balança {warning?.type === "critical" && <span className="text-destructive">*</span>}
                        </label>
                        {photos[item.id] ? (
                          <div className="relative">
                            <img
                              src={photos[item.id]}
                              alt="Foto da balança"
                              className="w-full h-48 object-cover rounded-xl border-2 border-border"
                            />
                            <button
                              onClick={() => removePhoto(item.id)}
                              className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full hover:bg-red-600"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-border border-dashed rounded-xl cursor-pointer bg-muted hover:bg-accent/20">
                            <Camera className="h-8 w-8 text-muted-foreground mb-2" />
                            <p className="text-sm text-muted-foreground">Tirar foto ou selecionar</p>
                            <input
                              type="file"
                              accept="image/*"
                              capture="environment"
                              className="hidden"
                              onChange={(e) => handlePhotoCapture(item.id, e)}
                            />
                          </label>
                        )}
                      </div>

                      {/* Notes */}
                      <div>
                        <label htmlFor={`notes-${item.id}`} className="block text-base font-medium text-card-foreground mb-2">
                          Observações {warning?.requiresNote && <span className="text-destructive">*</span>}
                        </label>
                        <Textarea
                          id={`notes-${item.id}`}
                          value={notes[item.id] || ""}
                          onChange={(e) => setNotes({ ...notes, [item.id]: e.target.value })}
                          placeholder="Ex: Cliente pediu substituição, produto com qualidade superior, etc."
                          className="resize-none"
                          rows={3}
                          maxLength={500}
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          {(notes[item.id]?.length || 0)}/500 caracteres
                        </p>
                      </div>

                      {/* Price override */}
                      <div>
                        <label htmlFor={`price-${item.id}`} className="block text-base font-medium text-card-foreground mb-2">
                          Substituir Preço (R$ por kg)
                        </label>
                        <input
                          id={`price-${item.id}`}
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          min="0"
                          value={prices[item.id] ? (prices[item.id] / 100).toFixed(2) : ""}
                          onChange={(e) =>
                            setPrices({ ...prices, [item.id]: parseFloat(e.target.value || "0") * 100 })
                          }
                          className="block w-full px-5 py-4 text-xl border-2 border-border rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent"
                          placeholder="Opcional"
                        />
                      </div>

                      <label className="flex items-start gap-3 p-4 bg-muted rounded-xl cursor-pointer hover:bg-accent/20 transition-colors">
                        <input
                          type="checkbox"
                          id={`persist-${item.id}`}
                          checked={persistFlags[item.id] || false}
                          onChange={(e) =>
                            setPersistFlags({ ...persistFlags, [item.id]: e.target.checked })
                          }
                          className="h-6 w-6 text-primary focus:ring-primary border-border rounded mt-0.5"
                        />
                        <span className="text-base text-card-foreground flex-1">
                          Salvar este preço para este cliente (pedidos futuros)
                        </span>
                      </label>

                      <Button
                        onClick={() => handleWeigh(item.id, item.requestedQty)}
                        disabled={weighMutation.isPending}
                        className="w-full text-lg md:text-xl py-6"
                      >
                        {weighMutation.isPending ? "Salvando..." : "Salvar Peso"}
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
