import { trpc } from "@/lib/trpc";
import { PageLayout } from "@/components/page-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CardSkeleton } from "@/components/ui/skeleton";
import {
  DollarSign,
  ShoppingCart,
  AlertTriangle,
  Clock,
  CheckCircle,
} from "lucide-react";
import { Link } from "react-router-dom";

export function DashboardPage() {
  // Use global smart retry config (retries server errors, not client errors)
  const ordersQuery = trpc.orders.list.useQuery({
    take: 100,
  });

  const stockQuery = trpc.stock.getStockLevels.useQuery({
    lowStockOnly: false,
    take: 100,
  });

  const lowStockItems = stockQuery.data?.items.filter((item) => item.isLowStock || item.isOutOfStock) || [];

  // Calculate metrics
  const totalOrders = ordersQuery.data?.total || 0;
  const todayOrders =
    ordersQuery.data?.items.filter((order) => {
      const today = new Date();
      const orderDate = new Date(order.createdAt);
      return orderDate.toDateString() === today.toDateString();
    }).length || 0;

  const pendingOrders =
    ordersQuery.data?.items.filter(
      (order) => order.status === "SENT" || order.status === "IN_SEPARATION"
    ).length || 0;

  const finalizedOrders =
    ordersQuery.data?.items.filter((order) => order.status === "FINALIZED").length || 0;

  // Calculate revenue (only finalized orders)
  const totalRevenue =
    ordersQuery.data?.items
      .filter((order) => order.status === "FINALIZED")
      .reduce((sum, order) => {
        const orderTotal = order.items.reduce((itemSum, item) => {
          if (item.finalPrice) {
            if (item.productOption.unitType === "WEIGHT" && item.actualWeight) {
              return itemSum + item.finalPrice * item.actualWeight;
            } else {
              return itemSum + item.finalPrice * item.requestedQty;
            }
          }
          return itemSum;
        }, 0);
        return sum + orderTotal;
      }, 0) || 0;

  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(cents / 100);
  };

  const recentOrders = ordersQuery.data?.items.slice(0, 5) || [];

  // Show error state if both queries failed
  const hasError = ordersQuery.isError || stockQuery.isError;

  // Traduzir status do pedido
  const translateStatus = (status: string) => {
    const statusMap: Record<string, string> = {
      DRAFT: "Rascunho",
      SENT: "Enviado",
      IN_SEPARATION: "Em Separação",
      FINALIZED: "Finalizado",
    };
    return statusMap[status] || status;
  };

  return (
    <PageLayout title="Painel">
      {hasError && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2 text-red-800">
            <AlertTriangle className="h-5 w-5" />
            <span className="font-medium">Falha ao carregar dados do painel</span>
          </div>
          <p className="text-sm text-red-600 mt-1">
            {ordersQuery.error?.message || stockQuery.error?.message || "Ocorreu um erro"}
          </p>
          <button
            onClick={() => {
              ordersQuery.refetch();
              stockQuery.refetch();
            }}
            className="mt-2 text-sm text-red-700 hover:text-red-900 underline"
          >
            Tentar novamente
          </button>
        </div>
      )}
      {/* Cards de Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Pedidos</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {ordersQuery.isLoading ? (
              <div className="h-8 bg-gray-200 rounded animate-pulse"></div>
            ) : (
              <>
                <div className="text-2xl font-bold">{totalOrders}</div>
                <p className="text-xs text-muted-foreground">
                  {todayOrders} hoje
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receita</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {ordersQuery.isLoading ? (
              <div className="h-8 bg-gray-200 rounded animate-pulse"></div>
            ) : (
              <>
                <div className="text-2xl font-bold">{formatPrice(totalRevenue)}</div>
                <p className="text-xs text-muted-foreground">
                  De {finalizedOrders} pedidos finalizados
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pedidos Pendentes</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {ordersQuery.isLoading ? (
              <div className="h-8 bg-gray-200 rounded animate-pulse"></div>
            ) : (
              <>
                <div className="text-2xl font-bold">{pendingOrders}</div>
                <p className="text-xs text-muted-foreground">
                  Aguardando processamento
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Estoque Baixo</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {stockQuery.isLoading ? (
              <div className="h-8 bg-gray-200 rounded animate-pulse"></div>
            ) : (
              <>
                <div className="text-2xl font-bold text-yellow-600">
                  {lowStockItems.length}
                </div>
                <p className="text-xs text-muted-foreground">
                  Requer atenção
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pedidos Recentes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Pedidos Recentes</span>
              <Link
                to="/chef/orders"
                className="text-sm text-primary hover:underline font-normal"
              >
                Ver todos
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {ordersQuery.isLoading ? (
              <div className="space-y-3">
                <CardSkeleton />
                <CardSkeleton />
              </div>
            ) : recentOrders.length === 0 ? (
              <p className="text-center text-gray-500 py-8">Nenhum pedido ainda</p>
            ) : (
              <div className="space-y-3">
                {recentOrders.map((order) => (
                  <Link
                    key={order.id}
                    to="/chef/orders"
                    className="block p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm">{order.orderNumber}</span>
                      <Badge
                        variant={
                          order.status === "FINALIZED"
                            ? "secondary"
                            : order.status === "SENT"
                            ? "default"
                            : "outline"
                        }
                        className="text-xs"
                      >
                        {translateStatus(order.status)}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-500">
                      {order.items.length} itens •{" "}
                      {new Date(order.createdAt).toLocaleDateString("pt-BR")}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Alertas de Estoque Baixo */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Alertas de Estoque</span>
              <Link
                to="/admin/stock"
                className="text-sm text-primary hover:underline font-normal"
              >
                Gerenciar estoque
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stockQuery.isLoading ? (
              <div className="space-y-3">
                <CardSkeleton />
                <CardSkeleton />
              </div>
            ) : lowStockItems.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-2" />
                <p className="text-gray-500">Estoque em dia!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {lowStockItems.slice(0, 5).map((item) => (
                  <div
                    key={item.optionId}
                    className="p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-start justify-between mb-1">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{item.productName}</p>
                        <p className="text-xs text-gray-500">{item.optionName}</p>
                      </div>
                      <Badge
                        variant={item.isOutOfStock ? "destructive" : "secondary"}
                        className="text-xs"
                      >
                        {item.isOutOfStock ? "Esgotado" : `${item.stockQuantity}`}
                      </Badge>
                    </div>
                    {!item.isOutOfStock && (
                      <p className="text-xs text-yellow-600">
                        Abaixo do mínimo ({item.lowStockThreshold})
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
}
