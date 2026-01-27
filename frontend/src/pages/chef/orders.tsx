import { trpc } from "@/lib/trpc";

export function OrdersPage() {
  const ordersQuery = trpc.orders.list.useQuery({ skip: 0, take: 20 });

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <h1 className="text-2xl font-bold text-gray-900">My Orders</h1>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {ordersQuery.isLoading && <p>Loading orders...</p>}
        {ordersQuery.error && <p className="text-red-600">Error loading orders</p>}

        <div className="space-y-4">
          {ordersQuery.data?.items.map((order) => (
            <div key={order.id} className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-lg">{order.orderNumber}</h3>
                  <p className="text-sm text-gray-600">
                    Status: <span className="font-medium">{order.status}</span>
                  </p>
                  <p className="text-sm text-gray-600">
                    Items: {order.items.length}
                  </p>
                  <p className="text-sm text-gray-600">
                    Created: {new Date(order.createdAt).toLocaleDateString()}
                  </p>
                </div>
                {order.status === "FINALIZED" && (
                  <a
                    href={`/api/delivery-note/${order.id}.pdf`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-primary text-white px-4 py-2 rounded-md hover:bg-primary/90"
                  >
                    Download PDF
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
