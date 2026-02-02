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
    ordersQuery.refetch();
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
    utils.orders.adminList.invalidate();
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
      utils.orders.adminList.invalidate();
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
      setSelectedOrders(new Set(filteredOrders.map((o) => o.id)));
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "SENT":
        return <Badge className="bg-blue-100 text-blue-800">Enviado</Badge>;
      case "IN_SEPARATION":
        return <Badge className="bg-yellow-100 text-yellow-800">Em Separação</Badge>;
      case "FINALIZED":
        return <Badge className="bg-green-100 text-green-800">Finalizado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <PageLayout title="Gestão de Pedidos">
      {/* Filters */}
      <div className="mb-6 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
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
            <p className="text-sm text-gray-600">
              Mostrando {filteredOrders.length} de {ordersQuery.data.total} pedido
              {ordersQuery.data.total !== 1 ? "s" : ""}
              {selectedOrders.size > 0 && ` • ${selectedOrders.size} selecionado(s)`}
            </p>
          )}

          {/* Auto-refresh controls */}
          <div className="flex items-center gap-3">
            {lastUpdated && (
              <span className="text-xs text-gray-500">
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
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"
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
              <SelectTrigger className="w-[180px] bg-white">
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
        <div className="text-center py-12 bg-red-50 rounded-lg">
          <AlertTriangle className="mx-auto h-12 w-12 text-red-400" aria-hidden="true" />
          <p className="mt-3 text-lg font-medium text-red-800">Erro ao carregar pedidos</p>
          <p className="mt-1 text-sm text-red-600">
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
        <div className="text-center py-16 bg-gray-50 rounded-lg">
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
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <p className="mt-4 text-lg text-gray-600">Nenhum pedido encontrado</p>
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
          <label htmlFor="select-all" className="text-sm text-gray-600 cursor-pointer">
            Selecionar todos ({filteredOrders.length})
          </label>
        </div>
      )}

      {/* Orders Table */}
      {filteredOrders.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="w-12 px-4 py-3"></th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Pedido
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cliente
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Itens
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Criado
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredOrders.map((order) => {
                const hasWeightItems = order.items.some(
                  (item: any) => item.productOption?.unitType === "WEIGHT"
                );
                const allWeighed = order.items
                  .filter((item: any) => item.productOption?.unitType === "WEIGHT")
                  .every((item: any) => item.actualWeight !== null);

                return (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Checkbox
                        checked={selectedOrders.has(order.id)}
                        onCheckedChange={() => toggleOrderSelection(order.id)}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{order.orderNumber}</p>
                      <p className="text-xs text-gray-500">
                        {order.createdByUser?.name || order.createdByUser?.email || "—"}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-gray-900">
                        {order.customer?.account?.name || "—"}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-sm font-medium">{order.items.length}</span>
                    </td>
                    <td className="px-4 py-3 text-center">{getStatusBadge(order.status)}</td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-gray-900">
                        {new Date(order.createdAt).toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "short",
                        })}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(order.createdAt).toLocaleTimeString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-right space-x-1">
                      {order.status !== "FINALIZED" && hasWeightItems && (
                        <Button variant="outline" size="sm" asChild>
                          <Link to={`/admin/weighing/${order.id}`}>
                            <Scale className="h-4 w-4 mr-1" />
                            Pesar
                          </Link>
                        </Button>
                      )}

                      {order.status !== "FINALIZED" && (!hasWeightItems || allWeighed) && (
                        <Button variant="outline" size="sm" asChild>
                          <Link to={`/admin/finalize/${order.id}`}>
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Finalizar
                          </Link>
                        </Button>
                      )}

                      {order.status === "FINALIZED" && (
                        <Button variant="outline" size="sm" asChild>
                          <a
                            href={`http://localhost:3001/api/delivery-note/${order.id}.pdf`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Download className="h-4 w-4 mr-1" />
                            PDF
                          </a>
                        </Button>
                      )}

                      <Button variant="ghost" size="sm" asChild>
                        <Link to={`/admin/finalize/${order.id}`}>
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {ordersQuery.data && totalPages > 1 && (
        <div className="flex items-center justify-between mt-6 pt-6 border-t">
          <div className="text-sm text-gray-600">
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
