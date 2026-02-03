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

  // Ensure tenant context exists before querying
  const hasTenantContext = !!localStorage.getItem("freshflow:tenantId");

  const customersQuery = trpc.customers.list.useQuery(
    {
      search: search || undefined,
      take: 100,
    },
    { enabled: hasTenantContext }
  );

  const customerDetailsQuery = trpc.customers.get.useQuery(
    { id: selectedCustomer?.id! },
    { enabled: !!selectedCustomer && hasTenantContext }
  );

  const statsQuery = trpc.customers.getStats.useQuery(
    { customerId: selectedCustomer?.id! },
    { enabled: !!selectedCustomer && hasTenantContext }
  );

  const productsQuery = trpc.products.list.useQuery(
    { take: 100 },
    { enabled: hasTenantContext }
  );

  const setCustomPriceMutation = trpc.customers.setCustomPrice.useMutation({
    onSuccess: () => {
      toast.success("Preço personalizado definido com sucesso");
      utils.customers.get.invalidate();
      utils.customers.list.invalidate();
      setShowPricingModal(false);
      setSelectedProductOption("");
      setCustomPrice("");
    },
    onError: (error) => {
      toast.error("Falha ao definir preço personalizado", { description: error.message });
    },
  });

  const removeCustomPriceMutation = trpc.customers.removeCustomPrice.useMutation({
    onSuccess: () => {
      toast.success("Preço personalizado removido");
      utils.customers.get.invalidate();
      utils.customers.list.invalidate();
    },
    onError: (error) => {
      toast.error("Falha ao remover preço personalizado", { description: error.message });
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
      toast.error("Por favor, preencha todos os campos");
      return;
    }

    const priceInCents = Math.round(parseFloat(customPrice) * 100);
    if (isNaN(priceInCents) || priceInCents <= 0) {
      toast.error("Por favor, insira um preço válido");
      return;
    }

    setCustomPriceMutation.mutate({
      customerId: selectedCustomer.id,
      productOptionId: selectedProductOption,
      price: priceInCents,
    });
  };

  const handleRemoveCustomPrice = (customerId: string, productOptionId: string) => {
    if (confirm("Remover este preço personalizado? O cliente usará o preço base.")) {
      removeCustomPriceMutation.mutate({
        customerId,
        productOptionId,
      });
    }
  };

  return (
    <PageLayout title="Gestão de Clientes">
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row gap-3 justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar clientes..."
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
        <p className="text-center py-8 text-red-600">Erro ao carregar clientes</p>
      )}

      {customersQuery.data && customersQuery.data.items.length === 0 && (
        <div className="text-center py-16 bg-muted rounded-lg">
          <Users className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
          <p className="text-lg text-muted-foreground">Nenhum cliente encontrado</p>
        </div>
      )}

      {customersQuery.data && customersQuery.data.items.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {customersQuery.data.items.map((customer) => (
            <div
              key={customer.id}
              className="bg-card rounded-lg shadow hover:shadow-lg transition-shadow overflow-hidden cursor-pointer"
              onClick={() => openCustomerDetails(customer)}
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-foreground">{customer.account.name}</h3>
                  <Badge variant="secondary">{customer.orders.length} pedidos</Badge>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center text-muted-foreground">
                    <DollarSign className="h-4 w-4 mr-2" />
                    <span>{customer.customerPrices.length} preços personalizados</span>
                  </div>
                  {customer.orders.length > 0 && (
                    <div className="text-muted-foreground">
                      Último pedido:{" "}
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

          {customerDetailsQuery.isLoading && <p className="text-center py-4">Carregando...</p>}

          {customerDetailsQuery.data && statsQuery.data && (
            <div className="space-y-6">
              {/* Stats Cards */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-primary/10 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Package className="h-5 w-5 text-primary" />
                    <span className="text-sm font-medium text-primary">Total de Pedidos</span>
                  </div>
                  <p className="text-2xl font-bold text-primary">{statsQuery.data.totalOrders}</p>
                </div>

                <div className="bg-success/10 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="h-5 w-5 text-success" />
                    <span className="text-sm font-medium text-success">Receita Total</span>
                  </div>
                  <p className="text-2xl font-bold text-success">
                    {formatPrice(statsQuery.data.totalRevenue)}
                  </p>
                </div>

                <div className="bg-secondary/10 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="h-5 w-5 text-secondary-foreground" />
                    <span className="text-sm font-medium text-secondary-foreground">Pedido Médio</span>
                  </div>
                  <p className="text-2xl font-bold text-secondary-foreground">
                    {formatPrice(statsQuery.data.averageOrderValue)}
                  </p>
                </div>
              </div>

              {/* Custom Pricing */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Preços Personalizados</h3>
                  <Button size="sm" onClick={() => setShowPricingModal(true)}>
                    <Plus className="h-4 w-4 mr-1" />
                    Adicionar Preço
                  </Button>
                </div>

                {customerDetailsQuery.data.customerPrices.length === 0 && (
                  <p className="text-center py-8 text-muted-foreground bg-muted rounded-lg">
                    Nenhum preço personalizado definido. Usando preços base para todos os produtos.
                  </p>
                )}

                {customerDetailsQuery.data.customerPrices.length > 0 && (
                  <div className="space-y-2">
                    {customerDetailsQuery.data.customerPrices.map((cp) => (
                      <div
                        key={cp.id}
                        className="flex items-center justify-between p-3 bg-muted rounded-lg"
                      >
                        <div>
                          <p className="font-medium text-sm">
                            {cp.productOption.product.name} - {cp.productOption.name}
                          </p>
                          <p className="text-xs text-muted-foreground">SKU: {cp.productOption.sku}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="font-semibold text-success">{formatPrice(cp.price)}</p>
                            <p className="text-xs text-muted-foreground">
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
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
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
                <h3 className="text-lg font-semibold mb-4">Pedidos Recentes</h3>

                {customerDetailsQuery.data.orders.length === 0 && (
                  <p className="text-center py-8 text-muted-foreground bg-muted rounded-lg">
                    Nenhum pedido ainda
                  </p>
                )}

                {customerDetailsQuery.data.orders.length > 0 && (
                  <div className="space-y-2">
                    {customerDetailsQuery.data.orders.slice(0, 10).map((order) => (
                      <div
                        key={order.id}
                        className="flex items-center justify-between p-3 bg-muted rounded-lg"
                      >
                        <div>
                          <p className="font-medium text-sm">{order.orderNumber}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(order.createdAt).toLocaleDateString("pt-BR")} •{" "}
                            {order.items.length} itens
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
                          {order.status === "SENT" ? "Enviado" : order.status === "IN_SEPARATION" ? "Em Separação" : order.status === "FINALIZED" ? "Finalizado" : order.status}
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
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Custom Price Modal */}
      <Dialog open={showPricingModal} onOpenChange={setShowPricingModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Definir Preço Personalizado</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="product">Opção do Produto</Label>
              <select
                id="product"
                value={selectedProductOption}
                onChange={(e) => setSelectedProductOption(e.target.value)}
                className="w-full p-2 border rounded-md"
              >
                <option value="">Selecione uma opção de produto...</option>
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
              <Label htmlFor="price">Preço Personalizado (R$)</Label>
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
              Cancelar
            </Button>
            <Button
              onClick={handleSetCustomPrice}
              disabled={setCustomPriceMutation.isPending}
            >
              Definir Preço
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
}
