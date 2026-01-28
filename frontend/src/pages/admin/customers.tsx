import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { PageLayout } from "@/components/page-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CardSkeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Users, Search, DollarSign, Package, TrendingUp, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export function CustomersManagementPage() {
  const [search, setSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [showPricingModal, setShowPricingModal] = useState(false);
  const [selectedProductOption, setSelectedProductOption] = useState("");
  const [customPrice, setCustomPrice] = useState("");

  const utils = trpc.useUtils();

  const customersQuery = trpc.customers.list.useQuery({
    search: search || undefined,
    take: 100,
  });

  const customerDetailsQuery = trpc.customers.get.useQuery(
    { id: selectedCustomer?.id! },
    { enabled: !!selectedCustomer }
  );

  const statsQuery = trpc.customers.getStats.useQuery(
    { customerId: selectedCustomer?.id! },
    { enabled: !!selectedCustomer }
  );

  const productsQuery = trpc.products.list.useQuery({
    take: 100,
  });

  const setCustomPriceMutation = trpc.customers.setCustomPrice.useMutation({
    onSuccess: () => {
      toast.success("Custom price set successfully");
      utils.customers.get.invalidate();
      utils.customers.list.invalidate();
      setShowPricingModal(false);
      setSelectedProductOption("");
      setCustomPrice("");
    },
    onError: (error) => {
      toast.error("Failed to set custom price", { description: error.message });
    },
  });

  const removeCustomPriceMutation = trpc.customers.removeCustomPrice.useMutation({
    onSuccess: () => {
      toast.success("Custom price removed");
      utils.customers.get.invalidate();
      utils.customers.list.invalidate();
    },
    onError: (error) => {
      toast.error("Failed to remove custom price", { description: error.message });
    },
  });

  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(cents / 100);
  };

  const openCustomerDetails = (customer: any) => {
    setSelectedCustomer(customer);
  };

  const closeCustomerDetails = () => {
    setSelectedCustomer(null);
  };

  const handleSetCustomPrice = () => {
    if (!selectedCustomer || !selectedProductOption || !customPrice) {
      toast.error("Please fill in all fields");
      return;
    }

    const priceInCents = Math.round(parseFloat(customPrice) * 100);
    if (isNaN(priceInCents) || priceInCents <= 0) {
      toast.error("Please enter a valid price");
      return;
    }

    setCustomPriceMutation.mutate({
      customerId: selectedCustomer.id,
      productOptionId: selectedProductOption,
      price: priceInCents,
    });
  };

  const handleRemoveCustomPrice = (customerId: string, productOptionId: string) => {
    if (confirm("Remove this custom price? The customer will use the base price.")) {
      removeCustomPriceMutation.mutate({
        customerId,
        productOptionId,
      });
    }
  };

  return (
    <PageLayout title="Customer Management">
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row gap-3 justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search customers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Customers List */}
      {customersQuery.isLoading && (
        <div className="space-y-4">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      )}

      {customersQuery.error && (
        <p className="text-center py-8 text-red-600">Error loading customers</p>
      )}

      {customersQuery.data && customersQuery.data.items.length === 0 && (
        <div className="text-center py-16 bg-gray-50 rounded-lg">
          <Users className="mx-auto h-16 w-16 text-gray-400 mb-4" />
          <p className="text-lg text-gray-600">No customers found</p>
        </div>
      )}

      {customersQuery.data && customersQuery.data.items.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {customersQuery.data.items.map((customer) => (
            <div
              key={customer.id}
              className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow overflow-hidden cursor-pointer"
              onClick={() => openCustomerDetails(customer)}
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">{customer.account.name}</h3>
                  <Badge variant="secondary">{customer.orders.length} orders</Badge>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center text-gray-600">
                    <DollarSign className="h-4 w-4 mr-2" />
                    <span>{customer.customerPrices.length} custom prices</span>
                  </div>
                  {customer.orders.length > 0 && (
                    <div className="text-gray-600">
                      Last order:{" "}
                      {new Date(customer.orders[0].createdAt).toLocaleDateString("pt-BR")}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Customer Details Modal */}
      <Dialog
        open={!!selectedCustomer}
        onOpenChange={(open) => !open && closeCustomerDetails()}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedCustomer?.account.name}</DialogTitle>
          </DialogHeader>

          {customerDetailsQuery.isLoading && <p className="text-center py-4">Loading...</p>}

          {customerDetailsQuery.data && statsQuery.data && (
            <div className="space-y-6">
              {/* Stats Cards */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-blue-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Package className="h-5 w-5 text-blue-600" />
                    <span className="text-sm font-medium text-blue-900">Total Orders</span>
                  </div>
                  <p className="text-2xl font-bold text-blue-900">{statsQuery.data.totalOrders}</p>
                </div>

                <div className="bg-green-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="h-5 w-5 text-green-600" />
                    <span className="text-sm font-medium text-green-900">Total Revenue</span>
                  </div>
                  <p className="text-2xl font-bold text-green-900">
                    {formatPrice(statsQuery.data.totalRevenue)}
                  </p>
                </div>

                <div className="bg-purple-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="h-5 w-5 text-purple-600" />
                    <span className="text-sm font-medium text-purple-900">Avg Order</span>
                  </div>
                  <p className="text-2xl font-bold text-purple-900">
                    {formatPrice(statsQuery.data.averageOrderValue)}
                  </p>
                </div>
              </div>

              {/* Custom Pricing */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Custom Pricing</h3>
                  <Button size="sm" onClick={() => setShowPricingModal(true)}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add Custom Price
                  </Button>
                </div>

                {customerDetailsQuery.data.customerPrices.length === 0 && (
                  <p className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
                    No custom prices set. Using base prices for all products.
                  </p>
                )}

                {customerDetailsQuery.data.customerPrices.length > 0 && (
                  <div className="space-y-2">
                    {customerDetailsQuery.data.customerPrices.map((cp) => (
                      <div
                        key={cp.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div>
                          <p className="font-medium text-sm">
                            {cp.productOption.product.name} - {cp.productOption.name}
                          </p>
                          <p className="text-xs text-gray-500">SKU: {cp.productOption.sku}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="font-semibold text-green-700">{formatPrice(cp.price)}</p>
                            <p className="text-xs text-gray-500">
                              Base: {formatPrice(cp.productOption.basePrice)}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              handleRemoveCustomPrice(
                                customerDetailsQuery.data.id,
                                cp.productOptionId
                              )
                            }
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Recent Orders */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Recent Orders</h3>

                {customerDetailsQuery.data.orders.length === 0 && (
                  <p className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
                    No orders yet
                  </p>
                )}

                {customerDetailsQuery.data.orders.length > 0 && (
                  <div className="space-y-2">
                    {customerDetailsQuery.data.orders.slice(0, 10).map((order) => (
                      <div
                        key={order.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div>
                          <p className="font-medium text-sm">{order.orderNumber}</p>
                          <p className="text-xs text-gray-500">
                            {new Date(order.createdAt).toLocaleDateString("pt-BR")} •{" "}
                            {order.items.length} items
                          </p>
                        </div>
                        <Badge
                          variant={
                            order.status === "FINALIZED"
                              ? "secondary"
                              : order.status === "SENT"
                              ? "default"
                              : "outline"
                          }
                        >
                          {order.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={closeCustomerDetails}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Custom Price Modal */}
      <Dialog open={showPricingModal} onOpenChange={setShowPricingModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Custom Price</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="product">Product Option</Label>
              <select
                id="product"
                value={selectedProductOption}
                onChange={(e) => setSelectedProductOption(e.target.value)}
                className="w-full p-2 border rounded-md"
              >
                <option value="">Select a product option...</option>
                {productsQuery.data?.items.flatMap((product) =>
                  product.options.map((option: any) => (
                    <option key={option.id} value={option.id}>
                      {product.name} - {option.name} (Base: {formatPrice(option.basePrice)})
                    </option>
                  ))
                )}
              </select>
            </div>

            <div>
              <Label htmlFor="price">Custom Price (R$)</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                min="0"
                value={customPrice}
                onChange={(e) => setCustomPrice(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowPricingModal(false);
                setSelectedProductOption("");
                setCustomPrice("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSetCustomPrice}
              disabled={setCustomPriceMutation.isPending}
            >
              Set Price
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
}
