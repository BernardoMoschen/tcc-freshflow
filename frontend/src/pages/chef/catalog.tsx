import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/use-auth";
import { useCart } from "@/hooks/use-cart";
import { useFavorites } from "@/hooks/use-favorites";
import { useDebounce } from "@/hooks/use-debounce";
import { PageLayout } from "@/components/page-layout";
import { ProductCardSkeleton } from "@/components/ui/skeleton";
import { CartPreview } from "@/components/cart-preview";
import { PullToRefresh } from "@/components/pull-to-refresh";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { sanitizeSearchQuery } from "@/lib/sanitize";
import { X, Clock, Plus, Minus, Check, Star, AlertTriangle, XCircle, CheckCircle, Tag } from "lucide-react";

const RECENT_SEARCHES_KEY = "freshflow:recent-searches";
const MAX_RECENT_SEARCHES = 5;

// Type for product option from API response
interface ProductOption {
  id: string;
  name: string;
  sku: string;
  unitType: "FIXED" | "WEIGHT";
  basePrice: number;
  resolvedPrice: number;
  stockQuantity: number | null;
  lowStockThreshold: number | null;
  isAvailable: boolean;
  customerPrices?: Array<{ price: number }>;
}

export function CatalogPage() {
  const { session, isAccountUser } = useAuth();
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [showRecentSearches, setShowRecentSearches] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [unitType, setUnitType] = useState<"FIXED" | "WEIGHT" | "">("");
  const [sortBy, setSortBy] = useState<"name" | "price">("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [justAddedId, setJustAddedId] = useState<string | null>(null);

  // Debounce search to prevent excessive API calls
  const debouncedSearch = useDebounce(search, 300);

  const { items, addItem, updateQuantity, count, isSyncing } = useCart();
  const { toggleFavorite, isFavorite, count: favoritesCount } = useFavorites();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchDropdownRef = useRef<HTMLDivElement>(null);

  // Tenant admins should use the admin products page instead
  // They can still browse here but won't see cart functionality
  const canAddToCart = isAccountUser;

  // Get customer ID from session
  const accountId = localStorage.getItem("freshflow:accountId");
  const currentMembership = session?.memberships?.find(
    (m: any) => m.account?.id === accountId
  );
  const customerId = currentMembership?.account?.customerId;

  // Load recent searches from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
    if (stored) {
      setRecentSearches(JSON.parse(stored));
    }
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchDropdownRef.current &&
        !searchDropdownRef.current.contains(event.target as Node) &&
        !searchInputRef.current?.contains(event.target as Node)
      ) {
        setShowRecentSearches(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const saveRecentSearch = (query: string) => {
    if (!query.trim() || query.length < 2) return;

    const updated = [
      query,
      ...recentSearches.filter((s) => s.toLowerCase() !== query.toLowerCase()),
    ].slice(0, MAX_RECENT_SEARCHES);

    setRecentSearches(updated);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
  };

  const handleSearchChange = (value: string) => {
    // Sanitize search input
    const sanitized = sanitizeSearchQuery(value);
    setSearch(sanitized);
    if (sanitized.trim().length >= 2) {
      saveRecentSearch(sanitized);
    }
  };

  const clearSearch = () => {
    setSearch("");
    searchInputRef.current?.focus();
  };

  const selectRecentSearch = (query: string) => {
    setSearch(query);
    setShowRecentSearches(false);
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    localStorage.removeItem(RECENT_SEARCHES_KEY);
  };

  // Ensure tenant context exists before querying products
  const hasTenantContext = !!localStorage.getItem("freshflow:tenantId");

  const productsQuery = trpc.products.list.useQuery(
    {
      skip: 0,
      take: 20,
      search: debouncedSearch || undefined,
      minPrice: minPrice ? parseFloat(minPrice) * 100 : undefined,
      maxPrice: maxPrice ? parseFloat(maxPrice) * 100 : undefined,
      unitType: unitType || undefined,
      sortBy,
      sortOrder,
      customerId: customerId || undefined,
    },
    { enabled: hasTenantContext }
  );

  // Pull-to-refresh handler
  const handleRefresh = useCallback(async () => {
    await productsQuery.refetch();
  }, [productsQuery]);

  // Check if on mobile (for pull-to-refresh)
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  return (
    <PageLayout
      title="Catálogo"
      action={
        canAddToCart ? (
          <Link
            to="/chef/cart"
            className="hidden md:flex bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary/90 items-center space-x-2"
          >
            <span>Carrinho ({count})</span>
          </Link>
        ) : (
          <Link
            to="/admin/products"
            className="hidden md:flex bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary/90 items-center space-x-2"
          >
            <span>Gerenciar Produtos</span>
          </Link>
        )
      }
    >
      {/* Barra de busca - sempre visível */}
      <div className="mb-4 relative">
        <input
          ref={searchInputRef}
          type="text"
          placeholder="Buscar produtos..."
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          onFocus={() => setShowRecentSearches(true)}
          className="w-full px-4 py-3 pr-10 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
        />
        {search && (
          <button
            onClick={clearSearch}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Clear search"
          >
            <X className="h-5 w-5" />
          </button>
        )}

        {/* Recent Searches Dropdown */}
        {showRecentSearches && !search && recentSearches.length > 0 && (
          <div
            ref={searchDropdownRef}
            className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden"
          >
            <div className="p-2 border-b border-gray-100 flex items-center justify-between">
              <span className="text-xs font-medium text-gray-500 uppercase">Buscas Recentes</span>
              <button
                onClick={clearRecentSearches}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                Limpar
              </button>
            </div>
            <div className="max-h-60 overflow-y-auto">
              {recentSearches.map((query, index) => (
                <button
                  key={index}
                  onClick={() => selectRecentSearch(query)}
                  className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-3 transition-colors"
                >
                  <Clock className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-700">{query}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Quick Filters */}
      <div className="flex gap-2 mb-4 overflow-x-auto">
        <Button
          variant={showFavoritesOnly ? "default" : "outline"}
          size="sm"
          onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
          className="flex-shrink-0"
        >
          <Star className={`h-4 w-4 mr-1 ${showFavoritesOnly ? "fill-current" : ""}`} />
          Favoritos {favoritesCount > 0 && `(${favoritesCount})`}
        </Button>
      </div>

      {/* Botão de filtros - apenas mobile */}
      <button
        onClick={() => setShowFilters(!showFilters)}
        className="md:hidden w-full mb-4 px-4 py-3 bg-white border border-gray-300 rounded-lg text-left flex justify-between items-center"
      >
        <span className="font-medium text-gray-700">Mais Filtros</span>
        <svg
          className={`w-5 h-5 transition-transform ${showFilters ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Filters - collapsible on mobile, always visible on desktop */}
      <div className={`${showFilters ? "block" : "hidden"} md:block mb-6`}>
        <div className="bg-white p-4 rounded-lg shadow-sm space-y-4 md:space-y-0 md:grid md:grid-cols-2 lg:grid-cols-5 md:gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Preço Mín. (R$)
            </label>
            <input
              type="number"
              placeholder="0,00"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Preço Máx. (R$)
            </label>
            <input
              type="number"
              placeholder="999,99"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tipo de Unidade
            </label>
            <select
              value={unitType}
              onChange={(e) => setUnitType(e.target.value as "FIXED" | "WEIGHT" | "")}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              <option value="">Todos</option>
              <option value="FIXED">Unidade Fixa</option>
              <option value="WEIGHT">Por Peso</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Ordenar Por
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as "name" | "price")}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              <option value="name">Nome</option>
              <option value="price">Preço</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Ordem
            </label>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as "asc" | "desc")}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              <option value="asc">Crescente</option>
              <option value="desc">Decrescente</option>
            </select>
          </div>
        </div>
      </div>

      {/* Pull-to-refresh hint on mobile */}
      {isMobile && !productsQuery.isLoading && (
        <p className="text-center text-xs text-gray-400 mb-2 md:hidden">
          Puxe para atualizar
        </p>
      )}

      {/* Wrap content with PullToRefresh on mobile */}
      <PullToRefresh
        onRefresh={handleRefresh}
        disabled={!isMobile}
        className={isMobile ? "min-h-[50vh]" : ""}
      >
        {/* Loading and error states */}
        {productsQuery.isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            <ProductCardSkeleton />
            <ProductCardSkeleton />
            <ProductCardSkeleton />
            <ProductCardSkeleton />
            <ProductCardSkeleton />
            <ProductCardSkeleton />
          </div>
        )}
        {productsQuery.error && (
          <div className="text-center py-12 bg-red-50 rounded-lg">
            <AlertTriangle className="mx-auto h-12 w-12 text-red-400" aria-hidden="true" />
            <p className="mt-3 text-lg font-medium text-red-800">Erro ao carregar produtos</p>
            <p className="mt-1 text-sm text-red-600">
              {productsQuery.error.message || "Não foi possível carregar os produtos. Tente novamente."}
            </p>
            <Button
              onClick={() => productsQuery.refetch()}
              variant="outline"
              className="mt-4"
            >
              Tentar Novamente
            </Button>
          </div>
        )}

        {/* Product grid - single column on mobile, responsive grid on larger screens */}
        {!productsQuery.isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {productsQuery.data?.items.map((product) =>
            product.options
              .filter((option: ProductOption) => !showFavoritesOnly || isFavorite(option.id))
              .map((option: ProductOption) => {
            const cartItem = items.find((item) => item.productOptionId === option.id);
            const inCart = !!cartItem;
            const justAdded = justAddedId === option.id;
            const favorite = isFavorite(option.id);

            // Stock status logic
            const stockQty = option.stockQuantity ?? 0;
            const lowThreshold = option.lowStockThreshold ?? 10;
            const isOutOfStock = !option.isAvailable || stockQty === 0;
            const isLowStock = stockQty > 0 && stockQty <= lowThreshold;

            const handleAddToCart = () => {
              if (isOutOfStock) return;
              addItem({
                productOptionId: option.id,
                productName: product.name,
                optionName: option.name,
                unitType: option.unitType,
                requestedQty: 1,
                price: (option as any).resolvedPrice || option.basePrice,
              });
              setJustAddedId(option.id);
              setTimeout(() => setJustAddedId(null), 2000);
            };

            return (
              <div key={option.id} className={`bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-all relative ${isOutOfStock ? 'opacity-75' : ''}`}>
                {/* Favorite Star */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFavorite(option.id);
                  }}
                  className="absolute top-2 right-2 z-10 bg-white/90 hover:bg-white rounded-full p-2 shadow-md transition-all hover:scale-110"
                  aria-label={favorite ? `Remover ${product.name} dos favoritos` : `Adicionar ${product.name} aos favoritos`}
                  aria-pressed={favorite}
                >
                  <Star
                    className={`h-5 w-5 ${
                      favorite ? "fill-yellow-400 text-yellow-400" : "text-gray-400"
                    }`}
                    aria-hidden="true"
                  />
                </button>

                {/* Badge de Estoque */}
                <div className="absolute top-2 left-2 z-10">
                  {isOutOfStock ? (
                    <Badge variant="destructive" className="flex items-center gap-1">
                      <XCircle className="h-3 w-3" />
                      Esgotado
                    </Badge>
                  ) : isLowStock ? (
                    <Badge variant="secondary" className="flex items-center gap-1 bg-yellow-100 text-yellow-800 border-yellow-300">
                      <AlertTriangle className="h-3 w-3" />
                      Estoque Baixo ({stockQty})
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="flex items-center gap-1 bg-green-100 text-green-800 border-green-300">
                      <CheckCircle className="h-3 w-3" />
                      Em Estoque
                    </Badge>
                  )}
                </div>

                {product.imageUrl ? (
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="w-full h-48 object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <div className="w-full h-48 bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                    <span className="text-5xl font-bold text-primary/30">
                      {product.name.charAt(0)}
                    </span>
                  </div>
                )}
                <div className="p-4 md:p-6">
                  <h3 className="text-lg font-semibold text-gray-900">{product.name}</h3>
                  <p className="text-sm text-gray-600 mt-1">{option.name}</p>
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-xs font-medium px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                      {option.unitType === "FIXED" ? "Unidade fixa" : "Por peso"}
                    </span>
                    <div className="text-right">
                      <p className="text-lg font-bold text-primary">
                        R$ {(((option as any).resolvedPrice || option.basePrice) / 100).toFixed(2)}
                      </p>
                      {(option as any).hasCustomerPrice && (
                        <div className="flex items-center gap-1 text-xs text-green-600">
                          <Tag className="h-3 w-3" />
                          <span>Preço especial</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Quick Quantity Picker - Only for account users who can add to cart */}
                  {canAddToCart && (
                    inCart ? (
                      <div className="mt-4 flex items-center gap-2" role="group" aria-label={`Quantidade de ${product.name}`}>
                        <button
                          onClick={() => updateQuantity(option.id, Math.max(0.1, cartItem.requestedQty - 1))}
                          disabled={isOutOfStock || isSyncing}
                          className="flex-shrink-0 h-10 w-10 rounded-lg border-2 border-primary text-primary hover:bg-primary hover:text-white transition-colors flex items-center justify-center font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                          aria-label={`Diminuir quantidade de ${product.name}`}
                        >
                          <Minus className="h-4 w-4" aria-hidden="true" />
                        </button>
                        <div className="flex-1 text-center">
                          <p className="text-lg font-bold text-primary" aria-live="polite">{cartItem.requestedQty}</p>
                          <p className="text-xs text-gray-500">{isSyncing ? "sincronizando..." : "no carrinho"}</p>
                        </div>
                        <button
                          onClick={() => updateQuantity(option.id, cartItem.requestedQty + 1)}
                          disabled={isOutOfStock || isSyncing}
                          className="flex-shrink-0 h-10 w-10 rounded-lg border-2 border-primary bg-primary text-white hover:bg-primary/90 transition-colors flex items-center justify-center font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                          aria-label={`Aumentar quantidade de ${product.name}`}
                        >
                          <Plus className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={handleAddToCart}
                        disabled={isOutOfStock || isSyncing}
                        className={`mt-4 w-full px-4 py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                          isOutOfStock
                            ? "bg-gray-300 text-gray-600"
                            : justAdded
                            ? "bg-green-500 text-white"
                            : "bg-primary text-white hover:bg-primary/90"
                        }`}
                      >
                        {isOutOfStock ? (
                          <>
                            <XCircle className="h-5 w-5" />
                            Esgotado
                          </>
                        ) : justAdded ? (
                          <>
                            <Check className="h-5 w-5" />
                            Adicionado!
                          </>
                        ) : isSyncing ? (
                          <>
                            <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Adicionando...
                          </>
                        ) : (
                          <>
                            <Plus className="h-5 w-5" />
                            Adicionar
                          </>
                        )}
                      </button>
                    )
                  )}
                </div>
              </div>
            );
            })
          )}
          </div>
        )}

        {/* Estado vazio */}
        {productsQuery.data?.items.length === 0 && (
          <div className="text-center py-16 bg-gray-50 rounded-lg">
            <svg
              className="mx-auto h-16 w-16 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
              />
            </svg>
            <p className="mt-4 text-lg font-medium text-gray-700">
              {search || minPrice || maxPrice || unitType || showFavoritesOnly
                ? "Nenhum produto corresponde aos filtros"
                : "Nenhum produto disponível"}
            </p>
            <p className="mt-1 text-sm text-gray-500">
              {search || minPrice || maxPrice || unitType || showFavoritesOnly
                ? "Tente ajustar seus filtros ou termos de busca"
                : "Não há produtos cadastrados no momento"}
            </p>
            {(search || minPrice || maxPrice || unitType || showFavoritesOnly) && (
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => {
                  setSearch("");
                  setMinPrice("");
                  setMaxPrice("");
                  setUnitType("");
                  setShowFavoritesOnly(false);
                }}
              >
                Limpar Filtros
              </Button>
            )}
          </div>
        )}
      </PullToRefresh>

      {/* Floating Cart Preview - Only for account users */}
      {canAddToCart && <CartPreview />}
    </PageLayout>
  );
}
