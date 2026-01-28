import { useState } from "react";
import { useParams } from "react-router-dom";
import { trpc } from "@/lib/trpc";
import { useOffline } from "@/hooks/use-offline";
import { queueWeighing } from "@/lib/offline";
import { useToast } from "@/components/toast";
import { OrderItemSkeleton } from "@/components/ui/skeleton";

export function WeighingPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const { isOnline, pending } = useOffline();
  const { showToast } = useToast();

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
      showToast("Por favor, insira um peso válido", "warning");
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
        showToast("Peso salvo com sucesso!", "success");
        orderQuery.refetch();
        // Clear the inputs for this item
        setWeights((prev) => ({ ...prev, [orderItemId]: 0 }));
        setPrices((prev) => ({ ...prev, [orderItemId]: 0 }));
        setPersistFlags((prev) => ({ ...prev, [orderItemId]: false }));
      } else {
        await queueWeighing({
          orderItemId,
          actualWeight,
          finalPrice,
          persistPrice,
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
      <div className="min-h-screen bg-gray-50">
        <nav className="bg-white shadow-sm sticky top-0 z-40">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <h1 className="text-xl md:text-2xl font-bold text-gray-900">Estação de Pesagem</h1>
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
  if (orderQuery.error) return <div className="p-8 text-center text-red-600">Erro ao carregar pedido</div>;
  if (!orderQuery.data) return <div className="p-8 text-center">Pedido não encontrado</div>;

  const order = orderQuery.data;
  const weightItems = order.items.filter((item) => item.productOption.unitType === "WEIGHT");

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sticky header with status indicators */}
      <nav className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
            <h1 className="text-xl md:text-2xl font-bold text-gray-900">Estação de Pesagem</h1>
            <div className="flex items-center gap-3">
              {!isOnline && (
                <span className="flex items-center gap-2 text-red-600 text-sm font-medium px-3 py-2 bg-red-50 rounded-lg">
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
        <div className="bg-white rounded-xl shadow-sm p-5 md:p-6 mb-6">
          <h2 className="font-semibold text-lg md:text-xl mb-2">Pedido: {order.orderNumber}</h2>
          <p className="text-sm text-gray-600">
            Status: <span className="font-medium text-primary">{order.status === "SENT" ? "Enviado" : order.status === "IN_SEPARATION" ? "Em Separação" : order.status === "FINALIZED" ? "Finalizado" : order.status}</span>
          </p>
          <p className="text-sm text-gray-600 mt-1">
            Itens para pesar: <span className="font-medium">{weightItems.length}</span>
          </p>
        </div>

        {/* Weight items */}
        {weightItems.length === 0 ? (
          <div className="text-center py-12 text-gray-600">
            <p>Nenhum item por peso neste pedido</p>
          </div>
        ) : (
          <div className="space-y-5">
            {weightItems.map((item) => (
              <div key={item.id} className="bg-white rounded-xl shadow-sm p-5 md:p-6">
                <div className="mb-4">
                  <h3 className="font-semibold text-lg md:text-xl">{item.productOption.product.name}</h3>
                  <p className="text-sm text-gray-600 mt-1">{item.productOption.name}</p>
                  <p className="text-sm text-gray-600 mt-1">
                    Solicitado: <span className="font-medium text-primary">{item.requestedQty} kg</span>
                  </p>
                </div>

                {item.actualWeight ? (
                  <div className="p-5 bg-green-50 rounded-xl border-2 border-green-200">
                    <div className="flex items-center gap-2 text-green-800 font-semibold text-lg mb-2">
                      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      Pesado: {item.actualWeight} kg
                    </div>
                    <p className="text-sm text-green-700">
                      Preço: R$ {item.finalPrice ? (item.finalPrice / 100).toFixed(2) : "N/D"} /kg
                    </p>
                  </div>
                ) : (
                  <div className="space-y-5">
                    <div>
                      <label htmlFor={`weight-${item.id}`} className="block text-base font-medium text-gray-700 mb-2">
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
                        className="block w-full px-5 py-4 text-xl border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent"
                        placeholder="0.00"
                      />
                    </div>

                    <div>
                      <label htmlFor={`price-${item.id}`} className="block text-base font-medium text-gray-700 mb-2">
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
                        className="block w-full px-5 py-4 text-xl border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent"
                        placeholder="Opcional"
                      />
                    </div>

                    <label className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors">
                      <input
                        type="checkbox"
                        id={`persist-${item.id}`}
                        checked={persistFlags[item.id] || false}
                        onChange={(e) =>
                          setPersistFlags({ ...persistFlags, [item.id]: e.target.checked })
                        }
                        className="h-6 w-6 text-primary focus:ring-primary border-gray-300 rounded mt-0.5"
                      />
                      <span className="text-base text-gray-700 flex-1">
                        Salvar este preço para este cliente (pedidos futuros)
                      </span>
                    </label>

                    <button
                      onClick={() => handleWeigh(item.id)}
                      disabled={weighMutation.isPending}
                      className="w-full bg-primary text-white px-6 py-5 rounded-xl hover:bg-primary/90 text-lg md:text-xl font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
                    >
                      {weighMutation.isPending ? "Salvando..." : "Salvar Peso"}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
