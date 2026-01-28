import { trpc } from "@/lib/trpc";
import { PageLayout } from "@/components/page-layout";
import { CardSkeleton } from "@/components/ui/skeleton";

const statusColors = {
  DRAFT: "bg-gray-100 text-gray-800",
  SENT: "bg-blue-100 text-blue-800",
  IN_SEPARATION: "bg-yellow-100 text-yellow-800",
  FINALIZED: "bg-green-100 text-green-800",
};

export function OrdersPage() {
  const ordersQuery = trpc.orders.list.useQuery({ skip: 0, take: 20 });

  return (
    <PageLayout title="My Orders">
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

      {ordersQuery.data?.items.length === 0 && (
        <div className="text-center py-16">
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
          <p className="mt-4 text-lg text-gray-600">No orders yet</p>
        </div>
      )}

      <div className="space-y-4">
        {ordersQuery.data?.items.map((order) => (
          <div key={order.id} className="bg-white rounded-lg shadow-sm p-4 md:p-6 hover:shadow-md transition-shadow">
            <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <h3 className="font-semibold text-lg">{order.orderNumber}</h3>
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${statusColors[order.status as keyof typeof statusColors]}`}>
                    {order.status}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-gray-600">
                  <div>
                    <span className="font-medium">Items:</span> {order.items.length}
                  </div>
                  <div>
                    <span className="font-medium">Created:</span> {new Date(order.createdAt).toLocaleDateString("pt-BR")}
                  </div>
                </div>
              </div>
              {order.status === "FINALIZED" && (
                <a
                  href={`/api/delivery-note/${order.id}.pdf`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-primary text-white px-4 py-3 rounded-lg hover:bg-primary/90 font-medium text-center transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <span className="hidden md:inline">Download PDF</span>
                  <span className="md:hidden">PDF</span>
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </PageLayout>
  );
}
