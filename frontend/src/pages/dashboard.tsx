import { trpc } from "@/lib/trpc";
import { PageLayout } from "@/components/page-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardSkeleton } from "@/components/ui/skeleton";
import {
  DollarSign,
  ShoppingCart,
  AlertTriangle,
  Clock,
  CheckCircle,
  Building2,
  Package,
  ShoppingBag,
  ClipboardList,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { useEffect } from "react";
import { toast } from "sonner";

export function DashboardPage() {
  const { isPlatformAdmin, isTenantAdmin, isAccountUser, session } = useAuth();

  // Check context availability
  const hasTenantContext = !!localStorage.getItem("freshflow:tenantId");
  const hasAccountContext = !!localStorage.getItem("freshflow:accountId");

  // Admin orders query - uses tenantAdminProcedure (needs x-tenant-id)
  const adminOrdersQuery = trpc.orders.adminList.useQuery(
    { take: 100 },
    { enabled: hasTenantContext && isTenantAdmin }
  );

  // Account orders query - uses accountProcedure (needs x-account-id)
  const accountOrdersQuery = trpc.orders.list.useQuery(
    { take: 100 },
    { enabled: hasAccountContext && isAccountUser && !isTenantAdmin }
  );

  // Use the appropriate query based on role
  const ordersQuery = isTenantAdmin ? adminOrdersQuery : accountOrdersQuery;

  // Stock query only for tenant admins
  const stockQuery = trpc.stock.getStockLevels.useQuery(
    { lowStockOnly: false, take: 100 },
    { enabled: hasTenantContext && isTenantAdmin }
  );

  const lowStockItems = stockQuery.data?.items.filter((item) => item.isLowStock || item.isOutOfStock) || [];
  const outOfStockItems = lowStockItems.filter((item) => item.isOutOfStock);

  // Show toast notification for out of stock items (only once per session)
  useEffect(() => {
    if (isTenantAdmin && outOfStockItems.length > 0 && !sessionStorage.getItem("freshflow:low-stock-alert-shown")) {
      toast.warning(`${outOfStockItems.length} produto${outOfStockItems.length > 1 ? "s" : ""} esgotado${outOfStockItems.length > 1 ? "s" : ""}`, {
        description: "Verifique o estoque para evitar pedidos não atendidos",
        duration: 5000,
      });
      sessionStorage.setItem("freshflow:low-stock-alert-shown", "true");
    }
  }, [isTenantAdmin, outOfStockItems.length]);

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

  // Calculate revenue (only finalized orders) - admin only
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

  // Show error state if queries failed (check appropriate context based on role)
  const hasError = ordersQuery.isError && (
    (isTenantAdmin && hasTenantContext) ||
    (isAccountUser && hasAccountContext)
  );

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

  // Platform admin without tenant context - show tenant selection prompt
  if (!hasTenantContext && isPlatformAdmin) {
    return (
      <PageLayout title="Painel">
        <div className="flex flex-col items-center justify-center py-12">
          <Building2 className="h-16 w-16 text-gray-400 mb-4" />
          <h2 className="text-xl font-semibold text-foreground mb-2">
            Selecione um Tenant
          </h2>
          <p className="text-muted-foreground text-center max-w-md mb-6">
            Como administrador da plataforma, você precisa selecionar um tenant
            para visualizar os dados do painel. Use o seletor no menu de navegação.
          </p>
          {session?.memberships && session.memberships.length > 0 && (
            <div className="text-sm text-muted-foreground">
              Você tem acesso a {session.memberships.length} membership(s).
              Use o Context Switcher na barra de navegação.
            </div>
          )}
        </div>
      </PageLayout>
    );
  }

  // Account user without account context - show loading/setup message
  if (isAccountUser && !hasAccountContext) {
    return (
      <PageLayout title="Meu Painel">
        <div className="flex flex-col items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
          <h2 className="text-xl font-semibold text-foreground mb-2">
            Configurando sua conta...
          </h2>
          <p className="text-muted-foreground text-center max-w-md">
            Aguarde enquanto configuramos seu acesso.
          </p>
        </div>
      </PageLayout>
    );
  }

  // TENANT ADMIN DASHBOARD
  if (isTenantAdmin) {
    return (
      <PageLayout title="Painel Administrativo">
        {hasError && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2 text-red-800">
              <AlertTriangle className="h-5 w-5" />
              <span className="font-medium">Falha ao carregar dados do painel</span>
            </div>
            <p className="text-sm text-red-600 mt-1">
              {ordersQuery.error?.message || "Ocorreu um erro"}
            </p>
            <button
              onClick={() => ordersQuery.refetch()}
              className="mt-2 text-sm text-red-700 hover:text-red-900 underline"
            >
              Tentar novamente
            </button>
          </div>
        )}

        {/* Low Stock Alert Banner */}
        {!stockQuery.isLoading && lowStockItems.length > 0 && (
          <div className="mb-6 p-4 bg-warning/10 border-l-4 border-warning rounded-lg animate-fade-in">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-warning mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="font-semibold text-warning mb-1">
                  Alerta de Estoque Baixo
                </h3>
                <p className="text-sm text-warning mb-3">
                  {lowStockItems.length} {lowStockItems.length === 1 ? "produto está" : "produtos estão"} com estoque baixo ou esgotado.
                  {lowStockItems.filter(item => item.isOutOfStock).length > 0 && (
                    <span className="font-medium">
                      {" "}({lowStockItems.filter(item => item.isOutOfStock).length} esgotado{lowStockItems.filter(item => item.isOutOfStock).length > 1 ? "s" : ""})
                    </span>
                  )}
                </p>
                <Link to="/admin/stock">
                  <Button variant="outline" size="sm" className="bg-card hover:bg-warning/20 border-warning">
                    <Package className="h-4 w-4 mr-2" />
                    Gerenciar Estoque
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Admin Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Pedidos</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {ordersQuery.isLoading ? (
                <div className="h-8 bg-muted rounded animate-pulse"></div>
              ) : (
                <>
                  <div className="text-2xl font-bold">{totalOrders}</div>
                  <p className="text-xs text-muted-foreground">{todayOrders} hoje</p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Receita Total</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {ordersQuery.isLoading ? (
                <div className="h-8 bg-muted rounded animate-pulse"></div>
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
                <div className="h-8 bg-muted rounded animate-pulse"></div>
              ) : (
                <>
                  <div className="text-2xl font-bold">{pendingOrders}</div>
                  <p className="text-xs text-muted-foreground">Aguardando processamento</p>
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
                  <p className="text-xs text-muted-foreground">Requer atenção</p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Orders for Admin */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Pedidos Recentes</span>
                <Link
                  to="/admin/orders"
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
                <p className="text-center text-muted-foreground py-8">Nenhum pedido ainda</p>
              ) : (
                <div className="space-y-3">
                  {recentOrders.map((order) => (
                    <Link
                      key={order.id}
                      to={`/admin/weighing/${order.id}`}
                      className="block p-3 bg-muted rounded-lg hover:bg-accent/10 transition"
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
                      <p className="text-xs text-muted-foreground">
                        {order.customer?.account?.name || "Cliente"} • {order.items.length} itens •{" "}
                        {new Date(order.createdAt).toLocaleDateString("pt-BR")}
                      </p>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Stock Alerts */}
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
                  <CheckCircle className="h-12 w-12 text-success mx-auto mb-2" />
                  <p className="text-muted-foreground">Estoque em dia!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {lowStockItems.slice(0, 5).map((item) => (
                    <div key={item.optionId} className="p-3 bg-muted rounded-lg">
                      <div className="flex items-start justify-between mb-1">
                        <div className="flex-1">
                          <p className="font-medium text-sm">{item.productName}</p>
                          <p className="text-xs text-muted-foreground">{item.optionName}</p>
                        </div>
                        <Badge
                          variant={item.isOutOfStock ? "destructive" : "secondary"}
                          className="text-xs"
                        >
                          {item.isOutOfStock ? "Esgotado" : `${item.stockQuantity}`}
                        </Badge>
                      </div>
                      {!item.isOutOfStock && (
                        <p className="text-xs text-warning">
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

  // ACCOUNT USER DASHBOARD (Chef/Buyer)
  return (
    <PageLayout title="Meu Painel">
      {hasError && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2 text-red-800">
            <AlertTriangle className="h-5 w-5" />
            <span className="font-medium">Falha ao carregar dados</span>
          </div>
          <p className="text-sm text-destructive mt-1">
            {ordersQuery.error?.message || "Ocorreu um erro"}
          </p>
          <button
            onClick={() => ordersQuery.refetch()}
            className="mt-2 text-sm text-destructive hover:text-destructive/80 underline"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* Quick Actions for Account Users */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Link to="/chef/catalog">
          <Card className="hover:shadow-md transition cursor-pointer h-full">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="p-3 bg-primary/10 rounded-full">
                <ShoppingBag className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Ver Catálogo</h3>
                <p className="text-sm text-muted-foreground">
                  Navegue pelos produtos disponíveis
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link to="/chef/orders">
          <Card className="hover:shadow-md transition cursor-pointer h-full">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="p-3 bg-primary/10 rounded-full">
                <ClipboardList className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Meus Pedidos</h3>
                <p className="text-sm text-muted-foreground">
                  Acompanhe seus pedidos
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Order Metrics for Account Users */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Meus Pedidos</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {ordersQuery.isLoading ? (
              <div className="h-8 bg-gray-200 rounded animate-pulse"></div>
            ) : (
              <>
                <div className="text-2xl font-bold">{totalOrders}</div>
                <p className="text-xs text-muted-foreground">{todayOrders} hoje</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Em Processamento</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {ordersQuery.isLoading ? (
              <div className="h-8 bg-gray-200 rounded animate-pulse"></div>
            ) : (
              <>
                <div className="text-2xl font-bold">{pendingOrders}</div>
                <p className="text-xs text-muted-foreground">Aguardando</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Finalizados</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {ordersQuery.isLoading ? (
              <div className="h-8 bg-gray-200 rounded animate-pulse"></div>
            ) : (
              <>
                <div className="text-2xl font-bold text-green-600">{finalizedOrders}</div>
                <p className="text-xs text-muted-foreground">Concluídos</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Orders for Account Users */}
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
            <div className="text-center py-8">
              <Package className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground mb-4">Você ainda não fez nenhum pedido</p>
              <Link to="/chef/catalog">
                <Button>Fazer Primeiro Pedido</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {recentOrders.map((order) => (
                <Link
                  key={order.id}
                  to="/chef/orders"
                  className="block p-3 bg-muted rounded-lg hover:bg-accent/10 transition"
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
                  <p className="text-xs text-muted-foreground">
                    {order.items.length} itens •{" "}
                    {new Date(order.createdAt).toLocaleDateString("pt-BR")}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </PageLayout>
  );
}
