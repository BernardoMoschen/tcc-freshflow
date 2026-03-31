import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardSkeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Share2, ShoppingCart, Package, Phone } from "lucide-react";

export function PublicCatalogPage() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const catalogQuery = trpc.products.publicCatalog.useQuery(
    {
      tenantSlug: tenantSlug!,
      search: searchQuery || undefined,
      category: categoryFilter !== "all" ? categoryFilter : undefined,
    },
    {
      enabled: !!tenantSlug,
    }
  );

  const formatPrice = (priceInCents: number) => {
    return `R$ ${(priceInCents / 100).toFixed(2)}`;
  };

  const shareProduct = (productName: string, price: number, tenantName: string) => {
    const text = `🛒 *${productName}*\n\nPreço: ${formatPrice(price)}\n\nDisponível em: ${tenantName}\n\nFaça seu pedido agora!`;
    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(whatsappUrl, "_blank");
  };

  const shareCatalog = () => {
    const url = window.location.href;
    const text = `🛒 Confira nosso catálogo de produtos frescos!\n\n${catalogQuery.data?.tenant.name}\n\n${url}`;
    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(whatsappUrl, "_blank");
  };

  const orderViaWhatsApp = (productName: string, optionName: string) => {
    const text = `Olá! Gostaria de fazer um pedido:\n\n• ${productName} - ${optionName}\n\nPoderia me ajudar?`;
    // Use the default WhatsApp number or business number
    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(whatsappUrl, "_blank");
  };

  if (catalogQuery.isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <CardSkeleton />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </div>
        </div>
      </div>
    );
  }

  if (catalogQuery.error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 flex items-center justify-center">
        <div className="text-center p-8">
          <Package className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Catálogo não encontrado</h2>
          <p className="text-gray-600">Verifique o link e tente novamente.</p>
        </div>
      </div>
    );
  }

  const { tenant, products, categories } = catalogQuery.data!;

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50">
      {/* Header */}
      <div className="bg-card shadow-sm border-b border-border sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">{tenant.name}</h1>
              <p className="text-sm text-muted-foreground mt-1">Produtos Frescos 🥬🍅</p>
            </div>
            <Button
              onClick={shareCatalog}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <Share2 className="h-4 w-4" />
              <span className="hidden sm:inline">Compartilhar</span>
            </Button>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar produtos..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas Categorias</SelectItem>
                {categories.map((category: any) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Products Grid */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {products.length === 0 ? (
          <div className="text-center py-16">
            <Package className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-foreground mb-2">
              Nenhum produto encontrado
            </h3>
            <p className="text-muted-foreground">Tente ajustar os filtros de busca.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((product: any) => (
              <div
                key={product.id}
                className="bg-card rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow"
              >
                {/* Product Image */}
                {product.imageUrl ? (
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="w-full h-48 object-cover"
                  />
                ) : (
                  <div className="w-full h-48 bg-gradient-to-br from-green-100 to-emerald-100 flex items-center justify-center">
                    <Package className="h-16 w-16 text-green-600" />
                  </div>
                )}

                <div className="p-4">
                  {/* Category Badge */}
                  {product.category && (
                    <Badge variant="secondary" className="mb-2">
                      {product.category}
                    </Badge>
                  )}

                  {/* Product Name */}
                  <h3 className="text-lg font-semibold text-card-foreground mb-2">
                    {product.name}
                  </h3>

                  {/* Description */}
                  {product.description && (
                    <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                      {product.description}
                    </p>
                  )}

                  {/* Options */}
                  <div className="space-y-2">
                    {product.options.map((option: any) => (
                      <div
                        key={option.id}
                        className="flex items-center justify-between p-3 bg-muted rounded-lg"
                      >
                        <div className="flex-1">
                          <p className="text-sm font-medium text-foreground">{option.name}</p>
                          <p className="text-xs text-muted-foreground">SKU: {option.sku}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-green-600">
                            {formatPrice(option.basePrice)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {option.stockQuantity} disponível
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 mt-4">
                    <Button
                      onClick={() =>
                        orderViaWhatsApp(product.name, product.options[0].name)
                      }
                      className="flex-1 bg-green-600 hover:bg-green-700"
                      size="sm"
                    >
                      <ShoppingCart className="h-4 w-4 mr-1" />
                      Pedir
                    </Button>
                    <Button
                      onClick={() =>
                        shareProduct(product.name, product.options[0].basePrice, tenant.name)
                      }
                      variant="outline"
                      size="sm"
                    >
                      <Share2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="bg-card border-t border-border mt-12">
        <div className="max-w-6xl mx-auto px-4 py-8 text-center">
          <p className="text-muted-foreground mb-4">
            Faça seu pedido pelo WhatsApp ou acesse nosso sistema
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              onClick={() => {
                const text = "Olá! Gostaria de fazer um pedido.";
                window.open(
                  `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`,
                  "_blank"
                );
              }}
              className="bg-green-600 hover:bg-green-700"
            >
              <Phone className="h-4 w-4 mr-2" />
              Falar no WhatsApp
            </Button>
            <Button asChild variant="outline">
              <Link to="/login">Acessar Sistema</Link>
            </Button>
          </div>
          <p className="text-sm text-muted-foreground mt-6">
            Powered by <span className="font-semibold">FreshFlow</span>
          </p>
        </div>
      </div>
    </div>
  );
}
