import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { PageLayout } from "@/components/page-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { CardSkeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ImageUpload } from "@/components/image-upload";
import { Package, Plus, Edit, Trash2, Search } from "lucide-react";
import { toast } from "sonner";

type ProductFormData = {
  name: string;
  description: string;
  category: string;
  imageUrl: string;
  options: Array<{
    name: string;
    sku: string;
    unitType: "FIXED" | "WEIGHT";
    basePrice: string;
    stockQuantity: string;
    lowStockThreshold: string;
  }>;
};

export function ProductsManagementPage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [formData, setFormData] = useState<ProductFormData>({
    name: "",
    description: "",
    category: "",
    imageUrl: "",
    options: [
      {
        name: "",
        sku: "",
        unitType: "FIXED",
        basePrice: "",
        stockQuantity: "0",
        lowStockThreshold: "10",
      },
    ],
  });

  const utils = trpc.useUtils();

  // Ensure tenant context exists before querying
  const hasTenantContext = !!localStorage.getItem("freshflow:tenantId");

  const productsQuery = trpc.products.list.useQuery(
    {
      search: search || undefined,
      category: category || undefined,
      take: 100,
    },
    { enabled: hasTenantContext }
  );

  const createMutation = trpc.products.create.useMutation({
    onSuccess: () => {
      toast.success("Produto criado com sucesso");
      utils.products.list.invalidate();
      closeModal();
    },
    onError: (error) => {
      toast.error("Falha ao criar produto", { description: error.message });
    },
  });

  const updateMutation = trpc.products.update.useMutation({
    onSuccess: () => {
      toast.success("Produto atualizado com sucesso");
      utils.products.list.invalidate();
      closeModal();
    },
    onError: (error) => {
      toast.error("Falha ao atualizar produto", { description: error.message });
    },
  });

  const deleteMutation = trpc.products.delete.useMutation({
    onSuccess: () => {
      toast.success("Produto excluído com sucesso");
      utils.products.list.invalidate();
    },
    onError: (error) => {
      toast.error("Falha ao excluir produto", { description: error.message });
    },
  });

  const openCreateModal = () => {
    setEditingProduct(null);
    setFormData({
      name: "",
      description: "",
      category: "",
      imageUrl: "",
      options: [
        {
          name: "",
          sku: "",
          unitType: "FIXED",
          basePrice: "",
          stockQuantity: "0",
          lowStockThreshold: "10",
        },
      ],
    });
    setShowCreateModal(true);
  };

  const openEditModal = (product: any) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      description: product.description || "",
      category: product.category || "",
      imageUrl: product.imageUrl || "",
      options: product.options.map((opt: any) => ({
        name: opt.name,
        sku: opt.sku,
        unitType: opt.unitType,
        basePrice: (opt.basePrice / 100).toString(),
        stockQuantity: opt.stockQuantity?.toString() || "0",
        lowStockThreshold: opt.lowStockThreshold?.toString() || "10",
      })),
    });
    setShowCreateModal(true);
  };

  const closeModal = () => {
    setShowCreateModal(false);
    setEditingProduct(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate
    if (!formData.name.trim()) {
      toast.error("Nome do produto é obrigatório");
      return;
    }

    if (formData.options.length === 0) {
      toast.error("Pelo menos uma opção de produto é obrigatória");
      return;
    }

    for (const option of formData.options) {
      if (!option.name.trim() || !option.sku.trim() || !option.basePrice) {
        toast.error("Todos os campos da opção são obrigatórios");
        return;
      }
    }

    const data = {
      name: formData.name,
      description: formData.description || undefined,
      category: formData.category || undefined,
      imageUrl: formData.imageUrl || undefined,
      options: formData.options.map((opt) => ({
        name: opt.name,
        sku: opt.sku,
        unitType: opt.unitType,
        basePrice: Math.round(parseFloat(opt.basePrice) * 100),
        stockQuantity: parseFloat(opt.stockQuantity) || 0,
        lowStockThreshold: parseFloat(opt.lowStockThreshold) || 10,
        isAvailable: true,
      })),
    };

    if (editingProduct) {
      updateMutation.mutate({
        id: editingProduct.id,
        name: data.name,
        description: data.description,
        category: data.category,
        imageUrl: data.imageUrl,
      });
    } else {
      createMutation.mutate(data as any);
    }
  };

  const handleDelete = (productId: string, productName: string) => {
    if (confirm(`Tem certeza que deseja excluir "${productName}"? Isso também excluirá todas as opções e não pode ser desfeito.`)) {
      deleteMutation.mutate({ id: productId });
    }
  };

  const addOption = () => {
    setFormData({
      ...formData,
      options: [
        ...formData.options,
        {
          name: "",
          sku: "",
          unitType: "FIXED",
          basePrice: "",
          stockQuantity: "0",
          lowStockThreshold: "10",
        },
      ],
    });
  };

  const removeOption = (index: number) => {
    setFormData({
      ...formData,
      options: formData.options.filter((_, i) => i !== index),
    });
  };

  const updateOption = (index: number, field: string, value: any) => {
    const newOptions = [...formData.options];
    (newOptions[index] as any)[field] = value;
    setFormData({ ...formData, options: newOptions });
  };

  return (
    <PageLayout title="Catálogo de Produtos">
      {/* Header Actions */}
      <div className="mb-6 flex flex-col sm:flex-row gap-3 justify-between">
        <div className="flex gap-3 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar produtos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Input
            placeholder="Categoria..."
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="max-w-[150px]"
          />
        </div>
        <Button onClick={openCreateModal}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Produto
        </Button>
      </div>

      {/* Products Grid */}
      {productsQuery.isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      )}

      {productsQuery.error && (
        <p className="text-center py-8 text-red-600">Erro ao carregar produtos</p>
      )}

      {productsQuery.data && productsQuery.data.items.length === 0 && (
        <div className="text-center py-16 bg-muted rounded-lg">
          <Package className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
          <p className="text-lg text-muted-foreground">Nenhum produto encontrado</p>
          <p className="text-sm text-muted-foreground mt-1">Crie seu primeiro produto para começar</p>
        </div>
      )}

      {productsQuery.data && productsQuery.data.items.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {productsQuery.data.items.map((product) => (
            <div
              key={product.id}
              className="bg-card rounded-lg shadow hover:shadow-lg transition-shadow overflow-hidden"
            >
              {product.imageUrl && (
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  className="w-full h-48 object-cover"
                />
              )}
              <div className="p-4">
                <h3 className="text-lg font-semibold text-foreground mb-1">{product.name}</h3>
                {product.category && (
                  <Badge variant="secondary" className="text-xs mb-2">
                    {product.category}
                  </Badge>
                )}
                <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                  {product.description || "Sem descrição"}
                </p>

                <div className="border-t pt-3 mb-3">
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    {product.options.length} opç{product.options.length !== 1 ? "ões" : "ão"}
                  </p>
                  {product.options.slice(0, 2).map((option: any) => (
                    <div key={option.id} className="text-xs text-muted-foreground mb-1">
                      • {option.name} - R$ {(option.basePrice / 100).toFixed(2)}
                    </div>
                  ))}
                  {product.options.length > 2 && (
                    <p className="text-xs text-muted-foreground">
                      +{product.options.length - 2} mais
                    </p>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => openEditModal(product)}
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    Editar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(product.id, product.name)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Product Modal */}
      <Dialog open={showCreateModal} onOpenChange={(open) => !open && closeModal()}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingProduct ? "Editar Produto" : "Criar Novo Produto"}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Info */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Nome do Produto *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Tomates"
                />
              </div>

              <div>
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descrição do produto..."
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="category">Categoria</Label>
                <Input
                  id="category"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  placeholder="Ex: Vegetais"
                />
              </div>

              <div>
                <Label>Imagem do Produto</Label>
                <ImageUpload
                  value={formData.imageUrl}
                  onChange={(url) => setFormData({ ...formData, imageUrl: url })}
                  onClear={() => setFormData({ ...formData, imageUrl: "" })}
                />
              </div>
            </div>

            {/* Product Options */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <Label>Opções do Produto *</Label>
                <Button type="button" size="sm" variant="outline" onClick={addOption}>
                  <Plus className="h-4 w-4 mr-1" />
                  Adicionar Opção
                </Button>
              </div>

              <div className="space-y-4">
                {formData.options.map((option, index) => (
                  <div key={index} className="border rounded-lg p-4 bg-muted">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium">Opção {index + 1}</span>
                      {formData.options.length > 1 && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => removeOption(index)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor={`option-name-${index}`}>Nome *</Label>
                        <Input
                          id={`option-name-${index}`}
                          value={option.name}
                          onChange={(e) => updateOption(index, "name", e.target.value)}
                          placeholder="Ex: Caixa 1kg"
                        />
                      </div>
                      <div>
                        <Label htmlFor={`option-sku-${index}`}>SKU *</Label>
                        <Input
                          id={`option-sku-${index}`}
                          value={option.sku}
                          onChange={(e) => updateOption(index, "sku", e.target.value)}
                          placeholder="Ex: TOM-1KG"
                        />
                      </div>
                      <div>
                        <Label htmlFor={`option-unitType-${index}`}>Tipo de Unidade *</Label>
                        <Select
                          value={option.unitType}
                          onValueChange={(value) => updateOption(index, "unitType", value)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="FIXED">Fixo (por unidade)</SelectItem>
                            <SelectItem value="WEIGHT">Peso (por kg)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor={`option-price-${index}`}>Preço (R$) *</Label>
                        <Input
                          id={`option-price-${index}`}
                          type="number"
                          step="0.01"
                          min="0"
                          value={option.basePrice}
                          onChange={(e) => updateOption(index, "basePrice", e.target.value)}
                          placeholder="8.50"
                        />
                      </div>
                      <div>
                        <Label htmlFor={`option-stock-${index}`}>Estoque Inicial</Label>
                        <Input
                          id={`option-stock-${index}`}
                          type="number"
                          step="0.01"
                          min="0"
                          value={option.stockQuantity}
                          onChange={(e) => updateOption(index, "stockQuantity", e.target.value)}
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <Label htmlFor={`option-threshold-${index}`}>Alerta Estoque Baixo</Label>
                        <Input
                          id={`option-threshold-${index}`}
                          type="number"
                          step="0.01"
                          min="0"
                          value={option.lowStockThreshold}
                          onChange={(e) =>
                            updateOption(index, "lowStockThreshold", e.target.value)
                          }
                          placeholder="10"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeModal}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {editingProduct ? "Atualizar Produto" : "Criar Produto"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
}
