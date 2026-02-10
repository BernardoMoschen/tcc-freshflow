import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { PageLayout } from "@/components/page-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CardSkeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Package,
  Plus,
  Minus,
  Edit,
  AlertTriangle,
  XCircle,
  CheckCircle,
  History,
} from "lucide-react";
import { toast } from "sonner";

export function StockManagementPage() {
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [selectedOption, setSelectedOption] = useState<{
    id: string;
    name: string;
    productName: string;
    currentStock: number;
  } | null>(null);
  const [modalType, setModalType] = useState<"add" | "remove" | "adjust" | null>(null);
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");
  const [showMovements, setShowMovements] = useState(false);
  const [selectedOptionForMovements, setSelectedOptionForMovements] = useState<string | null>(
    null
  );

  const utils = trpc.useUtils();

  // Ensure tenant context exists before querying
  const hasTenantContext = !!localStorage.getItem("freshflow:tenantId");

  const stockQuery = trpc.stock.getStockLevels.useQuery(
    {
      lowStockOnly,
      take: 100,
    },
    { enabled: hasTenantContext }
  );

  const movementsQuery = trpc.stock.getMovements.useQuery(
    {
      productOptionId: selectedOptionForMovements!,
      take: 20,
    },
    {
      enabled: !!selectedOptionForMovements && hasTenantContext,
    }
  );

  const addStockMutation = trpc.stock.addStock.useMutation({
    onSuccess: () => {
      toast.success("Estoque adicionado com sucesso");
      utils.stock.getStockLevels.invalidate();
      closeModal();
    },
    onError: (error) => {
      toast.error("Falha ao adicionar estoque", { description: error.message });
    },
  });

  const removeStockMutation = trpc.stock.removeStock.useMutation({
    onSuccess: () => {
      toast.success("Estoque removido com sucesso");
      utils.stock.getStockLevels.invalidate();
      closeModal();
    },
    onError: (error) => {
      toast.error("Falha ao remover estoque", { description: error.message });
    },
  });

  const adjustStockMutation = trpc.stock.adjustStock.useMutation({
    onSuccess: () => {
      toast.success("Estoque ajustado com sucesso");
      utils.stock.getStockLevels.invalidate();
      closeModal();
    },
    onError: (error) => {
      toast.error("Falha ao ajustar estoque", { description: error.message });
    },
  });

  const toggleAvailabilityMutation = trpc.stock.toggleAvailability.useMutation({
    onSuccess: (_data, variables) => {
      toast.success(
        variables.isAvailable ? "Produto disponibilizado" : "Produto indisponibilizado"
      );
      utils.stock.getStockLevels.invalidate();
    },
    onError: (error) => {
      toast.error("Falha ao alterar disponibilidade", { description: error.message });
    },
  });

  const openModal = (
    type: "add" | "remove" | "adjust",
    option: {
      id: string;
      name: string;
      productName: string;
      currentStock: number;
    }
  ) => {
    setSelectedOption(option);
    setModalType(type);
    setQuantity(type === "adjust" ? option.currentStock.toString() : "");
    setNotes("");
  };

  const closeModal = () => {
    setSelectedOption(null);
    setModalType(null);
    setQuantity("");
    setNotes("");
  };

  const handleSubmit = () => {
    if (!selectedOption) return;

    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) {
      toast.error("Por favor, insira uma quantidade válida");
      return;
    }

    if (modalType === "add") {
      addStockMutation.mutate({
        productOptionId: selectedOption.id,
        quantity: qty,
        notes: notes || undefined,
      });
    } else if (modalType === "remove") {
      removeStockMutation.mutate({
        productOptionId: selectedOption.id,
        quantity: qty,
        notes: notes || undefined,
      });
    } else if (modalType === "adjust") {
      adjustStockMutation.mutate({
        productOptionId: selectedOption.id,
        newQuantity: qty,
        notes: notes || undefined,
      });
    }
  };

  const openMovementsDialog = (optionId: string) => {
    setSelectedOptionForMovements(optionId);
    setShowMovements(true);
  };

  const getStockBadge = (item: any) => {
    if (item.isOutOfStock) {
      return (
        <Badge variant="destructive" className="flex items-center gap-1">
          <XCircle className="h-3 w-3" />
          Sem Estoque
        </Badge>
      );
    }
    if (item.isLowStock) {
      return (
        <Badge variant="secondary" className="flex items-center gap-1 bg-warning/10 text-warning">
          <AlertTriangle className="h-3 w-3" />
          Estoque Baixo
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="flex items-center gap-1 bg-success/10 text-success">
        <CheckCircle className="h-3 w-3" />
        Em Estoque
      </Badge>
    );
  };

  return (
    <PageLayout title="Gestão de Estoque">
      {/* Filters */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant={lowStockOnly ? "default" : "outline"}
            size="sm"
            onClick={() => setLowStockOnly(!lowStockOnly)}
          >
            <AlertTriangle className="h-4 w-4 mr-2" />
            {lowStockOnly ? "Mostrando Estoque Baixo" : "Mostrar Todo Estoque"}
          </Button>
        </div>

        <div className="text-sm text-muted-foreground">
          {stockQuery.data?.total} produtos
        </div>
      </div>

      {/* Stock Levels Table */}
      {stockQuery.isLoading && (
        <div className="space-y-4">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      )}

      {stockQuery.error && (
        <p className="text-center py-8 text-red-600">Erro ao carregar níveis de estoque</p>
      )}

      {stockQuery.data && stockQuery.data.items.length === 0 && (
        <div className="text-center py-16 bg-muted rounded-lg">
          <Package className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
          <p className="text-lg text-muted-foreground">
            {lowStockOnly ? "Nenhum item com estoque baixo" : "Nenhum produto encontrado"}
          </p>
        </div>
      )}

      {stockQuery.data && stockQuery.data.items.length > 0 && (
        <div className="bg-card rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-muted">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Produto
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  SKU
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Estoque
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Disponível
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-card divide-y divide-border">
              {stockQuery.data.items.map((item) => (
                <tr key={item.optionId} className="hover:bg-accent/5">
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-card-foreground">{item.productName}</div>
                    <div className="text-sm text-muted-foreground">{item.optionName}</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">{item.sku}</td>
                  <td className="px-6 py-4 text-center">
                    <div className="text-sm font-semibold text-card-foreground">
                      {item.stockQuantity} {item.unitType === "WEIGHT" ? "kg" : "unidades"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Limite: {item.lowStockThreshold}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">{getStockBadge(item)}</td>
                  <td className="px-6 py-4 text-center">
                    <Switch
                      checked={item.isAvailable}
                      onCheckedChange={(checked) =>
                        toggleAvailabilityMutation.mutate({
                          productOptionId: item.optionId,
                          isAvailable: checked,
                        })
                      }
                      disabled={toggleAvailabilityMutation.isPending}
                    />
                  </td>
                  <td className="px-6 py-4 text-right space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        openModal("add", {
                          id: item.optionId,
                          name: item.optionName,
                          productName: item.productName,
                          currentStock: item.stockQuantity,
                        })
                      }
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Adicionar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        openModal("remove", {
                          id: item.optionId,
                          name: item.optionName,
                          productName: item.productName,
                          currentStock: item.stockQuantity,
                        })
                      }
                      disabled={item.stockQuantity === 0}
                    >
                      <Minus className="h-4 w-4 mr-1" />
                      Remover
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        openModal("adjust", {
                          id: item.optionId,
                          name: item.optionName,
                          productName: item.productName,
                          currentStock: item.stockQuantity,
                        })
                      }
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Ajustar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openMovementsDialog(item.optionId)}
                    >
                      <History className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Remove/Adjust Stock Modal */}
      <Dialog open={modalType !== null} onOpenChange={(open) => !open && closeModal()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {modalType === "add" && "Adicionar Estoque"}
              {modalType === "remove" && "Remover Estoque"}
              {modalType === "adjust" && "Ajustar Estoque"}
            </DialogTitle>
          </DialogHeader>

          {selectedOption && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-card-foreground">Produto</p>
                <p className="text-sm text-card-foreground">
                  {selectedOption.productName} - {selectedOption.name}
                </p>
                <p className="text-sm text-muted-foreground">Atual: {selectedOption.currentStock}</p>
              </div>

              <div>
                <Label htmlFor="quantity">
                  {modalType === "adjust" ? "Nova Quantidade" : "Quantidade"}
                </Label>
                <Input
                  id="quantity"
                  type="number"
                  min="0"
                  step="0.01"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="Insira a quantidade"
                />
              </div>

              <div>
                <Label htmlFor="notes">Observações (Opcional)</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Adicione observações sobre esta alteração de estoque..."
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={closeModal}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={
                addStockMutation.isPending ||
                removeStockMutation.isPending ||
                adjustStockMutation.isPending
              }
            >
              {modalType === "add" && "Adicionar Estoque"}
              {modalType === "remove" && "Remover Estoque"}
              {modalType === "adjust" && "Ajustar Estoque"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stock Movements History Dialog */}
      <Dialog open={showMovements} onOpenChange={(open) => !open && setShowMovements(false)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Histórico de Movimentação de Estoque</DialogTitle>
          </DialogHeader>

          {movementsQuery.isLoading && <p className="text-center py-4">Carregando...</p>}

          {movementsQuery.data && (
            <div className="space-y-3">
              {movementsQuery.data.items.map((movement) => (
                <div
                  key={movement.id}
                  className="border rounded-lg p-4 bg-gray-50 hover:bg-gray-100 transition"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge
                          variant={movement.quantity > 0 ? "secondary" : "destructive"}
                          className="text-xs"
                        >
                          {movement.type.replace(/_/g, " ")}
                        </Badge>
                        <span
                          className={`font-semibold ${
                            movement.quantity > 0 ? "text-green-700" : "text-red-700"
                          }`}
                        >
                          {movement.quantity > 0 ? "+" : ""}
                          {movement.quantity}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">{movement.notes}</p>
                      {movement.orderId && (
                        <p className="text-xs text-gray-500 mt-1">Pedido: {movement.orderId}</p>
                      )}
                    </div>
                    <div className="text-right text-xs text-gray-500">
                      {new Date(movement.createdAt).toLocaleString("pt-BR")}
                    </div>
                  </div>
                </div>
              ))}

              {movementsQuery.data.items.length === 0 && (
                <p className="text-center text-gray-500 py-8">Nenhuma movimentação de estoque ainda</p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMovements(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
}
