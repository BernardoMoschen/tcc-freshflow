import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { trpc } from "@/lib/trpc";
import { useCart } from "@/hooks/use-cart";
import { PageLayout } from "@/components/page-layout";
import { ProductCardSkeleton } from "@/components/ui/skeleton";
import { X, Clock } from "lucide-react";

const RECENT_SEARCHES_KEY = "freshflow:recent-searches";
const MAX_RECENT_SEARCHES = 5;

export function CatalogPage() {
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [showRecentSearches, setShowRecentSearches] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [unitType, setUnitType] = useState<"FIXED" | "WEIGHT" | "">("");
  const [sortBy, setSortBy] = useState<"name" | "price">("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const { addItem, count } = useCart();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchDropdownRef = useRef<HTMLDivElement>(null);

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
    setSearch(value);
    if (value.trim().length >= 2) {
      saveRecentSearch(value);
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

  const productsQuery = trpc.products.list.useQuery({
    skip: 0,
    take: 20,
    search: search || undefined,
    minPrice: minPrice ? parseFloat(minPrice) * 100 : undefined,
    maxPrice: maxPrice ? parseFloat(maxPrice) * 100 : undefined,
    unitType: unitType || undefined,
    sortBy,
    sortOrder,
  });

  return (
    <PageLayout
      title="Catalog"
      action={
        <Link
          to="/chef/cart"
          className="hidden md:flex bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary/90 items-center space-x-2"
        >
          <span>Cart ({count})</span>
        </Link>
      }
    >
      {/* Search bar - always visible */}
      <div className="mb-4 relative">
        <input
          ref={searchInputRef}
          type="text"
          placeholder="Search products..."
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
              <span className="text-xs font-medium text-gray-500 uppercase">Recent Searches</span>
              <button
                onClick={clearRecentSearches}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                Clear All
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

      {/* Filter toggle button - mobile only */}
      <button
        onClick={() => setShowFilters(!showFilters)}
        className="md:hidden w-full mb-4 px-4 py-3 bg-white border border-gray-300 rounded-lg text-left flex justify-between items-center"
      >
        <span className="font-medium text-gray-700">Filters</span>
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
              Min Price (R$)
            </label>
            <input
              type="number"
              placeholder="0.00"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Max Price (R$)
            </label>
            <input
              type="number"
              placeholder="999.99"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Unit Type
            </label>
            <select
              value={unitType}
              onChange={(e) => setUnitType(e.target.value as "FIXED" | "WEIGHT" | "")}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              <option value="">All Types</option>
              <option value="FIXED">Fixed Unit</option>
              <option value="WEIGHT">By Weight</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Sort By
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as "name" | "price")}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              <option value="name">Name</option>
              <option value="price">Price</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Order
            </label>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as "asc" | "desc")}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              <option value="asc">Ascending</option>
              <option value="desc">Descending</option>
            </select>
          </div>
        </div>
      </div>

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
        <p className="text-center py-8 text-red-600">Error loading products</p>
      )}

      {/* Product grid - single column on mobile, responsive grid on larger screens */}
      {!productsQuery.isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {productsQuery.data?.items.map((product) =>
          product.options.map((option) => (
            <div key={option.id} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
              {product.imageUrl && (
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  className="w-full h-48 object-cover"
                />
              )}
              <div className="p-4 md:p-6">
                <h3 className="text-lg font-semibold text-gray-900">{product.name}</h3>
                <p className="text-sm text-gray-600 mt-1">{option.name}</p>
                <div className="flex items-center justify-between mt-3">
                  <span className="text-xs font-medium px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                    {option.unitType === "FIXED" ? "Fixed unit" : "By weight"}
                  </span>
                  <p className="text-lg font-bold text-primary">
                    R$ {(option.basePrice / 100).toFixed(2)}
                  </p>
                </div>
                <button
                  onClick={() =>
                    addItem({
                      productOptionId: option.id,
                      productName: product.name,
                      optionName: option.name,
                      unitType: option.unitType,
                      requestedQty: 1,
                      price: option.basePrice,
                    })
                  }
                  className="mt-4 w-full bg-primary text-white px-4 py-3 rounded-lg hover:bg-primary/90 font-medium transition-colors"
                >
                  Add to Cart
                </button>
              </div>
            </div>
          ))
        )}
        </div>
      )}

      {/* Empty state */}
      {productsQuery.data?.items.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-600">No products found</p>
        </div>
      )}
    </PageLayout>
  );
}
