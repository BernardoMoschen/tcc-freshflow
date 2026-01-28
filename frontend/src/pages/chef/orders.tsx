import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { PageLayout } from "@/components/page-layout";
import { CardSkeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { OrderDetailsDialog } from "@/components/order-details-dialog";
import { OrderStatusTimeline } from "@/components/order-status-timeline";
import { Search, ChevronLeft, ChevronRight, Eye, Download, FileDown, RefreshCw } from "lucide-react";
import { toast } from "sonner";

const PAGE_SIZE = 10;

export function OrdersPage() {
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(0);
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<string>("");

  const utils = trpc.useUtils();

  const ordersQuery = trpc.orders.list.useQuery({
    status: statusFilter === "all" ? undefined : (statusFilter as any),
    skip: currentPage * PAGE_SIZE,
    take: PAGE_SIZE,
  });

  const bulkUpdateMutation = trpc.orders.bulkUpdateStatus.useMutation({
    onSuccess: (data) => {
      toast.success(`Updated ${data.updated} order(s)`);
      setSelectedOrders(new Set());
      utils.orders.list.invalidate();
    },
    onError: (error) => {
      toast.error("Failed to update orders", { description: error.message });
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
    const newSelection = new Set(selectedOrders);
    if (newSelection.has(orderId)) {
      newSelection.delete(orderId);
    } else {
      newSelection.add(orderId);
    }
    setSelectedOrders(newSelection);
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
      toast.error("No orders selected");
      return;
    }
    if (!bulkStatus) {
      toast.error("Please select a status");
      return;
    }

    bulkUpdateMutation.mutate({
      orderIds: Array.from(selectedOrders),
      status: bulkStatus as any,
    });
  };

  const handleExportCSV = async () => {
    const result = await exportQuery.refetch();
    if (result.data) {
      // Convert to CSV string
      const headers = Object.keys(result.data[0] || {});
      const csvContent = [
        headers.join(","),
        ...result.data.map((row: any) =>
          headers.map((h) => JSON.stringify(row[h] || "")).join(",")
        ),
      ].join("\n");

      // Download CSV
      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `orders-export-${new Date().toISOString()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("CSV exported successfully");
    }
  };

  // Filter orders by search query (client-side for order number)
  const filteredOrders = ordersQuery.data?.items.filter((order) => {
    if (!searchQuery) return true;
    return order.orderNumber.toLowerCase().includes(searchQuery.toLowerCase());
  }) || [];

  const totalPages = ordersQuery.data ? Math.ceil(ordersQuery.data.total / PAGE_SIZE) : 0;

  return (
    <PageLayout title="My Orders">
      {/* Filters */}
      <div className="mb-6 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search by order number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Status Filter */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Orders</SelectItem>
              <SelectItem value="SENT">Sent</SelectItem>
              <SelectItem value="IN_SEPARATION">In Separation</SelectItem>
              <SelectItem value="FINALIZED">Finalized</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Results count */}
        {ordersQuery.data && (
          <p className="text-sm text-gray-600">
            Showing {filteredOrders.length} of {ordersQuery.data.total} order
            {ordersQuery.data.total !== 1 ? "s" : ""}
            {selectedOrders.size > 0 && ` • ${selectedOrders.size} selected`}
          </p>
        )}
      </div>

      {/* Batch Actions */}
      {selectedOrders.size > 0 && (
        <div className="mb-4 p-4 bg-blue-50 rounded-lg flex flex-col sm:flex-row items-center gap-3">
          <span className="text-sm font-medium text-blue-900">
            {selectedOrders.size} order{selectedOrders.size > 1 ? "s" : ""} selected
          </span>

          <div className="flex-1 flex items-center gap-2">
            <Select value={bulkStatus} onValueChange={setBulkStatus}>
              <SelectTrigger className="w-[180px] bg-white">
                <SelectValue placeholder="Update status..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SENT">Sent</SelectItem>
                <SelectItem value="IN_SEPARATION">In Separation</SelectItem>
                <SelectItem value="FINALIZED">Finalized</SelectItem>
              </SelectContent>
            </Select>

            <Button
              onClick={handleBulkUpdateStatus}
              size="sm"
              disabled={!bulkStatus || bulkUpdateMutation.isPending}
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Update Status
            </Button>
          </div>

          <Button onClick={handleExportCSV} size="sm" variant="outline">
            <FileDown className="h-4 w-4 mr-1" />
            Export CSV
          </Button>

          <Button
            onClick={() => setSelectedOrders(new Set())}
            size="sm"
            variant="ghost"
          >
            Clear Selection
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
        <p className="text-center py-8 text-red-600">Error loading orders</p>
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
          <p className="mt-4 text-lg text-gray-600">
            {searchQuery || statusFilter !== "all" ? "No matching orders" : "No orders yet"}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            {searchQuery || statusFilter !== "all"
              ? "Try adjusting your filters"
              : "Start shopping to create your first order"}
          </p>
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
            Select all ({filteredOrders.length})
          </label>
        </div>
      )}

      <div className="space-y-4">
        {filteredOrders.map((order) => (
          <div
            key={order.id}
            className={`bg-white rounded-lg shadow-sm p-4 md:p-6 hover:shadow-md transition-shadow ${
              selectedOrders.has(order.id) ? "ring-2 ring-blue-500" : ""
            }`}
          >
            <div className="flex flex-col gap-4">
              {/* Order Header */}
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 flex-1">
                  <Checkbox
                    checked={selectedOrders.has(order.id)}
                    onCheckedChange={() => toggleOrderSelection(order.id)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                  <h3 className="font-semibold text-lg mb-2">{order.orderNumber}</h3>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-gray-600 mb-3">
                    <div>
                      <span className="font-medium">Items:</span> {order.items.length}
                    </div>
                    <div>
                      <span className="font-medium">Created:</span>{" "}
                      {new Date(order.createdAt).toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </div>
                    <div className="col-span-2">
                      <span className="font-medium">Created by:</span>{" "}
                      {order.createdByUser?.name || order.createdByUser?.email || "Unknown"}
                    </div>
                    {order.sentAt && (
                      <div className="col-span-2">
                        <span className="font-medium">Sent:</span>{" "}
                        {new Date(order.sentAt).toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    )}
                  </div>
                  </div>
                </div>
              </div>

              {/* Status Timeline */}
              <OrderStatusTimeline status={order.status as any} compact />

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedOrderId(order.id)}
                  className="flex-1"
                >
                  <Eye className="mr-2 h-4 w-4" />
                  View Details
                </Button>

                {order.status === "FINALIZED" && (
                  <a
                    href={`http://localhost:3001/api/delivery-note/${order.id}.pdf`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1"
                  >
                    <Button variant="secondary" size="sm" className="w-full">
                      <Download className="mr-2 h-4 w-4" />
                      Download PDF
                    </Button>
                  </a>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {ordersQuery.data && totalPages > 1 && (
        <div className="flex items-center justify-between mt-6 pt-6 border-t">
          <div className="text-sm text-gray-600">
            Page {currentPage + 1} of {totalPages}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
              disabled={currentPage === 0}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Previous</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={currentPage >= totalPages - 1}
            >
              <span className="hidden sm:inline">Next</span>
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Order Details Dialog */}
      <OrderDetailsDialog orderId={selectedOrderId} onClose={() => setSelectedOrderId(null)} />
    </PageLayout>
  );
}
