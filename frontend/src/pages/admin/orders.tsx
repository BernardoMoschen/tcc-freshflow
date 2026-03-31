import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { trpc } from "@/lib/trpc";
import { PageLayout } from "@/components/page-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CardSkeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Eye,
  Scale,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  FileDown,
  Download,
  Wifi,
  WifiOff,
  AlertTriangle,
  Package,
  Clock,
  ShoppingCart,
  Calendar,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { useOrderEvents, OrderEvent, OrderEventType } from "@/hooks/use-order-events";

// Auto-refresh interval in milliseconds (15 seconds for admin - more frequent)
const AUTO_REFRESH_INTERVAL = 15 * 1000;

const PAGE_SIZE = 20;

export function AdminOrdersPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(0);
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<string>("");

  const utils = trpc.useUtils();

  // Ensure tenant context exists before querying
  const hasTenantContext = !!localStorage.getItem("freshflow:tenantId");

  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isAutoRefreshEnabled, setIsAutoRefreshEnabled] = useState(true);

  const ordersQuery = trpc.orders.adminList.useQuery(
    {
      status: statusFilter === "all" ? undefined : (statusFilter as any),
      search: searchQuery || undefined,
      skip: currentPage * PAGE_SIZE,
      take: PAGE_SIZE,
    },
    {
      enabled: hasTenantContext,
      refetchInterval: isAutoRefreshEnabled ? AUTO_REFRESH_INTERVAL : false,
      refetchIntervalInBackground: false,
    }
  );

  // Track last updated time
  useEffect(() => {
    if (ordersQuery.dataUpdatedAt) {
      setLastUpdated(new Date(ordersQuery.dataUpdatedAt));
    }
  }, [ordersQuery.dataUpdatedAt]);

  // Manual refresh handler
  const handleManualRefresh = useCallback(() => {
    void ordersQuery.refetch();
    toast.success("Pedidos atualizados");
  }, [ordersQuery]);

  // Real-time order updates via SSE
  const handleOrderEvent = useCallback((event: OrderEvent) => {
    // Show toast notification for important events
    if (event.type === OrderEventType.CREATED) {
      toast.info("Novo pedido recebido", {
        description: `Pedido criado`,
      });
    } else if (event.type === OrderEventType.FINALIZED) {
      toast.success("Pedido finalizado", {
        description: `Pedido finalizado com sucesso`,
      });
    }

    // Invalidate queries to refetch data
    void utils.orders.adminList.invalidate();
  }, [utils]);

  const { isConnected } = useOrderEvents(handleOrderEvent, hasTenantContext);

  // Format relative time
  const getRelativeTime = (date: Date) => {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return "agora mesmo";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `há ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    return `há ${hours}h`;
  };

  const bulkUpdateMutation = trpc.orders.bulkUpdateStatus.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.updated} pedido(s) atualizado(s)`);
      setSelectedOrders(new Set());
      void utils.orders.adminList.invalidate();
    },
    onError: (error) => {
      toast.error("Falha ao atualizar pedidos", { description: error.message });
    },
  });

  const exportQuery = trpc.orders.exportCsv.useQuery(
    {
      orderIds: selectedOrders.size > 0 ? Array.from(selectedOrders) : undefined,
      status: statusFilter !== "all" ? (statusFilter as any) : undefined,
    },
    { enabled: false }
  );

  const toggleOrderSelection = (orderId: string) => {
    const newSet = new Set(selectedOrders);
    if (newSet.has(orderId)) {
      newSet.delete(orderId);
    } else {
      newSet.add(orderId);
    }
    setSelectedOrders(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedOrders.size === filteredOrders.length) {
      setSelectedOrders(new Set());
    } else {
      setSelectedOrders(new Set(filteredOrders.map((o: any) => o.id)));
    }
  };

  const handleBulkUpdateStatus = () => {
    if (selectedOrders.size === 0) {
      toast.error("Nenhum pedido selecionado");
      return;
    }
    if (!bulkStatus) {
      toast.error("Por favor, selecione um status");
      return;
    }

    bulkUpdateMutation.mutate({
      orderIds: Array.from(selectedOrders),
      status: bulkStatus as any,
    });
  };

  const handleExportCSV = async () => {
    try {
      const { data } = await exportQuery.refetch();
      if (data && data.csv) {
        // Add BOM for Excel UTF-8 compatibility
        const BOM = "\uFEFF";
        const csvContent = BOM + data.csv;

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = data.filename;
        a.click();
        URL.revokeObjectURL(url);
        toast.success(`${data.count} pedido(s) exportado(s) com sucesso`);
      } else {
        toast.error("Nenhum pedido para exportar");
      }
    } catch (error) {
      toast.error("Falha ao exportar CSV");
      console.error("Export error:", error);
    }
  };

  // Use backend results directly (search is done server-side)
  const filteredOrders = ordersQuery.data?.items || [];

  const totalPages = ordersQuery.data ? Math.ceil(ordersQuery.data.total / PAGE_SIZE) : 0;

  // Calculate statistics
  const stats = {
    total: ordersQuery.data?.total || 0,
    sent: filteredOrders.filter((o: any) => o.status === "SENT").length,
    inSeparation: filteredOrders.filter((o: any) => o.status === "IN_SEPARATION").length,
    finalized: filteredOrders.filter((o: any) => o.status === "FINALIZED").length,
    today: filteredOrders.filter((o: any) => {
      const today = new Date();
      const orderDate = new Date(o.createdAt);
      return (
        orderDate.getDate() === today.getDate() &&
        orderDate.getMonth() === today.getMonth() &&
        orderDate.getFullYear() === today.getFullYear()
      );
    }).length,
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "SENT":
        return <Badge className="bg-primary/10 text-primary">Enviado</Badge>;
      case "IN_SEPARATION":
        return <Badge className="bg-warning/10 text-warning">Em Separação</Badge>;
      case "FINALIZED":
        return <Badge className="bg-success/10 text-success">Finalizado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <PageLayout title="Gestão de Pedidos">
      {/* Statistics Dashboard */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        {/* Total Orders */}
        <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-xl p-4 border border-primary/20 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-primary uppercase tracking-wide mb-1">Total</p>
              <p className="text-2xl font-bold text-primary">{stats.total}</p>
              <p className="text-xs text-primary mt-1">pedidos</p>
            </div>
            <div className="bg-primary/20 rounded-lg p-2">
              <Package className="h-5 w-5 text-primary" />
            </div>
          </div>
        </div>

        {/* Sent */}
        <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-xl p-4 border border-primary/20 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-primary uppercase tracking-wide mb-1">Enviados</p>
              <p className="text-2xl font-bold text-primary">{stats.sent}</p>
              <p className="text-xs text-primary mt-1">aguardando</p>
            </div>
            <div className="bg-primary/20 rounded-lg p-2">
              <ShoppingCart className="h-5 w-5 text-primary" />
            </div>
          </div>
        </div>

        {/* In Separation */}
        <div className="bg-gradient-to-br from-warning/5 to-warning/10 rounded-xl p-4 border border-warning/20 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-warning uppercase tracking-wide mb-1">Em Separação</p>
              <p className="text-2xl font-bold text-warning">{stats.inSeparation}</p>
              <p className="text-xs text-warning mt-1">em processo</p>
            </div>
            <div className="bg-warning/20 rounded-lg p-2">
              <Clock className="h-5 w-5 text-warning" />
            </div>
          </div>
        </div>

        {/* Finalized */}
        <div className="bg-gradient-to-br from-success/5 to-success/10 rounded-xl p-4 border border-success/20 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-success uppercase tracking-wide mb-1">Finalizados</p>
              <p className="text-2xl font-bold text-success">{stats.finalized}</p>
              <p className="text-xs text-success mt-1">concluídos</p>
            </div>
            <div className="bg-success/20 rounded-lg p-2">
              <CheckCircle className="h-5 w-5 text-success" />
            </div>
          </div>
        </div>

        {/* Today's Orders */}
        <div className="bg-gradient-to-br from-secondary/5 to-secondary/10 rounded-xl p-4 border border-secondary/20 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-secondary-foreground uppercase tracking-wide mb-1">Hoje</p>
              <p className="text-2xl font-bold text-secondary-foreground">{stats.today}</p>
              <p className="text-xs text-secondary-foreground mt-1">novos</p>
            </div>
            <div className="bg-secondary/20 rounded-lg p-2">
              <Calendar className="h-5 w-5 text-secondary-foreground" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por número ou cliente..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Filtrar por status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Pedidos</SelectItem>
              <SelectItem value="SENT">Enviado</SelectItem>
              <SelectItem value="IN_SEPARATION">Em Separação</SelectItem>
              <SelectItem value="FINALIZED">Finalizado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Results count and auto-refresh indicator */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          {ordersQuery.data && (
            <p className="text-sm text-muted-foreground">
              Mostrando {filteredOrders.length} de {ordersQuery.data.total} pedido
              {ordersQuery.data.total !== 1 ? "s" : ""}
              {selectedOrders.size > 0 && ` • ${selectedOrders.size} selecionado(s)`}
            </p>
          )}

          {/* Auto-refresh controls */}
          <div className="flex items-center gap-3">
            {lastUpdated && (
              <span className="text-xs text-muted-foreground">
                Atualizado {getRelativeTime(lastUpdated)}
              </span>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={handleManualRefresh}
              disabled={ordersQuery.isFetching}
              className="h-8 px-2"
              aria-label="Atualizar pedidos"
            >
              <RefreshCw className={`h-4 w-4 ${ordersQuery.isFetching ? "animate-spin" : ""}`} />
            </Button>

            <button
              onClick={() => setIsAutoRefreshEnabled(!isAutoRefreshEnabled)}
              className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors ${
                isAutoRefreshEnabled
                  ? "bg-green-100 text-green-700 hover:bg-green-200"
                  : "bg-accent/20 text-muted-foreground hover:bg-accent/30"
              }`}
              aria-label={isAutoRefreshEnabled ? "Desativar atualização automática" : "Ativar atualização automática"}
            >
              {isAutoRefreshEnabled ? (
                <Wifi className="h-3 w-3" />
              ) : (
                <WifiOff className="h-3 w-3" />
              )}
              <span className="hidden sm:inline">Auto</span>
            </button>

            {/* Real-time connection indicator */}
            {isConnected && (
              <div
                className="flex items-center gap-1.5 px-2 py-1 rounded text-xs bg-blue-100 text-blue-700"
                title="Conectado - Atualizações em tempo real ativas"
              >
                <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                <span className="hidden sm:inline">Tempo real</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Batch Actions */}
      {selectedOrders.size > 0 && (
        <div className="mb-4 p-4 bg-blue-50 rounded-lg flex flex-col sm:flex-row items-center gap-3">
          <span className="text-sm font-medium text-blue-900">
            {selectedOrders.size} pedido{selectedOrders.size > 1 ? "s" : ""} selecionado
            {selectedOrders.size > 1 ? "s" : ""}
          </span>

          <div className="flex-1 flex items-center gap-2">
            <Select value={bulkStatus} onValueChange={setBulkStatus}>
              <SelectTrigger className="w-[180px] bg-card">
                <SelectValue placeholder="Atualizar status..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SENT">Enviado</SelectItem>
                <SelectItem value="IN_SEPARATION">Em Separação</SelectItem>
                <SelectItem value="FINALIZED">Finalizado</SelectItem>
              </SelectContent>
            </Select>

            <Button
              onClick={handleBulkUpdateStatus}
              size="sm"
              disabled={!bulkStatus || bulkUpdateMutation.isPending}
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Atualizar
            </Button>
          </div>

          <Button onClick={handleExportCSV} size="sm" variant="outline">
            <FileDown className="h-4 w-4 mr-1" />
            Exportar CSV
          </Button>

          <Button onClick={() => setSelectedOrders(new Set())} size="sm" variant="ghost">
            Limpar
          </Button>
        </div>
      )}

      {ordersQuery.isLoading && (
        <div className="space-y-4">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      )}

      {ordersQuery.error && (
        <div className="text-center py-12 bg-destructive/10 rounded-lg">
          <AlertTriangle className="mx-auto h-12 w-12 text-red-400" aria-hidden="true" />
          <p className="mt-3 text-lg font-medium text-destructive">Erro ao carregar pedidos</p>
          <p className="mt-1 text-sm text-destructive">
            {ordersQuery.error.message || "Não foi possível carregar os pedidos. Tente novamente."}
          </p>
          <Button
            onClick={() => ordersQuery.refetch()}
            variant="outline"
            className="mt-4"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Tentar Novamente
          </Button>
        </div>
      )}

      {ordersQuery.data && filteredOrders.length === 0 && (
        <div className="text-center py-16 bg-muted rounded-lg">
          <svg
            className="mx-auto h-16 w-16 text-muted-foreground"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <p className="mt-4 text-lg text-muted-foreground">Nenhum pedido encontrado</p>
        </div>
      )}

      {/* Select All */}
      {filteredOrders.length > 0 && (
        <div className="mb-2 flex items-center gap-2">
          <Checkbox
            id="select-all"
            checked={selectedOrders.size === filteredOrders.length}
            onCheckedChange={toggleSelectAll}
          />
          <label htmlFor="select-all" className="text-sm text-muted-foreground cursor-pointer">
            Selecionar todos ({filteredOrders.length})
          </label>
        </div>
      )}

      {/* Orders Grid */}
      {filteredOrders.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredOrders.map((order: any) => {
            const hasWeightItems = order.items.some(
              (item: any) => item.productOption?.unitType === "WEIGHT"
            );
            const allWeighed = order.items
              .filter((item: any) => item.productOption?.unitType === "WEIGHT")
              .every((item: any) => item.actualWeight !== null);

            return (
              <div
                key={order.id}
                className="bg-card rounded-xl shadow-sm border border-border hover:shadow-lg hover:border-border transition-all duration-200"
              >
                {/* Card Header */}
                <div className="p-4 border-b border-gray-100">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <Checkbox
                        checked={selectedOrders.has(order.id)}
                        onCheckedChange={() => toggleOrderSelection(order.id)}
                        className="mt-1"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-foreground text-base">
                            {order.orderNumber}
                          </h3>
                          {getStatusBadge(order.status)}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <User className="h-3 w-3" />
                          <span className="truncate">
                            {order.createdByUser?.name || order.createdByUser?.email || "—"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-4 space-y-3">
                  {/* Customer */}
                  <div className="flex items-center gap-2">
                    <div className="bg-blue-100 rounded-lg p-2">
                      <ShoppingCart className="h-4 w-4 text-blue-700" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground">Cliente</p>
                      <p className="text-sm font-medium text-foreground truncate">
                        {order.customer?.account?.name || "—"}
                      </p>
                    </div>
                  </div>

                  {/* Items Count */}
                  <div className="flex items-center gap-2">
                    <div className="bg-purple-100 rounded-lg p-2">
                      <Package className="h-4 w-4 text-purple-700" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground">Itens</p>
                      <p className="text-sm font-medium text-foreground">
                        {order.items.length} produto{order.items.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>

                  {/* Created Date */}
                  <div className="flex items-center gap-2">
                    <div className="bg-accent/20 rounded-lg p-2">
                      <Clock className="h-4 w-4 text-card-foreground" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground">Criado em</p>
                      <p className="text-sm font-medium text-foreground">
                        {new Date(order.createdAt).toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}{" "}
                        às{" "}
                        {new Date(order.createdAt).toLocaleTimeString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="p-4 bg-muted rounded-b-xl border-t border-gray-100">
                  <div className="flex flex-wrap gap-2">
                    {order.status === "IN_SEPARATION" && hasWeightItems && (
                      <Button variant="outline" size="sm" className="flex-1" asChild>
                        <Link to={`/admin/weighing/${order.id}`}>
                          <Scale className="h-4 w-4 mr-1.5" />
                          Pesar
                        </Link>
                      </Button>
                    )}

                    {order.status !== "FINALIZED" && (!hasWeightItems || allWeighed) && (
                      <Button variant="outline" size="sm" className="flex-1" asChild>
                        <Link to={`/admin/finalize/${order.id}`}>
                          <CheckCircle className="h-4 w-4 mr-1.5" />
                          Finalizar
                        </Link>
                      </Button>
                    )}

                    {order.status === "FINALIZED" && (
                      <Button variant="outline" size="sm" className="flex-1" asChild>
                        <a
                          href={`/api/delivery-note/${order.id}.pdf`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Download className="h-4 w-4 mr-1.5" />
                          PDF
                        </a>
                      </Button>
                    )}

                    <Button variant="ghost" size="sm" asChild>
                      <Link to={`/admin/finalize/${order.id}`}>
                        <Eye className="h-4 w-4 mr-1.5" />
                        Ver
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {ordersQuery.data && totalPages > 1 && (
        <div className="flex items-center justify-between mt-6 pt-6 border-t">
          <div className="text-sm text-muted-foreground">
            Página {currentPage + 1} de {totalPages}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
              disabled={currentPage === 0}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Anterior</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={currentPage >= totalPages - 1}
            >
              <span className="hidden sm:inline">Próximo</span>
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </PageLayout>
  );
}
